import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const moves=JSON.parse(await readFile(new URL('assets/models/source-moves.json',root)));
for(const move of moves){
  const legacy=await import(new URL(move.original,root));
  const canonical=await import(new URL(move.canonical,root));
  assert.deepEqual(Object.keys(legacy),Object.keys(canonical));
  for(const key of Object.keys(legacy))assert.equal(legacy[key],canonical[key],`${move.original} ${key}: duplicate module identity`);
}
console.log('ASSET_PATHS_OK',moves.length,'original modules, same export identities');
