# Zotana

A [Zotero](https://www.zotero.org/) 7 plugin that live-syncs library items into
[Tana](https://tana.inc/) as structured `#reference` nodes. Items sync when added
to a watched collection and whenever they're modified, and **update in place** on
re-sync: the same `#reference` node is updated rather than duplicated, so its
identity and any links into it survive. (Individual field _values_ are rewritten
as they change — see How it works.)

Zotana is a fork of [Notero](https://github.com/dvanoni/notero) (which syncs to
Notion), with the Notion layer replaced by Tana's **Local API**.

## How it works

Each Zotero item becomes a `#reference` node in Tana, built on Zotero **base
fields** so a single supertag covers every item type. Creators are split
primary-role-aware (Creators / Editors / Contributors) and linked as `#Person` or
`#Organization` entities (institutions route to `#Organization`). The `#reference` node
ID is stored on the item as a "Tana" child attachment so that re-syncs find and update the existing node.

When a re-sync changes a field, Tana replaces that field's value node (it trashes
the old one and creates a new one); unchanged fields are left alone. So a link
pointing at the `#reference` node itself always survives, but a link pointing at a
specific field _value_ node would break when that value changes — Zotana detects
that case, leaves the field untouched, and reports it as a sync warning.

### Annotations

An item's PDF/EPUB annotations sync as child nodes under its `#reference` node,
each keyed by its Zotero annotation key so re-syncs update them in place:

- **Highlights / underlines** → `#highlight` — the selected text is the node
  name; any comment becomes the node's description.
- **Notes / text** → `#comment` — the typed note is the node name.
- **Image annotations** → `#image` — a **text placeholder** (`Image annotation
(p. N)`); the actual cropped image is **not** synced, because the Tana Local
  API has no way to upload image data. Any comment becomes the description.
- **Ink** annotations are skipped (no text content).

Every annotation node also carries an `Annotation` field with a
`zotero://open-pdf` back-link that jumps straight to the annotation in the PDF
(plain text, like all URL fields — see Known limitations).

**Three `Annotation` fields, and merging them:** schema creation gives each of
`#highlight`, `#comment`, and `#image` its **own** `Annotation` field — Tana's
Local API can only create a field on a tag, never reuse one across tags, so you
get three. You can safely **merge them into a single `Annotation` field** in
Tana: Zotana finds the field by its name on each tag every sync, so as long as
all three tags still have a field named `Annotation` (kept as a URL field) after
the merge, annotation syncing keeps working. Don't rename it or remove it from
any of the three tags — the next sync would recreate a fresh `Annotation` field
on whichever tag is missing one, bringing the duplicates back.

**Replacing an image placeholder with the real image:** you can paste the image
directly onto the placeholder node in Tana and it will survive every future
sync. Zotana never reads the live node content — it only rewrites a node when the
text it _would_ produce differs from what it last wrote, and an image
annotation's placeholder text (derived from its page) never changes. Two rules:
edit the **existing** node in place (deleting it and creating a new image node
loses the id Zotana tracks, so it recreates the placeholder), and don't manually
re-label the PDF's pages in Zotero (that changes the placeholder text and would
overwrite your image on the next sync).

### What gets overwritten vs. left alone

- **The `#reference` node and annotation nodes keep their identity** across
  re-syncs — links pointing _at these nodes_ always survive.
- **Field values are rewritten only when the source field changes** in Zotero;
  unchanged fields are never touched.
- **A value node that something else links to is left alone** and reported as a
  sync warning, rather than being replaced.
- **Manual edits to a synced field's value** will be overwritten the next time
  that field changes in Zotero — Zotana is the source of truth for fields it
  syncs. Edits to _non-synced_ fields, and content you add as **separate child
  nodes**, are never touched.
- **Deleting the hidden "Tana" attachment disconnects the item** — automatic
  sync-on-modify only _updates_ items that already have a Tana node, so removing
  that attachment stops the link without recreating the node. Run **Sync to
  Tana** on the item to rebuild it.

## Requirements

- Zotero 7+ (running)
- Tana Outliner desktop app (running)
- A Tana **Personal Access Token**, created from Tana's account settings
  (top-right).

## Install

Download the latest `.xpi` from the
[Releases page](https://github.com/jkroes/zotana/releases), then in Zotero go to
**Tools → Plugins**, click the gear icon → **Install Plugin From File…**, and
select the `.xpi`. Or build it yourself (see Development).

## Setup

In Zotero → Settings → Zotana:

1. **API Token** — paste your Tana personal access token.
2. **Parent Node ID** — paste the ID of the Tana node where new reference nodes
   are created (e.g. Library).
3. **Local API URL** — optional; defaults to `http://localhost:8262`.
4. In the **schema** panel, pick the workspace, keep or rename the reference tag
   and fields (blank field names use their defaults), choose which fields sync,
   and click **Create / refresh schema in Tana** to create the tag + fields.
5. Enable the collections you want to sync, and choose the reference node title
   format.

Then right-click a collection or items → **Sync to Tana**, or rely on automatic
sync-on-modify.

## Known limitations

- **URL fields are plain text (DOI, URL, Item, annotation back-links).** Tana's
  clickable-link rendering on import proved unreliable — some URL fields/nodes
  rendered as links and others didn't — so the plugin writes every URL as **plain
  text**, on both create and update. To make them clickable, run Tana's
  **`Iterate and convert URLs to URL nodes`** command on your synced items.
- **The hidden "Tana" attachment may not appear until you refresh the row.** When
  an item is first synced, Zotana writes its sync-tracking "Tana" child attachment
  without notifying Zotero's UI (deliberately — that notification would re-trigger
  a sync). The attachment is saved correctly, but Zotero's item tree won't show it
  until you **collapse and expand the item** (or reselect it). Purely cosmetic.

## Development

```sh
pnpm install
pnpm build        # one-off build → build/
pnpm start        # launch Zotero with the plugin (see zotero.config)
pnpm test         # run the test suite
pnpm typecheck
pnpm create-xpi   # repackage build/ into xpi/
```

The build toolchain (esbuild + vite-plus), Zotero scaffolding, and collection /
sync-on-modify services are inherited from Notero.

### Releasing

Bump `version` in `package.json`, commit, then push a matching `v*` tag:

```sh
git tag v0.1.0 && git push origin v0.1.0
```

The [`Release` workflow](.github/workflows/release.yml) builds the `.xpi`,
attaches it to a GitHub Release for that tag, and publishes the auto-update
manifest under the `release` tag.

## Status

Beta. The full v0.2 sync path has been live-verified end to end against real
Zotero and Tana — schema bootstrap, create, in-place per-field update, batch
sync, sync-on-modify no-op skip, deleted/purged-node rebuild, warn-and-skip,
field clears, all six title formats, group-library items, date granularity, and
annotation syncing. The main remaining gap is **note syncing**, which is not yet
implemented (`#reference` items only). See `CLAUDE.md` for the architecture and
the open-work list.

## Credits

Built on [Notero](https://github.com/dvanoni/notero) by David Hoff-Vanoni
(MIT-licensed).
