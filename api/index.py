import sys
import os

# Add root directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import Base, engine, SessionLocal
from backend.seed import seed_data
from backend.main import app

# Ensure database tables exist on Vercel
try:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_data(db)
    db.close()
except Exception as e:
    print(f"[Vercel Init Warning] {e}")
