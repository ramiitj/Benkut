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
4. Run the voice-agent server with `npm run server`.
5. In another terminal, run the app with `npm run dev`.

The consumer experience begins as an anonymous, in-memory voice session. Nothing is written to Firestore until the user explicitly chooses to save, creates an account or signs in, and selects **End & save**. Browser microphone APIs require a user gesture, so the first microphone activation is an explicit tap; listening then continues between agent turns until paused.
