# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Backend
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend-node/package*.json ./
RUN npm install
COPY backend-node/ ./
RUN npm run build

# Stage 3: Final Image
FROM node:20-alpine
WORKDIR /app

# Copy built backend
COPY --from=backend-builder /app/backend/dist ./backend-node/dist
COPY --from=backend-builder /app/backend/package*.json ./backend-node/
COPY --from=backend-builder /app/backend/node_modules ./backend-node/node_modules

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy other necessary files
COPY client_secret.json ./
# Note: .env should be provided at runtime or mapped via volume

EXPOSE 5199

WORKDIR /app/backend-node
CMD ["npm", "start"]
