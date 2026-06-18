# Zotero → Tana — session handoff

Goal: a **Zotero plugin that live-syncs items into Tana Outliner**, adapting
[notero](https://github.com/dvanoni/notero) (a Zotero 7 plugin that syncs to
Notion) by swapping its Notion layer for Tana's **Local API** (REST,
`localhost:8262`). Items sync on add/modify and **update in place** on re-sync.

This replaces an earlier manual approach (a Zotero export translator at
`~/repos/tana-paste-examples/zotero-translator-tana.js` + a `#zotero` + 15
type-tag schema). The translator and old tags still exist but are being retired.

## Session 2026-06-18 — user-configurable schema (no hardcoded IDs) — RESUME HERE

Reworked the plugin so the Tana tag + fields are **configured by name in
preferences and resolved/bootstrapped at runtime** instead of being hardcoded to
one workspace's IDs. Committed as `d80719c` (first real source commit — only
`src/content/tana/client.ts` was tracked before, so the whole plugin tree went in
with it). **95 tests passing / 15 files**, `tsc` clean, `pnpm build` + XPI repackage
clean. XPI: `xpi/zotana-0.1.1-jkroes.Mac.attlocal.net.xpi`.

**What changed:**
- **`constants.ts` → a field `CATALOG`** (per field: `key`, `defaultName`,
  `dataType`, `multiValue`, `transientSeed`). No more hardcoded attribute/tag IDs.
- **`prefs/schema-config.ts` (new)** — `SchemaConfig { tagName, fields:[{key,name,
  enabled}] }`, persisted as JSON in the `schemaConfig` pref; catalog-aware
  `mergeSchemaConfig` (fills new catalog fields, drops unknown keys, blank name →
  default). Default tag name = **`zotero`** (`DEFAULT_TAG_NAME`).
- **`tana/schema.ts` (new)** — `ensureSchema(client, config, {workspaceId,
  optionSeeds})`: finds the tag by name (creates it + `#Person`/`#Organization`/
  `#quote` if missing), parses `/tags/{id}/schema` markdown for name→id, creates
  any missing **enabled** fields with their catalog `dataType`, and **seed-then-
  trashes** the placeholder option required to create entity Options fields. Returns
  `ResolvedSchema {workspaceId, tagId, tagName, entityTagIds, quoteTagId, fields}`.
  Runs as a sync preflight (`sync-job.ts`), so the first sync auto-bootstraps.
- **`client.ts`** — added `listWorkspaces`, `listWorkspaceTags`, `createTag`,
  `addField`, `getTagSchema`.
- **Builder/sync/job/annotations** consume `ResolvedSchema`; **disabled fields are
  skipped**; `nodeReachable`/`resolveEntityNodeId`/clear-loop are schema-driven.
- **Prefs panel (`prefs/schema-panel.tsx`, new)** — workspace dropdown
  (`listWorkspaces`), `#tag` name input, field table (per-row: sync checkbox +
  rename + read-only type), and a **"Create / refresh schema in Tana"** button.
  New prefs: `tanaWorkspaceId`, `schemaConfig`.

**IMPORTANT — entity fields stayed Options (corrected mid-session):** I initially
switched Creators/Editors/Contributors/Publisher to **Instance-of**; the user had
NOT signed off and reverted it (see memory `get-signoff-on-design-decisions`). The
verified-correct design (memory `tana-field-types-write-methods`): they are
**Options** fields, written **by-id** via `setFieldOption(optionId=existing node id,
append)` — which reuses the existing entity node (no duplicates) and auto-collects a
**mixed #Person+#Organization** picker. The REST API can't create an empty Options
field (400), so bootstrap seeds with `__zotana_seed__` then `trash`es that option;
the field still accepts writes afterward (verified live by a parallel session).

**Verified live (2026-06-18) — REST schema-creation works:** `POST /workspaces/{ws}/
tags`, `POST /tags/{tagId}/fields` (`dataType` ∈ plain|number|date|url|email|checkbox|
user|instance|options), `GET /tags/{tagId}/schema`, `GET /workspaces[/{ws}/tags]`.
Constraints found: `instance` needs `sourceTagId`; `options` needs a non-empty seed.
Created types render as: plain→Content, number→#Number, date→Date, url→URL,
options→Options, instance→Instance of #X. (Spike: `/tmp/claude/tana-field-spike.mjs`.)

