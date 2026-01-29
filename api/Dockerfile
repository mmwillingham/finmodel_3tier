# --- Builder Stage: Install dependencies ---
FROM python:3.11-slim-bookworm as builder

# Set working directory for the build process
WORKDIR /app/api

# Copy the requirements file and install dependencies into wheels for faster runtime installation
COPY requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

# --- Runtime Stage: Final Image ---
FROM python:3.11-slim-bookworm

# Prevent Python from writing .pyc files and ensure logs are sent straight to terminal
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONOPTIMIZE=1

# Set the working directory to where the code resides
WORKDIR /app/api

# Copy requirements and install from the builder's wheel cache
COPY requirements.txt .
COPY --from=builder /wheels /wheels_cache/
RUN pip install --no-cache-dir --no-index --find-links=/wheels_cache/ -r requirements.txt \
    && rm -rf /wheels_cache/

# Copy all application code from your 'api' directory into the container's '/app/api'
COPY . .

# Run the FastAPI application. 
# Since WORKDIR is /app/api, 'main:app' points directly to /app/api/main.py.
# This fixes the 404/ModuleNotFoundError and allows CORS headers to be served.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]