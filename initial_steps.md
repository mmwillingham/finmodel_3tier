<<<<<<< HEAD
# NOTE. I may have the wrong locations of the files below, so here is the tree.
.
├── venv/                           # ⬅️ Your Python Virtual Environment (Created by `python -m venv venv`)
├── financial_projector_api/        # ⬅️ FastAPI BACKEND PACKAGE (Port 8000)
│   ├── __init__.py                 # EMPTY file, required for package imports (Crucial!)
│   ├── main.py                     # FastAPI app initialization, routes (Auth, CRUD, Projections)
│   ├── auth.py                     # JWT logic, password hashing, dependency functions
│   ├── database.py                 # SQLAlchemy setup, engine, session, get_db()
│   ├── models.py                   # SQLAlchemy ORM classes (User, Projection)
│   ├── schemas.py                  # Pydantic models (User, Token, ProjectionRequest, ProjectionResponse)
│   ├── calculations.py             # Core Python financial projection logic
│   └── .env (or config file)       # (Optional) Stores SECRET_KEY and DATABASE_URL
│
└── financial-projector-ui/         # ⬅️ React FRONTEND PROJECT (Port 3000)
    ├── node_modules/               # NPM dependencies (created by `npm install`)
    ├── public/                     # Static files (index.html, etc.)
    ├── src/
    │   ├── App.js                  # Main component, sets up the Router and AuthProvider (Crucial!)
    │   ├── index.js                # App entry point
    │   ├── context/
    │   │   └── AuthContext.js      # Global state for user and token management
    │   ├── services/
    │   │   ├── auth.service.js     # Handles login/signup/logout API calls and token storage
    │   │   └── api.service.js      # Axios instance with JWT interceptor for protected calls
    │   ├── components/
    │   │   ├── Header.js           # Navigation bar with conditional links and Logout
    │   │   ├── ProtectedRoute.js   # Router protection logic
    │   │   ├── LoginPage.js        # Login form
    │   │   ├── SignupPage.js       # Signup form
    │   │   ├── Calculator.js       # Dynamic input form and POST logic (The core)
    │   │   ├── Dashboard.js        # List of saved projections (GET summary)
    │   │   └── ProjectionDetail.js # Renders chart and detailed table (GET detail)
    │   └── utils/
    │       └── ChartConfig.js      # Chart.js data transformation logic
    ├── package.json                # NPM project definition and dependencies
    └── .gitignore

    

=======
# NOTE. I may have the wrong locations of the files below, so here is the tree.
```
.
├── venv/                           # ⬅️ Your Python Virtual Environment (Created by `python -m venv venv`)
├── financial_projector_api/        # ⬅️ FastAPI BACKEND PACKAGE (Port 8000)
│   ├── __init__.py                 # EMPTY file, required for package imports (Crucial!)
│   ├── main.py                     # FastAPI app initialization, routes (Auth, CRUD, Projections)
│   ├── auth.py                     # JWT logic, password hashing, dependency functions
│   ├── database.py                 # SQLAlchemy setup, engine, session, get_db()
│   ├── models.py                   # SQLAlchemy ORM classes (User, Projection)
│   ├── schemas.py                  # Pydantic models (User, Token, ProjectionRequest, ProjectionResponse)
│   ├── calculations.py             # Core Python financial projection logic
│   └── .env (or config file)       # (Optional) Stores SECRET_KEY and DATABASE_URL
│
└── financial-projector-ui/         # ⬅️ React FRONTEND PROJECT (Port 3000)
    ├── node_modules/               # NPM dependencies (created by `npm install`)
    ├── public/                     # Static files (index.html, etc.)
    ├── src/
    │   ├── App.js                  # Main component, sets up the Router and AuthProvider (Crucial!)
    │   ├── index.js                # App entry point
    │   ├── context/
    │   │   └── AuthContext.js      # Global state for user and token management
    │   ├── services/
    │   │   ├── auth.service.js     # Handles login/signup/logout API calls and token storage
    │   │   └── api.service.js      # Axios instance with JWT interceptor for protected calls
    │   ├── components/
    │   │   ├── Header.js           # Navigation bar with conditional links and Logout
    │   │   ├── ProtectedRoute.js   # Router protection logic
    │   │   ├── LoginPage.js        # Login form
    │   │   ├── SignupPage.js       # Signup form
    │   │   ├── Calculator.js       # Dynamic input form and POST logic (The core)
    │   │   ├── Dashboard.js        # List of saved projections (GET summary)
    │   │   └── ProjectionDetail.js # Renders chart and detailed table (GET detail)
    │   └── utils/
    │       └── ChartConfig.js      # Chart.js data transformation logic
    ├── package.json                # NPM project definition and dependencies
    └── .gitignore
```
    

>>>>>>> 2726cc4aeed3f782c9087ee5ad8e4c5c1532c3d0
# Phase 1: Setting up the Secure Back-End Foundation
We will start by creating the project structure, setting up the database connection, and defining the data model (users and projections).

## Step 1: Project Setup and Dependencies
Create a new directory for your API and install the core Python libraries.
fastapi & uvicorn: The web framework and server.
pydantic: Used by FastAPI for data validation (defining user inputs).
sqlalchemy & psycopg2: The Python database toolkit and PostgreSQL driver.
python-jose & passlib[bcrypt]: Essential for secure JWT token handling and password hashing.
```
mkdir financial_projector_api
cd financial_projector_api
pip install fastapi "uvicorn[standard]" python-multipart pydantic "pydantic[email]" sqlalchemy psycopg2-binary python-jose passlib[bcrypt]
```
## Step 2: Database Connection (PostgreSQL)
Set up a basic connection file. This is where you configure your link to the hosted PostgreSQL database.
```
cat <<EOF>database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Replace with your actual connection string (Host, Port, User, Password, DB Name)
SQLALCHEMY_DATABASE_URL = "postgresql://user:password@host/dbname" 

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
EOF
```

