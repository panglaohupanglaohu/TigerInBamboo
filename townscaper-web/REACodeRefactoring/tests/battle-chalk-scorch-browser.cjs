/**
 * battle-chalk-scorch-browser.cjs —— 1007587828992266240（300 帧 / 31.348fps / 9.57s，2018-06-15 无原文）
 * 在真主战场（index.html?scene=badnorth）里的运行验收。
 *
 * 片里四件事（帧 0000–0299 联系表 + 0060/0150/0299 原尺寸 4× 裁切核过）：
 *   ① 白垩崖台地上**两队混战**（蓝甲白盔守军 vs 红/粉维京人，尸体与暗红血渍铺在草地上）；
 *   ② 小屋失守后**烧起来**：白芯火团 + 黑烟柱，屋体转炭黑；
 *   ③ 屋周的草地留下**焦黑斑**（崖缘那一段最明显），并有余烬上飘；
 *   ④ 台面上立着**两面旗**（左黄、中紫，紫旗带白徽），旗杆细、旗面下垂。
 *
 * 本轮真缺口（核实后不是过期账）：③ 在主战场**默认不出现** —— `charHouse` 只把屋体顶点压黑，
 * 焦痕贴片在 C02（`scorch`，默认关）与 C03（`houseFx`，默认关）里各有一份，两处都不开。
 * 故给 C02 加 `C02_DEFAULT_ON = ['scorch']`（照 C01 `houseChar` 先例），`?c02=-scorch` 关档。
 *
 * 只看真画出来的像素（截图 PNG 解回来算差分），不信 exit code。
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
  const pts = [];
  for (let px = 0; px < A.w * A.h; px++) {
    const i = px * A.bpp, j = px * B.bpp;
    if (Math.abs(A.data[i] - B.data[j]) + Math.abs(A.data[i + 1] - B.data[j + 1]) + Math.abs(A.data[i + 2] - B.data[j + 2]) <= 6) continue;
    n++;
    const x = px % A.w, y = Math.floor(px / A.w);
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (pts.length < 400000) pts.push([x, y]);
  }
  return { n, pts, bbox: n ? [x0, y0, x1, y1] : null };
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

  // 冻时间轴（r131 做法）：主循环每帧 `view.render(dt)` 都把 uTime 往前推，
  // 不冻的话同状态两张截图整帧都在变（水面/天空 shader ~12 万 px 差）。
  const freezeClock = () => p.evaluate(() => {
    const v = rea.view;
    if (v.__frozen) return;
    const orig = v.render.bind(v);
    v.render = () => orig(0);
    v.__frozen = true;
  });

  // 同一套夹具：把一队维京人放在某栋小屋门口（门口无守军）→ 4 s 后失守
  const burnFixture = () => {
    const b = rea.battle, w = b.world;
    b.paused = true; b.scale = 1; b.wave = 2; b.nextWave = 1e9; b.t = 10;
    const h = b.houses.find((x) => x.door);
    const sq = b.squads.find((s) => s.alive);
    const u = sq.members.filter((m) => !m.dead)[0];
    const floor = w.top(h.door);
    b.houses = [h];
    sq.members = [u]; sq.alive = true;
    u.team = 1; u.squad = null; u.cd = 100; u.dead = false; u.fall = null; u.onBoat = null;
    u.x = h.door.cx; u.z = h.door.cz; u.y = floor * b.L; u.navFloor = floor;
    b.units = [u];
    const cam = () => {
      const y = (w.top(h.cell) + 0.3) * b.L;
      rea.view.target.set(h.cell.cx, y, h.cell.cz);
      rea.view.distance = 8.5; rea.view.pitch = 0.95; rea.view.updateCamera();
    };
    cam();
    window.__chalk = { h, u, floor, cam };
    const islandSig = { cells: w.cells.length, tops: w.cells.reduce((a, c) => a + w.top(c), 0), houses: b.houses.length };
    return { floor, cell: h.cell.id, scorch: b.c02.on.scorch, c02Count: b.c02.scorch.count, fireSources: rea.view.effects.fireSources.length, islandSig };
  };
  const runBurn = (seconds = 40) => {
    const b = rea.battle, wk = window.__chalk;
    b.paused = false;
    for (let i = 0; i < 60 * seconds; i++) b.update(1 / 60);
    b.paused = true;
    wk.cam();
    return {
      lost: wk.h.lost, burn: +wk.h.burn.toFixed(2),
      charred: b.c01.stats.housesCharred, charredVerts: b.c01.stats.charredVerts,
      glows: b.c01.stats.glows, fires: rea.view.effects.fireSources.length, showFire: !!rea.view.effects.showFire,
      smokeSources: rea.view.smoke?.sources.length || 0,
      scorchOn: b.c02.on.scorch, scorched: b.c02.stats.scorched, decals: b.c02.scorch.count, embers: b.c02.stats.embers,
    };
  };

  try {
    // ── A. 默认档（不带任何 c02 参数）：失守小屋必须有焦痕 + 屋体焦黑 + 火 + 烟 ────────
    await boot('http://127.0.0.1:8769/index.html?scene=badnorth&grid=quad');
    await freezeClock();
    const fx = await p.evaluate(burnFixture);
    check('默认档 scorch 开', fx.scorch === true, `c02.on.scorch=${fx.scorch}`);
    check('起始无焦痕', fx.c02Count === 0 && fx.fireSources === 0, `decals=${fx.c02Count} fires=${fx.fireSources}`);

    const on = await p.evaluate(runBurn);
    out.on = on;
    check('小屋失守', on.lost === true, `lost=${on.lost} burn=${on.burn}s`);
    check('屋体焦黑', on.charred >= 1 && on.charredVerts > 100, `housesCharred=${on.charred} verts=${on.charredVerts}`);
    check('火光 + 黑烟', on.fires > 0 && on.smokeSources > 0, `fireSources=${on.fires} smokeSources=${on.smokeSources} glowDiscs=${on.glows}`);
    check('屋周焦痕默认落片', on.scorchOn === true && on.scorched >= 1 && on.decals >= 2, `scorchOn=${on.scorchOn} scorched=${on.scorched} decals=${on.decals}`);
    check('余烬上飘', on.embers > 0, `embers=${on.embers}`);

    // 屋格中心的屏幕落点（用相机矩阵手算，截图坐标 = CSS 像素 × dpr）
    out.housePx = await p.evaluate(() => {
      const b = rea.battle, c = window.__chalk.h.cell, cam = rea.view.camera;
      const p3 = [c.cx, b.world.top(c) * b.L + 0.2, c.cz, 1];
      const mul = (m, v) => [0, 1, 2, 3].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * v[3]);
      const v = mul(cam.projectionMatrix.elements, mul(cam.matrixWorldInverse.elements, p3));
      return { x: (v[0] / v[3] * 0.5 + 0.5) * innerWidth, y: (-v[1] / v[3] * 0.5 + 0.5) * innerHeight };
    });

    await p.waitForTimeout(900);
    const shotOn = await p.screenshot({ path: path.join(dir, 'battle-chalk-scorch-on-r188.png') });

    // ── B. 同 URL 再渲一次：噪声 0（相机/时间都冻着）─────────────────────────────
    const shotOn2 = await p.screenshot({ path: '/tmp/c188-on2.png' });
    // 宽机位：同一帧再拍一张，看得见烟柱与屋周地面
    await p.evaluate(() => { const b = rea.battle, h = window.__chalk.h; rea.view.target.set(h.cell.cx, b.world.top(h.cell) * b.L + 0.8, h.cell.cz); rea.view.distance = 13; rea.view.pitch = 0.62; rea.view.updateCamera(); });
    await p.waitForTimeout(700);
    await p.screenshot({ path: path.join(dir, 'battle-chalk-scorch-wide-r188.png') });
    await p.evaluate(() => window.__chalk.cam());
    await p.waitForTimeout(500);
    const noise = imgDiff(decodePng(shotOn), decodePng(shotOn2)).n;
    check('同状态噪声 0', noise === 0, `${noise}px`);

    // ── C. 两队混战：守军 vs 维京人贴脸 → 掉血 / 尸体 / 血渍，且两队旗都在 ──────────
    const melee = await p.evaluate(() => {
      const b = rea.battle, w = b.world, wk = window.__chalk;
      const cell = wk.h.door || wk.h.cell, floor = w.top(cell);
      const sqDef = b.squads[2], sqVik = b.squads[1];
      const def = sqDef.members[0], def2 = sqDef.members[1];
      const vik = sqVik.members[0];
      b.houses = []; b.nextWave = 1e9; b.t = 20;
      const put = (u, dx, dz) => { u.x = cell.cx + dx; u.z = cell.cz + dz; u.y = floor * b.L; u.navFloor = floor; u.dead = false; u.fall = null; u.onBoat = null; u.cd = 0; u.hp = u.max = 6; };
      put(def, -0.11, 0); put(def2, -0.11, 0.10); put(vik, 0.10, 0);
      def.team = 0; def.squad = sqDef; def2.team = 0; def2.squad = sqDef;
      vik.team = 1; vik.squad = null;
      sqDef.members = [def, def2]; sqDef.alive = true; sqVik.members = [vik]; sqVik.alive = true;
      sqDef.goal = cell; sqDef.goalFloor = floor;
      b.units = [def, def2, vik];
      for (const sq of b.squads) { if (sq === sqDef || sq === sqVik) continue; sq.alive = false; }
      // 旗：失守前两队都还在场（片里台面上同时立着两面旗）；打完之后只要求「还活着的小队」旗在
      const flagState = () => b.squads.filter((sq) => sq.alive).map((sq) => ({ id: sq.id, visible: !!sq.flag?.visible, cloth: !!sq.flag?.userData?.cloth?.visible }));
      const flagsBefore = flagState();
      const blood0 = b.blood.count;
      b.paused = false;
      for (let i = 0; i < 60 * 12; i++) b.update(1 / 60);
      b.paused = true;
      const textureMean = (sq) => {
        const img = sq.flag?.userData?.cloth?.material?.map?.image;
        if (!img?.data) return null;
        let r = 0, g = 0, bl = 0, n = 0;
        for (let i = 0; i < img.data.length; i += 4) {
          if (img.data[i + 3] < 200) continue;
          r += img.data[i]; g += img.data[i + 1]; bl += img.data[i + 2]; n++;
        }
        return n ? [Math.round(r / n), Math.round(g / n), Math.round(bl / n)] : null;
      };
      wk.cam(); rea.view.distance = 6.2;
      rea.view.updateCamera();
      return {
        hp: [def.hp, def2.hp, vik.hp], dead: [def.dead, def2.dead, vik.dead],
        blood: b.blood.count - blood0, bloodTotal: b.blood.count, drops: b.drops.length,
        hitFlashes: b.c01.stats.hitFlashes,
        flagsBefore, flags: flagState(),
        colors: b.squads.map((s) => ({ id: s.id, mean: textureMean(s) })),
      };
    });
    out.melee = melee;
    check('近战掉血', melee.hp.some((h) => h < 6), `hp=${melee.hp.join('/')}`);
    check('流血/尸体', melee.blood > 0 || melee.drops > 0, `newStains=${melee.blood} drops=${melee.drops} total=${melee.bloodTotal}`);
    check('两队旗都在', melee.flagsBefore.length >= 2 && melee.flagsBefore.every((f) => f.visible && f.cloth), JSON.stringify(melee.flagsBefore));
    check('存活小队旗仍立', melee.flags.length >= 1 && melee.flags.every((f) => f.visible && f.cloth), JSON.stringify(melee.flags));
    const cols = melee.colors.filter((c) => c.mean).map((c) => c.mean);
    const warm = cols.filter((c) => c[0] > c[2] + 20);
    check('旗面配色可分（含暖色/黄旗）', cols.length >= 2 && warm.length >= 1 && cols.some((c) => c[2] > c[0] + 10), JSON.stringify(cols));
    await p.waitForTimeout(700);
    await p.screenshot({ path: path.join(dir, 'battle-chalk-melee-r188.png') });

    // ── D. `?c02=-scorch` 关档：焦痕 0，画面其余照旧 ─────────────────────────────
    await boot('http://127.0.0.1:8769/index.html?scene=badnorth&grid=quad&c02=-scorch');
    await freezeClock();
    const fx2 = await p.evaluate(burnFixture);
    check('关档 scorch 关', fx2.scorch === false, `c02.on.scorch=${fx2.scorch}`);
    out.sig = { on: fx.islandSig, off: fx2.islandSig };
    check('两档同一座岛', JSON.stringify(fx.islandSig) === JSON.stringify(fx2.islandSig), JSON.stringify(out.sig));
    const off = await p.evaluate(runBurn);
    out.off = off;
    check('关档无焦痕', off.scorched === 0 && off.decals === 0 && off.embers === 0, `scorched=${off.scorched} decals=${off.decals} embers=${off.embers}`);
    check('关档屋体仍焦黑 + 火烟照旧', off.charred >= 1 && off.fires > 0, `charred=${off.charred} fires=${off.fires}`);
    await p.waitForTimeout(900);
    const shotOff = await p.screenshot({ path: path.join(dir, 'battle-chalk-scorch-off-r188.png') });

    // ── E. A/B 差分：焦痕像素落在屋格投影框内，且不是全屏乱闪 ────────────────────
    const A = decodePng(shotOn), B = decodePng(shotOff);
    const d = imgDiff(A, B);
    out.ab = { px: d.n, bbox: d.bbox, size: [A.w, A.h] };
    check('开/关差分 > 300px', d.n > 300, `${d.n}px bbox=${JSON.stringify(d.bbox)}`);
    const proj = out.housePx;
    out.proj = proj;
    check('差分包围盒覆盖屋格投影点', d.bbox && proj.x > d.bbox[0] - 120 && proj.x < d.bbox[2] + 120 && proj.y > d.bbox[1] - 120 && proj.y < d.bbox[3] + 120,
      `house@(${proj.x.toFixed(0)},${proj.y.toFixed(0)}) bbox=${JSON.stringify(d.bbox)}`);

    check('0 console error', errors.length === 0, errors.join(' | ') || 'none');

    fs.writeFileSync(path.join(dir, 'battle-chalk-scorch-browser.json'), JSON.stringify({ ok, out, errors }, null, 2));
    console.log(`\nALL PASS ${ok} checks\n` + JSON.stringify(out, null, 2));
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
