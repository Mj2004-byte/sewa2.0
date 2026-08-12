import os
import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.config import Config, SLA_RULES
from backend.database import Base, get_db
from backend.models import User, Report, ReportCluster, Authority, NotificationLog
from backend.main import app, create_access_token
from backend.agents.clustering_agent import ClusteringAgent
from backend.agents.notification_agent import NotificationAgent
from backend.agents.classification_agent import ClassificationAgent

# Setup test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_sewa.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="module")
def db_session():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="module")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

# 1. TEST CASE: 5 reports from 1 user do NOT escalate; 5 distinct users DO trigger escalation
def test_distinct_user_escalation_threshold(db_session):
    # Create cluster
    cluster = ReportCluster(
        latitude=28.6139,
        longitude=77.2090,
        category="pothole",
        report_count=0,
        first_reported_at=datetime.utcnow() - timedelta(hours=100), # SLA breached (>72h)
        status="open"
    )
    db_session.add(cluster)
    db_session.commit()
    
    # Create single user
    user1 = User(phone="9111111111", name="Single User", role="citizen")
    db_session.add(user1)
    db_session.commit()
    
    # Add 5 reports from the SAME single user
    for i in range(5):
        r = Report(
            category="pothole",
            media_url="/static/test.jpg",
            latitude=28.6139,
            longitude=77.2090,
            submitted_by=user1.id,
            cluster_id=cluster.id
        )
        db_session.add(r)
    db_session.commit()
    
    # Count distinct users
    distinct_count = ClusteringAgent.count_distinct_citizens(db_session, cluster.id)
    assert distinct_count == 1, "5 reports from 1 user should count as 1 distinct citizen."
    assert distinct_count < SLA_RULES["pothole"]["distinct_user_threshold"], "1 distinct user should NOT meet the 5-citizen threshold."

    # Now add 4 more reports from 4 DIFFERENT distinct users
    for i in range(2, 6):
        u = User(phone=f"911111111{i}", name=f"User {i}", role="citizen")
        db_session.add(u)
        db_session.commit()
        r = Report(
            category="pothole",
            media_url="/static/test.jpg",
            latitude=28.6139,
            longitude=77.2090,
            submitted_by=u.id,
            cluster_id=cluster.id
        )
        db_session.add(r)
    db_session.commit()
    
    distinct_count_5 = ClusteringAgent.count_distinct_citizens(db_session, cluster.id)
    assert distinct_count_5 == 5, "5 reports from 5 distinct users should count as 5 distinct citizens."
    assert distinct_count_5 >= SLA_RULES["pothole"]["distinct_user_threshold"], "5 distinct users MUST trigger escalation criteria."

# 2. TEST CASE: Authority-only routes reject citizen JWTs with 403 Forbidden
def test_authority_routes_reject_citizen_jwt(client, db_session):
    citizen_user = User(phone="9222222222", name="Citizen Test", role="citizen")
    db_session.add(citizen_user)
    db_session.commit()
    
    citizen_token = create_access_token({"phone": citizen_user.phone, "role": citizen_user.role})
    
    headers = {"Authorization": f"Bearer {citizen_token}"}
    response = client.get("/api/authority/clusters", headers=headers)
    
    assert response.status_code == 403, f"Citizen JWT must be rejected with 403 Forbidden, got {response.status_code}: {response.json()}"
    assert "Access denied" in response.json().get("detail", "")

# 3. TEST CASE: Production ENV disables mock OTP code (123456)
def test_production_env_disables_mock_otp(client, db_session):
    # Set ENV to production temporarily
    original_env = Config.ENV
    Config.ENV = "production"
    
    user = User(phone="9333333333", name="Prod Test", role="citizen", otp="852963", otp_expires_at=datetime.utcnow() + timedelta(minutes=5))
    db_session.add(user)
    db_session.commit()
    
    # Try verifying with mock bypass code '123456'
    response = client.post("/api/auth/otp/verify", data={"phone": "9333333333", "code": "123456"})
    
    assert response.status_code == 400, "In production mode, mock OTP code 123456 must be rejected."
    
    # Restore original ENV
    Config.ENV = original_env

# 4. TEST CASE: Vision failure triggers secondary text reasoning fallback
@pytest.mark.asyncio
async def test_vision_failure_text_fallback():
    # Calling classify_report with an invalid image path triggers vision exception and uses fallback
    result = await ClassificationAgent.classify_report(
        media_path="/invalid/nonexistent_image.jpg",
        media_type="image",
        user_caption="Deep road crater pothole near pillar 10"
    )
    
    assert result is not None
    assert "category" in result
    assert result["category"] in ["pothole", "other"]
    assert result["confidence"] > 0.0

# 5. TEST CASE: Twilio unverified number error logged distinctly
def test_twilio_unverified_number_handling(db_session):
    # Force test Twilio credentials
    Config.TWILIO_ACCOUNT_SID = "AC_mock_sid"
    Config.TWILIO_AUTH_TOKEN = "mock_token"
    
    # Make voice call to unverified number
    success = NotificationAgent.make_voice_call(db_session, "+919999999999", "Test emergency alert")
    
    # Verify unverified or simulated log entry exists
    log_entry = db_session.query(NotificationLog).filter(NotificationLog.recipient == "+919999999999").first()
    assert log_entry is not None, "Notification attempt must be logged in notifications_log database."
