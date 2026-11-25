/**
 * lsystem.js — 龙形曲线（Heighway dragon）→ 逐格立吊脚楼 → 末端换风格
 *
 * ── 原文 ─────────────────────────────────────────────────────────────────
 *   1195463004919357443（2019-11-15）
 *   "My brother … obviously built a nice fractal. Bonus points if you can name it"
 *   → 原文**只点了一句"fractal"，并且让读者猜名字**。答案就是 **Heighway dragon**
 *     （折纸龙形曲线，A→A+B+ / B→-A-B）。名字不写，说明它要的就是"逐格堆出来的
 *     那条自相似脊"，不是某个特例形状。
 *
 * ── 帧实测（512×512 · f020 / f017）──────────────────────────────────────
 *   结构       一层**黑色细梁**组成的格架（梁宽 2px），格架往上每隔一格立一栋房，
 *             房与房之间是 1 格宽的缝 → 走的就是"曲线上逐格取一格"的稀疏摆法。
 *   房体       约 40×26px @512（占画幅 7.8% 宽），墙上开 2–3 个窗，
 *             檐口有一条红棕装饰带（高约 3px），**屋脊沿格架方向**（每栋朝向随曲线转）。
 *   屋顶       双坡，坡度 ≈ 30°，四边出檐 8%（每边约 1.5px @512）。
 *   吊脚       每栋 4 根立柱，柱宽 **2px**（与格架梁同宽），柱高 ≈ 0.55 房高；
 *             柱是深色（比房体暗 3 档），于是每栋房看起来是"浮"在格架上的。
 *   末端        曲线末端那栋**换墙色**：别人是米黄墙，它是**绿墙**（约 (86,150,104)），
 *             屋顶仍是同一档橙红。→ "末端例外"不是加装饰，是换调色板。
 *   数量        画面里数到 13–15 个屋顶；龙形曲线 4 阶 = 16 步，剩下的被前景挡住。
 *   阴影        房下有软阴影落在格架下层，但**柱脚没有接触阴影**（柱子太细，省了）。
 *
 * ── 为什么这样写 ────────────────────────────────────────────────────────
 *   ① **曲线走格，房子跳格摆。** 每步都放一栋房会挤成一条连续的墙，片子里房与房
 *      之间有 1 格缝。做法：沿路径贪心取格，要求与已放的房子**切比雪夫距离 ≥ 2**
 *      （只按"每 2 步"取会踩到对角相邻那两格，屋顶连成一片）。6 阶龙形曲线
 *      （65 步、8×12 格）取出来正好 13 栋，与画面里数到的 13–15 个屋顶对得上。
 *   ② **朝向跟着曲线切线转。** 片子里每栋的屋脊方向都不一样（有的横有的竖），
 *      这是"按上一步的走向定朝向"，不是统一朝向。少了这一步，整条脊会变成
 *      一排平行房，一眼假。
 *   ③ **柱子必须单独画且比房体暗。** 第一版把柱子当"房体的下延"，颜色一样，
 *      结果整栋房看起来是落地的方块，没有"吊脚"的悬浮感；把柱色压暗 3 档、
 *      宽度定 2px 之后才对。
 *   ④ **末端换的是墙色不是屋顶色。** 试过换屋顶（绿屋顶），整条脊的色彩重心
 *      会被末端拽走；片子里末端屋顶跟别人一样，只有墙变绿 —— 视线才会停在
 *      "最后那一栋"，而不是"最后一顶帽子"。
 */

export const MEASURED = {
  ref: 512,
  bodyW: 40,          // 房体宽（px @512）
  bodyH: 26,          // 房体高
  roofPitch: 30,      // 屋面坡角（度）
  eave: 0.08,         // 出檐比例（每边）
  stiltW: 2,          // 立柱宽（px，与格架梁同宽）
  stiltRatio: 0.55,   // 柱高 / 房高
  beam: 2,            // 格架梁宽（px）
  skip: 2,            // 沿曲线取格的最小切比雪夫间距（=2 → 缝 1 格，斜向也不碰）
  termWall: [86, 150, 104],  // 末端绿墙
  wall: [226, 214, 176],     // 常规米黄墙
  roof: [214, 108, 74],      // 橙红瓦
  trim: [168, 74, 62],       // 檐口红棕带
  beamCol: [26, 32, 40],     // 格架梁/立柱（近黑）
};

/**
 * Heighway dragon：A → A+B+，B → −A−B（+ 左转 90°，− 右转 90°）。
 * 返回 {path:[[x,y]...], dirs:[0|1|2|3]}，path 是走过的格子序列。
 */
