import json
import re
import requests
from datetime import datetime
from urllib.parse import quote_plus
from sqlalchemy.orm import Session
from backend.config import Config, SLA_RULES
from backend.models import Report, ReportCluster, User, NotificationLog
from backend.agents.notification_agent import NotificationAgent

class SaarthiAgent:
    """
    Saarthi Agent (Community Alliance & Contractor Accountability Agent)
    1. Unifies all distinct citizens who reported the same cluster into a community coalition.
    2. Performs web search / web scraping to discover local contractors, PWD engineers, and NGOs.
    3. Dispatches automated coalition SMS/Email to citizens and accountability demand notices to contractors.
    """

    @classmethod
    def scrape_local_contractor_and_ngo(cls, category: str, lat: float, lng: float) -> dict:
        """
        Uses DuckDuckGo web search API & web scraping to find local PWD contractors, 
        municipal engineers, or regional NGOs for the specific category and location.
        """
        query = f"local municipal contractor PWD NGO {category} Delhi {lat:.2f} {lng:.2f}"
        encoded_query = quote_plus(query)
        url = f"https://html.duckduckgo.com/html/?q={encoded_query}"
        
        discovered_info = {
            "contractor_name": "Regional Infrastructure Public Works Contractor",
            "contractor_email": "contractor-pwd@sewa.gov.in",
            "contractor_phone": "+916287169669",
            "ngo_name": "Citizen Governance & Welfare Action NGO",
            "ngo_email": "citizen-action-ngo@sewa.gov.in",
            "search_snippet": "Discovered public works tender listings for regional ward development."
        }

        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            res = requests.get(url, headers=headers, timeout=8)
            if res.status_code == 200:
                html = res.text
                # Simple regex extraction for contact emails if present in search results
                emails = re.findall(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', html)
                clean_emails = [e for e in emails if not e.endswith(('.png', '.jpg', '.css', '.js'))]
                if clean_emails:
                    discovered_info["contractor_email"] = clean_emails[0]
                    if len(clean_emails) > 1:
                        discovered_info["ngo_email"] = clean_emails[1]
                
                print(f"[SaarthiAgent] Web scraping completed for query '{query}'. Extracted emails: {clean_emails[:2]}")
        except Exception as e:
            print(f"[SaarthiAgent] Web search scraping exception: {e}. Utilizing fallback contractor directory.")

        return discovered_info

    @classmethod
    def trigger_saarthi_coalition(cls, db: Session, cluster_id: int) -> dict:
        """
        Triggers the Saarthi Agent for a given report cluster.
        1. Finds all distinct citizens who filed reports for this cluster.
        2. Sends unified community coalition SMS/Emails to all citizens ("You are not alone!").
        3. Web scrapes local contractor/NGO contact info and dispatches formal accountability notices.
        """
        cluster = db.query(ReportCluster).filter(ReportCluster.id == cluster_id).first()
        if not cluster:
            return {"error": "Cluster not found"}

        # 1. Fetch all reports and distinct citizens in this cluster
        reports = db.query(Report).filter(
            Report.cluster_id == cluster_id,
            Report.category != "flagged"
        ).all()
        
        citizen_ids = list(set(r.submitted_by for r in reports))
        citizens = db.query(User).filter(User.id.in_(citizen_ids)).all()
        
        # 2. Web Scrape local contractor and NGO details
        scraped_entity = cls.scrape_local_contractor_and_ngo(cluster.category, cluster.latitude, cluster.longitude)

        # 3. Notify all coalition citizens
        coalition_msg = (
            f"[Saarthi Alliance] You and {len(citizens)-1} other citizens in your area "
            f"have filed reports on cluster #{cluster.id} ({cluster.category}). "
            f"Saarthi Agent has issued formal demand notices to public contractor '{scraped_entity['contractor_name']}'."
        )

        for citizen in citizens:
            if citizen.phone:
                NotificationAgent.send_sms(db, citizen.phone, coalition_msg, cluster_id=cluster.id)
            email_subject = f"🤝 Saarthi Alliance Active: {len(citizens)} Citizens United on Cluster #{cluster.id}"
            email_html = f"""
            <div style="font-family: Arial, sans-serif; border: 2px solid #ea580c; padding: 20px; border-radius: 8px;">
                <h3 style="color: #ea580c;">🤝 SAARTHI COMMUNITY ALLIANCE ACTIVATED</h3>
                <p>Hello <strong>{citizen.name or 'Citizen'}</strong>,</p>
                <p>Your voice is multiplied! You and <strong>{len(citizens)} distinct citizens</strong> have filed grievances for the same <strong>{cluster.category.upper()}</strong> issue at coordinates ({cluster.latitude:.4f}, {cluster.longitude:.4f}).</p>
                <div style="background-color: #fff7ed; padding: 12px; border-left: 4px solid #ea580c; margin: 15px 0;">
                    <p style="margin: 0;"><strong>Public Accountability Action Taken:</strong></p>
                    <p style="margin: 5px 0 0 0;">Saarthi Agent has auto-discovered assigned contractor <strong>{scraped_entity['contractor_name']}</strong> ({scraped_entity['contractor_email']}) and issued a formal performance demand notice.</p>
                </div>
            </div>
            """
            NotificationAgent.send_email(db, f"{citizen.phone}@sewa-citizen.org", email_subject, email_html, cluster_id=cluster.id)

        # 4. Issue Accountability Demand Notice to Public Contractor & NGO
        contractor_email_subject = f"⚠️ PUBLIC ACCOUNTABILITY NOTICE: Tender Contract Performance Demand — Cluster #{cluster.id}"
        contractor_html = f"""
        <div style="font-family: Arial, sans-serif; border: 2px solid red; padding: 20px; border-radius: 8px;">
            <h2 style="color: red; margin-top: 0;">⚠️ PUBLIC CONTRACTOR PERFORMANCE DEMAND NOTICE</h2>
            <p><strong>To:</strong> {scraped_entity['contractor_name']} ({scraped_entity['contractor_email']})</p>
            <p><strong>Cc:</strong> {scraped_entity['ngo_name']} ({scraped_entity['ngo_email']})</p>
            <p><strong>Location:</strong> Latitude {cluster.latitude:.6f}, Longitude {cluster.longitude:.6f}</p>
            <p><strong>Category:</strong> {cluster.category.upper()}</p>
            <p><strong>Citizen filings:</strong> {len(citizens)} distinct verified citizen reports</p>
            
            <div style="background-color: #ffe6e6; padding: 15px; border-left: 5px solid red; margin: 15px 0;">
                <p style="margin: 0; font-weight: bold; color: red;">Demand Summary:</p>
                <p style="margin: 5px 0 0 0;">Public funds allocated under ward development infrastructure. {len(citizens)} distinct citizens have logged non-performance. Immediate remediation required prior to municipal audit escalation.</p>
            </div>
            
            <p style="font-size: 11px; color: #666;">Generated autonomously by Sewa Saarthi Public Contractor Audit Agent.</p>
        </div>
        """

        NotificationAgent.send_email(db, scraped_entity["contractor_email"], contractor_email_subject, contractor_html, cluster_id=cluster.id)
        NotificationAgent.send_email(db, scraped_entity["ngo_email"], f"📢 Copy Notice: Citizen Alliance Cluster #{cluster.id}", contractor_html, cluster_id=cluster.id)

        return {
            "status": "success",
            "cluster_id": cluster.id,
            "distinct_citizens_united": len(citizens),
            "contractor_notified": scraped_entity["contractor_name"],
            "contractor_email": scraped_entity["contractor_email"],
            "ngo_notified": scraped_entity["ngo_name"],
            "message": f"Saarthi Agent successfully united {len(citizens)} citizens and issued accountability demand notices to contractor & NGO."
        }
