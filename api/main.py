from fastapi import FastAPI, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import timedelta, datetime
from typing import List
from starlette.responses import RedirectResponse
from utils import google_oauth
from jose import jwt, JWTError
import json
import os # Keep os for getenv in config.py (if not using pydantic-settings, but remove load_dotenv)

# Internal Modules
import models
import schemas
import database
import auth
import calculations
from routers import custom_charts
from utils.email import send_email
from config import settings # 🌟 NEW: Import the settings object

# --- INITIALIZATION ---
# REMOVED: database.Base.metadata.create_all(bind=database.engine) # Alembic handles migrations

app = FastAPI(title="Financial Projector API", version="1.0", _proxy_headers=True, servers=[{"url": settings.PUBLIC_BACKEND_URL}])

app.include_router(custom_charts.router)

@app.get("/")
async def root():
    return {"message": "Financial Projector API is running!"}

@app.get("/debug-env", tags=["debug"])
async def debug_environment():
    return dict(os.environ)

# --- CONFIGURATION ---
# Use the centralized setting
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES 

# --- CORS CONFIGURATION (CRITICAL for frontend connection) ---
origins = [
    settings.FRONTEND_URL, # NEW: Allow requests from the deployed frontend
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,              
    allow_credentials=True,             
    allow_methods=["*"],                
    allow_headers=["*"],                
)
# --- END CORS CONFIGURATION ---

# 🚨 REMOVED: SECRET_KEY and ALGORITHM manual definitions are now in config.py
# --- 1. Security Constants ---
# SECRET_KEY = "..." 
# ALGORITHM = "HS256"

# --- 2. Define the Token Scheme ---
# NOTE: If tokenUrl is not defined in auth.py, it should be here.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

@app.get("/auth/google", tags=["oauth"], summary="Initiate Google OAuth login")
async def google_login():
    return RedirectResponse(url=google_oauth.get_google_auth_url())

