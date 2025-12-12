# Dockerfile for the React frontend

# Stage 1: Build the React application
FROM node:18-alpine as build-stage

WORKDIR /app/ui

# Copy package.json and package-lock.json and install dependencies
COPY ./ui/package*.json .
RUN npm install

# Copy the rest of the application code
COPY ./ui .

# Build the React app
RUN npm run build

# Stage 2: Serve the React application with Nginx
FROM nginx:alpine

# Copy the built React app from the build-stage
COPY --from=build-stage /app/ui/build /usr/share/nginx/html

# Copy our custom Nginx configuration
COPY ./ui/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 for Nginx
EXPOSE 80

# Command to start Nginx
CMD ["nginx", "-g", "daemon off;"]