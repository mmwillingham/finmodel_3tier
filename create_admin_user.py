import os
import sys

# Read environment variables for the database connection
# These should be set in your environment or .env file for local development
# For Cloud Run, these are set via environment variables or secrets
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD") or os.getenv("_DB_PASSWORD")  # Support secret manager format
DB_NAME = os.getenv("DB_NAME")

if not all([DB_USER, DB_PASSWORD, DB_NAME]):
    print("ERROR: Missing required environment variables: DB_USER, DB_PASSWORD, DB_NAME")
    print("Please set these environment variables before running this script.")
    print("Example:")
    print("  export DB_USER=dbadmin")
    print("  export DB_PASSWORD=your_password")
    print("  export DB_NAME=finmodel1")
    sys.exit(1)

# Set the environment variables for the database connection before any imports that use them
os.environ["DB_USER"] = DB_USER
os.environ["DB_PASSWORD"] = DB_PASSWORD
os.environ["DB_NAME"] = DB_NAME

# Add the 'api' directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'api')))

from database import SessionLocal
from models import User
from auth import get_password_hash
from sqlalchemy.orm import Session

def create_initial_admin_user():
    db: Session = SessionLocal()
    try:
        admin_email = "admin@example.com"
        admin_password = "adminpassword"
        
        # Check if admin user already exists
        user = db.query(User).filter(User.email == admin_email).first()

        if user:
            print(f"User {admin_email} already exists. Ensuring admin privileges and confirmation status.")
            user.is_admin = True
            user.is_confirmed = True
            user.hashed_password = get_password_hash(admin_password) # Ensure password is up-to-date
        else:
            print(f"Creating new admin user: {admin_email}")
            hashed_password = get_password_hash(admin_password)
            user = User(
                email=admin_email,
                hashed_password=hashed_password,
                is_active=True,
                is_confirmed=True,
                is_admin=True
            )
            db.add(user)
        
        db.commit()
        db.refresh(user)
        print(f"Admin user '{user.email}' (ID: {user.id}) created/updated successfully. is_admin: {user.is_admin}, is_confirmed: {user.is_confirmed}")
    except Exception as e:
        db.rollback()
        print(f"An error occurred: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_initial_admin_user()
