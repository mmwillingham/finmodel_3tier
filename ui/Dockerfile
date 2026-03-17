FROM node:20-alpine as build-stage

ARG REACT_APP_API_URL
ARG REACT_APP_FRONTEND_URL
# ADD THIS: Accept the shield key argument
ARG VITE_MMR_SHIELD_KEY

WORKDIR /app/ui

# Copy package.json and package-lock.json and install dependencies
COPY package*.json ./
RUN npm cache clean --force && npm install --force

# Copy the rest of the application code
COPY . .

# Build with Vite, setting REACT_APP_API_URL environment variable
# Vite will handle the build and output to 'build' directory
ENV VITE_MMR_SHIELD_KEY=$VITE_MMR_SHIELD_KEY
RUN REACT_APP_API_URL=$REACT_APP_API_URL REACT_APP_FRONTEND_URL=$REACT_APP_FRONTEND_URL npm run build

# Stage 2: Serve the React application with Nginx
FROM node:20-alpine as runtime

WORKDIR /app

ENV NODE_ENV=production

# Copy only what we need from the build stage so the runtime image stays lean
COPY --from=build-stage /app/ui/build ./build
COPY --from=build-stage /app/ui/node_modules ./node_modules
COPY --from=build-stage /app/ui/package*.json ./
COPY --from=build-stage /app/ui/server ./server

EXPOSE 8080

CMD ["node", "server/server.js"]