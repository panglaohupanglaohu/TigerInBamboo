// 第 56 批 C11-D：1897266928961700215 / 1890018647655272491 走廊墙饰 —— 展开版式 + 走廊几何（node，three 钩子）。
// 贴图像素统计（门位内墨线 0、镜像误差 0、墨线覆盖）要 canvas，在浏览器里测（doodle-hallway.html 的 window.hallwayReview）。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const { planHallway, floorAt, wainscotTop, inDoor, surfacePoint, mirroredMotifs } = await import('../src/core/doodle-hallway-layout.js');
const { buildHallwayGeometry, buildStairs } = await import('../src/build/doodle-hallway.js');

// ① 确定性 + 种子
const a = planHallway(), b = planHallway();
assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), '同参同版式');
assert.notDeepEqual(JSON.parse(JSON.stringify(a.panels)), JSON.parse(JSON.stringify(planHallway({ seed: 8 }).panels)), '换种子换纹样');
// ② 转角处强制断板；门位单独一跨（门上方对称板）
assert.ok(a.panels.some((p) => Math.abs(p.s1 - a.wallA) < 1e-9) && a.panels.some((p) => Math.abs(p.s0 - a.wallA) < 1e-9), '转角处断板');
const bay = a.panels.find((p) => p.bay); assert.ok(bay, '有门上方一跨');
assert.ok(Math.abs((bay.s0 + bay.s1) / 2 - a.door.sc) < 1e-9, '门上方板以门中线为对称轴');
assert.ok(bay.vBottom >= a.door.v0 + a.door.top + a.door.band - 1e-9, '门上方板从拱带之上开始');
// ③ 镜像：每块板的纹样关于板中线严格对称
let pairs = 0, all = 0;
for (const p of a.panels) {
  const ms = mirroredMotifs(a, p); all += ms.length;
  for (const m of ms.filter((x) => x.mirrored)) { const src = ms.find((x) => !x.mirrored && Math.abs(x.v - m.v) < 1e-12 && Math.abs(x.s - (p.s0 + p.s1 - m.s)) < 1e-9); assert.ok(src, '镜像件有原件'); pairs++; }
}
assert.ok(pairs > 100, `镜像对 ${pairs}`);
// ④ 门位保留：任何（含镜像）纹样都不进门洞 + 拱带；纹样都在护墙板顶线之上、天花尽头之内
for (const p of a.panels) for (const m of mirroredMotifs(a, p)) {
  assert.ok(!inDoor(a.door, m.s, m.v, m.size), `纹样 ${m.kind} 侵入门位`);
  if (!p.bay) assert.ok(m.v - m.size >= wainscotTop(a, m.s) - 1e-9, '纹样低于护墙板顶线');
  assert.ok(m.v + m.size <= a.V + 1e-9 && m.s >= p.s0 - 1e-9 && m.s <= p.s1 + 1e-9, '纹样出板');
}
// 关镜像：纹样铺满整板宽
const nm = planHallway({ mirror: false }); assert.ok(nm.panels.some((p) => p.motifs.some((m) => m.x > p.w * 0.75)), '关镜像后右半也有原件');
// ⑤ 楼梯：逐级地面，护墙板顶线连续斜上
let prev = -1; for (let s = 0; s <= a.S; s += 0.01) { const f = floorAt(a, s); assert.ok(f >= prev - 1e-12); prev = f; }
assert.equal(new Set(Array.from({ length: 800 }, (_, i) => floorAt(a, i / 100))).size, a.stairs.steps + 1, '台阶数');
assert.ok(Math.abs(wainscotTop(a, (a.stairs.s0 + a.stairs.s1) / 2) - (a.wainscot + a.stairs.rise / 2)) < 1e-9, '护墙板中点线性');
assert.ok(Math.abs(a.door.v0 - a.stairs.rise) < 1e-9, '门开在楼梯顶的平台上');
// ⑥ 展开坐标 → 3D：v 是弧长（竖墙/cove/天花等距），cove 在半径 R 的圆上，转角斜接无缝
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
for (const s of [1, 6.9]) for (let v = 0; v + 0.01 <= a.V; v += 0.01) { const d = dist(surfacePoint(a, s, v), surfacePoint(a, s, v + 0.01)); assert.ok(Math.abs(d - 0.01) < 2e-4, `弧长参数 v=${v.toFixed(2)} d=${d}`); }
for (let k = 0; k <= 10; k++) { const v = a.H + a.coveLen * k / 10, P = surfacePoint(a, 1, v); assert.ok(Math.abs(Math.hypot(P[1] - a.H, P[2] - a.R) - a.R) < 1e-9, 'cove 在圆上'); }
for (let v = 0; v <= a.V; v += 0.05) assert.ok(dist(surfacePoint(a, a.wallA - 1e-7, v), surfacePoint(a, a.wallA + 1e-7, v)) < 1e-5, '转角两侧同点');
// ⑦ 几何：两面墙在转角处顶点重合、uv 一致；uv 在 [0,1]；面法线朝屋里
const THREE = await import('three');
const g = buildHallwayGeometry(a), P = g.attributes.position, UV = g.attributes.uv;
let seam = 0; const atCorner = []; for (let i = 0; i < P.count; i++) { const u = UV.getX(i), v = UV.getY(i); assert.ok(u >= -1e-6 && u <= 1 + 1e-6 && v >= -1e-6 && v <= 1 + 1e-6); if (Math.abs(u * a.S - a.wallA) < 1e-5) atCorner.push(i); }
const key = (i) => `${P.getX(i).toFixed(4)},${P.getY(i).toFixed(4)},${P.getZ(i).toFixed(4)}|${UV.getY(i).toFixed(5)}`;
const counts = {}; for (const i of atCorner) counts[key(i)] = (counts[key(i)] ?? 0) + 1; seam = Object.values(counts).filter((n) => n === 2).length;
assert.ok(seam > 50 && Object.values(counts).every((n) => n === 2), `转角列两墙共点同 uv（${seam}）`);
g.computeBoundingBox(); assert.ok(g.boundingBox.max.y > a.H + a.R - 1e-6 && g.boundingBox.max.y < a.H + a.R + 1e-6, '天花高度 = H + R');
const N = g.attributes.normal; let inward = 0, tot = 0; for (let i = 0; i < P.count; i += 7) { const x = P.getX(i), z = P.getZ(i), y = P.getY(i); if (y > a.H) continue; tot++; const toIn = x < a.wallA - 1e-3 && z < 1e-3 ? [0, 1] : [-1, 0]; if (N.getX(i) * toIn[0] + N.getZ(i) * toIn[1] > 0.5 || (z > 1e-3 && x > a.wallA - 1e-3 && -N.getX(i) > 0.5)) inward++; }
assert.ok(inward / tot > 0.95, `竖墙法线朝屋里 ${inward}/${tot}`);
// ⑧ 楼梯网格：台阶数 + 平台
const st = buildStairs(a); assert.equal(st.children.filter((c) => c.isMesh).length, a.stairs.steps + 2 + 1, '台阶 + 两个平台 + 地面');
// ⑨ 非法参数
assert.throws(() => planHallway({ wallA: 0.2 })); assert.throws(() => planHallway({ seed: 1.5 })); assert.throws(() => planHallway({ door: { height: 3.5 } }), /taller/);
assert.doesNotThrow(() => planHallway({ door: null, stairs: null }));
console.log('PASS 走廊展开版式：转角断板/门上对称板/镜像对', pairs, '/门位与护墙板避让/楼梯逐级+斜线/弧长参数与 cove 圆/转角共点同 uv', seam, '/法线朝内', JSON.stringify({ panels: a.panels.length, strips: a.strips.length, motifs: all, verts: P.count }));
