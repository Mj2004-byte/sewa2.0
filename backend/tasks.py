import os
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from celery import Celery
from backend.config import Config, WORKFLOW_CONFIGS
from backend.database import SessionLocal, is_sqlite
from backend.models import Report, ReportCluster, Authority, Escalation, User
from backend.agents.classification_agent import ClassificationAgent
from backend.agents.severity_agent import SeverityAgent
from backend.agents.clustering_agent import ClusteringAgent
from backend.agents.routing_agent import RoutingAgent
from backend.agents.notification_agent import NotificationAgent

# Initialize Celery app (or dummy eager executor for serverless environments)
try:
    from celery import Celery
    celery_app = Celery("sewa_tasks", broker=Config.REDIS_URL)
    celery_app.conf.update(
        task_always_eager=Config.CELERY_ALWAYS_EAGER,
        result_backend=Config.REDIS_URL if not Config.CELERY_ALWAYS_EAGER else None
    )
except Exception as e:
    print(f"[Celery Warning] Eager fallback executor active: {e}")
    class DummyCelery:
        def task(self, func):
            func.delay = func
            return func
    celery_app = DummyCelery()

@celery_app.task
def process_report_task(report_id: int):
    """
    Asynchronous task that runs the agentic pipeline for a single submitted report:
    1. Media classification (Groq Multimodal Vision / Audio Whisper)
    2. Severity scoring (Groq Text / Rules)
    3. Spatial geo-clustering (same category, within 50m)
    4. Initial municipal routing & notifications
    """
    print(f"[Celery] Processing report {report_id}...")
    db: Session = SessionLocal()
    try:
        report = db.query(Report).filter(Report.id == report_id).first()
        if not report:
            print(f"[Celery] Report {report_id} not found.")
            return

        # 1. AI Classification
        print(f"[Celery] Ingressing Classification Agent for report {report_id}...")
        classification = db.query(User).filter(User.id == report.submitted_by).first() # Dummy check
        
        # Call Classification agent
        cls_result = db.query(Report).filter(Report.id == report_id).first() # context holder
        # Call async function by running in loop or standard async run
        import asyncio
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If running in webapp event loop
            ai_data = loop.run_until_complete(ClassificationAgent.classify_report(
                media_path=report.media_url.replace("/static/", str(Config.UPLOAD_DIR) + "/"),
                media_type=report.media_type,
                user_caption=report.description or ""
            ))
        else:
            ai_data = asyncio.run(ClassificationAgent.classify_report(
                media_path=report.media_url.replace("/static/", str(Config.UPLOAD_DIR) + "/"),
                media_type=report.media_type,
                user_caption=report.description or ""
            ))

        report.category = ai_data["category"]
        report.description = ai_data["description"]
        report.confidence = ai_data["confidence"]

        # 2. Urgency Scoring
        if loop.is_running():
            severity_data = loop.run_until_complete(SeverityAgent.score_severity(
                category=report.category,
                description=report.description
            ))
        else:
            severity_data = asyncio.run(SeverityAgent.score_severity(
                category=report.category,
                description=report.description
            ))
            
        report.severity = severity_data["severity"]
        db.commit()

        # 3. Spatial Geo-Clustering
        print(f"[Celery] Clustering report {report_id}...")
        cluster = ClusteringAgent.get_or_create_cluster(db, report)
        
        # 4. Routing & First Notifications
        print(f"[Celery] Routing report {report_id} to authorities...")
        authorities = RoutingAgent.find_jurisdictional_authorities(db, cluster)
        
        # Trigger initial notification based on category and SLA
        # For Emergency: Multi-party immediate calling and emails
        if report.category == "emergency":
            emergency_message = f"Attention: Critical Emergency reported at latitude {report.latitude:.4f}, longitude {report.longitude:.4f}. Description: {report.description}. Dispatch immediate assistance."
            
            # Auto-call fire, police, hospital, power dept if configured
            for auth in authorities:
                if auth.contact_phone:
                    NotificationAgent.make_voice_call(db, auth.contact_phone, emergency_message, report_id=report.id, cluster_id=cluster.id)
                if auth.contact_email:
                    email_subject = f"🔴 URGENT DISPATCH: Building Emergency at {report.latitude:.4f}, {report.longitude:.4f}"
                    email_html = f"""
                    <div style="font-family: Arial, sans-serif; border: 2px solid red; padding: 20px; border-radius: 8px;">
                        <h2 style="color: red; margin-top: 0;">🔴 IMMEDIATE EMERGENCY DISPATCH</h2>
                        <p><strong>Category:</strong> Fire / Building Emergency</p>
                        <p><strong>Coordinates:</strong> {report.latitude:.6f}, {report.longitude:.6f}</p>
                        <p><strong>AI Severity:</strong> {report.severity}/10 (CRITICAL)</p>
                        <p><strong>Situation:</strong> {report.description}</p>
                        <p style="background-color: #ffe6e6; padding: 10px; border-left: 5px solid red;">
                            <strong>Directive:</strong> Auto-call triggered. Dispatch personnel immediately to coordinates.
                        </p>
                        <hr/>
                        <p style="font-size: 12px; color: #666;">Generated by Sewa Autonomous Emergency Router.</p>
                    </div>
                    """
                    NotificationAgent.send_email(db, auth.contact_email, email_subject, email_html, report_id=report.id, cluster_id=cluster.id)
                    
        # For Injured Animals: Vet + NGO immediate notify with case claim links
        elif report.category == "animal":
            claim_link = f"http://localhost:5173/claim-case/{report.id}" # Standard local address
            animal_message = f"Injured animal reported at {report.latitude:.4f}, {report.longitude:.4f}. Please claim case at: {claim_link}."
            
            # Send SMS to vet / NGO for instant dispatch
            for auth in authorities:
                if auth.contact_phone:
                    NotificationAgent.send_sms(db, auth.contact_phone, animal_message, report_id=report.id, cluster_id=cluster.id)
                if auth.contact_email:
                    email_subject = f"🐾 Injured Animal Reported: {report.latitude:.4f}, {report.longitude:.4f}"
                    email_html = f"""
                    <div style="font-family: Arial, sans-serif; border: 1px solid #ffcc00; padding: 20px; border-radius: 8px;">
                        <h2 style="color: #e69900; margin-top: 0;">🐾 STRICKEN ANIMAL RESCUE REQUEST</h2>
                        <p><strong>Incident Location:</strong> {report.latitude:.6f}, {report.longitude:.6f}</p>
                        <p><strong>AI Report:</strong> {report.description}</p>
                        <div style="margin: 20px 0;">
                            <a href="{claim_link}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                                Click Here to Claim Rescue Case
                            </a>
                        </div>
                        <p style="font-size: 12px; color: #666;">This case has been routed to geo-located animal response services.</p>
                    </div>
                    """
                    NotificationAgent.send_email(db, auth.contact_email, email_subject, email_html, report_id=report.id, cluster_id=cluster.id)
                    
        # For Pothole and Garbage: Standard alert to municipal authority (Dashboard + Email)
        else:
            for auth in authorities:
                if auth.contact_email:
                    dept_title = "Pothole & Road Damage" if report.category == "pothole" else "Sanitation & Waste"
                    email_subject = f"⚠️ New Civic Issue: {dept_title} at {report.latitude:.4f}, {report.longitude:.4f}"
                    email_html = f"""
                    <div style="font-family: Arial, sans-serif; border: 1px solid #ccc; padding: 20px; border-radius: 8px;">
                        <h2 style="color: #333; margin-top: 0;">⚠️ New Civic Issue Logged</h2>
                        <p><strong>Department:</strong> {auth.department.capitalize()}</p>
                        <p><strong>Coordinates:</strong> {report.latitude:.6f}, {report.longitude:.6f}</p>
                        <p><strong>Report Count in Cluster:</strong> {cluster.report_count}</p>
                        <p><strong>Description:</strong> {report.description}</p>
                        <p>This report has been logged on the Sewa Authority Dashboard. Please resolve before SLA breaches.</p>
                        <hr/>
                        <p style="font-size: 12px; color: #666;">Autonomous alert by Sewa Platform.</p>
                    </div>
                    """
                    NotificationAgent.send_email(db, auth.contact_email, email_subject, email_html, report_id=report.id, cluster_id=cluster.id)

        # Update report status to acknowledged
        report.status = "acknowledged"
        db.commit()
        print(f"[Celery] Report {report_id} ingesting complete.")

    except Exception as e:
        db.rollback()
        print(f"[Celery] Error processing report {report_id}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

@celery_app.task
def escalation_watcher_task():
    """
    SLA Escalation Watcher. Runs periodically (via Celery Beat schedule) to:
    1. Scan active open/acknowledged clusters
    2. Check SLA response window (hours)
    3. Check DISTINCT user report count threshold (distinct submitted_by citizens)
    4. Auto-escalate to state/national departments if thresholds breached
    """
    print("[Celery Beat] SLA Escalation Watcher triggered.")
    db: Session = SessionLocal()
    try:
        active_clusters = db.query(ReportCluster).filter(
            ReportCluster.status.in_(["open", "acknowledged"])
        ).all()
        
        now = datetime.utcnow()
        
        for cluster in active_clusters:
            category = cluster.category
            sla_config = SLA_RULES.get(category, SLA_RULES["other"])
            
            # Check response window
            sla_hours = sla_config["response_window_hours"]
            time_limit = cluster.first_reported_at + timedelta(hours=sla_hours)
            sla_breached = now > time_limit
            
            # Count DISTINCT citizens who submitted non-flagged reports to this cluster
            distinct_citizens_count = ClusteringAgent.count_distinct_citizens(db, cluster.id)
            user_threshold = sla_config["distinct_user_threshold"]
            threshold_met = distinct_citizens_count >= user_threshold
            
            # Escalation conditions: SLA time breached AND distinct user threshold met
            if sla_breached and threshold_met:
                print(f"[Celery Beat] Escalating cluster {cluster.id} (Category: {category}, Distinct Users: {distinct_citizens_count}/{user_threshold})")
                
                escalation_auth = RoutingAgent.get_escalation_authority(db, cluster)
                reports = db.query(Report).filter(
                    and_(Report.cluster_id == cluster.id, Report.category != "flagged")
                ).all()
                
                evidence_list = []
                for rep in reports:
                    evidence_list.append({
                        "report_id": rep.id,
                        "description": rep.description,
                        "latitude": rep.latitude,
                        "longitude": rep.longitude,
                        "media_url": rep.media_url,
                        "created_at": rep.created_at.isoformat()
                    })
                
                import json
                evidence_packet = {
                    "cluster_id": cluster.id,
                    "category": category,
                    "centroid": {"latitude": cluster.latitude, "longitude": cluster.longitude},
                    "first_reported_at": cluster.first_reported_at.isoformat(),
                    "escalated_at": now.isoformat(),
                    "distinct_citizen_count": distinct_citizens_count,
                    "reports": evidence_list
                }
                
                evidence_filename = f"evidence_cluster_{cluster.id}.json"
                evidence_path = Config.UPLOAD_DIR / evidence_filename
                with open(evidence_path, "w", encoding="utf-8") as f:
                    json.dump(evidence_packet, f, indent=4)
                    
                evidence_packet_url = f"/static/{evidence_filename}"
                reason = f"SLA breached. Unresolved for {sla_hours}h with {distinct_citizens_count} distinct citizen filings (threshold: {user_threshold})."
                
                escalation = Escalation(
                    cluster_id=cluster.id,
                    escalated_to=escalation_auth["name"],
                    escalated_at=now,
                    reason=reason,
                    evidence_packet_url=evidence_packet_url
                )
                db.add(escalation)
                
                cluster.status = "escalated"
                cluster.escalation_level = 1
                cluster.last_escalated_at = now
                
                for rep in reports:
                    rep.status = "escalated"
                
                db.commit()
                
                # Send escalation email and SMS
                subject = f"🚨 AUTONOMOUS ESCALATION: Unresolved {category.capitalize()} Issue at ({cluster.latitude:.4f}, {cluster.longitude:.4f})"
                email_body = f"""
                <div style="font-family: Arial, sans-serif; border: 1px solid #ccc; padding: 20px;">
                    <h2 style="color: red;">🚨 SEWA AUTONOMOUS ESCALATION REPORT</h2>
                    <p><strong>To:</strong> {escalation_auth['name']}</p>
                    <p><strong>Reason:</strong> {reason}</p>
                    <p><strong>Distinct Citizen Filings:</strong> {distinct_citizens_count}</p>
                    <p><strong>Coordinates:</strong> {cluster.latitude:.5f}, {cluster.longitude:.5f}</p>
                </div>
                """
                NotificationAgent.send_email(db, escalation_auth["contact_email"], subject, email_body, cluster_id=cluster.id)
                NotificationAgent.send_sms(db, escalation_auth["contact_phone"], f"Sewa Alert: Escalated cluster {cluster.id} to {escalation_auth['name']}.", cluster_id=cluster.id)
                
                # Compile rich HTML template representing the legal evidence packet
                html_packet_reports = ""
                for rep in reports:
                    html_packet_reports += f"""
                    <tr style="border-bottom: 1px solid #ddd;">
                        <td style="padding: 8px;">#{rep.id}</td>
                        <td style="padding: 8px;">{rep.created_at.strftime('%Y-%m-%d %H:%M')}</td>
                        <td style="padding: 8px;">{rep.latitude:.5f}, {rep.longitude:.5f}</td>
                        <td style="padding: 8px;">{rep.description}</td>
                        <td style="padding: 8px;"><a href="http://localhost:8000{rep.media_url}">View Media</a></td>
                    </tr>
                    """
                    
                email_body = f"""
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <div style="background-color: #c82333; color: white; padding: 20px; text-align: center;">
                        <h2 style="margin: 0; font-size: 24px; font-weight: 600;">🚨 SEWA CIVIL ESCALATION REPORT</h2>
                        <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">System-Generated Governance Escalation Packet</p>
                    </div>
                    <div style="padding: 25px; color: #333;">
                        <p><strong>To:</strong> {escalation_auth['name']}</p>
                        <p><strong>Escalation Reason:</strong> {reason}</p>
                        
                        <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #c82333; border-radius: 4px; margin-bottom: 20px;">
                            <p style="margin: 0 0 5px 0;"><strong>Cluster Centroid:</strong> {cluster.latitude:.6f}, {cluster.longitude:.6f}</p>
                            <p style="margin: 0;"><strong>Active Incident Category:</strong> {category.upper()}</p>
                        </div>
                        
                        <h3>Compiled Evidence Files ({cluster.report_count} verified citizen filings)</h3>
                        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                            <thead>
                                <tr style="background-color: #eee; border-bottom: 2px solid #ddd;">
                                    <th style="padding: 8px; text-align: left;">ID</th>
                                    <th style="padding: 8px; text-align: left;">Date</th>
                                    <th style="padding: 8px; text-align: left;">Coordinates</th>
                                    <th style="padding: 8px; text-align: left;">Citizen Note</th>
                                    <th style="padding: 8px; text-align: left;">Media</th>
                                </tr>
                            </thead>
                            <tbody>
                                {html_packet_reports}
                            </tbody>
                        </table>
                        
                        <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid #eee; font-size: 13px;">
                            <p>📁 <strong>Full Audit Evidence Download:</strong> <a href="http://localhost:8000{evidence_packet_url}">evidence_cluster_{cluster.id}.json</a></p>
                        </div>
                    </div>
                    <div style="background-color: #f1f3f5; color: #6c757d; padding: 10px; font-size: 11px; text-align: center;">
                        Sewa platform is governed under autonomous municipal SLAs. This message requires no reply.
                    </div>
                </div>
                """
                
                # Send email
                NotificationAgent.send_email(db, escalation_auth["contact_email"], subject, email_body, cluster_id=cluster.id)
                
                # Send escalation SMS
                sms_text = f"Sewa ALERT: Escalating unresolved {category} cluster {cluster.id} ({cluster.report_count} reports) at {cluster.latitude:.4f}, {cluster.longitude:.4f} to {escalation_auth['name']}."
                NotificationAgent.send_sms(db, escalation_auth["contact_phone"], sms_text, cluster_id=cluster.id)

    except Exception as e:
        db.rollback()
        print(f"[Celery Beat] Error in escalation watcher: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()
