import os
import uuid
from datetime import datetime
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
from backend.config import Config

class IntakeAgent:
    """
    Intake Agent receives media submissions (photo, video, audio) from the client,
    stores them securely, extracts EXIF/GPS metadata if missing from raw parameters,
    and structures the intake packet for the classification agent.
    """
    
    @staticmethod
    def _get_decimal_from_dms(dms, ref):
        """Helper to convert Degrees-Minutes-Seconds (DMS) coordinates from EXIF to decimal degrees."""
        if not dms:
            return None
        degrees = float(dms[0])
        minutes = float(dms[1])
        seconds = float(dms[2])
        
        decimal = degrees + (minutes / 60.0) + (seconds / 3600.0)
        if ref in ['S', 'W']:
            decimal = -decimal
        return decimal

    @classmethod
    def extract_gps_from_exif(cls, filepath: str):
        """Extracts latitude and longitude from an image's EXIF data if present."""
        try:
            img = Image.open(filepath)
            exif_data = img._getexif()
            if not exif_data:
                return None, None
                
            geotagging = {}
            for tag_id, value in exif_data.items():
                tag = TAGS.get(tag_id, tag_id)
                if tag == 'GPSInfo':
                    for key, val in value.items():
                        sub_tag = GPSTAGS.get(key, key)
                        geotagging[sub_tag] = val
            
            if 'GPSLatitude' in geotagging and 'GPSLatitudeRef' in geotagging:
                lat = cls._get_decimal_from_dms(geotagging['GPSLatitude'], geotagging['GPSLatitudeRef'])
                lng = cls._get_decimal_from_dms(geotagging['GPSLongitude'], geotagging['GPSLongitudeRef'])
                return lat, lng
        except Exception as e:
            print(f"[IntakeAgent] EXIF extraction error: {e}")
        return None, None

    @classmethod
    async def ingest_media(cls, file_bytes: bytes, filename: str, content_type: str, latitude: float = None, longitude: float = None) -> dict:
        """
        Saves the file to local disk and returns an intake metadata packet.
        Falls back to EXIF GPS data if latitude/longitude are not provided.
        """
        # Create a unique filename to prevent collisions
        file_ext = os.path.splitext(filename)[1].lower()
        if not file_ext:
            # Guess extension from content type
            if "image" in content_type:
                file_ext = ".jpg"
            elif "video" in content_type:
                file_ext = ".mp4"
            elif "audio" in content_type:
                file_ext = ".mp3"
            else:
                file_ext = ".bin"
                
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        save_path = os.path.join(Config.UPLOAD_DIR, unique_filename)
        
        with open(save_path, "wb") as f:
            f.write(file_bytes)
            
        # Determine media category (image/video/audio)
        media_type = "image"
        if "video" in content_type or file_ext in [".mp4", ".mov", ".avi", ".mkv"]:
            media_type = "video"
        elif "audio" in content_type or file_ext in [".mp3", ".wav", ".aac", ".ogg", ".m4a", ".webm"]:
            media_type = "audio"
            
        # If coordinates not provided by frontend, try EXIF (only applicable for images)
        extracted_lat, extracted_lng = None, None
        if (latitude is None or longitude is None) and media_type == "image":
            extracted_lat, extracted_lng = cls.extract_gps_from_exif(save_path)
            
        final_lat = latitude if latitude is not None else extracted_lat
        final_lng = longitude if longitude is not None else extracted_lng
        
        # If coordinates are still missing, default to 0.0 (must be verified or manually updated)
        if final_lat is None or final_lng is None:
            final_lat, final_lng = 28.6139, 77.2090  # Default to New Delhi centroid for safety / display
            print("[IntakeAgent] Warning: Coordinates not supplied and EXIF missing. Defaulting to Delhi.")

        return {
            "media_url": f"/static/{unique_filename}",
            "media_path": save_path,
            "media_type": media_type,
            "latitude": float(final_lat),
            "longitude": float(final_lng),
            "created_at": datetime.utcnow()
        }
