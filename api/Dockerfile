# --- Builder Stage ---
FROM python:3.11-slim-bookworm as builder

WORKDIR /app/api
COPY requirements.txt .
# Create wheels to speed up the final image build
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt [cite: 2]

# --- Runtime Stage ---
FROM python:3.11-slim-bookworm

# Python performance and stability settings
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONOPTIMIZE=1

WORKDIR /app/api

# Install dependencies from wheels and clean up immediately
COPY --from=builder /wheels /wheels_cache/
COPY requirements.txt .
RUN pip install --no-cache-dir --no-index --find-links=/wheels_cache/ -r requirements.txt \
    && rm -rf /wheels_cache/ [cite: 3]

# Copy only the application code
COPY . /app/api [cite: 4]

# Start Uvicorn directly
# Cloud Run injects $PORT; 8080 is the default
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]