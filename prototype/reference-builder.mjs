/**
 * Builds the structured #reference node for one Zotero item.
 *
 * Retargeted descendant of notero's property-builder.ts / the capacities
 * frontmatter-builder.mjs: same field extraction, but it emits an ordered list of
 * Tana field entries (name/id/type/value) destined for Tana Paste rather than
 * Notion property objects or YAML.
 *
 * Field reads use Zotero BASE fields (publicationTitle, place, date, type,
 * number, volume, pages, publisher) so one #reference tag covers every item type;
 * itemType is demoted to the Item Type options field. The fixture's `fields`
 * object is already base-resolved; in the plugin these come from
 * item.getField(baseField), which Zotero resolves from the type-specific field.
 */

import { bucketCreators } from './entities.mjs';
import { FIELDS, TAGS, primaryRole } from './constants.mjs';

const SEASON_MONTH = { spring: 3, summer: 6, fall: 9, autumn: 9, winter: 12 };

function extractYear(date) {
  const m = String(date || '').match(/\d{4}/);
  return m ? Number(m[0]) : null;
}

/** Normalize a Zotero date string to ISO YYYY-MM-DD (missing parts → 1; seasons → first month). */
function normalizeDate(date) {
  if (!date) return null;
  const s = String(date).trim();
  const ym = s.match(/\d{4}/);
  if (!ym) return null;
  const year = Number(ym[0]);
  let month = 1;
  let day = 1;
  const season = s.toLowerCase().match(/spring|summer|fall|autumn|winter/);
  const ymd = s.match(/\b\d{4}-(\d{1,2})(?:-(\d{1,2}))?/);
  if (season) month = SEASON_MONTH[season[0]];
  else if (ymd) {
    month = Number(ymd[1]);
    day = ymd[2] ? Number(ymd[2]) : 1;
  }
  const pad = (n) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

function zoteroLink(item) {
  const lib = item.libraryID ?? 0;
  return `[Open in Zotero](zotero://select/items/${lib}_${item.key})`;
}

/**
 * Node title (the #reference node's name). Mirrors notero's "Notion Page Title"
 * setting: six formats, default author-date. In the plugin, fullCitation /
 * inTextCitation come live from Zotero.QuickCopy; here they're fixture stubs.
 * Every format falls back to the item's display title.
 */
export const TitleFormat = {
  authorDateCitation: 'authorDateCitation', // default
  citationKey: 'citationKey',
  fullCitation: 'fullCitation',
  inTextCitation: 'inTextCitation',
  shortTitle: 'shortTitle',
  title: 'title',
};

/** Lead creator's surname/org + year, e.g. "Vaswani, 2017". */
function authorDateCitation(item) {
  const primary = primaryRole(item.itemType);
  const creators = item.creators || [];
  const c = creators.find((x) => x.creatorType === primary) || creators[0];
  let who = null;
  if (c) {
    const institutional = c.fieldMode === 1 || (c.name && !c.lastName);
    who = institutional ? (c.name || '').trim() : c.lastName || c.firstName || null;
  }
  const year = extractYear(item.fields?.date);
  if (who && year) return `${who}, ${year}`;
  return who || null;
}

function buildTitle(item, format = TitleFormat.authorDateCitation) {
  const fallback = item.displayTitle || 'Untitled';
  switch (format) {
    case TitleFormat.citationKey:
      return item.fields?.citationKey || fallback;
    case TitleFormat.shortTitle:
      return item.fields?.shortTitle || fallback;
    case TitleFormat.title:
      return fallback;
    case TitleFormat.fullCitation:
      return item.fullCitation || fallback;
    case TitleFormat.inTextCitation:
      return item.inTextCitation || fallback;
    case TitleFormat.authorDateCitation:
    default:
      return authorDateCitation(item) || fallback;
  }
}

export function buildReference(item, { titleFormat = TitleFormat.authorDateCitation } = {}) {
  const f = item.fields || {};
  const fields = [];

  const push = (key, type, value) => {
    if (value === undefined || value === null || value === '') return;
    fields.push({ ...FIELDS[key], type, value });
  };
  const pushLinks = (key, links) => {
    if (!links || !links.length) return;
    fields.push({ ...FIELDS[key], type: 'links', links });
  };

  // Back-link first (the upsert key).
  push('item', 'item', zoteroLink(item));

  // People (primary-role-aware; institutional → Organization).
  const { lead, editors, contributors } = bucketCreators(item);
  pushLinks('creators', lead);
  pushLinks('editors', editors);
  pushLinks('contributors', contributors);

  // Container / publisher / place. Podcast has no publicationTitle base field and
  // overloads seriesTitle for the show name, so promote it to Container there.
  const isPodcast = item.itemType === 'podcast';
  push('container', 'plain', f.publicationTitle || (isPodcast ? f.seriesTitle : null));
  if (f.publisher) pushLinks('publisher', [{ name: f.publisher, tag: 'Organization' }]);
  push('place', 'plain', f.place);

  // Dates.
  push('date', 'date', normalizeDate(f.date));
  push('year', 'number', extractYear(f.date));

  // Bibliographic detail.
  push('volume', 'plain', f.volume);
  push('issue', 'plain', f.issue);
  push('pages', 'plain', f.pages);
  push('edition', 'plain', f.edition);
  push('series', 'plain', isPodcast ? null : f.series || f.seriesTitle);
  push('number', 'plain', f.number);
  push('typeDetail', 'plain', f.type);
  push('itemType', 'options', item.itemType);

  // Links / identifiers.
  push('doi', 'url', f.DOI ? `https://doi.org/${f.DOI}` : null);
  push('url', 'url', f.url);

  // Text.
  push('abstract', 'plain', f.abstractNote);
  push('fullCitation', 'plain', item.fullCitation); // live CSL in plugin
  push('inTextCitation', 'plain', item.inTextCitation); // live CSL in plugin
  push('collections', 'plain', (item.collections || []).join(', ') || null);
  push('tags', 'plain', (item.tags || []).join(', ') || null);
  push('extra', 'plain', f.extra);
  push('citationKey', 'plain', f.citationKey);
  push('dateAdded', 'date', item.dateAdded ? item.dateAdded.slice(0, 10) : null);
  push('dateModified', 'date', item.dateModified ? item.dateModified.slice(0, 10) : null);
  push('filePath', 'plain', item.filePath);
  push('shortTitle', 'plain', f.shortTitle);

  return { title: buildTitle(item, titleFormat), tag: 'reference', tagId: TAGS.reference, fields };
}