## Step 3: Define the Data Model (SQLAlchemy)
Define how your Users and Projections tables look in PostgreSQL.
```
cat <<EOF>models.py
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from financial_projector_api.database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Integer, default=1)
    # Link to the user's projections
    projections = relationship("Projection", back_populates="owner")

class Projection(Base):
    __tablename__ = "projections"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    years = Column(Integer)
    # Store all inputs/outputs as a JSON string (similar to your old inputs column)
    data_json = Column(String) 
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Foreign Key to link the projection to the user
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="projections")

# To initialize the tables in the database (run once)
# Base.metadata.create_all(bind=engine)
EOF
```
# Phase 2: User Authentication
This is the most critical security component. We'll set up the secure hashing and JWT token generation.

## Step 4: Security Utilities
Create utilities to handle password hashing and JWT token creation/decoding.
1. Data Validation. Uses Pydantic to define the required structure for data coming in (requests) and going out (responses).
```
cat <<EOF>schemas.py
from pydantic import BaseModel, EmailStr
from typing import Optional
from fastapi.security import OAuth2PasswordRequestForm

# --- User Schemas ---

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    is_active: bool

    class Config:
        # Allows Pydantic to read data from SQLAlchemy models
        from_attributes = True

# --- Projection Schemas ---

class ProjectionBase(BaseModel):
    name: str
    years: int
    data_json: str # The serialized inputs/results

class ProjectionCreate(ProjectionBase):
    pass

class Projection(ProjectionBase):
    id: int
    timestamp: datetime
    owner_id: int

    class Config:
        from_attributes = True

# --- Authentication Schemas ---

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
EOF
```
2. Secure Hashing and JWT Management
This module handles all password hashing and the creation/decoding of JSON Web Tokens (JWT).

```
cat <<EOF>auth.py
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from . import models, schemas
from financial_projector_api.database import SessionLocal # Import database session

# --- Configuration ---
# You must change these values!
SECRET_KEY = "YOUR_SUPER_SECRET_KEY" 
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# --- Hashing Context (used for passwords) ---
# bcrypt is the standard secure algorithm for hashing passwords
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- OAuth2 Scheme (used to extract token from request headers) ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# --- Database Dependency (Helper to access DB in this module) ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Password Utilities ---

def hash_password(password: str):
    """Securely hashes a plain-text password."""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str):
    """Verifies a plain-text password against a hashed one."""
    return pwd_context.verify(plain_password, hashed_password)

# --- JWT Token Utilities ---

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Creates a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_user_by_email(db: Session, email: str):
    """Helper to fetch a user from the DB by email."""
    return db.query(models.User).filter(models.User.email == email).first()

# --- Authentication Dependency ---

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """
    Dependency function used in API endpoints to secure them.
    Raises an error if the token is invalid or the user is not found.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Decode the token to get the user's email
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = schemas.TokenData(email=email)
    except JWTError:
        raise credentials_exception
    
    # Fetch the user object from the database
    user = get_user_by_email(db, email=token_data.email)
    if user is None:
        raise credentials_exception
    return user
EOF
```
3. Authentication Endpoints
Create the API routes for user registration and login.
main.py is the primary FastAPI file
NOTE: This is created later in these steps.

# Phase 3
1. The Calculation Module (calculations.py). 
We'll take your dynamic calculation logic and place it here. Note that the function signature will be slightly simplified as we pass the dynamic inputs as lists.
```
cat <<EOF>calculations.py
import pandas as pd
import json

def calculate_future_value_dynamic(initial_balances: list, monthly_contributions: list, annual_rates_percent: list, years: int):
    """
    Calculates the future value for a dynamic number of accounts.
    Returns the final balance, total contributed, and a JSON-encoded string 
    containing the full projection (for storage).
    """
    
    num_accounts = len(initial_balances)
    rate_annual = [r / 100.0 for r in annual_rates_percent]
    rate_monthly = [r / 12 for r in rate_annual]
    total_months = years * 12
    
    # Use a list of lists to hold dynamic account balances over time
    account_balance_lists = [[] for _ in range(num_accounts)]
    
    total_portfolio_numeric = []
    year_list = []
    
    current_balances = list(initial_balances)
    total_contributed = sum(initial_balances)
    
    for month in range(1, total_months + 1):
        
        for i in range(num_accounts):
            current_balances[i] += monthly_contributions[i]
            total_contributed += monthly_contributions[i]
            current_balances[i] *= (1 + rate_monthly[i])
        
        if month % 12 == 0:
            year_list.append(month // 12)
            
            for i in range(num_accounts):
                account_balance_lists[i].append(current_balances[i])
            
            total_portfolio_numeric.append(sum(current_balances))
    
    # --- Prepare the Output Data ---
    
    # 1. Create dynamic column names for the internal DataFrame
    df_col_names_internal = [f'Account {i+1} Balance' for i in range(num_accounts)]
    
    data = {'Year': year_list}
    for i in range(num_accounts):
        data[df_col_names_internal[i]] = account_balance_lists[i]

    data['Total Projected Balance'] = total_portfolio_numeric
    
    # The final data structure to be stored and returned
    projection_data = {
        "final_value": total_portfolio_numeric[-1] if total_portfolio_numeric else 0.0,
        "total_contributed": total_contributed,
        "yearly_data": data
    }

    # Return the final value, total contributed, and the full projection data (as a JSON string)
    return projection_data["final_value"], total_contributed, json.dumps(projection_data)
EOF
```

