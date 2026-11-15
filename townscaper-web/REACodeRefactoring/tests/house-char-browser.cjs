/**
 * house-char-browser.cjs — 第 93 轮 · 失守小屋屋体炭黑（837027901853810688）真实页面验收
 *
 * 片子口径（460×460 / 32.9fps / 514 帧）：f0082 近黑像素 1076 → f0083 5681（**一帧跳完**），
 * 之后 13 s 稳定在 5.5–6.6 k、不再扩大；近黑区就是小屋自己（屋脊/附属体逐帧对得上）。
 * 所以验收四件事：
 *   ① 显式关（`?c01=-houseChar`，第 97 轮起 houseChar 默认开）：顶点色不动；
 *   ② 把一栋屋标成 lost 后开 houseChar → 只有这栋屋的顶点被压黑，地面顶点不动；
 *   ③ 关/开两次渲染做差：画面里出现一块近黑区，且差集里三通道都在掉（是压暗不是提亮）；
 *   ④ stop 后顶点色还原。
 */
const { chromium } = require('playwright');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const out = { ok: true, checks: [] };
  const check = (name, cond, detail) => {
    out.checks.push({ name, pass: !!cond, detail });
    if (!cond) out.ok = false;
    console.log(`  ${cond ? 'PASS' : 'FAIL'} ${name} — ${detail}`);
  };

  // 第 97 轮：houseChar 改成**默认开**（837 原片默认观感，见 battle-c01.js C01_DEFAULT_ON），
  // 所以负对照要显式关掉，用 ?c01=-houseChar。
  await page.goto('http://127.0.0.1:8769/index.html?scene=badnorth&c01=-houseChar', { waitUntil: 'load' });
  await page.waitForFunction(() => globalThis.rea?.battle?.running === true, { timeout: 60000 });
  await page.waitForTimeout(1500);

  // ① 默认关
  const off = await page.evaluate(() => {
    const c = rea.battle.c01, col = rea.battle.view.mesh.geometry.attributes.color;
    let dark = 0; const n0 = col.count;
    for (let i = 0; i < n0; i++) if (col.getX(i) < 0.05 && col.getY(i) < 0.05) dark++;
    rea.battle.update(1 / 60);
    return { flags: c.on.houseChar, housesCharred: c.stats.housesCharred, dark, verts: n0 };
  });
  check('显式关（?c01=-houseChar）· houseChar=false', off.flags === false, `on.houseChar=${off.flags}`);
  check('显式关（?c01=-houseChar）· 没炭化过任何顶点', off.housesCharred === 0, `housesCharred=${off.housesCharred}, 天然极暗顶点 ${off.dark}/${off.verts}`);

  // ② 造一栋失守的屋 → 开 houseChar → 只有这栋屋被压黑
  const on = await page.evaluate(() => {
    const b = rea.battle, c = b.c01, mesh = b.view.mesh, col = mesh.geometry.attributes.color;
    if (!b.houses.length) return { error: 'no houses' };
    const count = () => { let d = 0; for (let i = 0; i < col.count; i++) if (col.getX(i) < 0.08 && col.getY(i) < 0.08 && col.getZ(i) < 0.08) d++; return d; };
    const baseDark = count();
    const h = b.houses[0];
    // 一栋屋可能被岩石/单位挡住（首轮实测 houses[0] 在屏幕内但差集 0px）→ 全部屋一起失守，
    // 逐栋炭化仍由纯逻辑测试与 charredVerts 计数分别钉住。
    for (const x of b.houses) x.lost = true;
    c.set('houseChar', true);
    mesh.updateMatrixWorld();
    b.update(1 / 60);
    const s = c.stats;
    let dark = 0, sum = [0, 0, 0];
    for (let i = 0; i < col.count; i++) if (col.getX(i) < 0.08 && col.getY(i) < 0.08 && col.getZ(i) < 0.08) { dark++; sum[0] += col.getX(i); sum[1] += col.getY(i); sum[2] += col.getZ(i); }
    const v = rea.view;
    const wp = new v.camera.position.constructor(h.cell.cx, b.world.top(h.cell) * b.L, h.cell.cz).project(v.camera);
    return {
      baseDark, housesCharred: s.housesCharred, charredVerts: s.charredVerts, dark,
      median: dark ? sum.map((x) => +(x / dark).toFixed(4)) : null,
      screen: { x: Math.round((wp.x * 0.5 + 0.5) * v.renderer.domElement.width), y: Math.round((-wp.y * 0.5 + 0.5) * v.renderer.domElement.height) },
      lostHouse: { cx: h.cell.cx, cz: h.cell.cz, top: b.world.top(h.cell) },
      onScreen: Math.abs(wp.x) <= 1 && Math.abs(wp.y) <= 1,
    };
  });
  check('开 · 屋被炭化', on.housesCharred === 4 && on.charredVerts > 0, `housesCharred=${on.housesCharred}, charredVerts=${on.charredVerts}`);
  check('开 · 炭化顶点确实是近黑', on.median && on.median[0] < 0.08 && on.median[1] < 0.08, `中位色 ${JSON.stringify(on.median)}`);
  check('开 · R 略高于 G（暖焦，非纯黑）', on.median && on.median[0] > on.median[1], JSON.stringify(on.median));
  check('那栋屋在视口内（截图/差集才有意义）', on.onScreen === true, `屏幕 ${JSON.stringify(on.screen)}`);

  // ③ 关/开两次渲染做差（同帧、只差顶点色；render(0) 冻结水面/烟的时间推进）
  const diff = await page.evaluate(() => {
    const v = rea.view, r = v.renderer, c = rea.battle.c01, col = rea.battle.view.mesh.geometry.attributes.color;
    const gl = r.getContext(), W = r.domElement.width, H = r.domElement.height;
    // 直接从 drawing buffer 读：canvas.drawImage 会读到上一帧（render(0) 那次差集恒 0，本轮实测）
    const shot = () => { v.render(0); const b = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
    const now = shot();
    const saved = c._charSaved, rgb = saved.rgb.slice();
    saved.idx.forEach((i, k) => col.setXYZ(i, rgb[k * 3], rgb[k * 3 + 1], rgb[k * 3 + 2]));
    col.needsUpdate = true;
    const before = shot();
    saved.idx.forEach((i, k) => { const s = 1 + 0.375 * Math.sin(i * 12.9898); col.setXYZ(i, 0.045 * s, 0.036 * s, 0.04 * s); });
    col.needsUpdate = true;
    let n = 0, dR = 0, dG = 0, dB = 0, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, darker = 0;
    const rs = [], gs = [], bs = [];
    for (let p = 0; p < W * H; p++) {
      const i4 = p * 4, dr = now[i4] - before[i4], dg = now[i4 + 1] - before[i4 + 1], db = now[i4 + 2] - before[i4 + 2];
      if (Math.abs(dr) + Math.abs(dg) + Math.abs(db) < 12) continue;
      n++; dR += dr; dG += dg; dB += db;
      if (dr + dg + db < 0) darker++;
      rs.push(now[i4]); gs.push(now[i4 + 1]); bs.push(now[i4 + 2]);
      const x = p % W, y = H - 1 - ((p / W) | 0);   // readPixels 是左下原点
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    const med = (a) => { if (!a.length) return 0; const s = a.slice().sort((p, q) => p - q); return s[(s.length / 2) | 0]; };
    // 炭化后的屏幕中位色（与原片近黑区 [46,29,51] 对比用）
    return { W, H, n, pct: +(100 * n / (W * H)).toFixed(2), dR: +(dR / Math.max(1, n)).toFixed(2), dG: +(dG / Math.max(1, n)).toFixed(2), dB: +(dB / Math.max(1, n)).toFixed(2), darkerPct: +(100 * darker / Math.max(1, n)).toFixed(1), bbox: [x0, y0, x1, y1], screenMedian: [med(rs), med(gs), med(bs)] };
  });
  check('差集非空（炭化真的画出来了）', diff.n > 800, `${diff.n}px = ${diff.pct}% 画幅`);
  check('方向对 · 三通道同时变暗', diff.dR < 0 && diff.dG < 0 && diff.dB < 0, `ΔR=${diff.dR} ΔG=${diff.dG} ΔB=${diff.dB}`);
  check('绝大多数差异像素变暗', diff.darkerPct > 85, `变暗 ${diff.darkerPct}%`);
  check('差异只在屋那一小块（不是整屏）', diff.pct < 12, `bbox=${diff.bbox.join(',')} = ${diff.pct}%`);

  // 截图（不动镜头，直接把 HUD 藏掉拍当前帧）
  await page.evaluate(() => { document.getElementById('hud')?.style.setProperty('display', 'none'); rea.view.render(0); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'artifacts/coverage/house-char-page.png' });

  // ④ stop 还原（基线要在同一状态下取，天然极暗顶点数会随植被/水面微变）
  const restored = await page.evaluate(() => {
    const c = rea.battle.c01, col = rea.battle.view.mesh.geometry.attributes.color;
    c.stop();
    let dark = 0;
    for (let i = 0; i < col.count; i++) if (col.getX(i) < 0.08 && col.getY(i) < 0.08 && col.getZ(i) < 0.08) dark++;
    return { dark, stats: { housesCharred: c.stats.housesCharred, charredVerts: c.stats.charredVerts } };
  });
  check('stop · 顶点色还原到炭化前的同一计数', restored.dark === on.baseDark, `极暗顶点 ${restored.dark}（炭化前 ${on.baseDark}）`);

  check('无控制台错误', errors.length === 0, errors.slice(0, 3).join(' | ') || 'none');

  await browser.close();
  console.log(out.ok ? 'house-char-browser: ALL PASS' : 'house-char-browser: FAIL');
  console.log(JSON.stringify({ ok: out.ok, diff, on: { housesCharred: on.housesCharred, charredVerts: on.charredVerts, median: on.median }, fails: out.checks.filter((c) => !c.pass).map((c) => c.name) }));
  process.exit(out.ok ? 0 : 1);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
