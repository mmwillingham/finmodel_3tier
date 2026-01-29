import time
from fastapi import FastAPI, Depends, HTTPException, Response, status, BackgroundTasks, APIRouter, Header
from starlette.requests import Request
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text, func
from datetime import timedelta, datetime, date
from typing import List, Optional, Set
from starlette.responses import RedirectResponse
from utils import google_oauth
from jose import jwt, JWTError
import hashlib
import secrets
import json
import traceback
import os
from fastapi.responses import JSONResponse
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from starlette.types import ASGIApp

# Internal Modules
import models
import schemas
import database
import auth
import calculations

from routers.custom_charts import router as custom_charts_router
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
from utils.email import send_email
from utils.sms import send_sms
from utils.permission_dependencies import get_accessible_user_ids
from utils.permissions import check_permission
from utils.subscription import get_user_limits
from config import settings

logger = logging.getLogger(__name__)

# --- INITIALIZATION ---
app = FastAPI(title="Financial Projector API", version="1.0", _proxy_headers=True, redirect_slashes=False)

@app.get("/health", tags=["Health"])
@app.get("/health/", tags=["Health"])
async def health_check():
    return {"status": "ok", "message": "Backend is warming up the engines!"}

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
    log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    logging.basicConfig(level=logging.WARNING, format=log_format)
    logging.getLogger("uvicorn").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.WARNING)
    logging.getLogger("api.routers.custom_charts").setLevel(logging.WARNING)
    logging.getLogger("api.calculations").setLevel(logging.WARNING)
    logging.getLogger("calculations").setLevel(logging.WARNING)
    logging.getLogger("main").setLevel(logging.WARNING)
    logging.getLogger("auth").setLevel(logging.WARNING)

app.include_router(custom_charts_router)
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

admin_router = APIRouter()

@app.get("/", tags=["health"])
async def root():
    return {"message": "Financial Projector API is running!"}

ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=settings.CORS_ORIGINS_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(
    CacheControlMiddleware,
    public_cache_paths=PUBLIC_CACHE_PATHS,
)

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
        if user.mfa_sms_enabled and user.mfa_phone_number:
            methods.append("sms")
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
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "must_change_password": user.must_change_password
    }

@app.get("/users/me", response_model=Optional[schemas.UserOut])
def read_users_me(current_user: Optional[models.User] = Depends(auth.get_current_user)):
    return current_user

# MFA Helpers
def _mask_email(email: str) -> str:
    if not email or "@" not in email: return ""
    name, domain = email.split("@", 1)
    masked_name = f"{name[0]}*" if len(name) <= 2 else f"{name[0]}***{name[-1]}"
    return f"{masked_name}@{domain}"

def _mask_phone(phone: str) -> str:
    if not phone: return ""
    digits = "".join([c for c in phone if c.isdigit()])
    return f"***-***-{digits[-4:]}" if len(digits) >= 4 else "****"

def _normalize_phone(phone: str | None) -> str | None:
    if not phone: return None
    digits = "".join([c for c in phone if c.isdigit()])
    if not digits: return None
    if digits.startswith("1") and len(digits) == 11: return f"+{digits}"
    if len(digits) == 10: return f"+1{digits}"
    return phone if phone.startswith("+") else f"+{digits}"

def _hash_otp(code: str) -> str:
    return hashlib.sha256(f"{code}{settings.SECRET_KEY}".encode("utf-8")).hexdigest()

def _hash_device_token(token: str) -> str:
    return hashlib.sha256(f"{token}{settings.SECRET_KEY}".encode("utf-8")).hexdigest()

def _generate_otp() -> str:
    return f"{secrets.randbelow(1000000):06d}"