2. Update Schemas (schemas.py)
We need a new schema to validate the complex list of inputs coming from the JavaScript front-end.
```
cat <<EOF>schemas.py
import pandas as pd
import json

def calculate_future_value_dynamic(initial_balances: list, monthly_contributions: list, annual_rates_percent: list, years: int):
    """
    Calculates the future value for a dynamic number of accounts.
    Returns the final balance, total contributed, and a JSON-encoded string 
    containing the full projection (for storage).
    """
    
    num_accounts = len(initial_balances)
    rate_annual = [r / 100.0 for r in annual_rates_percent]
    rate_monthly = [r / 12 for r in rate_annual]
    total_months = years * 12
    
    # Use a list of lists to hold dynamic account balances over time
    account_balance_lists = [[] for _ in range(num_accounts)]
    
    total_portfolio_numeric = []
    year_list = []
    
    current_balances = list(initial_balances)
    total_contributed = sum(initial_balances)
    
    for month in range(1, total_months + 1):
        
        for i in range(num_accounts):
            current_balances[i] += monthly_contributions[i]
            total_contributed += monthly_contributions[i]
            current_balances[i] *= (1 + rate_monthly[i])
        
        if month % 12 == 0:
            year_list.append(month // 12)
            
            for i in range(num_accounts):
                account_balance_lists[i].append(current_balances[i])
            
            total_portfolio_numeric.append(sum(current_balances))
    
    # --- Prepare the Output Data ---
    
    # 1. Create dynamic column names for the internal DataFrame
    df_col_names_internal = [f'Account {i+1} Balance' for i in range(num_accounts)]
    
    data = {'Year': year_list}
    for i in range(num_accounts):
        data[df_col_names_internal[i]] = account_balance_lists[i]

    data['Total Projected Balance'] = total_portfolio_numeric
    
    # The final data structure to be stored and returned
    projection_data = {
        "final_value": total_portfolio_numeric[-1] if total_portfolio_numeric else 0.0,
        "total_contributed": total_contributed,
        "yearly_data": data
    }

    # Return the final value, total contributed, and the full projection data (as a JSON string)
    return projection_data["final_value"], total_contributed, json.dumps(projection_data)
EOF
```

3. Update Main App (main.py)
Now we create the protected API endpoint that handles the calculation, saves the data to PostgreSQL, and returns the result.
```
cat <<EOF> main.py
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

# Define the security scheme structure for Swagger UI
bearer_scheme = {
    "Bearer": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "Enter the JWT token (e.g., Bearer eyJhbGciOi...)"
    }
}

app = FastAPI(
    title="Financial Projection API",
    # Tell Swagger which security scheme to use globally
    security=[{"Bearer": []}], 
    # Tell Swagger the definition of the "Bearer" scheme
    openapi_extra={
        "components": {
            "securitySchemes": bearer_scheme 
        }
    }
)

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
EOF
```

# Phase 4 - Building the React Front-End
We will use React for the UI structure and Chart.js for rendering the financial projection charts.
Step 1: React Project Setup and Dependencies
You'll need Node.js installed to use npm (Node Package Manager).
axios: For making HTTP requests to your FastAPI API.
react-router-dom: For handling secure navigation between pages (Login, Dashboard, Calculator).
chart.js & react-chartjs-2: To render the dynamic, interactive line charts from the data returned by the API.
```
# Install npx
sudo dnf install npx -y
# Create a new React project
cd ~/git/finmodel_3tier
npx create-react-app financial_projector_ui 
cd financial_projector_ui
# Install necessary JavaScript libraries
npm install axios react-router-dom chart.js react-chartjs-2
cd ..
```

