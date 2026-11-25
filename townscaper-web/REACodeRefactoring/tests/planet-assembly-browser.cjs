const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// 784847933686575104 / 784847588893814785：球壳从一小片沿前沿铺满整球。
// 这里验页面装配滑杆真的在改网格（不是只改数字），并把四档截图落盘给人眼核。
(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [], reports = [];
  const out = path.resolve(__dirname, '../artifacts/coverage');
  p.on('pageerror', (e) => errors.push(e.message));
  try {
    await p.goto('http://localhost:8769/planet.html');
    await p.waitForFunction(() => window.planetAssembly && window.planetDemo);
    await p.click('#spin'); // 停自转，保证四档同机位可比
    await p.evaluate(() => { const cam = planetLighting.camera; cam.position.set(0, 6.5, 24); cam.lookAt(0, 0, 0); });
    const total = await p.evaluate(() => planetAssembly.order.length);
    for (const asm of [0.12, 0.4, 0.7, 1]) {
      await p.evaluate((v) => window.planetAssembly.set(v), asm);
      await p.waitForTimeout(120);
      const s = await p.evaluate(() => ({
        asm: planetAssembly.asm,
        cells: planetDemo.only ? planetDemo.only.size : planetAssembly.order.length,
        verts: planetDemo.land.geometry.attributes.position.count,
        faces: planetDemo.land.geometry.attributes.position.count / 3,
        only: planetDemo.only ? planetDemo.only.size : null,
      }));
      reports.push({ asm, total, ...s });
      await p.screenshot({ path: path.join(out, `planet-assembly-${String(asm).replace('.', '')}.png`) });
    }
    // 装配 0 必须一块面都没有（不是留一个空球）
    const zero = await p.evaluate(() => { planetAssembly.set(0); return planetDemo.land.geometry.attributes.position.count; });
    if (zero !== 0) throw Error('装配 0 仍有面：' + zero);
    // 顶点数：0 < 12% < 40% < 70%，铺满后因断口侧壁消失而回落
    for (let i = 1; i <= 2; i++) if (!(reports[i].verts > reports[i - 1].verts)) throw Error('装配中顶点数没有增长：' + JSON.stringify(reports));
    if (!(reports[3].verts < reports[2].verts)) throw Error('铺满后断口侧壁应消失，顶点数应回落：' + JSON.stringify(reports));
    if (reports[3].cells !== total) throw Error('铺满时格子数不等于陆地格数');
    // 白模 / 薄壳
    await p.evaluate(() => window.planetAssembly.set(0.45));
    await p.click('#clay');
    await p.click('#shell');
    await p.waitForTimeout(120);
    const mats = await p.evaluate(() => ({
      clay: planetDemo.clayOn, shell: planetDemo.shellOn,
      vertexColors: planetDemo.land.material.vertexColors,
      children: planetDemo.world.children.length,
    }));
    await p.screenshot({ path: path.join(out, 'planet-assembly-clay-shell.png') });
    if (!mats.clay || mats.vertexColors) throw Error('白模没生效');
    if (!mats.shell || mats.children !== 1) throw Error('薄壳没生效（应只剩陆地一层）');
    // r216 起点可指定（页面层）：setRoot 换任意陆地格 → 序列第一格 = 该格，装配前缀从新起点生长
    const rc = await p.evaluate(() => {
      const target = planetAssembly.order[planetAssembly.order.length - 1];
      const ok = planetAssembly.setRoot(target);
      planetAssembly.set(0.02);
      const prefix = planetDemo.only ? [...planetDemo.only] : [];
      planetAssembly.set(1);
      return { target, ok, first: planetAssembly.order[0], root: planetAssembly.root, prefix };
    });
    if (rc.ok !== rc.target || rc.first !== rc.target || rc.root !== rc.target) throw Error('setRoot 未生效：' + JSON.stringify(rc));
    if (!rc.prefix.includes(rc.target)) throw Error('装配前缀不含新起点格：' + JSON.stringify(rc));
    // 「起点：点格」点选球面 → 最近的陆地格成为新起点（不预知选中谁，但必须落到陆地格并生效）
    await p.click('#pickroot');
    await p.mouse.click(720, 500);
    await p.waitForTimeout(80);
    const pk = await p.evaluate(() => ({ root: planetAssembly.root, first: planetAssembly.order[0], land: planetDemo.planet.H[planetAssembly.root] > 0 }));
    if (!pk.land || pk.first !== pk.root) throw Error('点选起点失败：' + JSON.stringify(pk));
    // ?root=<陆地格> 进页面直接生效（非法格回退默认根，不报错）
    await p.goto('http://localhost:8769/planet.html?root=' + rc.target);
    await p.waitForFunction(() => window.planetAssembly && window.planetDemo);
    const qr = await p.evaluate(() => ({ root: planetAssembly.root, first: planetAssembly.order[0] }));
    if (qr.first !== rc.target || qr.root !== rc.target) throw Error('?root= 未生效：' + JSON.stringify(qr));
    await p.goto('http://localhost:8769/planet.html?root=999999');
    await p.waitForFunction(() => window.planetAssembly && window.planetDemo);
    const qbad = await p.evaluate(() => ({ root: planetAssembly.root, first: planetAssembly.order[0], cells: planetDemo.only ? planetDemo.only.size : planetAssembly.order.length }));
    if (qbad.root !== null || qbad.cells !== total) throw Error('非法 ?root= 未回退：' + JSON.stringify(qbad));
    if (errors.length) throw Error('页面报错：' + errors.join(' | '));
    fs.writeFileSync(path.join(out, 'planet-assembly-browser.json'), JSON.stringify({ total, reports, mats, rootChecks: { setRoot: rc, picked: pk, query: qr, badQuery: qbad }, errors }, null, 2));
    console.log({ total, reports: reports.map((r) => [r.asm, r.cells, r.verts]), mats, roots: { setRoot: rc.target, picked: pk.root, query: qr.first } });
  } finally {
    await b.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
