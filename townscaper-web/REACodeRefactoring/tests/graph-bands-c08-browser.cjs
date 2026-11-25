// 第 125 轮 · [041]：`1490068909042642944`「Late night cryptic graph tweet」的运行验收。
// 该片 note 从 r56 起挂着三条「仍缺」：节点半径其余语义 / 颜色到底是根分支还是连通分量 / 极坐标刻度未复刻。
// 本测不读日志，直接在页面上量三件事：
//   ① 页面读数与模块真值逐项对账（同一份 grid.js 邻接，独立重算 nodes/edges/spokes/bridges/regions/layers）；
//   ② 颜色到底跟半径走还是跟角度走 —— 从画布像素里按色相分桶，量「角向覆盖扇区数」与「径向 p90−p10」：
//      颜色=环带 ⇒ 同一色相铺满整圈、径向只占一条窄带；颜色=分支扇区 ⇒ 角向只覆盖一小段、径向贯穿全部环；
//   ③ 0200–0299 那段「从中心向外搜索」的前沿是否是逐层推进（黄→红），以及极坐标参考网（12 放射线 + 72 刻度）在不在。
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'http://localhost:8769';

// 画布像素 → 色相分桶 → 极坐标统计（页面里跑，避免把整张图搬出来）
const MEASURE = ({ ox, oy, hues, dpr }) => {
  const cv = document.getElementById('c');
  const g = cv.getContext('2d'), d = g.getImageData(0, 0, cv.width, cv.height).data;
  const P = hues.map((hex) => { const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), dd = mx - mn;
    let h = 0; if (dd) { if (mx === r) h = 60 * (((gg - b) / dd) % 6); else if (mx === gg) h = 60 * ((b - r) / dd + 2); else h = 60 * ((r - gg) / dd + 4); }
    return (h + 360) % 360; });
  const buckets = P.map(() => ({ n: 0, rs: [], sec: new Set() }));
  let ink = 0;
  for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
    const i = (y * cv.width + x) * 4, r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), s = mx ? (mx - mn) / mx : 0;
    if (s < 0.35 || mx < 0.42) continue;
    ink++;
    const dd = mx - mn; let h = 0;
    if (dd) { if (mx === r) h = 60 * (((gg - b) / dd) % 6); else if (mx === gg) h = 60 * ((b - r) / dd + 2); else h = 60 * ((r - gg) / dd + 4); }
    h = (h + 360) % 360;
    let best = -1, bd = 21; // 桶宽 ±21°：六色调色板互距 ≥ 35°
    for (let k = 0; k < P.length; k++) { let e = Math.abs(h - P[k]); e = Math.min(e, 360 - e); if (e < bd) { bd = e; best = k; } }
    if (best < 0) continue;
    const px = x / dpr - ox, py = y / dpr - oy, rr = Math.hypot(px, py), a = (Math.atan2(py, px) * 180 / Math.PI + 360) % 360;
    buckets[best].n++; buckets[best].rs.push(rr); buckets[best].sec.add(Math.floor(a / 10));
  }
  const q = (a, f) => a.length ? a[Math.min(a.length - 1, Math.floor(a.length * f))] : null;
  return { ink, total: cv.width * cv.height, buckets: buckets.map((b) => { const rs = b.rs.sort((x, y) => x - y); return { n: b.n, p10: q(rs, .1), p50: q(rs, .5), p90: q(rs, .9), sectors: b.sec.size }; }) };
};

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  const errors = [];
  page.setDefaultTimeout(45000);
  page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR', e.message); });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const report = {};

  try {
    // ---- A) 定稿态（?t=2.3 让 t 参数存在 → playing=false，画面冻结，同状态两帧噪声为 0）
    await page.goto(`${BASE}/graph-bands-c08.html?t=2.3`);
    await page.waitForFunction(() => window.graphBandsC08 && window.graphBandsC08.nodes > 0);
    const st = await page.evaluate(() => window.graphBandsC08);
    report.final = st;

    const measure = await page.evaluate(MEASURE, { ox: st.geom.ox, oy: st.geom.oy, hues: st.hues, dpr: 1 });
    report.measure = measure;

    // ① 与模块真值对账（不认页面自报，独立重算一遍）
    const mod = await import(pathToFileURL(path.join(ROOT, 'src/core/graph-bands-c08.js')).href);
    const G = mod.bandedGraph();
    const portalSet = new Set(G.spokeEdges.map(([a, b]) => (a < b ? a + ',' + b : b + ',' + a)));
    const R = mod.twoEdgeComponents(G.ids, G.nb, portalSet);
    const B = mod.findBridges(G.ids, G.nb);
    const L = mod.bfsLayers(G.ids, G.nb, G.center);
    const edgeCount = G.ids.reduce((s, v) => s + G.nb(v).length, 0) / 2;
    assert.equal(st.nodes, G.ids.length, `页面节点数 ${st.nodes} = 模块 ${G.ids.length}`);
    assert.equal(st.edges, edgeCount, `页面边数 ${st.edges} = 模块 ${edgeCount}`);
    assert.equal(st.spokes, G.spokeEdges.length, '带间辐条 + 外伸悬挂');
    assert.equal(st.bridges, B.size, `Tarjan 桥 ${st.bridges} = 模块 ${B.size}`);
    assert.deepEqual(st.regions, R.sizes, '切辐条后的区域大小');
    assert.equal(st.layers, L.layers.length - 1, 'BFS 层数');
    assert.equal(G.ids.length, 462, '共享混合网格上的节点数');
    assert.equal(G.spokeEdges.length, 16, '3 个带间 × 4 方向 + 4 个外伸悬挂');
    assert.deepEqual(R.sizes.slice(0, 4), [180, 154, 101, 23], '4 条环带的规模（由外到内）');
    assert.deepEqual(R.sizes.slice(4), [1, 1, 1, 1], '4 个外伸悬挂点各自独立');
    // 每条环带 = 一个区域（区域→带 是单值映射），且带均半径按序递增
    assert.equal(st.regionBands.slice(0, 4).filter((b) => b >= 0).length, 4, '四个大区域各自对应一条环带');
    const means = st.bandMeans.map((b) => b.mean);
    assert.equal(means.length, 5, '四条环带 + 一条外伸悬挂'); // 悬挂点被记成第 5 带，只作外圈尖角
    for (let i = 1; i < 4; i++) assert.ok(means[i] > means[i - 1] + 0.5, `带 ${i} 均半径 ${means[i].toFixed(2)} > 带 ${i - 1} ${means[i - 1].toFixed(2)}`);
    assert.ok(means[4] > means[3], '外伸悬挂在最外');
    // 辐条：外伸悬挂是真桥（单边），带间辐条彼此并行 → 不是真桥（删一根不断开）
    let pendantBridges = 0, interBand = 0;
    for (const [a, b] of G.spokeEdges) {
      const k = a < b ? a + ',' + b : b + ',' + a;
      if (a < 0 || b < 0) { assert.ok(B.has(k), '外伸悬挂是单边桥'); pendantBridges++; } else { assert.ok(!B.has(k), '带间辐条并行，不构成桥'); interBand++; }
    }
    assert.equal(pendantBridges, 4); assert.equal(interBand, 12);

    // ② 颜色随半径、不随角度
    const HUES = st.hues; // ['#4fd1c5' 青, '#5a6ee8' 蓝, '#d24fb8' 品红, '#e8b84a' 黄, '#8fe36a' 绿, '#5ab0ff' 浅蓝]
    const idx = { teal: 0, blue: 1, magenta: 2, yellow: 3, green: 4 };
    const Rp = st.geom.R * st.geom.sc; // 图半径（像素）
    const b1 = measure.buckets[idx.blue], b2 = measure.buckets[idx.magenta], b0 = measure.buckets[idx.teal];
    for (const [name, b] of [['青', b0], ['蓝', b1], ['品红', b2]]) {
      assert.ok(b.n > 200, `${name}色像素足够量（${b.n}）`);
      assert.ok(b.sectors >= 25, `${name}色铺开 ≥25/36 个 10° 扇区（${b.sectors}）→ 不是扇区上色`);
      assert.ok(b.p90 - b.p10 < 0.42 * Rp, `${name}色径向只占一条窄带（p10 ${b.p10?.toFixed(0)} … p90 ${b.p90?.toFixed(0)}，图半径 ${Rp.toFixed(0)}px）`);
    }
    // 蓝带（内第二条）与品红带（第三条）的径向量程必须分开，且蓝在内
    assert.ok(b1.p50 < b2.p50, `蓝带 p50 ${b1.p50.toFixed(0)} 在品红带 ${b2.p50.toFixed(0)} 之内`);
    assert.ok(b2.p10 > b1.p90 - 12, '两条带径向量程不交叠（换色就换半径）');
    // 与视频终帧同一口径（视频：按半径 27.6% vs 按角度 18.6%，见证据 md）—— 页面这边由上面的 sectors/径向窄带两条钉住
    assert.equal(measure.ink / measure.total > 0.004, true, `画面有墨（${measure.ink}px）`);

    await page.screenshot({ path: 'artifacts/coverage/graph-bands-c08-final.png' });

    // ---- B) 搜索态：从中心逐层外扩（黄/红前沿），与定稿态做 A/B
    await page.goto(`${BASE}/graph-bands-c08.html?t=0.45`);
    await page.waitForFunction(() => window.graphBandsC08 && window.graphBandsC08.searchK >= 0);
    const search = await page.evaluate(() => window.graphBandsC08);
    const mSearch = await page.evaluate(MEASURE, { ox: search.geom.ox, oy: search.geom.oy, hues: search.hues, dpr: 1 });
    report.search = { searchK: search.searchK, layers: search.layers, measure: mSearch };
    assert.ok(search.searchK > 0 && search.searchK < search.layers, `搜索进行中 ${search.searchK}/${search.layers} 层`);
    assert.ok(search.searchK < st.searchK, `定稿态 ${st.searchK} 层 > 搜索态 ${search.searchK} 层`);
    await page.screenshot({ path: 'artifacts/coverage/graph-bands-c08-search.png' });
    // 搜索态里前沿色（红 #ff5a4a / 黄 #ffe45a）不在调色板内 → 用色相范围直接量
    const warm = await page.evaluate(() => {
      const cv = document.getElementById('c'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let red = 0, yellow = 0, cold = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        if (!mx || (mx - mn) / mx < 0.35 || mx < 0.42) continue;
        const dd = mx - mn; let h = 0;
        if (mx === r) h = 60 * (((g - b) / dd) % 6); else if (mx === g) h = 60 * ((b - r) / dd + 2); else h = 60 * ((r - g) / dd + 4);
        h = (h + 360) % 360;
        if (h < 14 || h > 350) red++; else if (h >= 45 && h <= 62) yellow++; else cold++;
      }
      return { red, yellow, cold };
    });
    report.warm = warm;
    assert.ok(warm.red > 40, `搜索前沿红边 ${warm.red}px`);
    assert.ok(warm.yellow > 40, `前一圈黄边 ${warm.yellow}px`);

    // ---- C) 极坐标参考网 + 换种子（结构不是画死的一张图）
    assert.equal(st.radialLines, 12, '12 条放射线');
    assert.equal(st.ticks, 72, '72 个外圈刻度（每 30° 一个长刻度）');
    assert.ok(st.geom.R > 5, `图半径 ${st.geom.R}`);
    await page.goto(`${BASE}/graph-bands-c08.html?t=2.3&seed=7`);
    await page.waitForFunction(() => window.graphBandsC08 && window.graphBandsC08.nodes > 0);
    const s7 = await page.evaluate(() => window.graphBandsC08);
    report.seed7 = { nodes: s7.nodes, regions: s7.regions, bands: s7.bandMeans.length };
    assert.ok(s7.nodes !== st.nodes, `换种子后节点数变化 ${st.nodes} → ${s7.nodes}`);
    assert.equal(s7.bandMeans.length, 5, '换种子仍是四条环带 + 悬挂');

    assert.deepEqual(errors, [], `console/page error: ${errors.join(' | ')}`);
    fs.writeFileSync(path.join(ROOT, 'artifacts/coverage/graph-bands-c08-browser.json'), JSON.stringify(report, null, 1));
    console.log(JSON.stringify({
      nodes: st.nodes, edges: st.edges, spokes: st.spokes, bridges: st.bridges, regions: st.regions, layers: st.layers,
      bandMeans: st.bandMeans.map((b) => +b.mean.toFixed(2)),
      hueBuckets: { teal: measure.buckets[0], blue: measure.buckets[1], magenta: measure.buckets[2] },
      searchK: search.searchK, warm, seed7: report.seed7,
    }, null, 1));
    console.log('PASS graph-bands-c08-browser');
  } finally { await browser.close(); }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
