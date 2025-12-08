from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import List

# Internal Modules
from . import models, schemas, database, auth, calculations

# --- INITIALIZATION ---
# Create database tables if they don't exist
database.Base.metadata.create_all(bind=database.engine) 

app = FastAPI(title="Financial Projector API", version="1.0")

# --- CONFIGURATION ---
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# --- AUTHENTICATION ROUTES ---

@app.post("/signup", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED, tags=["auth"])
def create_user(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    """Creates a new user account."""
    
    db_user = auth.get_user(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash the password and create the user
    hashed_password = auth.get_password_hash(user.password)
    db_user = models.User(email=user.email, hashed_password=hashed_password)
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.post("/token", tags=["auth"])
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    """Handles user login and returns a JWT access token."""
    
    user = auth.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=schemas.UserOut, tags=["auth"])
def read_users_me(current_user: schemas.UserOut = Depends(auth.get_current_user)):
    """Returns the details of the currently authenticated user."""
    return current_user

# --- PROJECTION ROUTES ---

@app.post("/projections", response_model=schemas.ProjectionResponse, status_code=status.HTTP_201_CREATED, tags=["projections"])
def create_projection(
    projection_data: schemas.ProjectionRequest, 
    db: Session = Depends(database.get_db), 
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """Creates a new financial projection and saves it to the database."""

    # 1. Run Calculation
    projection_df = calculations.calculate_projection(projection_data)
    
    # Extract final value and convert projection data to JSON string for storage
    final_value = projection_df['Value'].iloc[-1]
    projection_data_json = projection_df.to_json(orient='records')
    
    # 2. Create DB Model and Save
    db_projection = models.Projection(
        name=projection_data.plan_name,
        years=projection_data.years,
        final_value=final_value,
        projection_data=projection_data_json,
        owner_id=current_user.id  # CRITICAL: Link to the logged-in user ID
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
    # Note: Use first() not one() to avoid an exception if not found
    projection = db.query(models.Projection).filter(models.Projection.id == projection_id).first()
    
    # 2. Check if Projection Exists (404)
    if not projection:
        # Front-end will report this as "may not exist"
        raise HTTPException(status_code=404, detail="Projection not found.")

    # 3. Check Ownership (CRITICAL: This is where the failure is occurring)
    if projection.owner_id != current_user.id:
        # Front-end will report this as "or you lack access"
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
