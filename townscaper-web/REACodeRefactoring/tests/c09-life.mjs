// 第 56 批 C09-A：1852334860137849222 / 1849427564034498642（球面 impostor 树 + 蓬松云）、
// 1593215065423245313（运行时精灵图集：单视角/2×2、编号、残影、扩容）、1765115069837221962 / 1764958522398146667（手臂、3D 树、底-左候选）。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const ctx2d = new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === 'measureText' ? () => ({ width: 10 }) : String(k).startsWith('create') ? () => ({ addColorStop() {} }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => {}), set: (t, k, v) => (t[k] = v, true) });
const el = () => ({ style: {}, appendChild() {}, remove() {}, addEventListener() {}, getContext: () => ctx2d, width: 0, height: 0, set innerHTML(v) {}, set textContent(v) {} });
globalThis.document = new Proxy({ createElement: el, body: el(), createElementNS: el, getElementById: () => el() }, { get: (t, k) => k in t ? t[k] : () => el() });
const THREE = await import('three');
const { ImpostorField } = await import('../src/life/impostor.js');
const C = await import('../src/life/impostor-c09.js');
const { Atlas } = await import('../src/core/atlas.js');
const A = await import('../src/core/atlas-c09.js');
const { SpritePackPlan } = await import('../src/life/sprite-pack-c09.js');
const { elevationAt } = await import('../src/sphere/worldmap.js');

// ── ① 局部上方 impostor：共享着色器被正确改写，默认 ImpostorField 不变
const baked = { frames: Array.from({ length: 8 * 3 * 4 }, (_, i) => (i % 4) / 10), size: 1, center: new THREE.Vector3(0, .4, 0), pitches: [.12, .5, 1.05] };
const plain = new ImpostorField(null, baked, 4, { sphere: true });
assert.ok(plain.material.vertexShader.includes('vec3 up = vec3(0.0, 1.0, 0.0);'), '共享默认仍是世界 Y');
const lu = C.localUpImpostorField(null, baked, 4, { sphere: true });
const vs = lu.material.vertexShader;
assert.ok(vs.includes('normalize(im[1].xyz)') && !vs.includes('parentYaw') && vs.includes('dot(toCam, up)'), '上方/方位/俯仰都换成实例局部坐标');
const cloudLU = C.localUpImpostorField(null, { ...baked, pitches: [.2, 1] , frames: baked.frames.slice(0, 64) }, 4, { cloud: true, sphere: true, bakedColor: true });
assert.ok(!cloudLU.material.vertexShader.includes('center.x += cloudDrift') && cloudLU.material.fragmentShader.includes('c.rgb / max(c.a, 0.05)'), '球面云：不沿世界 X 漂、用烘焙顶点色');
assert.throws(() => C.patchLocalUp('void main(){}'), /anchor missing/, '共享着色器一改就报错');

// ── ② CPU 镜像：同一局部配置放在球面任意处 → 同一张方位图、同一俯仰（世界 Y 做法在赤道上会全错）
const m = new THREE.Matrix4(), v3 = (a) => new THREE.Vector3(...a);
const local = (dir, yaw, camLocal) => {      // camLocal = 局部 (x,up,z) 方向的视线
  const lm = C.radialMatrix(dir, 10, yaw, .5, new THREE.Matrix4()), e = lm.elements, X = v3([e[0], e[1], e[2]]).normalize(), U = v3([e[4], e[5], e[6]]).normalize(), Z = v3([e[8], e[9], e[10]]).normalize();
  return X.multiplyScalar(camLocal[0]).add(U.multiplyScalar(camLocal[1])).add(Z.multiplyScalar(camLocal[2])).toArray();
};
const look = [Math.sin(.9) * Math.cos(.5), Math.sin(.5), Math.cos(.9) * Math.cos(.5)];
let ref = null;
for (const dir of [[0, 1, 0], [1, 0, 0], [0, 0, -1], [.3, -.8, .5], [-.6, .2, -.77]]) {
  const r = C.localUpView(C.radialMatrix(dir, 10, .3, .5, m), local(dir, .3, look));
  ref ??= r; assert.ok(Math.abs(r.frame - ref.frame) < 1e-6 && Math.abs(r.elevation - .5) < 1e-6, `球面 ${dir} 处选图一致`);
}
const turned = C.localUpView(C.radialMatrix([1, 0, 0], 10, .3 + Math.PI / 4, .5, m), local([1, 0, 0], .3, look));
{ const d = ((ref.frame - turned.frame) % 8 + 8) % 8; assert.ok(Math.abs(Math.min(d, 8 - d) - 1) < 1e-6, '树绕径向转 45° → 差一张方位图 ' + d); }
// 世界 Y 做法（共享默认）在赤道 (1,0,0) 上：视线的"水平分量"把径向当成水平，俯仰算错
const eq = local([1, 0, 0], .3, look), worldEl = Math.atan2(eq[1], Math.hypot(eq[0], eq[2]));
assert.ok(Math.abs(worldEl - .5) > .3, '世界 Y 做法在赤道上俯仰错得很明显 → 需要局部上方');
// 64 步绕径向一周：帧号连续（每步 ≤ 8/64+ε），首末相接
let prev = null, maxStep = 0;
for (let k = 0; k <= 64; k++) { const a = k / 64 * Math.PI * 2, f = C.localUpView(C.radialMatrix([.3, -.8, .5], 10, 0, .5, m), local([.3, -.8, .5], 0, [Math.sin(a) * .9, .44, Math.cos(a) * .9])).frame; if (prev !== null) { const d = Math.abs(f - prev); maxStep = Math.max(maxStep, Math.min(d, 8 - d)); } prev = f; }
assert.ok(maxStep <= 8 / 64 + 1e-6, '转一周帧号连续 ' + maxStep);

