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

# Set static environment variables directly in the Docker image
ENV DB_USER=dbadmin
ENV DB_NAME=finmodel1
ENV CLOUD_SQL_CONNECTION_NAME=financial-model-cloud:us-east1:finmodel-postgres-instance
ENV MAIL_USERNAME=martin.willingham@gmail.com
ENV MAIL_FROM=no_reply@gmail.com
ENV MAIL_PORT=587
ENV MAIL_SERVER=smtp.gmail.com
ENV FRONTEND_URL=https://finmodel-frontend-service-526419047208.us-east1.run.app
ENV PUBLIC_BACKEND_URL=https://finmodel-backend-service-526419047208.us-east1.run.app
ENV MAIL_TLS=True
ENV MAIL_SSL=False
ENV USE_CREDENTIALS=True
ENV VALIDATE_CERTS=True
# Allow all origins for now, to be refined later if needed
ENV CORS_ORIGINS_REGEX=.*

# Copy the rest of the application code
COPY . /app/api

# Command to run the FastAPI application with Uvicorn (Alembic handled in Cloud Build step)
# Explicitly pass the PORT environment variable using bash -c
CMD ["bash", "-c", "uvicorn main:app --host 0.0.0.0 --port \"$PORT\""]