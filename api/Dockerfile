# --- Builder Stage ---
FROM python:3.11-slim-bookworm as builder

# Use /app/api as the source root for the builder
WORKDIR /app/api

# Pre-install dependencies into wheels
COPY requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

# --- Runtime Stage ---
FROM python:3.11-slim-bookworm

# Standard Python environment optimization
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONOPTIMIZE=1

# Set WORKDIR to /app/api so that main:app is in the root of the execution path
WORKDIR /app/api

# Install dependencies from the builder's cache
COPY requirements.txt .
COPY --from=builder /wheels /wheels_cache/
RUN pip install --no-cache-dir --no-index --find-links=/wheels_cache/ -r requirements.txt \
    && rm -rf /wheels_cache/

# Copy all code from your api/ folder into the container's /app/api/
COPY . .

# IMPORTANT: No 'api.' prefix because we are already in the /app/api directory.
# This alignment fixes the 404s and allows CORS headers to be served.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]