from fastapi import FastAPI, Depends, HTTPException, Response, status, BackgroundTasks, APIRouter
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text, func
from datetime import timedelta, datetime, date
from typing import List, Optional
from starlette.responses import RedirectResponse
from utils import google_oauth
from jose import jwt, JWTError
import json
import sys 
import traceback 
import os
from fastapi.responses import JSONResponse
from starlette.requests import Request
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
from utils.email import send_email
from utils.permission_dependencies import get_accessible_user_ids
from utils.permissions import check_permission
from config import settings

logger = logging.getLogger(__name__)

# --- INITIALIZATION ---
app = FastAPI(title="Financial Projector API", version="1.0", _proxy_headers=True, redirect_slashes=False)

@app.on_event("startup")
async def startup_event():
    # Configure logging for the application
    log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    logging.basicConfig(level=logging.DEBUG, format=log_format)

    # Explicitly set log levels for uvicorn and our application modules
    logging.getLogger("uvicorn").setLevel(logging.DEBUG)
    logging.getLogger("uvicorn.access").setLevel(logging.DEBUG)
    logging.getLogger("uvicorn.error").setLevel(logging.DEBUG)
    logging.getLogger("api.routers.custom_charts").setLevel(logging.DEBUG)
    logging.getLogger("api.calculations").setLevel(logging.DEBUG)
    logging.getLogger("calculations").setLevel(logging.DEBUG)  # Also set for 'calculations' module name
    logging.getLogger("main").setLevel(logging.DEBUG)  # Set for main module logger
    logging.getLogger("auth").setLevel(logging.DEBUG)


    logger.info("FastAPI application started. Logging level set to DEBUG.")

    logger.info(f"Effective CORS_ORIGINS_REGEX: {settings.CORS_ORIGINS_REGEX}")

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

# New router for admin global settings
admin_router = APIRouter()

@app.get("/", tags=["debug"])
async def root():
    return {"message": "Financial Projector API is running!"}

from fastapi.routing import APIRoute

@app.get("/debug/routes", tags=["debug"], summary="Debug: List all registered routes")
async def list_routes():
    """Lists all registered routes in the FastAPI application."""
    routes_info = []
    for route in app.routes:
        if isinstance(route, APIRoute):
            routes_info.append({
                "path": route.path,
                "name": route.name,
                "methods": list(route.methods),
                "tags": route.tags
            })
    logger.debug(f"Registered routes: {routes_info}")
    return routes_info

from fastapi.routing import APIRoute

@app.get("/debug/db-info", summary="Debug: Get current database info")
def debug_db_info(db: Session = Depends(database.get_db)):
    result = db.execute(text("SELECT current_database();")).scalar_one()
    logger.debug(f"Current database from /debug/db-info: {result}")
    return {"current_database": result}

@app.get("/debug/frontend-url", tags=["debug"], summary="Debug: Get current FRONTEND_URL setting")
async def debug_frontend_url():
    return {"FRONTEND_URL": settings.FRONTEND_URL, "GOOGLE_CLIENT_ID": settings.GOOGLE_CLIENT_ID}

# --- CONFIGURATION ---
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES 

# --- CORS CONFIGURATION (CRITICAL for frontend connection) ---
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=settings.CORS_ORIGINS_REGEX,              
    allow_credentials=True,             
    allow_methods=["*"],                
    allow_headers=["*"],                
)
# --- END CORS CONFIGURATION ---

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

@app.get("/auth/google", tags=["oauth"], summary="Initiate Google OAuth login")
async def google_login(request: Request):
    logger.debug(f"Received /auth/google request for URL: {request.url}")
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

        logger.debug(f"FRONTEND_URL value in google_callback: {settings.FRONTEND_URL}") # DEBUG LOG
        redirect_url = f"{settings.FRONTEND_URL}/auth/google/callback?token={our_access_token}"
        logger.debug(f"Google OAuth Callback: Redirecting to: {redirect_url}")
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
    db: Session = Depends(database.get_db)
):
    logger.debug(f"Attempting login for user: {form_data.username}")
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

@app.get("/debug/users", response_model=list[schemas.UserOut], summary="Debug: Get all users from DB")
def debug_get_all_users(db: Session = Depends(database.get_db)):
    logger.debug("Fetching all users from database via /debug/users endpoint.")
    users = db.query(models.User).all()
    logger.debug(f"Found {len(users)} users.")
    return users

