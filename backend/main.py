import os
import hmac
import hashlib
import json
import base64
import requests
from datetime import datetime, timedelta
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Header, Request, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from backend.config import Config, SLA_RULES
from backend.database import get_db, Base, engine
from backend.models import User, Report, ReportCluster, Authority, Escalation, NotificationLog
from backend.agents.intake_agent import IntakeAgent
from backend.agents.clustering_agent import ClusteringAgent
from backend.tasks import process_report_task

# Startup production assertions
if Config.ENV == "production":
    if not Config.GROQ_API_KEY or "your_groq" in Config.GROQ_API_KEY:
        print("[WARNING] GROQ_API_KEY is not configured. AI vision models will use fallback reasoning.")
    if Config.JWT_SECRET == "sewa_dev_secret_change_in_production_321!":
        print("[WARNING] Default JWT_SECRET is being used. Set JWT_SECRET in production environment variables.")

# Initialize FastAPI app and router
app = FastAPI(title="Sewa API", description="Civic Reporting and Escalation Platform")
api_router = APIRouter()

# Enable CORS for local PWA testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    Base.metadata.create_all(bind=engine)
    from backend.seed import seed_db
    seed_db()
except Exception as e:
    print(f"[Database Init Warning] {e}")

# Serve upload folder statically
try:
    app.mount("/static", StaticFiles(directory=str(Config.UPLOAD_DIR)), name="static")
except Exception as e:
    print(f"[Static Mount Warning] {e}")

# Mount frontend production dist assets if it exists
FRONTEND_DIST = Config.BASE_DIR.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    try:
        app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")
    except Exception as e:
        print(f"[Assets Mount Warning] {e}")


# --- CRYPTOGRAPHIC SIGNED TOKEN UTILITIES ---
SECRET_KEY = Config.JWT_SECRET.encode()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=Config.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire.isoformat()})
    
    payload_json = json.dumps(to_encode)
    payload_b64 = base64.urlsafe_b64encode(payload_json.encode()).decode()
    signature = hmac.new(SECRET_KEY, payload_b64.encode(), hashlib.sha256).hexdigest()
    return f"{payload_b64}.{signature}"

def decode_access_token(token: str) -> Optional[dict]:
    try:
        parts = token.split(".")
        if len(parts) != 2:
            return None
        payload_b64, signature = parts
        
        # Verify HMAC signature
        expected_sig = hmac.new(SECRET_KEY, payload_b64.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected_sig):
            return None
            
        # Add Base64 padding if needed
        missing_padding = len(payload_b64) % 4
        if missing_padding:
            payload_b64 += "=" * (4 - missing_padding)
            
        payload_json = base64.urlsafe_b64decode(payload_b64.encode()).decode()
        payload = json.loads(payload_json)
        
        exp_time = datetime.fromisoformat(payload["exp"])
        if datetime.utcnow() > exp_time:
            return None
            
        return payload
    except Exception as e:
        print(f"[Auth] Token decoding exception: {e}")
        return None

# Dependency to fetch current user from Authorization bearer token
def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    auth_val = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth_val or not auth_val.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication token missing. Please log in.")
        
    token = auth_val.split(" ")[1]
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired authentication token. Please log in again.")
        
    user = db.query(User).filter(User.phone == payload.get("phone")).first()
    if not user:
        raise HTTPException(status_code=401, detail="User profile not found")
    return user

# EXPLICIT ROLE-BASED ACCESS CONTROL (RBAC) DEPENDENCY
def require_role(required_role: str):
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires '{required_role}' administrative privileges."
            )
        return current_user
    return role_checker


# --- AUTHENTICATION ROUTES ---

@api_router.post("/auth/otp/send")
async def send_otp(phone: str = Form(...), db: Session = Depends(get_db)):
    """Sends a 6-digit OTP code to the phone number."""
    user = db.query(User).filter(User.phone == phone).first()
    if not user:
        # Determine role based on phone number (Officer 8888888888 gets authority role)
        role = "authority" if phone == "8888888888" else "citizen"
        name = "Officer Sharma" if role == "authority" else "Citizen"
        user = User(phone=phone, name=name, role=role, hashed_password=phone)
        db.add(user)
        
    otp = "123456" if Config.ENV == "development" else str(int(os.urandom(3).hex(), 16))[:6]
    user.otp = otp
    user.otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
    db.commit()
    
    # Trigger Twilio SMS if keys available
    if Config.TWILIO_ACCOUNT_SID and "your_twilio" not in Config.TWILIO_ACCOUNT_SID:
        try:
            from backend.agents.notification_agent import NotificationAgent
            NotificationAgent.send_sms(db, phone, f"Sewa Verification Code: {otp}. Valid for 10 minutes.")
        except Exception as e:
            print(f"[Auth] Twilio SMS dispatch exception: {e}")
            
    return {"message": "Verification code sent successfully", "phone": phone}