Step 2: The Authentication Context (Secure Session Management)
The most important React component is the AuthContext. This manages the user's login status and the JWT token across the entire application.
1. File: services/auth.service.js
This service handles login/logout and manages the token stored in the browser's Local Storage.
```
mkdir services
cat <<EOF> services/auth.service.js
import axios from "axios";

// Define your backend URL (change this when deploying!)
const API_URL = "http://localhost:8000/"; // Assuming FastAPI runs on port 8000

class AuthService {
    
    // --- 1. LOGIN ---
    login(email, password) {
        // FastAPI's /token endpoint expects data in the URL-encoded format,
        // which matches the standard browser FormData submission, NOT JSON.
        const data = new URLSearchParams();
        data.append('username', email); // FastAPI uses 'username' for email
        data.append('password', password);

        return axios
            .post(API_URL + "token", data)
            .then(response => {
                // If login is successful, store the JWT in local storage
                if (response.data.access_token) {
                    localStorage.setItem("user_token", JSON.stringify(response.data.access_token));
                }
                return response.data;
            });
    }

    // --- 2. LOGOUT ---
    logout() {
        // Simply remove the token from local storage
        localStorage.removeItem("user_token");
    }

    // --- 3. SIGNUP ---
    signup(email, password) {
        // FastAPI's /signup endpoint expects a JSON payload
        return axios
            .post(API_URL + "signup", {
                email,
                password
            })
            .then(response => {
                // Optionally log the user in immediately after signup
                return this.login(email, password);
            });
    }

    // --- 4. GET CURRENT TOKEN ---
    getCurrentToken() {
        // Retrieve the token for use in API headers
        const token = localStorage.getItem("user_token");
        return token ? JSON.parse(token) : null;
    }
}

export default new AuthService();
EOF
```
2. File: services/api.service.js (Authenticated API Client)
This utility is essential for all protected API calls. It automatically attaches the JWT token to the header of every request to ensure your FastAPI endpoints are authenticated.
NOTE: I had to manually create this. cat EOF didn't work.
```
cat <<EOF> services/api.service.js
import axios from "axios";
import AuthService from "./auth.service";

const API_URL = "http://localhost:8000/";

// Create an instance of Axios
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor: Runs before every request is sent
api.interceptors.request.use(
  (config) => {
    const token = AuthService.getCurrentToken();

    // If a token exists, add it to the Authorization header
    if (token) {
      config.headers["Authorization"] = 'Bearer ' + token;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// --- Define your main protected API methods here ---

class ApiService {
  // POST /projections
  saveProjection(projectionData) {
    return api.post("projections", projectionData);
  }

  // GET /projections
  getProjectionsSummary() {
    return api.get("projections");
  }

  // GET /projections/{id}
  getProjectionDetails(id) {
    return api.get(`projections/${id}`);
  }

  // DELETE /projections/{id}
  deleteProjection(id) {
    return api.delete(`projections/${id}`);
  }
}

export default new ApiService();
EOF
```
3. This component handles the login form and redirects the user upon successful authentication.
```
mkdir -p components
cat <<EOF> components/LoginPage.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthService from '../services/auth.service';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    const handleLogin = (e) => {
        e.preventDefault();
        setMessage('');

        // 1. Reset message and attempt login
        AuthService.login(email, password)
            .then(
                () => {
                    // 2. On success, navigate to the main dashboard/calculator page
                    navigate('/');
                    window.location.reload(); // Force a refresh to load app state
                },
                (error) => {
                    // 3. Handle errors from the API (e.g., 401 Unauthorized)
                    const resMessage =
                        (error.response &&
                            error.response.data &&
                            error.response.data.detail) ||
                        error.message ||
                        error.toString();
                    
                    if (resMessage.includes("401")) {
                        setMessage("Invalid email or password.");
                    } else {
                        setMessage(`Login failed: ${resMessage}`);
                    }
                }
            );
    };

    return (
        <div className="auth-form-container">
            <h2>Log In to Your Projector</h2>
            <form onSubmit={handleLogin}>
                <label htmlFor="email">Email:</label>
                <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                <label htmlFor="password">Password:</label>
                <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />

                <button type="submit">Log In</button>
                {message && <div className="error-message">{message}</div>}
            </form>
        </div>
    );
};

export default LoginPage;
EOF
```
2. components/SignupPage.js
This component handles the user registration form, calling the secure /signup endpoint on your FastAPI backend.
```
cat <<EOF> components/SignupPage.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthService from '../services/auth.service';

const SignupPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    const handleSignup = (e) => {
        e.preventDefault();
        setMessage('');

        // 1. Attempt signup, which includes a POST to /signup
        AuthService.signup(email, password)
            .then(
                () => {
                    // 2. If successful (and optionally auto-logged in by authService), navigate
                    setMessage('Registration successful! Redirecting...');
                    setTimeout(() => navigate('/'), 1000); // Navigate to main page after delay
                },
                (error) => {
                    // 3. Handle errors (e.g., Email already registered)
                    const resMessage =
                        (error.response &&
                            error.response.data &&
                            error.response.data.detail) ||
                        error.message ||
                        error.toString();

                    setMessage(`Registration failed: ${resMessage}`);
                }
            );
    };

    return (
        <div className="auth-form-container">
            <h2>Create Your Account</h2>
            <form onSubmit={handleSignup}>
                <label htmlFor="email">Email:</label>
                <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                <label htmlFor="password">Password:</label>
                <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />

                <button type="submit">Sign Up</button>
                {message && <div className="info-message">{message}</div>}
            </form>
        </div>
    );
};

export default SignupPage;
EOF
```
3. context/AuthContext.js (The Provider)
This provider manages the currentUser and the token globally. It is responsible for checking if the user is logged in every time the app loads.
```
mkdir -p context
cat <<EOF> context/AuthContext.js
import React, { useState, useEffect, createContext, useContext } from 'react';
import AuthService from '../services/auth.service';
import ApiService from '../services/api.service'; // Needed to fetch current user data

// 1. Create the Context
const AuthContext = createContext(null);

// 2. Custom hook for easy access to the context
export const useAuth = () => {
    return useContext(AuthContext);
};

// 3. The Provider Component
export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Function to handle the successful login (stores user data and token)
    const handleLoginSuccess = async (token) => {
        // 1. Store the token in local storage (handled by AuthService)
        // 2. Fetch the user's detailed profile from the secure endpoint
        try {
            // This GET request uses the token attached by api.service.js
            const response = await ApiService.api.get('users/me'); 
            setCurrentUser(response.data);
            setIsLoading(false);
        } catch (error) {
            console.error("Failed to fetch user profile:", error);
            AuthService.logout(); // Clear token if profile fetch fails
            setCurrentUser(null);
            setIsLoading(false);
        }
    };

    // Function to handle logout
    const handleLogout = () => {
        AuthService.logout();
        setCurrentUser(null);
        setIsLoading(false);
    };

    // Effect: Runs once when the component mounts to check for an existing session
    useEffect(() => {
        const token = AuthService.getCurrentToken();
        if (token) {
            // If token exists, validate it by fetching user profile
            handleLoginSuccess(token);
        } else {
            setIsLoading(false);
        }
    }, []);

    const value = {
        currentUser,
        isLoading,
        login: handleLoginSuccess, // Expose the successful login handler
        logout: handleLogout
    };

    if (isLoading) {
        return <div className="loading-screen">Loading application...</div>;
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
EOF
```
4. components/ProtectedRoute.js (The Security Gate)
This simple component uses the useAuth hook to decide whether to allow navigation.
```
cat <<EOF> components/ProtectedRoute.js
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
    const { currentUser, isLoading } = useAuth();
    
    // The AuthProvider should handle the loading state, but a check here is safer
    if (isLoading) {
        return <div>Loading...</div>; 
    }

    // If there is no authenticated user, redirect them to the login page
    if (!currentUser) {
        return <Navigate to="/login" replace />;
    }

    // Otherwise, render the component they requested (children)
    return children;
};

export default ProtectedRoute;
EOF
```

