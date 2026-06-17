/**
 * Field + tag IDs for the Tana #reference schema (Main workspace NAoK7gu_J9RW).
 * Captured from get_tag_schema on 2026-06-16.
 *
 * The prototype emits field NAMES (readable, and verified to resolve within a
 * tagged node's schema). The plugin can switch to `[[^id]]::` syntax using these
 * ids for robustness against name collisions with the legacy #zotero fields.
 */

export const TAGS = {
  reference: 'p5LeXSkgwLnh',
  Person: 'G_JLFqxx4YAC',
  Organization: 'XdX5rF8lLQjF',
};

/** logical key -> { name (as shown in Tana), id (attribute id) } */
export const FIELDS = {
  item: { name: 'Item', id: 'mF4tA4ow4Xpp' },
  creators: { name: 'Creators', id: 'nArGe9TKvjhL' },
  editors: { name: 'Editors', id: 'Han5Pq_k_z7p' },
  contributors: { name: 'Contributors', id: 'GxijWOIDK97D' },
  publisher: { name: 'Publisher', id: 'iWdoB3otRHAQ' },
  container: { name: 'Container', id: '_yx116liEMr0' },
  place: { name: 'Place', id: '3ufLKDkwEefO' },
  date: { name: 'Date', id: 'O-UgOL81Nejn' },
  year: { name: 'Year', id: 'TsOYAN44AU2R' },
  volume: { name: 'Volume', id: '2H6tiPTv4KAg' },
  issue: { name: 'Issue', id: '0JWxtXn_isFD' },
  pages: { name: 'Pages', id: 'BZWBe6MwSpU2' },
  edition: { name: 'Edition', id: 'wOAOjE3L-bYx' },
  series: { name: 'Series', id: '7xzbn-EMxuOW' },
  number: { name: 'Number', id: 'kjoT9nSzHu4Y' },
  typeDetail: { name: 'Type Detail', id: 'PVtWrH-e5f__' },
  itemType: { name: 'Item Type', id: 'q_f7Thm3LvR-' },
  doi: { name: 'DOI', id: '5toC5xy5_2fs' },
  url: { name: 'URL', id: 'r307OdhezoeF' },
  abstract: { name: 'Abstract', id: 'lEXQY9U3OZaI' },
  fullCitation: { name: 'Full Citation', id: 'JMvy5d7vHDIV' },
  inTextCitation: { name: 'In-Text Citation', id: '9JHwshPqS3Qn' },
  collections: { name: 'Collections', id: '1gfk6qg3bJP9' },
  tags: { name: 'Tags', id: 'VzHdoxJBpLeb' },
  extra: { name: 'Extra', id: 'jW6qubeopn27' },
  citationKey: { name: 'Citation Key', id: 'IlUoEmY3KknD' },
  dateAdded: { name: 'Date Added', id: '3LCQRmTs0Avy' },
  dateModified: { name: 'Date Modified', id: 'cw9Qem60SCzY' },
  filePath: { name: 'File Path', id: 'f_wgrj2I3-No' },
  shortTitle: { name: 'Short Title', id: '5goS0KYVGmuN' },
};

/**
 * itemType -> primary creator role. Only the non-author exceptions are listed;
 * everything else defaults to 'author'. (Source: Zotero schema creatorTypes.)
 */
const PRIMARY_ROLE = {
  artwork: 'artist',
  audioRecording: 'performer',
  bill: 'sponsor',
  computerProgram: 'programmer',
  film: 'director',
  hearing: 'contributor',
  interview: 'interviewee',
  map: 'cartographer',
  patent: 'inventor',
  podcast: 'podcaster',
  presentation: 'presenter',
  radioBroadcast: 'creator',
  tvBroadcast: 'director',
  videoRecording: 'creator',
};

export const primaryRole = (itemType) => PRIMARY_ROLE[itemType] || 'author';
