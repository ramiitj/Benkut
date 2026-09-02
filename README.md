<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1XUH40V3NjM4j_gAyXVaO5FAElHZx2Nq9

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` and configure `GEMINI_API_KEY`, `GEMINI_MODEL`, `VITE_FIREBASE_API_KEY`, and `VITE_FIREBASE_PROJECT_ID`.
3. Enable Firebase Email/Password Authentication and deploy `firestore.rules`.
4. Run the app with `npm run dev`. This single command serves both the frontend and the `/api/*` backend (see `vite.config.ts` - its dev middleware calls straight into `server/index.mjs`'s request handler in-process), so a separate `npm run server` is not needed alongside it. `npm run server` is for the production entrypoint described below, or for running the API standalone against a separately-hosted frontend.

The consumer experience begins as an anonymous, in-memory voice session. Nothing is written to Firestore until the user explicitly chooses to save, creates an account or signs in, and selects **End & save**. Browser microphone APIs require a user gesture, so the first microphone activation is an explicit tap; listening then continues between agent turns until paused.

## Deploy to Cloud Run

The `Dockerfile` builds one container that serves both the built frontend and the `/api/*` backend from a single Node process (`server/index.mjs`) - this is what a Google AI Studio import should deploy to Cloud Run.

Two different kinds of configuration matter here, and mixing them up is the most common way this silently breaks:

- **Build-time (`--build-arg`)**: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_STORAGE_BUCKET`. Vite inlines these into the frontend JS bundle when the image is built - setting them only as Cloud Run runtime env vars has no effect, since nothing reads `import.meta.env` again after the build. If Firebase Auth/Firestore never initializes in the browser despite "the keys being set," this is almost always why.
- **Runtime (Cloud Run service env vars / secrets, no rebuild needed to change)**: `GEMINI_API_KEY`, `GEMINI_MODEL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ALLOWED_ORIGINS`. These are read fresh by the running Node process on each request - prefer `--set-secrets` over `--set-env-vars` for `GEMINI_API_KEY` and `ADMIN_PASSWORD` specifically, so they aren't visible in plain text in the service's revision config.

```bash
gcloud run deploy benkut \
  --source . \
  --region <your-region> \
  --allow-unauthenticated \
  --build-env-vars-file - <<'EOF'
VITE_FIREBASE_API_KEY: "<your Firebase web API key>"
VITE_FIREBASE_PROJECT_ID: "<your Firebase project id>"
EOF
```

(`--build-env-vars-file` is what `gcloud run deploy --source` uses to pass Docker build args when building via Cloud Build; equivalently, `docker build --build-arg VITE_FIREBASE_API_KEY=... --build-arg VITE_FIREBASE_PROJECT_ID=...` if you build and push the image yourself.) Then set the runtime configuration on the service:

```bash
gcloud run services update benkut \
  --region <your-region> \
  --set-secrets=GEMINI_API_KEY=gemini-api-key:latest,ADMIN_PASSWORD=admin-password:latest \
  --set-env-vars=ADMIN_EMAIL=<your-admin-email>,ALLOWED_ORIGINS=https://<your-cloud-run-url>
```

Once deployed, `https://<your-cloud-run-url>/api/health` should return `{"status":"ok"}` - if it instead returns the app's own HTML, the backend isn't wired up correctly and API calls will fail with a JSON-parse error client-side.
