/**
 * Sample Zotero items, shaped as the plugin will see them after base-field
 * resolution. `fields` holds Zotero BASE fields (publicationTitle, place, date,
 * number, type, …); `creators` carry creatorType + fieldMode. These four cover
 * the interesting cases: primary-role bucketing, editor/contributor split,
 * institutional creators (fieldMode 1 → Organization), and the base-field
 * consequences for a podcast.
 *
 * In the plugin, swap these for live Zotero.Items.get(ids) + item.getField(...).
 */

export const fixtures = [
  // 1. Journal article — straightforward authors; primary role = author.
  {
    key: 'ABCD2345',
    libraryID: 1,
    itemType: 'journalArticle',
    displayTitle: 'Attention Is All You Need',
    creators: [
      { firstName: 'Ashish', lastName: 'Vaswani', creatorType: 'author', fieldMode: 0 },
      { firstName: 'Noam', lastName: 'Shazeer', creatorType: 'author', fieldMode: 0 },
    ],
    fields: {
      publicationTitle: 'Advances in Neural Information Processing Systems',
      date: '2017-12-04',
      volume: '30',
      pages: '5998-6008',
      DOI: '10.48550/arXiv.1706.03762',
      abstractNote: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks.',
      citationKey: 'vaswani2017attention',
    },
    collections: ['AI/Transformers', 'Reading/2026'],
    tags: ['attention', 'seminal'],
    dateAdded: '2026-01-10T08:00:00Z',
    dateModified: '2026-02-01T09:30:00Z',
    fullCitation:
      'Vaswani, A., & Shazeer, N. (2017). Attention Is All You Need. Advances in Neural Information Processing Systems, 30, 5998-6008.',
    inTextCitation: '(Vaswani & Shazeer, 2017)',
  },

  // 2. Book — author + editor (→ Editors) + translator (→ Contributors).
  {
    key: 'BOOK7788',
    libraryID: 1,
    itemType: 'book',
    displayTitle: 'The Structure of Scientific Revolutions',
    creators: [
      { firstName: 'Thomas S.', lastName: 'Kuhn', creatorType: 'author', fieldMode: 0 },
      { firstName: 'Ian', lastName: 'Hacking', creatorType: 'editor', fieldMode: 0 },
      { firstName: 'Jane', lastName: 'Doe', creatorType: 'translator', fieldMode: 0 },
    ],
    fields: {
      publisher: 'University of Chicago Press',
      place: 'Chicago',
      date: '2012',
      edition: '4',
    },
    collections: ['Philosophy of Science'],
    dateAdded: '2026-03-01T08:00:00Z',
    dateModified: '2026-03-02T08:00:00Z',
  },

  // 3. Podcast — primary role = podcaster; guest → Contributors. Note: podcast
  // has no publicationTitle base field, so the show name (seriesTitle) lands in
  // Series and Container is empty (a base-field consequence — see README).
  {
    key: 'POD9911',
    libraryID: 1,
    itemType: 'podcast',
    displayTitle: 'The Bitter Lesson, Revisited',
    creators: [
      { firstName: 'Dwarkesh', lastName: 'Patel', creatorType: 'podcaster', fieldMode: 0 },
      { firstName: 'Richard', lastName: 'Sutton', creatorType: 'guest', fieldMode: 0 },
    ],
    fields: {
      seriesTitle: 'Dwarkesh Podcast',
      date: '2026-05-20',
      number: '42', // episodeNumber → base field `number`
      url: 'https://example.com/podcast/ep42',
    },
  },

  // 4. Report — institutional author (fieldMode 1) → #Organization in Creators,
  // and the same org as Publisher → both dedup to one #Organization node.
  {
    key: 'REP5050',
    libraryID: 1,
    itemType: 'report',
    displayTitle: 'World Health Statistics 2026',
    creators: [
      { name: 'World Health Organization', creatorType: 'author', fieldMode: 1 },
    ],
    fields: {
      publisher: 'World Health Organization',
      place: 'Geneva',
      date: '2026',
      number: 'WHO/2026/1', // reportNumber → base field `number`
      type: 'Annual Report', // reportType → base field `type`
    },
    collections: ['Public Health/Reports'],
  },
];
