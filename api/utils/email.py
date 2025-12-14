import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List

from config import settings

def send_email(
    to_email: str,
    subject: str,
    body: str,
    recipients: List[str] = None
):
    """
    Sends an email using the configured SMTP server.
    """
    if not settings.MAIL_USERNAME or not settings.MAIL_PASSWORD or not settings.MAIL_FROM or not settings.MAIL_SERVER:
        print("Email configuration missing. Skipping email send.")
        return

    msg = MIMEMultipart("alternative")
    msg['From'] = settings.MAIL_FROM
    msg['To'] = to_email # Main recipient (can be just one)
    if recipients:
        msg['To'] = ", ".join(recipients) # If multiple, format as comma-separated string
    msg['Subject'] = subject

    # Attach body as plain text
    msg.attach(MIMEText(body, "plain"))

    try:
        with smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT) as server:
            server.starttls()  # Upgrade connection to secure TLS
            server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
            server.sendmail(settings.MAIL_FROM, to_email if not recipients else recipients, msg.as_string())
        print(f"Email sent to {to_email if not recipients else ', '.join(recipients)} successfully.")
    except Exception as e:
        print(f"Failed to send email to {to_email if not recipients else ', '.join(recipients)}: {e}")