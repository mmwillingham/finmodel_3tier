FROM node:20-alpine as build-stage

# Define the build-time argument
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app/ui

COPY package*.json ./
RUN npm install --force

COPY . .

# CRITICAL STEP: Physically create the .env file so Vite sees it
# We also include REACT_APP_API_URL for backward compatibility in your config
RUN echo "VITE_API_URL=$VITE_API_URL" > .env && \
    echo "REACT_APP_API_URL=$VITE_API_URL" >> .env && \
    npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine
# Copy from 'build' as per your vite.config.js outDir
COPY --from=build-stage /app/ui/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]