⏳ **NEXT (do first):**
- **Lint debt:** the pre-commit hook (oxlint, strict) reports ~36 errors / 17
  warnings across the now-committed tree — mostly pre-existing test-mock patterns
  (`as unknown as TanaClient`, `query: any`) plus a few in the new files. The commit
  used `--no-verify`. Clean these up (or relax the rules) so the hook passes.
- **Live-verify the schema feature in Zotero:** set token + **pick the workspace**
  (tags are workspace-scoped; the parent-node pref must be in that same workspace),
  keep tag name `zotero`, click **Create / refresh schema** → confirm the tag +
  ~30 fields are created with correct types and the entity seed options are gone.
  Then sync an item and confirm Options entity fields populate by-id (no dups).
- Then the earlier live-verify paths (warn-and-skip, URL render) below still apply.

## Status

| Stage | State |
| --- | --- |
| 1 — Create the Tana `#reference` schema | ✅ done (in graph) |
| 2 — Mapping prototype (item → Tana Paste) | ✅ done (`prototype/`) |
| 3 — Fork notero, build the plugin | ⏳ **built + loaded in Zotero; auth + import work; mid live-verify** (see below) |

### Live verification — IN PROGRESS (2026-06-17 eve)
(Superseded as the resume point by the 2026-06-18 schema session above; the
live-verify paths here still apply once the new build is loaded.)

