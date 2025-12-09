from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import timedelta, datetime
from typing import List
from jose import jwt, JWTError
import json
import os # Keep os for getenv in config.py (if not using pydantic-settings, but remove load_dotenv)

# Internal Modules
from . import models, schemas, database, auth, calculations
from .config import settings # 🌟 NEW: Import the settings object

# --- INITIALIZATION ---
# Create database tables if they don't exist
database.Base.metadata.create_all(bind=database.engine) 

app = FastAPI(title="Financial Projector API", version="1.0")

# --- CONFIGURATION ---
# Use the centralized setting
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES 

# --- CORS CONFIGURATION (CRITICAL for frontend connection) ---
origins = [
    "http://localhost:3000",  # Your React dev server
    "http://127.0.0.1:3000",
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
        
    # 2. Hash the password
    # 🚨 NOTE: You need a utility function to hash the password here (e.g., in auth.py)
    # Assuming auth.get_password_hash(password) exists:
    hashed_password = auth.get_password_hash(user.password)
    
    # 3. Create the database model instance
    db_user = models.User(
        email=user.email,
        hashed_password=hashed_password,
        is_active=True # Default to active
    )
    
    # 4. Save to DB
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # The response_model handles converting the model to schemas.UserOut
    return db_user

@app.post("/projections", response_model=schemas.ProjectionResponse, status_code=status.HTTP_201_CREATED)
def create_projection(
    projection_data: schemas.ProjectionRequest,
    user: schemas.UserOut = Depends(auth.get_current_user), 
    db: Session = Depends(database.get_db)
):
    """
    Creates a new projection, runs the calculation, and saves the results to the database.
    """
    try:
        # 1. Run the calculation with the corrected arguments
        projection_results = calculations.calculate_projection(
            years=projection_data.years,
            accounts=projection_data.accounts
        )
    except Exception as e:
        # This catches any remaining errors within calculations.py
        print(f"Calculation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Projection calculation failed: {e}"
        )

    # 2. Extract results from the dictionary returned by the calculation function
    final_value = projection_results["final_value"]
    data_json = projection_results["data_json"]
    total_contributed = projection_results["total_contributed"]
    total_growth = projection_results["total_growth"]
    
    # 3. Create the database object
    db_projection = models.Projection(
        owner_id=user.id, 
        name=projection_data.plan_name,
        years=projection_data.years,
        # Save the detailed results from the calculation function
        final_value=final_value,
        total_contributed=total_contributed,
        total_growth=total_growth,
        data_json=data_json,
        # Serialize the accounts list to store in the DB
        accounts=json.dumps([acc.model_dump() for acc in projection_data.accounts]),
    )

    db.add(db_projection)
    db.commit()
    db.refresh(db_projection)
    
    return db_projection

@app.get("/projections/{projection_id}", response_model=schemas.ProjectionResponse, tags=["projections"])
def get_projection_details(
    projection_id: int, 
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """Retrieves a single projection if the user is the owner."""
    
    # 1. Retrieve the Projection
    projection = db.query(models.Projection).filter(models.Projection.id == projection_id).first()
    
    # 2. Check if Projection Exists (404)
    if not projection:
        raise HTTPException(status_code=404, detail="Projection not found.")

    # 3. Check Ownership 
    if projection.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this projection.")
    
    # 4. Success
    return projection

@app.get("/projections", response_model=List[schemas.ProjectionResponse], tags=["projections"])
def list_projections(
    db: Session = Depends(database.get_db), 
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """Lists all projections owned by the current user."""
    
    projections = db.query(models.Projection).filter(models.Projection.owner_id == current_user.id).all()
    
    return projections

@app.put("/projections/{projection_id}", response_model=schemas.ProjectionOut, tags=["projections"])
def update_projection(
    projection_id: int,
    req: schemas.ProjectionRequest,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """Updates an existing projection if user is the owner."""
    projection = db.query(models.Projection).filter(models.Projection.id == projection_id).first()
    
    if not projection:
        raise HTTPException(status_code=404, detail="Projection not found.")
    
    if projection.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this projection.")
    
    # Recalculate using the new data
    result = calculations.calculate_projection(
        years=req.years,
        accounts=req.accounts
    )
    
    # Update projection fields
    projection.name = req.plan_name
    projection.years = req.years
    projection.final_value = result["final_value"]
    projection.total_contributed = result["total_contributed"]
    projection.total_growth = result["total_growth"]
    projection.data_json = result["data_json"]  # Already a JSON string
    projection.timestamp = datetime.utcnow()
    
    db.commit()
    db.refresh(projection)
    
    return projection
