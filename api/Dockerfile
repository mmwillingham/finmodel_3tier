# --- Builder Stage ---
FROM python:3.11-slim-bookworm AS builder
WORKDIR /app/api

# In this context, requirements.txt is at the root
COPY requirements.txt . 
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

# --- Runtime Stage ---
FROM python:3.11-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONOPTIMIZE=1
WORKDIR /app/api

# Install dependencies
COPY --from=builder /wheels /wheels_cache/
COPY requirements.txt .
RUN pip install --no-cache-dir --no-index --find-links=/wheels_cache/ -r requirements.txt \
    && rm -rf /wheels_cache/

# Copy application code
# Since the context is the 'api' folder, we copy everything from it
COPY . /app/api

# Start Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]