def _get_mfa_user_from_token(mfa_token: str, db: Session) -> models.User:
    try:
        payload = jwt.decode(mfa_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid MFA token.")
    if not payload.get("mfa"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid MFA token.")
    user_id = payload.get("sub")
    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")
    return user

def _get_mfa_destination(user: models.User, method: str) -> str:
    if method == "email":
        if not user.email: raise HTTPException(status_code=400, detail="No email on file.")
        return user.email
    if method == "sms":
        phone = _normalize_phone(user.mfa_phone_number)
        if not phone: raise HTTPException(status_code=400, detail="No phone number on file.")
        return phone
    raise HTTPException(status_code=400, detail="Invalid MFA method.")

def _enforce_mfa_rate_limit(db: Session, user: models.User | None, destination: str, method: str):
    window_start = datetime.utcnow() - timedelta(hours=1)
    query = db.query(models.MfaOtpLog).filter(
        models.MfaOtpLog.created_at >= window_start,
        models.MfaOtpLog.method == method,
        models.MfaOtpLog.destination == destination,
    )
    if user: query = query.filter(models.MfaOtpLog.user_id == user.id)
    if query.count() >= settings.MFA_OTP_RATE_LIMIT_PER_HOUR:
        raise HTTPException(status_code=429, detail="Too many OTP requests.")

def _is_trusted_device(db: Session, user: models.User, token: str) -> bool:
    token_hash = _hash_device_token(token)
    device = db.query(models.MfaTrustedDevice).filter(
        models.MfaTrustedDevice.user_id == user.id,
        models.MfaTrustedDevice.device_token_hash == token_hash,
        models.MfaTrustedDevice.expires_at >= datetime.utcnow(),
    ).first()
    if not device: return False
    device.last_used_at = datetime.utcnow()
    db.commit()
    return True

def _get_client_ip(request: Request):
    return request.client.host

@app.post("/users/", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED, tags=["users"])
def create_user(user: schemas.UserCreate, db: Session = Depends(database.get_db), background_tasks: BackgroundTasks = BackgroundTasks()):
    if user.email:
        db_user = db.query(models.User).filter(models.User.email == user.email).first()
        if db_user:
            raise HTTPException(status_code=400, detail="Email already registered")
    try:
        hashed_password = auth.get_password_hash(user.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Password error: {e}")
    
    pending_referral = db.query(models.Referral).filter(
        models.Referral.friend_email == user.email.lower(),
        models.Referral.registered_user_id.is_(None)
    ).first()
    
    referred_by_id = pending_referral.referrer_id if pending_referral else None
    
    db_user = models.User(
        email=user.email,
        hashed_password=hashed_password,
        is_active=True,
        is_confirmed=False,
        referred_by_id=referred_by_id
    )
    db.add(db_user); db.commit(); db.refresh(db_user)
    
    if pending_referral:
        pending_referral.registered_user_id = db_user.id
        pending_referral.registered_at = datetime.now()
        db.commit()

    global_settings = db.query(models.GlobalSettings).first()
    if global_settings:
        user_settings = models.UserSettings(
            owner_id=db_user.id,
            asset_categories=global_settings.asset_categories,
            liability_categories=global_settings.liability_categories,
            income_categories=global_settings.income_categories,
            expense_categories=global_settings.expense_categories
        )
    else:
        user_settings = models.UserSettings(owner_id=db_user.id)
    db.add(user_settings); db.commit()

    if db_user.email:
        token = auth.create_email_confirmation_token(db, db_user.id)
        background_tasks.add_task(send_email, to_email=db_user.email, subject="Confirm Email", body=f"Link: {settings.FRONTEND_URL}/confirm-email?token={token}")
    return db_user

# --- CASH FLOW ENDPOINTS ---

@app.post("/cashflow/", response_model=schemas.CashFlowOut, status_code=201, tags=["cashflow"])
def create_cashflow_item(
    item: schemas.CashFlowCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Create a new income or expense item."""
    # Start date logic
    start_date_val = item.start_date
    if not start_date_val:
        start_date_val = f"{date.today().year}-01-01"

    # Create the item
    db_item = models.CashFlowItem(
        **item.model_dump(exclude={'linked_asset_ids'}),
        owner_id=current_user.id,
        start_date=start_date_val,
        yearly_value=item.value # Initially set yearly_value to the raw value
    )
    
    # Calculate yearly_value based on frequency
    if item.frequency == 'monthly':
        db_item.yearly_value = item.value * 12
    
    db.add(db_item)
    db.commit()
    db.refresh(db_item)

    # Handle many-to-many relationship for linked assets
    if item.linked_asset_ids:
        assets = db.query(models.Asset).filter(
            models.Asset.id.in_(item.linked_asset_ids),
            models.Asset.owner_id == current_user.id
        ).all()
        db_item.linked_assets = assets
        db.commit()
        db.refresh(db_item)

    return db_item

@app.get("/cashflow/", response_model=List[schemas.CashFlowOut], tags=["cashflow"])
def read_cashflow_items(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Retrieve all cash flow items accessible to the current user."""
    accessible_ids = get_accessible_user_ids(current_user.id, db)
    return db.query(models.CashFlowItem).filter(models.CashFlowItem.owner_id.in_(accessible_ids)).all()

@app.get("/cashflow/{item_id}", response_model=schemas.CashFlowOut, tags=["cashflow"])
def read_cashflow_item(
    item_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Retrieve a specific cash flow item."""
    item = db.query(models.CashFlowItem).filter(models.CashFlowItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Check view permission
    has_permission = check_permission(
        db=db,
        current_user_id=current_user.id,
        primary_user_id=item.owner_id,
        permission_type="items",
        required_permission="view"
    )
    if not has_permission:
        raise HTTPException(status_code=403, detail="Access denied")
        
    return item

@app.put("/cashflow/{item_id}", response_model=schemas.CashFlowOut, tags=["cashflow"])
def update_cashflow_item(
    item_id: int,
    item_update: schemas.CashFlowUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Update a cash flow item."""
    db_item = db.query(models.CashFlowItem).filter(models.CashFlowItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Check edit permission
    if not check_permission(db, current_user.id, db_item.owner_id, "items", "edit"):
        raise HTTPException(status_code=403, detail="Permission denied")

    update_data = item_update.model_dump(exclude_unset=True, exclude={'linked_asset_ids'})
    
    # Recalculate yearly_value if value or frequency changes
    new_value = update_data.get('value', db_item.value)
    new_freq = update_data.get('frequency', db_item.frequency)
    
    if 'value' in update_data or 'frequency' in update_data:
        update_data['yearly_value'] = new_value * 12 if new_freq == 'monthly' else new_value

    for key, value in update_data.items():
        setattr(db_item, key, value)

    # Update linked assets if provided
    if item_update.linked_asset_ids is not None:
        assets = db.query(models.Asset).filter(
            models.Asset.id.in_(item_update.linked_asset_ids),
            models.Asset.owner_id == db_item.owner_id
        ).all()
        db_item.linked_assets = assets

    db.commit()
    db.refresh(db_item)
    return db_item

@app.post("/projections/", response_model=schemas.ProjectionResponse, tags=["projections"])
def create_projection(
    projection: schemas.ProjectionRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Run a new projection calculation and save it."""
    # Check subscription limits for projection years
    limits = get_user_limits(current_user)
    if limits["is_limited"] and projection.years > limits["max_projection_years"]:
        raise HTTPException(
            status_code=403, 
            detail=f"Your current plan limits projections to {limits['max_projection_years']} years."
        )

    # Perform calculations
    try:
        results = calculations.run_projection(projection)
    except Exception as e:
        logger.error(f"Projection calculation failed: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Calculation error: {str(e)}")

    # Save to database
    db_projection = models.Projection(
        name=projection.plan_name,
        years=projection.years,
        owner_id=current_user.id,
        final_value=results['final_value'],
        total_contributed=results['total_contributed'],
        total_growth=results['total_growth'],
        data_json=json.dumps(results['time_series'])
    )
    db.add(db_projection)
    db.commit()
    db.refresh(db_projection)

    # Save individual account results for the projection
    for acc in results['accounts']:
        db_acc = models.ProjectedAccount(
            projection_id=db_projection.id,
            name=acc['name'],
            account_type=acc['account_type'],
            initial_value=acc['initial_value'],
            contribution=acc['contribution'],
            growth_rate=acc['growth_rate'],
            cash_flow_item_id=acc.get('cash_flow_item_id')
        )
        db.add(db_acc)
    
    db.commit()
    return db_projection

@app.get("/projections/", response_model=List[schemas.ProjectionOut], tags=["projections"])
def list_projections(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """List all saved projections for the user."""
    return db.query(models.Projection).filter(models.Projection.owner_id == current_user.id).all()

@app.get("/projections/{projection_id}", response_model=schemas.ProjectionDetailOut, tags=["projections"])
def get_projection(
    projection_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Get full details of a specific projection."""
    proj = db.query(models.Projection).filter(
        models.Projection.id == projection_id,
        models.Projection.owner_id == current_user.id
    ).options(joinedload(models.Projection.accounts_data)).first()
    
    if not proj:
        raise HTTPException(status_code=404, detail="Projection not found")
    return proj

@app.delete("/projections/{projection_id}", status_code=204, tags=["projections"])
def delete_projection(
    projection_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Delete a saved projection."""
    proj = db.query(models.Projection).filter(
        models.Projection.id == projection_id,
        models.Projection.owner_id == current_user.id
    ).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Projection not found")
    
    db.delete(proj)
    db.commit()
    return Response(status_code=204)

@app.get("/admin/users", response_model=List[schemas.UserOut], tags=["admin"])
def list_all_manageable_users(
    db: Session = Depends(database.get_db),
    current_admin_user: schemas.UserOut = Depends(auth.get_current_admin_user)
):
    """Admin only: List all users in the system."""
    return db.query(models.User).filter(models.User.id != current_admin_user.id).all()

@admin_router.put("/global-settings", response_model=schemas.GlobalSettingsOut, tags=["admin"])
def update_global_settings(
    payload: schemas.GlobalSettingsUpdate,
    db: Session = Depends(database.get_db),
    current_admin_user: schemas.UserOut = Depends(auth.get_current_admin_user)
):
    """Admin only: Update system-wide default settings."""
    global_settings = db.query(models.GlobalSettings).first()
    if not global_settings:
        global_settings = models.GlobalSettings()
        db.add(global_settings)

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(global_settings, key, value)
    
    db.commit()
    db.refresh(global_settings)
    return global_settings

@admin_router.get("/global-settings", response_model=schemas.GlobalSettingsOut, tags=["admin"])
def get_global_settings(
    db: Session = Depends(database.get_db),
    current_admin_user: schemas.UserOut = Depends(auth.get_current_admin_user)
):
    """Admin only: Retrieve current system-wide defaults."""
    return db.query(models.GlobalSettings).first()

app.include_router(admin_router, prefix="/admin")

@app.post("/categories/check-usage", response_model=bool, tags=["categories"])
def check_category_usage(
    category_check: schemas.CategoryUsageCheck,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """Check if a specific category is currently being used by any assets or liabilities."""
    cat_name = category_check.category_name
    cat_type = category_check.category_type.lower()
    
    if cat_type == "asset":
        exists = db.query(models.Asset).filter(
            models.Asset.owner_id == current_user.id,
            models.Asset.category == cat_name
        ).first() is not None
        return exists
    elif cat_type == "liability":
        exists = db.query(models.Liability).filter(
            models.Liability.owner_id == current_user.id,
            models.Liability.category == cat_name
        ).first() is not None
        return exists
        
    return False

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
    logger.error(f"Unhandled error: {str(exc)}\n{error_traceback}")
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please contact support."}
    )

@app.post("/auth/mfa/request", tags=["auth"])
def request_mfa_otp(
    req: schemas.MfaRequestOtp,
    db: Session = Depends(database.get_db),
    request: Request = None
):
    user = _get_mfa_user_from_token(req.mfa_token, db)
    destination = _get_mfa_destination(user, req.method)
    _enforce_mfa_rate_limit(db, user, destination, req.method)
    
    code = _generate_otp()
    code_hash = _hash_otp(code)
    
    expires_at = datetime.utcnow() + timedelta(minutes=settings.MFA_OTP_TTL_MINUTES)
    otp_entry = models.MfaOtpLog(
        user_id=user.id,
        method=req.method,
        destination=destination,
        code_hash=code_hash,
        expires_at=expires_at,
        ip_address=_get_client_ip(request) if request else None
    )
    db.add(otp_entry)
    db.commit()

    if req.method == "email":
        send_email(to_email=destination, subject="Your Verification Code", body=f"Your code is: {code}")
    elif req.method == "sms":
        send_sms(to_phone=destination, message=f"Your code is: {code}")
        
    return {"message": f"OTP sent via {req.method}", "destination": _mask_email(destination) if req.method == "email" else _mask_phone(destination)}

@app.post("/auth/mfa/verify", tags=["auth"])
def verify_mfa_otp(
    req: schemas.MfaVerifyOtp,
    db: Session = Depends(database.get_db)
):
    user = _get_mfa_user_from_token(req.mfa_token, db)
    destination = _get_mfa_destination(user, req.method)
    code_hash = _hash_otp(req.code)
    
    otp_record = db.query(models.MfaOtpLog).filter(
        models.MfaOtpLog.user_id == user.id,
        models.MfaOtpLog.code_hash == code_hash,
        models.MfaOtpLog.expires_at >= datetime.utcnow(),
        models.MfaOtpLog.used_at.is_(None)
    ).first()

    if not otp_record:
        raise HTTPException(status_code=401, detail="Invalid or expired code.")

    otp_record.used_at = datetime.utcnow()
    
    response_data = {
        "access_token": auth.create_access_token(data={"sub": str(user.id)}),
        "token_type": "bearer",
        "must_change_password": user.must_change_password
    }

    if req.remember_device:
        device_token = secrets.token_urlsafe(32)
        device_hash = _hash_device_token(device_token)
        new_device = models.MfaTrustedDevice(
            user_id=user.id,
            device_token_hash=device_hash,
            expires_at=datetime.utcnow() + timedelta(days=settings.MFA_TRUSTED_DEVICE_DAYS)
        )
        db.add(new_device)
        response_data["mfa_device_token"] = device_token

    db.commit()
    return response_data

@app.get("/settings/me", response_model=schemas.UserSettingsOut, tags=["settings"])
def get_my_settings(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    settings_obj = db.query(models.UserSettings).filter(models.UserSettings.owner_id == current_user.id).first()
    if not settings_obj:
        settings_obj = models.UserSettings(owner_id=current_user.id)
        db.add(settings_obj)
        db.commit()
        db.refresh(settings_obj)
    return settings_obj

@app.put("/settings/me", response_model=schemas.UserSettingsOut, tags=["settings"])
def update_my_settings(
    settings_update: schemas.UserSettingsUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    db_settings = db.query(models.UserSettings).filter(models.UserSettings.owner_id == current_user.id).first()
    update_data = settings_update.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        setattr(db_settings, key, value)
    
    db.commit()
    db.refresh(db_settings)
    return db_settings

@app.get("/auth/mfa/settings", response_model=schemas.MfaSettingsOut, tags=["auth"])
def get_mfa_settings(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@app.put("/auth/mfa/settings", response_model=schemas.MfaSettingsOut, tags=["auth"])
def update_mfa_settings(
    update: schemas.MfaSettingsUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(current_user, key, value)
    db.commit()
    db.refresh(current_user)
    return current_user


@app.post("/users/change-password", tags=["users"])
def change_password(
    req: schemas.ChangePasswordRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if not auth.verify_password(req.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect current password")
    
    current_user.hashed_password = auth.get_password_hash(req.new_password)
    current_user.must_change_password = False
    db.commit()
    return {"message": "Password updated successfully"}

@app.get("/confirm-email", tags=["users"])
def confirm_email(token: str, db: Session = Depends(database.get_db)):
    # verify_email_confirmation_token returns the user_id if valid
    user_id = auth.verify_email_confirmation_token(db, token) 
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user:
        user.is_confirmed = True
        # Logic Fix: If they were migrating to enable MFA, we can now safely
        # flip the mfa_enabled and mfa_email_enabled flags.
        if not user.mfa_enabled:
            user.mfa_enabled = True
            user.mfa_email_enabled = True
            
        db.commit()
        # Instead of just JSON, you might want to redirect them to login
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/login?verified=true")
        
    raise HTTPException(status_code=404, detail="User not found")

# main.py

@app.post("/users/migrate-to-email", tags=["users"])
def migrate_username_to_email(
    payload: schemas.EmailUpdateRequest, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    # 1. Check if the new email is already taken
    existing_user = auth.get_user_by_email(db, payload.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="That email is already registered.")

    # 2. Update user's email field and reset confirmation status
    current_user.email = payload.email
    current_user.is_confirmed = False
    db.commit()

    # 3. Generate a confirmation token and send email
    token = auth.create_email_confirmation_token(db, current_user.id)
    verification_link = f"{settings.FRONTEND_URL}/confirm-email?token={token}"
    
    background_tasks.add_task(
        send_email, 
        to_email=payload.email, 
        subject="Verify your new Email Address", 
        body=f"Please click here to verify your new username: {verification_link}"
    )

    return {"message": "Email updated. Please check your inbox to verify."}

@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": time.time()}