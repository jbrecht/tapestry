# Tapestry — TODO

A living list of planned work, roughly ordered by priority.

---

## In Progress / Up Next

- [x] **New node UX** — auto-focus and select the label input when a draft node opens in the detail panel; the existing draft flow is sufficient without a separate dialog
- [x] **Extract panel** — "Extract" tab in the chat drawer; pastes text to `POST /extract` without touching chat history; shows added node/edge count on completion
- [x] **Import JSON** — upload icon button in top bar merges nodes/edges from a `.json` file into the current project (deduplicates by ID)

---

## Core UX

- [x] **Import JSON** — upload button in top bar merges nodes/edges from a `.json` file (deduplicates by ID)
- [x] **Edge editing** — click predicate label in connections list to edit inline; Enter/blur saves, Escape cancels
- [x] **Bulk select & delete** — Cmd/Ctrl+click to multi-select nodes (dashed blue ring); floating bar shows count and Delete button; Esc clears selection
- [x] **Keyboard shortcut reference** — `?` key and `?` button in top bar open help modal with full shortcut table
- [x] **Help modal** — sections for Getting Started, Nodes, Connections, Map, and Keyboard Shortcuts

---

## Perspectives

- [ ] **Family Tree view** — hierarchical tree layout, primarily for Person nodes with parent/child edges
- [ ] **Ledger view** — tabular financial/accounting layout, useful for transaction or resource-flow graphs

---

## AI / Chat

- [x] **Streaming AI responses** — reply tokens stream in parallel with structured extraction; live bubble appears immediately
- [ ] **Selective re-extraction** — ability to re-run extraction on a single message without re-sending it
- [ ] **Suggested edges** — after extraction, AI proposes relationships between newly added nodes and existing ones

---

## Ingestion

The chat box is not the right place for source material. Ingestion is a separate mode — feed documents in, get graph updates out, keep the chat clean.

- [x] **Extract panel** — "Extract" tab in the chat drawer; text is sent to `POST /extract` without chat history
- [x] **`POST /extract` endpoint** — dedicated route reusing the extractor; no chat history in prompt; returns graph delta + summary string
- [x] **Document upload** — accept `.txt`, `.md`, `.pdf` files in the extract panel; PDF text extraction on the backend via pdf-parse; `POST /extract-file` multipart endpoint
- [x] **URL ingestion** — "From URL" mode in the Extract tab; backend fetches, strips HTML (prefers article/main content), chunks and extracts; works well with Wikipedia and open articles
- [x] **Chunking for large documents** — 8000-char overlapping chunks processed sequentially; nearly 2x node yield on test (32 → 60 nodes, 65 edges from History of Chicago article)
- [x] **Improve extraction density** — prompt tuned to be more aggressive ("extract EVERY entity", "capture even weak connections"); link pass added after chunked processing to find cross-document relationships

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

- [x] **Project delete** — already exists in the project switcher menu
- [x] **Project duplication** — clone an existing project as a starting point; "Duplicate Project" in project menu; copies nodes, edges, and chat history

---

## Infrastructure

- [ ] **Deploy pipeline** — CI/CD for building and deploying the app (e.g. Railway, Fly, or Render for backend; Vercel/Netlify for frontend)
- [x] **Export to CSV** — CSV button in top bar exports nodes + edges as a combined file (two sections); attribute columns are discovered dynamically across all nodes
- [ ] **Export to GraphML / JSON-LD** — interoperability with other graph tools
