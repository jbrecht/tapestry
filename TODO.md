# Tapestry — TODO

A living list of planned work, roughly ordered by priority.

---

## In Progress / Up Next

- [ ] **Node create dialog** — when clicking "New Node" in the top bar, open a small dialog to set label + type before creating, rather than creating a blank draft node and opening the detail panel

---

## Core UX

- [ ] **Import JSON** — complement to the existing Export JSON; load a previously exported `.json` file back into a project
- [ ] **Edge editing** — currently edges can be deleted but not renamed; allow editing the predicate inline in the connections list
- [ ] **Bulk select & delete** — shift-click or lasso-select multiple nodes in the canvas, then delete or group them
- [ ] **Keyboard shortcut reference** — a `?` or `/` hotkey that opens a cheat-sheet overlay (Esc, ⌘Z, ⌘⇧Z, etc.)

---

## Perspectives

- [ ] **Family Tree view** — hierarchical tree layout, primarily for Person nodes with parent/child edges
- [ ] **Ledger view** — tabular financial/accounting layout, useful for transaction or resource-flow graphs

---

## AI / Extraction

- [ ] **Streaming AI responses** — stream the assistant reply token-by-token so the chat feels faster
- [ ] **Selective re-extraction** — ability to re-run extraction on a single message without re-sending it
- [ ] **Suggested edges** — after extraction, AI proposes relationships between newly added nodes and existing ones

---

## Map

- [ ] **Cluster markers** — when many Place nodes are close together, cluster them at low zoom levels
- [ ] **Map filter** — toggle which node types appear as markers
- [ ] **Custom map tiles** — option to switch between OSM, satellite, and other tile providers

---

## Project Management

- [ ] **Project delete** — add a destructive delete option to the Edit Project dialog (with confirmation)
- [ ] **Project duplication** — clone an existing project as a starting point

---

## Infrastructure

- [ ] **Deploy pipeline** — CI/CD for building and deploying the app (e.g. Railway, Fly, or Render for backend; Vercel/Netlify for frontend)
- [ ] **Export to CSV** — export the node table to `.csv` for use in spreadsheets
- [ ] **Export to GraphML / JSON-LD** — interoperability with other graph tools