@api_router.post("/auth/otp/verify")
async def verify_otp(phone: str = Form(...), code: str = Form(...), name: Optional[str] = Form(None), db: Session = Depends(get_db)):
    """Verifies OTP and returns a signed bearer token. Bypasses 123456 ONLY if ENV == 'development'."""
    user = db.query(User).filter(User.phone == phone).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not registered")
        
    # Check OTP verification
    is_valid_otp = user.otp and user.otp == code and datetime.utcnow() <= user.otp_expires_at
    is_dev_bypass = (Config.ENV == "development" and code == "123456")
    
    if not is_valid_otp and not is_dev_bypass:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")
            
    if name:
        user.name = name
        
    user.otp = None
    db.commit()
    
    token = create_access_token({"phone": user.phone, "role": user.role})
    return {"access_token": token, "token_type": "bearer", "role": user.role, "name": user.name, "phone": user.phone}

@api_router.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "phone": current_user.phone,
        "name": current_user.name,
        "role": current_user.role
    }


# --- REPORT SUBMISSION & TIMELINE ROUTES ---

@api_router.post("/reports/submit")
async def submit_report(
    file: UploadFile = File(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    caption: Optional[str] = Form(""),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submits a report. Enforces citizen rate-limiting to prevent single-user report spamming.
    """
    # Rate Limit Check: max 3 reports per 10 minutes per user
    within_limit = ClusteringAgent.check_user_rate_limit(db, current_user.id, "general", limit=3, window_minutes=10)
    if not within_limit:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. You can file a maximum of 3 reports every 10 minutes to prevent abuse."
        )

    file_bytes = await file.read()
    
    intake_data = await IntakeAgent.ingest_media(
        file_bytes=file_bytes,
        filename=file.filename,
        content_type=file.content_type,
        latitude=latitude,
        longitude=longitude
    )
    
    new_report = Report(
        category="other",
        media_url=intake_data["media_url"],
        media_type=intake_data["media_type"],
        description=caption,
        latitude=intake_data["latitude"],
        longitude=intake_data["longitude"],
        status="submitted",
        severity=1.0,
        confidence=1.0,
        submitted_by=current_user.id
    )
    
    db.add(new_report)
    db.commit()
    db.refresh(new_report)
    
    # Trigger agentic pipeline task
    process_report_task(new_report.id)
    db.refresh(new_report)
    
    return {
        "message": "Report submitted and processing started",
        "report_id": new_report.id,
        "category": new_report.category,
        "status": new_report.status,
        "severity": new_report.severity
    }

@api_router.get("/reports/my")
async def get_my_reports(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    reports = db.query(Report).filter(Report.submitted_by == current_user.id).order_by(Report.created_at.desc()).all()
    return reports

@api_router.get("/reports/{report_id}/timeline")
async def get_report_timeline(report_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    if current_user.role != "authority" and report.submitted_by != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    timeline = []
    timeline.append({
        "status": "submitted",
        "title": "Report Submitted",
        "description": "Civic grievance received with GPS coordinates and media attachment.",
        "date": report.created_at.isoformat()
    })
    
    if report.status != "submitted" or report.category != "other":
        timeline.append({
            "status": "analyzed",
            "title": "AI Inspection Complete",
            "description": f"Classified as '{report.category.capitalize()}' with urgency score {report.severity:.1f}/10.",
            "date": report.created_at.isoformat()
        })
        
    notif_logs = db.query(NotificationLog).filter(
        NotificationLog.report_id == report_id
    ).order_by(NotificationLog.sent_at.asc()).all()
    
    for log in notif_logs:
        timeline.append({
            "status": "notified",
            "title": f"Authority Notified ({log.channel.upper()})",
            "description": f"Dispatched alert to {log.recipient}. Status: {log.status}.",
            "date": log.sent_at.isoformat()
        })
        
    if report.cluster_id:
        cluster = db.query(ReportCluster).filter(ReportCluster.id == report.cluster_id).first()
        if cluster:
            escalations = db.query(Escalation).filter(Escalation.cluster_id == cluster.id).all()
            for esc in escalations:
                timeline.append({
                    "status": "escalated",
                    "title": "Escalated to High Ministry",
                    "description": f"Escalated to {esc.escalated_to} because of: {esc.reason}",
                    "date": esc.escalated_at.isoformat()
                })
                
            if cluster.status == "resolved":
                timeline.append({
                    "status": "resolved",
                    "title": "Grievance Resolved",
                    "description": "Municipal department confirmed work order closure.",
                    "date": cluster.last_reported_at.isoformat()
                })
                
    return {
        "report": {
            "id": report.id,
            "category": report.category,
            "media_url": report.media_url,
            "description": report.description,
            "latitude": report.latitude,
            "longitude": report.longitude,
            "status": report.status,
            "severity": report.severity,
            "created_at": report.created_at.isoformat()
        },
        "timeline": timeline
    }


# --- PUBLIC TRANSPARENCY ROUTES ---

@api_router.get("/transparency/clusters")
async def get_public_clusters(db: Session = Depends(get_db)):
    clusters = db.query(ReportCluster).filter(ReportCluster.category != "flagged").all()
    return clusters

@api_router.get("/transparency/stats")
async def get_public_stats(db: Session = Depends(get_db)):
    total_reports = db.query(Report).filter(Report.category != "flagged").count()
    resolved_reports = db.query(Report).filter(Report.status == "resolved").count()
    open_reports = total_reports - resolved_reports
    resolution_rate = (resolved_reports / total_reports * 100.0) if total_reports > 0 else 100.0
    
    categories = ["pothole", "garbage", "animal", "emergency", "other"]
    dist = {}
    for cat in categories:
        dist[cat] = db.query(Report).filter(Report.category == cat).count()
        
    return {
        "total_filings": total_reports,
        "resolved_filings": resolved_reports,
        "active_filings": open_reports,
        "resolution_rate": round(resolution_rate, 1),
        "category_breakdown": dist
    }


# --- GENAI CHATBOT ASSISTANT ROUTE ("Sewa Mitra") ---

@api_router.post("/chat")
async def chat_with_sewa_mitra(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    GenAI Chatbot assistant ("Sewa Mitra") for progress tracking.
    Queries the citizen's reports, active clusters, and SLA status,
    and feeds structured context into Groq LLM to generate intelligent progress updates.
    """
    user_msg = data.get("message", "").strip()
    if not user_msg:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
        
    # Query user's reports from database
    user_reports = db.query(Report).filter(Report.submitted_by == current_user.id).order_by(Report.created_at.desc()).all()
    
    # Build context summary
    report_summaries = []
    for r in user_reports[:5]:
        cluster_info = ""
        if r.cluster_id:
            c = db.query(ReportCluster).filter(ReportCluster.id == r.cluster_id).first()
            if c:
                cluster_info = f"Cluster #{c.id} (Status: {c.status.upper()}, Citizen Count: {c.report_count}, Escalation Level: {c.escalation_level})"
                
        report_summaries.append(
            f"• Report #{r.id} | Category: {r.category} | Status: {r.status} | Severity: {r.severity}/10 | "
            f"Submitted: {r.created_at.strftime('%Y-%m-%d %H:%M')} | Description: '{r.description}' | {cluster_info}"
        )
        
    context_str = "\n".join(report_summaries) if report_summaries else "No reports filed yet."
    
    # Call Groq GenAI model
    if Config.GROQ_API_KEY and "your_groq" not in Config.GROQ_API_KEY:
        try:
            import requests
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {"Authorization": f"Bearer {Config.GROQ_API_KEY}", "Content-Type": "application/json"}
            
            prompt = (
                "You are 'Sewa Mitra', an empathetic, highly knowledgeable GenAI assistant for the Sewa civic governance portal. "
                "Answer the citizen's query clearly, politely, and accurately based on their real filed reports context below. "
                f"Citizen Name: {current_user.name or 'Citizen'} (Phone: {current_user.phone}).\n"
                f"Active Filings Context:\n{context_str}\n\n"
                f"User Question: '{user_msg}'\n\n"
                "If they ask about SLA or escalation, explain that Sewa's multi-agent pipeline automatically escalates unresolved clusters "
                "to state/central ministries when SLAs breach. Keep your response concise (2-3 sentences), warm, and informative."
            )
            
            payload = {
                "model": Config.REASONING_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
                "max_tokens": 300
            }
            
            res = requests.post(url, headers=headers, json=payload, timeout=12)
            if res.status_code == 200:
                reply = res.json()["choices"][0]["message"]["content"]
                return {"reply": reply}
        except Exception as e:
            print(f"[Chatbot] Groq GenAI exception: {e}")

    # Fallback GenAI Response
    if "pothole" in user_msg.lower() or "garbage" in user_msg.lower() or "status" in user_msg.lower() or "report" in user_msg.lower():
        reply = f"Hello {current_user.name or 'Citizen'}! You currently have {len(user_reports)} filed grievance(s). Your latest filing is active on the neighborhood map under municipal SLA monitoring."
    else:
        reply = f"Hello {current_user.name or 'Citizen'}! I am Sewa Mitra. You can track your reported grievances, check SLA escalation countdowns, or ask me about civic resolution workflows!"

    return {"reply": reply}


# --- SAARTHI AGENT ROUTE ("Saarthi Community Alliance") ---

@api_router.post("/saarthi/trigger/{cluster_id}")
async def trigger_saarthi(
    cluster_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Triggers the Saarthi Agent for a given cluster.
    Web-scrapes local contractors and NGOs, unites distinct citizens, and dispatches demand notices.
    """
    from backend.agents.saarthi_agent import SaarthiAgent
    result = SaarthiAgent.trigger_saarthi_coalition(db, cluster_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result

@api_router.get("/authority/clusters")
async def get_authority_dashboard_clusters(current_user: User = Depends(require_role("authority")), db: Session = Depends(get_db)):
    """
    Returns active clusters. PROTECTED by require_role('authority'). Rejects citizen tokens with 403 Forbidden.
    """
    clusters = db.query(ReportCluster).filter(ReportCluster.category != "flagged").order_by(ReportCluster.last_reported_at.desc()).all()
    
    result = []
    for c in clusters:
        reports = db.query(Report).filter(Report.cluster_id == c.id).all()
        escalation = db.query(Escalation).filter(Escalation.cluster_id == c.id).first()
        
        result.append({
            "id": c.id,
            "latitude": c.latitude,
            "longitude": c.longitude,
            "category": c.category,
            "report_count": c.report_count,
            "first_reported_at": c.first_reported_at.isoformat(),
            "last_reported_at": c.last_reported_at.isoformat(),
            "status": c.status,
            "escalation_level": c.escalation_level,
            "escalation_reason": escalation.reason if escalation else None,
            "reports": [{
                "id": r.id,
                "media_url": r.media_url,
                "media_type": r.media_type,
                "description": r.description,
                "latitude": r.latitude,
                "longitude": r.longitude,
                "status": r.status,
                "severity": r.severity,
                "created_at": r.created_at.isoformat()
            } for r in reports]
        })
        
    return result

@api_router.post("/authority/clusters/{cluster_id}/resolve")
async def resolve_cluster(cluster_id: int, current_user: User = Depends(require_role("authority")), db: Session = Depends(get_db)):
    """Marks a cluster as RESOLVED. Rejects citizen tokens with 403 Forbidden."""
    cluster = db.query(ReportCluster).filter(ReportCluster.id == cluster_id).first()
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
        
    cluster.status = "resolved"
    cluster.last_reported_at = datetime.utcnow()
    
    reports = db.query(Report).filter(Report.cluster_id == cluster_id).all()
    for r in reports:
        r.status = "resolved"
        
    db.commit()
    return {"message": f"Cluster {cluster_id} marked RESOLVED successfully"}

@api_router.post("/authority/clusters/{cluster_id}/acknowledge")
async def acknowledge_cluster(cluster_id: int, current_user: User = Depends(require_role("authority")), db: Session = Depends(get_db)):
    """Marks a cluster as ACKNOWLEDGED. Rejects citizen tokens with 403 Forbidden."""
    cluster = db.query(ReportCluster).filter(ReportCluster.id == cluster_id).first()
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
        
    cluster.status = "acknowledged"
    
    reports = db.query(Report).filter(Report.cluster_id == cluster_id).all()
    for r in reports:
        r.status = "acknowledged"
        
    db.commit()
    return {"message": f"Cluster {cluster_id} marked acknowledged"}

# Mount API Router under both /api and root prefixes (handles both Vercel stripped and full paths)
app.include_router(api_router, prefix="/api")
app.include_router(api_router, prefix="")

# SPA Catch-All Route (Serves frontend/dist index.html for root and SPA client routes)
if FRONTEND_DIST.exists():
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("static/"):
            raise HTTPException(status_code=404, detail="Not Found")
            
        file_path = FRONTEND_DIST / full_path
        if file_path.exists() and file_path.is_file():
            from fastapi.responses import FileResponse
            return FileResponse(file_path)
            
        from fastapi.responses import FileResponse
        return FileResponse(
            FRONTEND_DIST / "index.html",
            headers={"Cache-Control": "no-cache, no-store, must-revalidate, max-age=0"}
        )
