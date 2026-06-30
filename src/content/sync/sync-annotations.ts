/**
 * Per-annotation upsert: reconcile an item's current Zotero annotations with the
 * quote/note nodes already under its #reference node in Tana.
 *
 * Each annotation is keyed by its stable Zotero key. On every sync we:
 *   - create a node for a key we've never synced (nested under the reference
 *     node's `Annotations` field — see the container handling below),
 *   - recreate the node for a key whose Tana node is no longer reachable (the
 *     user trashed/deleted it — see the reachability check below),
 *   - update name/description in place when the text or comment changed,
 *   - trash the node for a key that has disappeared from Zotero,
 *   - leave unchanged, still-reachable annotations untouched (no API writes).
 *
 * Node names are set via `update` (a literal string) rather than baked into the
 * imported Tana Paste, because highlight text can contain Paste-significant
 * characters (`#`, `::`, `[[`). The Paste import only carries a placeholder name
 * plus the supertag; the real text is written afterwards.
 *
 * Annotations are grouped under one `Annotations` field on the reference node.
 * That field is a single tuple node; importing `Field::` again would spawn a
 * *second* `Annotations` field (verified against the live API), so new annotations
 * must be imported *under the existing tuple node* to land in the same field. We
 * resolve that tuple's id lazily (creating the field with the first annotation,
 * re-resolving if the user deleted it) and persist it as `annotationsContainerId`.
 */

import type { StoredAnnotation } from '../data/item-data';
import { LocalizableError } from '../errors';
import { TanaApiError, type TanaClient } from '../tana/client';
import { ANNOTATION_TAG_KEYS, type AnnotationKind } from '../tana/constants';
import type { ResolvedAnnotationTag } from '../tana/schema';
import { logger } from '../utils';

import { readItemAnnotations, type AnnotationNode } from './annotations';
import { INDEX_LAG_GRACE_MS, isReferenced } from './sync-regular-item';

/** Parse-safe placeholder name used only between import and the literal rename. */
const PLACEHOLDER_NAME = 'Zotana annotation';

export type SyncAnnotationsResult = {
  /** Zotero annotation key -> its synced Tana node state. */
  annotations: Record<string, StoredAnnotation>;
  /** Node id of the `Annotations` field tuple, to persist for the next sync. */
  containerId?: string;
  /**
   * Labels for annotations removed from Zotero but left untrashed because another
   * Tana node still links to them — surfaced as sync warnings (same channel as the
   * reference node's referenced fields).
   */
  referencedAnnotations: string[];
};

