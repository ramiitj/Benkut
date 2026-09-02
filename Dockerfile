# Builds and runs Benkut as a single Cloud Run service: one Node process
# serving the built frontend (dist/) and the /api/* backend together.
# See server/index.mjs - the same file runs both in production.

FROM node:22-slim AS builder
WORKDIR /app

# VITE_* vars are inlined into the frontend bundle at build time by Vite -
# they must be passed as --build-arg here, not just set at container runtime,
# or Firebase Auth/Firestore will silently never initialize in the browser.
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET

COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY --from=builder /app/dist ./dist

# Cloud Run sets PORT itself at runtime (defaults to 8080) - server/index.mjs
# already reads process.env.PORT, so nothing to hardcode here.
EXPOSE 8080
CMD ["node", "server/index.mjs"]
