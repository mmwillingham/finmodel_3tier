FROM node:20-alpine as build-stage

ARG VITE_API_URL
WORKDIR /app/ui

COPY package*.json ./
RUN npm install --force

COPY . .

# FORCE VITE TO SEE THE URL: Write it to a .env file before building
RUN echo "VITE_API_URL=$VITE_API_URL" > .env && \
    echo "REACT_APP_API_URL=$VITE_API_URL" >> .env && \
    npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine
COPY --from=build-stage /app/ui/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]