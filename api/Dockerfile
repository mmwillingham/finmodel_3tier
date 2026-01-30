FROM python:3.11-slim-bookworm
WORKDIR /app
# Cloud context is 'api', so requirements.txt is at the root
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]