// 圣城山体体素化（citadelVoxelMountain.js）：合成一座「细碎三角」的山（贴在 R≈160 球面上），体素化后：
//   ① 面数大幅下降；② 新山体顶点仍贴球（离球心距离 ≥ 海面、≤ 山顶）；③ 台地高度与原山面误差 ≤ 半层 + 格内起伏；
//   ④ 原山体几何不动、材质换成不画的克隆（地面查询仍可用）；⑤ restore 恢复。
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
globalThis.location ??= { search: '' };
const THREE = await import('three');
const M = await import(pathToFileURL(join(root, 'src/world/citadel/citadelVoxelMountain.js')).href);

const up = new THREE.Vector3(0.2, 0.95, -0.24).normalize(), seaR = 160;
const frame = M.makeSphereFrame(up, seaR);
// 合成山：半径 110 m 的崎岖锥体（主峰 70 m + 噪声尖刺），格 1.5 m → 约 2 万多三角
const H = (x, z) => { const r = Math.hypot(x, z); if (r > 110) return -4; const base = 70 * Math.pow(1 - r / 110, 1.3); return base + 4 * Math.sin(x * 0.7) * Math.cos(z * 0.9) + 2.5 * Math.sin(x * 2.1 + z * 1.7); };
const pos = [], N = 150, S = 230 / N;
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
  const x0 = -115 + i * S, z0 = -115 + j * S, P = (x, z) => frame.toWorld(x, H(x, z), z).toArray();
  pos.push(...P(x0, z0), ...P(x0 + S, z0), ...P(x0 + S, z0 + S), ...P(x0, z0), ...P(x0 + S, z0 + S), ...P(x0, z0 + S));
}
const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
const castle = new THREE.Group(); castle.position.set(1, 2, 3); castle.updateMatrixWorld(true);
// 原山体挂在 castle 下（局部坐标 = 世界 − castle.position）
g.translate(-1, -2, -3);
const src = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0x888888, side: THREE.DoubleSide })); src.name = 'citadel-oskar-grid-mountain-surface'; castle.add(src);
const hl = new THREE.Mesh(g, new THREE.MeshBasicMaterial()); hl.name = 'backlit-highlight-citadel-oskar-grid-mountain-surface'; castle.add(hl);
castle.updateMatrixWorld(true);
const srcTris = g.attributes.position.count / 3, posBefore = g.attributes.position.array.slice(0, 30);

const report = M.installCitadelVoxelMountain(castle, { seaR, oceanLevelAt: () => 0 });
assert.ok(!report.skipped, '已体素化');
const vm = castle.getObjectByName('citadel-voxel-mountain');
assert.ok(vm, '新山体挂在原山体旁');
const ratio = report.voxelTris / srcTris;
assert.ok(ratio < 0.5, `面数降到 ${(ratio * 100).toFixed(1)}%（${srcTris} → ${report.voxelTris}）`);
// 贴球：顶点离球心 ∈ [seaR−一层（水下裙边）, seaR+maxY+1]
const p = vm.geometry.attributes.position, v = new THREE.Vector3(); let lo = 1e9, hi = -1e9;
for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(vm.matrixWorld); const r = v.length(); lo = Math.min(lo, r); hi = Math.max(hi, r); }
assert.ok(lo > seaR - report.level && hi < seaR + report.maxY + report.level, `贴球（半径 ${lo.toFixed(1)}…${hi.toFixed(1)}）`);
// 台地高度 ≈ 原山面：在随机点比较（体素顶面高 vs 原面），误差 ≤ 半层 + 格内起伏（≤ 一格宽 × 坡度）
const field = M.buildHeightField(frame, [vm]), orig = M.buildHeightField(frame, [src]);
let n = 0, bad = 0, sum = 0;
for (let k = 0; k < 400; k++) { const a = k * 2.399, r = 8 + (k % 20) * 4.5, x = Math.cos(a) * r, z = Math.sin(a) * r; const y0 = orig.heightAt(x, z), y1 = field.heightAt(x, z); if (y0 == null || y1 == null || y0 < 1) continue; n++; const e = Math.abs(y1 - y0); sum += e; if (e > report.level * 0.5 + report.cell * 1.2) bad++; }
assert.ok(n > 200 && bad / n < 0.08, `台地贴合原山面（平均误差 ${(sum / n).toFixed(2)} m，超限 ${bad}/${n}）`);
// 原山体：几何不动、不画；地面仍能查
assert.deepEqual([...src.geometry.attributes.position.array.slice(0, 30)], [...posBefore], '原山体几何没动');
assert.equal(src.material.visible, false, '原山体不画'); assert.equal(hl.material.visible, false, '背光亮边层不画');
assert.ok(new THREE.Raycaster(frame.toWorld(0, 200, 0), up.clone().negate()).intersectObject(src).length > 0, '原山面仍可射线查询（走路 / 放置）');
globalThis.__tmCitadelVoxel.restore();
assert.equal(src.material.visible, true, 'restore 恢复'); assert.ok(!castle.getObjectByName('citadel-voxel-mountain'), 'restore 移除体素山');
console.log('PASS 圣城山体体素化：面数大降、贴球、台地贴合原山面、原山面保留作地面、可恢复', JSON.stringify({ ...report, srcTris, ratio: +ratio.toFixed(3), meanErr: +(sum / n).toFixed(2) }));