// ── ③ 蓬松云几何：菜花鼓包数、平底、底部灰蓝顶部暖白
const cg = C.fluffyCloudGeometry(4, { lumps: 9, subLumps: 3 });
assert.equal(cg.userData.puffs, 36, '9 大鼓包 × (1+3 小鼓包)');
const P = cg.getAttribute('position'), Col = cg.getAttribute('color');
let minY = 1e9, lo = [0, 0, 0, 0], hi = [0, 0, 0, 0], maxY = -1e9;
for (let i = 0; i < P.count; i++) { minY = Math.min(minY, P.getY(i)); maxY = Math.max(maxY, P.getY(i)); }
for (let i = 0; i < P.count; i++) { const y = (P.getY(i) - minY) / (maxY - minY), b = y < .2 ? lo : y > .8 ? hi : null; if (b) { b[0] += Col.getX(i); b[1] += Col.getY(i); b[2] += Col.getZ(i); b[3]++; } }
assert.ok(minY > -.12, '云底压平');
const blueLo = lo[2] / lo[0], blueHi = hi[2] / hi[0], lumLo = (lo[0] + lo[1] + lo[2]) / lo[3], lumHi = (hi[0] + hi[1] + hi[2]) / hi[3];
assert.ok(blueLo > blueHi + .1 && lumHi > lumLo * 1.25, `底部偏蓝更暗（b/r ${blueLo.toFixed(2)} vs ${blueHi.toFixed(2)}，亮度 ${lumLo.toFixed(2)} vs ${lumHi.toFixed(2)}）`);

// ── ④ 星球落点：树只在海平面以上、山顶以下；确定性；云分大/小层
const elev = (d) => elevationAt(d, { seed: 7 });
const s1 = C.planetImpostorSites(elev, { seed: 5, sea: .46, trees: 300, clouds: 40 }), s2 = C.planetImpostorSites(elev, { seed: 5, sea: .46, trees: 300, clouds: 40 });
assert.deepEqual(s1, s2, '确定性');
assert.equal(s1.trees.length, 300); assert.ok(s1.trees.every((t) => { const e = elev(t.dir); return e >= .46 + .015 && e <= .46 + .2; }), '树都在陆地上');
assert.ok(s1.clouds.some((c) => c.layer === 'big') && s1.clouds.some((c) => c.layer === 'small'), '大云带 + 树梢小云');