5. App.js (The Router)
The main application file sets up the routes and wraps the entire application in the AuthProvider.
```
cat <<EOF> src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Import all main components
import Header from './components/Header'; // A simple navigation bar
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import Calculator from './components/Calculator'; // The core logic/form
import Dashboard from './components/Dashboard';   // The saved projections list
import ProjectionDetail from './components/ProjectionDetail';

// The Main Application Structure
function App() {
    return (
        <Router>
            {/* Wrap the entire app in the Auth Provider */}
            <AuthProvider>
                <Header />
                <main className="container">
                    <Routes>
                        {/* Public Routes */}
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/signup" element={<SignupPage />} />

                        {/* Protected Routes (Require JWT) */}
                        <Route
                            path="/"
                            element={
                                <ProtectedRoute>
                                    <Calculator /> {/* Default landing page */}
                                </ProtectedRoute>
                            }
                        />
                         <Route
                            path="/dashboard"
                            element={
                                <ProtectedRoute>
                                    <Dashboard /> {/* List of saved plans */}
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/projection/:id"
                            element={
                                <ProtectedRoute>
                                    <ProjectionDetail /> {/* Individual projection view */}
                                </ProtectedRoute>
                            }
                        />
                    </Routes>
                </main>
            </AuthProvider>
        </Router>
    );
}

export default App;
EOF
```
# Phase 5 - core functionality
1. components/Calculator.js
This component manages the accounts array and handles the submission to the secure API endpoint.
```
cat <<EOF> components/Calculator.js
import React, { useState } from 'react';
import ApiService from '../services/api.service';
import { useNavigate } from 'react-router-dom';

// Global constants matching your Python constants (simplified here)
const INVESTMENT_TYPES = [
    "--- Select Type ---",
    "Cash (Checking/Current)",
    "Savings (High-Yield)",
    "Brokerage (Taxable)",
    "Retirement (Tax-Advantaged)",
    "Real Estate",
    "Other/Custom"
];

const DEFAULT_ACCOUNT = {
    name: "New Account",
    type: INVESTMENT_TYPES[0],
    initial_balance: 0.0,
    monthly_contribution: 0.0,
    annual_rate_percent: 0.0,
};

const Calculator = () => {
    // State to hold the dynamic list of accounts
    const [accounts, setAccounts] = useState([
        { ...DEFAULT_ACCOUNT, name: "Main Savings", initial_balance: 10000, monthly_contribution: 200, annual_rate_percent: 4.5 },
        { ...DEFAULT_ACCOUNT, name: "Retirement IRA", initial_balance: 25000, monthly_contribution: 500, annual_rate_percent: 8.5 },
    ]);
    
    // State for global inputs
    const [projectionName, setProjectionName] = useState("My New Plan");
    const [years, setYears] = useState(25);
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    // --- Account Management Functions ---

    const addAccount = () => {
        if (accounts.length < 8) {
            setAccounts([...accounts, { ...DEFAULT_ACCOUNT, name: `Account ${accounts.length + 1}` }]);
        } else {
            setMessage("Maximum of 8 accounts reached.");
        }
    };

    const removeAccount = (indexToRemove) => {
        if (accounts.length > 1) {
            setAccounts(accounts.filter((_, index) => index !== indexToRemove));
        } else {
            setMessage("Must have at least one account.");
        }
    };

    const handleAccountChange = (index, field, value) => {
        const newAccounts = accounts.map((account, i) => {
            if (i === index) {
                // Parse number inputs correctly
                const parsedValue = (field === 'initial_balance' || field === 'monthly_contribution' || field === 'annual_rate_percent') 
                    ? parseFloat(value) || 0.0 
                    : value;
                return { ...account, [field]: parsedValue };
            }
            return account;
        });
        setAccounts(newAccounts);
    };

    // --- Submission Handler ---

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage("Calculating...");

        // 1. Format the data into the FastAPI ProjectionRequest schema
        const requestPayload = {
            projection_name: projectionName,
            years: years,
            accounts: accounts.map(acc => ({
                name: acc.name,
                type: acc.type,
                initial_balance: acc.initial_balance,
                monthly_contribution: acc.monthly_contribution,
                annual_rate_percent: acc.annual_rate_percent,
            }))
        };
        
        // 2. Send the authenticated request to the secure API
        try {
            const response = await ApiService.saveProjection(requestPayload);
            setMessage("Calculation successful! Redirecting to results...");
            
            // 3. On success, navigate to the detail view of the new projection
            navigate(`/projection/${response.data.id}`);

        } catch (error) {
            // 4. Handle errors (e.g., 401 Unauthorized, 400 Bad Request)
            const errorMsg = error.response?.data?.detail || "An unexpected error occurred.";
            setMessage(`Calculation Failed: ${errorMsg}`);
            console.error(error);
        }
    };

    // --- Rendering ---

    return (
        <div className="calculator-page">
            <h2>Financial Projection Calculator</h2>
            <form onSubmit={handleSubmit}>
                <div className="global-inputs">
                    <label>Plan Name:</label>
                    <input 
                        type="text" 
                        value={projectionName} 
                        onChange={(e) => setProjectionName(e.target.value)} 
                        required 
                    />
                    <label>Projection Years:</label>
                    <input 
                        type="number" 
                        min="1" 
                        max="60" 
                        value={years} 
                        onChange={(e) => setYears(parseInt(e.target.value) || 0)} 
                        required 
                    />
                </div>

                <h3>Account Inputs ({accounts.length} Total)</h3>
                
                {/* Table Header */}
                <div className="account-grid header-row">
                    <span>Name</span>
                    <span>Type</span>
                    <span>Balance ($)</span>
                    <span>Monthly Contrib ($)</span>
                    <span>Rate (%)</span>
                    <span>Action</span>
                </div>

                {/* Dynamic Account Rows */}
                {accounts.map((account, index) => (
                    <div key={index} className="account-grid input-row">
                        {/* 1. Name */}
                        <input
                            type="text"
                            value={account.name}
                            onChange={(e) => handleAccountChange(index, 'name', e.target.value)}
                            required
                        />
                        {/* 2. Type */}
                        <select
                            value={account.type}
                            onChange={(e) => handleAccountChange(index, 'type', e.target.value)}
                        >
                            {INVESTMENT_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                        {/* 3. Balance */}
                        <input
                            type="number"
                            min="0"
                            step="100"
                            value={account.initial_balance}
                            onChange={(e) => handleAccountChange(index, 'initial_balance', e.target.value)}
                        />
                        {/* 4. Contribution */}
                        <input
                            type="number"
                            min="0"
                            step="50"
                            value={account.monthly_contribution}
                            onChange={(e) => handleAccountChange(index, 'monthly_contribution', e.target.value)}
                        />
                        {/* 5. Rate */}
                        <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={account.annual_rate_percent}
                            onChange={(e) => handleAccountChange(index, 'annual_rate_percent', e.target.value)}
                        />
                        {/* 6. Action */}
                        <button type="button" onClick={() => removeAccount(index)} className="remove-btn" disabled={accounts.length <= 1}>
                            Remove
                        </button>
                    </div>
                ))}
                
                {/* Action Buttons */}
                <div className="form-actions">
                    <button type="button" onClick={addAccount} className="add-btn">
                        + Add Account
                    </button>
                    <button type="submit" className="calculate-btn" disabled={accounts.length === 0}>
                        🚀 Calculate & Save Projection
                    </button>
                </div>
            </form>
            {message && <div className="status-message">{message}</div>}
        </div>
    );
};

export default Calculator;
EOF
```

