from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from backend.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    role = Column(String, default="citizen")  # "citizen" or "authority"
    hashed_password = Column(String, nullable=True)  # Optional if we only use OTP
    otp = Column(String, nullable=True)
    otp_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    reports = relationship("Report", back_populates="reporter")

class ReportCluster(Base):
    __tablename__ = "report_clusters"
    
    id = Column(Integer, primary_key=True, index=True)
    latitude = Column(Float, nullable=False)  # centroid latitude
    longitude = Column(Float, nullable=False)  # centroid longitude
    category = Column(String, index=True, nullable=False)
    report_count = Column(Integer, default=1)
    first_reported_at = Column(DateTime, default=datetime.utcnow)
    last_reported_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="open")  # "open", "escalated", "resolved"
    escalation_level = Column(Integer, default=0)  # 0: Municipal, 1: State/Central
    last_escalated_at = Column(DateTime, nullable=True)
    
    reports = relationship("Report", back_populates="cluster")
    escalations = relationship("Escalation", back_populates="cluster")
    notifications = relationship("NotificationLog", back_populates="cluster")

class Report(Base):
    __tablename__ = "reports"
    
    id = Column(Integer, primary_key=True, index=True)
    category = Column(String, index=True, nullable=False)  # pothole, garbage, animal, emergency, other
    media_url = Column(String, nullable=False)  # local file path or S3 URL
    media_type = Column(String, default="image")  # image, video, audio
    description = Column(Text, nullable=True)  # AI-extracted transcription or description
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    status = Column(String, default="submitted")  # submitted, acknowledged, escalated, resolved
    severity = Column(Float, default=1.0)  # 1.0 (low) to 10.0 (critical)
    confidence = Column(Float, default=1.0)  # AI confidence score (0.0 to 1.0)
    submitted_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    cluster_id = Column(Integer, ForeignKey("report_clusters.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    reporter = relationship("User", back_populates="reports")
    cluster = relationship("ReportCluster", back_populates="reports")
    notifications = relationship("NotificationLog", back_populates="report")

class Authority(Base):
    __tablename__ = "authorities"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    department = Column(String, nullable=False)  # pothole, garbage, animal, emergency, other
    jurisdiction_name = Column(String, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    jurisdiction_radius_meters = Column(Float, default=10000.0)  # Default 10km geofence
    contact_email = Column(String, nullable=False)
    contact_phone = Column(String, nullable=False)

class Escalation(Base):
    __tablename__ = "escalations"
    
    id = Column(Integer, primary_key=True, index=True)
    cluster_id = Column(Integer, ForeignKey("report_clusters.id"), nullable=False)
    escalated_to = Column(String, nullable=False)  # Authority name
    escalated_at = Column(DateTime, default=datetime.utcnow)
    reason = Column(Text, nullable=True)
    evidence_packet_url = Column(String, nullable=True)  # JSON or document summary file path
    
    cluster = relationship("ReportCluster", back_populates="escalations")

class NotificationLog(Base):
    __tablename__ = "notifications_log"
    
    id = Column(Integer, primary_key=True, index=True)
    channel = Column(String, nullable=False)  # email, voice, sms
    recipient = Column(String, nullable=False)
    status = Column(String, default="sent")  # sent, failed, pending
    sent_at = Column(DateTime, default=datetime.utcnow)
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=True)
    cluster_id = Column(Integer, ForeignKey("report_clusters.id"), nullable=True)
    
    report = relationship("Report", back_populates="notifications")
    cluster = relationship("ReportCluster", back_populates="notifications")
