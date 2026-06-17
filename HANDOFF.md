# Zotero → Tana — session handoff

Goal: a **Zotero plugin that live-syncs items into Tana Outliner**, adapting
[notero](https://github.com/dvanoni/notero) (a Zotero 7 plugin that syncs to
Notion) by swapping its Notion layer for Tana's **Local API** (REST,
`localhost:8262`). Items sync on add/modify and **update in place** on re-sync.

This replaces an earlier manual approach (a Zotero export translator at
`~/repos/tana-paste-examples/zotero-translator-tana.js` + a `#zotero` + 15
type-tag schema). The translator and old tags still exist but are being retired.

## Status

| Stage | State |
| --- | --- |
| 1 — Create the Tana `#reference` schema | ✅ done (in graph) |
| 2 — Mapping prototype (item → Tana Paste) | ✅ done (`prototype/`) |
| 3 — Fork notero, build the plugin | ⏳ keystone done (`src/tana/client.ts`); **fork not started** |

## What exists in this repo

- **`prototype/`** — pure-ESM mapping harness, no Zotero runtime, no deps.
  `node build-samples.mjs` prints Tana Paste for 4 fixtures (journal, book,
  podcast, institutional report). This is the validated mapping logic to port
  into the plugin. Files: `constants.mjs` (field/tag IDs + itemType→primary-role
  map), `entities.mjs` (creator bucketing + Person/Org routing),
  `reference-builder.mjs` (item → ordered Tana field entries; base-field reads,
  title formats, podcast override), `tana-paste.mjs` (entries → Tana Paste text),
  `fixtures.mjs`, `build-samples.mjs`. See `prototype/README.md`.
- **`src/tana/client.ts`** — thin REST client for the Tana Local API, grounded in
  the server's `openapi.json`. Methods: `health`, `import` (returns created node
  IDs), `setFieldContent` (the upsert primitive), `setFieldOption`, `setTags`,
  `trash`, `readNode`, `search`. Injected `fetch` + Bearer token.

## The Tana schema (already created in the Main workspace)

Workspace **Main** = `NAoK7gu_J9RW`. One flat supertag **`#reference`** =
`p5LeXSkgwLnh`, ~30 fields, built on Zotero **base fields** so one tag covers
every item type. Linked-entity tags: **`#Person`** = `G_JLFqxx4YAC`,
**`#Organization`** = `XdX5rF8lLQjF`. All field attribute IDs are in
`prototype/constants.mjs` (the source of truth). Item Type is an `options` field
seeded with all 37 Zotero item types (auto-collecting). The legacy `#zotero`
(`TzDCQmZmk33W`) + 15 type tags are untouched — coexist pending migration.

Mapping rules (validated in the prototype):
- Node name = computed Title (six notero formats, default author-date).
- People split **primary-role-aware**: Creators (the item type's *primary*
  creator role — author, but podcaster/presenter/director/… per type), Editors
  (editor + seriesEditor), Contributors (rest). Each entry routes by `fieldMode`:
  persons → `#Person`, institutions (`fieldMode 1`) → `#Organization`.
- Publisher → `#Organization`. Place → plain text.
- Container = `publicationTitle` base field; for **podcast**, promoted from
  `seriesTitle` (since podcast has no publicationTitle).
- Item = `zotero://select/...` back-link (the upsert key on the Zotero side).
- No Status field (the user manages reading status manually).

## Verified facts (live probes against Main, 2026-06-17)

The write path is fully de-risked:
- `import` (POST `/nodes/{parent}/import`) **returns created node IDs** →
  capture the `#reference` node's id (the created node whose `name` === the
  title; field-value nodes come back empty-named) and store it on the Zotero item.
- **`zotero://` links are accepted** (the REST/MCP path renders them; the cloud
  Input API would reject them — so we use the Local API, not the cloud one).
- **`[[Name #Person]]` dedups by exact name** → same person/org across items
  resolves to one node. Name normalization matters; namesakes collapse.
- **`[[date:YYYY-MM-DD]]`** populates a Date-typed field as a real date.
- **Field-name emission is collision-safe** — `Date::` on a `#reference` node
  resolves to `#reference`'s Date, not the legacy `#zotero` same-named field
  (paste scopes field resolution to the applied supertag). IDs in `constants.mjs`
  remain available if ID-based emission is ever preferred.

