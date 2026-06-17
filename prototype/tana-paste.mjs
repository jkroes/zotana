/**
 * Serializes a built #reference node to Tana Paste text.
 *
 * Layout (2-space indents):
 *   - <Title> #reference
 *     - <Field>:: <value>
 *     - <Multi-word Field>:: <value>
 *     - Creators::
 *       - [[Name #Person]]
 *       - [[Org Name #Organization]]
 *
 * Field labels: single-word names go bare (Container::), multi-word names are
 * bracketed ([[Item Type]]::) per Tana Paste syntax. Date-typed values use the
 * [[date:YYYY-MM-DD]] form (pending live validation — see README open items).
 */

function fieldLabel(field) {
  return field.name.includes(' ') ? `[[${field.name}]]` : field.name;
}

function valueText(field) {
  switch (field.type) {
    case 'date':
      return `[[date:${field.value}]]`;
    default:
      // plain, url, number, options, item (markdown link) all pass through.
      return String(field.value);
  }
}

export function toTanaPaste(node, { withHeader = true } = {}) {
  const lines = [];
  if (withHeader) lines.push('%%tana%%');
  lines.push(`- ${node.title} #${node.tag}`);

  for (const field of node.fields) {
    const label = fieldLabel(field);
    if (field.type === 'links') {
      lines.push(`  - ${label}::`);
      for (const link of field.links) {
        lines.push(`    - [[${link.name} #${link.tag}]]`);
      }
    } else {
      lines.push(`  - ${label}:: ${valueText(field)}`);
    }
  }

  return lines.join('\n');
}
