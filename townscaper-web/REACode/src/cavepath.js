// 帖子 906416813810049025 —— 原文："New cave tileset. These levels really challenge your spacial skills
//        #screenshotsaturday #m..."（6 帧：紫色岩板 tileset，厚板开贯穿拱洞、板顶当上层挑台可站人/放房，
//        一串白色点沿表面从板顶翻过去再下到低层台面）
// 帖子 890611046435627008 —— 无原文，仅有视频（两拨单位分站上下层台地，白色菱形标记连成一条跨层路线）
// 为什么这么做：
//   这两条 partial 共用的缺口是同一件事 ——「同一条路线在平面图上重合，但在立面上分成两条」。
//   厚板（4 格厚）把同一片平面格切成两个可行走面：洞底（z=0）与板顶（z=2.70）。
//   单值高度场 heightAt(i,j) 只能返回板顶，于是「穿洞」的路线点全被抬到板顶上 2.70；
//   而「翻越」的路线点在上坡面飘在空中、在下坡面被按回地面（误差正负都有）。
//   所以路线点必须带层号（面 id），不能只带 (x,y) 再查一次高度场。本模块把这两条路线的
//   弧长重采样、法向偏移、以及「按 heightAt 摆放会错多少」全部量出来。
// 差异说明：原片是 3D 等距视角，这里用两刀剖面（i=11 洞心 / i=14 实心板）表达同一个机制；
//   剖面里看不到拱的曲线，拱形（净空 1.80、拱顶以上余量 0.90）以数值给出，不做目测断言。

export const CFG = {
  I: 24, J: 13,
  LEVEL: 0.90,
  SLAB: { i0: 7, i1: 16, j0: 5, j1: 8 }, // 10 × 4 格厚板（j0..j1 含端）
  TUN: { i0: 9, i1: 12 },               // 贯穿洞宽 4 格
  ZTOP: 2.70, ZSPRING: 1.00, ZCROWN: 1.80,
  DOT: 0.13,                            // 点离表面的法向偏移
  SPACING: 0.56,
  SEC: { A: 11, B: 14 },                // 两道剖切位置（i）
};

export function inSlab(i, j) {
  return i >= CFG.SLAB.i0 && i <= CFG.SLAB.i1 && j >= CFG.SLAB.j0 && j <= CFG.SLAB.j1;
}
export function inTunnel(i, j) {
  return i >= CFG.TUN.i0 && i <= CFG.TUN.i1 && inSlab(i, j);
}
/** 单值高度场：板顶。洞内的格同样返回 2.70 —— 这就是隐形的那个错误的来源。 */
export function heightAt(i, j) {
  return inSlab(i, j) ? CFG.ZTOP : 0;
}
/** 拱形正立面曲线（连续 x）：三段式半椭圆，起拱 1.00、洞心 1.80 */
export function archHead(x) {
  const xc = (CFG.TUN.i0 + CFG.TUN.i1 + 1) / 2;   // 11
  const hw = (CFG.TUN.i1 - CFG.TUN.i0 + 1) / 2;   // 2
  const u = (x - xc) / hw;
  if (Math.abs(u) >= 1) return CFG.ZSPRING;
  return CFG.ZSPRING + (CFG.ZCROWN - CFG.ZSPRING) * Math.sqrt(1 - u * u);
}

/** 所有可行走面（同一平面格可以有多条） */
export function surfaces() {
  const out = [];
  for (let i = 0; i < CFG.I; i++) for (let j = 0; j < CFG.J; j++) {
    if (inSlab(i, j)) {
      out.push({ i, j, z: CFG.ZTOP, kind: inTunnel(i, j) ? 'deck' : 'rockTop' });
      if (inTunnel(i, j)) out.push({ i, j, z: 0, kind: 'tunnelFloor' });
    } else out.push({ i, j, z: 0, kind: 'ground' });
  }
  return out;
}

