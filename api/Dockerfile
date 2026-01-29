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

WORKDIR /app

COPY --from=builder /wheels /wheels_cache/
COPY requirements.txt .
RUN pip install --no-cache-dir --no-index --find-links=/wheels_cache/ -r requirements.txt \
    && rm -rf /wheels_cache/

COPY . .

#CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8080"]