@app.get("/debug-env", tags=["debug"])
async def debug_environment():
    return dict(os.environ)

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

    # Only send confirmation email if user has an email address
    if db_user.email:
        confirmation_token = auth.create_email_confirmation_token(db, db_user.id)
        confirmation_link = f"{settings.FRONTEND_URL}/confirm-email?token={confirmation_token}"
        logger.debug(f"Email confirmation link: {confirmation_link}")
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
        
        logger.info(f"User {user_id} ({user_to_delete.email}) successfully deleted by admin {current_admin_user.id}")
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
        referred_by_id=None
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
    
    logger.info(f"Admin {current_admin_user.id} created user {db_user.id} (email: {db_user.email or 'None'})")
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
    logger.debug(f"Attempting to retrieve global settings for admin user {current_admin_user.email} (ID: {current_admin_user.id})")
    global_settings = db.query(models.GlobalSettings).first()
    if not global_settings:
        logger.info("No global settings found in DB. Creating default global settings.")
        # Create default global settings if they don't exist
        global_settings = models.GlobalSettings(help_content="<h1>Welcome to the Help Page!</h1><p>This is a placeholder for help content. Administrators can edit this content.</p>") # Initialize with default content
        db.add(global_settings)
        db.commit()
        db.refresh(global_settings)
        logger.info("Default global settings created and committed with default help content.")
    else:
        logger.debug("Global settings found in DB.")
    logger.debug(f"Returning global settings: {global_settings.model_dump_json() if hasattr(global_settings, 'model_dump_json') else 'No model_dump_json method'}")
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
        global_settings = models.GlobalSettings()
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
        logger.debug(f"Password reset link: {reset_link}")
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
    result = calculations.calculate_projection(
        years=projection.years,
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
    logger.info(f"=== CREATE_PROJECTION ENDPOINT CALLED for user {user.id} ===")
    logger.info(f"Projection request: years={projection_data.years}, accounts_count={len(projection_data.accounts)}")
    logger.debug(f"Entering create_projection endpoint for user {user.id}. Calling calculate_projection.")
    try:
        logger.info(f"About to call calculate_projection for user {user.id}")
        projection_results = calculations.calculate_projection(
            years=projection_data.years,
            accounts=projection_data.accounts,
            db=db,
            owner_id=user.id
        )
        logger.info(f"calculate_projection completed for user {user.id}")
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
            logger.info(f"Projection {projection_id} is stale, auto-recalculating...")
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
                logger.info(f"Projection {projection_id} auto-recalculated successfully")
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
    logger.info(f"=== UPDATE_PROJECTION ENDPOINT CALLED for user {current_user.id}, projection_id={projection_id} ===")
    logger.info(f"Projection request: years={req.years}, accounts_count={len(req.accounts)}")
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
    
    logger.info(f"About to call calculate_projection in update_projection for user {current_user.id}")
    logger.debug(f"Entering update_projection endpoint for user {current_user.id}. Calling calculate_projection.")
    
    # Delete existing associated data
    db.query(models.ProjectedAccount).filter(models.ProjectedAccount.projection_id == projection_id).delete()
    db.commit()

    # Recalculate projection
    try:
        logger.info(f"Calling calculate_projection in update_projection for user {current_user.id}")
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

@app.post("/debug-projection-calc", response_model=schemas.ProjectionResponse, tags=["debug"], summary="Debug: Directly run projection calculation")
def debug_run_projection_calculation(
    projection_data: schemas.ProjectionRequest,
    db: Session = Depends(database.get_db),
    # current_user: schemas.UserOut = Depends(auth.get_current_user) # Temporarily commented out for debug endpoint
):
    logger.debug("Received request for /debug-projection-calc. Calling calculate_projection.")
    # For local debugging, we'll use a hardcoded owner_id.
    test_owner_id = 1 # Assuming user_id 1 exists in your local DB for testing

    try:
        projection_results = calculations.calculate_projection(
            years=projection_data.years,
            accounts=projection_data.accounts,
            db=db,
            owner_id=test_owner_id # Using a test owner ID for direct debugging
        )
        logger.debug("calculate_projection returned successfully.")

        # Manually create a ProjectionResponse to return the structured data
        # This mimics what create_projection would do, but without saving to DB
        temp_projection_response = schemas.ProjectionResponse(
            id=0, # Dummy ID as it's not saved to DB
            name=projection_data.plan_name,
            years=projection_data.years,
            final_value=projection_results["final_value"],
            total_contributed=projection_results["total_contributed"],
            total_growth=projection_results["total_growth"],
            accounts_data=[schemas.ProjectedAccountOut.model_validate(acc) for acc in projection_results["projected_accounts"]],
            time_series_data=[],  # No longer used - use data_json instead
            data_json=projection_results.get("data_json")
        )
        return temp_projection_response

    except Exception as e:
        logger.error(f"Error during /debug-projection-calc: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Debug projection calculation failed: {e}")

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
    logger.debug(f"list_cashflow: User ID: {current_user.id}, viewing_user_id: {viewing_user_id}, Is Income: {is_income}")
    
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
    logger.debug(f"list_cashflow: Found {len(cashflow_items)} items for user {current_user.id}, Is Income: {is_income}")
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
                logger.info(f"Auto-created federal tax expense item for user {current_user.id} when income was added")
    
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

import socket

@app.get("/debug/proxy-check", tags=["debug"], summary="Debug: Check Cloud SQL Proxy connectivity")
async def debug_proxy_check():
    host = "127.0.0.1"
    port = 5432
    try:
        with socket.create_connection((host, port), timeout=5) as sock:
            return {"status": "success", "message": f"Successfully connected to Cloud SQL Proxy at {host}:{port}"}
    except socket.error as e:
        return {"status": "error", "message": f"Failed to connect to Cloud SQL Proxy at {host}:{port}: {e}"}
    except Exception as e:
        return {"status": "error", "message": f"An unexpected error occurred: {e}"}

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.debug(f"HTTPException caught: {exc.detail}")
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
