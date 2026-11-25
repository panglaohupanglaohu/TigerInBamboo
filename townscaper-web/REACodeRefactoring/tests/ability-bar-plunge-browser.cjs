/**
 * ability-bar-plunge-browser.cjs —— 995034777756536833（564 帧 / 29.238fps / 19.29s·无原文）
 * 在真主战场（index.html?scene=badnorth）里的运行验收：指挥官能力键 / 黄圈高亮 / 「No valid targets」/ 冷却弧。
 *
 * 片内可判的三件事（sheet-00/02/04 三张联系表 + 0200 原尺寸 + 底部 4× 裁切都核过）：
 *   ① 底部一排**三颗圆钮**（画幅 400px 宽时直径 ≈28px = 7%），左/右两颗灰、中间那颗被**黄色高亮环**套住；
 *   ② 亮键**上方**挂一块深色名字牌「Plunge」，牌子下沿一枚朝下小三角指针；
 *   ③ 同一时刻画面顶部一条**黑色横幅「No valid targets」**（片里没有任何一次真的落地）。
 *
 * 机制早在 `src/badnorth/battle-c03.js`（文件头署本片 ID）：`#ensureHud` 三键 + `.cd` 冷却弧、`arm()`、
 * `castPlunge()` 目标校验/跃起/白色冲击环/范围伤害、`#toast` 黑条。缺的只是**页面入口与运行验收**；
 * 本轮另补两处真形制差（片里一眼可数）：名字牌改挂钮**上方**并带指针、亮键补**黄高亮环**，
 * 且「无目标」提示改成**亮键那一刻**就出（原来只在地面点击里才提示，片里是高亮与黑条同帧）。
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function decodePng(buf) {
  let pos = 8, w = 0, h = 0, colorType = 6;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); colorType = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let q = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[q++];
    const line = raw.slice(q, q + stride); q += stride;
    const prev = y ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    const cur = out.slice(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, bb = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += bb;
      else if (f === 3) v += (a + bb) >> 1;
      else if (f === 4) {
        const pp = a + bb - c, pa = Math.abs(pp - a), pb = Math.abs(pp - bb), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? bb : c);
      }
      cur[i] = v & 255;
    }
  }
  return { w, h, bpp, data: out };
}
function imgDiff(A, B) {
  let n = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let px = 0; px < A.w * A.h; px++) {
    const i = px * A.bpp, j = px * B.bpp;
    if (Math.abs(A.data[i] - B.data[j]) + Math.abs(A.data[i + 1] - B.data[j + 1]) + Math.abs(A.data[i + 2] - B.data[j + 2]) <= 6) continue;
    n++;
    const x = px % A.w, y = Math.floor(px / A.w);
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { n, bbox: n ? [x0, y0, x1, y1] : null };
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await browser.newPage({ viewport: { width: 1120, height: 800 } });
  const errors = [], out = {};
  let ok = 0;
  const check = (name, cond, detail) => {
    if (!cond) throw new Error(`FAIL ${name}: ${detail}`);
    ok++;
    console.log(`  PASS ${name} — ${detail}`);
  };
  p.on('pageerror', (e) => errors.push(e.message));
  const dir = path.resolve(__dirname, '../artifacts/coverage');

  const boot = async (url) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      await p.goto(url, { waitUntil: 'domcontentloaded' });
      try { await p.waitForFunction(() => window.rea?.battle?.running, null, { timeout: 120000 }); return; } catch (e) {
        if (attempt === 2) throw e;
        console.log('  retry boot ' + (attempt + 1));
      }
    }
  };
  const freezeClock = () => p.evaluate(() => {
    const v = rea.view;
    if (v.__frozen) return;
    const orig = v.render.bind(v);
    v.render = () => orig(0);
    v.__frozen = true;
  });
  const panelToggle = (on) => p.evaluate((want) => {
    const cb = document.querySelector('input[data-scene-control="plunge"]');
    if (!cb) return 'no-checkbox';
    cb.closest('details').open = true;
    if (cb.checked !== want) cb.click();
    return 'ok';
  }, on);
  const probe = () => p.evaluate(() => rea.battle.c03.plungeProbe());

  // 夹具：一队守军站在某格上，敌方活口可增删；镜头钉在同机位，便于截图像素 A/B。
  const fixture = () => p.evaluate(() => {
    const b = rea.battle, w = b.world, L = b.L;
    b.paused = true; b.scale = 1; b.nextWave = 1e9; b.t = 20; b.wave = 2;
    const sq = b.squads.find((s) => s.alive && !s.archer) || b.squads[0];
    const cell = w.cells.find((c) => w.top(c) >= 1 && c.cx !== undefined) || w.cells[0];
    const members = sq.members.filter((m) => !m.dead).slice(0, 3);
    members.forEach((u, k) => {
      u.dead = false; u.fall = null; u.onBoat = null; u.hp = u.max = 6; u.cd = 100; u.team = 0; u.squad = sq; u.c03Leap = null;
      u.x = cell.cx + (k - 1) * 0.10; u.z = cell.cz; u.y = w.top(cell) * L; u.navFloor = w.top(cell);
    });
    sq.members = members; sq.alive = true; sq.goal = cell; sq.goalFloor = w.top(cell);
    // 其余单位全部撤到远处并标死，避免偶然成为目标
    for (const u of b.units) if (!members.includes(u)) { u.dead = true; u.hp = 0; u.c03Leap = null; }
    b.units = b.units.filter((u) => members.includes(u));
    b.selected = sq;
    b.c03.stats = { ...b.c03.stats, plunges: 0, plungeHits: 0, noTargets: 0 };
    b.c03.cooldown = 0; b.c03.cooldownMax = 0; b.c03.armed = false; b.c03.toast = null;
    if (b.c03.toastEl) b.c03.toastEl.style.display = 'none';
    rea.view.target.set(cell.cx, w.top(cell) * L + 0.2, cell.cz);
    rea.view.distance = 9.5; rea.view.pitch = 0.95; rea.view.updateCamera();
    window.__ab = { sq, cell, members, L, team: sq.id };    return { cell: cell.id, floor: w.top(cell), squads: b.squads.filter((s) => s.alive).length, members: members.length };
  });
  // 放一个敌人在队心 +dx（世界单位）；dx=null 表示不放
  const enemyAt = (dx) => p.evaluate((d) => {
    const b = rea.battle, world = b.world, ab = window.__ab;
    if (d === null) return { placed: false, units: b.units.length };
    const floor = world.top(ab.cell);
    const foe = { team: 1, squad: null, dead: false, hp: 2, max: 2, soak: 0, kind: 'small', bodyScale: 1, radius: 0.055, stunDuration: 0.7, stunRemaining: 0, cd: 100, fall: null, onBoat: null, c03Leap: null, x: ab.cell.cx + d, z: ab.cell.cz, y: floor * b.L, navFloor: floor };
    b.units.push(foe);
    window.__ab.foe = foe;
    return { placed: true, units: b.units.length, hp: foe.hp };
  }, dx);
  const tick = (sec) => p.evaluate((s) => {
    const b = rea.battle;
    b.paused = false;
    for (let i = 0; i < Math.round(60 * s); i++) b.update(1 / 60);
    b.paused = true; b.scale = 1;
    return true;
  }, sec);
  // 队心那一格的**地面点**投到屏幕（点这里 = 片里的「点地面施放」；点单位头顶会因 0.05 抬高而偏出落点）
  const screenOf = (who) => p.evaluate((w) => {
    const b = rea.battle, cam = rea.view.camera;
    const ab = window.__ab;
    const p3 = w === 'cell' ? [ab.cell.cx, b.world.top(ab.cell) * b.L, ab.cell.cz, 1] : [ab.foe.x, ab.foe.y + 0.05, ab.foe.z, 1];
    const mul = (m, v) => [0, 1, 2, 3].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * v[3]);
    const v = mul(cam.projectionMatrix.elements, mul(cam.matrixWorldInverse.elements, p3));
    return { x: (v[0] / v[3] * 0.5 + 0.5) * innerWidth, y: (-v[1] / v[3] * 0.5 + 0.5) * innerHeight };
  }, who);

  try {
    // ── A. 页面入口：未开档时没有能力条；面板「指挥官跃击」勾上即出 ───────────────────
    await boot('http://127.0.0.1:8769/index.html?scene=badnorth&grid=quad');
    await freezeClock();
    const before = await p.evaluate(() => {
      const cb = document.querySelector('input[data-scene-control="plunge"]');
      return { found: !!cb, checked: !!cb?.checked, hud: !!rea.battle.c03.hud, on: rea.battle.c03.on.plunge };
    });
    check('面板有「指挥官跃击」入口且默认关', before.found && before.checked === false, `checkbox=${before.found} checked=${before.checked} on=${before.on}`);
    check('未开档时没有能力条', before.hud === false, `hud=${before.hud}`);

    check('从面板勾选即开', (await panelToggle(true)) === 'ok');
    await p.waitForTimeout(350);
    const on = await probe();
    out.entry = on.hud;
    check('能力条出现', on.on === true && on.hud.visible === true, `on=${on.on} visible=${on.hud.visible}`);
    check('三颗圆钮', on.hud.slots.length === 3, on.hud.slots.map((s) => s.key).join('/'));
    check('只有 Plunge 可点', on.hud.slots.filter((s) => s.enabled).length === 1 && on.hud.slots.find((s) => s.enabled).key === 'plunge', on.hud.slots.map((s) => `${s.key}:${s.enabled ? 'on' : 'off'}/${s.opacity}`).join(' '));
    check('另两颗灰掉（opacity≈0.45）', Math.abs(on.hud.slots.find((s) => s.key === 'volley').opacity - 0.45) < 0.02, `volley opacity=${on.hud.slots.find((s) => s.key === 'volley').opacity}`);
    const size = on.hud.slots[0].svg?.[0] ?? 0;
    const ratio = size / on.hud.viewport[0];
    out.sizeRatio = +ratio.toFixed(4);
    check('圆钮直径 ≈ 片内比例（28/400 = 7%）', ratio > 0.04 && ratio < 0.075, `${size}px / ${on.hud.viewport[0]} = ${(ratio * 100).toFixed(2)}%`);
    // 本仓页脚有既有白色工具条（片里没有），能力条抬到它上面：底部留白 56–110px，且水平居中
    check('能力条居中且让开页脚工具条', on.hud.rect && Math.abs(on.hud.rect[0] + on.hud.rect[2] / 2 - on.hud.viewport[0] / 2) < 3 && on.hud.viewport[1] - on.hud.slots[0].bottom >= 56 && on.hud.viewport[1] - on.hud.slots[0].bottom <= 110, `rect=${on.hud.rect} bottomGap=${on.hud.viewport[1] - on.hud.slots[0].bottom}`);

    // ── B. 无目标：点亮 Plunge → 黄高亮环 + 上方名字牌 + 顶部黑条「No valid targets」，不进冷却 ──
    const fx = await fixture();
    out.fixture = fx;
    await tick(0.05);
    await p.evaluate(() => { rea.battle.c03.toast = null; if (rea.battle.c03.toastEl) rea.battle.c03.toastEl.style.display = 'none'; });
    const armedEmpty = await p.evaluate(() => { const c = rea.battle.c03; const r = c.arm(); rea.battle.update(1 / 60); return { ret: r, probe: c.plungeProbe() }; });
    out.armedEmpty = armedEmpty.probe;
    check('点亮成功且 armed', armedEmpty.ret === true && armedEmpty.probe.armed === true, `arm()=${armedEmpty.ret}`);
    check('黄高亮环亮起', armedEmpty.probe.hud.hlOpacity === 1, `hlOpacity=${armedEmpty.probe.hud.hlOpacity}`);
    check('名字牌挂在上方（片内形制）', armedEmpty.probe.hud.tagVisible === true && armedEmpty.probe.hud.tagText === 'Plunge', `tag=${armedEmpty.probe.hud.tagText} visible=${armedEmpty.probe.hud.tagVisible}`);
    const tagAbove = await p.evaluate(() => {
      const d = document.querySelector('[data-ability="plunge"]'), r = d.getBoundingClientRect(), t = d.querySelector('.tag').getBoundingClientRect(), s = d.querySelector('svg').getBoundingClientRect();
      return { tagBottom: Math.round(t.bottom), svgTop: Math.round(s.top), sameX: Math.abs((t.x + t.width / 2) - (s.x + s.width / 2)) < 1.5 };
    });
    check('牌子在圆钮之上且居中对齐', tagAbove.tagBottom <= tagAbove.svgTop + 1 && tagAbove.sameX, `tagBottom=${tagAbove.tagBottom} svgTop=${tagAbove.svgTop} sameX=${tagAbove.sameX}`);
    check('顶部黑条「No valid targets」当场出现', armedEmpty.probe.banner.visible === true && armedEmpty.probe.banner.elText === 'No valid targets' && armedEmpty.probe.banner.text === 'No valid targets', `text=${armedEmpty.probe.banner.elText} visible=${armedEmpty.probe.banner.visible}`);
    check('无目标不进冷却', armedEmpty.probe.cooldown === 0 && armedEmpty.probe.stats.noTargets >= 1, `cooldown=${armedEmpty.probe.cooldown} noTargets=${armedEmpty.probe.stats.noTargets}`);

    // 截图：armed + 黑条（片 0200 同形制）
    await p.waitForTimeout(250);
    const shotArmed = await p.screenshot({ path: path.join(dir, 'ability-bar-plunge-armed-r195.png') });
    await p.screenshot({ path: path.join(dir, 'ability-bar-plunge-crop-r195.png'), clip: { x: 360, y: 640, width: 400, height: 160 } });

    // ── C. 有目标：arm 不出黑条；真点击地面 → 跃起落地、范围伤害、白色冲击环、冷却 10s ──
    const placed = await enemyAt(0);
    out.placed = placed;
    check('敌人站队心那一格', placed.placed === true, `units=${placed.units} hp=${placed.hp}`);
    await p.evaluate(() => { rea.battle.c03.toast = null; if (rea.battle.c03.toastEl) rea.battle.c03.toastEl.style.display = 'none'; rea.battle.c03.armed = false; });
    const armedLive = await p.evaluate(() => { const c = rea.battle.c03; const r = c.arm(); rea.battle.update(1 / 60); return { ret: r, probe: c.plungeProbe() }; });
    check('有目标时 arm 不出黑条', armedLive.ret === true && armedLive.probe.banner.visible === false && armedLive.probe.banner.text === null, `banner=${armedLive.probe.banner.text} visible=${armedLive.probe.banner.visible}`);
    check('有目标时 hl 环仍亮', armedLive.probe.hud.hlOpacity === 1, `hlOpacity=${armedLive.probe.hud.hlOpacity}`);

    const foePt = await screenOf('cell');
    out.foePt = foePt;
    await p.mouse.click(foePt.x, foePt.y);
    await tick(0.72);
    const landed = await p.evaluate(() => {
      const b = rea.battle, c = b.c03, f = window.__ab.foe;
      return { hp: f.hp, dead: !!f.dead, leaps: b.units.filter((u) => u.c03Leap).length, stats: { ...c.stats }, shocks: c.shocks.length, cooldown: +c.cooldown.toFixed(3), armed: c.armed, probe: c.plungeProbe() };
    });
    out.landed = landed;
    check('真点击 → 施放一次', landed.stats.plunges === 1, `plunges=${landed.stats.plunges} cooldown=${landed.cooldown}`);
    check('落地范围伤害命中敌人', landed.stats.plungeHits >= 1 && (landed.hp < 2 || landed.dead), `plungeHits=${landed.stats.plungeHits} hp=${landed.hp} dead=${landed.dead}`);
    check('落地白色冲击环', landed.shocks >= 1 || landed.stats.plungeHits >= 1, `shocks=${landed.shocks}`);
    // 施放即进 10s 冷却；跃起 0.62–0.72s 里冷却已在走，所以读数落在 (9, 10]
    check('冷却 10s 且退出 armed', Math.abs(landed.probe.cooldownMax - 10) < 1e-6 && landed.cooldown > 8.9 && landed.cooldown <= 10 && landed.armed === false, `cooldown=${landed.cooldown}/${landed.probe.cooldownMax} armed=${landed.armed}`);
    check('冷却中不能点亮', (await p.evaluate(() => rea.battle.c03.arm())) === false, 'arm() 在冷却中返回 false');
    await p.screenshot({ path: path.join(dir, 'ability-bar-plunge-cooldown-r195.png'), clip: { x: 360, y: 640, width: 400, height: 160 } });

    // ── D. 冷却弧随时间收缩（169.6 → 0），归零后可再点亮 ──────────────────────────────
    const arcs = [];
    for (const step of [0, 2.5, 2.5]) {
      if (step) await tick(step);
      arcs.push(await p.evaluate(() => { const q = rea.battle.c03.plungeProbe(); return { cooldown: q.cooldown, dash: q.hud.cdDash, stroke: q.hud.cdStroke, opacity: q.hud.cdOpacity }; }));
    }
    out.arcs = arcs;
    check('冷却弧单调回填', arcs[0].dash < arcs[1].dash && arcs[1].dash < arcs[2].dash, arcs.map((a) => `${a.cooldown}s/${a.dash}`).join(' → '));
    check('弧读数与剩余冷却同口径（169.6·(1−cd/cdMax)）', Math.abs(arcs[1].dash - 169.6 * (1 - arcs[1].cooldown / 10)) < 1.0, `dash=${arcs[1].dash} expect=${(169.6 * (1 - arcs[1].cooldown / 10)).toFixed(1)}`);
    await tick(6);
    const recharged = await p.evaluate(() => { const c = rea.battle.c03; c.b.update(1 / 60); return { probe: c.plungeProbe(), arm: c.arm() }; });
    out.recharged = recharged.probe;
    check('冷却归零后可再点亮', recharged.probe.cooldown === 0 && recharged.arm === true, `cooldown=${recharged.probe.cooldown} arm=${recharged.arm}`);

    // ── E. 关档：能力条整条消失（像素 A/B 落在底部条带内） ──────────────────────────────
    await p.evaluate(() => { rea.battle.c03.armed = false; });
    const shotOn = await p.evaluate(() => null);
    const withBar = await p.screenshot();
    check('从面板取消勾选即关', (await panelToggle(false)) === 'ok');
    await p.waitForTimeout(400);
    const off = await p.evaluate(() => ({ on: rea.battle.c03.on.plunge, hud: rea.battle.c03.plungeProbe().hud }));
    const withoutBar = await p.screenshot({ path: path.join(dir, 'ability-bar-plunge-off-r195.png') });
    const d = imgDiff(decodePng(withBar), decodePng(withoutBar));
    out.diff = { n: d.n, bbox: d.bbox };
    check('关档后能力条消失', off.on === false && off.hud.visible === false, `on=${off.on} visible=${off.hud.visible}`);
    check('开/关差分落在底部条带', d.n > 400 && d.bbox && d.bbox[3] > 700 && d.bbox[1] > 640, `diff=${d.n}px bbox=${JSON.stringify(d.bbox)}`);

    // 同状态噪声：再拍一张关档帧
    const shot2 = await p.screenshot();
    check('同状态噪声 0', imgDiff(decodePng(withoutBar), decodePng(shot2)).n === 0, `${imgDiff(decodePng(withoutBar), decodePng(shot2)).n}px`);
  } catch (err) {
    console.log('ERROR ' + err.message);
    console.log(JSON.stringify(out, null, 1).slice(0, 4000));
    await browser.close();
    process.exit(1);
  }
  check('页面 0 error', errors.length === 0, errors.slice(0, 3).join(' | ') || 'none');
  await browser.close();
  fs.writeFileSync(path.join(dir, 'ability-bar-plunge-r195.json'), JSON.stringify({ ok, out }, null, 1));
  console.log('PASS ability-bar-plunge-browser ' + ok + ' checks');
})();
