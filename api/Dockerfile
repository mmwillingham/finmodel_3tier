# --- Builder Stage ---
FROM python:3.11-slim-bookworm AS builder
WORKDIR /app/api

# REMOVE "api/" prefix because cloudbuild.yaml already points to the api folder
COPY requirements.txt . 
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

# --- Runtime Stage ---
FROM python:3.11-slim-bookworm
WORKDIR /app/api

# REMOVE "api/" prefix here too
COPY requirements.txt .
COPY --from=builder /wheels /wheels_cache/
RUN pip install --no-cache-dir --no-index --find-links=/wheels_cache/ -r requirements.txt

# REMOVE "api/" prefix. COPY "." means "copy everything from the context"
COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]