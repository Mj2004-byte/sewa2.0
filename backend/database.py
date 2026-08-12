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
    
    # Register the haversine_distance function on the sqlite connection
    @event.listens_for(engine, "connect")
    def sqlite_connect(dbapi_connection, connection_record):
        dbapi_connection.create_function("haversine_distance", 4, haversine_distance)
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
