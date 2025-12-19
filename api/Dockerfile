# Dockerfile for the FastAPI backend

# --- Builder Stage: Install dependencies ---
FROM python:3.11-slim-bookworm as builder

# Install build dependencies for psycopg2-binary (if needed)
# RUN apt-get update && apt-get install -y build-essential libpq-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app/api

# Copy the requirements file and install dependencies into /wheels
COPY requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

# --- Runtime Stage: Copy only necessary files ---
FROM python:3.11-slim-bookworm

# Set the working directory inside the container
WORKDIR /app/api

# Copy the requirements.txt to the runtime stage
COPY requirements.txt .

# Copy the pre-built wheel files from the builder stage to a cache location
COPY --from=builder /wheels /wheels_cache/

# Install dependencies from the local wheel cache. This will create executables like uvicorn.
RUN pip install --no-cache-dir --no-index --find-links=/wheels_cache/ -r requirements.txt

# Copy the rest of the application code
COPY . /app/api

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

# Command to run the FastAPI application with Uvicorn (Alembic handled in Cloud Build step)
# Explicitly pass the PORT environment variable using bash -c
CMD ["bash", "-c", "uvicorn main:app --host 0.0.0.0 --port \"$PORT\""]