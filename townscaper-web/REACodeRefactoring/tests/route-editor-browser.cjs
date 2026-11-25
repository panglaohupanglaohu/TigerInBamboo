/**
 * route-editor-browser.cjs — 810157485638189056 的**运行验收**（不是只读代码）。
 *
 * 片子里能看见的三件事，逐条在真页面上量：
 *   1. 拖检查点 → 整条点串重采样（点数 / 总长都跟着变，且仍不埋进岩体）
 *   2. 棕色块顶面有三角剖分对角线（页面画出 N 段，且随 tri 开关归零）
 *   3. 累积轨迹只增不减（spill 三次，点数单调不减）
 * 另外必须用**真鼠标**拖一次，证明拖拽是页面里的交互而不是 API 造的。
 */
const { chromium } = require('playwright');
const fs = require('fs');

const OUT = 'artifacts/coverage/route-editor-grid.png';
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails++; };

(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [];
  try {
    const p = await b.newPage({ viewport: { width: 1120, height: 980 } });
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto('http://127.0.0.1:8769/route-preview.html', { waitUntil: 'load' });
    await p.waitForFunction(() => window.routeEditor?.ready === true, null, { polling: 100 });
    await p.waitForTimeout(900);

    // 基线
    const base = await p.evaluate(async () => {
      const ed = window.routeEditor;
      const raf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      ed.reset();
      ed.set({ radius: 0.35, spacing: 0.16, acc: false, tri: true, ink: true });
      await raf();
      const s = ed.stats;
      const c = document.querySelector('#right'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let dark = 0, light = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 128 && d[i] < 60 && d[i + 1] < 60 && d[i + 2] < 60) dark++;
        if (d[i + 3] > 128 && d[i] > 228 && d[i + 1] > 228 && d[i + 2] > 228) light++;
      }
      return { count: s.count, len: s.lengthRight, buried: s.buriedRight, hops: s.hops, node: ed.node(1), tri: ed.triStats('a'), dark, light };
    });
    ok(base.count > 20, `基线采样点数 ${base.count}`);
    ok(base.buried === 0, `基线埋点 ${base.buried}（应为 0）`);
    ok(base.tri.segments === 12, `剖分线 ${base.tri.segments} 段 / ${base.tri.quads} 块`);
    ok(base.tri.a === 12, 'a 档 12 段全取 (x0,z0)-(x1,z1)');
    ok(base.dark > 500, `ink 档黑点像素 ${base.dark}（片子里点串是黑的）`);
    ok(base.light > 0, `彩色/浅色像素 ${base.light}（画布不是空的）`);

    // 1. API 拖检查点 → 重采样
    const dragged = await p.evaluate(() => {
      const ed = window.routeEditor;
      const before = { len: ed.stats.lengthRight, count: ed.stats.count, n: ed.node(1) };
      const after = ed.drag(1, 0.4, 1.8);
      return { before, after: { len: after.lengthRight, count: after.count, buried: after.buriedRight, n: after.nodes[1] } };
    });
    ok(Math.abs(dragged.after.len - dragged.before.len) > 0.3,
      `拖检查点后总长 ${dragged.before.len.toFixed(2)} → ${dragged.after.len.toFixed(2)}`);
    ok(dragged.after.buried === 0, `拖完埋点 ${dragged.after.buried}`);
    ok(Math.abs(dragged.after.n[2] - dragged.before.n[2]) > 1.5, '检查点 z 真的动了');

    // 2. 真鼠标拖：抓到 handle 的屏幕坐标，拖动 46/-16 像素
    await p.evaluate(() => document.querySelector('#right').scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(120);
    const hp = await p.evaluate(() => {
      const r = document.querySelector('#right').getBoundingClientRect();
      const h = window.routeEditor.handles()[1];
      return { x: r.left + h[0] * (r.width / document.querySelector('#right').width), y: r.top + h[1] * (r.height / document.querySelector('#right').height), n: window.routeEditor.node(1) };
    });
    await p.mouse.move(hp.x, hp.y);
    await p.mouse.down();
    await p.mouse.move(hp.x + 30, hp.y - 10, { steps: 6 });
    await p.mouse.move(hp.x + 46, hp.y - 16, { steps: 6 });
    await p.mouse.up();
    await p.waitForTimeout(200);
    const afterMouse = await p.evaluate(() => ({ n: window.routeEditor.node(1), st: window.routeEditor.stats }));
    const movedWorld = Math.hypot(afterMouse.n[0] - hp.n[0], afterMouse.n[2] - hp.n[2]);
    ok(movedWorld > 0.5, `真鼠标拖动后检查点位移 ${movedWorld.toFixed(3)} 世界单位`);
    ok(afterMouse.st.buriedRight === 0, `鼠标拖完埋点 ${afterMouse.st.buriedRight}`);
    ok(afterMouse.st.count > 20, `鼠标拖完仍采出 ${afterMouse.st.count} 点`);

    // 3. 累积轨迹：三次 spill，只增不减
    const acc = await p.evaluate(async () => {
      const ed = window.routeEditor;
      const raf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      ed.set({ acc: false });
      const off = ed.stats.trailCount;
      ed.set({ acc: true });
      await raf();
      const first = ed.stats.trailCount;
      const r = [];
      for (let i = 0; i < 3; i++) {
        ed.drag(1, 0.25, 0.6);
        await raf();
        r.push(ed.spill());
      }
      return { off, first, r, trail: ed.stats.trailCount };
    });
    ok(acc.off === 0, 'accumulate 关档时累积点数为 0');
    ok(acc.first > 20, `开档后第一帧就铺出 ${acc.first} 点`);
    ok(acc.r.every((x, i) => i === 0 || x.trailCount >= acc.r[i - 1].trailCount), '累积点数单调不减 ' + acc.r.map((x) => x.trailCount).join('→'));
    ok(acc.trail >= acc.first, `累积点数 ${acc.first} → ${acc.trail}（只增不减）`);

    // 4. tri 开关真的改变画面（像素差）
    const ink = await p.evaluate(async () => {
      const ed = window.routeEditor, c = document.querySelector('#right'), ctx = c.getContext('2d');
      const snap = () => { const d = ctx.getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; return { s, d: Array.from(d) }; };
      ed.set({ tri: true }); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const on = snap();
      ed.set({ tri: false }); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const off = snap();
      let diff = 0;
      for (let i = 0; i < on.d.length; i += 4) if (Math.abs(on.d[i] - off.d[i]) > 6) diff++;
      ed.set({ tri: true });
      return { diff, onSum: on.s, offSum: off.s };
    });
    ok(ink.diff > 200, `剖分线开/关像素差 ${ink.diff} px`);

    // 5. 页面有正文（不是白屏）
    const hasText = await p.evaluate(() => document.querySelector('#stats').textContent.includes('采样点数'));
    ok(hasText, '读数栏输出采样点数与累积点数');

    // 截图前复位到基线（拖拽用例把检查点拖进过崖体，不该拿那个状态当交付图）
    await p.evaluate(async () => {
      const ed = window.routeEditor;
      ed.reset();
      ed.set({ radius: 0.35, spacing: 0.16, acc: false, tri: true, ink: true });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
    await p.waitForTimeout(220);
    await p.screenshot({ path: OUT, fullPage: false });
    ok(fs.existsSync(OUT) && fs.statSync(OUT).size > 20000, `截图落盘 ${OUT} (${fs.statSync(OUT).size} B)`);
    ok(errors.length === 0, '控制台无错误' + (errors.length ? '：' + errors.slice(0, 3).join(' | ') : ''));
  } finally {
    await b.close();
  }
  console.log(fails === 0 ? 'route-editor-browser: ALL PASS' : `route-editor-browser: ${fails} FAILED`);
  process.exit(fails === 0 ? 0 : 1);
})();
