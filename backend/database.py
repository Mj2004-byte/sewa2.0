import math
from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from backend.config import Config

DATABASE_URL = Config.DATABASE_URL
is_sqlite = DATABASE_URL.startswith("sqlite")

# Haversine distance formula in Python (calculates distance in meters between two lat/lng points)
def haversine_distance(lat1, lon1, lat2, lon2):
    if None in (lat1, lon1, lat2, lon2):
        return 9999999.0
    R = 6371000.0  # Earth radius in meters
    try:
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)
        
        a = (math.sin(delta_phi / 2.0) ** 2 +
             math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return R * c
    except Exception:
        return 9999999.0

# Database engine configuration
if is_sqlite:
    # sqlite requires some extra configurations for path and threading
    connect_args = {"check_same_thread": False}
    engine = create_engine(DATABASE_URL, connect_args=connect_args)
    
    # Register the haversine_distance function on the sqlite connection safely
    @event.listens_for(engine, "connect")
    def sqlite_connect(dbapi_connection, connection_record):
        try:
            dbapi_connection.create_function("haversine_distance", 4, haversine_distance)
        except Exception as e:
            print(f"[SQLite Connect Warning] {e}")
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    # Ensure tables exist and initial clusters/accounts are seeded in serverless ephemeral storage
    try:
        Base.metadata.create_all(bind=engine)
        from backend.seed import seed_db
        seed_db()
    except Exception as e:
        print(f"[DB Auto-Create Warning] {e}")
        
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
