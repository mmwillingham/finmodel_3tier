FROM node:20-alpine as build-stage

WORKDIR /app/ui

# Copy package.json and package-lock.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the React app, explicitly setting REACT_APP_API_URL for the build command
RUN REACT_APP_API_URL="https://finmodel-backend-service-msdi7jcivq-ue.a.run.app" npm run build

# Stage 2: Serve the React application with Nginx
FROM nginx:alpine

# Copy the built React app from the build-stage
COPY --from=build-stage /app/ui/build /usr/share/nginx/html

# Copy our custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 8080 for Nginx (Cloud Run expects 8080)
EXPOSE 8080

# Command to start Nginx, using the Cloud Run injected PORT variable
# Ensure Nginx listens on 8080 and its config is properly applied.
CMD ["nginx", "-g", "daemon off;", "-c", "/etc/nginx/nginx.conf"]