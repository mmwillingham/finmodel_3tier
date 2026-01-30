FROM python:3.11-slim-bookworm

# Stability settings
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONOPTIMIZE=1

WORKDIR /app

# Step 1: Install dependencies directly
# In your cloudbuild.yaml, context is 'api', so requirements.txt is right there.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Step 2: Copy the code
COPY . .

# Step 3: Start the engine
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]