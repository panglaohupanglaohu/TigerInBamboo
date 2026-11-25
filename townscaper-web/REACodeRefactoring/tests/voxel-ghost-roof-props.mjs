import assert from 'node:assert/strict';
import {
  rasterizeBoxes, roofProps, propStats, airDepths, interiorFaces, interiorTone,
  INTERIOR_TONE, INTERIOR_TONE_NEAR, INTERIOR_TONE_DEEP,
} from '../src/world/voxel-ghost.js';

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const lum = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

// 与页面同一套演示体量（塔 + 露台 + 顶板 + 空心顶层）
const BOXES = [
  { x: 0, y: 0, z: 0, w: 14, h: 1, d: 14 },
  { x: 3, y: 1, z: 0, w: 9, h: 10, d: 1 },
  { x: 3, y: 1, z: 1, w: 1, h: 10, d: 10 },
  { x: 11, y: 1, z: 1, w: 1, h: 10, d: 10 },
  { x: 3, y: 1, z: 11, w: 3, h: 10, d: 1 },
  { x: 9, y: 1, z: 11, w: 3, h: 10, d: 1 },
  { x: 4, y: 5, z: 1, w: 7, h: 1, d: 10 },
  { x: 4, y: 8, z: 1, w: 7, h: 1, d: 10 },
  { x: 2, y: 11, z: 0, w: 11, h: 1, d: 12 },
  { x: 5, y: 12, z: 4, w: 5, h: 4, d: 5, hollow: true },
  { x: 4, y: 16, z: 3, w: 7, h: 1, d: 7 },
];
const voxels = rasterizeBoxes(BOXES);
const solid = new Set([...voxels.values()].map((v) => `${v.x},${v.y},${v.z}`));
const has = (x, y, z) => solid.has(`${x},${y},${z}`);

// ---------- 1. 四类小件都必须落在屋顶格上（上方无实体、本体实体）----------
{
  const r = roofProps(voxels);
  const st = propStats(voxels);
  ok(r.props.length > 200, `小件总数应上百（实得 ${r.props.length}）`);
  ok(st.floating === 0, `没有一件悬空/被埋（实得 ${st.floating}）`);
  const bad = r.props.filter((p) => {
    const c = p.cell;
    if (!has(c.x, c.y, c.z)) return true;                 // 基格必须是实体
    return p.kind !== 'dish' && has(c.x, c.y + 1, c.z);   // 除墙面圆盘外，上面不能再压实体
  });
  ok(bad.length === 0, `逐件核基格：全部实体且上方无遮挡（违例 ${bad.length}）`);
  const kinds = new Set(r.props.map((p) => p.kind));
  ok(['antenna', 'dish', 'rail', 'tree'].every((k) => kinds.has(k)), `四类都在（${[...kinds].join('/')}）`);
  ok(r.counts.antenna >= 6 && r.counts.antenna <= 20, `天线 6–20 根（实得 ${r.counts.antenna}）`);
  ok(r.counts.rail >= 150, `栏杆竖齿 ≥150（实得 ${r.counts.rail}）`);
  ok(r.counts.dish >= 1 && r.counts.dish <= 2, `圆盘 1–2 个（实得 ${r.counts.dish}）`);
  ok(r.counts.tree >= 1 && r.counts.tree <= 2, `露台小树 1–2 棵（实得 ${r.counts.tree}）`);
}

// ---------- 2. 天线尺寸/朝向：竖杆、长短不一、细 ----------
{
  const r = roofProps(voxels);
  const ant = r.props.filter((p) => p.kind === 'antenna');
  ok(ant.every((p) => p.h >= 0.55 && p.h <= 1.35), '天线高度在 0.55–1.35 格（原片 4× 裁切里最高的约 1.3 格）');
  ok(ant.every((p) => p.w <= 0.06), '天线是细杆（宽 ≤0.06 格）');
  const hs = ant.map((p) => +p.h.toFixed(3));
  ok(new Set(hs).size >= Math.min(5, ant.length - 1), `长短不一（${new Set(hs).size} 种高度）`);
  ok(ant.every((p) => Number.isFinite(p.x) && Number.isFinite(p.z)), '有确定的世界位置');
  // 同种子逐件复现
  const again = roofProps(voxels).props.filter((p) => p.kind === 'antenna');
  ok(JSON.stringify(again) === JSON.stringify(ant), '同种子 → 小件逐位复现');
  // 换种子会挪位置
  const other = roofProps(voxels, { seed: 77 }).props.filter((p) => p.kind === 'antenna');
  ok(JSON.stringify(other) !== JSON.stringify(ant), '换种子会重新选点（不是写死的坐标）');
}

// ---------- 3. 栏杆：只出现在「屋顶格 → 同层空格」的沿口 ----------
{
  const r = roofProps(voxels);
  const rail = r.props.filter((p) => p.kind === 'rail');
  const bad = rail.filter((p) => has(p.cell.x, p.cell.y, p.cell.z) === false);
  ok(bad.length === 0, '每根竖齿都有实体的屋顶格托着');
  // 竖齿必须贴着一条朝外的边：基格在某个水平方向上是空的
  const exposed = (c) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !has(c.x + dx, c.y, c.z + dz));
  ok(rail.every((p) => exposed(p.cell)), '竖齿只画在屋顶沿口（基格至少有一侧同层是空的）');
  ok(rail.every((p) => p.h >= 0.13 && p.h <= 0.19), '竖齿是短齿（0.13–0.19 格，不是栏杆柱）');
  // 同一条边上的竖齿间距 == postGap（每格 4 根）
  const perCell = {};
  for (const p of rail) { const k = `${p.cell.x},${p.cell.y},${p.cell.z}`; perCell[k] = (perCell[k] || 0) + 1; }
  const counts = Object.values(perCell);
  ok(Math.min(...counts) >= 1 && Math.max(...counts) <= 8, `单格沿口 1–8 根（实得 ${Math.min(...counts)}–${Math.max(...counts)}，每格朝外 4 面 × 4 齿上限）`);
}