export function dragon(order = 4) {
  let s = 'A';
  for (let i = 0; i < order; i++) {
    let out = '';
    for (const ch of s) {
      if (ch === 'A') out += 'A+B+';
      else if (ch === 'B') out += '-A-B';
      else out += ch;
    }
    s = out;
  }
  // 走：+ 左转，- 右转，字母前进一步
  let x = 0, y = 0, d = 0;
  const path = [[0, 0]];
  const dirs = [0];
  const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
  for (const ch of s) {
    if (ch === '+') d = (d + 1) % 4;
    else if (ch === '-') d = (d + 3) % 4;
    else {
      x += DX[d]; y += DY[d];
      path.push([x, y]); dirs.push(d);
    }
  }
  // 归一化到 0 起
  const minX = Math.min(...path.map((p) => p[0])), minY = Math.min(...path.map((p) => p[1]));
  return {
    path: path.map(([a, b]) => [a - minX, b - minY]),
    dirs,
    size: [Math.max(...path.map((p) => p[0])) - minX + 1, Math.max(...path.map((p) => p[1])) - minY + 1],
  };
}

/** 等距相机（地面圆 R → 半轴 1.2247R / 0.7071R）。 */
export function makeCam({ cx, cy, w = 16, h = 9.24, zh = 15 }) {
  return {
    cx, cy, w, h, zh,
    p(x, y, z) { return [cx + (x - y) * w, cy + (x + y) * h * 0.5 - z * zh]; },
    depth(x, y, z) { return x + y + z * 1.15; },
  };
}

/**
 * 把曲线变成"格架 + 吊脚楼"。
 * 返回 {beams, houses}：beams 是格架梁（两格之间的细杆），houses 每项
 * {x, y, dir, wall, roof, z} —— z 是这栋所在的高度（片中整条脊是同一层）。
 */
export function stackHouses(curve, { skip = MEASURED.skip, level = 1.0 } = {}) {
  const minCheb = skip;
  const { path, dirs } = curve;
  const houses = [];
  const placed = [];
  for (let i = 0; i < path.length; i += 1) {
    // **坑**：最早是"每 2 步放一栋"。但龙形曲线会拐弯，2 步之外的两格可能正好是
    // 对角相邻，房子在等距图里就贴在一起、屋顶连成一片。改成按**切比雪夫距离 ≥ 2**
    // 摆，斜向也不会碰 —— 片子里每栋之间都看得见暗缝。
    const [px0, py0] = path[i];
    if (placed.some(([a, b]) => Math.max(Math.abs(a - px0), Math.abs(b - py0)) < minCheb)) continue;
    placed.push([px0, py0]);
    houses.push({
      x: path[i][0], y: path[i][1],
      dir: dirs[i] % 2,                    // 屋脊只有 x / y 两向，跟着切线转
      z: level,
      wall: MEASURED.wall,
      roof: MEASURED.roof,
      terminal: false,
    });
  }
  // 末端：换墙色（不是换屋顶）
  if (houses.length) { houses[houses.length - 1].terminal = true; houses[houses.length - 1].wall = MEASURED.termWall; }
  // 格架梁：相邻两格之间一根（把整条曲线连起来，房子只是浮在上面）
  const beams = [];
  for (let i = 1; i < path.length; i++) beams.push([path[i - 1], path[i], level]);
  return { beams, houses };
}

