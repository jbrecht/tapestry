# Agent Instructions: Tapestry Monorepo

Tapestry is a monorepo managed with NPM Workspaces. Users build knowledge graphs through a conversational AI interface. Read this file before making any changes.

## Repo Structure

- `packages/frontend/` — Angular 21 SPA. See `packages/frontend/AGENTS.md` for frontend-specific rules.
- `packages/backend/` — Node/Express API server. See `packages/backend/AGENTS.md` for backend-specific rules.
- `packages/shared/` — Shared TypeScript types used by both packages. If a type is needed in both frontend and backend, it belongs here — do not duplicate it.

## Workspaces

Install dependencies scoped to the correct package:

```bash
npm install <package> -w @tapestry/backend
npm install <package> -w @tapestry/frontend
```

Never install to the root unless it's a dev tool needed across all packages (e.g. `concurrently`).

## Running Locally

```bash
npm install
npm start  # starts both frontend (:4200) and backend (:3000)
```

## Deployment

- **Frontend:** GitHub Pages via `npm run deploy:frontend`
- **Backend:** Railway — auto-deploys on push to `master`. Build command: `npm run build:all`. Start command: `npm run start:backend`.

## Environment Variables

Backend requires `packages/backend/.env`. Required variables:

- `OPENAI_API_KEY` — OpenAI API key
- `JWT_SECRET` — random 32-byte hex string (generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- `FRONTEND_URL` — origin of the frontend, used for CORS (e.g. `https://yourusername.github.io`). No trailing slash, no path.
- `PORT` — defaults to 3000
- `DB_PATH` — path to SQLite database file (Railway: `/app/data/tapestry.db`)
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — seeded admin account credentials