export async function syncAnnotations(
  client: TanaClient,
  annotationTags: Record<AnnotationKind, ResolvedAnnotationTag>,
  item: Zotero.Item,
  referenceNodeId: string,
  annotationsFieldId: string,
  storedContainerId: string | undefined,
  stored: Record<string, StoredAnnotation>,
  workspaceId: string,
): Promise<SyncAnnotationsResult> {
  const current = readItemAnnotations(item, annotationTags);
  const result: Record<string, StoredAnnotation> = {};

  // Which previously-synced annotation nodes are still alive in Tana? Only worth
  // asking when we have stored nodes to check (a freshly rebuilt reference node
  // passes `stored = {}`, so every annotation is created fresh below). Tana
  // returns 200 when updating a *trashed* node, so a blind update would silently
  // write into a deleted node; this search tells reachable from gone instead
  // (mirrors the reference node's `nodeReachable`).
  const liveNodeIds =
    Object.keys(stored).length > 0
      ? await liveAnnotationNodeIds(
          client,
          annotationTags,
          referenceNodeId,
          workspaceId,
        )
      : new Set<string>();

  // The `Annotations` field tuple, resolved lazily: validated against Tana on
  // first use (the user may have deleted the field) and created with the first
  // annotation if absent. Each create refreshes it so subsequent creates append
  // to the same field.
  let containerId = storedContainerId;
  let containerChecked = false;
  const createOne = async (
    annotation: AnnotationNode,
    order: number,
  ): Promise<StoredAnnotation> => {
    if (!containerChecked) {
      containerChecked = true;
      containerId = await resolveAnnotationsContainer(
        client,
        referenceNodeId,
        annotationsFieldId,
        containerId,
      );
    }
    const created = await createAnnotationNode(
      client,
      referenceNodeId,
      annotationsFieldId,
      containerId,
      annotation,
      order,
    );
    containerId = created.containerId;
    return created.stored;
  };

  // `current` is in reading order, so each annotation's index is its rank. The
  // rank is written to the Order field and rewritten whenever it shifts.
  for (const [index, annotation] of current.entries()) {
    const order = index + 1;
    const previous = stored[annotation.key];
    const reachable =
      previous !== undefined && isReachable(previous, liveNodeIds);

    result[annotation.key] = reachable
      ? await updateAnnotationNode(
          client,
          previous,
          annotation,
          order,
          createOne,
        )
      : await createOne(annotation, order);
  }

  // Trash nodes for annotations removed from Zotero since the last sync. Only
  // trash one we know is still alive — a node the user already deleted is gone
  // (and re-trashing a trashed node 400s). Before trashing, protect a node another
  // Tana node still links to: trashing it would break that reference, so leave it,
  // warn, and keep tracking it (`result[key] = record`) so a later sync trashes it
  // once the link is gone — mirroring the reference node's warn-and-skip.
  const referencedAnnotations: string[] = [];
  for (const [key, record] of Object.entries(stored)) {
    if (result[key] || !liveNodeIds.has(record.nodeId)) continue;
    if (await isReferenced(client, record.nodeId, workspaceId)) {
      logger.debug('Removed annotation is referenced; leaving it', key);
      referencedAnnotations.push(annotationWarningLabel(record));
      result[key] = record;
      continue;
    }
    logger.debug('Trashing Tana node for removed annotation', key);
    await client.trash(record.nodeId);
  }

  return { annotations: result, containerId, referencedAnnotations };
}

/** A short, readable label for a removed-but-referenced annotation, for warnings. */
function annotationWarningLabel(record: StoredAnnotation): string {
  const text = record.name.trim() || 'annotation';
  const short = text.length > 40 ? `${text.slice(0, 40)}…` : text;
  return `annotation "${short}"`;
}

/**
 * Resolve the `Annotations` field tuple under the reference node. Checks the
 * stored id first; if it's gone (trashed, deleted, never stored), falls back to
 * finding the tuple whose first child is the Annotations attribute definition —
 * field tuples have empty names, so matching by attribute id is the only
 * reliable way to identify them.
 */
async function resolveAnnotationsContainer(
  client: TanaClient,
  referenceNodeId: string,
  annotationsFieldId: string,
  storedContainerId: string | undefined,
): Promise<string | undefined> {
  const { children } = await client.getChildren(referenceNodeId, {
    limit: 1000,
  });

  if (
    storedContainerId &&
    children.some((child) => child.id === storedContainerId && !child.inTrash)
  ) {
    return storedContainerId;
  }

  const tuples = children.filter(
    (child) => child.docType === 'tuple' && !child.inTrash,
  );
  for (const tuple of tuples) {
    const { children: tupleChildren } = await client.getChildren(tuple.id, {
      limit: 1,
    });
    if (tupleChildren.some((c) => c.id === annotationsFieldId)) {
      return tuple.id;
    }
  }

  return undefined;
}

/**
 * The node id of the `Annotations` field tuple just created by an import: it's the
 * reference node's direct child that this import created (the annotation node and
 * its value nodes sit deeper, so they aren't direct children). Returns undefined
 * if it can't be located — the caller degrades to leaving the container unset.
 */
async function resolveCreatedFieldTuple(
  client: TanaClient,
  referenceNodeId: string,
  createdNodeIds: Set<string>,
): Promise<string | undefined> {
  const { children } = await client.getChildren(referenceNodeId, {
    limit: 1000,
  });
  const tuple = children.find(
    (child) =>
      child.docType === 'tuple' &&
      createdNodeIds.has(child.id) &&
      !child.inTrash,
  );
  return tuple?.id;
}

