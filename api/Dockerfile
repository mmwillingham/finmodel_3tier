# Dockerfile for the FastAPI backend

# Use a lightweight Python base image
FROM python:3.11-slim-bookworm

# Install build dependencies for pg8000 (will be removed later)
RUN apt-get update && apt-get install -y build-essential libpq-dev && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app/api

# Copy the requirements file and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Remove build dependencies to slim down the image
RUN apt-get remove -y build-essential libpq-dev

# Copy the rest of the application code
COPY . /app/api

# Command to run the FastAPI application with Uvicorn
CMD ["/bin/bash", "-c", "\
    echo 'DEBUG: Alembic current revision:' && alembic current && \
    echo 'DEBUG: Alembic history:' && alembic history && \
    echo 'DEBUG: Running alembic upgrade head again...' && alembic upgrade head && \
    echo 'DEBUG: Alembic upgrade head completed. Starting Uvicorn...' && \
    uvicorn main:app --host 0.0.0.0 --port $PORT \
"]