// 剖面坐标 = [j, z]；n = 该段所在面的法向（把点推离实体）
export function routeThrough() {
  return [{ a: [3, 0], b: [11, 0], n: [0, 1], kind: 'tunnelFloor', i: CFG.SEC.A }];
}
export function routeOver() {
  const Z = CFG.ZTOP, j0 = CFG.SLAB.j0, j1 = CFG.SLAB.j1 + 1;
  return [
    { a: [3, 0], b: [j0, 0], n: [0, 1], kind: 'ground', i: CFG.SEC.B },
    { a: [j0, 0], b: [j0, Z], n: [-1, 0], kind: 'face', i: CFG.SEC.B },
    { a: [j0, Z], b: [j1, Z], n: [0, 1], kind: 'rockTop', i: CFG.SEC.B },
    { a: [j1, Z], b: [j1, 0], n: [1, 0], kind: 'face', i: CFG.SEC.B },
    { a: [j1, 0], b: [11, 0], n: [0, 1], kind: 'ground', i: CFG.SEC.B },
  ];
}

/** 按面弧长等距重采样，并记录「按 heightAt 摆放」会错多少 */
export function resample(segs, spacing = CFG.SPACING, start = CFG.SPACING / 2) {
  const lens = segs.map((s) => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]));
  const cum = [0];
  for (let k = 0; k < lens.length; k++) cum.push(cum[k] + lens[k]);
  const total = cum[cum.length - 1];
  const dots = [];
  for (let s = start; s <= total + 1e-9; s += spacing) {
    let k = 0;
    while (k < lens.length - 1 && s > cum[k + 1] + 1e-9) k++;
    const t = lens[k] > 1e-9 ? (s - cum[k]) / lens[k] : 0;
    const seg = segs[k];
    const jz = seg.a[0] + (seg.b[0] - seg.a[0]) * t;
    const z = seg.a[1] + (seg.b[1] - seg.a[1]) * t;
    const naive = heightAt(seg.i, Math.floor(jz));
    dots.push({
      s, jz, z, i: seg.i, on: seg.kind,
      pj: jz + seg.n[0] * CFG.DOT, pz: z + seg.n[1] * CFG.DOT,
      naive, err: naive - z,
    });
  }
  const vert = dots.filter((d) => d.on === 'face');
  const planLen = segs.reduce((acc, s) => acc + Math.abs(s.b[0] - s.a[0]), 0);
  return {
    total, planLen, dots, vert,
    ratio: total / planLen,
    missed: dots.filter((d) => Math.abs(d.err) > 0.15).length,
    maxErr: dots.reduce((m, d) => Math.max(m, Math.abs(d.err)), 0),
    maxUp: dots.reduce((m, d) => Math.max(m, d.err), -9),
    maxDown: dots.reduce((m, d) => Math.min(m, d.err), 9),
    vertLen: vert.length * CFG.SPACING,
  };
}

export function measure() {
  const S = surfaces();
  const A = resample(routeThrough());
  const B = resample(routeOver());
  let doubleCells = 0;
  for (let i = 0; i < CFG.I; i++) for (let j = 0; j < CFG.J; j++) if (inTunnel(i, j)) doubleCells++;
  const slabCells = (CFG.SLAB.i1 - CFG.SLAB.i0 + 1) * (CFG.SLAB.j1 - CFG.SLAB.j0 + 1);
  return {
    cells: CFG.I * CFG.J, surfaces: S.length, slabCells, doubleCells,
    deck: slabCells, tunFloor: doubleCells,
    band: CFG.ZTOP - CFG.ZCROWN,                 // 拱顶以上余量
    clearLevels: CFG.ZCROWN / CFG.LEVEL,         // 净空折合几层
    archSpan: CFG.TUN.i1 - CFG.TUN.i0 + 1,
    thick: CFG.SLAB.j1 - CFG.SLAB.j0 + 1,
    inTunnelDots: A.dots.filter((d) => inTunnel(d.i, Math.floor(d.jz))).length,
    A, B,
  };
}