/**
 * The set of live (non-trashed) annotation node IDs owned by the reference node.
 *
 * Scoped to the annotation supertags (not a bare `ownedBy`) for two reasons: it
 * returns *only* annotation nodes — excluding each reference's field-value nodes
 * and each annotation's own `Annotation` URL value node — and the search `limit`
 * caps at 1000 with no paging, so narrowing the result keeps the ceiling at
 * ~1000 annotations per item rather than ~500. (An item with more annotations
 * than that would search-miss the overflow and recreate duplicates — rare, and
 * the same class of cap as entity resolution's 50-hit limit.)
 *
 * **`/nodes/search` returns trashed nodes too** (with `inTrash: true`, filed under
 * "Deleted Nodes" — verified live), so we must drop them: a trashed annotation the
 * user deleted in Tana would otherwise count as reachable and get updated *in
 * place inside the trash* instead of being recreated. (`resolveEntityNodeId`
 * filters `inTrash` for the same reason.)
 *
 * `ownedBy.recursive` is omitted: the Local API 400s on the string `"true"` a GET
 * query carries, and its default is already `true` (see `ownedNodeIds`).
 */
async function liveAnnotationNodeIds(
  client: TanaClient,
  annotationTags: Record<AnnotationKind, ResolvedAnnotationTag>,
  referenceNodeId: string,
  workspaceId: string,
): Promise<Set<string>> {
  // Dedupe in case the user merged annotation tags into one in Tana.
  const tagIds = [
    ...new Set(ANNOTATION_TAG_KEYS.map((kind) => annotationTags[kind].tagId)),
  ];
  const nodes = await client.search(
    {
      and: [
        { ownedBy: { nodeId: referenceNodeId } },
        { or: tagIds.map((id) => ({ hasType: id })) },
      ],
    },
    { limit: 1000, workspaceIds: [workspaceId] },
  );
  return new Set(nodes.filter((node) => !node.inTrash).map((node) => node.id));
}

/**
 * Whether a stored annotation node is still usable. Reachable if the search found
 * it live; otherwise trusted only within the index-lag grace of its creation —
 * Tana's search index lags a few seconds behind a freshly created node, so a miss
 * right after a create is "not yet indexed", not "deleted" (same reasoning as the
 * reference node's `nodeReachable`). A node with no `createdAt` (synced before this
 * existed) and a search miss is treated as gone, which is correct: a long-indexed
 * node that the scoped search still misses really is trashed/deleted.
 */
function isReachable(
  previous: StoredAnnotation,
  liveNodeIds: Set<string>,
): boolean {
  if (liveNodeIds.has(previous.nodeId)) return true;
  return (
    previous.createdAt !== undefined &&
    Date.now() - previous.createdAt <= INDEX_LAG_GRACE_MS
  );
}

/**
 * Create an annotation node and return it plus the `Annotations` field tuple it
 * lives under.
 *
 * - With a known `containerId` (the field already exists): import the annotation
 *   *under that tuple node*, so it appends to the same field.
 * - Without one: import `Field::` on the reference node to create the field with
 *   this annotation as its first value, then resolve the new tuple's id so the
 *   caller can append the rest there.
 *
 * The back-link goes under the tag's Annotation Link field as plain text (like
 * every URL field — the user converts URLs to nodes in Tana); the page label goes
 * in the Page field. Both are stable per annotation, so they're only written here.
 */
