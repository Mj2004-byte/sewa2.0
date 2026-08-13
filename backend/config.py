import os
from pathlib import Path

# Base Directory
BASE_DIR = Path(__file__).resolve().parent

# Manual .env loader fallback
def load_dotenv():
    env_path = BASE_DIR / ".env"
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    os.environ[key] = val

load_dotenv()

# App Configurations
class Config:
    BASE_DIR = BASE_DIR
    ENV = os.getenv("ENV", "development").lower()
    
    # Groq Model Configurations (Named settings for maintainability)
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
    VISION_MODEL = os.getenv("VISION_MODEL", "qwen/qwen3.6-27b")
    REASONING_MODEL = os.getenv("REASONING_MODEL", "openai/gpt-oss-120b")
    
    # Twilio Configuration & Account Tier Flag
    TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER", "")
    TWILIO_TRIAL_MODE = os.getenv("TWILIO_TRIAL_MODE", "True").lower() == "true"
    
    # Database
    is_vercel = bool(os.getenv("VERCEL"))
    if is_vercel and not os.getenv("DATABASE_URL"):
        DATABASE_URL = "sqlite:////tmp/sewa.db"
    else:
        DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sewa.db")
        
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    CELERY_ALWAYS_EAGER = os.getenv("CELERY_ALWAYS_EAGER", "True").lower() == "true"
    
    # Security
    JWT_SECRET = os.getenv("JWT_SECRET", "sewa_dev_secret_change_in_production_321!")
    JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
    
    # SMTP
    SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "sewa-alerts@sewa.gov.in")
    
    # Storage Directory
    if is_vercel and not os.getenv("UPLOAD_DIR"):
        UPLOAD_DIR = Path("/tmp/uploads")
    else:
        UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(BASE_DIR / "uploads")))

# Ensure uploads directory exists
try:
    Config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
except Exception:
    pass

# EXPLICIT SLA CONFIGURATION MATRIX
SLA_RULES = {
    "pothole": {
        "name": "Potholes & Road Damage",
        "distinct_user_threshold": 5,     # 5 distinct citizens in same geofence
        "geofence_radius_meters": 50.0,
        "response_window_hours": 72,      # 72 hours SLA window
        "escalation_target": "Ministry of Road Transport & Highways",
        "immediate_dispatch": False
    },
    "garbage": {
        "name": "Garbage & Sanitation",
        "distinct_user_threshold": 5,     # 5 distinct citizens in same geofence
        "geofence_radius_meters": 50.0,
        "response_window_hours": 168,     # 7 days (168 hours)
        "escalation_target": "State/Central Sanitation & Urban Development Authority",
        "immediate_dispatch": False
    },
    "animal": {
        "name": "Injured / Stray Animals",
        "distinct_user_threshold": 1,     # 1 report (Immediate)
        "geofence_radius_meters": 50.0,
        "response_window_hours": 4,       # 4 hours response window
        "escalation_target": "State Animal Welfare Board",
        "immediate_dispatch": True
    },
    "emergency": {
        "name": "Fire & Building Emergency",
        "distinct_user_threshold": 1,     # 1 report (Immediate seconds dispatch)
        "geofence_radius_meters": 50.0,
        "response_window_hours": 1,       # 1 hour critical window
        "escalation_target": "District Emergency Operations Center",
        "immediate_dispatch": True
    },
    "other": {
        "name": "General Civic Complaints",
        "distinct_user_threshold": 10,
        "geofence_radius_meters": 100.0,
        "response_window_hours": 240,     # 10 days
        "escalation_target": "Chief Minister Grievance Portal",
        "immediate_dispatch": False
    }
}

# Legacy workflow compatibility alias
WORKFLOW_CONFIGS = SLA_RULES