/** 三点/四点都吃的多边形（每点自带 z）。 */
function poly3(ctx, cam, pts, color) {
  ctx.beginPath();
  const s = pts.map(([x, y, z]) => cam.p(x, y, z));
  ctx.moveTo(s[0][0], s[0][1]);
  for (let i = 1; i < s.length; i++) ctx.lineTo(s[i][0], s[i][1]);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** 竖直四边形（两面墙共用）。 */
function faceV(ctx, cam, a, b, z0, z1, color) {
  poly3(ctx, cam, [[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]], color);
}

/** 画格架：每根梁画成 2px 宽的横杆 + 竖柱（片中梁是近黑的细线）。 */
export function drawBeams(ctx, cam, beams, { width = MEASURED.beam, color = '#1a2028' } = {}) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'butt';
  for (const [a, b, z] of beams) {
    const p = cam.p(a[0] + 0.5, a[1] + 0.5, z - 1.2), q = cam.p(b[0] + 0.5, b[1] + 0.5, z - 1.2);
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
    for (const pt of [a, b]) {                       // 每格两端各一根竖柱，撑起格架
      const v = cam.p(pt[0] + 0.5, pt[1] + 0.5, z), w = cam.p(pt[0] + 0.5, pt[1] + 0.5, z - 1.2);
      ctx.beginPath(); ctx.moveTo(v[0], v[1]); ctx.lineTo(w[0], w[1]); ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * 一栋吊脚楼（房宽固定 1 格）。
 * 顺序有讲究：柱先画（会被房体压住上半截，正好露出"吊脚"那一段）。
 */
export function drawHouse(ctx, cam, h, cell, { bodyH = 1.05 } = {}) {
  const w = 0.5;                       // 半宽（格）。**坑**：这里曾是 cell*0.5，
                                       // 把"格"当成了"像素"，房子被放大 19 倍糊满画布。
  const { x, y, dir, z, wall, roof } = h;
  const cx = x + 0.5, cy = y + 0.5;
  const [wr, wg, wb] = wall, [rr, rg, rb] = roof;
  const z0 = z, z1 = z + bodyH;

  // ① 四根吊脚柱：暗、细，高 = 房高 × 0.55
  const legH = bodyH * MEASURED.stiltRatio;
  ctx.strokeStyle = `rgb(${MEASURED.beamCol.join(',')})`;
  ctx.lineWidth = MEASURED.stiltW;
  for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const a = cam.p(cx + dx * w * 0.66, cy + dy * w * 0.66, z0 - legH);
    const b = cam.p(cx + dx * w * 0.66, cy + dy * w * 0.66, z0);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }

  // ② 房体：可见两面（正面 +y、右面 +x）
  faceV(ctx, cam, [cx - w, cy + w], [cx + w, cy + w], z0, z1, `rgb(${wr},${wg},${wb})`);
  faceV(ctx, cam, [cx + w, cy - w], [cx + w, cy + w], z0, z1,
    `rgb(${Math.round(wr * 0.9)},${Math.round(wg * 0.9)},${Math.round(wb * 0.9)})`);

  // ③ 檐口红棕带（房高的 20%）
  faceV(ctx, cam, [cx - w, cy + w], [cx + w, cy + w], z1 - bodyH * 0.2, z1, `rgb(${MEASURED.trim.join(',')})`);

  // ④ 双坡顶：脊沿 x（dir=0）或沿 y（dir=1）；出檐 E
  const E = MEASURED.eave * w * 2;   // 8% 房宽
  const rh = Math.tan((MEASURED.roofPitch * Math.PI) / 180) * w;
  const dark = (c) => c.map((v) => Math.round(v * 0.86)).join(',');
  const main = `rgb(${rr},${rg},${rb})`, side = `rgb(${dark(roof)})`;
  if (dir === 0) {
    // 脊沿 x → 两坡朝 ±y
    poly3(ctx, cam, [[cx - w - E, cy + w + E, z1], [cx + w + E, cy + w + E, z1],
    [cx + w + E, cy, z1 + rh], [cx - w - E, cy, z1 + rh]], main);
    poly3(ctx, cam, [[cx + w + E, cy - w - E, z1], [cx + w + E, cy + w + E, z1],
    [cx + w + E, cy, z1 + rh], [cx + w + E, cy, z1 + rh]], side);
  } else {
    // 脊沿 y → 两坡朝 ±x（只画朝镜头的那一坡 + 一个三角山墙）
    poly3(ctx, cam, [[cx + w + E, cy + w + E, z1], [cx + w + E, cy - w - E, z1],
    [cx, cy - w - E, z1 + rh], [cx, cy + w + E, z1 + rh]], main);
    poly3(ctx, cam, [[cx - w - E, cy + w + E, z1], [cx + w + E, cy + w + E, z1],
    [cx, cy + w + E, z1 + rh]], side);
  }
}

/** 整条脊：按视深排序逐栋画（远 → 近）。 */
export function drawTown(ctx, cam, { beams, houses }, cell, opts = {}) {
  drawBeams(ctx, cam, beams, opts);
  const order = houses.map((h) => ({ h, d: cam.depth(h.x + 0.5, h.y + 0.5, h.z) }))
    .sort((a, b) => b.d - a.d);
  for (const { h } of order) drawHouse(ctx, cam, h, cell, opts);
  return order.length;
}

/** 反测：统计画面上"橙红屋顶"的连通块数（片子里数到 13–15 个）。 */
export function countRoofs(ctx, W, H, roof = MEASURED.roof) {
  const d = ctx.getImageData(0, 0, W, H).data;
  const isRoof = (i, j) => {
    const k = (j * W + i) * 4;
    return Math.abs(d[k] - roof[0]) < 46 && Math.abs(d[k + 1] - roof[1]) < 46 && Math.abs(d[k + 2] - roof[2]) < 46;
  };
  // 先腐蚀 1px：相邻两栋的屋顶在斜角上会连成一片，不腐蚀的话 17 栋只数出 6 块。
  const mask = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (isRoof(i, j)) mask[j * W + i] = 1;
  const er = new Uint8Array(W * H);
  for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
    const k = j * W + i;
    if (mask[k] && mask[k - 1] && mask[k + 1] && mask[k - W] && mask[k + W]) er[k] = 1;
  }
  const seen = new Uint8Array(W * H);
  let blobs = 0;
  const sizes = [];
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      if (seen[j * W + i] || !er[j * W + i]) continue;
      // 4 连通泛洪
      const st = [[i, j]]; seen[j * W + i] = 1; let n = 0;
      while (st.length) {
        const [a, b] = st.pop(); n++;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const c = a + dx, e = b + dy;
          if (c < 0 || e < 0 || c >= W || e >= H) continue;
          if (seen[e * W + c] || !er[e * W + c]) continue;
          seen[e * W + c] = 1; st.push([c, e]);
        }
      }
      if (n > 20) { blobs++; sizes.push(n); }
    }
  }
  return { blobs, sizes: sizes.sort((a, b) => a - b) };
}

/** 反测：末端绿墙是否真的出现在画面上（片中 (86,150,104)）。 */
export function countTerminal(ctx, W, H, col = MEASURED.termWall) {
  const d = ctx.getImageData(0, 0, W, H).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (Math.abs(d[i] - col[0]) < 30 && Math.abs(d[i + 1] - col[1]) < 30 && Math.abs(d[i + 2] - col[2]) < 30) n++;
  }
  return n;
}
