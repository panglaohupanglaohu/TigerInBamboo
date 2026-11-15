// 第 56 批 C06：1430224300003545091 OBJ 导出 → 独立解析器读回（拓扑/坐标一致、负索引、多边形、无法线）。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const THREE = await import('three');
const { geometryToOBJ } = await import('../src/tools/objexport.js');
const { parseOBJ } = await import('../src/tools/obj-parse-c06.js');

for (const g of [new THREE.TorusKnotGeometry(1, .3, 64, 8), new THREE.BoxGeometry(2, 1, 3).toNonIndexed()]) {
  const exp = geometryToOBJ(g);
  const r = parseOBJ(exp.text);
  assert.equal(r.faces, exp.faces); assert.equal(r.badRefs, 0); assert.equal(r.objects[0], 'townscaper');
  // 逐三角坐标与源一致
  const pos = g.getAttribute('position'), idx = g.getIndex();
  let maxErr = 0;
  for (let t = 0; t < r.faces * 3; t++) { const i = idx ? idx.getX(t) : t; maxErr = Math.max(maxErr, Math.abs(pos.getX(i) - r.position[t * 3]), Math.abs(pos.getY(i) - r.position[t * 3 + 1]), Math.abs(pos.getZ(i) - r.position[t * 3 + 2])); }
  assert.ok(maxErr < 1e-6, '坐标一致 ' + maxErr);
  g.computeBoundingBox(); assert.ok(Math.abs(g.boundingBox.max.x - r.box.max[0]) < 1e-6);
}
// 第三方常见写法：负索引、四边形、v/vt/vn、无法线 → 扇形三角化 + 面法线
const r = parseOBJ('o quad\nv 0 0 0\nv 1 0 0\nv 1 0 1\nv 0 0 1\nvt 0 0\nf -4/1 -3/1 -2/1 -1/1\nf 1 2 9\n');
assert.equal(r.faces, 2); assert.equal(r.polys, 1); assert.equal(r.badRefs, 1, '越界面被拒绝而不是崩溃');
assert.ok(Math.abs(Math.abs(r.normal[1]) - 1) < 1e-9, '无 vn 时用面法线');
assert.throws(() => parseOBJ('v 0 nan 0\n'), /bad vertex/);
console.log('PASS obj-view-c06');
