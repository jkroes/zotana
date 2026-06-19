/**
 * Types for a built #reference node, plus serialization to Tana Paste text.
 *
 * Layout (2-space indents):
 *   - <Title> #reference
 *     - <Field>:: <value>
 *     - [[Multi-word Field]]:: <value>
 *     - Creators::
 *       - [[Name #Person]]
 *       - [[Org Name #Organization]]
 *
 * Field labels: single-word names go bare (Container::), multi-word names are
 * bracketed ([[Item Type]]::) per Tana Paste syntax. Date-typed values use the
 * [[date:YYYY-MM-DD]] form (verified to populate a Date-typed field).
 */

import type { EntityTag } from './constants';

export type TanaScalarType =
  | 'plain'
  | 'url'
  | 'number'
  | 'date'
  | 'options'
  | 'item';

export type TanaFieldType = TanaScalarType | 'links' | 'optionList';

/**
 * An entity reference: `tag` is the logical entity key (Person / Organization);
 * the configured supertag NAME is resolved at serialization via the node's
 * `entityTagNames` map.
 */
export type TanaLink = { name: string; tag: EntityTag };

export type TanaField =
  | { name: string; id: string; type: TanaScalarType; value: string }
  | { name: string; id: string; type: 'links'; links: TanaLink[] }
  // Multi-value options field with plain-text values (one node per value),
  // e.g. Tags and Collections.
  | { name: string; id: string; type: 'optionList'; values: string[] };

export type TanaReferenceNode = {
  title: string;
  tag: string;
  tagId: string;
  /** Entity supertag NAMES, for resolving inline `[[Name #Tag]]` entity refs. */
  entityTagNames: Record<EntityTag, string>;
  fields: TanaField[];
};

function fieldLabel(name: string): string {
  return name.includes(' ') ? `[[${name}]]` : name;
}

function scalarValueText(field: {
  type: TanaScalarType;
  value: string;
}): string {
  switch (field.type) {
    case 'date':
      return `[[date:${field.value}]]`;
    default:
      // url and item are emitted as raw text (markdown-link rendering on import
      // proved unreliable); the user converts them with Tana's "Iterate and
      // convert URLs to URL nodes" command (see README). plain/number/options
      // pass through unchanged too.
      return field.value;
  }
}

/**
 * Render one entity link as Tana reference markup: `[[Name #Person]]`. The
 * link's logical entity key is resolved to the configured supertag name.
 */
export function linkMarkup(
  link: TanaLink,
  entityTagNames: Record<EntityTag, string>,
): string {
  return `[[${link.name} #${entityTagNames[link.tag]}]]`;
}

export function toTanaPaste(
  node: TanaReferenceNode,
  { withHeader = true }: { withHeader?: boolean } = {},
): string {
  const lines: string[] = [];
  if (withHeader) lines.push('%%tana%%');
  lines.push(`- ${node.title} #${node.tag}`);

  for (const field of node.fields) {
    const label = fieldLabel(field.name);
    if (field.type === 'links') {
      lines.push(`  - ${label}::`);
      for (const link of field.links) {
        lines.push(`    - ${linkMarkup(link, node.entityTagNames)}`);
      }
    } else if (field.type === 'optionList') {
      // One child node per option value (multi-value options field).
      lines.push(`  - ${label}::`);
      for (const value of field.values) {
        lines.push(`    - ${value}`);
      }
    } else {
      lines.push(`  - ${label}:: ${scalarValueText(field)}`);
    }
  }

  return lines.join('\n');
}
