import assert from 'node:assert/strict';
import {
  rasterizeBoxes, isoProject, rotateY, depthOf, cubeFaces,
  cavityCells, interiorFaces, windowSlot, windowStats, INTERIOR_TONE,
} from '../src/world/voxel-ghost.js';

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// ---------- 1. 正交环绕：竖直棱在任何方位角下都必须是竖的 ----------
{
  const base = { x: 3, y: 5, z: 7 };
  for (const az of [0, 13, 26, 45, 90, 137, -62, 180]) {
    const a = isoProject(base, { scale: 1, tilt: 0.5, azimuth: az });
    const b = isoProject({ ...base, y: base.y + 4 }, { scale: 1, tilt: 0.5, azimuth: az });
    ok(near(a[0], b[0]), `方位角 ${az}° 下竖直棱的屏幕 x 必须完全相同（${a[0]} vs ${b[0]}）`);
    ok(near(b[1] - a[1], -4), `升高 4 格的屏幕位移恒为 −4·scale（实得 ${b[1] - a[1]}）—— 正交，无透视缩短`);
  }
  // 原片实测：frame-0116 右轮廓 253 行内水平漂移 <1px（斜率 −0.0024）→ 正交环绕
  checks++;
}

// ---------- 2. rotateY：恒等 / 90° / 半径守恒 ----------
{
  const [x0, z0] = rotateY(2, 5, 0);
  ok(near(x0, 2) && near(z0, 5), '0° 是恒等变换');
  const [x9, z9] = rotateY(2, 5, 90);
  ok(near(x9, -5, 1e-12) && near(z9, 2, 1e-12), `90° 映射 (x,z)→(−z,x)，实得 (${x9}, ${z9})`);
  for (const az of [17, 61, 149, -88]) {
    const [x, z] = rotateY(3.5, -9.25, az);
    ok(near(Math.hypot(x, z), Math.hypot(3.5, -9.25), 1e-12), `${az}° 保半径`);
  }
  assert.throws(() => rotateY(1, 1, NaN), RangeError); checks++;
}

// ---------- 3. 方位角只改朝向：180° 时屏幕 x 取反 ----------
{
  const p = { x: 4, y: 2, z: 9 };
  const a = isoProject(p, { scale: 1, azimuth: 0 })[0];
  const b = isoProject(p, { scale: 1, azimuth: 180 })[0];
  ok(near(a, -b, 1e-12), `180° 时 sx 取反（${a} vs ${b}）`);
  const d0 = depthOf(p), d180 = depthOf(p, { azimuth: 180 });
  ok(near(d0, p.x + p.y + p.z), '方位角 0 的画家序深度仍是 x+y+z（向后兼容旧测试）');
  ok(near(d180, -p.x + p.y - p.z), `180° 深度按旋转后坐标算（实得 ${d180}）`);
}

// ---------- 4. cubeFaces(back)：内腔壁要的三个背面 ----------
{
  const f = cubeFaces({ x: 0, y: 0, z: 0 }, { back: true, azimuth: 20 });
  for (const name of ['top', 'right', 'left', 'backX', 'backZ', 'bottom']) {
    ok(Array.isArray(f[name]) && f[name].length === 4, `面 ${name} 是四点`);
  }
  const area = (q) => {
    let s = 0;
    for (let i = 0; i < 4; i++) { const [x1, y1] = q[i], [x2, y2] = q[(i + 1) % 4]; s += x1 * y2 - x2 * y1; }
    return Math.abs(s) / 2;
  };
  ok(area(f.backX) > 0.5 && area(f.backZ) > 0.5, `背面投影面积非零（${area(f.backX).toFixed(3)} / ${area(f.backZ).toFixed(3)}）`);
  ok(!('backX' in cubeFaces({ x: 0, y: 0, z: 0 })), '默认不返回背面（旧调用方不受影响）');
}

