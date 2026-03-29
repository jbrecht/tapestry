# Agent Instructions: Tapestry Backend

The backend is a Node/Express API server written in TypeScript with SQLite for persistence and LangChain/LangGraph for AI orchestration.

## TypeScript

- Strict mode is enabled — no implicit `any`, no implicit returns
- Avoid `any`; use specific types or `unknown` with narrowing
- Use `.js` extensions in imports (required for ESM compatibility with `"moduleResolution": "NodeNext"`)

## Database

- Use `better-sqlite3` via the `db` singleton exported from `src/db.ts` — do not create new Database instances
- All queries must use **prepared statements** — never interpolate user input into SQL strings
- Wrap multi-step writes in a `db.transaction()` call
- The schema lives in `src/db.ts` — add new tables or columns there, with a migration guard (`ALTER TABLE ... ADD COLUMN` wrapped in try/catch)

## API & Routing

- Routes are organized by resource in `src/routes/` — add new route files there and register them in `src/index.ts`
- Use the `authenticateToken` middleware for any route that requires a logged-in user
- Use the `requireAdmin` middleware (after `authenticateToken`) for admin-only routes
- Return consistent error shapes: `{ error: string }`

## Validation

- Use Zod for all runtime validation of external input (request bodies, AI responses)
- Define schemas in `src/schema.ts` — do not scatter inline `z.object()` definitions across route files

## AI / LangGraph

- The AI pipeline is a LangGraph graph defined in `src/index.ts` and executed via the `/weave` endpoint
- Extraction logic lives in `src/extractor.ts` — this is where entity resolution, deduplication, and graph mutation happen
- Graph state is defined in `src/state.ts` using `Annotation.Root`
- GPT-4o is used with structured output enforced by Zod schemas — do not switch to unstructured output

## Authentication

- JWT tokens are signed and verified using `JWT_SECRET` from the environment — the server throws at startup if this is not set
- Do not add a fallback value for `JWT_SECRET`
- Token expiry is 1 hour
