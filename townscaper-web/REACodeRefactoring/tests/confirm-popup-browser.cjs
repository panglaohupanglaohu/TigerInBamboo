// 1016680972610359298（370 帧 / 「This is what the confirm popup looks like」）
// 真主战场（index.html?scene=badnorth&confirm=1）运行验收，补「本地 UI 实验」之后的三条游戏语义残差：
//   ① 地面标记：点目标格 → 白环钉在格心，确认/取消/关档都收回（像素 A/B 数环上的白点）
//   ② 单 Move 游戏目标：确认按钮重放 battle.onPointer 原点击 → navigation.pick/plan → squad.goal/goalFloor，
//      不是 UI 摆样子（Node 侧另有 plan spy 断言）
//   ③ 移动交换站位：目标格有队 → Select/Move/Swap 三钮，Swap 两队互换阵地（goal+goalFloor 双向换）
// 另验：Esc 取消（真 keydown）、点钮走真鼠标点击（pointerdown 被按钮 stopPropagation，不落到画布）。
const { chromium } = require('playwright');
const fs = require('fs');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'artifacts/coverage';
const URL = 'http://127.0.0.1:8769/index.html?scene=badnorth&grid=quad&confirm=1';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
  const errors = []; let ok = 0;
  const check = (name, cond, detail) => { if (!cond) throw new Error(`FAIL ${name}: ${detail}`); ok++; console.log(`  PASS ${name} — ${detail}`); };
  page.on('pageerror', (e) => errors.push(e.message));
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    try { await page.waitForFunction(() => window.rea?.battle?.running, null, { timeout: 120000 }); break; }
    catch (e) { if (attempt === 2) throw e; console.log('  retry boot ' + (attempt + 1)); }
  }

  // 夹具：找三个相邻的平整台地格，队 A 站 C1、队 B 站 C2、C3 留空当目标；其余队标死免得挡判定。
  const fix = await page.evaluate(() => {
    const b = window.rea.battle, w = b.world, L = b.L;
    b.paused = true; b.nextWave = Infinity;
    const flat = (c) => w.top(c) >= 1 && w.ground(c) === w.top(c) && c.edgeNeighbors.every((id) => id >= 0 && w.top(w.cells[id]) === w.top(c));
    const open = w.cells.filter(flat);
    if (!open.length) throw Error('no open cells');
    const c1 = open[0], dc = (a, b) => Math.hypot(a.cx - b.cx, a.cz - b.cz);
    const c2 = open.find((c) => c !== c1 && dc(c, c1) > 1.0 && dc(c, c1) < 2.2) || open.find((c) => c !== c1 && dc(c, c1) > 1.0) || open[1];
    const c3 = open.find((c) => c !== c1 && c !== c2 && dc(c, c1) > .8 && dc(c, c1) < 2.5 && dc(c, c2) > 1.3) || open.find((c) => c !== c1 && c !== c2 && dc(c, c2) > 1.3);
    if (!c2 || !c3) throw Error('not enough open cells');
    const seat = (sq, c) => {
      sq.alive = true; sq.goal = c; sq.goalFloor = w.top(c);
      sq.members.forEach((u, k) => { if (k < 3) { u.dead = false; u.onBoat = null; u.fall = null; u.hp = u.max = 6; u.x = c.cx + (k - 1) * .12; u.z = c.cz; u.y = w.top(c) * L; u.navFloor = w.top(c); } else { u.dead = true; u.hp = 0; } });
    };
    const [s1, s2] = b.squads; seat(s1, c1); seat(s2, c2);
    for (const sq of b.squads.slice(2)) { sq.alive = false; for (const u of sq.members) u.dead = true; }
    for (const u of b.units) if (u.team === 1) u.dead = true;   // 维京人全部退场，免得触发近战/选队干扰
    b.selected = s1; b.scale = 1;
    window.rea.view.target.set(c1.cx, w.top(c1) * L + .3, c1.cz); window.rea.view.distance = 5; window.rea.view.pitch = .8; window.rea.view.updateCamera();
    const hit = (c) => ({ cell: c, point: { x: c.cx, y: w.top(c) * L, z: c.cz } });
    const px = (c) => {   // 世界点 → 屏幕像素（手工投影，THREE 不挂全局）
      const cam = window.rea.view.camera, e = cam.matrixWorldInverse.elements, p = cam.projectionMatrix.elements;
      const x = c.cx, y = w.top(c) * L + .04, z = c.cz;
      const vx = e[0] * x + e[4] * y + e[8] * z + e[12], vy = e[1] * x + e[5] * y + e[9] * z + e[13], vz = e[2] * x + e[6] * y + e[10] * z + e[14], vw = e[3] * x + e[7] * y + e[11] * z + e[15];
      const nx = (p[0] * vx + p[4] * vy + p[8] * vz + p[12] * vw) / (p[3] * vx + p[7] * vy + p[11] * vz + p[15] * vw);
      const ny = (p[1] * vx + p[5] * vy + p[9] * vz + p[13] * vw) / (p[3] * vx + p[7] * vy + p[11] * vz + p[15] * vw);
      return { x: (nx + 1) / 2 * innerWidth, y: (1 - ny) / 2 * innerHeight };
    };
    window.__cf = { b, w, L, s1, s2, c1, c2, c3, hit, px };
    return { c1: c1.id, c2: c2.id, c3: c3.id, floor: w.top(c1), floor2: w.top(c2), floor3: w.top(c3), squads: b.squads.length };
  });
  console.log('  fixture', JSON.stringify(fix));
  // 像素 A/B：同一帧里 marker.visible 开/关连拍两帧（v.render(0) → uTime 不走、确定性），
  // readPixels 全缓冲差分——数白环落地像素 + 包围盒必须罩住投影点（>220/通道的调过色纯白，不是 255）。
  const markerPixels = () => page.evaluate(() => {
    const m = window.__cf.b.c03.marker, v = window.rea.view, gl = v.renderer.getContext();
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
    const snap = () => { v.render(0); const buf = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf); return buf; };
    const a = snap(); m.visible = false; const off = snap(); m.visible = true;
    let n = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, d = (a[i] - off[i]) + (a[i + 1] - off[i + 1]) + (a[i + 2] - off[i + 2]);
      if (d > 60) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    const p = window.__cf.px(window.__cf.c3), gy = v.renderer.domElement.height - Math.round(p.y);   // 屏幕点 → GL 底原点
    return { n, bbox: n ? [x0, y0, x1, y1] : null, inBox: n ? (x0 <= p.x && p.x <= x1 && y0 <= gy && gy <= y1) : false };
  });

  // ① 点空目标格 → 弹窗（单 Move 钮）+ 地面标记；确认前 goal 不动
  const r1 = await page.evaluate(() => {
    const { b, c3, hit } = window.__cf, c = b.c03;
    const eaten = b.onPointer(hit(c3));
    return { eaten, options: c.pending?.options, picked: c.pending ? { id: c.pending.picked.cell.id, cx: c.pending.picked.cell.cx, cz: c.pending.picked.cell.cz, floor: c.pending.picked.floor, other: c.pending.other?.id ?? null } : null, buttons: c.popup ? [...c.popup.querySelectorAll('button')].map((x) => x.textContent.trim().replace(/\s+/g, ' ')) : null,
      popupInDom: !!c.popup && document.body.contains(c.popup), markerVisible: !!c.marker?.visible,
      markerPos: c.marker ? [+c.marker.position.x.toFixed(2), +c.marker.position.y.toFixed(2), +c.marker.position.z.toFixed(2)] : null,
      c3: [window.__cf.c3.cx, window.__cf.w.top(window.__cf.c3) * window.__cf.L, window.__cf.c3.cz], goal: window.__cf.s1.goal.id };
  });
  console.log('  r1', JSON.stringify(r1));
  check('点击被确认弹窗吃掉', r1.eaten === true, JSON.stringify(r1.options));
  check('空地只给 Move 一枚钮', JSON.stringify(r1.options) === '["move"]' && r1.buttons.length === 1, r1.buttons?.join('|'));
  check('弹窗挂在 DOM', r1.popupInDom === true);
  check('地面标记亮出并钉在目标格', r1.markerVisible === true && Math.abs(r1.markerPos[0] - r1.c3[0]) < .02 && Math.abs(r1.markerPos[2] - r1.c3[2]) < .02, JSON.stringify(r1.markerPos));
  check('确认前 goal 不动', r1.goal === fix.c1, 'goal=' + r1.goal);
  await new Promise((r) => setTimeout(r, 300));
  const pxOn = await markerPixels();
  check('标记像素 A/B：白环真画在目标格', pxOn.n > 200 && pxOn.inBox, JSON.stringify(pxOn));

  // ② 真鼠标点 Move 钮 → 走真下令路径（goal+goalFloor 换、弹窗+标记收回、取消选中）
  const btn = await page.evaluate(() => { const r = window.__cf.b.c03.popup.querySelector('button').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.click(btn.x, btn.y);
  const r2 = await page.evaluate(() => ({ goal: window.__cf.s1.goal.id, floor: window.__cf.s1.goalFloor, popup: !!window.__cf.b.c03.popup, pending: !!window.__cf.b.c03.pending, marker: !!window.__cf.b.c03.marker?.visible, sel: window.__cf.b.selected?.id ?? null, moves: window.__cf.b.c03.stats.moves }));
  check('Move 确认 → goal 落到目标格', r2.goal === fix.c3 && r2.floor === fix.floor3, JSON.stringify(r2));
  check('确认后弹窗+标记+选中全收', !r2.popup && !r2.pending && !r2.marker && r2.sel === null, JSON.stringify(r2));
  check('stats.moves 记一笔', r2.moves === 1, String(r2.moves));
  await new Promise((r) => setTimeout(r, 200));
  const pxOff = await markerPixels();
  check('确认后白环消失（像素回落）', pxOff.n < 30, JSON.stringify(pxOff));

  // ③ Esc 取消：开着弹窗按 Esc → 收掉、不下令
  await page.evaluate(() => { const { b, c3, hit } = window.__cf; b.selected = window.__cf.s1; b.onPointer(hit(c3)); });
  check('再次点开弹窗', await page.evaluate(() => !!window.__cf.b.c03.pending && window.__cf.b.c03.marker.visible));
  await page.keyboard.press('Escape');
  const r3 = await page.evaluate(() => ({ pending: !!window.__cf.b.c03.pending, marker: !!window.__cf.b.c03.marker?.visible, goal: window.__cf.s1.goal.id }));
  check('Esc 收弹窗+标记且不下令', !r3.pending && !r3.marker && r3.goal === fix.c3, JSON.stringify(r3));

  // ④ 目标格有队 → Select/Move/Swap 三钮；Swap = 两队阵地互换（goal+floor 双向）
  const r4 = await page.evaluate(() => {
    const { b, c2, hit, s1, s2 } = window.__cf, c = b.c03;
    b.selected = s1; b.onPointer(hit(c2));
    const opts = c.pending?.options, other = c.pending?.other === s2;
    const g1 = s1.goal.id, g2 = s2.goal.id, f1 = s1.goalFloor, f2 = s2.goalFloor;
    c.confirmAction('swap');
    return { opts, other, before: [g1, g2, f1, f2], after: [s1.goal.id, s2.goal.id, s1.goalFloor, s2.goalFloor], c2: window.__cf.c2.id, marker: !!c.marker?.visible, popup: !!c.popup, swaps: c.stats.swaps, sel: b.selected?.id ?? null };
  });
  check('有队目标格给三项横排', JSON.stringify(r4.opts) === '["select","move","swap"]' && r4.other === true, JSON.stringify(r4.opts));
  check('Swap 两队阵地互换（goal+floor）', r4.after[0] === r4.c2 && r4.after[1] === r4.before[0] && r4.after[2] === fix.floor2 && r4.after[3] === r4.before[2], JSON.stringify(r4));
  check('Swap 后也收干净', !r4.marker && !r4.popup && r4.swaps === 1, JSON.stringify(r4));

  // ⑤ Select：改选那一队
  const r5 = await page.evaluate(() => {
    const { b, c2, hit, s1, s2 } = window.__cf, c = b.c03;
    b.selected = s1; b.onPointer(hit(c2)); c.confirmAction('select');
    return { sel: b.selected?.id, s2id: s2.id, pending: !!c.pending };
  });
  check('Select 改选别队', r5.sel === r5.s2id && !r5.pending, JSON.stringify(r5));

  await page.screenshot({ path: `${OUT}/confirm-popup-after.png` });
  fs.writeFileSync(`${OUT}/confirm-popup-browser.json`, JSON.stringify({ ok, fix, r1, r2, r3, r4, r5, pxOn, pxOff, errors }, null, 2));
  check('无页面错误', errors.length === 0, errors.join('; '));
  console.log(`PASS confirm-popup-browser ${ok} 项`);
  await browser.close();
})().catch((e) => { console.error(e.stack || e); process.exit(1); });