## The Tana Local API (REST, not MCP)

`localhost:8262` exposes a plain REST API (`GET /openapi.json`, "Tana Local API"
v1.0.0); `/mcp` is just the AI-client façade. The app must be running with the
Local API enabled and the workspace loaded. Auth = personal API token (Tana →
Settings → API Tokens), Bearer header. Key endpoints (shapes in `client.ts`):
`POST /nodes/{parentNodeId}/import` · `POST /nodes/{nodeId}/fields/{attributeId}/content`
· `.../option` · `POST /nodes/{nodeId}/tags|trash|update|move` · `GET /nodes/search`
· `GET /nodes/{nodeId}` · `GET /tags/{tagId}/schema` · `GET /health`.

## Next: stage 3 — the notero fork (NOT started)

notero source is at **`~/repos/notero`** (read it before forking). Plan:

1. **Copy notero into this repo** as the plugin root, keeping its Zotero scaffold
   and build toolchain (Vite+/esbuild): `bootstrap.ts`, manifest, locale `.ftl`,
   the preferences pane, and `src/content/services/*` (collection watching,
   sync-on-modify, context menus). Reconcile with the existing `src/tana/` and
   `prototype/`.
2. **Reuse, unchanged:** `services/*`, `sync/sync-job.ts` orchestration,
   `sync/progress-window.ts`, `errors/`, and the Zotero-reading half of
   `sync/property-builder.ts`.
3. **Replace the Notion third:** delete `sync/notion-client.ts`,
   `notion-types.ts`, `notion-utils/`, `notion-limits.ts`, `@notionhq/client`,
   and the `auth/` Notion OAuth. In their place:
   - `src/tana/client.ts` (done).
   - Port `prototype/{constants,entities,reference-builder,tana-paste}.mjs` →
     `src/tana/*.ts`, swapping fixture reads for live Zotero APIs:
     `item.getField(baseField)` (Zotero resolves base fields),
     `item.getCreators()` (exposes firstName/lastName/fieldMode/creatorTypeID),
     `Zotero.QuickCopy.getContentFromItems(...)` for Full/In-Text Citation (CSL).
   - Rewrite `sync/sync-regular-item.ts` as an **upsert**: if the item has a
     stored Tana node ID → `setFieldContent`/`setFieldOption` per field (and
     `update` for the name); else `import` the Tana Paste and capture the new id.
     Add a `client.health()` preflight that fails gracefully ("open Tana").
4. **Repurpose `sync/data/item-data.ts`** — notero stores the Notion page URL as
   a hidden Zotero link-attachment so re-syncs find the page. Store the **Tana
   node ID** the same way (this is the upsert key).
5. **Prefs + rebrand:** replace Notion database ID/OAuth with a **token** field +
   a **parent node ID** (where new `#reference` nodes land — e.g. Library
   `NAoK7gu_J9RW_STASH` or Inbox `NAoK7gu_J9RW_CAPTURE_INBOX`). Rename
   notero/Notion → the chosen plugin name throughout (locale, manifest, ids).
6. **Notes/annotations (later):** notero's `html-to-notion/` → a `html-to-tana`
   (or Tana Paste) equivalent for Zotero notes + PDF annotations.

## Open decisions

- **Plugin name** — defaulted to "Zotero to Tana" (`zotero-to-tana`); user may
  prefer something snappier (e.g. "Zotana"). Decide before rebranding.
- **Parent node** for new references (Library vs Inbox vs a dedicated node).
- **Citations** are stubbed in the prototype; wire live CSL in the plugin.

## Resume pointers

- Auto-memory: `tana-reference-suite` (project state), `tana-import-paste-behaviors`,
  `tana-options-fields-auto-collect` (verified Tana behaviors), `works-conversationally`
  (the user prefers one decision at a time; don't batch questions).
- Capacities precedent (the mapping approach this is modeled on):
  `~/repos/capacities/prototype/zotero-to-capacities/`.
- To re-run the prototype: `cd prototype && node build-samples.mjs`.
- The Zotero schema (base fields, creator roles) lives at
  `github.com/zotero/zotero-schema` (`schema.json`).
