from twilio.rest import Client
from config import settings


def send_sms(to_number: str, message: str) -> bool:
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN or not settings.TWILIO_FROM_NUMBER:
        return False

    try:
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        client.messages.create(
            to=to_number,
            from_=settings.TWILIO_FROM_NUMBER,
            body=message,
        )
        return True
    except Exception:
        return False