2. Styling Notes (CSS)
To make the grid layout work visually (replacing the Streamlit columns), you would use CSS, perhaps in an associated Calculator.css file:
```
cat <<EOF> Calculator.css
/* --- Calculator.css --- */

/* --- General Structure --- */

.calculator-page {
    max-width: 1200px;
    margin: 30px auto;
    padding: 30px;
    background-color: #f9f9f9;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.calculator-page h2 {
    color: #333;
    margin-bottom: 25px;
    text-align: center;
}

.calculator-page h3 {
    margin-top: 30px;
    margin-bottom: 15px;
    color: #555;
    border-bottom: 1px solid #eee;
    padding-bottom: 5px;
}

/* --- Global Inputs (Plan Name, Years) --- */

.global-inputs {
    display: flex;
    gap: 20px;
    align-items: center;
    margin-bottom: 25px;
    padding: 15px;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    background-color: #fff;
}

.global-inputs label {
    font-weight: bold;
    color: #444;
    white-space: nowrap;
}

.global-inputs input[type="text"],
.global-inputs input[type="number"] {
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 6px;
    width: 100%;
}

/* --- Account Grid Layout (The Core Table) --- */

.account-grid {
    /* Define 6 columns: Name(2), Type(3), Balance(2), Contrib(2), Rate(2), Action(1) */
    display: grid;
    grid-template-columns: 2fr 3fr 2fr 2fr 2fr 1fr; 
    gap: 15px;
    margin-bottom: 12px;
    align-items: center;
    padding: 0 5px;
}

/* --- Header Row --- */

.header-row {
    font-weight: bold;
    color: #007bff; /* Primary blue color */
    padding: 10px 0;
    border-bottom: 2px solid #007bff;
    margin-bottom: 10px;
}

/* --- Input Rows --- */

.input-row {
    background-color: #ffffff;
    padding: 10px 0;
    border-radius: 6px;
    border: 1px solid #f0f0f0;
}

.input-row:nth-child(even) {
    background-color: #fafafa;
}

.input-row input, 
.input-row select {
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    width: 100%;
    box-sizing: border-box; /* Important for grid alignment */
}

/* --- Action Buttons (Add/Calculate) --- */

.form-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 30px;
    padding-top: 20px;
    border-top: 1px solid #eee;
}

.add-btn {
    background-color: #4CAF50; /* Green */
    color: white;
    padding: 12px 25px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: bold;
    transition: background-color 0.2s;
}

.add-btn:hover {
    background-color: #45a049;
}

.calculate-btn {
    background-color: #007bff; /* Blue */
    color: white;
    padding: 12px 30px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: bold;
    font-size: 1.1em;
    transition: background-color 0.2s;
}

.calculate-btn:hover:not(:disabled) {
    background-color: #0056b3;
}

.calculate-btn:disabled {
    background-color: #ccc;
    cursor: not-allowed;
}

/* --- Remove Button (per row) --- */

.remove-btn {
    background-color: #f44336; /* Red */
    color: white;
    padding: 8px 12px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9em;
    width: 90%;
    margin: 0 auto;
    display: block;
}

.remove-btn:hover:not(:disabled) {
    background-color: #d32f2f;
}

.remove-btn:disabled {
    background-color: #ffcccb;
    color: #666;
    cursor: not-allowed;
}

/* --- Status Messages --- */

.status-message {
    margin-top: 20px;
    padding: 10px;
    border-radius: 6px;
    text-align: center;
    font-weight: bold;
    background-color: #e6f7ff;
    color: #007bff;
    border: 1px solid #b3d9ff;
}

/* --- Responsive Adjustments (for smaller screens) --- */

@media (max-width: 1000px) {
    .account-grid {
        /* Adjust layout to stack more columns vertically */
        grid-template-columns: 1fr 1fr; 
        gap: 10px 20px;
    }
    
    .header-row {
        display: none; /* Hide header on mobile for space */
    }

    .input-row {
        /* Use grid-area names if necessary, but simpler to just stack */
        display: grid;
        grid-template-columns: 1fr 1fr;
        padding: 15px;
        margin-bottom: 20px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .input-row > * {
        margin-bottom: 5px;
    }
    
    .remove-btn {
        grid-column: 1 / 3; /* Make remove button span both columns */
        width: 100%;
    }
    
    .global-inputs {
        flex-direction: column;
        align-items: stretch;
    }
}
EOF
```

This component is responsible for retrieving a saved projection's full data from the API, parsing the complex yearly results, and rendering the professional, interactive chart using Chart.js.
It also handles the delete functionality.

📈 Step 9: Implementing the Chart and Detail View
This requires two main parts: the component logic (ProjectionDetail.js) and a helper file for chart configuration (ChartConfig.js).

