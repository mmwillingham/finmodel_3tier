# --- Builder Stage ---
FROM python:3.11-slim-bookworm as builder
WORKDIR /build
COPY requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

# --- Runtime Stage ---
FROM python:3.11-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONOPTIMIZE=1

# Use a clean, non-overlapping directory
WORKDIR /app
COPY --from=builder /wheels /wheels_cache/
COPY requirements.txt .
RUN pip install --no-cache-dir --no-index --find-links=/wheels_cache/ -r requirements.txt \
    && rm -rf /wheels_cache/

# Copy everything from the 'api' context directly into /app
COPY . .

# Run main:app from the /app directory
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]