async function createAnnotationNode(
  client: TanaClient,
  referenceNodeId: string,
  annotationsFieldId: string,
  containerId: string | undefined,
  annotation: AnnotationNode,
  order: number,
): Promise<{ stored: StoredAnnotation; containerId: string | undefined }> {
  // The annotation subtree, indented to sit under whatever parent line precedes.
  const annotationLines = (indent: string): string[] => {
    const lines = [
      `${indent}- ${PLACEHOLDER_NAME} #[[^${annotation.tagId}]]`,
      `${indent}  - [[^${annotation.annotationFieldId}]]:: ${annotation.link}`,
    ];
    if (annotation.page) {
      lines.push(
        `${indent}  - [[^${annotation.pageFieldId}]]:: ${annotation.page}`,
      );
    }
    return lines;
  };

  // Append under the existing field tuple, or create the field on the reference.
  const [parentId, paste] = containerId
    ? [containerId, ['%%tana%%', ...annotationLines('')].join('\n')]
    : [
        referenceNodeId,
        [
          '%%tana%%',
          `- [[^${annotationsFieldId}]]::`,
          ...annotationLines('  '),
        ].join('\n'),
      ];

  let createdNodes;
  try {
    ({ createdNodes } = await client.import(parentId, paste));
  } catch (error) {
    // A stored container the user deleted in Tana → its tuple node is gone.
    // Recreate the field on the reference node and retry once.
    if (
      containerId &&
      error instanceof TanaApiError &&
      (error.status === 404 || error.status === 400)
    ) {
      logger.debug('Annotations field tuple gone; recreating it', containerId);
      return createAnnotationNode(
        client,
        referenceNodeId,
        annotationsFieldId,
        undefined,
        annotation,
        order,
      );
    }
    throw error;
  }

  // The annotation node is the placeholder-named one (the field-value node the
  // paste also creates carries the URL as its name, so don't match the first name).
  const created =
    createdNodes.find(({ name }) => name === PLACEHOLDER_NAME) ??
    createdNodes[0];
  if (!created) {
    throw new LocalizableError(
      `Tana import did not return a node ID for annotation ${annotation.key}`,
      'zotana-error-import-no-node-id',
    );
  }

  // Set the literal text + comment; placeholder name is replaced here.
  await client.update(created.id, {
    name: annotation.name,
    ...(annotation.description ? { description: annotation.description } : {}),
  });
  // The reading-order rank goes in its own (mutable) Order field.
  await client.setFieldContent(
    created.id,
    annotation.orderFieldId,
    String(order),
  );

  // When we created the field, resolve its tuple id so later creates append there.
  const resolvedContainerId = containerId
    ? containerId
    : await resolveCreatedFieldTuple(
        client,
        referenceNodeId,
        new Set(createdNodes.map((node) => node.id)),
      );

  return {
    stored: toStored(created.id, annotation, undefined, order),
    containerId: resolvedContainerId,
  };
}

/** Update a still-reachable annotation node in place, writing only what changed. */
async function updateAnnotationNode(
  client: TanaClient,
  previous: StoredAnnotation,
  annotation: AnnotationNode,
  order: number,
  recreate: (
    annotation: AnnotationNode,
    order: number,
  ) => Promise<StoredAnnotation>,
): Promise<StoredAnnotation> {
  const fields: { name?: string; description?: string | null } = {};
  if (previous.name !== annotation.name) fields.name = annotation.name;
  if (previous.description !== annotation.description) {
    // A cleared comment must explicitly clear the description.
    fields.description = annotation.description || null;
  }
  const nameOrDescChanged =
    fields.name !== undefined || fields.description !== undefined;
  // Rewrite Order whenever the rank shifted (an insert/delete moves the ones
  // after it). A missing stored order (pre-Order annotation) counts as changed.
  const orderChanged = previous.order !== order;

  if (!nameOrDescChanged && !orderChanged) {
    // Unchanged and still reachable — keep the node, backfilling createdAt for an
    // annotation synced before it was tracked.
    return toStored(previous.nodeId, annotation, previous.createdAt, order);
  }

  try {
    if (nameOrDescChanged) await client.update(previous.nodeId, fields);
    if (orderChanged) {
      await client.setFieldContent(
        previous.nodeId,
        annotation.orderFieldId,
        String(order),
      );
    }
    return toStored(previous.nodeId, annotation, previous.createdAt, order);
  } catch (error) {
    if (error instanceof TanaApiError && error.status === 404) {
      // Backstop: the reachability search said live but the node was purged
      // between then and this write (or its `createdAt` grace let a missing node
      // through). Recreate it (under the resolved field tuple), fresh createdAt.
      logger.debug('Recreating hard-deleted annotation node', annotation.key);
      return recreate(annotation, order);
    }
    throw error;
  }
}

/**
 * Build the stored record for an annotation. `createdAt` is preserved when given
 * (in-place update of an existing node) and stamped fresh otherwise (create, or
 * backfill for a pre-tracking annotation). `order` is the rank just written.
 */
function toStored(
  nodeId: string,
  annotation: AnnotationNode,
  createdAt: number | undefined,
  order: number,
): StoredAnnotation {
  return {
    nodeId,
    name: annotation.name,
    description: annotation.description,
    createdAt: createdAt ?? Date.now(),
    order,
  };
}
