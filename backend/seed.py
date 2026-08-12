from datetime import datetime
from backend.database import Base, engine, SessionLocal
from backend.models import User, Authority, Report, ReportCluster

def seed_db():
    print("[Seed] Creating database tables...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    # 1. Seed Users (Citizen and Authority Officer)
    # Simple clear passwords for testing, standard hashing is mocked or simplified in FastAPI auth anyway
    users_data = [
        {
            "phone": "9999999999",
            "name": "Manish",
            "role": "citizen"
        },
        {
            "phone": "8888888888",
            "name": "Officer Sharma",
            "role": "authority"
        }
    ]
    
    for u in users_data:
        existing = db.query(User).filter(User.phone == u["phone"]).first()
        if not existing:
            new_user = User(
                phone=u["phone"],
                name=u["name"],
                role=u["role"],
                hashed_password=u["phone"]  # Passwords are phone numbers for dev simplicity
            )
            db.add(new_user)
            print(f"[Seed] Added user: {u['name']} ({u['role']})")
            
    # 2. Seed Authorities (municipal departments, vets, emergency dispatchers)
    authorities_data = [
        # Roads / Potholes Department
        {
            "name": "Delhi Municipal Road Infrastructure Dept",
            "department": "road",
            "jurisdiction_name": "Delhi NCR - Central Zone",
            "latitude": 28.6139,
            "longitude": 77.2090,
            "jurisdiction_radius_meters": 20000.0,
            "contact_email": "roads-municipal@sewa.gov.in",
            "contact_phone": "+916287169669"  # Redirected to user test phone for SMS/Calls
        },
        # Sanitation Department
        {
            "name": "Delhi Municipal Sanitation Division",
            "department": "sanitation",
            "jurisdiction_name": "Delhi NCR - All Zones",
            "latitude": 28.6139,
            "longitude": 77.2090,
            "jurisdiction_radius_meters": 20000.0,
            "contact_email": "sanitation-municipal@sewa.gov.in",
            "contact_phone": "+916287169669"
        },
        # Veterinary & NGOs
        {
            "name": "Sanjay Gandhi Animal Care Centre",
            "department": "veterinary",
            "jurisdiction_name": "Raja Garden & West Zone",
            "latitude": 28.6400,
            "longitude": 77.1200,
            "jurisdiction_radius_meters": 15000.0,
            "contact_email": "sanjaygandhi-vet@sewa.gov.in",
            "contact_phone": "+916287169669"
        },
        {
            "name": "Friendicoes Animal NGO Hospital",
            "department": "veterinary",
            "jurisdiction_name": "Def Col & South Zone",
            "latitude": 28.5700,
            "longitude": 77.2200,
            "jurisdiction_radius_meters": 15000.0,
            "contact_email": "friendicoes-ngo@sewa.gov.in",
            "contact_phone": "+916287169669"
        },
        # Emergency Multi-party services
        {
            "name": "Central Police Command Room",
            "department": "emergency",
            "jurisdiction_name": "Delhi NCR",
            "latitude": 28.6150,
            "longitude": 77.2000,
            "jurisdiction_radius_meters": 30000.0,
            "contact_email": "police-command@sewa.gov.in",
            "contact_phone": "+916287169669"
        },
        {
            "name": "Connaught Place Fire Station",
            "department": "emergency",
            "jurisdiction_name": "Delhi Central Zone",
            "latitude": 28.6280,
            "longitude": 77.2200,
            "jurisdiction_radius_meters": 15000.0,
            "contact_email": "connaughtplace-fire@sewa.gov.in",
            "contact_phone": "+916287169669"
        },
        {
            "name": "Ram Manohar Lohia Hospital Emergency",
            "department": "emergency",
            "jurisdiction_name": "Central Hospital Zone",
            "latitude": 28.6250,
            "longitude": 77.2010,
            "jurisdiction_radius_meters": 15000.0,
            "contact_email": "rml-hospital@sewa.gov.in",
            "contact_phone": "+916287169669"
        },
        {
            "name": "Electricity Supply Power Grid Control",
            "department": "emergency",
            "jurisdiction_name": "High Tension Grid - Grid Zone 1",
            "latitude": 28.6139,
            "longitude": 77.2090,
            "jurisdiction_radius_meters": 50000.0,
            "contact_email": "power-control@sewa.gov.in",
            "contact_phone": "+916287169669"
        }
    ]
    
    for auth in authorities_data:
        existing = db.query(Authority).filter(Authority.name == auth["name"]).first()
        if not existing:
            new_auth = Authority(
                name=auth["name"],
                department=auth["department"],
                jurisdiction_name=auth["jurisdiction_name"],
                latitude=auth["latitude"],
                longitude=auth["longitude"],
                jurisdiction_radius_meters=auth["jurisdiction_radius_meters"],
                contact_email=auth["contact_email"],
                contact_phone=auth["contact_phone"]
            )
            db.add(new_auth)
            print(f"[Seed] Added authority: {auth['name']}")
            
    db.commit()
    
    # 3. Seed some dummy reports and clusters for instant visualization on map dashboard
    citizen = db.query(User).filter(User.phone == "9999999999").first()
    if citizen:
        # Check if reports exist, if not seed a few
        if db.query(Report).count() == 0:
            print("[Seed] Seeding dummy reports and clusters...")
            
            # Pothole cluster (Active, 3 reports)
            c1 = ReportCluster(
                latitude=28.6100,
                longitude=77.2100,
                category="pothole",
                report_count=3,
                first_reported_at=datetime.utcnow(),
                last_reported_at=datetime.utcnow(),
                status="open",
                escalation_level=0
            )
            db.add(c1)
            db.commit()
            db.refresh(c1)
            
            for i in range(3):
                r = Report(
                    category="pothole",
                    media_url="/static/dummy_pothole.jpg",
                    media_type="image",
                    description=f"Large dangerous road pothole reported near Metro Station pillar {12 + i}.",
                    latitude=28.6100 + (i * 0.0001),
                    longitude=77.2100 - (i * 0.0001),
                    status="acknowledged",
                    severity=4.5,
                    confidence=0.92,
                    submitted_by=citizen.id,
                    cluster_id=c1.id
                )
                db.add(r)
                
            # Garbage cluster (Active, 2 reports)
            c2 = ReportCluster(
                latitude=28.6250,
                longitude=77.2250,
                category="garbage",
                report_count=2,
                first_reported_at=datetime.utcnow(),
                last_reported_at=datetime.utcnow(),
                status="open",
                escalation_level=0
            )
            db.add(c2)
            db.commit()
            db.refresh(c2)
            
            for i in range(2):
                r = Report(
                    category="garbage",
                    media_url="/static/dummy_garbage.jpg",
                    media_type="image",
                    description="Overflowing dump bin spilling onto pedestrian footpath causing toxic odor.",
                    latitude=28.6250 - (i * 0.0001),
                    longitude=77.2250 + (i * 0.0001),
                    status="acknowledged",
                    severity=5.0,
                    confidence=0.88,
                    submitted_by=citizen.id,
                    cluster_id=c2.id
                )
                db.add(r)
                
            # Emergency (Active, 1 report)
            c3 = ReportCluster(
                latitude=28.6300,
                longitude=77.2000,
                category="emergency",
                report_count=1,
                first_reported_at=datetime.utcnow(),
                last_reported_at=datetime.utcnow(),
                status="open",
                escalation_level=0
            )
            db.add(c3)
            db.commit()
            db.refresh(c3)
            
            r3 = Report(
                category="emergency",
                media_url="/static/dummy_fire.mp4",
                media_type="video",
                description="Active commercial building fire reported with smoke emerging from the top floor.",
                latitude=28.6300,
                longitude=77.2000,
                status="acknowledged",
                severity=9.8,
                confidence=0.95,
                submitted_by=citizen.id,
                cluster_id=c3.id
            )
            db.add(r3)
            
            db.commit()
            print("[Seed] Dummy reports successfully seeded.")
            
    db.close()
    print("[Seed] Database seeding completed successfully.")

if __name__ == "__main__":
    seed_db()