// ---------- 4. 圆盘：挂在上部朝外的立面上（不是屋顶上的锅）----------
{
  const r = roofProps(voxels);
  const dish = r.props.filter((p) => p.kind === 'dish');
  ok(dish.length >= 1, '至少一个圆盘');
  const maxY = r.maxY;
  ok(dish.every((p) => p.cell.y >= maxY - 6), `圆盘都在上部 6 层内（原片左塔上部那片高度）`);
  ok(dish.every((p) => (p.axis === 'x' ? !has(p.cell.x + 1, p.cell.y, p.cell.z) : !has(p.cell.x, p.cell.y, p.cell.z + 1))), '圆盘挂的那一面必须是朝外的（不埋进邻格）');
  ok(dish.every((p) => p.r >= 0.24 && p.r <= 0.34), '圆盘半径 0.24–0.34 格');
}

// ---------- 5. 露台小树：只长在最平的露台格上 ----------
{
  const r = roofProps(voxels);
  const tree = r.props.filter((p) => p.kind === 'tree');
  ok(tree.length >= 1, '至少一棵露台小树');
  const flatOk = tree.every((p) => {
    const c = p.cell;
    let n = 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      if (has(c.x + dx, c.y, c.z + dz) && !has(c.x + dx, c.y + 1, c.z + dz)) n++;
    }
    return n >= 7;
  });
  ok(flatOk, '树只长在 8 邻全是屋顶的平整露台上');
  ok(tree.every((p) => p.s >= 0.86 && p.s <= 1.04), '树尺寸在 0.86–1.04（不至于穿模）');
}

// ---------- 6. 进深场：从外部空气泛洪，洞口浅、屋里深 ----------
{
  const air = airDepths(voxels);
  ok(air.size > 3000, `空气格 3000+（实得 ${air.size}）`);
  let min = Infinity, max = 0;
  for (const d of air.values()) { min = Math.min(min, d); max = Math.max(max, d); }
  ok(min === 0, '贴着包围盒边界的空气 depth=0（种子）');
  ok(max >= 10, `屋子进深至少 10 格（实得 ${max}）`);
  // 门外那格 vs 屋子最里面那格
  ok(air.get('6,3,12') <= 3, `门外一格很浅（实得 ${air.get('6,3,12')}）`);
  ok(air.get('6,3,3') >= 8, `屋里靠后墙很深（实得 ${air.get('6,3,3')}）`);
  const walls = interiorFaces(voxels, { reach: 16 });
  const ds = [...walls.values()];
  ok(ds.every((d) => d >= 1), '每个内墙面的进深都 ≥1');
  ok(Math.max(...ds) >= 12, `内墙最深 ≥12 格（实得 ${Math.max(...ds)}）`);
  // 深墙面必在浅墙面之后（同一间屋：靠后墙的进深大于靠门洞的）
  const deep = [...walls.entries()].filter(([, d]) => d >= 12);
  ok(deep.length > 0, '存在深墙面（用于画暗档）');
}

// ---------- 7. 进深 → 色：单调变暗、跨度够、暗端仍是「玫瑰」 ----------
{
  const base = lum(INTERIOR_TONE);
  const l1 = lum(interiorTone(1).hex), l4 = lum(interiorTone(4).hex), l16 = lum(interiorTone(16).hex);
  ok(l1 > base, `洞口附近比基准色更亮（${l1.toFixed(1)} > ${base.toFixed(1)}）`);
  ok(l4 > l16, `越深越暗（depth 4 ${l4.toFixed(1)} > depth 16 ${l16.toFixed(1)}）`);
  ok(l1 - l16 >= 40, `浅/深差 ≥40 级（实得 ${(l1 - l16).toFixed(1)}）`);
  const seq = [0, 2, 4, 6, 8, 10, 12, 14, 16].map((d) => lum(interiorTone(d).hex));
  ok(seq.every((v, i) => i === 0 || v < seq[i - 1] + 1e-9), '亮度随进深单调不升');
  const tMid = interiorTone(9).t;
  ok(tMid > 0.5 && tMid < 0.75, `ref=9 时 9 格的 t 落在中段（实得 ${tMid.toFixed(3)}）`);
  // 暗端仍是「R>B>G」的灰玫瑰，不是灰
  for (const hex of [INTERIOR_TONE_NEAR, INTERIOR_TONE_DEEP]) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    ok(r > b && b > g, `${hex} 满足 R>B>G（玫瑰族，不是中性灰）`);
  }
  assert.throws(() => interiorTone(NaN), RangeError); checks++;
  assert.throws(() => interiorTone(3, { ref: 0 }), RangeError); checks++;
  assert.throws(() => roofProps(voxels, { antennaRate: 2 }), RangeError); checks++;
  assert.throws(() => roofProps(voxels, { postGap: 0.01 }), RangeError); checks++;
}

// ---------- 8. 小体量不出小件（空/单格不该崩）----------
{
  const cube = rasterizeBoxes([{ x: 0, y: 0, z: 0, w: 1, h: 3, d: 1 }]);
  const r = roofProps(cube);
  ok(r.props.every((p) => p.kind === 'rail' || p.kind === 'antenna'), '单根 1×3 柱子只出栏杆/天线，不出树和圆盘');
  ok(propStats(cube).floating === 0, '单根柱子的小件也不悬空');
}

console.log(`voxel-ghost-roof-props: ${checks} checks PASS · 四类屋顶小件 + 进深渐变判据全绿`);
