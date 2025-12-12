# Dockerfile for the FastAPI backend

# Use a lightweight Python base image
FROM python:3.11-slim-buster

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file and install dependencies
COPY ./api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY ./api /app/api

# Expose the port FastAPI runs on
EXPOSE 8000

# Command to run the FastAPI application with Uvicorn
# --host 0.0.0.0 makes the server accessible from outside the container
# --reload is removed for production deployment as it's for development
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]