// ---------- 5. 内腔：封死才有腔，开口就没有 ----------
{
  const closed = rasterizeBoxes([{ x: 0, y: 0, z: 0, w: 7, h: 7, d: 7, hollow: true }]);
  const cav = cavityCells(closed);
  ok(cav.size === 5 * 5 * 5, `空心 7³ 外壳的内腔是 5×5×5=125 格，实得 ${cav.size}`);
  const walls = interiorFaces(closed, { reach: 16 });
  ok(walls.size === 50, `空心 7³：房间墙 = +x 25 面 + +z 25 面 = 50（棱上的格邻居是实体，射线还没出门就撞墙，不算；实得 ${walls.size}）`);
  ok(!walls.has('6,3,3,x'), '+x 外墙朝天空的方向撞不到实体 → 不是内墙（不污染外立面）');
  ok(walls.has('0,3,3,x'), '−x 墙的 +x 面朝腔、对面就是 +x 墙 → 判为内墙');
  ok(!walls.has('0,0,3,x'), 'y=0 那层：邻居是实心地板，射线没经过空气 → 不算内墙');
  ok(walls.has('3,3,0,z'), '−z 墙的 +z 面朝腔 → 判为内墙');

  // 门洞那面墙：打穿一格后射线的"对面"还在（只是多走一格），仍未误判外墙
  const open = rasterizeBoxes([{ x: 0, y: 0, z: 0, w: 7, h: 7, d: 7, hollow: true }]);
  open.delete('3,3,6');
  const wallsOpen = interiorFaces(open, { reach: 16 });
  ok(wallsOpen.size <= walls.size, `打穿一格后内墙不会变多（${wallsOpen.size} ≤ ${walls.size}）`);
  assert.throws(() => interiorFaces(open, { reach: 0 }), RangeError); checks++;

  // reach 太短就测不到离得远的对面墙（演示体量进深 14 格 —— 第 183 轮第一版 reach 8 就漏了一半）
  const short = interiorFaces(open, { reach: 4 });
  ok(short.size < walls.size, `reach 4 只能找到 4 格内的对面墙（${short.size} < ${walls.size}）`);
}

// ---------- 6. 窗洞：定种子、可回放、密度可控 ----------
{
  const v = { x: 3, y: 4, z: 5 };
  const a = windowSlot(v), b = windowSlot({ ...v });
  ok(JSON.stringify(a) === JSON.stringify(b), '同格同种子 → 逐位相同（可回放）');
  ok(a.u0 >= 0 && a.u1 <= 1 && a.v0 >= 0 && a.v1 <= 1 && a.u1 > a.u0 && a.v1 > a.v0, '窗槽矩形落在格面内且非退化');
  ok(a.u0 > 0.02 && a.u1 < 0.98, '窗槽不贴面边（是凹槽、不是整面开口）');
  const diff = [];
  for (let x = 0; x < 40; x++) if (windowSlot({ x, y: 2, z: 1 }).on !== windowSlot({ x, y: 2, z: 1 }, { seed: 24 }).on) diff.push(x);
  ok(diff.length > 0, `换种子会改窗位（${diff.length}/40 格不同）`);
  ok([0, 1, 2, 3, 4, 5, 6, 7].every((x) => windowSlot({ x, y: 1, z: 0 }, { density: 0 }).on === false), 'density=0 全关');
  ok([0, 1, 2, 3, 4, 5, 6, 7].every((x) => windowSlot({ x, y: 1, z: 0 }, { density: 1 }).on === true), 'density=1 全开');
  assert.throws(() => windowSlot(v, { density: -0.1 }), RangeError); checks++;
  assert.throws(() => windowSlot(v, { density: 1.5 }), RangeError); checks++;

  const shell = rasterizeBoxes([{ x: 0, y: 0, z: 0, w: 8, h: 6, d: 8, hollow: true }]);
  const st = windowStats(shell);
  ok(st.cells === shell.size - 64, `统计口径：底板（y=0 那层 64 格）不算外墙（${st.cells} 格）`);
  ok(st.faces === st.withWindow * 2, '面数 = 有窗格 × 两面（右 + 左）');
  ok(st.rate > 0.70 && st.rate < 0.92, `按原片"几乎每格都有槽"标定的开窗率（实得 ${(st.rate * 100).toFixed(1)}%）`);
}

// ---------- 7. 内腔色：冷灰青之外的那一支玫瑰 ----------
{
  const hex = INTERIOR_TONE.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
  ok(r > g && r > b, `玫瑰墙必须 R 最大（${r}/${g}/${b}）`);
  ok(b > g, 'R>B>G：偏紫粉，不是暖橙（暖橙是 R>G>B）');
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const s = (max - min) / max;
  ok(s > 0.10 && s < 0.30, `饱和度 10–30% 之间（原片实测 ≈20%，实得 ${(s * 100).toFixed(1)}%）`);
}

console.log(`voxel-ghost-orbit: ${checks} checks PASS · 方位角 8 档竖直棱恒竖 · 内腔/窗洞判据全绿`);
