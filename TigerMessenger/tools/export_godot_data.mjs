import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { solveTownSelection } from '../src/world/citadel/wfcTownSelection.js';
import { RESCUE_CHAPTERS } from '../src/story/rescueState.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const out = resolve(root, 'godot/data');
await mkdir(out, { recursive: true });
await mkdir(resolve(root, 'godot/assets'), { recursive: true });
const grid = new Map();
// A traversable cross courtyard is reserved before WFC, never filled later.
for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) {
  if (x === 0 || z === 0) continue;
  const height = Math.abs(x) === 2 && Math.abs(z) === 2 ? 2 : 1;
  for (let y = 0; y < height; y++) grid.set(`${x},${y},${z}`, '0');
}
const solved = solveTownSelection({ grid, seed: 20260906 });
if (!solved.ok) throw new Error(JSON.stringify(solved.failure));
const modules = Object.entries(solved.byCell).map(([cell, role]) => {
  const [x, y, z] = cell.split(',').map(Number);
  return { cell, x, y, z, ...role };
});
await writeFile(resolve(out, 'town.json'), JSON.stringify({ seed: 20260906, hash: solved.hash, modules }, null, 2));
await writeFile(resolve(out, 'chapters.json'), JSON.stringify(RESCUE_CHAPTERS, null, 2));
for (const name of ['house','bookshop','tower','gate','pine','fox','tiger','aircraft','messenger','postbox']) {
  await copyFile(resolve(root, `assets/kit/${name}.glb`), resolve(root, `godot/assets/${name}.glb`));
}
console.log(`GODOT_DATA_OK: ${modules.length} WFC cells, hash ${solved.hash}, ${RESCUE_CHAPTERS.length} shared chapters`);