// ── ⑤ 矩形树：3D 展开数据、手臂、底-左候选、碎了手指多
const at = new Atlas(512, 512), seq = A.runPackSequence(at, { steps: 300, seed: 7, removeAfter: 120, removeEvery: 2 });
const L = A.treeLayers(at), R = at.report();
assert.equal(L.nodes.filter((n) => n.leaf).length, R.leaves, '叶数与共享 report 一致');
assert.equal(L.nodes.length, 2 * R.leaves - 1, '二叉：节点 = 2×叶 − 1');
assert.equal(L.branches.length, L.nodes.length - 1, '树枝 = 节点 − 1');
assert.equal(L.maxDepth, R.maxDepth, '层数 = 树深');
for (const [p, c] of L.branches) assert.equal(L.nodes[c].depth, L.nodes[p].depth + 1, '树枝只连相邻两层');
const adds = seq.log.filter((l) => l.op === 'add' && l.ok), avg = (a) => a.reduce((s, l) => s + l.fingers, 0) / a.length;
const early = avg(adds.slice(0, 15)), late = avg(adds.slice(-40));
assert.ok(early <= 1.05 && late > 1.5, `板子碎了手指更多：前 15 次 ${early.toFixed(2)} → 后 40 次 ${late.toFixed(2)}`);
assert.ok(adds.slice(-40).every((l) => l.pruned > 0), '碰撞查询用包围盒剪掉了不相交的子树');
// 底-左：第一块在 (0,0)，第二块贴着它（同一行 y=0）
const b = new Atlas(256, 256), r1 = A.placeBottomLeft(b, 32, 32, { rng: A.atlasRng(1) }), r2 = A.placeBottomLeft(b, 48, 16, { rng: A.atlasRng(2) });
assert.deepEqual([r1.slot.x, r1.slot.y, r2.slot.y], [0, 0, 0], '先填底边');
assert.equal(r2.slot.x, 32, '紧贴已放块右边');
// 手臂：父→子直角折线，末端伸进候选框
const arm = r2.arm, q = { x: 32, y: 0, w: 48, h: 16 };
assert.ok(arm.fingers >= 1 && arm.segments.length > 0 && arm.segments.every((s) => s[0] === s[2] || s[1] === s[3]), '直角折线');
const tips = arm.segments.filter((s, i) => i % 2 === 1).map((s) => [s[2], s[3]]);
assert.ok(tips.some(([x, y]) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h), '指尖落在黄框里');
// 存活槽不动：再加 40 块，前两块坐标不变
const keep = [r1.slot, r2.slot].map((s) => [s.x, s.y, s.w, s.h]);
for (let i = 0; i < 40; i++) A.placeBottomLeft(b, 16 + (i % 3) * 8, 16, { rng: A.atlasRng(9 + i) });
assert.deepEqual([r1.slot, r2.slot].map((s) => [s.x, s.y, s.w, s.h]), keep, '存活槽不移动');
// 投影：正俯视时 z 不影响画面，侧视时 y 不影响
const top = A.project3D(10, 20, 0, { pitch: Math.PI / 2 }), top2 = A.project3D(10, 20, 50, { pitch: Math.PI / 2 });
assert.ok(Math.abs(top[0] - top2[0]) < 1e-9 && Math.abs(top[1] - top2[1]) < 1e-9, '正俯视');
const side = A.project3D(10, 20, 5, { pitch: 0 }), side2 = A.project3D(10, 90, 5, { pitch: 0 }), up = A.project3D(10, 20, 9, { pitch: 0 });
assert.ok(Math.abs(side[1] - side2[1]) < 1e-9 && up[1] < side[1], '侧视：高处画在上面');

// ── ⑥ 运行时精灵图集逻辑：编号、残影、2×2 视角、扩容映射、2000 次随机增删不重叠
const plan = new SpritePackPlan(256, { seed: 3 });
const a0 = plan.add(48), a1 = plan.add(32, { views: 4 });
assert.deepEqual([a0.id, a1.id], [0, 1], '编号递增');
const cells = plan.cells(plan.live.get(1));
assert.equal(cells.length, 4); assert.ok(cells.every((c) => c.x >= a1.slot.x && c.y >= a1.slot.y && c.x + c.w <= a1.slot.x + a1.slot.w && c.y + c.h <= a1.slot.y + a1.slot.h), '2×2 视角在分配区内');
plan.remove(0); assert.equal(plan.ghosts.length, 1, '删掉留残影'); assert.equal(plan.ghosts[0].id, 0);
const over = plan.add(48); assert.ok(over.slot.x === a0.slot.x && over.slot.y === a0.slot.y ? plan.ghosts.length === 0 : true, '新分配盖住残影则清掉');
assert.equal(plan.add(300), null, '放不下且不扩容 → null');
const g = new SpritePackPlan(128, { grow: true, maxSize: 512, seed: 5 }), sizes = [];
for (let i = 0; i < 12; i++) { const r = g.add(40); assert.ok(r, '扩容后总能放下'); sizes.push([r.id, r.slot.w]); if (r.moved) for (const [id, mv] of r.moved) { assert.equal(mv.from.w, mv.to.w, '搬运不改尺寸'); assert.equal(g.live.get(id).slot, mv.to, '记录跟着走'); } }
assert.ok(g.size > 128 && g.check(), '板子变大且无重叠');
const big = new SpritePackPlan(512, { seed: 11 }), rnd = A.atlasRng(77);
for (let i = 0; i < 2000; i++) {
  if (rnd() < .45 && big.live.size) { const ids = [...big.live.keys()]; big.remove(ids[Math.floor(rnd() * ids.length)], { residue: rnd() < .7 }); }
  else big.add(16 * (1 + Math.floor(rnd() * 6)), { views: rnd() < .2 ? 4 : 1 });
  if (i % 100 === 0) assert.ok(big.check(), '无重叠 @' + i);
  for (const gh of big.ghosts) for (const e of big.live.values()) { const s = e.slot; assert.ok(gh.x >= s.x + s.w || s.x >= gh.x + gh.w || gh.y >= s.y + s.h || s.y >= gh.y + gh.h, '残影不与存活区重叠'); }
}
assert.ok(big.check());
console.log('PASS c09-life', { early: +early.toFixed(2), late: +late.toFixed(2), leaves: R.leaves, depth: R.maxDepth, grownTo: g.size, liveAfter2000: big.live.size, ghosts: big.ghosts.length });