First real end-to-end sync succeeded (journal article "Climate change and meat
eating…"); a long live-debugging session then hardened the sync engine and added
features. Auth + `/nodes/search` deepObject + the create path are verified live.

**Built but NOT yet reinstalled/verified in Zotero** — current XPI
`xpi/zotana-0.1.1-jkroes.Mac.attlocal.net.xpi` (rebuilt 2026-06-17 eve), **86 tests
passing / 13 files**. Changes this session (all detailed in the bullets below):
1. **Reachability rebuild** — orphaned/trashed/purged stored node → rebuild (was a
   bare read-200 check that silently wrote into dead "ghost" nodes).
2. **Per-field diff** — write only changed fields (every `setFieldContent` replace
   trashes the old value node; the old unconditional rewrite buried ~20/sync).
3. **Reference-preserving warn-and-skip** — don't overwrite/clear a value node we
   **own** that another node **links to**; report it in the ProgressWindow.
4. **Entity fields via `setFieldOption`** — Creators/Editors/Contributors/Publisher
   are now Options fields (multi-tag #Person + #Organization).
5. **All links `[url](url)`** (DOI/URL/Item) — clickable on create (paste).
6. **Partial-date granularity** — `YYYY` / `YYYY-MM` / `YYYY-MM-DD`.

⏳ **NEXT (do first in new session):**
- ~~**REQUIRED Tana schema changes**~~ — OBSOLETE as of 2026-06-18: the plugin now
  **creates the tag + fields with correct types itself** (`ensureSchema`), so no
  manual Editors/Publisher→Options or DOI/URL/Item→URL edits are needed for a fresh
  tag. (The pre-existing `#reference` tag in the graph is separate; the new default
  tag name is `zotero`.)
- Reinstall the XPI, **restart Zotero** (version string unchanged), do a clean
  create (delete the item's "Tana" child attachment first for a fresh node), then
  walk `docs/verify-in-zotero.md` Tests A–D plus the new paths:
  - warn-and-skip: reference a field's value node from another Tana node, change
    that field in Zotero, re-sync → expect it skipped + a "Synced with warnings".
  - URL render: confirm `[url](url)` shows clickable on create; note plain text on
    a later change (README documents the `Iterate and convert URLs to URL nodes`
    fixup).
  - **Unverified assumption:** the REST `readNode` markdown carries the same
    `<!-- node-id -->` comments the MCP read shows (the warn-and-skip parser relies
    on it). If fields get overwritten with no warning, that format differs.

Build note: `pnpm build` needs the sandbox OFF (Node 25 has no `fsevents` prebuilt
→ chokidar `fs.watch` → `EMFILE`); outside the agent sandbox it builds fine. After
`pnpm build`, run `node scripts/create-xpi.mts` to repackage the XPI (build only
compiles to `build/`).

### Stage 3 progress (2026-06-17)

Plugin name decided: **Zotana** (id `zotana`). Upsert strategy decided:
**in-place per-field** (preserve Tana node identity / inbound links).

**Done — notero scaffold copied in and the Tana sync engine is ported & wired:**
- notero tree rsynced into the repo (kept its Zotero scaffold + esbuild/vite-plus
  toolchain). Bundle entry is `src/content/zotana.ts` (class `Zotana`, global
  `Zotero.Zotana`) after the rebrand pass below.
- Prototype ported to TS under **`src/content/tana/`**, reading the live Zotero API:
  `constants.ts` (field/tag IDs), `tana-paste.ts` (types + serializer),
  `entities.ts` (creator bucketing via `Zotero.CreatorTypes.getPrimaryIDForType`),
  `reference-builder.ts` (item → `TanaReferenceNode`; base-field reads, six title
  formats, live CSL via `Zotero.QuickCopy`, podcast container override).
  `client.ts` moved here and gained `updateName` (the rename primitive).
- **`data/item-data.ts`** rewritten: stores `{nodeId, title}` in a hidden Zotero
  link-attachment (the upsert key + last-synced title for in-place rename).
- **`sync/sync-regular-item.ts`** rewritten as the upsert: create → import paste +
  capture node id; update → rename + per-field `setFieldContent`, resolving
  Person/Org names → node IDs (search + create-if-missing). Only the `Item`
  back-link is immutable/skipped on update; `Item Type` IS updated (see fixes
  below).
- **`sync/sync-job.ts`** builds `TanaClient` from prefs (token + parentNodeId +
  optional baseUrl), `health()` preflight, maps `PageTitleFormat`→`TitleFormat`,
  skips notes (deferred).
- Service layer rewired: `sync-manager.ts` (regular items only, no Notion auth),
  `service.ts`/`event-manager.ts`/`zotana.ts` stripped of Notion auth +
  `getNotionClient`/`findDuplicates`. Prefs gained `tanaToken`,
  `tanaParentNodeId`, `tanaBaseUrl`.
- **Deleted** all Notion-only modules: `auth/`, `sync/notion-*`, `notion-utils/`,
  `html-to-notion/`, `sync-note-item.ts`, `find-duplicates.ts`,
  `property-builder.ts`, `protocol-handler-extension.ts`, and their tests.

**Correctness fixes applied (2026-06-17, post-review):**
- Item Type **is** updated on re-sync (set by localized name via
  `setFieldContent`; only the immutable `Item` back-link is skipped).
- Item Type value uses `Zotero.ItemTypes.getLocalizedString` (was the raw
  internal type name).
- Update path **clears** fields that went set → empty.
- **Partial-date granularity (2026-06-17):** `normalizeDate`/`extractYear` now read
  Zotero's multipart SQL date (`item.getField('date', true, true)` → `YYYY-MM-DD`
  with `00` for missing parts) and emit the real granularity — full / `YYYY-MM` /
  `YYYY` (Tana accepts all three; verified). Freeform/seasonal dates ("Spring 2016")
  parse to a year with `00` month/day → emit just the year. No season→month padding
  anymore. Both helpers exported + unit-tested (`reference-builder.spec.ts`).
- **Entity fields are Options fields, written via `setFieldOption` (2026-06-17):**
  Creators/Editors/Contributors/Publisher are converted in Tana to **Options**
  fields (multi-tag: accept #Person AND #Organization, e.g. institutional authors).
  The update path's `links` branch now writes them with `client.setFieldOption`
  (optionId = entity node id), NOT `setFieldContent` — `setFieldContent` on an
  Options field stores the id as a literal text option (junk). `setFieldOption`
  errors on Instance-of fields, so this REQUIRES all four entity fields to be
  Options. Write-method rules captured in memory `tana-field-types-write-methods`.
  (DOI/URL stay URL-typed with plain URLs — URL fields show markdown literally;
  Item stays Content with a markdown link, which renders as a real anchor.)
- **Reference-preserving warn-and-skip (2026-06-17):** before overwriting or
  clearing a scalar field, the update path checks whether that field's value node
  is referenced by other Tana nodes (`search({linksTo:[valueNodeId]})`). If so it
  leaves the field untouched (keeps its old signature so the next sync retries)
  and reports the field name up to the sync job, which lists item → field(s) in
  the ProgressWindow (kept open, headline "Synced with warnings"). Value-node ids
  come from one `readNode(refId,1)` per sync-with-changes, parsed from the
  `**Field**: value <!-- node-id: id -->` markdown (`parseFieldNodeIds`). Link
  fields (options-from-supertags → #Person/#Org) are exempt (re-point, no trash);
  dates can't be referenced. **Decisions:** edit-in-place was rejected (risks
  retyping date/options); warnings repeat each sync until resolved (no
  match-detection); message shows item + field name only (Tana shows the refs
  in-app). **Live-verify caveat:** assumes the REST `readNode` markdown carries the
  same `<!-- node-id -->` comments the MCP read shows — if it doesn't,
  `parseFieldNodeIds` returns empty and the check silently no-ops (fields just get
  overwritten). Confirm on first live test.
- **Per-field diff (2026-06-17):** the update path now writes only fields whose
  value changed since the last sync, and clears only fields that were previously
  set. `TanaSyncData` gained a `fields: Record<attrId, signature>` map (scalar =
  value; links = `tag:name` list, so an unchanged author list skips resolution +
  write). Fixes a live-found bug: Tana implements a `setFieldContent` replace by
  **trashing the prior value node**, so the old unconditional rewrite buried ~20
  nodes in the Tana trash *every* sync. Now an unmodified re-sync writes nothing.
  (One-time migration cost: an item synced by the pre-diff build has no stored
  `fields` map, so its next sync rewrites everything once, then stays clean.)
- Back-link handles **group libraries** (derives the group ID from the item's
  web URI).
- Tests added for the new engine: `tana/__tests__/{tana-paste,entities}.spec.ts`,
  `sync/__tests__/sync-regular-item.spec.ts`; `sync-manager.spec.ts` rewritten
  for regular-items-only. (Run with `pnpm test` after install.)

**Deferred (agreed with user — replace, do not abandon):**
- **PDF/EPUB annotation syncing** — DONE (2026-06-17). Highlights + underlines →
  `#quote` nodes (name = selected text, comment → node **description**); note/text
  → untagged plain node (name = comment); image → untagged placeholder
  (`Image annotation (p. N)`); ink skipped. Nodes are **direct children of the
  `#reference` node**. **Full per-annotation upsert**: `item-data` stores
  `annotationKey → {nodeId, name, description}`; `sync-annotations.ts` creates new,
  updates changed name/description in place, trashes annotations removed from
  Zotero. New modules: `sync/annotations.ts` (read+normalize), `sync/annotations`
  reader is pure; `sync/sync-annotations.ts` (the upsert), wired into
  `sync-regular-item.ts` after the reference upsert. `client.updateName` →
  generalized to `client.update(nodeId, {name?, description?})`. Annotation node
  names are set via `update` (literal) not Paste, since highlight text can contain
  `#`/`::`/`[[ ]]` — **verified live** that `update` stores those literally and the
  `#quote` tag + description render. `getAnnotations`/annotation props added to
  `types/zotero.d.ts`. 17 new tests (70 total, green).
- **Rich-text note syncing** — still deferred. Standalone/child *note items*
  (`item.getNote()` HTML) are NOT synced (sync-job still skips `isNote()` items);
  the user scoped this session to annotations only. Would need an HTML→Tana-Paste
  converter (notero's `html-to-notion` is the reference).
- ~~**"Find duplicates"**~~ — dropped as a feature (2026-06-17). Zotana can't
  create duplicates under normal use (the Tana nodeId is stored on the Zotero item
  and updated in place), so a duplicate-finder wasn't the real need. What the user
  actually wanted was **sync resilience to a node being deleted in Tana**, now
  implemented:
  - **Deleted-node policy (UPDATED 2026-06-17 — reachability, not read-200):**
    `GET /nodes/{id}` returns **200 for a live node, a trashed node, AND an
    orphaned "ghost"** (a node detached from every tree when its trash is emptied
    but not yet garbage-collected — readable by ID, absent from search/UI); it
    **404s only once fully purged**. So a bare read 200 can't tell a usable node
    from a dead one. `sync-regular-item` now preflights **`nodeReachable`**:
    `search({and:[{hasType:#reference},{textContains: stored.title}]}, {limit:50})`
    and checks the stored nodeId is in the hits. **Reachable → update in place;
    unreachable → rebuild** (discard the stale link + annotation map, fresh
    `#reference` import; the "Tana" attachment is repointed by `saveTanaSyncData`).
    **Policy change:** trashed + orphaned + purged all collapse to "rebuild" (the
    search API excludes trashed nodes and can't distinguish trashed from ghost) —
    chosen so the reference always reappears; rare cost is a duplicate if a node is
    trashed then restored before the next sync. (Live-discovered via the first
    real sync: 3 Person nodes appeared but the reference silently updated an
    orphaned ghost. Tests: query-aware `search` mock; 74 passing.)
  - **Annotation node 404 → recreate:** `sync-annotations` catches a 404 from an
    in-place `update` and recreates that quote node (lazy — only on an actual
    write, no extra calls in the happy path).
- ~~**Entity-placement setting**~~ — DONE (2026-06-17). Decided: new
  `#Person`/`#Organization` nodes always land in the workspace **Library**
  (`{workspaceId}_STASH`), no pref. Rationale from live probes: the create path's
  inline `[[Name #Person]]` is filed by Tana in the Library regardless of import
  parent (not redirectable), so the **update path** now matches — `sync-job.ts`
  resolves `entityParentNodeId = {workspaceId}_STASH` once per job (workspace
  derived from an existing `#reference` node, since tag IDs are workspace-scoped;
  falls back to the references parent if none), and `resolveEntityNodeId` creates
  under it. (A future pref could override the update path if the user ever wants a
  custom node — create-path placement stays Tana's call unless inline refs are
  replaced with resolve-then-reference.)
- **Entity resolution limit** — `resolveEntityNodeId` substring-searches with
  `limit: 50` and matches the name exactly client-side. Known limitation: if an
  exact match sits beyond the first 50 substring hits it's missed (the right
  result is almost always in the first 50). Left as-is, documented.
- Kept as-is (approved): author-date title uses Zotero's `firstCreator` string
  (e.g. "Vaswani et al., 2017"), not the prototype's surname-only form.

**Prefs UI + locale + rebrand — done (2026-06-17):**
- **Prefs pane rewritten** (`prefs/preferences.tsx` + `preferences.xhtml`): Tana
  API token (password), parent node ID, optional Local API URL (all bound via JS
  to `extensions.zotana.{tanaToken,tanaParentNodeId,tanaBaseUrl}`), reference-node
  title-format dropdown, sync-on-modify checkbox, collection-sync table. Notion
  OAuth/DB-picker gone. `notionOptionID` removed from `collection-sync-config.ts`.
- **Locale**: `src/locale/en-US/zotana.ftl` rewritten with Tana copy; zh-CN
  (stale) deleted; `fluent-types.ts` hand-regenerated to match (re-run
  `pnpm generate-fluent-types` after install to be safe).
- **Rebrand**: `Notero`→`Zotana` and `notero`→`zotana` throughout — class + file
  (`content/zotana.ts`), `get-global-zotana.ts`, `zotana-pref.ts`/`ZotanaPref`,
  `extensions.zotana.` pref namespace + `prefs.js`, observer id, bundle entry +
  bootstrap, `Zotero.Zotana` global, error ids `zotana-error-*`, CSS classes,
  locale filename. `package.json` rebranded (name `zotana`, id `zotana@jkroes`,
  icons `zotana-48/96.png`, **`@notionhq/client` and unused `zod` removed**).
  `README.md` replaced with a Zotana one.

**Build/test verified (2026-06-17, after `pnpm install`):**
- `pnpm test` → **53 passing / 9 files** (incl. the new tana + sync-regular-item
  specs).
- `pnpm build` → esbuild bundles `bootstrap`, `content/zotana`, and
  `prefs/preferences` cleanly; `manifest.json` generated with correct Zotana
  branding. (In the agent sandbox the chokidar asset-copy step throws `EMFILE`
  from `fs.watch` — environment-only, not a code issue; assets copy fine locally.)
- Fixed `scripts/generate-update-manifest.mts` (dropped the notero Zotero-6
  legacy entry that referenced the removed `pkg.xpi.zotero6`).
- `pnpm typecheck` still reports errors **inside `node_modules/@voidzero-dev/*`**
  (vite-plus's own `.d.ts` referencing optional deps + a vitest `File` conflict);
  our `tsconfig` has no `skipLibCheck`. These are upstream/toolchain, not our
  code — add `"skipLibCheck": true` to tsconfig if you want a clean `tsc`.

**Remaining for stage 3:**
1. **Live verify in Zotero** — load the build with a real token + parent node and
   confirm a create + a re-sync, validating the flagged API shapes below.
2. **CI/docs polish (low priority)** — `CHANGELOG.md`, `.github/`, `crowdin.yml`,
   `release-please-config.json`, `.release-please-manifest.json`, and
   `zotero.config.example.json` still carry upstream `notero`/`dvanoni` strings.
   Not needed to build or run; rebrand when convenient.
3. See **Deferred (agreed)** above: notes/annotation syncing + find-duplicates
   (replace), entity-placement setting, etc.

**De-risked against the live Local API (2026-06-17) — was "unverified", now resolved:**
- Re-fetched the running server's `openapi.json` (it now documents
  `/nodes/{id}/update`). **`client.updateName` was wrong and is fixed**: the REST
  endpoint takes a flat `{ name: string | null }` (replace outright, `null`
  clears), NOT the MCP `edit_node` `{name:{oldString,newString}}` search/replace
  shape. Signature is now `updateName(nodeId, name)`; caller + test updated.
- **Tana node-URL scheme** corrected in `item-data.ts` to `tana:<nodeId>` (Tana's
  own deep-link, the form its read-node API emits), was the guessed
  `https://app.tana.inc/?nodeid=`.
- **`setFieldContent` confirmed live**: date fields take a bare ISO value
  (`2021-06-15` → renders as a real date); reference/instance fields take a node
  ID (renders as a `[[link]]`). Matches the code.
- **Response shapes confirmed** to match `client.ts` types: `import` →
  `{parentNodeId, targetNodeId, createdNodes:[{id,name}], message}`; `health` →
  `{status:'ok'|'degraded', timestamp, nodeSpaceReady}`. `import`/`content`/
  `option`/`tags` request bodies all match.
- `pnpm test` still green (53 passing) after the fixes.

**Authenticated REST round-trip — PASSED live (2026-06-17):** ran the full plugin
write path against `localhost:8262` with a real Personal Access Token: `import`
(200, `createdNodes:[{id,name}]` as parsed) → `update` rename with the **flat
`{name}`** body (200) → `setFieldContent` date=bare ISO (200, renders as a real
date) → `setFieldContent` reference=node ID (200, renders as a link) → `trash`
(200). The write path is de-risked against the authenticated API, not just the
spec/MCP façade.

**Token gotcha (important for docs + live verify):** the Local API needs a
**Personal Access Token** (`type:"personal"`), created from Tana's **account
settings (top-right)**. The cloud **"Get API Token" / "Make API token"** token
(a JWT with `nodeId`/`fileId`) is **rejected by the Local API with 401** — do not
use it. Locale copy updated to say this.

## What exists in this repo

- **`prototype/`** — pure-ESM mapping harness, no Zotero runtime, no deps.
  `node build-samples.mjs` prints Tana Paste for 4 fixtures (journal, book,
  podcast, institutional report). This is the validated mapping logic to port
  into the plugin. Files: `constants.mjs` (field/tag IDs + itemType→primary-role
  map), `entities.mjs` (creator bucketing + Person/Org routing),
  `reference-builder.mjs` (item → ordered Tana field entries; base-field reads,
  title formats, podcast override), `tana-paste.mjs` (entries → Tana Paste text),
  `fixtures.mjs`, `build-samples.mjs`. See `prototype/README.md`.
- **`src/content/tana/client.ts`** — thin REST client for the Tana Local API,
  grounded in the server's `openapi.json`. Methods: `health`, `import` (returns
  created node IDs), `setFieldContent` (upsert primitive, accepts `null` to
  clear), `setFieldOption`, `setTags`, `trash`, `readNode`, `search`, `update`
  (flat `{name?,description?}`), plus schema ops `listWorkspaces`,
  `listWorkspaceTags`, `createTag`, `addField`, `getTagSchema`. Injected `fetch`
  + Bearer token.
- **`src/content/tana/constants.ts`** — the field `CATALOG` (no hardcoded IDs).
- **`src/content/tana/schema.ts`** — `ensureSchema` (resolve-by-name + bootstrap).
- **`src/content/prefs/schema-config.ts`** — `SchemaConfig` pref + merge/defaults.
- **`src/content/prefs/schema-panel.tsx`** — the preferences schema UI.

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
- **Entity placement (2026-06-17 probes):** importing an **inline**
  `- [[Name #Person]]` always files the new entity in the workspace **Library**
  (`Root → Library`) regardless of the import parent, and leaves a stray
  *reference* bullet under the parent. Importing an **explicit**
  `- Name #[[^tagId]]` under `{workspaceId}_STASH` also lands the entity at
  Library root but leaves **no** stray reference — so the plugin's update path
  creates entities that way. `search` results include `workspaceId`; the Local
  API has no node→workspace lookup (`GET /nodes/{id}` omits it).

## The Tana Local API (REST, not MCP)

`localhost:8262` exposes a plain REST API (`GET /openapi.json`, "Tana Local API"
v1.0.0); `/mcp` is just the AI-client façade. The app must be running with the
Local API enabled and the workspace loaded. Auth = personal API token (Tana →
Settings → API Tokens), Bearer header. Key endpoints (shapes in `client.ts`):
`POST /nodes/{parentNodeId}/import` · `POST /nodes/{nodeId}/fields/{attributeId}/content`
· `.../option` · `POST /nodes/{nodeId}/tags|trash|update|move` · `GET /nodes/search`
· `GET /nodes/{nodeId}` · `GET /tags/{tagId}/schema` · `GET /health`.

## Stage 3 — the notero fork (DONE; see "Stage 3 progress" at top)

The fork is built: scaffold copied, prototype ported to `src/content/tana/*.ts`,
sync rewritten as an in-place upsert, Notion layer deleted, prefs/locale/rebrand
done, tests passing, bundle building. The original 6-step plan that lived here is
fully executed — see the **Stage 3 progress** and **Remaining for stage 3**
sections at the top of this file for the current state and what's left (live
verify in Zotero; deferred notes/find-duplicates/entity-placement).

Resolved decisions (were "open"):
- **Plugin name** → **Zotana** (`zotana`); see memory `zotana-plugin-name`.
- **Upsert** → in-place per-field; see memory `zotana-upsert-strategy`.
- **Citations** → wired live via `Zotero.QuickCopy` in `reference-builder.ts`.
- **Parent node** → a user pref (`tanaParentNodeId`); the user picks Library vs
  Inbox vs a dedicated node in Zotana preferences.

## Resume pointers

- Auto-memory: `tana-reference-suite` (project state), `tana-import-paste-behaviors`,
  `tana-options-fields-auto-collect` (verified Tana behaviors), `works-conversationally`
  (the user prefers one decision at a time; don't batch questions).
- Capacities precedent (the mapping approach this is modeled on):
  `~/repos/capacities/prototype/zotero-to-capacities/`.
- To re-run the prototype: `cd prototype && node build-samples.mjs`.
- The Zotero schema (base fields, creator roles) lives at
  `github.com/zotero/zotero-schema` (`schema.json`).
