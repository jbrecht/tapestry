# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Running the full stack
```bash
npm start                          # backend + frontend concurrently
npm run start:backend              # backend only
```

### Backend development
```bash
npm run dev -w @tapestry/backend   # nodemon + ts-node/esm, port 3000
npm run test -w @tapestry/backend  # vitest
npx vitest run src/extractor.test.ts  # single test file
```

### Frontend development
```bash
npm start -w @tapestry/frontend    # ng serve, port 4200
ng test                            # karma
```

## Architecture

### Monorepo layout
```
packages/
  backend/   — Express + LangChain/LangGraph + SQLite (better-sqlite3)
  frontend/  — Angular 21 standalone components
```

### Backend (`packages/backend/src/`)
- **`index.ts`** — Express server with main AI routes:
  - `POST /weave` — SSE: streams chat reply tokens (`{type:'token'}`) from a fast OpenAI call in parallel with structured graph extraction; ends with `{type:'result'}` containing updated nodes/edges
  - `POST /extract` — SSE: text or URL ingestion; shared via `runChunkedExtraction()` helper; sends `fetching` → `start` → `progress` → `linking` → `result` events; URL mode uses `fetchUrlAsText()` which strips HTML via `node-html-parser`, preferring `article`/`main`/`#mw-content-text`
  - `POST /extract-file` — SSE: multipart file upload (.txt, .md, .pdf); multer memory storage; PDF text via `PDFParse` from `pdf-parse` v2 class API; feeds into same `runChunkedExtraction()` pipeline
  - `runChunkedExtraction()` — shared helper: 8000-char overlapping chunks, sequential processing, then a **link pass** that runs one more extraction over all new entity names to find cross-chunk relationships
- **`extractor.ts`** — LangGraph `extractionNode` using `withStructuredOutput(TapestryExtractionSchema)`; `applyExtractionResult()` merges incoming nodes/edges by label (case-insensitive); `sanitizeForPrompt()` strips internal `_`-prefixed attributes before sending to AI
- **`schema.ts`** — Zod schema defining the extraction output shape (`TapestryExtractionSchema`)
- **`db.ts`** — SQLite setup; migrations are additive `ALTER TABLE` statements. **Important:** SQLite rejects `CURRENT_TIMESTAMP` as a default in `ALTER TABLE` — add the column as nullable, then `UPDATE` to backfill
- **`routes/`** — auth, projects, users; JWT-based auth; default credentials are `admin` / `admin123`

### Frontend (`packages/frontend/src/app/`)
- **State** — single NgRx Signals store (`tapestry.store.ts`) with `signalStore` / `withMethods` / `withHooks`; 50-entry undo/redo stacks stored in `undoStack`/`redoStack` arrays; auto-saved to the backend via `rxMethod` + debounce
- **Internal attribute convention** — attributes prefixed with `_` (e.g., `_isDraft`, `_msgIdx`, `_geocodeFailed`) are UI-only; `sanitizeForPrompt()` strips them before AI calls
- **Node types** — `Person | Place | Thing | Event`; Place nodes get auto-geocoded via Nominatim after extraction
- **Perspectives** — `abstract` (D3 canvas), `map` (Leaflet), `timeline`, `table`; switched via `PerspectiveSwitcher`; active stored in `activePerspective` signal
- **Canvas** (`canvas/`) — D3 force simulation in `GraphSimulationService`; pixel rendering in `CanvasRendererService`; multi-select via Cmd/Ctrl+click draws dashed blue ring (vs. solid amber for single select)
- **Chat drawer** (`chat/`) — two tabs: Chat (calls `/weave`) and Extract (calls `/extract`); both use native `fetch` + `ReadableStream` SSE; no HttpClient
- **Node detail panel** — auto-focuses label input on draft node (`_isDraft`); inline edge predicate editing via `editingEdgeId` signal; predicate `<span>` must be a sibling of, not inside, the navigate `<button>` to avoid click conflicts
- **Map** (`map/`) — Leaflet with Nominatim geocoding; `pinningNodeId` in store enables click-to-place mode

### Data flow
1. User sends chat → `/weave` streams tokens → `result` event → `store.updateGraph(nodes, edges)`
2. User pastes text → `/extract` chunks it → streams progress → `result` → `store.updateGraph()`
3. Graph is auto-saved to SQLite via debounced `rxMethod` on every state change

### Environment
- Backend env: `OPENAI_API_KEY` required; `PORT` (default 3000), `FRONTEND_URL` for CORS
- Frontend: `packages/frontend/src/environments/environment.ts` sets `apiUrl: 'http://localhost:3000'`
- SQLite DB: `packages/backend/tapestry.db` (gitignored)
