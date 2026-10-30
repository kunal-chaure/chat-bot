# Gemini Chat

Clean chat UI + Express backend using **Gemini 3.8 Flash** (`gemini-3.8-flash`).
The API key stays on the server and is never sent to the browser.

## Run locally
1. `npm install`
2. Copy `.env.example` to `.env` and paste your key from https://aistudio.google.com/apikey
3. `npm run dev` then open http://localhost:3000

## Deploy on Render
1. Push this folder to a GitHub repo (`.env` is git-ignored).
2. Render dashboard > New > Web Service > connect the repo.
3. Runtime: Node. Build command: `npm install`. Start command: `npm start`.
4. Environment tab: add `GEMINI_API_KEY` (and optionally `NODE_VERSION=22`).
5. Advanced > Health Check Path: `/api/health`.
6. Deploy, then open the `onrender.com` URL.

## Settings (environment variables)
| Variable | Default | Purpose |
|---|---|---|
| GEMINI_API_KEY | required | Your Google AI Studio key |
| GEMINI_MODEL | gemini-3.8-flash | Model ID |
| THINKING_LEVEL | low | low / medium / high |
| SYSTEM_PROMPT | friendly, concise assistant | Bot personality |
