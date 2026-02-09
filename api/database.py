import os
import time
import re
import logging
from functools import lru_cache
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.declarative import declarative_base
from typing import Any, Generator
from sqlalchemy.exc import OperationalError

_unix_socket_path: str | None = None # Global to store unix socket path if used
logger = logging.getLogger(__name__)

def sanitize_database_url(url: str) -> str:
    """Remove password from database URL for safe logging."""
    # Pattern: postgresql://user:password@host/db or postgresql+pg8000://user:password@host/db
    # Replace password with ***
    pattern = r'(://[^:]+:)([^@]+)(@)'
    return re.sub(pattern, r'\1***\3', url)

def get_database_url() -> str:
    global _unix_socket_path # Declare intent to modify global variable
    database_url = os.getenv("DATABASE_URL")

    if database_url is None:
        db_user = os.getenv("DB_USER")
        db_password = os.getenv("DB_PASSWORD") or os.getenv("_DB_PASSWORD")
        db_name = os.getenv("DB_NAME")
        cloud_sql_connection_name = os.getenv("CLOUD_SQL_CONNECTION_NAME")
        use_cloud_sql_proxy_tcp = os.getenv("USE_CLOUD_SQL_PROXY_TCP", "False").lower() == "true" # NEW: Check for TCP proxy

        if not all([db_user, db_password, db_name]):
            raise ValueError("Missing one or more database environment variables (DB_USER, DB_PASSWORD, DB_NAME)")

        if cloud_sql_connection_name and not use_cloud_sql_proxy_tcp: # Use Unix socket by default for Cloud SQL
            _unix_socket_path = f"/cloudsql/{cloud_sql_connection_name}/.s.PGSQL.5432"
            database_url = (
                f"postgresql+pg8000://{db_user}:{db_password}@/{db_name}?unix_sock={_unix_socket_path}"
            )
        elif cloud_sql_connection_name and use_cloud_sql_proxy_tcp: # NEW: Use TCP for local Cloud SQL Proxy
            _unix_socket_path = None # Explicitly set to None for TCP connections
            local_db_host = os.getenv("DB_HOST", "127.0.0.1") # Default to 127.0.0.1 for proxy
            local_db_port = os.getenv("DB_PORT", "5432")     # Default to 5432 for proxy
            database_url = (
                f"postgresql+pg8000://{db_user}:{db_password}@{local_db_host}:{local_db_port}/{db_name}"
            )
        else: # Regular local database connection
            local_db_host = os.getenv("DB_HOST", "localhost")
            local_db_port = os.getenv("DB_PORT", "5432")
            database_url = (
                f"postgresql+pg8000://{db_user}:{db_password}@{local_db_host}:{local_db_port}/{db_name}"
            )

    if database_url is None:
        raise ValueError("DATABASE_URL could not be determined from environment variables.")

    return database_url

def get_engine_instance():
    global _unix_socket_path # Access global variable
    DATABASE_URL = get_database_url()

    connect_args = {}
    # Only add unix_sock to connect_args if _unix_socket_path is set (i.e., we are using Unix socket)
    # The TCP connection will not use this.
    if _unix_socket_path and "unix_sock" in DATABASE_URL and not os.getenv("USE_CLOUD_SQL_PROXY_TCP", "False").lower() == "true": # Ensure it's explicitly for unix_sock in URL and not TCP
        connect_args["unix_sock"] = _unix_socket_path

    retries = 5
    delay = 2 # seconds
    for i in range(retries):
        try:
            engine = create_engine(
                DATABASE_URL,
                pool_size=10,
                max_overflow=20,
                pool_timeout=30,
                pool_recycle=1800,
                connect_args=connect_args # Pass connect_args here
            )
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            return engine
        except OperationalError as e:
            logger.error("Database connection failed (attempt %s/%s): %s", i + 1, retries, e)
            if i < retries - 1:
                time.sleep(delay)
            else:
                raise

# Lazily initialize engine/session to avoid blocking app startup.
_engine = None
SessionLocal = None

def init_engine_and_session():
    global _engine, SessionLocal
    if _engine is None:
        logger.info("Initializing database engine")
        _engine = get_engine_instance()
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    return _engine

Base = declarative_base()

def get_db() -> Generator[Session, None, None]:
    """Dependency that provides a new SQLAlchemy session for each request."""
    if SessionLocal is None:
        init_engine_and_session()
    db = SessionLocal() # Create a new session from the pre-configured SessionLocal factory
    try:
        yield db
    finally:
        db.close()

# Ensure it also uses caching if it were to be actively used in a hot path.
@lru_cache(maxsize=1) # Cache the result of this function if it were to be used frequently
def get_async_database_url() -> str:
    global _unix_socket_path # Access global variable
    database_url = os.getenv("DATABASE_URL") # Check if a single DATABASE_URL is provided

    if database_url is None:
        db_user = os.getenv("DB_USER")
        db_password = os.getenv("DB_PASSWORD") or os.getenv("_DB_PASSWORD")
        db_name = os.getenv("DB_NAME")
        cloud_sql_connection_name = os.getenv("CLOUD_SQL_CONNECTION_NAME")
        use_cloud_sql_proxy_tcp = os.getenv("USE_CLOUD_SQL_PROXY_TCP", "False").lower() == "true" # NEW: Check for TCP proxy


        if not all([db_user, db_password, db_name, cloud_sql_connection_name]):
            raise ValueError("Missing one or more database environment variables for async URL (DB_USER, DB_PASSWORD, DB_NAME, CLOUD_SQL_CONNECTION_NAME)")

        if cloud_sql_connection_name and not use_cloud_sql_proxy_tcp:
            _unix_socket_path = f"/cloudsql/{cloud_sql_connection_name}/.s.PGSQL.5432" # Keep full path for pg8000
            unix_socket_dir = f"/cloudsql/{cloud_sql_connection_name}" # Directory for asyncpg host
            database_url = (
                f"postgresql+asyncpg://{db_user}:{db_password}@/{db_name}?host={unix_socket_dir}"
            )
        elif cloud_sql_connection_name and use_cloud_sql_proxy_tcp: # NEW: Use TCP for local Cloud SQL Proxy for async
            local_db_host = os.getenv("DB_HOST", "127.0.0.1")
            local_db_port = os.getenv("DB_PORT", "5432")
            database_url = (
                f"postgresql+asyncpg://{db_user}:{db_password}@{local_db_host}:{local_db_port}/{db_name}"
            )
        else: # Regular local database connection
            local_db_host = os.getenv("DB_HOST", "127.0.0.1")
            local_db_port = os.getenv("DB_PORT", "5432")
            database_url = (
                f"postgresql+asyncpg://{db_user}:{db_password}@{local_db_host}:{local_db_port}/{db_name}"
            )
    if database_url is None:
        raise ValueError("ASYNC DATABASE_URL could not be determined from environment variables.")
    return database_url