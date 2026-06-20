# Changelog

All notable changes to this project will be documented in this file.

## 0.3.0

Annotation syncing fixes and richer annotation metadata.

- **Recreate annotation nodes deleted in Tana on re-sync.** Annotation upserts now
  check whether each annotation's Tana node is still reachable (a scoped `ownedBy`
  search), recreating any that were trashed/deleted instead of trusting a stale
  node id. Previously a deleted annotation was never rebuilt, and an edit to a
  changed annotation was silently written into the trashed node. Includes an
  index-lag grace so a just-created node isn't re-created as a duplicate.
- **`Page` field on every annotation tag** — holds the annotation's Zotero page
  label.
- **`Order` field on every annotation tag** — the annotation's 1-based
  reading-order rank, rewritten whenever ranks shift. Sort by `Order` in Tana to
  see annotations in reading order regardless of the node tree order.
- The image-annotation placeholder is now simply `Image annotation` (the page
  moved to the `Page` field) instead of `Image annotation (p. N)`.

## 0.2.0

Annotations, configurable schema, title formats, and a reliable auto-sync.

- Sync each PDF/EPUB annotation into its own `#highlight` / `#comment` / `#image`
  node (replacing 0.1.0's single `#quote`), each carrying an `Annotation`
  `zotero://open-pdf` back-link to the exact spot in the PDF.
- Make every supertag name user-configurable (the reference tag, `#Person` /
  `#Organization`, and the annotation tags), resolved/bootstrapped by name.
- Add a `Title` field and six node-title formats (author-date citation, citation
  key, full citation, in-text citation, short title, title).
- Sync-on-modify auto-resync with a content-signature no-op skip; the modify path
  only updates items that already have a Tana node (never creates).
- Per-field diff on update — write only changed fields, clear only previously-set
  ones — plus reference-preserving warn-and-skip for value nodes others link to.
- Rebuild reference nodes deleted/trashed/purged in Tana, with an index-lag grace
  and an in-flight guard to avoid duplicate nodes.
- Group-library back-links and partial-date granularity (`YYYY`, `YYYY-MM`,
  `YYYY-MM-DD`).
- URL fields (DOI / URL / Item / annotation back-links) are written as plain text;
  convert them with Tana's "Iterate and convert URLs to URL nodes" command.

## 0.1.0

Initial release of Zotana, a Zotero 7 plugin that live-syncs library items into
Tana as structured `#reference` nodes via the Tana Local API.

- Maps Zotero items to a single `#reference` supertag built on Zotero base fields.
- Splits creators into Creators / Editors / Contributors and links them as
  `#Person` / `#Organization` entities.
- Upserts in place on re-sync, preserving each Tana node's identity and inbound
  links.
- Bootstraps the Tana tag and its fields automatically as a sync preflight.
- Syncs Zotero annotations into `#quote` nodes.

Zotana is a fork of [Notero](https://github.com/dvanoni/notero), with the Notion
integration replaced by the Tana Local API.
