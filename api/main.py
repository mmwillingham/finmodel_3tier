import os
import sentry_sdk
from fastapi import FastAPI, Depends, HTTPException, Response, status, BackgroundTasks, APIRouter, Header
from starlette.requests import Request
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text, func
from datetime import timedelta, datetime, date, timezone
from typing import List, Optional, Set
from starlette.responses import RedirectResponse
from utils import google_oauth
from jwt.exceptions import InvalidTokenError
import hashlib
import secrets
import json
import traceback
from copy import deepcopy
from fastapi.responses import JSONResponse
import logging
import stripe
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from starlette.types import ASGIApp, Scope, Receive, Send


# sentry_sdk.init(
#     dsn="https://e372dab210eed71bdcde76595918da24@o4510992107569152.ingest.us.sentry.io/4510992121528320",
#     traces_sample_rate=1.0,
#     profiles_sample_rate=1.0,
#     environment=os.environ.get("ENV", "production"),
#     send_default_pii=True, 
# )

sentry_sdk.init(
    dsn=os.environ.get("SENTRY_DSN"),
    traces_sample_rate=1.0,
    profiles_sample_rate=1.0,
    environment=os.environ.get("ENV", "prod"),
    send_default_pii=True, 
)

# Internal Modules
import models
import schemas
import database
import auth
import calculations

from routers.custom_charts import router as custom_charts_router # MODIFIED: Explicitly import router
from routers import assets
from routers import liabilities
from routers.settings import router as settings_router
from routers.accounts import router as accounts_router
from routers.brokerages import router as brokerages_router
from routers.auto_disbursements import router as auto_disbursements_router
from routers.export_import import router as export_import_router
from routers.referrals import router as referrals_router
from routers.points import router as points_router
from routers.documents import router as documents_router
from routers.authorized_users import router as authorized_users_router
from routers.plaid import router as plaid_router
from routers.what_if import router as what_if_router
from routers.tax import router as tax_router
from utils.document_folder_defaults import DEFAULT_DOCUMENT_FOLDER_STRUCTURE
from utils.document_vault import ensure_system_default_document_types, seed_default_document_types
from utils.email import send_email
from utils.permission_dependencies import get_accessible_user_ids
from utils.permissions import check_permission
from utils.subscription import get_user_limits
from config import settings

if settings.STRIPE_API_KEY:
    stripe.api_key = settings.STRIPE_API_KEY
from webauthn import (
    generate_registration_options,
    generate_authentication_options,
    verify_registration_response,
    verify_authentication_response,
    options_to_json,
)
from webauthn.helpers import bytes_to_base64url, base64url_to_bytes
from webauthn.helpers.structs import (
    AuthenticatorAttachment,
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

logger = logging.getLogger(__name__)

def require_subscription_level(user: schemas.UserOut, minimum_level: int, feature: str):
    if user.subscription_level < minimum_level:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{feature} requires a higher subscription tier.",
        )

def _stripe_tier_to_level(tier: str) -> int:
    mapping = {
        "premium": 2,
        "pro": 3,
    }
    return mapping.get(tier.lower(), 1)

from starlette.types import ASGIApp, Scope, Receive, Send
from fastapi.responses import JSONResponse
import os

class ShieldKeyMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        # Only process HTTP
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        method = scope.get("method")
        path = scope.get("path", "")
        
        # 1. IMMEDIATE BYPASS for OPTIONS
        # This prevents the 400 error because we don't look at headers or body
        if method == "OPTIONS":
            await self.app(scope, receive, send)
            return

        # 2. Extract headers for other methods
        headers = dict(scope.get("headers", []))
        user_agent = headers.get(b"user-agent", b"").decode()
        shield_key = headers.get(b"x-mmr-shield-key", b"").decode()
        expected_key = os.environ.get("MMR_SHIELD_KEY", "")

        # 3. Bypass for health/login/auth bridge routes
        if (
            "GoogleHC" in user_agent
            or path == "/token"
            or path == "/login"
        ):
            await self.app(scope, receive, send)
            return

        # 4. Enforce Shield Key
        if shield_key != expected_key:
            response = JSONResponse(
                status_code=403,
                content={"detail": "Forbidden: Direct access not allowed"}
            )
            await response(scope, receive, send)
            return

        await self.app(scope, receive, send)

# --- INITIALIZATION ---
app = FastAPI(title="Financial Projector API", 
    version="1.0", 
    _proxy_headers=True, 
    redirect_slashes=False
)

# Track container start time
start_time = datetime.now(timezone.utc)

# Unique instance ID (revision + start timestamp)
instance_id = f"{os.environ.get('K_REVISION')}-{int(start_time.timestamp())}"

@app.get("/health", tags=["Health"])
@app.get("/health/", tags=["Health"]) # Handles the trailing slash issue
async def health_check():
    uptime_seconds = int((datetime.now(timezone.utc) - start_time).total_seconds())
    return JSONResponse(content={
        "status": "ok",
        "message": "Backend is warming up the engines!",
        "instance_id": instance_id,
        "uptime_seconds": uptime_seconds
    })

PUBLIC_CACHE_PATHS = {
    "/",
    "/openapi.json",
    "/docs",
    "/docs/oauth2-redirect",
    "/redoc",
}

PUBLIC_CACHE_CONTROL = "public, max-age=300, s-maxage=3600, stale-while-revalidate=600"
PRIVATE_NO_STORE = "private, no-store"
NO_STORE = "no-store"

class DynamicSecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # 1. Get the response from the rest of the stack
        response = await call_next(request)
        
        # 2. Get the host dynamically (e.g., api.ordaxium.com)
        host = request.headers.get("host", "ordaxium.com")
        
        # 3. Build a dynamic CSP
        # 'frame-ancestors' replaces X-Frame-Options in modern browsers.
        # We allow the current host to frame itself if needed.
        csp_policy = (
            f"default-src 'self'; "
            f"script-src 'self' https://{host}; "
            "style-src 'self' 'unsafe-inline'; "
            "frame-ancestors 'none';" 
        )
        
        # 4. Inject headers into the response
        response.headers["Content-Security-Policy"] = csp_policy
        response.headers["X-Frame-Options"] = "DENY" # Legacy fallback
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        return response


class CacheControlMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp, public_cache_paths: Set[str]):
        super().__init__(app)
        self.public_cache_paths = public_cache_paths

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        if response.headers.get("Cache-Control"):
            return response

        if request.method not in ("GET", "HEAD"):
            response.headers["Cache-Control"] = NO_STORE
            return response

        if request.headers.get("authorization") or request.headers.get("cookie"):
            response.headers["Cache-Control"] = PRIVATE_NO_STORE
            return response

        if request.url.path in self.public_cache_paths:
            response.headers["Cache-Control"] = PUBLIC_CACHE_CONTROL
        else:
            response.headers["Cache-Control"] = PRIVATE_NO_STORE

        return response

@app.on_event("startup")
async def startup_event():
    # Configure logging for the application
    log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    logging.basicConfig(level=logging.WARNING, format=log_format)

    # Explicitly set log levels for uvicorn and our application modules
    logging.getLogger("uvicorn").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.WARNING)
    logging.getLogger("api.routers.custom_charts").setLevel(logging.WARNING)
    logging.getLogger("api.calculations").setLevel(logging.WARNING)
    logging.getLogger("calculations").setLevel(logging.WARNING)  # Also set for 'calculations' module name
    logging.getLogger("main").setLevel(logging.WARNING)  # Set for main module logger
    logging.getLogger("auth").setLevel(logging.WARNING)

app.include_router(custom_charts_router) # MODIFIED: Use the explicitly imported router
app.include_router(settings_router)
app.include_router(assets.router)
app.include_router(liabilities.router)
app.include_router(brokerages_router)
app.include_router(accounts_router)
app.include_router(auto_disbursements_router)
app.include_router(export_import_router)
app.include_router(referrals_router)
app.include_router(points_router)
app.include_router(documents_router)
app.include_router(authorized_users_router)
app.include_router(plaid_router)
app.include_router(what_if_router)
app.include_router(tax_router)

billing_router = APIRouter(prefix="/billing", tags=["billing"])

