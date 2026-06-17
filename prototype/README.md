# Zotero → Tana mapping prototype (stage 2)

Validates the mapping from Zotero items to the Tana **`#reference`** supertag
(emitting Tana Paste) before building the sync plugin (stage 3, a fork of
[notero](https://github.com/dvanoni/notero)). Pure ES modules, no Zotero runtime,
no deps — they port into the plugin by swapping the fixture accessors for live
`Zotero` API calls. Modeled on the capacities `zotero-to-capacities` prototype.

## Run

```bash
node build-samples.mjs              # print Tana Paste for all fixtures
node build-samples.mjs --no-header  # omit %%tana%% (the MCP doesn't need it)
```

## Files

| File | Role | Future plugin home |
| --- | --- | --- |
| `constants.mjs` | `#reference` field/tag IDs + itemType→primary-role map | `export/constants.ts` |
| `entities.mjs` | creator bucketing (primary-role-aware) + Person/Org routing | `export/entities.ts` |
| `reference-builder.mjs` | item → ordered Tana field entries (base-field reads) | `export/reference-builder.ts` |
| `tana-paste.mjs` | field entries → Tana Paste text | shared util |
| `fixtures.mjs` | sample items (journal, book, podcast, institutional report) | live `Zotero.Items.get(ids)` |
| `build-samples.mjs` | driver → stdout | `export/export-job.ts` |

## The schema (created, stage 1)

One flat **`#reference`** tag (`p5LeXSkgwLnh`) replacing the legacy `#zotero` +
15 type tags. Node name = computed author-date Title. ~30 fields built on Zotero
**base fields** so one tag covers every item type; `itemType` is demoted to an
**Item Type** options field. People split primary-role-aware into **Creators /
Editors / Contributors** (instance → `#Person`, institutional → `#Organization`);
**Publisher** → `#Organization`; **Place** kept plain text. See
`memory/tana-reference-suite.md` for the full field list and IDs.

## Write path (verified live, 2026-06-17)

Probed against the Main workspace via the Local MCP `import_tana_paste`:

- **Returns created node IDs** → upsert can capture the `#reference` node ID and
  store it back on the Zotero item (notero's link-attachment mechanism).
- **Accepts `zotero://` links** → the **Item** back-link renders as a real anchor
  (the cloud Input API would reject it; the Local MCP does not).
- **`[[Name #Person]]` dedups by exact name** → the same person/org referenced
  from separate items resolves to one node. Name normalization matters; genuine
  namesakes collapse to one node (accepted tradeoff).

## Resolved (validated live 2026-06-17)

- **Date field syntax.** `Date:: [[date:YYYY-MM-DD]]` populates a real, parsed
  date.
- **Field labels vs IDs.** Field-name emission is collision-safe — `Date::` on a
  `#reference` node resolves to `#reference`'s Date, not the legacy `#zotero`
  same-named field (paste scopes resolution to the applied supertag). The ids in
  `constants.mjs` remain available if ID-based emission is ever preferred.
- **Podcast → Container.** Podcast's `seriesTitle` (show name) is promoted to
  **Container** (and not duplicated into Series).
- **Title format.** Six formats wired (`TitleFormat`), default author-date;
  becomes a plugin preference.

## Open items (plugin-time)

- **Citations are stubbed.** `Full Citation` / `In-Text Citation` come from fixture
  strings here; the plugin pulls them live from `Zotero.QuickCopy` (CSL) in your
  Quick Copy style.
