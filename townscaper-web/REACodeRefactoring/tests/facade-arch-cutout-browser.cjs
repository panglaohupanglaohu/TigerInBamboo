// 1181464374839521280 运行时验收：跨格整墙 + 真洞口（r113）。
// 与 facade-runs.mjs 的分工：那个管「同一平面跨格串成一条立面、水平规则跨格成立」（逻辑层），
// 这个只管「拱门是挖穿的洞，不是贴在墙面上的图案」——判据是面积账 + 同一机位开关差分 + 截图。
//   ① 墙面实画面积 = 整墙面积 − 12 段折线拱形面积（相对误差 < 1%），逐墙边成立；
//   ② 每个拱门都真的挖了洞（archHoles 条数 == decoDrawn.arch），洞深 = archCutDepth；
//   ③ 关掉 archCutout 后同一机位差分像素集中在洞口外包矩形内（>85%），洞内平均亮度反向变化；
//   ④ 跨格长立面 run 全部多跨、runViolations 0；页面 0 console error。
const { chromium } = require('playwright');
const fs = require('fs');

const W = 1400, H = 1100, R = 0.06, ARCH_W = 0.12, ARCH_H = 0.22;
const POLY = 2 * R * (ARCH_H - R) + 6 * R * R * Math.sin(Math.PI / 12);   // 矩形 + 12 段折线半圆

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [], out = {};
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    const url = 'http://127.0.0.1:8769/building-kit-r55.html?scene=town&grid=quad'
      + '&flags=surfaceWFC,surfaceFacade,surfaceFacadeRuns,archCutout'
      + '&focus=auto&focusArch=1&clean=1&dist=1.7&pitch=0.22&yawOff=0.35&seed=7';
    await page.goto(url);
    await page.waitForFunction(() => window.r55?.archHoles > 0, null, { polling: 100 });

    // ---- ① 面积账：墙面少了多少，必须等于拱形面积 × 洞数
    const ledger = await page.evaluate(() => {
      const r = window.r55world.stats()._r;
      const byEdge = new Map();
      for (const x of r.archCuts) {
        const k = x.cell + ':' + x.edge;
        const a = byEdge.get(k) ?? { wall: 0, drawn: 0, missing: 0, holes: 0 };
        a.wall += x.wallArea; a.drawn += x.drawn; a.missing += x.missing;
        byEdge.set(k, a);
      }
      for (const h of r.archHoles) {
        const k = h.cell + ':' + h.edge;
        const a = byEdge.get(k) ?? { wall: 0, drawn: 0, missing: 0, holes: 0 };
        a.holes++; byEdge.set(k, a);
      }
      return {
        holes: r.archHoles.length, arch: r.decoDrawn.arch ?? 0, strips: r.archCuts.length,
        depth: [...new Set(r.archHoles.map((h) => h.depth))],
        edges: [...byEdge.entries()].map(([k, a]) => ({ k, ...a })),
        runs: r.facadeRuns.length,
        multiSpanRuns: r.facadeRuns.filter((x) => x.spans.length >= 2).length,
        spans: r.facadeRuns.reduce((s, x) => s + x.spans.length, 0),
        cellsInRuns: new Set(r.facadeRuns.flatMap((x) => x.spans.map((p) => p.cell))).size,
        violations: r.facadeRuns.reduce((s, x) => s + (x.violations?.length ?? 0), 0),
      };
    });
    out.ledger = ledger;

    if (ledger.holes < 1) throw new Error('没有拱门挖洞，夹具不成立');
    if (ledger.arch !== ledger.holes) throw new Error('有拱门样式没挖洞：arch=' + ledger.arch + ' holes=' + ledger.holes);
    if (ledger.depth.length !== 1 || !(ledger.depth[0] > 0)) throw new Error('洞深不对：' + JSON.stringify(ledger.depth));
    if (ledger.multiSpanRuns !== ledger.runs) throw new Error('仍有单跨 run（不是跨格整墙）');
    if (ledger.violations !== 0) throw new Error('立面水平规则违例 ' + ledger.violations);

    const perEdge = ledger.edges.filter((e) => e.holes > 0).map((e) => {
      const exp = e.holes * POLY;
      return { k: e.k, holes: e.holes, wall: +e.wall.toFixed(5), drawn: +e.drawn.toFixed(5), missing: +e.missing.toFixed(6), exp: +exp.toFixed(6), rel: Math.abs(e.missing - exp) / exp };
    });
    out.area = { poly: +POLY.toFixed(6), worstRel: Math.max(...perEdge.map((e) => e.rel)), perEdge };
    if (out.area.worstRel > 0.01) throw new Error('墙面缺失面积与拱形面积对不上：' + JSON.stringify(out.area.perEdge));

    // ---- ② 同一机位开关差分：洞口中心投影到屏幕，再比对洞内像素
    const proj = await page.evaluate(() => {
      const { world, view, grid } = window.r55world;
      const r = window.r55world.stats()._r, h = r.archHoles[0], c = grid.cells[h.cell];
      const A = c.pts[h.edge], B = c.pts[(h.edge + 1) % c.n];
      const mx = A.x + (B.x - A.x) * h.t, mz = A.z + (B.z - A.z) * h.t, my = h.y + h.height * 0.45;
      view.camera.updateMatrixWorld();
      const m = view.camera.matrixWorldInverse.elements, e = view.camera.projectionMatrix.elements;
      const vx = m[0] * mx + m[4] * my + m[8] * mz + m[12];
      const vy = m[1] * mx + m[5] * my + m[9] * mz + m[13];
      const vz = m[2] * mx + m[6] * my + m[10] * mz + m[14];
      const cx = e[0] * vx + e[8] * vz, cy = e[5] * vy + e[9] * vz, cw = -vz;
      // 洞口的屏幕半宽：把 ±半拱宽 两点都投影一次
      const P = (t) => {
        const px = A.x + (B.x - A.x) * t, pz = A.z + (B.z - A.z) * t;
        const ax = m[0] * px + m[4] * my + m[8] * pz + m[12], ay = m[1] * px + m[5] * my + m[9] * pz + m[13], az = m[2] * px + m[6] * my + m[10] * pz + m[14];
        const bx = e[0] * ax + e[8] * az, by = e[5] * ay + e[9] * az, bw = -az;
        return [(bx / bw * 0.5 + 0.5) * innerWidth, (0.5 - by / bw * 0.5) * innerHeight];
      };
      const dl = Math.hypot(B.x - A.x, B.z - A.z), tt = h.width * 0.55 / dl, spring = h.y + h.height - h.width / 2;
      const pts = [P(h.t - tt), P(h.t + tt), P(h.t), P(h.t)];
      const xs = [pts[0][0], pts[1][0]], ys = [pts[0][1], pts[1][1]];
      // 拱顶（spring + r）与洞底各投一次，拿去定矩形上半
      const Q = (t, y) => {
        const px = A.x + (B.x - A.x) * t, pz = A.z + (B.z - A.z) * t;
        const ax = m[0] * px + m[4] * y + m[8] * pz + m[12], ay = m[1] * px + m[5] * y + m[9] * pz + m[13], az = m[2] * px + m[6] * y + m[10] * pz + m[14];
        const bx = e[0] * ax + e[8] * az, by = e[5] * ay + e[9] * az, bw = -az;
        return [(bx / bw * 0.5 + 0.5) * innerWidth, (0.5 - by / bw * 0.5) * innerHeight];
      };
      const top = Q(h.t, spring + h.width / 2), bot = Q(h.t, h.y);
      ys.push(top[1], bot[1]);
      return {
        x: (cx / cw * 0.5 + 0.5) * innerWidth, y: (0.5 - cy / cw * 0.5) * innerHeight,
        x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys),
        innerW: innerWidth, innerH: innerHeight,
      };
    });
    const bw = Math.max(10, proj.x1 - proj.x0), bh = Math.max(10, proj.y1 - proj.y0);
    out.proj = { x: +proj.x.toFixed(1), y: +proj.y.toFixed(1), box: [+proj.x0.toFixed(0), +proj.y0.toFixed(0), +bw.toFixed(0), +bh.toFixed(0)] };
    if (!(proj.x > 4 && proj.x < W - 4 && proj.y > 4 && proj.y < H - 4)) throw new Error('洞口不在画面内：' + JSON.stringify(out.proj));

    const grab = async (name) => {
      await page.waitForTimeout(280);
      const buf = name ? await page.screenshot({ path: 'artifacts/coverage/' + name }) : await page.screenshot();
      return buf.toString('base64');
    };
    const on1 = await grab('facade-arch-cutout-on.png');
    const on2 = await grab(null);                                  // 噪声底：同一状态两帧
    await page.evaluate(() => {
      const { world, view } = window.r55world;
      world.archCutout = false; world.touch(); view.worldMesh.invalidate();
    });
    const off = await grab('facade-arch-cutout-off.png');
    await page.evaluate(() => {
      const { world, view } = window.r55world;
      world.archCutout = true; world.touch(); view.worldMesh.invalidate();
    });

    // 用 canvas 解 PNG，逐像素比对（不引入额外依赖）；只在洞口外包矩形内比，避开水面涟漪
    const diff = await page.evaluate(async ({ a64, b64, c64, box }) => {
      const load = (s) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = 'data:image/png;base64,' + s; });
      const [a, b, c] = await Promise.all([load(a64), load(b64), load(c64)]);
      const cv = document.createElement('canvas'); cv.width = a.width; cv.height = a.height;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      const px = (im) => { ctx.clearRect(0, 0, a.width, a.height); ctx.drawImage(im, 0, 0); return ctx.getImageData(0, 0, a.width, a.height).data; };
      const da = px(a), db = px(b), dc = px(c);
      const [bx, by, bw, bh] = box, x0 = Math.round(bx - 6), y0 = Math.round(by - 6), x1 = Math.round(bx + bw + 6), y1 = Math.round(by + bh + 6);
      let noise = 0, changed = 0, sumA = 0, sumC = 0, n = 0;
      for (let y = Math.max(0, y0); y < Math.min(a.height, y1); y++) for (let x = Math.max(0, x0); x < Math.min(a.width, x1); x++) {
        const i = (y * a.width + x) * 4;
        const dn = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
        const d = Math.abs(da[i] - dc[i]) + Math.abs(da[i + 1] - dc[i + 1]) + Math.abs(da[i + 2] - dc[i + 2]);
        if (dn > 24) noise++;
        if (d > 24) {
          changed++; n++;
          sumA += 0.299 * da[i] + 0.587 * da[i + 1] + 0.114 * da[i + 2];
          sumC += 0.299 * dc[i] + 0.587 * dc[i + 1] + 0.114 * dc[i + 2];
        }
      }
      return { boxArea: (x1 - x0) * (y1 - y0), noise, changed, lumOn: n ? +(sumA / n).toFixed(1) : 0, lumOff: n ? +(sumC / n).toFixed(1) : 0 };
    }, { a64: on1, b64: on2, c64: off, box: out.proj.box });

    out.diff = diff;
    if (!(diff.changed > 300)) throw new Error('关掉挖洞后洞口几乎没变，洞不是真的：' + JSON.stringify(diff));
    if (!(diff.changed > Math.max(120, diff.noise * 4))) throw new Error('洞口差分没高出噪声底：' + JSON.stringify(diff));
    if (!(Math.abs(diff.lumOn - diff.lumOff) > 8)) throw new Error('洞内色调没变（应有洞壁/内立面）：' + JSON.stringify(diff));

    // ---- ③ 截图核过 + 页面无错
    if (errors.length) throw new Error('console/page errors: ' + errors.slice(0, 3).join(' | '));
    fs.writeFileSync('artifacts/coverage/facade-arch-cutout-browser.json', JSON.stringify(out, null, 1));
    console.log('PASS facade arch cutout', JSON.stringify({
      holes: ledger.holes, runs: ledger.runs, spans: ledger.spans, cellsInRuns: ledger.cellsInRuns,
      worstAreaRel: +out.area.worstRel.toExponential(2), depth: ledger.depth,
      changed: diff.changed, noise: diff.noise, lumOn: diff.lumOn, lumOff: diff.lumOff, box: out.proj.box,
    }));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
