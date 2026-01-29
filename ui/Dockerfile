FROM node:20-alpine as build-stage

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app/ui

COPY package*.json ./
RUN npm cache clean --force && npm install --force

COPY . .

# Vite will use the outDir: 'build' specified in your vite.config.js
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy from 'build' as per your vite.config.js
COPY --from=build-stage /app/ui/build /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]