# --- Builder Stage ---
FROM python:3.11-slim-bookworm as builder

WORKDIR /app/api
COPY requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

# --- Runtime Stage ---
FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONOPTIMIZE=1

WORKDIR /app/api

COPY requirements.txt .
COPY --from=builder /wheels /wheels_cache/
RUN pip install --no-cache-dir --no-index --find-links=/wheels_cache/ -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]