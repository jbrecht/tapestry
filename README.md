# Tapestry Monorepo

This repository contains both the Tapestry frontend (built with Angular) and the Tapestry-Serve backend (built with Express). They are managed together using NPM Workspaces.

## Project Structure

This monorepo is divided into three packages:

- `packages/frontend/`: The Angular application (previously a standalone repo).
- `packages/backend/`: The Node/Express API server.
- `packages/shared/`: Shared TypeScript types, interfaces, and Zod schemas used by both the frontend and backend.

## Development

You can run both the frontend and backend development servers simultaneously from the root of the project with a single command.

```bash
npm install
npm start
```

_This will start the Angular dev server on `http://localhost:4200` and the Express dev server (using Nodemon) on `http://localhost:3000`._

### Running Commands for Specific Packages

If you need to run a command (like adding a dependency or running a specific NPM script) for just one package, use the `-w` (workspace) flag:

```bash
# Add an npm package strictly to the backend
npm install axios -w @tapestry/backend

# Add an npm package strictly to the frontend
npm install d3 -w @tapestry/frontend
```

## Deployment

Deployments are handled by explicitly targeting the desired workspace.

### Deploying the Frontend (GitHub Pages)

To build and deploy the frontend to GitHub Pages, run the following command from the root directory:

```bash
npm run deploy:frontend
```

_This command runs `ng build` and then uses the `gh-pages` package to publish the `dist/tapestry/browser` folder._

### Deploying the Backend (Railway)

When connecting this repository to Railway to host the backend API, ensure your Railway service is configured with the following settings:

- **Root Directory:** `/` (The default root of the repo)
- **Build Command:** `npm run build:all` (Ensures the shared types package is built before the backend compiles).
- **Start Command:** `npm run start:backend` (This explicitly tells Railway to boot the Express app and ignore the frontend).
