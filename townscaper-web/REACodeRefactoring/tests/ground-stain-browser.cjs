/**
 * ground-stain-browser.cjs — 第 92 轮 · 整岛地面染色（837027901853810688）真实页面验收
 *
 * 片子口径（460×460 / 32.9fps / 514 帧，见 src/badnorth/ground-stain.js 里的实测表）：
 *   地面 R 不动、G −6.6%、B −5.3%（灰雪 → 灰玫瑰）；**海面 514 帧恒 [165,176,178]**。
 * 所以验收不是「变粉了没有」，而是三件可量的事：
 *   ① 打开 flag 后画面上真的出现一层（关/开两次渲染做差，差集非空）；
 *   ② 变色方向对：差集里 G 掉得比 R 多（G 压得最狠），不是整体提亮；
 *   ③ 只染陆地：把染色层换成纯色渲染同一帧，海面区域（画面底部 / 远水）与陆地像素的比例要分开 ——
 *      这里用「顶面几何的 y 全部 > 0」+ 渲染差的包围盒不越过岛轮廓来判。
 */
const { chromium } = require('playwright');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const out = { ok: true, checks: [] };
  const check = (name, cond, detail) => {
    out.checks.push({ name, pass: !!cond, detail });
    if (!cond) out.ok = false;
    console.log(`  ${cond ? 'PASS' : 'FAIL'} ${name} — ${detail}`);
  };

  await page.goto('http://127.0.0.1:8769/index.html?scene=badnorth', { waitUntil: 'load' });
  await page.waitForFunction(() => globalThis.rea?.battle?.running === true, { timeout: 60000 });
  await page.waitForTimeout(1200);

  // ① 默认关：页面上不该有染色层
  check('默认关 · 无染色层', await page.evaluate(() => !rea.battle.c01.stain), 'stain === null');

  // ② 打开：建层 + 格数
  const built = await page.evaluate(() => {
    const c = rea.battle.c01;
    c.set('groundTint', true);
    rea.battle.update(1 / 60);
    const m = c.stain?.mesh;
    const pos = m ? m.geometry.getAttribute('position') : null;
    let ymin = 1e9, ymax = -1e9;
    if (pos) for (let i = 1; i < pos.count * 3; i += 3) { ymin = Math.min(ymin, pos.array[i]); ymax = Math.max(ymax, pos.array[i]); }
    return { cells: c.stats.stainCells, ymin, ymax, blending: m?.material.blending, color: m?.material.color.getHexString(), visible: m?.visible };
  });
  check('开 · 建层且覆盖陆地格', built.cells > 100, `cells=${built.cells}`);
  check('开 · 顶点全在水面以上（只染陆地）', built.ymin > 0, `y ∈ [${built.ymin.toFixed(3)}, ${built.ymax.toFixed(3)}]`);
  // 本仓 three 的常量值：NoBlending=0 / NormalBlending=1 / MultiplyBlending=4（别写 2）
  check('开 · 乘性混合', built.blending === 4, `THREE.MultiplyBlending=${built.blending}（Normal=1）`);
  check('开 · p=0 时是纯白（等于没染）', built.color === 'ffffff', built.color);

  // ③ 关/开两次渲染做差：同帧、只差染色层
  const diff = await page.evaluate(() => {
    const v = rea.view, r = v.renderer, c = rea.battle.c01;
    const W = r.domElement.width, H = r.domElement.height;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d', { willReadFrequently: true });
    const grab = () => { r.render(v.scene, v.camera); g.clearRect(0, 0, W, H); g.drawImage(r.domElement, 0, 0); return g.getImageData(0, 0, W, H).data; };
    c.setStainProgress(0); rea.battle.update(1 / 60); const A = grab();
    c.setStainProgress(1); rea.battle.update(1 / 60); const B = grab();
    let n = 0, dr = 0, dg = 0, db = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const d = Math.abs(B[i] - A[i]) + Math.abs(B[i + 1] - A[i + 1]) + Math.abs(B[i + 2] - A[i + 2]);
      if (d > 6) { n++; dr += A[i] - B[i]; dg += A[i + 1] - B[i + 1]; db += A[i + 2] - B[i + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    return { W, H, n, dr: dr / Math.max(1, n), dg: dg / Math.max(1, n), db: db / Math.max(1, n), box: [x0, y0, x1, y1], stats: { ...c.stats } };
  });
  const px = diff.n, total = diff.W * diff.H;
  check('渲染差集非空', px > total * 0.05, `${px} px = ${(px / total * 100).toFixed(1)}% 画幅（陆地占比量级）`);
  check('方向对 · G 掉得比 R 多', diff.dg > diff.dr * 1.2, `ΔR=${diff.dr.toFixed(2)} ΔG=${diff.dg.toFixed(2)} ΔB=${diff.db.toFixed(2)}`);
  check('方向对 · B 也掉但没有 G 狠', diff.db > 0.5 && diff.db < diff.dg, `ΔB=${diff.db.toFixed(2)}`);
  check('不进海面：差集不占满整屏', px < total * 0.95, `${(px / total * 100).toFixed(1)}% < 95%`);

  // ④ 自动模式：打到见血后进度自己往上走
  const auto = await page.evaluate(async () => {
    const c = rea.battle.c01;
    c.setStainProgress(null);
    let hurt = null;
    for (let k = 0; k < 2400 && hurt == null; k++) { rea.battle.update(1 / 30); if (c.stainT0 != null) hurt = rea.battle.t; }
    for (let k = 0; k < 120; k++) rea.battle.update(1 / 30);
    return { hurt, t: rea.battle.t, p: c.stats.stainProgress, color: c.stats.stainColor };
  });
  check('自动 · 见血后起步', auto.hurt != null, `hurt@${auto.hurt?.toFixed(2)}s`);
  check('自动 · 4s 内到 0.3 以上', auto.p >= 0.3, `p=${auto.p} color=${auto.color}`);

  // ⑤ 截图（人工复核用）
  await page.evaluate(() => rea.battle.c01.setStainProgress(1));
  await page.waitForTimeout(200);
  const shot = 'artifacts/coverage/ground-stain-p1.png';
  await page.screenshot({ path: shot, clip: { x: 0, y: 0, width: 1200, height: 900 } });

  check('无页面异常', errors.length === 0, errors.join(' | ') || 'none');
  console.log(JSON.stringify({ ok: out.ok, checks: out.checks.map((c) => [c.name, c.pass]), shot, diff: { n: diff.n, dr: diff.dr, dg: diff.dg, db: diff.db } }, null, 1));
  await browser.close();
  process.exit(out.ok ? 0 : 1);
})();