@billing_router.post(
    "/checkout-session",
    response_model=schemas.CheckoutSessionResponse,
    tags=["billing"],
)
def create_checkout_session(
    payload: schemas.CheckoutSessionRequest,
    current_user: schemas.UserOut = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    tier_price_map = {
        "premium": settings.STRIPE_PREMIUM_PRICE_ID,
        "pro": settings.STRIPE_PRO_PRICE_ID,
    }
    price_id = tier_price_map.get(payload.tier.lower())
    if not price_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Requested tier is not supported.")
    if not settings.STRIPE_SUCCESS_URL or not settings.STRIPE_CANCEL_URL:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Stripe redirect URLs are not configured.")
    if not settings.STRIPE_API_KEY:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Stripe API key is missing.")

    session = stripe.checkout.Session.create(
        success_url=settings.STRIPE_SUCCESS_URL,
        cancel_url=settings.STRIPE_CANCEL_URL,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        customer_email=current_user.email,
        metadata={"tier": payload.tier, "user_id": str(current_user.id)},
    )

    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if user:
        user.stripe_customer_id = session.get("customer")
        db.commit()
    return schemas.CheckoutSessionResponse(sessionId=session.id, url=session.url)

app.include_router(billing_router)

# New router for admin global settings
admin_router = APIRouter()

@app.get("/", tags=["health"])
async def root():
    return {"message": "Financial Projector API is running!"}

# --- CONFIGURATION ---
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES 

# Add ShieldKeyMiddleware
app.add_middleware(ShieldKeyMiddleware)

# Add DynamicSecurityHeadersMiddleware
app.add_middleware(DynamicSecurityHeadersMiddleware)

# --- CORS CONFIGURATION (CRITICAL for frontend connection) ---
app.add_middleware(
    CacheControlMiddleware,
    public_cache_paths=PUBLIC_CACHE_PATHS,
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=settings.CORS_ORIGINS_REGEX,              
    allow_credentials=True,             
    allow_methods=["*"],
    # Adding "Accept" and "Origin" helps with strict browser checks
    allow_headers=["Content-Type", "X-MMR-Shield-Key", "Authorization", "Accept", "Origin", "X-MFA-DEVICE"],                
)
# --- END CORS CONFIGURATION ---

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

@app.get("/auth/google", tags=["oauth"], summary="Initiate Google OAuth login")
async def google_login(request: Request):
    return RedirectResponse(url=google_oauth.get_google_auth_url())

@app.get("/auth/google/callback", tags=["oauth"], summary="Handle Google OAuth callback")
async def google_callback(code: str, db: Session = Depends(database.get_db)):
    try:
        token_response = await google_oauth.get_google_oauth_token(code)
        access_token = token_response["access_token"]
        user_info = await google_oauth.get_google_user_info(access_token)
        google_id = user_info["id"]
        email = user_info["email"]
        
        user = auth.authenticate_or_create_google_user(db, google_id, email)

        our_access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        our_access_token = auth.create_access_token(
            data={"sub": str(user.id)}, expires_delta=our_access_token_expires
        )

        redirect_url = f"{settings.FRONTEND_URL}/auth/google/callback?token={our_access_token}"
        return RedirectResponse(url=redirect_url)

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"in google_callback: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Google OAuth failed: {e}"
        )

# --- AUTHENTICATION ROUTES ---

@app.post("/token")
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(database.get_db),
    mfa_device: str | None = Header(default=None, alias="X-MFA-DEVICE"),
):
    user = auth.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Only require email confirmation if user has an email address
    if user.email and not user.is_confirmed:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Please confirm your email address before logging in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if user.mfa_enabled:
        if mfa_device and _is_trusted_device(db, user, mfa_device):
            access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
            access_token = auth.create_access_token(
                data={"sub": str(user.id)}, expires_delta=access_token_expires
            )
            return {
                "access_token": access_token,
                "token_type": "bearer",
                "must_change_password": user.must_change_password
            }

        mfa_token = auth.create_mfa_token(user.id, timedelta(minutes=settings.MFA_OTP_TTL_MINUTES))
        methods = []
        if user.mfa_email_enabled and user.email:
            methods.append("email")
        if user.mfa_passkey_enabled:
            passkey_exists = db.query(models.MfaPasskeyCredential).filter(
                models.MfaPasskeyCredential.user_id == user.id
            ).count() > 0
            if passkey_exists:
                methods.append("passkey")
        if not methods:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MFA is enabled but no methods are configured.",
            )
        return {
            "mfa_required": True,
            "mfa_token": mfa_token,
            "mfa_methods": methods,
            "must_change_password": user.must_change_password
        }

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )

    # Return must_change_password flag so frontend can handle it
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "must_change_password": user.must_change_password
    }

@app.get("/users/me", response_model=schemas.UserOut)
def read_users_me(
    current_user: schemas.UserOut = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    return current_user


def _mask_email(email: str) -> str:
    if not email or "@" not in email:
        return ""
    name, domain = email.split("@", 1)
    if len(name) <= 2:
        masked_name = f"{name[0]}*"
    else:
        masked_name = f"{name[0]}***{name[-1]}"
    return f"{masked_name}@{domain}"

def _hash_otp(code: str) -> str:
    return hashlib.sha256(f"{code}{settings.SECRET_KEY}".encode("utf-8")).hexdigest()


def _hash_device_token(token: str) -> str:
    return hashlib.sha256(f"{token}{settings.SECRET_KEY}".encode("utf-8")).hexdigest()


def _generate_otp() -> str:
    return f"{secrets.randbelow(1000000):06d}"


def _get_mfa_user_from_token(mfa_token: str, db: Session) -> models.User:
    try:
        payload = auth.decode_local_token(mfa_token)
    except InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid MFA token.")
    if not payload.get("mfa"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid MFA token.")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid MFA token.")
    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")
    return user


def _get_mfa_destination(user: models.User, method: str) -> str:
    if method == "email":
        if not user.email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No email on file.")
        return user.email
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid MFA method.")


def _get_webauthn_rp_id(request: Request | None = None) -> str:
    if request:
        origin = request.headers.get("origin")
        if origin:
            parsed = urlparse(origin)
            if parsed.hostname:
                origin_host = parsed.hostname
                if settings.WEBAUTHN_RP_ID:
                    if origin_host == settings.WEBAUTHN_RP_ID or origin_host.endswith(f".{settings.WEBAUTHN_RP_ID}"):
                        return settings.WEBAUTHN_RP_ID
                return origin_host
        host = request.headers.get("host")
        if host:
            host_name = host.split(":")[0]
            if settings.WEBAUTHN_RP_ID:
                if host_name == settings.WEBAUTHN_RP_ID or host_name.endswith(f".{settings.WEBAUTHN_RP_ID}"):
                    return settings.WEBAUTHN_RP_ID
            return host_name
    if settings.WEBAUTHN_RP_ID:
        return settings.WEBAUTHN_RP_ID
    parsed = urlparse(settings.FRONTEND_URL or "")
    return parsed.hostname or "localhost"


def _get_webauthn_origin() -> str:
    return settings.WEBAUTHN_ORIGIN or settings.FRONTEND_URL


def _store_passkey_challenge(user: models.User, challenge: str) -> None:
    user.mfa_passkey_challenge = challenge
    user.mfa_passkey_challenge_expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.MFA_PASSKEY_CHALLENGE_TTL_MINUTES
    )


def _require_passkey_challenge(user: models.User) -> str:
    if not user.mfa_passkey_challenge or not user.mfa_passkey_challenge_expires_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passkey challenge not found.")
    if user.mfa_passkey_challenge_expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passkey challenge expired.")
    return user.mfa_passkey_challenge


def _enforce_mfa_rate_limit(db: Session, user: models.User | None, destination: str, method: str):
    window_start = datetime.utcnow() - timedelta(hours=1)
    query = db.query(models.MfaOtpLog).filter(
        models.MfaOtpLog.created_at >= window_start,
        models.MfaOtpLog.method == method,
        models.MfaOtpLog.destination == destination,
    )
    if user:
        query = query.filter(models.MfaOtpLog.user_id == user.id)
    count = query.count()
    if count >= settings.MFA_OTP_RATE_LIMIT_PER_HOUR:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many OTP requests. Try again later.")


def _is_trusted_device(db: Session, user: models.User, token: str) -> bool:
    token_hash = _hash_device_token(token)
    device = db.query(models.MfaTrustedDevice).filter(
        models.MfaTrustedDevice.user_id == user.id,
        models.MfaTrustedDevice.device_token_hash == token_hash,
        models.MfaTrustedDevice.expires_at >= datetime.utcnow(),
    ).first()
    if not device:
        return False
    device.last_used_at = datetime.utcnow()
    db.commit()
    return True


