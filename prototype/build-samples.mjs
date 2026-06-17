/**
 * Driver: build + serialize every fixture to Tana Paste and print to stdout.
 *
 *   node build-samples.mjs            # print all fixtures
 *   node build-samples.mjs --no-header  # omit the %%tana%% line (MCP doesn't need it)
 *
 * To validate against the live graph, paste a block into Tana (the %%tana%% header
 * makes the clipboard recognize it), or feed the body to the Local MCP
 * import_tana_paste tool (header optional).
 */

import { fixtures } from './fixtures.mjs';
import { buildReference } from './reference-builder.mjs';
import { toTanaPaste } from './tana-paste.mjs';

const withHeader = !process.argv.includes('--no-header');

for (const item of fixtures) {
  const node = buildReference(item);
  console.log('\n' + '='.repeat(72));
  console.log(`# ${item.itemType}: ${item.displayTitle}`);
  console.log('='.repeat(72));
  console.log(toTanaPaste(node, { withHeader }));
}
console.log('');
