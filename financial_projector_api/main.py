from fastapi import FastAPI, Depends, HTTPException, status, Path
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import timedelta
import json

# Internal Modules
from . import models, schemas, database, auth, calculations

# --- INITIALIZATION ---
app = FastAPI(
    title="Financial Projector API",
    description="Backend API for financial projection and user management."
)

# Replace with your desired database URL configuration
database.Base.metadata.create_all(bind=database.engine)


# --- CORS CONFIGURATION (CRUCIAL FOR REACT) ---
origins = [
    "http://localhost:3000",  # Your React Frontend
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- DEPENDENCIES ---



# --- USER/AUTH ROUTES ---

@app.post("/signup", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED, tags=["auth"])
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """Registers a new user."""
    db_user = auth.get_user(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password using the SCrypt context
    hashed_password = auth.get_password_hash(user.password)
    
    db_user = models.User(email=user.email, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.post("/token", tags=["auth"])
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Authenticates user and returns an access token."""
    user = auth.authenticate_user(db, form_data.username, form_data.password)
    if not user:
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

@app.get("/users/me", response_model=schemas.UserOut, tags=["users"])
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    """Returns the currently logged-in user's details."""
    return current_user


# --- PROJECTION ROUTES ---

@app.post("/projections", response_model=schemas.ProjectionResponse, tags=["projections"])
def create_projection(
    projection_data: schemas.ProjectionRequest, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Calculates and saves a new financial projection."""
    
    # 1. Calculation: Run the financial model
    projection_df = calculations.calculate_projection(projection_data) 
    
    # 2. Data Preparation
    data_json = projection_df.to_json(orient='records')
    
    # 3. Create Database Model Instance (CRITICAL: Assign owner_id)
    new_projection = models.Projection(
        name=projection_data.plan_name,
        years=projection_data.years,
        owner_id=current_user.id, # Link the projection to the logged-in user
        data_json=data_json
    )
    
    # 4. Save to database
    db.add(new_projection)
    db.commit()
    db.refresh(new_projection)
    
    # 5. Prepare Response Data
    final_value = projection_df['Value'].iloc[-1] if not projection_df.empty else 0
    data_list = json.loads(new_projection.data_json)

    # Note: Return the full data to the front-end for immediate display
    return {
        "id": new_projection.id,
        "name": new_projection.name,
        "years": new_projection.years,
        "final_value": final_value,
        "projection_data": data_list
    }

@app.get("/projections/{projection_id}", response_model=schemas.ProjectionResponse, tags=["projections"])
def get_projection_details(
    projection_id: int = Path(..., description="ID of the projection to retrieve"),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves the full details of a single projection, ensuring ownership.
    """
    
    # CRUCIAL: Filter by both ID AND owner_id to enforce ownership (Foreign Key check)
    projection = db.query(models.Projection).filter(
        models.Projection.id == projection_id,
        models.Projection.owner_id == current_user.id 
    ).first()
    
    if not projection:
        # Deny access without revealing if the ID exists (security best practice)
        raise HTTPException(status_code=404, detail="Projection not found or access denied.")
    
    # Prepare and return the response
    data_list = json.loads(projection.data_json)
    final_value = data_list[-1]['Value'] if data_list else 0

    return {
        "id": projection.id,
        "name": projection.name,
        "years": projection.years,
        "final_value": final_value,
        "projection_data": data_list
    }
