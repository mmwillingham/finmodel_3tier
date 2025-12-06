import json
from datetime import timedelta
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, status, Path, Query
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import exc

from financial_projector_api.database import SessionLocal, engine 
from . import models, schemas, auth, calculations # Ensure all modules are imported

# Create tables in the DB if they don't exist
models.Base.metadata.create_all(bind=engine) 

app = FastAPI(title="Financial Projection API")

# --- Dependencies ---

# Dependency to get a database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Authentication Endpoints ---

@app.post("/signup", response_model=schemas.User, tags=["auth"])
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """Registers a new user."""
    db_user = auth.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = auth.hash_password(user.password)
    
    db_user = models.User(email=user.email, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.post("/token", response_model=schemas.Token, tags=["auth"])
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Authenticates user and returns JWT token."""
    user = auth.get_user_by_email(db, email=form_data.username)
    
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

# --- User Endpoint ---

@app.get("/users/me", response_model=schemas.User, tags=["users"])
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    """Returns the profile of the currently authenticated user."""
    return current_user

# --- Projection Endpoints (Secured CRUD) ---

@app.post("/projections", response_model=schemas.ProjectionResponse, tags=["projections"])
def save_and_calculate_projection(
    request_data: schemas.ProjectionRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Receives inputs, calculates future value, saves it linked to the user, and returns the full result.
    """
    
    # 1. Prepare Inputs for Calculation
    initial_balances = [a.initial_balance for a in request_data.accounts]
    monthly_contributions = [a.monthly_contribution for a in request_data.accounts]
    annual_rates_percent = [a.annual_rate_percent for a in request_data.accounts]
    
    if not initial_balances:
        raise HTTPException(status_code=400, detail="No accounts provided for calculation.")

    # 2. Execute Calculation Logic
    final_value, total_contributed, full_projection_json = calculations.calculate_future_value_dynamic(
        initial_balances,
        monthly_contributions,
        annual_rates_percent,
        request_data.years
    )
    
    # 3. Create the Projection Record
    db_projection = models.Projection(
        name=request_data.projection_name,
        years=request_data.years,
        data_json=full_projection_json,
        owner_id=current_user.id # CRUCIAL: Link to the authenticated user
    )
    
    # 4. Save to Database
    db.add(db_projection)
    db.commit()
    db.refresh(db_projection)

    # 5. Prepare and Return Response
    response_data = json.loads(full_projection_json)
    
    return {
        "id": db_projection.id,
        "name": db_projection.name,
        "final_value": final_value,
        "years": db_projection.years,
        "projection_data": response_data 
    }

@app.get("/projections", response_model=List[schemas.ProjectionSummary], tags=["projections"])
def get_all_user_projections(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves a summary of all saved projections belonging to the authenticated user.
    """
    
    # Securely query ONLY the projections owned by the current user
    projections = db.query(models.Projection).filter(
        models.Projection.owner_id == current_user.id
    ).order_by(models.Projection.timestamp.desc()).all()
    
    # Manually map the data_json to the final_value and total_contributed fields for the summary
    summaries = []
    for proj in projections:
        try:
            data = json.loads(proj.data_json)
            summaries.append(schemas.ProjectionSummary(
                id=proj.id,
                name=proj.name,
                years=proj.years,
                timestamp=proj.timestamp,
                final_value=data.get('final_value', 0.0),
                total_contributed=data.get('total_contributed', 0.0)
            ))
        except json.JSONDecodeError:
            # Handle corrupt/old data if necessary
            continue
            
    return summaries


@app.get("/projections/{projection_id}", response_model=schemas.ProjectionResponse, tags=["projections"])
def get_projection_details(
    projection_id: int = Path(..., description="ID of the projection to retrieve"),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves the full details of a single projection, ensuring ownership.
    """
    
    projection = db.query(models.Projection).filter(
        models.Projection.id == projection_id,
        models.Projection.owner_id == current_user.id # CRUCIAL: Ownership check
    ).first()
    
    if not projection:
        # Deny access without revealing if the ID exists (security best practice)
        raise HTTPException(status_code=404, detail="Projection not found or access denied.")
    
    # Prepare and return the response
    data = json.loads(projection.data_json)
    return {
        "id": projection.id,
        "name": projection.name,
        "final_value": data.get('final_value'),
        "years": projection.years,
        "projection_data": data
    }


@app.delete("/projections/{projection_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["projections"])
def delete_projection(
    projection_id: int = Path(..., description="ID of the projection to delete"),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Deletes a projection record, ensuring it belongs to the authenticated user.
    """
    
    projection = db.query(models.Projection).filter(
        models.Projection.id == projection_id,
        models.Projection.owner_id == current_user.id
    )
    
    if not projection.first():
        raise HTTPException(status_code=404, detail="Projection not found or access denied.")
    
    projection.delete(synchronize_session=False)
    db.commit()
    return None
