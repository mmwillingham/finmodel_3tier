import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List
import logging

from config import settings

logger = logging.getLogger(__name__)

def send_email(
    to_email: str,
    subject: str,
    body: str,
    recipients: List[str] = None
) -> bool:
    """
    Sends an email using the configured SMTP server.
    
    Returns:
        bool: True if email was sent successfully, False otherwise
    """
    # Check if email configuration is properly set (not empty strings)
    if (not settings.MAIL_USERNAME or 
        not settings.MAIL_PASSWORD or 
        not settings.MAIL_FROM or 
        not settings.MAIL_SERVER or
        settings.MAIL_USERNAME.strip() == "" or
        settings.MAIL_PASSWORD.strip() == "" or
        settings.MAIL_FROM.strip() == "" or
        settings.MAIL_SERVER.strip() == ""):
        logger.warning(
            f"Email configuration missing. Cannot send email to {to_email}. "
            f"Required: MAIL_SERVER={bool(settings.MAIL_SERVER)}, "
            f"MAIL_PORT={settings.MAIL_PORT}, "
            f"MAIL_USERNAME={bool(settings.MAIL_USERNAME)}, "
            f"MAIL_PASSWORD={bool(settings.MAIL_PASSWORD)}, "
            f"MAIL_FROM={bool(settings.MAIL_FROM)}"
        )
        return False

    msg = MIMEMultipart("alternative")
    msg['From'] = settings.MAIL_FROM
    msg['To'] = to_email # Main recipient (can be just one)
    if recipients:
        msg['To'] = ", ".join(recipients) # If multiple, format as comma-separated string
    msg['Subject'] = subject

    # Attach body as plain text
    msg.attach(MIMEText(body, "plain"))

    try:
        logger.info(f"Attempting to send email to {to_email} via {settings.MAIL_SERVER}:{settings.MAIL_PORT}")
        with smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT) as server:
            server.starttls()  # Upgrade connection to secure TLS
            server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
            server.sendmail(settings.MAIL_FROM, to_email if not recipients else recipients, msg.as_string())
        logger.info(f"Email sent successfully to {to_email if not recipients else ', '.join(recipients)}")
        return True
    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"SMTP authentication failed when sending email to {to_email}: {e}")
        return False
    except smtplib.SMTPException as e:
        logger.error(f"SMTP error when sending email to {to_email}: {e}")
        return False
    except Exception as e:
        logger.error(f"Failed to send email to {to_email if not recipients else ', '.join(recipients)}: {e}", exc_info=True)
        return False