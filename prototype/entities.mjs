/**
 * Creator-role bucketing + Person/Organization routing.
 *
 * Ported from the capacities prototype's entities.mjs, with two changes for Tana:
 *  - PRIMARY-ROLE-AWARE: the lead bucket holds the item type's *primary* creator
 *    role (author, but presenter/podcaster/director/... per type), not literally
 *    "author" — so the real lead creator is captured for every item type.
 *  - fieldMode routing: institutional creators (single-field name, fieldMode 1)
 *    link to #Organization; everyone else to #Person. Tana dedups [[Name #Tag]]
 *    by exact name, so the same org as author + publisher resolves to one node.
 *
 * In the plugin this reads item.getCreators() (which exposes firstName/lastName/
 * fieldMode/creatorTypeID) instead of the fixture's plain creator objects.
 */

import { primaryRole } from './constants.mjs';

const EDITOR_ROLES = new Set(['editor', 'seriesEditor']);

/** "First Last" for people; the single name for institutions. */
export function creatorName(c) {
  if (c.name) return c.name.trim();
  return [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
}

/** Institutional creators (fieldMode 1, or a single-field name) → Organization. */
function targetTag(c) {
  const institutional = c.fieldMode === 1 || (c.name && !c.firstName && !c.lastName);
  return institutional ? 'Organization' : 'Person';
}

/**
 * Split an item's creators into { lead, editors, contributors }.
 * Each entry is { name, tag } where tag is 'Person' or 'Organization'.
 */
export function bucketCreators(item) {
  const primary = primaryRole(item.itemType);
  const lead = [];
  const editors = [];
  const contributors = [];

  for (const c of item.creators || []) {
    const name = creatorName(c);
    if (!name) continue;
    const entry = { name, tag: targetTag(c) };

    if (c.creatorType === primary) lead.push(entry);
    else if (EDITOR_ROLES.has(c.creatorType)) editors.push(entry);
    else contributors.push(entry);
  }

  return { lead, editors, contributors };
}
