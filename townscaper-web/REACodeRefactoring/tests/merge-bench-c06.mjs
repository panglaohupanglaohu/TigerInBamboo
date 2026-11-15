// 第 56 批 C06：1401145625572425728 mesh merger 对照——切成小网格与合并网格的三角/属性完全一致（浏览器里再测提交与耗时）。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const THREE = await import('three');
const { splitGeometry } = await import('../src/tools/merge-bench-c06.js');
const g = new THREE.TorusKnotGeometry(1, .3, 100, 12);
const flat = g.toNonIndexed(), n = flat.getAttribute('position').count;
for (const k of [1, 16, 64, 1000]) {
  const parts = splitGeometry(g, k);
  assert.equal(parts.length, Math.ceil(n / 3 / k));
  let off = 0;
  for (const p of parts) {
    for (const name of Object.keys(flat.attributes)) { const a = p.getAttribute(name), b = flat.getAttribute(name); for (let i = 0; i < a.array.length; i++) assert.equal(a.array[i], b.array[off * b.itemSize + i]); }
    assert.ok(p.getAttribute('position').count % 3 === 0 && p.getAttribute('position').count <= k * 3);
    off += p.getAttribute('position').count;
  }
  assert.equal(off, n, '切开后三角总数不变');
}
assert.throws(() => splitGeometry(g, 0));
console.log('PASS merge-bench-c06');