@app.get("/mfa/settings", response_model=schemas.MfaSettingsOut, tags=["auth"])
def get_mfa_settings(
    current_user: schemas.UserOut = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    passkey_count = db.query(models.MfaPasskeyCredential).filter(
        models.MfaPasskeyCredential.user_id == user.id
    ).count()
    return schemas.MfaSettingsOut(
        mfa_enabled=user.mfa_enabled,
        mfa_email_enabled=user.mfa_email_enabled,
        mfa_passkey_enabled=user.mfa_passkey_enabled,
        mfa_passkey_registered=passkey_count > 0,
        mfa_passkey_count=passkey_count,
    )


@app.put("/mfa/settings", response_model=schemas.MfaSettingsOut, tags=["auth"])
def update_mfa_settings(
    payload: schemas.MfaSettingsUpdate,
    current_user: schemas.UserOut = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    passkey_count = db.query(models.MfaPasskeyCredential).filter(
        models.MfaPasskeyCredential.user_id == user.id
    ).count()
    passkey_registered = passkey_count > 0

    if payload.mfa_enabled is not None:
        user.mfa_enabled = payload.mfa_enabled
        if not user.mfa_enabled:
            user.mfa_email_enabled = False
            user.mfa_passkey_enabled = False
    if payload.mfa_email_enabled is not None:
        user.mfa_email_enabled = payload.mfa_email_enabled
    if payload.mfa_passkey_enabled is not None:
        if payload.mfa_passkey_enabled and not passkey_registered:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Register a passkey before enabling it.")
        user.mfa_passkey_enabled = payload.mfa_passkey_enabled

    if user.mfa_email_enabled and not user.email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is required for email OTP.")
    if user.mfa_enabled and not (user.mfa_email_enabled or (user.mfa_passkey_enabled and passkey_registered)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Select at least one MFA method.")

    db.commit()
    db.refresh(user)
    return schemas.MfaSettingsOut(
        mfa_enabled=user.mfa_enabled,
        mfa_email_enabled=user.mfa_email_enabled,
        mfa_passkey_enabled=user.mfa_passkey_enabled,
        mfa_passkey_registered=passkey_count > 0,
        mfa_passkey_count=passkey_count,
    )


@app.get("/mfa/passkey/registration-options", tags=["auth"])
def get_passkey_registration_options(
    request: Request,
    current_user: schemas.UserOut = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    rp_id = _get_webauthn_rp_id(request)
    rp_name = settings.WEBAUTHN_RP_NAME or settings.APP_NAME
    user_name = user.email or f"user-{user.id}"
    exclude_credentials = [
        PublicKeyCredentialDescriptor(id=base64url_to_bytes(cred.credential_id))
        for cred in db.query(models.MfaPasskeyCredential)
        .filter(models.MfaPasskeyCredential.user_id == user.id)
        .all()
    ]

    options = generate_registration_options(
        rp_id=rp_id,
        rp_name=rp_name,
        user_id=str(user.id).encode("utf-8"),
        user_name=user_name,
        user_display_name=user_name,
        authenticator_selection=AuthenticatorSelectionCriteria(
            authenticator_attachment=AuthenticatorAttachment.PLATFORM,
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.REQUIRED,
        ),
        exclude_credentials=exclude_credentials or None,
    )
    options_json = options_to_json(options)
    options_data = json.loads(options_json)
    _store_passkey_challenge(user, options_data.get("challenge", ""))
    db.commit()
    return options_data


@app.post("/mfa/passkey/verify-registration", tags=["auth"])
def verify_passkey_registration(
    payload: schemas.MfaPasskeyRegister,
    current_user: schemas.UserOut = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
    request: Request = None,
):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    challenge = _require_passkey_challenge(user)
    try:
        verification = verify_registration_response(
            credential=payload.credential,
            expected_challenge=base64url_to_bytes(challenge),
            expected_rp_id=_get_webauthn_rp_id(request),
            expected_origin=_get_webauthn_origin(),
            require_user_verification=True,
        )
    except Exception as exc:
        logger.warning("Passkey registration failed", exc_info=exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passkey registration failed.")

    credential_id = bytes_to_base64url(verification.credential_id)
    existing = db.query(models.MfaPasskeyCredential).filter(
        models.MfaPasskeyCredential.credential_id == credential_id
    ).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passkey already registered.")
    db.add(models.MfaPasskeyCredential(
        user_id=user.id,
        credential_id=credential_id,
        credential_public_key=bytes_to_base64url(verification.credential_public_key),
        sign_count=verification.sign_count,
        device_type=str(verification.credential_device_type),
        backed_up=bool(verification.credential_backed_up),
        transports=payload.credential.get("response", {}).get("transports"),
    ))
    user.mfa_passkey_enabled = True
    user.mfa_passkey_challenge = None
    user.mfa_passkey_challenge_expires_at = None
    db.commit()
    passkey_count = db.query(models.MfaPasskeyCredential).filter(
        models.MfaPasskeyCredential.user_id == user.id
    ).count()
    return {"ok": True, "mfa_passkey_registered": True, "mfa_passkey_count": passkey_count}


@app.post("/mfa/passkey/authentication-options", tags=["auth"])
def get_passkey_authentication_options(
    request: Request,
    payload: schemas.MfaPasskeyAuthOptions,
    db: Session = Depends(database.get_db),
):
    user = _get_mfa_user_from_token(payload.mfa_token, db)
    if not user.mfa_passkey_enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passkey is not enabled.")

    credentials = db.query(models.MfaPasskeyCredential).filter(
        models.MfaPasskeyCredential.user_id == user.id
    ).all()
    if not credentials:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No passkeys registered.")

    options = generate_authentication_options(
        rp_id=_get_webauthn_rp_id(request),
        user_verification=UserVerificationRequirement.REQUIRED,
    )
    options_json = options_to_json(options)
    options_data = json.loads(options_json)
    _store_passkey_challenge(user, options_data.get("challenge", ""))
    db.commit()
    return options_data


@app.post("/mfa/passkey/verify", tags=["auth"])
def verify_passkey_authentication(
    payload: schemas.MfaPasskeyVerify,
    request: Request,
    db: Session = Depends(database.get_db),
):
    user = _get_mfa_user_from_token(payload.mfa_token, db)
    if not user.mfa_passkey_enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passkey is not enabled.")
    credential_id = payload.credential.get("id")
    if not credential_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passkey credential id missing.")
    credential = db.query(models.MfaPasskeyCredential).filter(
        models.MfaPasskeyCredential.user_id == user.id,
        models.MfaPasskeyCredential.credential_id == credential_id,
    ).first()
    if not credential:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passkey not found.")

    challenge = _require_passkey_challenge(user)
    try:
        verification = verify_authentication_response(
            credential=payload.credential,
            expected_challenge=base64url_to_bytes(challenge),
            expected_rp_id=_get_webauthn_rp_id(),
            expected_origin=_get_webauthn_origin(),
            credential_public_key=base64url_to_bytes(credential.credential_public_key),
            credential_current_sign_count=credential.sign_count or 0,
            require_user_verification=True,
        )
    except Exception as exc:
        logger.warning("Passkey authentication failed", exc_info=exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passkey authentication failed.")

    credential.sign_count = verification.new_sign_count
    credential.device_type = str(verification.credential_device_type)
    credential.backed_up = bool(verification.credential_backed_up)
    credential.last_used_at = datetime.now(timezone.utc)
    user.mfa_passkey_challenge = None
    user.mfa_passkey_challenge_expires_at = None
    db.commit()

    device_token = None
    if payload.remember_device:
        raw_token = secrets.token_urlsafe(32)
        token_hash = _hash_device_token(raw_token)
        expires_at = datetime.utcnow() + timedelta(days=90)
        db.add(models.MfaTrustedDevice(
            user_id=user.id,
            device_token_hash=token_hash,
            expires_at=expires_at,
            ip_address=_get_client_ip(request),
            user_agent=request.headers.get("user-agent"),
        ))
        db.commit()
        device_token = raw_token

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    response = {
        "access_token": access_token,
        "token_type": "bearer",
        "must_change_password": user.must_change_password
    }
    if device_token:
        response["mfa_device_token"] = device_token
        response["mfa_device_expires_at"] = (datetime.utcnow() + timedelta(days=90)).isoformat()
    return response


@app.get("/mfa/passkey/credentials", response_model=list[schemas.MfaPasskeyCredentialOut], tags=["auth"])
def list_passkey_credentials(
    current_user: schemas.UserOut = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    credentials = db.query(models.MfaPasskeyCredential).filter(
        models.MfaPasskeyCredential.user_id == current_user.id
    ).order_by(models.MfaPasskeyCredential.created_at.desc()).all()
    return [
        schemas.MfaPasskeyCredentialOut(
            id=cred.id,
            label=cred.label,
            created_at=cred.created_at,
            last_used_at=cred.last_used_at,
            device_type=cred.device_type,
            backed_up=cred.backed_up,
            transports=cred.transports,
        )
        for cred in credentials
    ]


@app.patch("/mfa/passkey/credentials/{credential_id}", response_model=schemas.MfaPasskeyCredentialOut, tags=["auth"])
def update_passkey_credential(
    credential_id: int,
    payload: schemas.MfaPasskeyCredentialUpdate,
    current_user: schemas.UserOut = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    credential = db.query(models.MfaPasskeyCredential).filter(
        models.MfaPasskeyCredential.id == credential_id,
        models.MfaPasskeyCredential.user_id == current_user.id,
    ).first()
    if not credential:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Passkey not found.")
    credential.label = payload.label
    db.commit()
    db.refresh(credential)
    return schemas.MfaPasskeyCredentialOut(
        id=credential.id,
        label=credential.label,
        created_at=credential.created_at,
        last_used_at=credential.last_used_at,
        device_type=credential.device_type,
        backed_up=credential.backed_up,
        transports=credential.transports,
    )


@app.delete("/mfa/passkey/credentials/{credential_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["auth"])
def delete_passkey_credential(
    credential_id: int,
    current_user: schemas.UserOut = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    credential = db.query(models.MfaPasskeyCredential).filter(
        models.MfaPasskeyCredential.id == credential_id,
        models.MfaPasskeyCredential.user_id == current_user.id,
    ).first()
    if not credential:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Passkey not found.")
    db.delete(credential)
    db.commit()
    remaining = db.query(models.MfaPasskeyCredential).filter(
        models.MfaPasskeyCredential.user_id == current_user.id
    ).count()
    if remaining == 0:
        user = db.query(models.User).filter(models.User.id == current_user.id).first()
        if user:
            user.mfa_passkey_enabled = False
            db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post("/mfa/request-otp", tags=["auth"])
def request_mfa_otp(
    payload: schemas.MfaRequestOtp,
    request: Request,
    db: Session = Depends(database.get_db),
):
    user = _get_mfa_user_from_token(payload.mfa_token, db)
    method = (payload.method or "").strip().lower()
    if method != "email":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only email OTP is supported.")
    if not user.mfa_email_enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email OTP is not enabled.")

    destination = _get_mfa_destination(user, method)
    _enforce_mfa_rate_limit(db, user, destination, method)

    code = _generate_otp()
    code_hash = _hash_otp(code)
    expires_at = datetime.utcnow() + timedelta(minutes=settings.MFA_OTP_TTL_MINUTES)
    ip_address = _get_client_ip(request)

    subject = f"Your {settings.APP_NAME} verification code"
    body = f"Your verification code is {code}. It expires in {settings.MFA_OTP_TTL_MINUTES} minutes."
    sent = send_email(destination, subject, body)

    if not sent:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to send OTP.")

    db.add(models.MfaOtpLog(
        user_id=user.id,
        method=method,
        destination=destination,
        code_hash=code_hash,
        expires_at=expires_at,
        ip_address=ip_address,
    ))
    db.commit()
    return {
        "ok": True,
        "expires_in": settings.MFA_OTP_TTL_MINUTES * 60,
        "destination": _mask_email(destination),
    }


@app.post("/mfa/verify-otp", tags=["auth"])
def verify_mfa_otp(
    payload: schemas.MfaVerifyOtp,
    request: Request,
    db: Session = Depends(database.get_db),
):
    user = _get_mfa_user_from_token(payload.mfa_token, db)
    method = (payload.method or "").strip().lower()
    destination = _get_mfa_destination(user, method)

    log_entry = db.query(models.MfaOtpLog).filter(
        models.MfaOtpLog.user_id == user.id,
        models.MfaOtpLog.method == method,
        models.MfaOtpLog.destination == destination,
        models.MfaOtpLog.expires_at >= datetime.utcnow(),
        models.MfaOtpLog.verified_at.is_(None),
    ).order_by(models.MfaOtpLog.created_at.desc()).first()

    if not log_entry:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP is invalid or expired.")

    if log_entry.attempt_count >= settings.MFA_OTP_MAX_ATTEMPTS:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many attempts. Request a new code.")

    if _hash_otp(payload.code.strip()) != log_entry.code_hash:
        log_entry.attempt_count += 1
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP is invalid.")

    log_entry.verified_at = datetime.utcnow()
    db.commit()

    device_token = None
    if payload.remember_device:
        raw_token = secrets.token_urlsafe(32)
        token_hash = _hash_device_token(raw_token)
        expires_at = datetime.utcnow() + timedelta(days=90)
        db.add(models.MfaTrustedDevice(
            user_id=user.id,
            device_token_hash=token_hash,
            expires_at=expires_at,
            ip_address=_get_client_ip(request),
            user_agent=request.headers.get("user-agent"),
        ))
        db.commit()
        device_token = raw_token

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    response = {
        "access_token": access_token,
        "token_type": "bearer",
        "must_change_password": user.must_change_password
    }
    if device_token:
        response["mfa_device_token"] = device_token
        response["mfa_device_expires_at"] = (datetime.utcnow() + timedelta(days=90)).isoformat()
    return response

@app.post("/users/", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED, tags=["users"])
def create_user(user: schemas.UserCreate, db: Session = Depends(database.get_db), background_tasks: BackgroundTasks = BackgroundTasks()):
    """
    Registers a new user in the database and initializes their settings with global defaults if available.
    Email is optional - if provided, it must be unique.
    """
    # Check if email is provided and if it's already registered
    if user.email:
        db_user = db.query(models.User).filter(
            (models.User.email == user.email)
        ).first()
        
        if db_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
    try:
        hashed_password = auth.get_password_hash(user.password)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password did not meet requirements: {e}"
        )
    
    # Check if this user was referred by someone
    # First, check if there's a pending referral for this email
    pending_referral = db.query(models.Referral).filter(
        models.Referral.friend_email == user.email.lower(),
        models.Referral.registered_user_id.is_(None)
    ).first()
    
    referred_by_id = None
    if pending_referral:
        # Use the referrer from the pending referral
        referred_by_id = pending_referral.referrer_id
    elif user.referred_by_email:
        # User explicitly provided a referral email
        referrer = db.query(models.User).filter(models.User.email == user.referred_by_email).first()
        if referrer:
            referred_by_id = referrer.id
    
    db_user = models.User(
        email=user.email if user.email else None,
        hashed_password=hashed_password,
        is_active=True,
        is_confirmed=False,
        must_change_password=False,  # Regular signups don't require password change
        referred_by_id=referred_by_id
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Now update the referral record with the new user ID if it exists
    if pending_referral:
        pending_referral.registered_user_id = db_user.id
        pending_referral.registered_at = datetime.now()
        db.commit()
    
    # Link any pending authorized user entries for this email
    pending_authorized_users = db.query(models.AuthorizedUser).filter(
        models.AuthorizedUser.authorized_user_email == user.email.lower(),
        models.AuthorizedUser.authorized_user_id.is_(None)
    ).all()
    
    for auth_entry in pending_authorized_users:
        auth_entry.authorized_user_id = db_user.id
    db.commit()
    
    # Initialize UserSettings with global defaults if available, otherwise use schema defaults
    global_settings = db.query(models.GlobalSettings).first()
    if global_settings:
        user_settings = models.UserSettings(
            owner_id=db_user.id,
            asset_categories=global_settings.asset_categories,
            liability_categories=global_settings.liability_categories,
            income_categories=global_settings.income_categories,
            expense_categories=global_settings.expense_categories,
            default_inflation_percent=schemas.UserSettingsBase.model_fields['default_inflation_percent'].default,
            person1_first_name=schemas.UserSettingsBase.model_fields['person1_first_name'].default,
            person1_last_name=schemas.UserSettingsBase.model_fields['person1_last_name'].default,
            person1_birthdate=schemas.UserSettingsBase.model_fields['person1_birthdate'].default,
            person1_cell_phone=schemas.UserSettingsBase.model_fields['person1_cell_phone'].default,
            person2_first_name=schemas.UserSettingsBase.model_fields['person2_first_name'].default,
            person2_last_name=schemas.UserSettingsBase.model_fields['person2_last_name'].default,
            person2_birthdate=schemas.UserSettingsBase.model_fields['person2_birthdate'].default,
            person2_cell_phone=schemas.UserSettingsBase.model_fields['person2_cell_phone'].default,
            address=schemas.UserSettingsBase.model_fields['address'].default,
            city=schemas.UserSettingsBase.model_fields['city'].default,
            state=schemas.UserSettingsBase.model_fields['state'].default,
            zip_code=schemas.UserSettingsBase.model_fields['zip_code'].default,
            projection_years=schemas.UserSettingsBase.model_fields['projection_years'].default,
            show_chart_totals=schemas.UserSettingsBase.model_fields['show_chart_totals'].default,
        )
    else:
        user_settings = models.UserSettings(owner_id=db_user.id)
    
    db.add(user_settings)
    db.commit()
    db.refresh(user_settings)

    ensure_system_default_document_types(db)
    seed_default_document_types(db, db_user.id)

    # Only send confirmation email if user has an email address
    if db_user.email:
        confirmation_token = auth.create_email_confirmation_token(db, db_user.id)
        confirmation_link = f"{settings.FRONTEND_URL}/confirm-email?token={confirmation_token}"
        background_tasks.add_task(send_email, 
            to_email=db_user.email,
            subject="Financial Projector - Confirm Your Email",
            body=f"""Hello {db_user.email},

Thank you for registering with Financial Projector!

Please click the link below to confirm your email address:
{confirmation_link}

This link will expire in 24 hours.

Best regards,
The Financial Projector Team"""
        )
    
    return db_user

@app.delete("/admin/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["admin"])
def delete_user_by_admin(
    user_id: int,
    db: Session = Depends(database.get_db),
    current_admin_user: schemas.UserOut = Depends(auth.get_current_admin_user)
):
    """
    Allows an admin user to delete another user and all their associated data.
    """
    if user_id == current_admin_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin user cannot delete their own account.")

    user_to_delete = db.query(models.User).filter(models.User.id == user_id).first()

    if not user_to_delete:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    try:
        # Delete the user - database-level CASCADE will handle related records
        db.delete(user_to_delete)
        db.commit()
        
        # Verify the user was actually deleted
        verify_deleted = db.query(models.User).filter(models.User.id == user_id).first()
        if verify_deleted:
            logger.error(f"User {user_id} was not deleted from database after commit")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete user from database."
            )
        
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting user {user_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete user: {str(e)}"
        )

@app.get("/admin/users", response_model=list[schemas.UserOut], tags=["admin"])
def list_all_manageable_users(
    db: Session = Depends(database.get_db),
    current_admin_user: schemas.UserOut = Depends(auth.get_current_admin_user)
):
    """
    Allows an an admin user to retrieve a list of all other users.
    """
    users = db.query(models.User).filter(models.User.id != current_admin_user.id).all()
    return [schemas.UserOut.model_validate(user) for user in users]

@app.post("/admin/users", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED, tags=["admin"])
def admin_create_user(
    user: schemas.AdminUserCreate,
    db: Session = Depends(database.get_db),
    current_admin_user: schemas.UserOut = Depends(auth.get_current_admin_user)
):
    """
    Allows an admin to create a new user with optional email and password change requirement.
    """
    # Check if email is provided and if it's already registered
    if user.email:
        existing_user = db.query(models.User).filter(
            models.User.email == user.email
        ).first()
        
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email/username already registered"
            )
    
    try:
        hashed_password = auth.get_password_hash(user.password)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password did not meet requirements: {e}"
        )
    
    db_user = models.User(
        email=user.email if user.email else None,
        hashed_password=hashed_password,
        is_active=True,
        is_confirmed=True,  # Admin-created users are auto-confirmed
        must_change_password=user.must_change_password,
        referred_by_id=None,
        subscription_level=user.subscription_level
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Initialize UserSettings with global defaults if available
    global_settings = db.query(models.GlobalSettings).first()
    if global_settings:
        user_settings = models.UserSettings(
            owner_id=db_user.id,
            asset_categories=global_settings.asset_categories,
            liability_categories=global_settings.liability_categories,
            income_categories=global_settings.income_categories,
            expense_categories=global_settings.expense_categories,
            default_inflation_percent=schemas.UserSettingsBase.model_fields['default_inflation_percent'].default,
            person1_first_name=schemas.UserSettingsBase.model_fields['person1_first_name'].default,
            person1_last_name=schemas.UserSettingsBase.model_fields['person1_last_name'].default,
            person1_birthdate=schemas.UserSettingsBase.model_fields['person1_birthdate'].default,
            person1_cell_phone=schemas.UserSettingsBase.model_fields['person1_cell_phone'].default,
            person2_first_name=schemas.UserSettingsBase.model_fields['person2_first_name'].default,
            person2_last_name=schemas.UserSettingsBase.model_fields['person2_last_name'].default,
            person2_birthdate=schemas.UserSettingsBase.model_fields['person2_birthdate'].default,
            person2_cell_phone=schemas.UserSettingsBase.model_fields['person2_cell_phone'].default,
            address=schemas.UserSettingsBase.model_fields['address'].default,
            city=schemas.UserSettingsBase.model_fields['city'].default,
            state=schemas.UserSettingsBase.model_fields['state'].default,
            zip_code=schemas.UserSettingsBase.model_fields['zip_code'].default,
            projection_years=schemas.UserSettingsBase.model_fields['projection_years'].default,
            show_chart_totals=schemas.UserSettingsBase.model_fields['show_chart_totals'].default,
        )
    else:
        user_settings = models.UserSettings(owner_id=db_user.id)
    
    db.add(user_settings)
    db.commit()
    db.refresh(user_settings)

    ensure_system_default_document_types(db)
    seed_default_document_types(db, db_user.id)
    
    return db_user

@app.put("/admin/users/{user_id}/set-admin-status", response_model=schemas.UserOut, tags=["admin"])
def set_user_admin_status(
    user_id: int,
    status_update: schemas.UserAdminStatusUpdate,
    db: Session = Depends(database.get_db),
    current_admin_user: schemas.UserOut = Depends(auth.get_current_admin_user)
):
    """
    Allows an admin user to change another user's admin status.
    """
    if user_id == current_admin_user.id and not status_update.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin user cannot revoke their own admin status."
        )

    user_to_update = db.query(models.User).filter(models.User.id == user_id).first()
    if not user_to_update:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    user_to_update.is_admin = status_update.is_admin
    if status_update.subscription_level is not None:
        user_to_update.subscription_level = status_update.subscription_level
    db.commit()
    db.refresh(user_to_update)
    return user_to_update

# --- GLOBAL SETTINGS ENDPOINTS (Admin Only) ---
@admin_router.get("/global-settings", response_model=schemas.GlobalSettingsOut, tags=["admin"], summary="Get global default categories")
def get_global_settings(
    db: Session = Depends(database.get_db),
    current_admin_user: schemas.UserOut = Depends(auth.get_current_admin_user) # Ensures admin access
):
    """
    Retrieves the global default categories. Creates default if none exist.
    """
    global_settings = db.query(models.GlobalSettings).first()
    if not global_settings:
        # Create default global settings if they don't exist
        global_settings = models.GlobalSettings(
            help_content="<h1>Welcome to the Help Page!</h1><p>This is a placeholder for help content. Administrators can edit this content.</p>",
            default_document_folders=deepcopy(DEFAULT_DOCUMENT_FOLDER_STRUCTURE),
        ) # Initialize with default content
        db.add(global_settings)
        db.commit()
        db.refresh(global_settings)
    return global_settings

@admin_router.put("/global-settings", response_model=schemas.GlobalSettingsOut, tags=["admin"], summary="Update global default categories")
def update_global_settings(
    payload: schemas.GlobalSettingsUpdate,
    db: Session = Depends(database.get_db),
    current_admin_user: schemas.UserOut = Depends(auth.get_current_admin_user) # Ensures admin access
):
    """
    Updates the global default categories. Creates default if none exist.
    """
    global_settings = db.query(models.GlobalSettings).first()
    if not global_settings:
        global_settings = models.GlobalSettings(default_document_folders=deepcopy(DEFAULT_DOCUMENT_FOLDER_STRUCTURE))
        db.add(global_settings)
        db.commit()
        db.refresh(global_settings)
    
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(global_settings, key, value)
    
    db.commit()
    db.refresh(global_settings)
    return global_settings

app.include_router(admin_router, prefix="/admin")

# Public endpoint for reading help/about content (requires authentication, not admin)
@app.get("/content/help-about", response_model=schemas.PublicContentResponse, tags=["content"], summary="Get help and about content (public read)")
def get_help_about_content(
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)  # Requires authentication, not admin
):
    """
    Retrieves help and about content. Accessible by any authenticated user.
    """
    global_settings = db.query(models.GlobalSettings).first()
    if not global_settings:
        # Return default content if global settings don't exist
        return schemas.PublicContentResponse(
            help_content="<h1>Welcome to the Help Page!</h1><p>This is a placeholder for help content. Administrators can edit this content.</p>",
            about_content="<h1>About</h1><p>This is a placeholder for about content. Administrators can edit this content.</p>"
        )
    return schemas.PublicContentResponse(
        help_content=global_settings.help_content,
        about_content=global_settings.about_content
    )

@app.post("/categories/check-usage", response_model=bool, tags=["categories"])
def check_category_usage(
    category_check: schemas.CategoryUsageCheck,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Checks if a category is currently in use by any assets, liabilities, or cash flow items.
    """
    category_name = category_check.category_name
    category_type = category_check.category_type.lower()
    user_id = current_user.id

    is_in_use = False

    if category_type == "asset":
        asset_count = db.query(models.Asset).filter(
            models.Asset.owner_id == user_id,
            models.Asset.category == category_name
        ).count()
        if asset_count > 0:
            is_in_use = True
    elif category_type == "liability":
        liability_count = db.query(models.Liability).filter(
            models.Liability.owner_id == user_id,
            models.Liability.category == category_name
        ).count()
        if liability_count > 0:
            is_in_use = True
    elif category_type == "income":
        cashflow_income_count = db.query(models.CashFlowItem).filter(
            models.CashFlowItem.owner_id == user_id,
            models.CashFlowItem.category == category_name,
            models.CashFlowItem.is_income == True
        ).count()
        if cashflow_income_count > 0:
            is_in_use = True
    elif category_type == "expense":
        cashflow_expense_count = db.query(models.CashFlowItem).filter(
            models.CashFlowItem.owner_id == user_id,
            models.CashFlowItem.category == category_name,
            models.CashFlowItem.is_income == False
        ).count()
        if cashflow_expense_count > 0:
            is_in_use = True

    return is_in_use

@app.put("/users/me/password", response_model=schemas.UserOut, tags=["users"])
def change_password(
    payload: schemas.ChangePasswordRequest,
    current_user: schemas.UserOut = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    """Allows an authenticated user to change their password."""
    updated_user = auth.change_user_password(
        db=db,
        user_id=current_user.id,
        current_password=payload.current_password,
        new_password=payload.new_password
    )
    return updated_user

@app.post("/stripe/webhook", status_code=status.HTTP_200_OK, tags=["billing"])
async def stripe_webhook(
    request: Request,
    db: Session = Depends(database.get_db),
):
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Webhook secret is not configured.")
    payload = await request.body()
    signature = request.headers.get("stripe-signature")
    if not signature:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing Stripe signature header.")
    try:
        event = stripe.Webhook.construct_event(payload, signature, settings.STRIPE_WEBHOOK_SECRET)
    except (ValueError, stripe.error.SignatureVerificationError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Stripe webhook payload.")

    event_type = event.get("type")
    if event_type == "checkout.session.completed":
        _apply_stripe_session(event["data"]["object"], db)
    elif event_type == "invoice.payment_succeeded" and event["data"]["object"].get("checkout_session"):
        _apply_stripe_session(event["data"]["object"]["checkout_session"], db)

    return {"status": "ok"}

def _apply_stripe_session(session_obj: dict, db: Session):
    metadata = session_obj.get("metadata") or {}
    metadata_user = metadata.get("user_id")
    user = None
    if metadata_user:
        try:
            user = db.query(models.User).filter(models.User.id == int(metadata_user)).first()
        except (TypeError, ValueError):
            user = None
    if not user:
        return

    user.stripe_subscription_id = session_obj.get("subscription") or session_obj.get("id")
    user.stripe_customer_id = session_obj.get("customer")
    tier = metadata.get("tier")
    if tier:
        user.subscription_level = _stripe_tier_to_level(tier)
    db.commit()

@app.post("/forgot-password", status_code=status.HTTP_200_OK, tags=["auth"])
def forgot_password(
    payload: schemas.PasswordResetRequest,
    db: Session = Depends(database.get_db)
):
    """Handles the request to initiate a password reset. Sends a reset email if the user exists."""
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if user:
        token = auth.create_password_reset_token(db, user.id)
        reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        send_email(
            to_email=user.email,
            subject="Financial Projector - Password Reset Request",
            body=f"""Hello,

You have requested a password reset for your Financial Projector account.

Please use the following link to reset your password: {reset_link}

This link will expire in 1 hour.

If you did not request a password reset, please ignore this email.

Best regards,
The Financial Projector Team"""
        )
    
    return {"message": "If an account with that email exists, a password reset link has been sent."}

@app.post("/reset-password", response_model=schemas.UserOut, tags=["auth"])
def reset_password(
    payload: schemas.PasswordReset,
    db: Session = Depends(database.get_db)
):
    """Resets the user's password using a valid reset token."""
    try:
        updated_user = auth.reset_user_password(
            db=db,
            token=payload.token,
            new_password=payload.new_password
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"New password did not meet requirements: {e}"
        )
    except HTTPException as e:
        raise e
    return updated_user

@app.post("/verify-email", response_model=schemas.UserOut, tags=["auth"])
def verify_email(
    payload: schemas.EmailConfirmation,
    db: Session = Depends(database.get_db)
):
    """Verifies a user's email address using a confirmation token."""
    try:
        confirmed_user = auth.verify_email_confirmation_token(db, payload.token)
    except HTTPException as e:
        raise e
    return confirmed_user


def _get_user_from_header(auth_header: str | None, db: Session):
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return None
    try:
        payload = auth.decode_token(token)
        user_id = payload.get("sub")
    except InvalidTokenError:
        return None
    if user_id:
        try:
            return db.query(models.User).filter(models.User.id == int(user_id)).first()
        except (TypeError, ValueError):
            return None
    return None


def _get_client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip() or None
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip() or None
    return request.client.host if request.client else None


@app.post("/contact", status_code=status.HTTP_200_OK, tags=["public"])
def contact_us(
    payload: schemas.ContactRequest,
    request: Request,
    authorization: str | None = Header(default=None),
    db: Session = Depends(database.get_db)
):
    contact_map = {
        "question": "ask@modelmyretirement.com",
        "feature": "newfeature@modelmyretirement.com",
        "bug": "bug@modelmyretirement.com",
        "support": "support@modelmyretirement.com",
    }
    contact_type = (payload.contact_type or "").strip().lower()
    recipient = contact_map.get(contact_type)
    if not recipient:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid contact type.")

    user = _get_user_from_header(authorization, db)
    rate_limit = settings.CONTACT_RATE_LIMIT_PER_HOUR
    if rate_limit > 0:
        window_start = datetime.utcnow() - timedelta(hours=1)
        query = db.query(models.ContactRequestLog).filter(
            models.ContactRequestLog.created_at >= window_start
        )
        if user:
            query = query.filter(models.ContactRequestLog.user_id == user.id)
        else:
            query = query.filter(models.ContactRequestLog.email == payload.email)
        recent_count = query.count()
        if recent_count >= rate_limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many contact requests. Please try again later."
            )

    ip_address = _get_client_ip(request)
    subject = payload.subject.strip() if payload.subject else f"{payload.contact_type.title()} - Model My Retirement"
    body = f"""Name: {payload.name}
Email: {payload.email}
Type: {payload.contact_type}
User ID: {user.id if user else "N/A"}
IP: {ip_address or "N/A"}

{payload.message}
"""
    sent = send_email(recipient, subject, body)
    if not sent:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Email service unavailable.")

    db.add(models.ContactRequestLog(
        user_id=user.id if user else None,
        contact_type=payload.contact_type,
        name=payload.name,
        email=payload.email,
        subject=payload.subject,
        message=payload.message,
        ip_address=ip_address
    ))
    db.commit()
    return {"ok": True}
    contact_type = (payload.contact_type or "").strip().lower()
    recipient = contact_map.get(contact_type)
    if not recipient:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid contact type.")

    subject = payload.subject.strip() if payload.subject else f"{payload.contact_type.title()} - Model My Retirement"
    body = f"""Name: {payload.name}
Email: {payload.email}
Type: {payload.contact_type}

{payload.message}
"""
    sent = send_email(recipient, subject, body)
    if not sent:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Email service unavailable.")
    return {"ok": True}

def is_projection_stale(db: Session, projection: models.Projection, user_id: int) -> bool:
    """
    Check if a projection needs recalculation based on underlying data changes.
    Returns True if projection is stale and needs recalculation.
    """
    if not projection.last_calculated_at:
        return True  # Stale if never calculated
    
    # Get the latest modification time from all underlying data
    from sqlalchemy import func as sql_func
    
    # Get max updated_at from assets, liabilities, and cash flow items
    max_asset_update = db.query(sql_func.max(models.Asset.updated_at)).filter(
        models.Asset.owner_id == user_id
    ).scalar()
    
    max_liability_update = db.query(sql_func.max(models.Liability.updated_at)).filter(
        models.Liability.owner_id == user_id
    ).scalar()
    
    max_cashflow_update = db.query(sql_func.max(models.CashFlowItem.updated_at)).filter(
        models.CashFlowItem.owner_id == user_id
    ).scalar()
    
    # Also check auto-disbursements (they might not have updated_at, use created_at instead)
    try:
        if hasattr(models.AutoDisbursement, 'updated_at'):
            max_disbursement_update = db.query(sql_func.max(models.AutoDisbursement.updated_at)).filter(
                models.AutoDisbursement.owner_id == user_id
            ).scalar()
        elif hasattr(models.AutoDisbursement, 'created_at'):
            max_disbursement_update = db.query(sql_func.max(models.AutoDisbursement.created_at)).filter(
                models.AutoDisbursement.owner_id == user_id
            ).scalar()
        else:
            max_disbursement_update = None
    except Exception:
        max_disbursement_update = None
    
    # Find the latest data change (handle case where all might be None)
    dates_list = [date for date in [max_asset_update, max_liability_update, max_cashflow_update, max_disbursement_update] if date is not None]
    
    if not dates_list:
        # No data exists yet, so projection is not stale
        return False
    
    latest_data_change = max(dates_list)
    
    # Projection is stale if underlying data was modified after last calculation
    if latest_data_change:
        # Convert to timezone-aware datetime for comparison
        if projection.last_calculated_at.tzinfo is None:
            from datetime import timezone
            last_calculated = projection.last_calculated_at.replace(tzinfo=timezone.utc)
        else:
            last_calculated = projection.last_calculated_at
            
        if latest_data_change.tzinfo is None:
            from datetime import timezone
            latest_data_change = latest_data_change.replace(tzinfo=timezone.utc)
        
        return latest_data_change > last_calculated
    
    return False  # Not stale if no data changes


def rebuild_projection_from_stored_data(db: Session, projection: models.Projection, user_id: int) -> dict:
    """
    Rebuild projection data from stored accounts_data to recalculate.
    This extracts the ProjectedAccountCreate schemas from stored ProjectedAccount models.
    Note: For Balance Sheet Projections, this won't include auto-included items,
    but the stored accounts_data should contain all relevant accounts.
    """
    accounts_for_recalculation = []
    
    # Check if we have accounts_data to rebuild from
    if not projection.accounts_data or len(projection.accounts_data) == 0:
        raise ValueError(f"Cannot rebuild projection {projection.id}: no accounts_data stored. Projection may need to be recreated.")
    
    # Convert stored ProjectedAccount models back to ProjectedAccountCreate schemas
    for stored_account in projection.accounts_data:
        # Reconstruct ProjectedAccountCreate from stored data
        account_schema = schemas.ProjectedAccountCreate(
            name=stored_account.name,
            account_type=stored_account.account_type,
            initial_value=stored_account.initial_value,
            contribution=stored_account.contribution,
            growth_rate=stored_account.growth_rate,
            loan_type=stored_account.loan_type,
            principal_amount=stored_account.principal_amount,
            interest_rate=stored_account.interest_rate,
            loan_term_months=stored_account.loan_term_months,
            loan_start_date=stored_account.loan_start_date,
            monthly_payment=stored_account.monthly_payment,
            start_date=stored_account.start_date,
            end_date=stored_account.end_date
        )
        accounts_for_recalculation.append(account_schema)
    
    # Recalculate projection with stored accounts
    # Note: The calculation function will auto-include additional items (income/expenses/auto-disbursements) as needed
    user = db.query(models.User).filter(models.User.id == user_id).first()
    limits = get_user_limits(db, user) if user else {"is_limited": False}
    years = projection.years
    if limits.get("is_limited") and limits.get("max_projection_years") is not None:
        years = min(years, limits["max_projection_years"])

    result = calculations.calculate_projection(
        years=years,
        accounts=accounts_for_recalculation,
        db=db,
        owner_id=user_id
    )
    
    return result


@app.post("/projections", response_model=schemas.ProjectionResponse, status_code=status.HTTP_201_CREATED, tags=["projections"])
def create_projection(
    projection_data: schemas.ProjectionRequest,
    user: schemas.UserOut = Depends(auth.get_current_user), 
    db: Session = Depends(database.get_db)
):
    """
    Creates a new projection, runs the calculation, and saves the results to the database."""
    require_subscription_level(user, 2, "Creating projections")
    limits = get_user_limits(db, user)
    if limits["is_limited"] and limits["max_projection_years"] is not None and projection_data.years > limits["max_projection_years"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Free plan supports up to {limits['max_projection_years']} projection years."
        )

    try:
        projection_results = calculations.calculate_projection(
            years=projection_data.years,
            accounts=projection_data.accounts,
            db=db,
            owner_id=user.id
        )
    except Exception as e:
        logger.error(f"Error during projection calculation for user {user.id}: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))

    db_projection = models.Projection(
        owner_id=user.id,
        name=projection_data.plan_name,
        years=projection_data.years,
        final_value=projection_results["final_value"],
        total_contributed=projection_results["total_contributed"],
        total_growth=projection_results["total_growth"],
        data_json=projection_results.get("data_json"),  # Store data_json in database for fast retrieval
        last_calculated_at=datetime.utcnow()  # Track when projection was calculated
    )
    db.add(db_projection)
    db.commit()
    db.refresh(db_projection)

    # Associate projected accounts and time series data with the new projection
    for acc in projection_results["projected_accounts"]:
        acc.projection_id = db_projection.id
        db.add(acc)

    db.commit()
    db.refresh(db_projection) # Refresh to load relationships

    # Construct response with data_json from calculations
    return schemas.ProjectionResponse(
        id=db_projection.id,
        name=db_projection.name,
        years=db_projection.years,
        final_value=db_projection.final_value,
        total_contributed=db_projection.total_contributed,
        total_growth=db_projection.total_growth,
        timestamp=db_projection.timestamp,
        accounts_data=[schemas.ProjectedAccountOut.model_validate(acc) for acc in projection_results["projected_accounts"]],
        time_series_data=[],  # Excluded to save memory - use data_json instead
        data_json=projection_results.get("data_json")  # Include data_json from calculations
    )

@app.get("/projections/{projection_id}", response_model=schemas.ProjectionDetailOut, tags=["projections"])
def get_projection_details(
    projection_id: int, 
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Retrieves a single projection if the user has view permission."""
    
    projection = (
        db.query(models.Projection)
        .options(joinedload(models.Projection.accounts_data))
        .filter(models.Projection.id == projection_id)
        .first()
    )
    
    if not projection:
        raise HTTPException(status_code=404, detail="Projection not found")
    
    # Check view permission
    has_permission = check_permission(
        db=db,
        current_user_id=current_user.id,
        primary_user_id=projection.owner_id,
        permission_type="projections",
        required_permission="view"
    )
    
    if not has_permission:
        raise HTTPException(status_code=403, detail="You do not have permission to view this projection")
    
    # Auto-recalculate if projection is stale (transparent to user)
    # Only auto-recalculate if we have accounts_data to rebuild from
    try:
        if is_projection_stale(db, projection, current_user.id) and projection.accounts_data and len(projection.accounts_data) > 0:
            try:
                # Rebuild projection from stored accounts_data
                result = rebuild_projection_from_stored_data(db, projection, current_user.id)
                
                # Update projection with new results
                projection.final_value = result["final_value"]
                projection.total_contributed = result["total_contributed"]
                projection.total_growth = result["total_growth"]
                projection.data_json = result.get("data_json")
                projection.last_calculated_at = datetime.utcnow()
                projection.timestamp = datetime.utcnow()
                
                # Delete old accounts
                db.query(models.ProjectedAccount).filter(
                    models.ProjectedAccount.projection_id == projection_id
                ).delete()
                
                # Add new data
                for acc in result["projected_accounts"]:
                    acc.projection_id = projection.id
                    db.add(acc)
                
                db.commit()
                db.refresh(projection)
            except Exception as e:
                logger.error(f"Error auto-recalculating projection {projection_id}: {e}", exc_info=True)
                # Continue with stale data rather than failing
                db.rollback()
    except Exception as e:
        logger.error(f"Error checking if projection {projection_id} is stale: {e}", exc_info=True)
        # Continue without auto-recalculation
    
    # Return response without time_series_data to save memory
    # data_json is read directly from database (stored during calculation)
    return schemas.ProjectionDetailOut(
        id=projection.id,
        name=projection.name,
        years=projection.years,
        final_value=projection.final_value,
        total_contributed=projection.total_contributed,
        total_growth=projection.total_growth,
        timestamp=projection.timestamp,
        accounts_data=[schemas.ProjectedAccountOut.model_validate(acc) for acc in projection.accounts_data],
        time_series_data=[],  # Excluded to save memory - use data_json instead
        data_json=projection.data_json  # Read directly from database
    )

@app.get("/projections", response_model=List[schemas.ProjectionOut], tags=["projections"])
def list_projections(
    db: Session = Depends(database.get_db), 
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Lists all projections the current user can access (own or authorized)."""
    
    # Get accessible user IDs (own + authorized)
    accessible_user_ids = get_accessible_user_ids(db, current_user.id, "projections")
    
    # Only load basic projection data for the list view, details will be fetched by get_projection_details
    projections = db.query(models.Projection).filter(
        models.Projection.owner_id.in_(accessible_user_ids)
    ).all()
    
    return projections

@app.put("/projections/{projection_id}", response_model=schemas.ProjectionDetailOut, tags=["projections"])
def update_projection(
    projection_id: int,
    req: schemas.ProjectionRequest,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Updates an existing projection if user has edit permission."""
    projection = (
        db.query(models.Projection)
        .options(joinedload(models.Projection.accounts_data))
        .filter(models.Projection.id == projection_id)
        .first()
    )
    
    if not projection:
        raise HTTPException(status_code=404, detail="Projection not found")
    
    # Check edit permission
    has_permission = check_permission(
        db=db,
        current_user_id=current_user.id,
        primary_user_id=projection.owner_id,
        permission_type="projections",
        required_permission="edit"
    )
    
    if not has_permission:
        raise HTTPException(status_code=403, detail="You do not have permission to edit this projection")
    
    limits = get_user_limits(db, current_user)
    if limits["is_limited"] and limits["max_projection_years"] is not None and req.years > limits["max_projection_years"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Free plan supports up to {limits['max_projection_years']} projection years."
        )

    # Delete existing associated data
    db.query(models.ProjectedAccount).filter(models.ProjectedAccount.projection_id == projection_id).delete()
    db.commit()

    # Recalculate projection
    try:
        result = calculations.calculate_projection(
            years=req.years,
            accounts=req.accounts,
            db=db,
            owner_id=current_user.id
        )
    except Exception as e:
        logger.error(f"Error during projection calculation in update_projection for user {current_user.id}: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Projection calculation failed: {str(e)}")
    
    # Update projection header details
    projection.name = req.plan_name
    projection.years = req.years
    projection.final_value = result["final_value"]
    projection.total_contributed = result["total_contributed"]
    projection.total_growth = result["total_growth"]
    projection.timestamp = datetime.utcnow()
    projection.data_json = result.get("data_json")  # Store data_json in database for fast retrieval
    projection.last_calculated_at = datetime.utcnow()  # Update calculation timestamp
    
    # Add new associated data
    try:
        # Add projected accounts
        for acc in result["projected_accounts"]:
            acc.projection_id = projection.id
            db.add(acc)

        db.commit()
        db.refresh(projection) # Refresh to load relationships
    except Exception as e:
        logger.error(f"Error saving projection data for user {current_user.id}: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save projection data: {str(e)}")
    
    # Construct response with data_json from database (stored during calculation)
    return schemas.ProjectionDetailOut(
        id=projection.id,
        name=projection.name,
        years=projection.years,
        final_value=projection.final_value,
        total_contributed=projection.total_contributed,
        total_growth=projection.total_growth,
        accounts_data=[schemas.ProjectedAccountOut.model_validate(acc) for acc in result["projected_accounts"]],
        time_series_data=[],  # Excluded to save memory - use data_json instead
        data_json=projection.data_json  # Read directly from database (already stored above)
    )

@app.delete("/projections/{projection_id}", status_code=204, tags=["projections"])
def delete_projection(
    projection_id: int,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """Delete a projection (requires edit permission)."""
    projection = db.query(models.Projection).filter(models.Projection.id == projection_id).first()
    if not projection:
        raise HTTPException(status_code=404, detail="Projection not found")
    
    # Check edit permission
    has_permission = check_permission(
        db=db,
        current_user_id=current_user.id,
        primary_user_id=projection.owner_id,
        permission_type="projections",
        required_permission="edit"
    )
    
    if not has_permission:
        raise HTTPException(status_code=403, detail="You do not have permission to delete this projection")
    

    db.delete(projection)
    db.commit()
    return Response(status_code=204)

@app.get("/cashflow", response_model=List[schemas.CashFlowOut], tags=["cashflow"])
def list_cashflow(
    is_income: bool,
    viewing_user_id: Optional[int] = None,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """List all cash flow items the current user can access.
    If viewing_user_id is None, only show the current user's own cash flow items.
    If viewing_user_id is provided, filter to that specific user's items (must be accessible)."""
    
    # Default to only showing current user's cash flow items when viewingUserId is None
    if viewing_user_id is None:
        accessible_user_ids = [current_user.id]
    else:
        # When viewing a specific user, check if they're accessible
        accessible_user_ids = get_accessible_user_ids(db, current_user.id, "items")
        if viewing_user_id not in accessible_user_ids:
            raise HTTPException(status_code=403, detail="You do not have access to view this user's data")
        accessible_user_ids = [viewing_user_id]
    
    cashflow_items = (
        db.query(models.CashFlowItem)
        .filter(models.CashFlowItem.owner_id.in_(accessible_user_ids))
        .filter(models.CashFlowItem.is_income == is_income)
        .order_by(models.CashFlowItem.id.desc())
        .all()
    )
    return cashflow_items

def _calculate_yearly_value_for_cashflow(db: Session, payload: schemas.CashFlowCreate | schemas.CashFlowUpdate):
    if payload.linked_item_id and payload.linked_item_type and payload.percentage is not None:
        linked_value = 0.0
        if payload.linked_item_type == "asset":
            linked_item = db.query(models.Asset).filter(models.Asset.id == payload.linked_item_id).first()
            if linked_item:
                linked_value = linked_item.value
        elif payload.linked_item_type == "income":
            linked_item = db.query(models.CashFlowItem).filter(
                models.CashFlowItem.id == payload.linked_item_id,
                models.CashFlowItem.is_income == True
            ).first()
            if linked_item:
                linked_value = linked_item.yearly_value
        
        return linked_value * (payload.percentage / 100.0) * (12 if payload.frequency == "monthly" else 1)
    else:
        return payload.value * 12 if payload.frequency == "monthly" else payload.value


@app.post("/cashflow", response_model=schemas.CashFlowOut, status_code=201, tags=["cashflow"])
def create_cashflow(
    payload: schemas.CashFlowCreate,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    yearly_value = _calculate_yearly_value_for_cashflow(db, payload)
    
    # Default start_date to January 1 of current year if not provided
    start_date = payload.start_date
    if not start_date:
        current_year = date.today().year
        start_date = f"{current_year}-01-01"
    
    item = models.CashFlowItem(
        owner_id=current_user.id,
        is_income=payload.is_income,
        category=payload.category,
        description=payload.description,
        frequency=payload.frequency,
        yearly_value=yearly_value,
        annual_increase_percent=payload.annual_increase_percent,
        inflation_percent=payload.inflation_percent,
        person=payload.person,
        start_date=start_date,
        end_date=payload.end_date,
        taxable=payload.taxable,
        tax_deductible=payload.taxable,
        is_qualified_dividend=getattr(payload, 'is_qualified_dividend', False),
        linked_item_id=payload.linked_item_id,
        linked_item_type=payload.linked_item_type,
        percentage=payload.percentage,
        linked_asset_ids=payload.linked_asset_ids,
        # For income items with reinvest_dividends=True, use reinvestment_account_id as contributes_to_asset_id
        # For expense items, use contributes_to_asset_id directly
        contributes_to_asset_id=payload.contributes_to_asset_id if not payload.is_income else (
            payload.reinvestment_account_id if (getattr(payload, 'reinvest_dividends', False) and getattr(payload, 'reinvestment_account_id', None)) else payload.contributes_to_asset_id
        ),
        reinvest_dividends=payload.reinvest_dividends if hasattr(payload, 'reinvest_dividends') else False,
        reinvestment_account_id=payload.reinvestment_account_id if hasattr(payload, 'reinvestment_account_id') else None
    )
    
    # Debug logging for dividend reinvestment mapping
    if payload.is_income:
        reinvest_dividends_val = getattr(payload, 'reinvest_dividends', False)
        reinvestment_account_id_val = getattr(payload, 'reinvestment_account_id', None)
    
    db.add(item)
    db.commit()
    db.refresh(item)
    
    # If income is added and calculate_federal_tax is enabled, ensure Federal Tax expense exists
    if payload.is_income:
        user_settings = db.query(models.UserSettings).filter(models.UserSettings.owner_id == current_user.id).first()
        if user_settings and user_settings.calculate_federal_tax:
            FEDERAL_TAX_EXPENSE_DESCRIPTION = "Federal Income Tax (Calculated)"
            federal_tax_expense = db.query(models.CashFlowItem).filter(
                models.CashFlowItem.owner_id == current_user.id,
                models.CashFlowItem.is_income == False,
                models.CashFlowItem.description == FEDERAL_TAX_EXPENSE_DESCRIPTION
            ).first()
            
            if not federal_tax_expense:
                # Ensure "Taxes" category exists in expense_categories, add it if missing
                expense_categories = list(user_settings.expense_categories) if user_settings.expense_categories else []
                taxes_category_modified = False
                if "Taxes" not in expense_categories:
                    expense_categories.append("Taxes")
                    user_settings.expense_categories = expense_categories
                    from sqlalchemy.orm.attributes import flag_modified
                    flag_modified(user_settings, "expense_categories")
                    taxes_category_modified = True
                
                # Create the federal tax expense item
                federal_tax_expense = models.CashFlowItem(
                    owner_id=current_user.id,
                    is_income=False,
                    category="Taxes",
                    description=FEDERAL_TAX_EXPENSE_DESCRIPTION,
                    frequency="yearly",
                    yearly_value=0.0,  # This will be calculated dynamically in projections
                    inflation_percent=0.0,
                    taxable=False,
                    tax_deductible=False
                )
                db.add(federal_tax_expense)
                # Commit both the user_settings update (if modified) and the new federal tax expense
                if taxes_category_modified:
                    db.commit()  # Commit user_settings changes
                else:
                    db.commit()  # Commit federal_tax_expense
    
    return item

@app.put("/cashflow/{item_id}", response_model=schemas.CashFlowOut, tags=["cashflow"])
def update_cashflow(
    item_id: int,
    payload: schemas.CashFlowUpdate,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """Update a cash flow item (requires edit permission)."""
    item = db.query(models.CashFlowItem).filter(models.CashFlowItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Check edit permission
    has_permission = check_permission(
        db=db,
        current_user_id=current_user.id,
        primary_user_id=item.owner_id,
        permission_type="items",
        required_permission="edit"
    )
    
    if not has_permission:
        raise HTTPException(status_code=403, detail="You do not have permission to edit this item")
    
    yearly_value = _calculate_yearly_value_for_cashflow(db, payload)
    
    # Get the update dictionary
    update_dict = payload.model_dump(exclude_unset=True)
    # Default start_date to January 1 of current year if being updated and not provided
    if "start_date" in update_dict and not update_dict["start_date"]:
        current_year = date.today().year
        update_dict["start_date"] = f"{current_year}-01-01"
    
    # For income items with reinvest_dividends=True, map reinvestment_account_id to contributes_to_asset_id
    if item.is_income:
        reinvest_dividends = update_dict.get('reinvest_dividends', item.reinvest_dividends)
        reinvestment_account_id = update_dict.get('reinvestment_account_id', item.reinvestment_account_id)
        
        if reinvest_dividends and reinvestment_account_id:
            # Map reinvestment_account_id to contributes_to_asset_id for income items
            update_dict['contributes_to_asset_id'] = reinvestment_account_id
        elif not reinvest_dividends:
            # If reinvest_dividends is being set to False, clear contributes_to_asset_id
            if 'reinvest_dividends' in update_dict:
                update_dict['contributes_to_asset_id'] = None
    
    for key, value in update_dict.items():
        setattr(item, key, value)
    item.yearly_value = yearly_value # Ensure yearly_value is explicitly set after calculation
    
    db.commit()
    db.refresh(item)
    return item

@app.delete("/cashflow/{item_id}", status_code=204, tags=["cashflow"])
def delete_cashflow(
    item_id: int,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """Delete a cash flow item (requires edit permission)."""
    item = db.query(models.CashFlowItem).filter(models.CashFlowItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Check edit permission
    has_permission = check_permission(
        db=db,
        current_user_id=current_user.id,
        primary_user_id=item.owner_id,
        permission_type="items",
        required_permission="edit"
    )
    
    if not has_permission:
        raise HTTPException(status_code=403, detail="You do not have permission to delete this item")
    

    db.delete(item)
    db.commit()
    return Response(status_code=204)

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    error_traceback = traceback.format_exc()
    logger.error(f"Unhandled exception: {error_traceback}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error. Please check logs for details."},
    )

@app.get("/sentry-debug")
async def trigger_error():
    """
    Intentionally causes a 'ZeroDivisionError' to test Sentry integration.
    """
    division_by_zero = 1 / 0
    return {"message": "If you see this, Sentry didn't catch the error!"}
