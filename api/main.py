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
import sys # NEW: Added for flushing print statements
import traceback # NEW: Added for traceback logging
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
from routers.custom_charts import router as custom_charts_router # Changed import
from routers import assets
from routers import liabilities
from routers.settings import router as settings_router
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

app.include_router(custom_charts_router) # Changed to use the aliased router
app.include_router(settings_router)
app.include_router(assets.router)
app.include_router(liabilities.router)

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
        body="""Hello {db_user.email},

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

    db.delete(user_to_delete)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

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
   438|def change_password(
   439|    payload: schemas.ChangePasswordRequest,
   440|    current_user: schemas.UserOut = Depends(auth.get_current_user),
   441|    db: Session = Depends(database.get_db)
   442|):
   443|    """Allows an authenticated user to change their password."""
   444|    updated_user = auth.change_user_password(
   445|        db=db,
   446|        user_id=current_user.id,
   447|        current_password=payload.current_password,
   448|        new_password=payload.new_password
   449|    )
   450|    return updated_user
   451|
   452|@app.post("/forgot-password", status_code=status.HTTP_200_OK, tags=["auth"])
   453|def forgot_password(
   454|    payload: schemas.PasswordResetRequest,
   455|    db: Session = Depends(database.get_db)
   456|):
   457|    """Handles the request to initiate a password reset. Sends a reset email if the user exists."""
   458|    user = db.query(models.User).filter(models.User.email == payload.email).first()
   459|    if user:
   460|        token = auth.create_password_reset_token(db, user.id)
   461|        reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
   462|    logger.debug(f"Password reset link: {reset_link}")
   463|    send_email(
   464|        to_email=user.email,
   465|        subject="Financial Projector - Password Reset Request",
   466|        body="""Hello,
   467|
   468|You have requested a password reset for your Financial Projector account.
   469|
   470|Please use the following link to reset your password: {reset_link}
   471|
   472|This link will expire in 1 hour.
   473|
   474|If you did not request a password reset, please ignore this email.
   475|
   476|Best regards,
   477|The Financial Projector Team"""
   478|    )
   479|    
   480|    return {"message": "If an account with that email exists, a password reset link has been sent."}
   481|
   482|@app.post("/reset-password", response_model=schemas.UserOut, tags=["auth"])
   483|def reset_password(
   484|    payload: schemas.PasswordReset,
   485|    db: Session = Depends(database.get_db)
   486|):
   487|    """Resets the user's password using a valid reset token."""
   488|    try:
   489|        updated_user = auth.reset_user_password(
   490|            db=db,
   491|            token=payload.token,
   492|            new_password=payload.new_password
   493|        )
   494|    except ValueError as e:
   495|        raise HTTPException(
   496|            status_code=status.HTTP_400_BAD_REQUEST,
   497|            detail=f"New password did not meet requirements: {e}"
   498|        )
   499|    except HTTPException as e:
   500|        raise e
   501|    return updated_user
   502|
   503|@app.post("/verify-email", response_model=schemas.UserOut, tags=["auth"])
   504|def verify_email(
   505|    payload: schemas.EmailConfirmation,
   506|    db: Session = Depends(database.get_db)
   507|):
   508|    """Verifies a user's email address using a confirmation token."""
   509|    try:
   510|        confirmed_user = auth.verify_email_confirmation_token(db, payload.token)
   511|    except HTTPException as e:
   512|        raise e
   513|    return confirmed_user
   514|
   515|@app.post("/projections", response_model=schemas.ProjectionResponse, status_code=status.HTTP_201_CREATED, tags=["projections"])
   516|def create_projection(
   517|    projection_data: schemas.ProjectionRequest,
   518|    user: schemas.UserOut = Depends(auth.get_current_user), 
   519|    db: Session = Depends(database.get_db)
   520|):
   521|    """
   522|    Creates a new projection, runs the calculation, and saves the results to the database."""
   523|    logger.debug(f"Entering create_projection endpoint for user {user.id}. Calling calculate_projection.")
   524|    try:
   525|        projection_results = calculations.calculate_projection(
   526|            years=projection_data.years,
   527|            accounts=projection_data.accounts,
   528|            db=db,
   529|            owner_id=user.id
   530|        )
   531|    except Exception as e:
   532|        logger.error(f"Error during projection calculation for user {user.id}: {e}", exc_info=True)
   533|        raise HTTPException(status_code=400, detail=str(e))
   534|
   535|    db_projection = models.Projection(
   536|        owner_id=user.id,
   537|        name=projection_data.plan_name,
   538|        years=projection_data.years,
   539|        final_value=projection_results["final_value"],
   540|        total_contributed=projection_results["total_contributed"],
   541|        total_growth=projection_results["total_growth"],
   542|    )
   543|    db.add(db_projection)
   544|    db.commit()
   545|    db.refresh(db_projection)
   546|
   547|    # Associate projected accounts and time series data with the new projection
   548|    for acc in projection_results["projected_accounts"]:
   549|        acc.projection_id = db_projection.id
   550|        db.add(acc)
   551|
   552|    for ts_data in projection_results["time_series_data"]:
   553|        ts_data.projection_id = db_projection.id
   554|        db.add(ts_data)
   555|
   556|    db.commit()
   557|    db.refresh(db_projection) # Refresh to load relationships
   558|
   559|    return db_projection
   560|
   561|@app.get("/projections/{projection_id}", response_model=schemas.ProjectionDetailOut, tags=["projections"])
   562|def get_projection_details(
   563|    projection_id: int, 
   564|    db: Session = Depends(database.get_db),
   565|    current_user: schemas.UserOut = Depends(auth.get_current_user)
   566|):
   567|    """
   568|    Retrieves a single projection if the user is the owner."""
   569|    
   570|    projection = (
   571|        db.query(models.Projection)
   572|        .options(joinedload(models.Projection.accounts_data), joinedload(models.Projection.time_series_data))
   573|        .filter(models.Projection.id == projection_id, models.Projection.owner_id == current_user.id)
   574|        .first()
   575|    )
   576|    
   577|    if not projection:
   578|        raise HTTPException(status_code=404, detail="Projection not found or not authorized.")
   579|    
   580|    return projection
   581|
   582|@app.get("/projections", response_model=List[schemas.ProjectionOut], tags=["projections"])
   583|def list_projections(
   584|    db: Session = Depends(database.get_db), 
   585|    current_user: schemas.UserOut = Depends(auth.get_current_user)
   586|):
   587|    """
   588|    Lists all projections owned by the current user."""
   589|    
   590|    # Only load basic projection data for the list view, details will be fetched by get_projection_details
   591|    projections = db.query(models.Projection).filter(models.Projection.owner_id == current_user.id).all()
   592|    
   593|    return projections
   594|
   595|@app.put("/projections/{projection_id}", response_model=schemas.ProjectionDetailOut, tags=["projections"])
   596|def update_projection(
   597|    projection_id: int,
   598|    req: schemas.ProjectionRequest,
   599|    db: Session = Depends(database.get_db),
   600|    current_user: schemas.UserOut = Depends(auth.get_current_user)
   601|):
   602|    """
   603|    Updates an existing projection if user is the owner."""
   604|    projection = (
   605|        db.query(models.Projection)
   606|        .options(joinedload(models.Projection.accounts_data), joinedload(models.Projection.time_series_data))
   607|        .filter(models.Projection.id == projection_id, models.Projection.owner_id == current_user.id)
   608|        .first()
   609|    )
   610|    
   611|    if not projection:
   612|        raise HTTPException(status_code=404, detail="Projection not found or not authorized.")
   613|    
   614|    logger.debug(f"Entering update_projection endpoint for user {current_user.id}. Calling calculate_projection.")
   615|    
   616|    # Delete existing associated data
   617|    db.query(models.ProjectedAccount).filter(models.ProjectedAccount.projection_id == projection_id).delete()
   618|    db.query(models.ProjectionTimeSeriesData).filter(models.ProjectionTimeSeriesData.projection_id == projection_id).delete()
   619|    db.commit()
   620|
   621|    # Recalculate projection
   622|    result = calculations.calculate_projection(
   623|        years=req.years,
   624|        accounts=req.accounts,
   625|        db=db,
   626|        owner_id=current_user.id
   627|    )
   628|    
   629|    # Update projection header details
   630|    projection.name = req.plan_name
   631|    projection.years = req.years
   632|    projection.final_value = result["final_value"]
   633|    projection.total_contributed = result["total_contributed"]
   634|    projection.total_growth = result["total_growth"]
   635|    projection.timestamp = datetime.utcnow()
   636|    
   637|    # Add new associated data
   638|    for acc in result["projected_accounts"]:
   639|        acc.projection_id = projection.id
   640|        db.add(acc)
   641|
   642|    for ts_data in result["time_series_data"]:
   643|        ts_data.projection_id = projection.id
   644|        db.add(ts_data)
   645|    
   646|    db.commit()
   647|    db.refresh(projection) # Refresh to load relationships
   648|    return projection
   649|
   650|@app.post("/debug-projection-calc", response_model=schemas.ProjectionResponse, tags=["debug"], summary="Debug: Directly run projection calculation")
   651|def debug_run_projection_calculation(
   652|    projection_data: schemas.ProjectionRequest,
   653|    db: Session = Depends(database.get_db),
   654|    # current_user: schemas.UserOut = Depends(auth.get_current_user) # Temporarily commented out for debug endpoint
   655|):
   656|    logger.debug("Received request for /debug-projection-calc. Calling calculate_projection.")
   657|    # For local debugging, we'll use a hardcoded owner_id.
   658|    test_owner_id = 1 # Assuming user_id 1 exists in your local DB for testing
   659|
   660|    try:
   661|        projection_results = calculations.calculate_projection(
   662|            years=projection_data.years,
   663|            accounts=projection_data.accounts,
   664|            db=db,
   665|            owner_id=test_owner_id # Using a test owner ID for direct debugging
   666|        )
   667|        logger.debug("calculate_projection returned successfully.")
   668|
   669|        # Manually create a ProjectionResponse to return the structured data
   670|        # This mimics what create_projection would do, but without saving to DB
   671|        temp_projection_response = schemas.ProjectionResponse(
   672|            id=0, # Dummy ID as it's not saved to DB
   673|            name=projection_data.plan_name,
   674|            years=projection_data.years,
   675|            final_value=projection_results["final_value"],
   676|            total_contributed=projection_results["total_contributed"],
   677|            total_growth=projection_results["total_growth"],
   678|            accounts_data=[schemas.ProjectedAccountOut.model_validate(acc) for acc in projection_results["projected_accounts"]],
   679|            time_series_data=[schemas.ProjectionTimeSeriesDataOut.model_validate(ts) for ts in projection_results["time_series_data"]]
   680|        )
   681|        return temp_projection_response
   682|
   683|    except Exception as e:
   684|        logger.error(f"Error during /debug-projection-calc: {e}", exc_info=True)
   685|        raise HTTPException(status_code=500, detail=f"Debug projection calculation failed: {e}")
   686|
   687|@app.delete("/projections/{projection_id}", status_code=204, tags=["projections"])
   688|def delete_projection(
   689|    projection_id: int,
   690|    db: Session = Depends(database.get_db),
   691|    current_user: schemas.UserOut = Depends(auth.get_current_user)
   692|):
   693|    """
   694|    Delete a projection if the current user is the owner."""
   695|    projection = db.query(models.Projection).filter(models.Projection.id == projection_id).first()
   696|    if not projection:
   697|        raise HTTPException(status_code=404, detail="Projection not found.")
   698|    if projection.owner_id != current_user.id:
   699|        raise HTTPException(status_code=403, detail="Not authorized")
   700|    
   701|
   702|    db.delete(projection)
   703|    db.commit()
   704|    return Response(status_code=204)
   705|
   706|@app.get("/cashflow", response_model=List[schemas.CashFlowOut], tags=["cashflow"])
   707|def list_cashflow(
   708|    is_income: bool,
   709|    db: Session = Depends(database.get_db),
   710|    current_user: schemas.UserOut = Depends(auth.get_current_user)
   711|):
   712|    logger.debug(f"list_cashflow: User ID: {current_user.id}, Is Income: {is_income}")
   713|    cashflow_items = (
   714|        db.query(models.CashFlowItem)
   715|        .filter(models.CashFlowItem.owner_id == current_user.id)
   716|        .filter(models.CashFlowItem.is_income == is_income)
   717|        .order_by(models.CashFlowItem.id.desc())
   718|        .all()
   719|    )
   720|    logger.debug(f"list_cashflow: Found {len(cashflow_items)} items for user {current_user.id}, Is Income: {is_income}")
   721|    return cashflow_items
   722|
   723|def _calculate_yearly_value_for_cashflow(db: Session, payload: schemas.CashFlowCreate | schemas.CashFlowUpdate):
   724|    if payload.linked_item_id and payload.linked_item_type and payload.percentage is not None:
   725|        linked_value = 0.0
   726|        if payload.linked_item_type == "asset":
   727|            linked_item = db.query(models.Asset).filter(models.Asset.id == payload.linked_item_id).first()
   728|            if linked_item:
   729|                linked_value = linked_item.value
   730|        elif payload.linked_item_type == "income":
   731|            linked_item = db.query(models.CashFlowItem).filter(
   732|                models.CashFlowItem.id == payload.linked_item_id,
   733|                models.CashFlowItem.is_income == True
   734|            ).first()
   735|            if linked_item:
   736|                linked_value = linked_item.yearly_value
   737|        
   738|        return linked_value * (payload.percentage / 100.0) * (12 if payload.frequency == "monthly" else 1)
   739|    else:
   740|        return payload.value * 12 if payload.frequency == "monthly" else payload.value
   741|
   742|
   743|@app.post("/cashflow", response_model=schemas.CashFlowOut, status_code=201, tags=["cashflow"])
   744|def create_cashflow(
   745|    payload: schemas.CashFlowCreate,
   746|    db: Session = Depends(database.get_db),
   747|    current_user: schemas.UserOut = Depends(auth.get_current_user)
   748|):
   749|    yearly_value = _calculate_yearly_value_for_cashflow(db, payload)
   750|    
   751|    item = models.CashFlowItem(
   752|        owner_id=current_user.id,
   753|        is_income=payload.is_income,
   754|        category=payload.category,
   755|        description=payload.description,
   756|        frequency=payload.frequency,
   757|        yearly_value=yearly_value,
   758|        annual_increase_percent=payload.annual_increase_percent,
   759|        inflation_percent=payload.inflation_percent,
   760|        person=payload.person,
   761|        start_date=payload.start_date,
   762|        end_date=payload.end_date,
   763|        taxable=payload.taxable,
   764|        tax_deductible=payload.taxable,
   765|        linked_item_id=payload.linked_item_id,
   766|        linked_item_type=payload.linked_item_type,
   767|        percentage=payload.percentage,
   768|        contributes_to_asset_id=payload.contributes_to_asset_id
   769|    )
   770|    db.add(item)
   771|    db.commit()
   772|    db.refresh(item)
   773|    return item
   774|
   775|@app.put("/cashflow/{item_id}", response_model=schemas.CashFlowOut, tags=["cashflow"])
   776|def update_cashflow(
   777|    item_id: int,
   778|    payload: schemas.CashFlowUpdate,
   779|    db: Session = Depends(database.get_db),
   780|    current_user: schemas.UserOut = Depends(auth.get_current_user)
   781|):
   782|    item = db.query(models.CashFlowItem).filter(models.CashFlowItem.id == item_id).first()
   783|    if not item:
   784|        raise HTTPException(status_code=404, detail="Item not found")
   785|    if item.owner_id != current_user.id:
   786|        raise HTTPException(status_code=403, detail="Not authorized")
   787|    
   788|    yearly_value = _calculate_yearly_value_for_cashflow(db, payload)
   789|    
   790|    for key, value in payload.model_dump(exclude_unset=True).items():
   791|        setattr(item, key, value)
   792|    item.yearly_value = yearly_value # Ensure yearly_value is explicitly set after calculation
   793|    
   794|    db.commit()
   795|    db.refresh(item)
   796|    return item
   797|
   798|@app.delete("/cashflow/{item_id}", status_code=204, tags=["cashflow"])
   799|def delete_cashflow(
   800|    item_id: int,
   801|    db: Session = Depends(database.get_db),
   802|    current_user: schemas.UserOut = Depends(auth.get_current_user)
   803|):
   804|    item = db.query(models.CashFlowItem).filter(models.CashFlowItem.id == item_id).first()
   805|    if not item:
   806|        raise HTTPException(status_code=404, detail="Item not found")
   807|    if item.owner_id != current_user.id:
   808|        raise HTTPException(status_code=403, detail="Not authorized")
   809|    
   810|
   811|    db.delete(item)
   812|    db.commit()
   813|    return Response(status_code=204)
   814|
   815|import socket
   816|
   817|@app.get("/debug/proxy-check", tags=["debug"], summary="Debug: Check Cloud SQL Proxy connectivity")
   818|async def debug_proxy_check():
   819|    host = "127.0.0.1"
   820|    port = 5432
   821|    try:
   822|        with socket.create_connection((host, port), timeout=5) as sock:
   823|            return {"status": "success", "message": f"Successfully connected to Cloud SQL Proxy at {host}:{port}"}
   824|    except socket.error as e:
   825|        return {"status": "error", "message": f"Failed to connect to Cloud SQL Proxy at {host}:{port}: {e}"}
   826|    except Exception as e:
   827|        return {"status": "error", "message": f"An unexpected error occurred: {e}"}
   828|
   829|@app.exception_handler(HTTPException)
   830|async def http_exception_handler(request: Request, exc: HTTPException):
   831|    logger.debug(f"HTTPException caught: {exc.detail}")
   832|    return JSONResponse(
   833|        status_code=exc.status_code,
   834|        content={"detail": exc.detail},
   835|    )
   836|
   837|@app.exception_handler(Exception)
   838|async def general_exception_handler(request: Request, exc: Exception):
   839|    error_traceback = traceback.format_exc()
   840|    logger.error(f"Unhandled exception: {error_traceback}", exc_info=True)
   841|    return JSONResponse(
   842|        status_code=500,
   843|        content={"detail": "Internal Server Error. Please check logs for details."},
   844|    )
