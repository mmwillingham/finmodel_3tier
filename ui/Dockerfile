# ui/Dockerfile

FROM node:20-alpine as build-stage

# Accept the argument from Cloud Build
ARG REACT_APP_API_URL

WORKDIR /app/ui

COPY package*.json ./
RUN npm cache clean --force && npm install --force

COPY . .

# Set BOTH variables during the build process. 
# VITE_ is required for Vite to embed the variable in the JS bundle.
RUN VITE_API_URL=$REACT_APP_API_URL \
    REACT_APP_API_URL=$REACT_APP_API_URL \
    npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine
COPY --from=build-stage /app/ui/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;", "-c", "/etc/nginx/nginx.conf"]