1. Chart Configuration Helper (utils/ChartConfig.js)
This file contains the logic to transform the raw data from your FastAPI endpoint into a structure that Chart.js can understand.
```
mkdir -p utils
cat <<EOF> utils/ChartConfig.js
// utils/ChartConfig.js

import { Line } from 'react-chartjs-2';

// Standard colors and line styles (matching your original Python code intent)
const LINE_STYLES = ['#4CAF50', '#2196F3', '#FF9800', '#F44336', '#9C27B0', '#00BCD4', '#8BC34A', '#FFEB3B'];
const LINE_DASHES = [0, [5, 5], [1, 1], [5, 10], [3, 10, 1, 10], [3, 5, 1, 5, 1, 5]];

// Function to generate the Chart.js data object
export const generateChartData = (projectionData) => {
    if (!projectionData || !projectionData.yearly_data) return { labels: [], datasets: [] };

    const yearlyData = projectionData.yearly_data;
    const years = yearlyData.Year;
    const totalBalanceData = yearlyData['Total Projected Balance'];
    
    // Get all account keys (e.g., "Account 1 Balance", "Account 2 Balance")
    const accountKeys = Object.keys(yearlyData).filter(key => key.includes('Balance') && !key.includes('Total'));
    
    // The account names were part of the input, which should be included if you reload the full inputs, 
    // but for simplicity, we'll use the generated keys here.
    
    let datasets = [];

    // 1. Add individual account datasets
    accountKeys.forEach((key, index) => {
        const color = LINE_STYLES[index % LINE_STYLES.length];
        const dash = LINE_DASHES[index % LINE_DASHES.length];

        datasets.push({
            label: key.replace(' Balance', ''), // Clean up the label for the legend
            data: yearlyData[key],
            borderColor: color,
            borderWidth: 2,
            borderDash: dash,
            pointRadius: 1,
            fill: false,
            tension: 0.1
        });
    });

    // 2. Add the TOTAL portfolio line (highlighted)
    datasets.push({
        label: 'TOTAL PORTFOLIO',
        data: totalBalanceData,
        borderColor: '#ffffff', // White line for contrast
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 5,
        pointRadius: 4,
        tension: 0.3,
        fill: false,
    });

    return {
        labels: years.map(y => `Year ${y}`),
        datasets: datasets,
    };
};

// Function to define the Chart.js options
export const chartOptions = (finalValue) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'top',
        },
        title: {
            display: true,
            text: 'Individual Account Growth vs. Total Portfolio',
            font: { size: 16 }
        },
        // Tooltip formatting for currency
        tooltip: {
             callbacks: {
                 label: function(context) {
                     let label = context.dataset.label || '';
                     if (label) {
                         label += ': ';
                     }
                     if (context.parsed.y !== null) {
                         label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                     }
                     return label;
                 }
             }
        }
    },
    scales: {
        y: {
            title: {
                display: true,
                text: 'Projected Balance',
            },
            // Y-axis currency formatting
            ticks: {
                callback: function(value) {
                    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);
                }
            }
        }
    }
});
EOF
```

2. The Detail Component (components/ProjectionDetail.js)
This component fetches the data based on the URL parameter (:id), displays the key metrics, and renders the chart.
```
cat <<EOF> components/ProjectionDetail.js
import React, { useState, useEffect } => 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import ApiService from '../services/api.service';
import { generateChartData, chartOptions } from '../utils/ChartConfig';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

const ProjectionDetail = () => {
    const { id } = useParams(); // Get the projection ID from the URL
    const navigate = useNavigate();
    
    const [projection, setProjection] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // --- Data Fetching Effect ---
    useEffect(() => {
        const fetchProjection = async () => {
            try {
                setLoading(true);
                const response = await ApiService.getProjectionDetails(id);
                setProjection(response.data);
                setLoading(false);
            } catch (err) {
                // This catches 404 (not found) or 401 (unauthorized) errors
                setError("Error loading projection. It may not exist or you lack access.");
                setLoading(false);
                console.error("Fetch Error:", err);
            }
        };

        fetchProjection();
    }, [id]);

    // --- Delete Handler ---
    const handleDelete = async () => {
        if (window.confirm("Are you sure you want to permanently delete this projection?")) {
            try {
                await ApiService.deleteProjection(id);
                // Redirect user to the dashboard after successful deletion
                navigate('/dashboard');
            } catch (err) {
                alert("Failed to delete projection. Please try again.");
                console.error("Delete Error:", err);
            }
        }
    };

    if (loading) return <div className="detail-loading">Loading Projection Data...</div>;
    if (error) return <div className="detail-error">{error}</div>;
    if (!projection) return <div className="detail-error">No data available.</div>;

    // --- Data Preparation ---
    const finalValue = projection.final_value;
    const totalContributed = projection.projection_data.total_contributed;
    const chartData = generateChartData(projection.projection_data);
    const chartConfigOptions = chartOptions(finalValue);
    const yearlyTableData = projection.projection_data.yearly_data;
    
    // Calculate Interest Earned
    const interestEarned = finalValue - totalContributed;
    const interestRatio = totalContributed > 0 ? (interestEarned / totalContributed) * 100 : 0;

    // Helper for currency formatting
    const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

    return (
        <div className="projection-detail-page">
            <div className="header-actions">
                <h1>{projection.name} ({projection.years} Years)</h1>
                <button onClick={handleDelete} className="delete-btn">
                    🗑️ Delete Plan
                </button>
            </div>
            
            {/* Key Metrics */}
            <div className="metrics-summary">
                <div className="metric-box">
                    <span>💰 Final Portfolio Value</span>
                    <strong>{formatCurrency(finalValue)}</strong>
                </div>
                <div className="metric-box">
                    <span>💵 Total Contributions</span>
                    <strong>{formatCurrency(totalContributed)}</strong>
                </div>
                <div className="metric-box interest-box">
                    <span>📈 Total Interest Earned</span>
                    <strong>{formatCurrency(interestEarned)}</strong>
                    <p>{interestRatio.toFixed(1)}% Return</p>
                </div>
            </div>

            {/* Chart Area */}
            <div className="chart-container">
                <Line data={chartData} options={chartConfigOptions} />
            </div>

            {/* Yearly Table */}
            <h2>Yearly Breakdown</h2>
            <div className="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Year</th>
                            {Object.keys(yearlyTableData).filter(key => key !== 'Year').map(key => (
                                <th key={key}>{key.replace(' Balance', '')}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {yearlyTableData.Year.map((year, index) => (
                            <tr key={year}>
                                <td>{year}</td>
                                {Object.keys(yearlyTableData).filter(key => key !== 'Year').map(key => (
                                    <td key={key}>{formatCurrency(yearlyTableData[key][index])}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ProjectionDetail;
EOF
```

