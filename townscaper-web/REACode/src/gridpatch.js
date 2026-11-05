/**
 * gridpatch.js — 不规则网格里镶进「手工打磨的正六边形补丁」。
 *
 * 原文（x.com/OskSta/status/1301816247479345152, 2020-09-04）：
 *   "Some are asking for the option to use regular grids. Now, that's (obviously)
 *    against the Townscaper design philosophy. However, I am thinking of sprinkling
 *    the current generated grid with random patches of hand crafted grid, like
 *    little gems to find and build your tempels upon"
 *
 * 画面（抽帧 tmp/cap/1301…/f00.png）：
 *   · 一张**平的**网格网，没有高度、没有光照，纯线框（灰白细线，背景 #3a3a42）；
 *   · 网的格子里绝大多数是**歪的六边形**：同一格六条边长短不一，顶点会漂；
 *   · 但有一处（画面中偏左）格子明显**规整**：六条边等长、顶点对齐，
 *     像从别处剪下来贴上去的一块；
 *   · 补丁与周围的接缝处**没有特殊处理** —— 只是网格线继续走，
 *     所以补丁的边界是被「顺带」接上的，不是画出来的。
 *
 * 机制（一句话）：网格 = 一张三角晶格的顶点，顶点各自带一点抖动；
 * 抖动量由「顶点是否落在补丁圆盘里」逐点归零 —— **补丁不是新几何，
 * 是把一块区域的手抖关掉**。所以接缝只有一条，缝上的边数就是代价。
 */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SQ3 = Math.sqrt(3);

/**
 * @param {{w:number,h:number,R?:number,jitter?:number,patches?:number,seed?:number,patchR?:number}} o
 */
export function buildGrid({ w = 1280, h = 800, R = 26, jitter = 0.18, patches = 4, seed = 5, patchR = 2.4 } = {}) {
  const rnd = mulberry32(seed);
  const dx = R * SQ3, dy = R * 1.5;

  // 1) 顶点：三角晶格 + 每点一份抖动（按 key 存，保证相邻格共用同一个顶点）
  const verts = new Map();
  const jit = new Map();
  const vkey = (x, y) => Math.round(x * 8) + ',' + Math.round(y * 8);
  const push = (x, y) => {
    const k = vkey(x, y);
    if (!verts.has(k)) {
      verts.set(k, { ix: x, iy: y, x, y, j: rnd() });
      jit.set(k, { ax: (rnd() - 0.5) * 2, ay: (rnd() - 0.5) * 2 });
    }
    return k;
  };

  // 2) 补丁：随机圆盘，落在盘内的顶点抖动量归零
  const patchList = [];
  for (let i = 0; i < patches; i++) {
    patchList.push({
      x: w * (0.18 + rnd() * 0.64),
      y: h * (0.24 + rnd() * 0.52),
      r: R * (patchR * (0.7 + rnd() * 0.6)),
    });
  }
  const inPatch = (x, y) => {
    for (const p of patchList) if (Math.hypot(x - p.x, y - p.y) < p.r) return true;
    return false;
  };

  // 3) 格子：每个格心周围 6 个顶点，顶点位置 = 理想位置 + 抖动（补丁内为 0）
  const cells = [];
  const rows = Math.ceil(h / dy) + 2, cols = Math.ceil(w / dx) + 2;
  for (let r = -1; r <= rows; r++) {
    for (let c = -1; c <= cols; c++) {
      const cx = c * dx + (r & 1 ? dx / 2 : 0);
      const cy = r * dy;
      const keys = [];
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 180 * (30 + 60 * k);
        keys.push(push(cx + R * Math.cos(a), cy + R * Math.sin(a)));
      }
      const fixed = inPatch(cx, cy);
      cells.push({ cx, cy, keys, fixed });
    }
  }

  // 4) 落位：补丁内的顶点不抖，其余按 jitter * R 抖
  const pos = new Map();
  for (const [k, v] of verts) {
    const j = jit.get(k);
    const fix = inPatch(v.ix, v.iy);
    const amt = fix ? 0 : jitter * R;
    pos.set(k, { x: v.ix + j.ax * amt, y: v.iy + j.ay * amt, fixed: fix });
  }

  // 5) 接缝：一条边的两个端点「一边固定一边抖」= 缝上被拉扯的边
  const seam = new Map();
  let seamEdges = 0, totalEdges = 0;
  for (const cell of cells) {
    for (let k = 0; k < 6; k++) {
      const a = cell.keys[k], b = cell.keys[(k + 1) % 6];
      const ek = a < b ? a + '|' + b : b + '|' + a;
      if (seam.has(ek)) continue;
      const fa = pos.get(a).fixed, fb = pos.get(b).fixed;
      totalEdges++;
      if (fa !== fb) { seamEdges++; seam.set(ek, true); }
      else seam.set(ek, false);
    }
  }

  const patchCells = cells.filter((c) => c.fixed).length;
  return {
    w, h, R, cells, pos, patchList, seam,
    stats: {
      cells: cells.length,
      patchCells,
      patches: patchList.length,
      totalEdges,
      seamEdges,
      seamPerPatch: +(seamEdges / patchList.length).toFixed(1),
    },
  };
}

export function draw(ctx, g, { showSeam = true, onlyPatches = false } = {}) {
  ctx.clearRect(0, 0, g.w, g.h);
  ctx.fillStyle = '#3a3a42';
  ctx.fillRect(0, 0, g.w, g.h);

  const path = (cell) => {
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const p = g.pos.get(cell.keys[k]);
      k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
    }
    ctx.closePath();
  };

  // 补丁底色（暖色），让「宝石」自己浮出来
  for (const cell of g.cells) {
    if (!cell.fixed) continue;
    path(cell);
    ctx.fillStyle = 'rgba(232,196,120,0.16)';
    ctx.fill();
  }

  // 网格线：普通格细灰，补丁格稍亮
  ctx.lineWidth = 1;
  for (const cell of g.cells) {
    if (onlyPatches && !cell.fixed) continue;
    path(cell);
    ctx.strokeStyle = cell.fixed ? 'rgba(240,226,190,0.75)' : 'rgba(226,232,240,0.34)';
    ctx.stroke();
  }

  // 接缝：把「一边固定、一边抖」的边画成红点线，只有放大才看得见
  if (showSeam) {
    ctx.strokeStyle = 'rgba(255,120,120,0.9)';
    ctx.lineWidth = 1.6;
    for (const [ek, isSeam] of g.seam) {
      if (!isSeam) continue;
      const [a, b] = ek.split('|');
      const pa = g.pos.get(a), pb = g.pos.get(b);
      if (onlyPatches && !(pa.fixed && pb.fixed)) continue;
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
    }
  }
}
