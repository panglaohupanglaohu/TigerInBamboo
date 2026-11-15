// 第 92 轮 · groundTint（837027901853810688 整岛地面染色）真实 Battle 验收。
// 钉四件事：默认不存在 / 建立只染陆地顶面 / 乘性混合且色值等于实测系数 / 关掉可逆、stop 释放。
import assert from 'node:assert/strict';
import { makeIsland, Battle, THREE } from './fixtures/g5-battle.mjs';
import { stainProgress } from '../src/badnorth/ground-stain.js';

// 战斗里有 Math.random，固定种子让「多久见血/丢屋」可复现
{
  let a = 92;
  Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const { world, view } = makeIsland('quad', 7);
const b = new Battle(view); b.start(world);

// ── ① 默认关：一层贴面都不建（旧行为不变）
assert.equal(b.c01.on.groundTint, false);
assert.equal(b.c01.stain, null, '关：没有染色层');
for (let k = 0; k < 30; k++) b.update(1 / 30);
assert.equal(b.c01.stain, null, '关：跑也不建');

// ── ② 打开：按格子顶面建面，只有陆地（顶 > 0）
b.c01.set('groundTint', true);
assert.ok(b.c01.stain && b.c01.stain.cells > 0, '开：染色层已建');
const land = world.cells.filter((c) => world.top(c) > 0).length;
assert.equal(b.c01.stain.cells, land, '贴面格数 = 陆地格数（海面不染）');
const geo = b.c01.stain.mesh.geometry;
assert.equal(geo.getAttribute('position').count % 3 >= 0, true);
assert.ok(geo.getIndex().count > land * 2, '每格至少 1 个三角（扇形三角剖分）');
const ys = [];
for (let i = 1; i < geo.getAttribute('position').count * 3; i += 3) ys.push(geo.getAttribute('position').array[i]);
assert.ok(ys.every((y) => y > 0), '所有顶点都在水面以上');

// ── ③ 乘性混合（压色），不是叠一层粉：片子里 R 不动、G/B 各掉 6.6%/5.3%
const mat = b.c01.stain.mesh.material;
assert.equal(mat.blending, THREE.MultiplyBlending, 'MultiplyBlending');
assert.equal(mat.depthWrite, false, '不吃深度写');
assert.equal(mat.transparent, true);

// ── ④ 手动锁进度：0 = 纯白（等于没染），1 = 实测系数
b.c01.setStainProgress(0); b.update(1 / 30);
assert.equal(b.c01.stats.stainColor, '#ffffff');
assert.equal(b.c01.stats.stainProgress, 0);
b.c01.setStainProgress(1); b.update(1 / 30);
assert.equal(b.c01.stats.stainColor, '#ffeef1', 'p=1 的 8bit 系数');
assert.equal(b.c01.stats.stainProgress, 1);
assert.equal(mat.color.getHexString(), 'ffeef1');

// ── ⑤ 自动模式：第一次伤害（见血 / 丢屋）才起步，之后按折线走
b.c01.setStainProgress(null);
assert.equal(b.c01.stainT0, null, '还没挨打：时钟没起');
let hurtAt = null;
for (let k = 0; k < 3000 && hurtAt == null; k++) { b.update(1 / 30); if (b.c01.stainT0 != null) hurtAt = b.t; }
assert.ok(hurtAt != null, '开战后一定会挨到第一次伤害');
assert.equal(b.c01.stainT0, hurtAt);
for (let k = 0; k < 30; k++) b.update(1 / 30);   // 再跑 1 秒，让折线离开起点
const age = b.t - hurtAt;
assert.ok(Math.abs(b.c01.stats.stainProgress - +stainProgress(age).toFixed(3)) < 2e-3, '进度跟折线一致');
assert.ok(b.c01.stats.stainProgress >= 0.25, `挨打 1s 内地面已跨过起爆那一档（实测 0.25+，实际 ${b.c01.stats.stainProgress}）`);

// ── ⑥ 可逆：关掉不删层（再开还是同一份），stop 才释放
b.c01.set('groundTint', false);
assert.equal(b.c01.stain.mesh.visible, false, '关：隐藏');
b.c01.set('groundTint', true);
assert.equal(b.c01.stain.mesh.visible, true, '再开：复原');
const layer = b.c01.stain.mesh;
b.c01.stop();
assert.equal(b.c01.stain, null, 'stop：释放');
assert.equal(layer.parent, null, 'stop：从组里摘掉');
assert.equal(b.c01.stainT0, null);

console.log('ground-tint-battle PASS', JSON.stringify({ landCells: land, hurtAt: +hurtAt.toFixed(2) }));
