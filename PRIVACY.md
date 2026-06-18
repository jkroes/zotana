# Privacy Policy

Zotana runs entirely on your own computer. It connects your local Zotero client
to the **Tana Local API** (by default `http://localhost:8262`) — a server
exposed by the Tana desktop app running on the same machine. Zotana has no
backend, no cloud service, no OAuth flow, and no analytics.

## What it stores

- Your Zotana settings — including your Tana **API token**, the parent node ID,
  the optional Local API URL, and your schema/collection configuration — are
  stored as Zotero preferences on your computer, within the
  [Zotero profile directory](https://www.zotero.org/support/kb/profile_directory).
- For each synced item, Zotana stores the corresponding Tana node ID (and a small
  amount of sync bookkeeping) on the Zotero item itself, so re-syncs can update
  the existing Tana node in place.

## What it transmits

- During a sync, item data you have chosen to sync (e.g. title, creators, dates,
  identifiers, abstract, tags, collections, and PDF/EPUB annotations) is sent to
  the Tana Local API to create or update nodes in your Tana workspace.
- These requests go **only** to the Local API URL you configure (localhost by
  default). Zotana does not send your data to any other service, and it does not
  contact any server operated by the Zotana author.

Data written into Tana is thereafter governed by Tana's own terms and privacy
policy.