Final Component: Dashboard.js
To complete the front-end, you need a simple Dashboard.js component to list all saved projections.

3. The Dashboard Component (components/Dashboard.js)
```
cat <<EOF> components/Dashboard.js
import React, { useState, useEffect } from 'react';
import ApiService from '../services/api.service';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
    const [projections, setProjections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const fetchProjections = async () => {
        try {
            setLoading(true);
            const response = await ApiService.getProjectionsSummary(); // GET /projections
            setProjections(response.data);
            setLoading(false);
        } catch (err) {
            setError("Failed to load dashboard data.");
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProjections();
    }, []);

    const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    
    if (loading) return <div>Loading Dashboard...</div>;
    if (error) return <div className="dashboard-error">{error}</div>;

    return (
        <div className="dashboard-page">
            <h1>📚 Saved Financial Projections</h1>
            {projections.length === 0 ? (
                <p>No projections saved yet. Go to the Calculator to create one!</p>
            ) : (
                <table className="projections-table">
                    <thead>
                        <tr>
                            <th>Plan Name</th>
                            <th>Years</th>
                            <th>Total Contributed</th>
                            <th>Final Value</th>
                            <th>Date Saved</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {projections.map(proj => (
                            <tr key={proj.id}>
                                <td>{proj.name}</td>
                                <td>{proj.years}</td>
                                <td>{formatCurrency(proj.total_contributed)}</td>
                                <td>{formatCurrency(proj.final_value)}</td>
                                <td>{new Date(proj.timestamp).toLocaleDateString()}</td>
                                <td>
                                    <button 
                                        onClick={() => navigate(`/projection/${proj.id}`)}
                                        className="view-btn"
                                    >
                                        View Details
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default Dashboard;
```

# Phase 6a - Test the Backend Foundation (FastAPI & PostgreSQL)
You need to ensure your API and database are connected and the core functions (Auth and CRUD) work correctly in isolation.

1. Set Up the Environment TODO
Start PostgreSQL: Ensure your local PostgreSQL server (or the one running in a container) is active and accessible.

Update Connection String: In your database.py, make sure SQLALCHEMY_DATABASE_URL is correct for your local setup (e.g., postgresql://user:password@localhost:5432/test_db).

Run FastAPI: Start the API server using Uvicorn. This must be running before you test any endpoints.
```
uvicorn financial_projector_api.main:app --reload --port 8000
```

2. Use FastAPI's Interactive Docs (Swagger UI)
FastAPI automatically generates interactive documentation, which is the easiest way to test your endpoints without the React front-end.
```
a. Open Docs: Navigate to http://localhost:8000/docs in your web browser.
b. Test Signup (POST /signup):
  - Find the /signup endpoint and click "Try it out".
  - Enter a test email and password.
  - Click "Execute". You should receive a 200 OK response with the new user's details (ID, email).
c. Test Login (POST /token):
  - Find the /token endpoint.
  - Enter the same email (as username) and password.
  - Click "Execute". You must receive a 200 OK response containing the access_token (the JWT). Copy this token.
d. Authorize Future Requests: (NOTE: Swagger doesn't handle this correctly. It doesn't ask for bearer token
INSTEAD, test token with curl. For example:

$ curl -X GET "http://localhost:8000/users/me" -H "accept: application/json" -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyN0BleGFtcGxlLmNvbSIsImV4cCI6MTc2NTEzOTc1MH0.9ndo3Edue_1gZ4DqjrxCkP6MGT2bVxHBYmTSQ4xhuvk"
{"email":"user7@example.com","id":6,"is_active":true}

  - Click the green "Authorize" button at the top right of the Swagger UI page.
  - Paste the copied access_token into the value field, prefixed with Bearer (e.g., Bearer eyJhbGciOiJIUzI1NiI...). Click "Authorize".
e. Test Protected Route (GET /users/me):
  - Run this endpoint. It should now succeed, returning the user details, confirming the JWT works.
f. Test Calculation (POST /projections):
  - Run the calculation endpoint, providing sample data that matches the ProjectionRequest schema.
  - It should return a 200 OK response with the calculated values and a new projection ID, confirming your calculations.py logic works and the record was saved to PostgreSQL.
```
# Phase 6b - Test the Full Stack Integration (React to FastAPI)
Now that the backend is confirmed, you test the React application's ability to communicate securely with the API.

1. Start the React Application
- In a separate terminal window (keep the FastAPI server running!), navigate to your React project directory (financial_projector_ui).
- Start the React development server. The app should open in your browser, usually at http://localhost:3000.
```

```
cd financial_projector_ui
npm start
```
2. Test Security and Authentication
  a. Initial Load: The app should redirect immediately to /login because no token exists (thanks to the ProtectedRoute).
  b. Test Logout: Go to the application and ensure the logout button clears the token and redirects to /login.
  c. Test Signup (Full Cycle): Use a new email address on the /signup page.
    - Success: You should be registered and immediately logged in, redirecting you to the main Calculator component. The application confirms the React/Auth service is talking to the /signup and /token endpoints correctly.

3. Test Core Functionality (Calculator and CRUD)
  a. Calculator Test:
    - Fill out the form in the Calculator.js component with test account data.
    - Click "Calculate & Save Projection".
    - Success: The page should navigate to the ProjectionDetail view (/projection/:id), confirming your React component correctly built the payload, and the authenticated request successfully hit the /projections endpoint.

  b. Detail/Chart Test:
    - On the detail page, confirm that the key metrics (Final Value, Interest Earned) match the expected output.
    - Verify the Chart.js chart renders correctly using the yearly_data received from the API.

  c. Dashboard Test:
    - Navigate to the /dashboard page.
    - Confirm your newly created projection appears in the list (Testing GET /projections).

  d. Delete Test (Security Check):
    - From the detail view, click the "Delete Plan" button.
    - Success: You should be redirected back to the dashboard, and the item should disappear from the list (Testing DELETE /projections/{id}).
