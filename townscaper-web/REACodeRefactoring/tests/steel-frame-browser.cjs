// 1257213678056857600（frame-0080）浏览器运行验收：build-r56.html?scene=steel&flags=steelFrame
// 口径：页面真的跑起来，从页面暴露的 r56 统计里断言三条缺口都落地 ——
//   ① 长斜杆：curved/knee 腿 = 曲柄腿，脚点水平内收到下方支撑格心，且脚点落在支撑层 (land*L) 而不是 0；
//   ② 腿随下方支撑点水平偏移而内倾：曲柄脚点与腿顶的 xz 距离 > 0；
//   ③ 高脚塔通长腿的分段/接头：多层簇里系杆层非空、相邻系杆间隔 ≥2 层、接头数 > 0。
// 另断言关掉 world.steelFrame 后钢架整体消失（页面开关真的接通）。
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('fs');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.COVERAGE_BASE || 'http://localhost:8769';
const OUT = 'artifacts/coverage';
const L = 0.5;

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const reports = {};
  try {
    /* ---- 1. 仿 frame-0080：白屋 + 悬空红屋，红屋靠白屋那侧的腿折一段斜杆落到白屋屋面 ---- */
    await page.goto(`${BASE}/build-r56.html?scene=steel&grid=quad&flags=steelFrame&focus=a&dist=7&ty=1.9&pitch=-0.12&yaw=0.6&clean=1`);
    await page.waitForFunction(() => window.r56 && window.r56.steel, null, { timeout: 30000 });
    const a = await page.evaluate(() => window.r56);
    reports.a = a;
    assert.equal(a.scene, 'steel');
    assert.ok(a.flags.includes('steelFrame'), 'steelFrame 开关默认开');
    assert.ok(a.steel.legs > 0, 'legs > 0');
    assert.ok(a.steel.cranks > 0, '曲柄腿（斜杆内倾）> 0');
    assert.ok(a.steel.joints > 0, '接头 > 0');
    assert.ok(a.steel.bays > 0, '开间 > 0');

    const legs = a.steel.legDetail;
    assert.equal(legs.length, a.steel.legs, '逐腿明细条数 = legs');
    const cranked = legs.filter((l) => l.crank);
    assert.ok(cranked.length > 0, '至少一根曲柄腿');
    for (const l of cranked) {
      const [fx, fy, fz] = l.crank.foot, [tx, , tz] = l.crank.top;
      const dxz = Math.hypot(fx - tx, fz - tz);
      assert.ok(dxz > 0.05, `曲柄腿脚点水平内倾 ${dxz.toFixed(3)} > 0.05（腿随下方支撑点偏移）`);
      assert.ok(Math.abs(fy - l.land * L) < 1e-6, `脚点落在支撑层 ${l.land}×L（不是落到 0）`);
      assert.ok(l.crank.knee > l.land * L && l.crank.knee < l.crank.top[1], '膝点在支撑层与楼板之间');
    }
    // 直腿：确实有落到码头（land=1）的腿，说明「落到真正支撑」不是全部折曲
    assert.ok(legs.some((l) => !l.crank && l.land === 1), '有直腿落到码头铺地（land=1）');
    // 没有任何腿穿过支撑层继续往下（落点 = 共享角格最高实心层）
    for (const l of legs) assert.ok(l.land >= 0 && l.land <= l.lv - 1, '落点层在体块下方');
    await page.screenshot({ path: `${OUT}/steel-frame-browser-quad-a.png` });

    /* ---- 2. 仿 1189902695303458816：多体块高架 → 系杆分层 + 接头（长腿分段） ---- */
    await page.goto(`${BASE}/build-r56.html?scene=steel&grid=quad&flags=steelFrame&focus=tower&dist=16&ty=3.2&pitch=-0.10`);
    await page.waitForFunction(() => window.r56 && window.r56.steel, null, { timeout: 30000 });
    const t = await page.evaluate(() => window.r56);
    reports.tower = t;
    assert.ok(t.steel.ties > 0, '系杆 > 0（高脚塔通长腿分段）');
    const withTies = t.steel.tieLevels.filter((s) => s.length);
    assert.ok(withTies.length > 0, '至少一个簇解出系杆层');
    for (const set of withTies) for (let i = 1; i < set.length; i++) assert.ok(set[i] - set[i - 1] >= 2, '系杆不连层');
    assert.ok(t.steel.ladders >= 0, 'ladders 字段存在');

    await page.screenshot({ path: `${OUT}/steel-frame-browser-quad.png` });

    /* ---- 3. 关掉 world.steelFrame → 钢架整体消失（页面开关真的接通） ---- */
    const off = await page.evaluate(() => {
      const w = window.r56world.world, v = window.r56world.view;
      w.steelFrame = false; w.touch(); v.worldMesh.invalidate(); v.render(0);
      return window.r56world.stats();
    });
    reports.off = off;
    assert.equal(off.steel, null, '关掉 steelFrame 后没有钢架');

    assert.deepEqual(errors, [], '页面零报错');
    fs.writeFileSync(`${OUT}/steel-frame-browser.json`, JSON.stringify(reports, null, 2));
    console.log('ALL PASS');
    console.log(JSON.stringify({
      scene: reports.a.scene,
      legs: reports.a.steel.legs, cranks: reports.a.steel.cranks, joints: reports.a.steel.joints,
      crankInward: +Math.max(...reports.a.steel.legDetail.filter((l) => l.crank).map((l) => Math.hypot(l.crank.foot[0] - l.crank.top[0], l.crank.foot[2] - l.crank.top[2]))).toFixed(4),
      footLevels: [...new Set(reports.a.steel.legDetail.filter((l) => l.crank).map((l) => l.land))],
      towerTies: reports.tower.steel.ties, tieLevels: reports.tower.steel.tieLevels.filter((s) => s.length),
      offSteel: reports.off.steel, errors,
    }));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
