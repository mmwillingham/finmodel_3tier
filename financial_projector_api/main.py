from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer # <-- FIXED SYNTAX
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import List
from jose import jwt, JWTError # <-- FIXED TYPO
import json
import os # Needed to access environment variables
from dotenv import load_dotenv # Needed to load .env file

# Internal Modules
from . import models, schemas, database, auth, calculations

# --- INITIALIZATION ---
# Load environment variables from .env file (for development)
load_dotenv()

# Create database tables if they don't exist
database.Base.metadata.create_all(bind=database.engine) 

app = FastAPI(title="Financial Projector API", version="1.0")

# --- CONFIGURATION ---
ACCESS_TOKEN_EXPIRE_MINUTES = 60

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

    # financial_projector_api/main.py (Insert this after your /token route)

    @app.get("/users/me", response_model=schemas.UserOut)
    def read_users_me(
        current_user: schemas.UserOut = Depends(auth.get_current_user)
    ):
        # auth.get_current_user already handled the token validation and user lookup.
        return current_user
    
# --- 1. Security Constants (Keep these, but make sure they are defined in auth.py too!) ---
# Read the SECRET_KEY from the environment
SECRET_KEY = os.getenv("SECRET_KEY", "fallback-insecure-key") 
ALGORITHM = "HS256"

# Ensure the key is loaded
if SECRET_KEY == "fallback-insecure-key":
    print("WARNING: SECRET_KEY not set in environment. Using insecure fallback.")

@app.get("/users/me", response_model=schemas.UserOut)
def read_users_me(
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Retrieves the details of the currently authenticated user.
    Uses auth.get_current_user to validate the JWT and fetch the user object.
    """
    # auth.get_current_user already handled token validation and user lookup.
    return current_user


@app.post("/projections", response_model=schemas.ProjectionResponse, status_code=status.HTTP_201_CREATED)
def create_projection(
    projection_data: schemas.ProjectionRequest,
    # 🌟 CRITICAL FIX: Use the imported authentication function for consistency
    user: schemas.UserOut = Depends(auth.get_current_user), 
    db: Session = Depends(database.get_db) # Use database.get_db for consistency
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
        # user is now schemas.UserOut, which has .id
        owner_id=user.id, 
        name=projection_data.name,
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
