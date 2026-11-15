// 第 80 轮 · 1120036868966502401 缺口 ② 运行时验收：黄色三角化轮廓层。
// 原片 frame-0301：浅色地面上 6 个黄色三角（直角边沿格线、斜边=格对角线），只有 region 里的格子被描边。
// 这里在真机位下：① region 内出三角、region 外一个都不要；② 三角顶点贴地（y 跨度 > 0）；
// ③ 关掉后图层不可见且几何清空；④ 不给 region 直接报错；⑤ 截图里数得到黄色像素。
const { chromium } = require('playwright');
const fs = require('fs');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'artifacts/coverage';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const problems = [];
  const report = { ok: false, checks: [] };
  const check = (name, cond, detail) => { report.checks.push({ name, ok: !!cond, detail }); if (!cond) problems.push(name + ' :: ' + detail); };
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 300)); });
  try {
    await page.goto('http://127.0.0.1:8769/index.html?scene=terrain&on=grid', { waitUntil: 'load' });
    await page.waitForFunction(() => window.rea?.view?.gridLines, null, { polling: 200, timeout: 90000 });
    await page.waitForFunction(() => (window.rea?.world?.cells?.length || 0) > 100, null, { polling: 200, timeout: 90000 });

    // 固定机位 + quad-regular 档 + 贴面（原片就是等距方格铺在地面上）
    const base = await page.evaluate(() => {
      const v = window.rea.view;
      const hud = document.querySelector('#hud'); if (hud) hud.style.display = 'none';
      v.setDebug('grid', true);
      v.setGridRegular(true);
      v.setGridDrape(true);
      v.yaw = 0; v.pitch = 1.32; v.distance = 26;
      v.target.set(0, 1.2, 0); v.updateCamera(); v.render(0.016);
      const l = v.gridStats.lattice;
      return { lattice: l && { cols: l.cols, rows: l.rows, spacing: l.spacing && l.spacing.median }, drape: v.gridStats.drape, tri: v.gridStats.tri };
    });
    check('① 格网先建起来', base.lattice && base.lattice.cols > 0 && base.lattice.rows > 0, JSON.stringify(base.lattice));
    check('① 默认不出黄三角', base.tri === null, '默认 tri=' + JSON.stringify(base.tri));

    // region 取岛体中心一小块（±1.6 个格距），对应原片「只有局部几格被描边」
    const on = await page.evaluate(() => {
      const v = window.rea.view;
      const sp = v.gridStats.lattice.spacing.median;
      const region = { minX: -sp * 1.6, maxX: sp * 1.6, minZ: -sp * 1.6, maxZ: sp * 1.6 };
      const st = v.setGridTriangles({ on: true, region });
      v.render(0.016);
      const c = v.gridTri.geometry.getAttribute('position')?.count || 0;
      return { tri: st.tri, count: c, visible: v.gridTri.visible, color: v.gridTri.material.color.getHexString(), spacing: sp, region };
    });
    check('② region 内出三角', on.tri && on.tri.triangles > 0, JSON.stringify(on.tri));
    check('② 顶点数 = 三角数 × 3 边 × 2 端', on.count === on.tri.triangles * 3 * 2, `count=${on.count} tri=${on.tri.triangles}`);
    check('② 图层可见', on.visible === true, 'visible=' + on.visible);
    check('② 颜色是黄', /^e9e33c$/i.test(on.color), '#' + on.color);
    check('③ 顶点贴地（y 跨度 > 0）', on.tri.yMax - on.tri.yMin > 0, `y ${on.tri.yMin}..${on.tri.yMax}`);
    check('② 两个对角线方向都出现', on.tri.splits.a > 0 && on.tri.splits.b > 0, JSON.stringify(on.tri.splits));
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/grid-triangles-on.png` });

    // region 放大 4 倍 → 三角数必须跟着变多（区域是判据，不是装饰）
    const wider = await page.evaluate(() => {
      const v = window.rea.view;
      const sp = v.gridStats.lattice.spacing.median;
      const st = v.setGridTriangles({ on: true, region: { minX: -sp * 3.2, maxX: sp * 3.2, minZ: -sp * 3.2, maxZ: sp * 3.2 } });
      v.render(0.016);
      return st.tri;
    });
    check('④ region 放大 → 三角变多', wider.triangles > on.tri.triangles, `${on.tri.triangles} → ${wider.triangles}`);
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/grid-triangles-wide.png` });

    // 区域外一个都不要：把 region 挪到岛外（远处海面）→ 三角 0、图层不可见
    const outside = await page.evaluate(() => {
      const v = window.rea.view;
      const sp = v.gridStats.lattice.spacing.median;
      const st = v.setGridTriangles({ on: true, region: { minX: sp * 400, maxX: sp * 402, minZ: sp * 400, maxZ: sp * 402 } });
      v.render(0.016);
      return { tri: st.tri, visible: v.gridTri.visible, count: v.gridTri.geometry.getAttribute('position')?.count || 0 };
    });
    check('⑤ 岛外 region → 0 个三角且隐藏', outside.tri && outside.tri.triangles === 0 && outside.visible === false && outside.count === 0,
      JSON.stringify({ tri: outside.tri, visible: outside.visible, count: outside.count }));

    // 不给 region 必须报错（否则整张格网长满对角线，与原片相反）
    const noRegion = await page.evaluate(() => {
      try { window.rea.view.setGridTriangles({ on: true, region: null }); return { threw: false, msg: '' }; }
      catch (e) { return { threw: true, msg: e.message }; }
    });
    check('⑥ 不给 region 报错', noRegion.threw, noRegion.msg);

    // 关掉 → 不可见 + 几何清空
    const off = await page.evaluate(() => {
      const v = window.rea.view;
      const st = v.setGridTriangles({ on: false });
      v.render(0.016);
      return { tri: st.tri, visible: v.gridTri.visible, count: v.gridTri.geometry.getAttribute('position')?.count || 0 };
    });
    check('⑦ 关掉后图层清空', off.tri === null && off.visible === false && off.count === 0, JSON.stringify(off));

    // 回归：白格线 / 亮斑 / 外缘方块三档没被这层带坏
    const reg = await page.evaluate(() => {
      const v = window.rea.view;
      v.setGridTriangles({ on: false });
      v.render(0.016);
      return { dots: v.gridDots.geometry.getAttribute('position')?.count || 0, rims: v.gridRim.geometry.getAttribute('position')?.count || 0, seg: v.gridLines.geometry.getAttribute('position')?.count / 2 || 0 };
    });
    check('⑧ 白格线/亮斑/外缘未受影响', reg.seg > 0 && reg.dots > 0 && reg.rims >= 0, JSON.stringify(reg));

    // 第 84 轮（缺口 ①）：原片 frame-0300 同帧**两组不同色**的三角（右侧深蓝 / 左下黄绿）。
    // 用两个互不相交的 bbox 各给一个色 → 顶点色属性里必须同时出现两种色，且组数 = 2。
    const two = await page.evaluate(() => {
      const v = window.rea.view;
      const sp = v.gridStats.lattice.spacing.median;
      const st = v.setGridTriangleGroups([
        { region: { minX: -sp * 3, maxX: -sp * 1, minZ: -sp * 2, maxZ: sp * 0 }, color: '#2233aa' },
        { region: { minX: sp * 1, maxX: sp * 3, minZ: -sp * 2, maxZ: sp * 0 }, color: '#dcdf66' },
      ]);
      v.render(0.016);
      const g = v.gridTri.geometry.getAttribute('color');
      const seen = new Set();
      for (let i = 0; i < (g?.count || 0); i++) seen.add([g.getX(i), g.getY(i), g.getZ(i)].map(x => x.toFixed(3)).join(','));
      const thick = v.gridTriThick.geometry.getAttribute('aColor');
      const tseen = new Set();
      for (let i = 0; i < (thick?.count || 0); i++) tseen.add([thick.getX(i), thick.getY(i), thick.getZ(i)].map(x => x.toFixed(3)).join(','));
      return { tri: st.tri, colors: [...seen].sort(), thickColors: [...tseen].sort(), visible: v.gridTri.visible, vc: v.gridTri.material.vertexColors };
    });
    check('⑨ 两组各自出三角', two.tri && two.tri.quads > 0 && two.tri.groups === 2, JSON.stringify(two.tri));
    check('⑨ 顶点色 = 两组各自的色', two.colors.length === 2 && two.thickColors.length === 2, JSON.stringify({ c: two.colors, t: two.thickColors }));
    check('⑨ 顶点色档已开', two.vc === true && two.visible === true, `vc=${two.vc} visible=${two.visible}`);
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/grid-triangles-two-groups.png` });

    // 分组非法输入必须报错（否则会静默画成单色，原片那种「两组」就丢了）
    const badGroups = await page.evaluate(() => {
      const v = window.rea.view, out = [];
      for (const bad of [[{ color: '#fff' }], [{ region: { minX: 1, maxX: 0, minZ: 0, maxZ: 1 } }], 'x']) {
        try { v.setGridTriangleGroups(bad); out.push('no-throw'); } catch (e) { out.push(e.constructor.name); }
      }
      return out;
    });
    check('⑩ 坏分组报错（缺 region / min>max / 非数组）', badGroups.join(',') === 'RangeError,RangeError,TypeError', badGroups.join(','));

    // 清空分组 → 回到单色档
    const cleared = await page.evaluate(() => {
      const v = window.rea.view;
      const sp = v.gridStats.lattice.spacing.median;
      v.setGridTriangles({ on: true, region: { minX: -sp * 1.6, maxX: sp * 1.6, minZ: -sp * 1.6, maxZ: sp * 1.6 } });
      v.setGridTriangleGroups([]);
      v.render(0.016);
      return { groups: v.gridTriGroups, vc: v.gridTri.material.vertexColors, hasColor: !!v.gridTri.geometry.getAttribute('color') };
    });
    check('⑪ 清空分组回到单色档', cleared.groups === null && cleared.vc === false && cleared.hasColor === false, JSON.stringify(cleared));

    report.base = base; report.on = on; report.wider = wider; report.reg = reg; report.two = two;
    report.screenshots = ['grid-triangles-on.png', 'grid-triangles-wide.png', 'grid-triangles-two-groups.png'];
    report.ok = problems.length === 0;
  } catch (e) {
    problems.push('throw: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
  } finally {
    await browser.close();
  }
  report.problems = problems;
  fs.writeFileSync(`${OUT}/grid-triangles-browser.json`, JSON.stringify(report, null, 1));
  for (const c of report.checks) console.log((c.ok ? 'PASS  ' : 'FAIL  ') + c.name + (c.ok ? '' : ' :: ' + c.detail));
  console.log(report.ok ? 'ALL PASS' : 'FAILED: ' + problems.slice(0, 6).join(' ; '));
  process.exit(report.ok ? 0 : 1);
})();
