# Tapestry — TODO

A living list of planned work, roughly ordered by priority.

---

## In Progress / Up Next

- [x] **New node UX** — auto-focus and select the label input when a draft node opens in the detail panel; the existing draft flow is sufficient without a separate dialog
- [x] **Extract panel** — "Extract" tab in the chat drawer; pastes text to `POST /extract` without touching chat history; shows added node/edge count on completion
- [x] **Import JSON** — upload icon button in top bar merges nodes/edges from a `.json` file into the current project (deduplicates by ID)

---

## Core UX

- [ ] **Import JSON** — complement to the existing Export JSON; load a previously exported `.json` file back into a project
- [ ] **Edge editing** — currently edges can be deleted but not renamed; allow editing the predicate inline in the connections list
- [ ] **Bulk select & delete** — shift-click or lasso-select multiple nodes in the canvas, then delete or group them
- [ ] **Keyboard shortcut reference** — a `?` or `/` hotkey that opens a cheat-sheet overlay (Esc, ⌘Z, ⌘⇧Z, etc.)
- [ ] **Help modal** — `?` button in the top bar opens a modal with how-tos (Getting Started, Nodes, Connections, Map, Chat & AI, Keyboard Shortcuts); static content for now, AI-assisted help later once feature set is stable

---

## Perspectives

- [ ] **Family Tree view** — hierarchical tree layout, primarily for Person nodes with parent/child edges
- [ ] **Ledger view** — tabular financial/accounting layout, useful for transaction or resource-flow graphs

---

## AI / Chat

- [ ] **Streaming AI responses** — stream the assistant reply token-by-token so the chat feels faster
- [ ] **Selective re-extraction** — ability to re-run extraction on a single message without re-sending it
- [ ] **Suggested edges** — after extraction, AI proposes relationships between newly added nodes and existing ones

---

## Ingestion

The chat box is not the right place for source material. Ingestion is a separate mode — feed documents in, get graph updates out, keep the chat clean.

- [x] **Extract panel** — "Extract" tab in the chat drawer; text is sent to `POST /extract` without chat history
- [x] **`POST /extract` endpoint** — dedicated route reusing the extractor; no chat history in prompt; returns graph delta + summary string
- [ ] **Document upload** — accept `.txt`, `.md`, `.pdf` files in the extract panel; PDF text extraction on the backend
- [ ] **URL ingestion** — paste a URL (Wikipedia, article, etc.) and have the backend fetch + extract from it
- [ ] **Chunking for large documents** — split long texts into overlapping chunks, run extraction per chunk, merge results with deduplication by label/type before applying to the graph

---

## Map

- [ ] **Cluster markers** — when many Place nodes are close together, cluster them at low zoom levels
- [ ] **Map filter** — toggle which node types appear as markers
- [ ] **Custom map tiles** — option to switch between OSM, satellite, and other tile providers
- [ ] **Media upload infrastructure** — `POST /media` multipart endpoint, local `uploads/` storage, static file serving; prerequisite for custom maps and node images
- [ ] **Custom map** — per-project image-based map using Leaflet `L.CRS.Simple` + `L.imageOverlay`; project gets a `mapType: 'geo' | 'custom'` flag; geocoding hidden in custom mode, pin-only placement; coordinates stored as normalized [0,1] so they're resolution-independent
- [ ] **Node images** — upload a photo to a node via the detail panel (e.g. portrait for a Person); same upload infrastructure as custom maps

---

## Project Management

- [ ] **Project delete** — add a destructive delete option to the Edit Project dialog (with confirmation)
- [ ] **Project duplication** — clone an existing project as a starting point

---

## Infrastructure

- [ ] **Deploy pipeline** — CI/CD for building and deploying the app (e.g. Railway, Fly, or Render for backend; Vercel/Netlify for frontend)
- [ ] **Export to CSV** — export the node table to `.csv` for use in spreadsheets
- [ ] **Export to GraphML / JSON-LD** — interoperability with other graph tools
