from fastapi import FastAPI, Depends, HTTPException, Response, status, BackgroundTasks, APIRouter
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text
from datetime import timedelta, datetime
from typing import List
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
from routers.auto_disbursements import router as auto_disbursements_router
from utils.email import send_email
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
    logging.getLogger("auth").setLevel(logging.DEBUG)


    logger.info("FastAPI application started. Logging level set to DEBUG.")

    logger.info(f"Effective CORS_ORIGINS_REGEX: {settings.CORS_ORIGINS_REGEX}")

app.include_router(custom_charts_router) # MODIFIED: Use the explicitly imported router
app.include_router(settings_router)
app.include_router(assets.router)
app.include_router(liabilities.router)
app.include_router(accounts_router)
app.include_router(auto_disbursements_router)

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
    
    if not user.is_confirmed:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Please confirm your email address before logging in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

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
    """
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
    
    db_user = models.User(
        email=user.email,
        hashed_password=hashed_password,
        is_active=True,
        is_confirmed=False
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
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

@app.post("/projections", response_model=schemas.ProjectionResponse, status_code=status.HTTP_201_CREATED, tags=["projections"])
def create_projection(
    projection_data: schemas.ProjectionRequest,
    user: schemas.UserOut = Depends(auth.get_current_user), 
    db: Session = Depends(database.get_db)
):
    """
    Creates a new projection, runs the calculation, and saves the results to the database."""
    logger.debug(f"Entering create_projection endpoint for user {user.id}. Calling calculate_projection.")
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
    )
    db.add(db_projection)
    db.commit()
    db.refresh(db_projection)

    # Associate projected accounts and time series data with the new projection
    for acc in projection_results["projected_accounts"]:
        acc.projection_id = db_projection.id
        db.add(acc)

    for ts_data in projection_results["time_series_data"]:
        ts_data.projection_id = db_projection.id
        db.add(ts_data)

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
        time_series_data=[schemas.ProjectionTimeSeriesDataOut.model_validate(ts) for ts in projection_results["time_series_data"]],
        data_json=projection_results.get("data_json")  # Include data_json from calculations
    )

@app.get("/projections/{projection_id}", response_model=schemas.ProjectionDetailOut, tags=["projections"])
def get_projection_details(
    projection_id: int, 
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Retrieves a single projection if the user is the owner."""
    
    projection = (
        db.query(models.Projection)
        .options(joinedload(models.Projection.accounts_data), joinedload(models.Projection.time_series_data))
        .filter(models.Projection.id == projection_id, models.Projection.owner_id == current_user.id)
        .first()
    )
    
    if not projection:
        raise HTTPException(status_code=404, detail="Projection not found or not authorized.")
    
    return projection

@app.get("/projections", response_model=List[schemas.ProjectionOut], tags=["projections"])
def list_projections(
    db: Session = Depends(database.get_db), 
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Lists all projections owned by the current user."""
    
    # Only load basic projection data for the list view, details will be fetched by get_projection_details
    projections = db.query(models.Projection).filter(models.Projection.owner_id == current_user.id).all()
    
    return projections

@app.put("/projections/{projection_id}", response_model=schemas.ProjectionDetailOut, tags=["projections"])
def update_projection(
    projection_id: int,
    req: schemas.ProjectionRequest,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Updates an existing projection if user is the owner."""
    projection = (
        db.query(models.Projection)
        .options(joinedload(models.Projection.accounts_data), joinedload(models.Projection.time_series_data))
        .filter(models.Projection.id == projection_id, models.Projection.owner_id == current_user.id)
        .first()
    )
    
    if not projection:
        raise HTTPException(status_code=404, detail="Projection not found or not authorized.")
    
    logger.debug(f"Entering update_projection endpoint for user {current_user.id}. Calling calculate_projection.")
    
    # Delete existing associated data
    db.query(models.ProjectedAccount).filter(models.ProjectedAccount.projection_id == projection_id).delete()
    db.query(models.ProjectionTimeSeriesData).filter(models.ProjectionTimeSeriesData.projection_id == projection_id).delete()
    db.commit()

    # Recalculate projection
    result = calculations.calculate_projection(
        years=req.years,
        accounts=req.accounts,
        db=db,
        owner_id=current_user.id
    )
    
    # Update projection header details
    projection.name = req.plan_name
    projection.years = req.years
    projection.final_value = result["final_value"]
    projection.total_contributed = result["total_contributed"]
    projection.total_growth = result["total_growth"]
    projection.timestamp = datetime.utcnow()
    
    # Add new associated data
    for acc in result["projected_accounts"]:
        acc.projection_id = projection.id
        db.add(acc)

    for ts_data in result["time_series_data"]:
        ts_data.projection_id = projection.id
        db.add(ts_data)

    db.commit()
    db.refresh(projection) # Refresh to load relationships
    
    # Construct response with data_json from calculations
    return schemas.ProjectionDetailOut(
        id=projection.id,
        name=projection.name,
        years=projection.years,
        final_value=projection.final_value,
        total_contributed=projection.total_contributed,
        total_growth=projection.total_growth,
        accounts_data=[schemas.ProjectedAccountOut.model_validate(acc) for acc in result["projected_accounts"]],
        time_series_data=[schemas.ProjectionTimeSeriesDataOut.model_validate(ts) for ts in result["time_series_data"]],
        data_json=result.get("data_json")  # Include data_json from calculations
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
            time_series_data=[schemas.ProjectionTimeSeriesDataOut.model_validate(ts) for ts in projection_results["time_series_data"]]
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
    """
    Delete a projection if the current user is the owner."""
    projection = db.query(models.Projection).filter(models.Projection.id == projection_id).first()
    if not projection:
        raise HTTPException(status_code=404, detail="Projection not found.")
    if projection.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    

    db.delete(projection)
    db.commit()
    return Response(status_code=204)

@app.get("/cashflow", response_model=List[schemas.CashFlowOut], tags=["cashflow"])
def list_cashflow(
    is_income: bool,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    logger.debug(f"list_cashflow: User ID: {current_user.id}, Is Income: {is_income}")
    cashflow_items = (
        db.query(models.CashFlowItem)
        .filter(models.CashFlowItem.owner_id == current_user.id)
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
        start_date=payload.start_date,
        end_date=payload.end_date,
        taxable=payload.taxable,
        tax_deductible=payload.taxable,
        linked_item_id=payload.linked_item_id,
        linked_item_type=payload.linked_item_type,
        percentage=payload.percentage,
        contributes_to_asset_id=payload.contributes_to_asset_id
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@app.put("/cashflow/{item_id}", response_model=schemas.CashFlowOut, tags=["cashflow"])
def update_cashflow(
    item_id: int,
    payload: schemas.CashFlowUpdate,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    item = db.query(models.CashFlowItem).filter(models.CashFlowItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    yearly_value = _calculate_yearly_value_for_cashflow(db, payload)
    
    for key, value in payload.model_dump(exclude_unset=True).items():
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
    item = db.query(models.CashFlowItem).filter(models.CashFlowItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    

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
