import math
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from backend.models import Report, ReportCluster
from backend.database import haversine_distance

class ClusteringAgent:
    """
    Clustering Agent handles spatial geofenced clustering, distinct citizen counting, 
    and per-user abuse prevention rate-limiting.
    """

    @classmethod
    def check_user_rate_limit(cls, db: Session, user_id: int, category: str, limit: int = 3, window_minutes: int = 10) -> bool:
        """
        Prevents a single citizen from spamming multiple reports to artificially inflate report counts.
        Returns True if user is within rate limit, False if rate limit is exceeded.
        """
        time_cutoff = datetime.utcnow() - timedelta(minutes=window_minutes)
        recent_count = db.query(Report).filter(
            and_(
                Report.submitted_by == user_id,
                Report.category == category,
                Report.created_at >= time_cutoff
            )
        ).count()
        
        return recent_count < limit

    @classmethod
    def count_distinct_citizens(cls, db: Session, cluster_id: int) -> int:
        """
        Counts the number of DISTINCT users who have submitted non-flagged reports to this cluster.
        """
        result = db.query(func.count(func.distinct(Report.submitted_by))).filter(
            and_(
                Report.cluster_id == cluster_id,
                Report.category != "flagged"
            )
        ).scalar()
        return result or 0

    @classmethod
    def get_or_create_cluster(cls, db: Session, report: Report, geofence_meters: float = 50.0) -> ReportCluster:
        """
        Clusters incoming non-flagged reports spatially within `geofence_meters`.
        Recalculates centroid coordinates and distinct citizen filing counts.
        """
        # Flagged moderation failures are excluded from clustering
        if report.category == "flagged":
            report.status = "flagged"
            db.commit()
            print(f"[ClusteringAgent] Report {report.id} flagged by moderation filter. Excluded from clustering.")
            return None

        # Calculate bounding box deltas
        lat_delta = geofence_meters / 111000.0
        cos_lat = math.cos(math.radians(report.latitude))
        lng_delta = geofence_meters / (111000.0 * cos_lat) if cos_lat > 0 else geofence_meters / 111000.0

        # Find active candidate clusters
        candidate_clusters = db.query(ReportCluster).filter(
            and_(
                ReportCluster.category == report.category,
                ReportCluster.status != "resolved",
                ReportCluster.latitude.between(report.latitude - lat_delta, report.latitude + lat_delta),
                ReportCluster.longitude.between(report.longitude - lng_delta, report.longitude + lng_delta)
            )
        ).all()

        best_cluster = None
        min_dist = geofence_meters

        for cluster in candidate_clusters:
            dist = haversine_distance(report.latitude, report.longitude, cluster.latitude, cluster.longitude)
            if dist <= min_dist:
                best_cluster = cluster
                min_dist = dist

        if best_cluster:
            report.cluster_id = best_cluster.id
            
            # Recalculate cluster centroid and distinct user count
            sibling_reports = db.query(Report).filter(
                and_(Report.cluster_id == best_cluster.id, Report.category != "flagged")
            ).all()
            all_reports = sibling_reports + [report]
            
            total_lat = sum(r.latitude for r in all_reports)
            total_lng = sum(r.longitude for r in all_reports)
            count = len(all_reports)
            
            best_cluster.latitude = total_lat / count
            best_cluster.longitude = total_lng / count
            best_cluster.report_count = count
            best_cluster.last_reported_at = datetime.utcnow()
            
            report.status = "acknowledged" if best_cluster.status == "open" else best_cluster.status
            db.add(best_cluster)
            db.commit()
            db.refresh(best_cluster)
            print(f"[ClusteringAgent] Associated report {report.id} to cluster {best_cluster.id} (Distance: {min_dist:.2f}m)")
            return best_cluster
        else:
            new_cluster = ReportCluster(
                latitude=report.latitude,
                longitude=report.longitude,
                category=report.category,
                report_count=1,
                first_reported_at=report.created_at or datetime.utcnow(),
                last_reported_at=report.created_at or datetime.utcnow(),
                status="open",
                escalation_level=0
            )
            db.add(new_cluster)
            db.commit()
            db.refresh(new_cluster)
            
            report.cluster_id = new_cluster.id
            report.status = "submitted"
            db.commit()
            print(f"[ClusteringAgent] Created new cluster {new_cluster.id} for report {report.id}")
            return new_cluster
