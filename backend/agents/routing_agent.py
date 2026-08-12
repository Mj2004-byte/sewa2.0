from sqlalchemy.orm import Session
from backend.models import ReportCluster, Authority
from backend.database import haversine_distance
from backend.config import WORKFLOW_CONFIGS

class RoutingAgent:
    """
    Routing Agent resolves the appropriate municipal department, NGO, or emergency service 
    to contact based on report category and spatial overlap with authority jurisdictions.
    """

    @classmethod
    def find_jurisdictional_authorities(cls, db: Session, cluster: ReportCluster) -> list[Authority]:
        """
        Finds all authorities of the relevant department whose geofenced jurisdiction
        covers the cluster's centroid location.
        """
        category = cluster.category
        workflow = WORKFLOW_CONFIGS.get(category, WORKFLOW_CONFIGS["other"])
        
        # Determine target department string
        dept_map = {
            "pothole": "road",
            "garbage": "sanitation",
            "animal": "veterinary",
            "emergency": "emergency",
            "other": "general"
        }
        target_dept = dept_map.get(category, "general")
        
        # Query authorities in that department
        authorities = db.query(Authority).filter(Authority.department == target_dept).all()
        
        matched_authorities = []
        for auth in authorities:
            dist = haversine_distance(cluster.latitude, cluster.longitude, auth.latitude, auth.longitude)
            if dist <= auth.jurisdiction_radius_meters:
                matched_authorities.append(auth)
                
        # If no geofenced match, find the nearest one in the same department
        if not matched_authorities and authorities:
            nearest_auth = min(authorities, key=lambda a: haversine_distance(cluster.latitude, cluster.longitude, a.latitude, a.longitude))
            matched_authorities.append(nearest_auth)
            print(f"[RoutingAgent] No overlapping geofence. Routed to nearest authority: {nearest_auth.name}")
            
        return matched_authorities

    @classmethod
    def get_escalation_authority(cls, db: Session, cluster: ReportCluster) -> dict:
        """
        Determines the state or central authority to escalate to when a cluster breaches its SLA.
        This reads directly from the WORKFLOW_CONFIGS.
        """
        category = cluster.category
        workflow = WORKFLOW_CONFIGS.get(category, WORKFLOW_CONFIGS["other"])
        
        escalate_to_name = workflow["escalate_to"]
        
        # Mock contact details for central/state agencies
        escalate_contacts = {
            "Ministry of Road Transport & Highways": {
                "name": "Ministry of Road Transport & Highways (MoRTH)",
                "contact_email": "morth-alerts@gov.in",
                "contact_phone": "+916287169669"  # Redirected to user's test phone for verification
            },
            "State Sanitation & Urban Development Authority": {
                "name": "State Urban Development & Sanitation Board",
                "contact_email": "state-sanitation@gov.in",
                "contact_phone": "+916287169669"
            },
            "State Animal Welfare Board": {
                "name": "State Animal Welfare Board",
                "contact_email": "animal-welfare-state@gov.in",
                "contact_phone": "+916287169669"
            },
            "District Emergency Operations Center": {
                "name": "District Emergency Operations Center (DEOC)",
                "contact_email": "district-emergency@gov.in",
                "contact_phone": "+916287169669"
            },
            "Chief Minister Grievance Portal": {
                "name": "CM Grievance Redressal Cell",
                "contact_email": "cm-grievance@state.gov.in",
                "contact_phone": "+916287169669"
            }
        }
        
        return escalate_contacts.get(
            escalate_to_name, 
            {
                "name": escalate_to_name, 
                "contact_email": "central-grievance@gov.in", 
                "contact_phone": "+916287169669"
            }
        )
