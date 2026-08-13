import sys
import os

# Add root directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import Base, engine
from backend.seed import seed_db
from backend.main import app

# Ensure database tables and initial seed data exist on Vercel
try:
    Base.metadata.create_all(bind=engine)
    seed_db()
except Exception as e:
    print(f"[Vercel Init Warning] {e}")