@app.get("/auth/google/callback", tags=["oauth"], summary="Handle Google OAuth callback")
async def google_callback(code: str, db: Session = Depends(database.get_db)):
    try:
        # Exchange authorization code for tokens
        token_response = await google_oauth.get_google_oauth_token(code)
        access_token = token_response["access_token"]

        # Fetch user info from Google
        user_info = await google_oauth.get_google_user_info(access_token)
        google_id = user_info["id"]
        email = user_info["email"]
        
        # Authenticate or create user in our DB
        user = auth.authenticate_or_create_google_user(db, google_id, email)

        # Generate our own JWT for the authenticated user
        our_access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        our_access_token = auth.create_access_token(
            data={"sub": str(user.id)}, expires_delta=our_access_token_expires
        )

        # Redirect to frontend with our token
        # Frontend will store this token and log in
        redirect_url = f"{settings.FRONTEND_URL}/auth/google/callback?token={our_access_token}"
        print(f"DEBUG (main.py): Redirecting to: {redirect_url}") # NEW DEBUG PRINT
        return RedirectResponse(url=redirect_url)

    except HTTPException as e:
        # Pass through explicit HTTPExceptions
        raise e
    except Exception as e:
        print(f"ERROR (main.py) in google_callback: {e}") # Modified ERROR print
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
    # This function should be defined in your 'auth' module
    user = auth.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # NEW: Check if the user's email is confirmed
    if not user.is_confirmed:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Please confirm your email address before logging in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create the access token using a function from your 'auth' module
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=schemas.UserOut)
def read_users_me(
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    return current_user

@app.get("/debug/users", response_model=list[schemas.UserOut], summary="Debug: Get all users from DB")
def debug_get_all_users(db: Session = Depends(database.get_db)):
    print("DEBUG (main.py): Fetching all users from database via /debug/users endpoint.")
    users = db.query(models.User).all()
    print(f"DEBUG (main.py): Found {len(users)} users.")
    return users

@app.get("/debug/db-info", summary="Debug: Get current database info")
def debug_db_info(db: Session = Depends(database.get_db)):
    result = db.execute(text("SELECT current_database();")).scalar_one()
    print(f"DEBUG (main.py): Current database from /debug/db-info: {result}")
    return {"current_database": result}

@app.post("/signup", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def create_user(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    """
    Registers a new user in the database.
    """
    # 1. Check if user already exists (by username or email)
    db_user = db.query(models.User).filter(
        (models.User.email == user.email)
    ).first()
    
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
        
    try:
        # 2. Hash the password
        hashed_password = auth.get_password_hash(user.password)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password did not meet requirements: {e}"
        )
    
    # 3. Create the database model instance
    db_user = models.User(
        email=user.email,
        hashed_password=hashed_password,
        is_active=True,
        is_confirmed=False # New users are unconfirmed by default
    )
    
    # 4. Save to DB
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Send confirmation email
    confirmation_token = auth.create_email_confirmation_token(db, db_user.id)
    confirmation_link = f"{settings.FRONTEND_URL}/confirm-email?token={confirmation_token}"
    print(f"Email confirmation link: {confirmation_link}")
    send_email(
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

    db.delete(user_to_delete)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@app.get("/admin/users", response_model=List[schemas.UserOut], tags=["admin"])
def list_all_manageable_users(
    db: Session = Depends(database.get_db),
    current_admin_user: schemas.UserOut = Depends(auth.get_current_admin_user)
):
    """
    Allows an admin user to retrieve a list of all other users.
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
    # In a real application, you would send an email with a reset token here.
    # For now, we'll just acknowledge the request.
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if user:
        token = auth.create_password_reset_token(db, user.id)
        reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        print(f"Password reset link: {reset_link}")
        send_email(
            to_email=user.email,
            subject="Financial Projector - Password Reset Request",
            body=f"""Hello,

You have requested a password reset for your Financial Projector account.

Please use the following link to reset your password: {reset_link}

This link will expire in 1 hour.

If you did not request a password reset, please ignore this email.

This is why I put the new password reset link in a variable. I need the front end url from settings.py

Best regards,
The Financial Projector Team"""
    )
    
    # Always return a generic success message to prevent email enumeration
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
        raise e # Re-raise HTTP exceptions like "Invalid or expired token."
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
        raise e # Re-raise HTTP exceptions like "Invalid or expired confirmation token."
    return confirmed_user

@app.post("/projections", response_model=schemas.ProjectionResponse, status_code=status.HTTP_201_CREATED)
def create_projection(
    projection_data: schemas.ProjectionRequest,
    user: schemas.UserOut = Depends(auth.get_current_user), 
    db: Session = Depends(database.get_db)
):
    """
    Creates a new projection, runs the calculation, and saves the results to the database."""
    try:
        projection_results = calculations.calculate_projection(
            years=projection_data.years,
            accounts=projection_data.accounts
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    final_value = projection_results["final_value"]
    total_contributed = projection_results["total_contributed"]
    total_growth = projection_results["total_growth"]
    data_json = projection_results["data_json"]

    db_projection = models.Projection(
        owner_id=user.id,
        name=projection_data.plan_name,
        years=projection_data.years,
        final_value=final_value,
        total_contributed=total_contributed,
        total_growth=total_growth,
        data_json=data_json,
        accounts_json=json.dumps([acc.model_dump() for acc in projection_data.accounts]),
    )

    db.add(db_projection)
    db.commit()
    db.refresh(db_projection)

    return db_projection

@app.get("/projections/{projection_id}", response_model=schemas.ProjectionDetailOut, tags=["projections"])
def get_projection_details(
    projection_id: int, 
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Retrieves a single projection if the user is the owner."""
    
    projection = db.query(models.Projection).filter(models.Projection.id == projection_id).first()
    
    if not projection:
        raise HTTPException(status_code=404, detail="Projection not found.")

    if projection.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this projection.")
    
    return projection

@app.get("/projections", response_model=List[schemas.ProjectionResponse], tags=["projections"])
def list_projections(
    db: Session = Depends(database.get_db), 
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Lists all projections owned by the current user."""
    
    projections = db.query(models.Projection).filter(models.Projection.owner_id == current_user.id).all()
    
    return projections

@app.put("/projections/{projection_id}", response_model=schemas.ProjectionOut, tags=["projections"])
def update_projection(
    projection_id: int,
    req: schemas.ProjectionRequest,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Updates an existing projection if user is the owner."""
    projection = db.query(models.Projection).filter(models.Projection.id == projection_id).first()
    
    if not projection:
        raise HTTPException(status_code=404, detail="Projection not found.")
    
    if projection.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this projection.")
    
    result = calculations.calculate_projection(
        years=req.years,
        accounts=req.accounts
    )
    
    projection.name = req.plan_name
    projection.years = req.years
    projection.final_value = result["final_value"]
    projection.total_contributed = result["total_contributed"]
    projection.total_growth = result["total_growth"]
    projection.data_json = result["data_json"]
    projection.accounts_json = json.dumps([acc.model_dump() for acc in req.accounts]),
    projection.timestamp = datetime.utcnow()
    
    db.commit()
    db.refresh(projection)
    return projection

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
        raise HTTPException(status_code=403, detail="Not authorized to delete this projection.")
    db.delete(projection)
    db.commit()
    return Response(status_code=204)

@app.get("/cashflow", response_model=List[schemas.CashFlowOut], tags=["cashflow"])
def list_cashflow(
    is_income: bool,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    return (
        db.query(models.CashFlowItem)
        .filter(models.CashFlowItem.owner_id == current_user.id)
        .filter(models.CashFlowItem.is_income == is_income)
        .order_by(models.CashFlowItem.id.desc())
        .all()
    )

@app.post("/cashflow", response_model=schemas.CashFlowOut, status_code=201, tags=["cashflow"])
def create_cashflow(
    payload: schemas.CashFlowCreate,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    yearly_value = payload.value * 12 if payload.frequency == "monthly" else payload.value
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
        tax_deductible=payload.tax_deductible,
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
    yearly_value = payload.value * 12 if payload.frequency == "monthly" else payload.value
    item.is_income = payload.is_income
    item.category = payload.category
    item.description = payload.description
    item.frequency = payload.frequency
    item.yearly_value = yearly_value
    item.annual_increase_percent = payload.annual_increase_percent
    item.inflation_percent = payload.inflation_percent
    item.person = payload.person
    item.start_date = payload.start_date
    item.end_date = payload.end_date
    item.taxable = payload.taxable
    item.tax_deductible = payload.tax_deductible
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

@app.get("/settings", response_model=schemas.UserSettingsOut, tags=["settings"])
def get_settings(
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    settings = db.query(models.UserSettings).filter(models.UserSettings.user_id == current_user.id).first()
    if not settings:
        settings = models.UserSettings(
            user_id=current_user.id,
            default_inflation_percent=2.0,
            asset_categories="Real Estate,Vehicles,Investments,Other",
            liability_categories="Mortgage,Car Loan,Credit Card,Student Loan,Other",
            income_categories="Salary,Bonus,Investment Income,Other",
            expense_categories="Housing,Transportation,Food,Healthcare,Entertainment,Other",
            person1_first_name="Person 1",
            person1_last_name="",
            person2_first_name="Person 2",
            person2_last_name="",
            address="",
            city="",
            state="",
            zip_code="",
            email="",
            projection_years=30
        )
        db.add(settings)
        try:
            db.commit()
            db.refresh(settings)
        except Exception as e:
            db.rollback()
            # Another request may have created it, try to fetch again
            settings = db.query(models.UserSettings).filter(models.UserSettings.user_id == current_user.id).first()
            if not settings:
                # If still not found, re-raise the original exception
                raise e
    return settings

@app.put("/settings", response_model=schemas.UserSettingsOut, tags=["settings"])
def update_settings(
    payload: schemas.UserSettingsUpdate,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    settings = db.query(models.UserSettings).filter(models.UserSettings.user_id == current_user.id).first()
    if not settings:
        settings = models.UserSettings(user_id=current_user.id)
        db.add(settings)
    settings.default_inflation_percent = payload.default_inflation_percent
    if payload.asset_categories is not None:
        settings.asset_categories = payload.asset_categories
    if payload.liability_categories is not None:
        settings.liability_categories = payload.liability_categories
    if payload.income_categories is not None:
        settings.income_categories = payload.income_categories
    if payload.expense_categories is not None:
        settings.expense_categories = payload.expense_categories
    if payload.person1_first_name is not None:
        settings.person1_first_name = payload.person1_first_name
    if payload.person1_last_name is not None:
        settings.person1_last_name = payload.person1_last_name
    if payload.person1_birthdate is not None:
        settings.person1_birthdate = payload.person1_birthdate
    if payload.person1_cell_phone is not None:
        settings.person1_cell_phone = payload.person1_cell_phone
    if payload.person2_first_name is not None:
        settings.person2_first_name = payload.person2_first_name
    if payload.person2_last_name is not None:
        settings.person2_last_name = payload.person2_last_name
    if payload.person2_birthdate is not None:
        settings.person2_birthdate = payload.person2_birthdate
    if payload.person2_cell_phone is not None:
        settings.person2_cell_phone = payload.person2_cell_phone
    if payload.address is not None:
        settings.address = payload.address
    if payload.city is not None:
        settings.city = payload.city
    if payload.state is not None:
        settings.state = payload.state
    if payload.zip_code is not None:
        settings.zip_code = payload.zip_code
    if payload.email is not None:
        settings.email = payload.email
    if payload.projection_years is not None:
        settings.projection_years = payload.projection_years
    if payload.show_chart_totals is not None:
        settings.show_chart_totals = payload.show_chart_totals
    try:
        db.commit()
        db.refresh(settings)
        return settings
    except Exception as e:
        db.rollback()
        print(f"Error updating settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update settings: {e}")


# --- ASSET ENDPOINTS ---

@app.get("/assets", response_model=List[schemas.AssetOut], tags=["assets"])
def list_assets(
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    return (
        db.query(models.Asset)
        .filter(models.Asset.owner_id == current_user.id)
        .order_by(models.Asset.id.desc())
        .all()
    )


@app.post("/assets", response_model=schemas.AssetOut, status_code=201, tags=["assets"])
def create_asset(
    payload: schemas.AssetCreate,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    asset = models.Asset(
        owner_id=current_user.id,
        name=payload.name,
        category=payload.category,
        value=payload.value,
        annual_increase_percent=payload.annual_increase_percent,
        annual_change_type=payload.annual_change_type, # New field
        start_date=payload.start_date,  # New field
        end_date=payload.end_date      # New field
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@app.put("/assets/{asset_id}", response_model=schemas.AssetOut, tags=["assets"])
def update_asset(
    asset_id: int,
    payload: schemas.AssetUpdate,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    asset.name = payload.name
    asset.category = payload.category
    asset.value = payload.value
    asset.annual_increase_percent = payload.annual_increase_percent
    asset.annual_change_type = payload.annual_change_type # New field
    asset.start_date = payload.start_date  # New field
    asset.end_date = payload.end_date      # New field
    db.commit()
    db.refresh(asset)
    return asset


@app.delete("/assets/{asset_id}", status_code=204, tags=["assets"])
def delete_asset(
    asset_id: int,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    db.delete(asset)
    db.commit()
    return Response(status_code=204)


# --- LIABILITY ENDPOINTS ---

@app.get("/liabilities", response_model=List[schemas.LiabilityOut], tags=["liabilities"])
def list_liabilities(
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    return (
        db.query(models.Liability)
        .filter(models.Liability.owner_id == current_user.id)
        .order_by(models.Liability.id.desc())
        .all()
    )


@app.post("/liabilities", response_model=schemas.LiabilityOut, status_code=201, tags=["liabilities"])
def create_liability(
    payload: schemas.LiabilityCreate,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    liability = models.Liability(
        owner_id=current_user.id,
        name=payload.name,
        category=payload.category,
        value=payload.value,
        annual_increase_percent=payload.annual_increase_percent,
        annual_change_type=payload.annual_change_type, # New field
        start_date=payload.start_date,  # New field
        end_date=payload.end_date      # New field
    )
    db.add(liability)
    db.commit()
    db.refresh(liability)
    return liability


@app.put("/liabilities/{liability_id}", response_model=schemas.LiabilityOut, tags=["liabilities"])
def update_liability(
    liability_id: int,
    payload: schemas.LiabilityUpdate,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    liability = db.query(models.Liability).filter(models.Liability.id == liability_id).first()
    if not liability:
        raise HTTPException(status_code=404, detail="Liability not found")
    if liability.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    liability.name = payload.name
    liability.category = payload.category
    liability.value = payload.value
    liability.annual_increase_percent = payload.annual_increase_percent
    liability.annual_change_type = payload.annual_change_type # New field
    liability.start_date = payload.start_date  # New field
    liability.end_date = payload.end_date      # New field
    db.commit()
    db.refresh(liability)
    return liability


@app.delete("/liabilities/{liability_id}", status_code=204, tags=["liabilities"])
def delete_liability(
    liability_id: int,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    item = db.query(models.Liability).filter(models.Liability.id == liability_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    db.delete(item)
    db.commit()
    return Response(status_code=204)

# --- Custom Chart Endpoints ---

@app.post("/custom_charts", response_model=schemas.CustomChartOut, status_code=status.HTTP_201_CREATED, tags=["custom_charts"])
def create_custom_chart(
    payload: schemas.CustomChartCreate,
    user: schemas.UserOut = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    db_chart = models.CustomChart(
        user_id=user.id,
        name=payload.name,
        chart_type=payload.chart_type,
        data_sources=payload.data_sources,
        series_configurations=payload.series_configurations,
        x_axis_label=payload.x_axis_label,
        y_axis_label=payload.y_axis_label,
    )
    db.add(db_chart)
    db.commit()
    db.refresh(db_chart)
    return db_chart

@app.get("/custom_charts", response_model=List[schemas.CustomChartOut], tags=["custom_charts"])
def list_custom_charts(
    user: schemas.UserOut = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    charts = db.query(models.CustomChart).filter(models.CustomChart.user_id == user.id).all()
    return charts

@app.get("/custom_charts/{chart_id}", response_model=schemas.CustomChartOut, tags=["custom_charts"])
def get_custom_chart(
    chart_id: int,
    user: schemas.UserOut = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    chart = db.query(models.CustomChart).filter(models.CustomChart.id == chart_id, models.CustomChart.owner_id == user.id).first()
    if not chart:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custom chart not found")
    return chart

@app.put("/custom_charts/{chart_id}", response_model=schemas.CustomChartOut, tags=["custom_charts"])
def update_custom_chart(
    chart_id: int,
    payload: schemas.CustomChartUpdate,
    user: schemas.UserOut = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    chart = db.query(models.CustomChart).filter(models.CustomChart.id == chart_id, models.CustomChart.owner_id == user.id).first()
    if not chart:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custom chart not found")
    
    chart.chart_name = payload.chart_name
    chart.chart_type = payload.chart_type
    chart.chart_data = json.dumps(payload.chart_data)
    db.commit()
    db.refresh(chart)
    return chart

@app.delete("/custom_charts/{chart_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["custom_charts"])
def delete_custom_chart(
    chart_id: int,
    user: schemas.UserOut = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    chart = db.query(models.CustomChart).filter(models.CustomChart.id == chart_id, models.CustomChart.owner_id == user.id).first()
    if not chart:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custom chart not found")
    
    db.delete(chart)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)