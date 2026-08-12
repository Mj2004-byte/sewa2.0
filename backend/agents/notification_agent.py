import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import requests
from urllib.parse import quote_plus
from datetime import datetime
from sqlalchemy.orm import Session
from backend.config import Config
from backend.models import NotificationLog

class NotificationAgent:
    """
    Notification Agent dispatches alerts across Email, Twilio Voice Call, and Twilio SMS.
    Handles Twilio trial mode limitations and logs unverified recipient exceptions distinctly.
    """

    @classmethod
    def log_notification(cls, db: Session, channel: str, recipient: str, status: str, report_id: int = None, cluster_id: int = None):
        """Creates a persistent log entry in the notification audit trail."""
        try:
            log_entry = NotificationLog(
                channel=channel,
                recipient=recipient,
                status=status,
                sent_at=datetime.utcnow(),
                report_id=report_id,
                cluster_id=cluster_id
            )
            db.add(log_entry)
            db.commit()
            print(f"[NotificationAgent] Audited {channel} alert to {recipient} with status: {status}")
        except Exception as e:
            print(f"[NotificationAgent] Failed to audit notification: {e}")

    @classmethod
    def send_email(cls, db: Session, recipient: str, subject: str, html_body: str, report_id: int = None, cluster_id: int = None) -> bool:
        """Sends an HTML email notification using Python's smtplib."""
        safe_subj = subject.encode('ascii', 'replace').decode('ascii')
        print(f"[NotificationAgent] Preparing email to {recipient} Subject: {safe_subj}")
        
        # Simulate if credentials missing
        if not Config.SMTP_USER or not Config.SMTP_PASSWORD or "your_email" in Config.SMTP_USER:
            print("--- [SIMULATED EMAIL DISPATCH] ---")
            print(f"To: {recipient}")
            print(f"Subject: {safe_subj}")
            print("----------------------------------")
            cls.log_notification(db, "email", recipient, "simulated", report_id, cluster_id)
            return True

        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = Config.SMTP_FROM_EMAIL
            msg['To'] = recipient
            
            part = MIMEText(html_body, 'html')
            msg.attach(part)
            
            with smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT) as server:
                server.starttls()
                server.login(Config.SMTP_USER, Config.SMTP_PASSWORD)
                server.sendmail(Config.SMTP_FROM_EMAIL, recipient, msg.as_string())
                
            cls.log_notification(db, "email", recipient, "sent", report_id, cluster_id)
            return True
        except Exception as e:
            print(f"[NotificationAgent] Email send failure to {recipient}: {e}")
            cls.log_notification(db, "email", recipient, f"failed: {str(e)[:50]}", report_id, cluster_id)
            return False

    @classmethod
    def make_voice_call(cls, db: Session, phone_number: str, text_message: str, report_id: int = None, cluster_id: int = None) -> bool:
        """
        Triggers an automated voice call using Twilio Programmable Voice.
        Catches unverified number trial errors and triggers fallback email dispatch.
        """
        print(f"[NotificationAgent] Triggering voice call to {phone_number}...")
        
        if not Config.TWILIO_ACCOUNT_SID or not Config.TWILIO_AUTH_TOKEN or "your_twilio" in Config.TWILIO_ACCOUNT_SID:
            print("--- [SIMULATED TWILIO VOICE DISPATCH] ---")
            print(f"To: {phone_number} | Message: {text_message}")
            print("-----------------------------------------")
            cls.log_notification(db, "voice", phone_number, "simulated", report_id, cluster_id)
            return True

        encoded_msg = quote_plus(text_message)
        twimlet_url = f"http://twimlets.com/message?Message%5B0%5D={encoded_msg}"
        twilio_url = f"https://api.twilio.com/2010-04-01/Accounts/{Config.TWILIO_ACCOUNT_SID}/Calls.json"
        
        payload = {
            "To": phone_number,
            "From": Config.TWILIO_FROM_NUMBER,
            "Url": twimlet_url
        }
        
        try:
            response = requests.post(
                twilio_url,
                data=payload,
                auth=(Config.TWILIO_ACCOUNT_SID, Config.TWILIO_AUTH_TOKEN),
                timeout=10
            )
            
            resp_json = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
            error_code = resp_json.get("code")
            
            # Catch unverified phone number error (Twilio Error 21211 or trial restriction message)
            if response.status_code == 400 and (error_code == 21211 or "unverified" in str(resp_json).lower()):
                print(f"[NotificationAgent] Twilio Trial Limit: Recipient {phone_number} is unverified. Logging distinct status and executing email fallback.")
                cls.log_notification(db, "voice", phone_number, "failed_unverified_number", report_id, cluster_id)
                
                # Execute fallback email notification
                fallback_subject = f"⚠️ [ACTION REQUIRED] Voice Call Failed (Unverified Number) — Emergency Dispatch"
                fallback_html = f"""
                <div style="font-family: Arial, sans-serif; border: 2px solid orange; padding: 20px; border-radius: 8px;">
                    <h3 style="color: #d97706;">⚠️ EMERGENCY VOICE CALL FALLBACK</h3>
                    <p>Automated voice call to <strong>{phone_number}</strong> failed because the number is unverified under the active Twilio trial account.</p>
                    <p><strong>Alert Message:</strong> {text_message}</p>
                    <p style="background: #fef3c7; padding: 10px; border-left: 4px solid #d97706;">
                        <strong>Action Required:</strong> Immediate manual follow-up phone call required by on-duty dispatch officer.
                    </p>
                </div>
                """
                cls.send_email(db, Config.SMTP_FROM_EMAIL, fallback_subject, fallback_html, report_id, cluster_id)
                return False
                
            if response.status_code in [200, 201]:
                cls.log_notification(db, "voice", phone_number, "called", report_id, cluster_id)
                return True
            else:
                cls.log_notification(db, "voice", phone_number, f"failed_{response.status_code}", report_id, cluster_id)
                return False
        except Exception as e:
            print(f"[NotificationAgent] Twilio Voice exception: {e}")
            cls.log_notification(db, "voice", phone_number, f"failed_err: {str(e)[:40]}", report_id, cluster_id)
            return False

    @classmethod
    def send_sms(cls, db: Session, phone_number: str, text_message: str, report_id: int = None, cluster_id: int = None) -> bool:
        """Sends an SMS alert using Twilio Programmable SMS."""
        print(f"[NotificationAgent] Sending SMS to {phone_number}...")
        
        if not Config.TWILIO_ACCOUNT_SID or not Config.TWILIO_AUTH_TOKEN or "your_twilio" in Config.TWILIO_ACCOUNT_SID:
            print("--- [SIMULATED TWILIO SMS DISPATCH] ---")
            safe_text = text_message.encode('ascii', 'replace').decode('ascii')
            print(f"To: {phone_number} | Text: {safe_text}")
            print("---------------------------------------")
            cls.log_notification(db, "sms", phone_number, "simulated", report_id, cluster_id)
            return True
            
        twilio_url = f"https://api.twilio.com/2010-04-01/Accounts/{Config.TWILIO_ACCOUNT_SID}/Messages.json"
        payload = {
            "To": phone_number,
            "From": Config.TWILIO_FROM_NUMBER,
            "Body": text_message
        }
        
        try:
            response = requests.post(
                twilio_url,
                data=payload,
                auth=(Config.TWILIO_ACCOUNT_SID, Config.TWILIO_AUTH_TOKEN),
                timeout=10
            )
            resp_json = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
            error_code = resp_json.get("code")
            
            if response.status_code == 400 and (error_code == 21211 or "unverified" in str(resp_json).lower()):
                print(f"[NotificationAgent] Twilio Trial Limit: SMS recipient {phone_number} is unverified.")
                cls.log_notification(db, "sms", phone_number, "failed_unverified_number", report_id, cluster_id)
                return False
                
            if response.status_code in [200, 201]:
                cls.log_notification(db, "sms", phone_number, "sent", report_id, cluster_id)
                return True
            else:
                cls.log_notification(db, "sms", phone_number, f"failed_{response.status_code}", report_id, cluster_id)
                return False
        except Exception as e:
            print(f"[NotificationAgent] Twilio SMS exception: {e}")
            cls.log_notification(db, "sms", phone_number, f"failed_err: {str(e)[:40]}", report_id, cluster_id)
            return False
