// 多格 tile 三维 WFC + 顶点体素 AO（793545297376972801）。
import assert from 'node:assert/strict';
import { buildParts, solveMultitile, validateMultitile, voxelFaceAO, facesCompatible } from '../src/build/multitile-wfc.js';

const parts = buildParts();
// 部件：拱 3×2×1 = 6 部件，下中那格不实心、底面 O
const archMid = parts.find((p) => p.id === 'archX@1,0,0');
assert.ok(archMid && !archMid.solid && archMid.faces[3] === 'O', '拱下中空、底须悬空');
assert.ok(facesCompatible('T', 'S', 2) && !facesCompatible('A', 'S', 2) && facesCompatible('A', 'O', 2) && !facesCompatible('T', 'O', 2), '承托 / 悬空规则');
const seeds = [1, 2, 3, 5, 8, 13, 21, 34];
const out = [];
for (const seed of seeds) for (const size of [[5, 6, 5], [4, 8, 4]]) {
  const r = solveMultitile({ size, seed });
  assert.ok(r.ok, `seed ${seed} 解出（${r.reason || ''}）`);
  assert.deepEqual(validateMultitile(r), [], `seed ${seed} 全部面相容`);
  // 多格块完整：每个锚点，块内每个偏移都是同一 tile 的对应部件
  for (const pl of r.placements) {
    const [sx, sy, sz] = pl.size;
    for (let x = 0; x < sx; x++) for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++)
      assert.equal(r.parts[r.grid[r.idx(pl.at[0] + x, pl.at[1] + y, pl.at[2] + z)]].id, `${pl.tile}@${x},${y},${z}`, '多格块完整');
  }
  // 竖直承托：任何实心体素正下方要么地面、要么实心（拱腿 / 楼板），拱洞下方必为空
  const { size: [W, H, D] } = r;
  for (let z = 0; z < D; z++) for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) {
    const p = r.parts[r.grid[r.idx(x, y, z)]];
    if (p.faces[3] === 'S') assert.equal(r.solid[r.idx(x, y - 1, z)], 1, '悬空实心');
  }
  // 确定性
  const again = solveMultitile({ size, seed });
  assert.deepEqual([...again.grid], [...r.grid], '同种子同结果');
  // AO
  const faces = voxelFaceAO(r);
  const vals = faces.flatMap((f) => f.ao);
  assert.ok(vals.every((v) => v >= 0 && v <= 1), 'AO ∈ [0,1]');
  out.push({ seed, size: size.join('×'), multi: r.stats.multi, solid: r.stats.solid, backtracks: r.stats.backtracks, faces: faces.length, dark: vals.filter((v) => v < 1).length, trace: r.trace.length });
}
assert.ok(out.some((o) => o.multi >= 2), '出现多格构件');
assert.ok(out.every((o) => o.solid > 0), '有楼');
assert.ok(out.some((o) => o.dark > o.faces), 'AO 在凹处 / 角落生效');
// AO 手算：地面上一块 1×1×1 —— 顶面四角全亮，侧面贴地两角 = 1/3（地面既是一侧也是对角）
const one = { size: [3, 2, 3], solid: Uint8Array.from({ length: 18 }, (_, i) => (i === 1 + 3 * (0 + 2 * 1) ? 1 : 0)), idx: (x, y, z) => x + 3 * (y + 2 * z) };
const f1 = voxelFaceAO(one), top = f1.find((f) => f.d === 2), side = f1.find((f) => f.d === 0);
assert.deepEqual(top.ao, [1, 1, 1, 1]);
assert.equal(side.ao.filter((v) => Math.abs(v - 1 / 3) < 1e-9).length, 2, '贴地两角暗两档（地面同时算侧挡 + 对角挡）');
console.log('PASS 多格 tile 3D WFC：部件私有面保证整块出现、承托 / 拱下悬空、同种子确定、回溯可解；顶点体素 AO 手算一致', JSON.stringify(out.slice(0, 6)));

// —— 等轴测画法（multitile.html 同一函数）：软件光栅出 PNG，目视核对「多格拱 / 楼板夹缝暗」
import { drawMultitileIso } from '../src/build/multitile-iso.js';
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
function softCtx(W, H) {
  const img = new Uint8Array(W * H * 3).fill(70); let path = [], fill = [0, 0, 0];
  return { img, W, H, set fillStyle(v) { fill = v.match(/\d+/g).map(Number); }, beginPath() { path = []; }, lineTo(x, y) { path.push([x, y]); }, moveTo(x, y) { path.push([x, y]); }, closePath() {},
    fill() { const ys = path.map((p) => p[1]); for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(H - 1, Math.ceil(Math.max(...ys))); y++) { const xs = []; for (let i = 0; i < path.length; i++) { const a = path[i], b = path[(i + 1) % path.length]; if ((a[1] <= y + .5) !== (b[1] <= y + .5)) xs.push(a[0] + (y + .5 - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); } xs.sort((p, q) => p - q); for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.round(xs[k])); x < Math.min(W, Math.round(xs[k + 1])); x++) img.set(fill, (y * W + x) * 3); } } };
}
function png(w, h, rgb) {
  const T = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const ch = (t, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(t, 4); d.copy(b, 8); b.writeUInt32BE(crc(Buffer.concat([Buffer.from(t), d])), 8 + d.length); return b; };
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) Buffer.from(rgb.buffer, y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ch('IHDR', ih), ch('IDAT', deflateSync(raw)), ch('IEND', Buffer.alloc(0))]);
}
{
  const r = solveMultitile({ size: [5, 7, 5], seed: 3 });
  const W = 900, H = 420, c = softCtx(W, H);
  const n1 = drawMultitileIso(c, r, { upto: Math.round(r.trace.length * .45), s: 22, ox: 150, oy: 300 });
  drawMultitileIso(c, r, { s: 22, ox: 450, oy: 300, ao: false });
  const n3 = drawMultitileIso(c, r, { s: 22, ox: 750, oy: 300 });
  assert.ok(n1 > 0 && n3 > n1, '回放半程面数少于完整结果');
  writeFileSync(new URL('../artifacts/coverage/multitile-wfc-iso.png', import.meta.url), png(W, H, c.img));
  console.log('PASS 等轴测：半程回放 / 无 AO / 有 AO 三联写入 artifacts/coverage/multitile-wfc-iso.png', JSON.stringify({ half: n1, full: n3 }));
}
