// 裁判案例：填洼（Priority-Flood）。原版 REACode/src/depfill.js ↔ 重构版 core/depression-fill.js
// 适配：把原版的 N×N 方格高度场翻译成重构版的「格 + 邻接表」。出界邻居记 -1（两边都把地图边当出口）。
const NB8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]], NB4 = NB8.slice(0, 4);
const toCells = (N, nb) => Array.from({ length: N * N }, (_, id) => {
  const x = id % N, y = (id - x) / N;
  return { id, edgeNeighbors: nb.map(([dx, dy]) => { const xx = x + dx, yy = y + dy; return xx < 0 || yy < 0 || xx >= N || yy >= N ? -1 : yy * N + xx; }) };
});

export default {
  id: 'depfill', line: 'terrain', clip: '1447488323845509121',
  original: 'src/depfill.js', refactored: 'src/core/depression-fill.js',
  claim: '侵蚀后的地形没有局部极小：每个洼地填成湖，所有陆地格都能排到海',
  seeds: Array.from({ length: 24 }, (_, i) => i + 1),
  // 事先声明的、有意为之的差异。裁判不把它们算作不一致，但每条都必须有对应的度量证明它只影响声明的范围。
  declared: [
    '重构版把整数溢出面 filled 和带微坡的排水面 surface 分开存；原版只有一张带累计微坡的 F。比较时 filled 对 F 用 EPS×路径长的容差。',
    '重构版要求高度 ≥ 0，适配器把原版水下格钳到 0（两边都把 ≤0 当出口，结果不受影响）。',
    '重构版按边邻接（方格上是 4 邻），原版是 8 邻。「同图」一栏用 8 邻比算法本身；「原生邻接」一栏用 4 邻量出拓扑差异有多大。',
  ],
  run(seed, { orig, ref }) {
    const { H } = orig.heights(seed), N = H.length, EPS = orig.CFG.EPS, flat = Float64Array.from(H.flat(), (v) => Math.max(0, v));
    const F = orig.priorityFlood(H), Ff = F.flat();
    const oLift = orig.liftStats(H, F), oMin = orig.localMinima(F).length, oDrain = orig.drained(F), oLakes = orig.lakeClusters(H, F);
    const side = (nb) => {
      const cells = toCells(N, nb), fill = ref.depressionFill(cells, flat, { microSlope: EPS });
      let maxDiff = 0, raisedBoth = 0, raisedOnlyO = 0, raisedOnlyR = 0;
      for (let i = 0; i < flat.length; i++) {
        const o = Ff[i] - flat[i] > EPS * 4 && flat[i] > 0, r = fill.filled[i] > flat[i];
        if (o && r) raisedBoth++; else if (o) raisedOnlyO++; else if (r) raisedOnlyR++;
        if (flat[i] > 0) maxDiff = Math.max(maxDiff, Math.abs(Ff[i] - fill.filled[i]));
      }
      const lakes = ref.lakeClusters(cells, flat, fill).lakes, drain = ref.drainedCells(cells, fill.surface);
      return { maxDiff, raisedBoth, raisedOnlyO, raisedOnlyR, lakeCells: lakes.reduce((a, l) => a + l.area, 0), maxDepth: Math.max(0, ...lakes.map((l) => l.depth)),
        minimaAfter: ref.localMinima(cells, fill.surface).length, drainShare: drain.share };
    };
    const same = side(NB8), native = side(NB4), tol = EPS * N * N;
    return {
      // 「同图」：算法本身必须一致
      metrics: {
        '抬升格集合差（只在一边被抬的格数）': { orig: 0, ref: same.raisedOnlyO + same.raisedOnlyR, tol: 0 },
        '填后高度最大差': { orig: 0, ref: same.maxDiff, tol },
        '湖格数': { orig: oLift.lake, ref: same.lakeCells, tol: 0 },
        '最大湖深': { orig: oLakes.length ? Math.max(...oLakes.map((l) => l.deep)) : 0, ref: same.maxDepth, tol },
        '填后局部极小数': { orig: oMin, ref: same.minimaAfter, tol: 0 },
        '填后排水率': { orig: oDrain.pct / 100, ref: same.drainShare, tol: 1e-9 },
      },
      // 「原生邻接」：声明过的拓扑差异，只记录不判负
      observed: { '4 邻接下湖格数': native.lakeCells, '8 邻接下湖格数': same.lakeCells, '4 邻接下只在重构版被抬的格': native.raisedOnlyR, '4 邻接下排水率': native.drainShare },
    };
  },
};
