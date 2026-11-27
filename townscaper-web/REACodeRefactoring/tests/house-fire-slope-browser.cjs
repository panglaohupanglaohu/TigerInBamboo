/**
 * house-fire-slope-browser.cjs —— 828984794407170048（387 帧 / 30.641fps / 12.63s，
 * "PRO TIP: Protect your real estate investments by keeping vikings off your homelands"）
 * 在**真主战场**（index.html?scene=badnorth）里的运行验收。
 *
 * 片里四件事（sheet-00..03 全 387 帧核过 + 0012/0200/0240/0300 原尺寸回看）：
 *   ① 单位沿坡接敌：白甲维京人从低处爬上来，两队交错站在斜坡/台地中段；
 *   ② 屋旁起火：火光 + 火星 + 淡烟，火源在屋顶/屋旁；
 *   ③ 粉色辉光大火球：白黄内核 2–3 帧膨胀，外面一圈品红辉光，屋体瞬间转炭黑；
 *   ④ 爆炸后黑烟、屋顶最黑，单位仍在坡上移动。
 *
 * 本轮真缺口（核实后不是过期账）：`houseFx`（火球 + 屋体焦黑 + 持续黑烟）在 C03 里
 * 一直**默认关** —— 主场景里小屋失守只会被 C01 压黑顶点，不爆火球、没有辉光，
 * 与片 ③ 的观感不符。故给 C03 加 `C03_DEFAULT_ON = ['houseFx']`，`?houseFx=0` 关档。
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
    if (pts.length < 500000) pts.push([x, y]);
  }
  return { n, pts, bbox: n ? [x0, y0, x1, y1] : null };
}
const inside = (pt, box, pad = 0) => pt[0] >= box[0] - pad && pt[0] <= box[2] + pad && pt[1] >= box[1] - pad && pt[1] <= box[3] + pad;

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

  // 同一套夹具（r188 做法）：一队维京人停在小屋门口（门口无守军）→ 起火烧穿 → 失守
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
    window.__fs = { h, u, floor, cam };
    return {
      houseFx: b.c03.on.houseFx, floor, cell: h.cell.id,
      charred0: b.c03.stats.charredVerts, blasts0: b.c03.blasts.length,
      fires0: rea.view.effects.fireSources.length,
    };
  };
  /** 逐秒跑，记时间线：先有火，2.2 s 后才有火球；火球先胀后缩；然后屋体焦黑。 */
  const runTimeline = (seconds = 7) => p.evaluate((sec) => {
    const b = rea.battle, wk = window.__fs, tl = [];
    b.paused = false;
    for (let s = 0; s < sec * 10; s++) {
      for (let i = 0; i < 6; i++) b.update(1 / 60);
      tl.push({
        t: +((s + 1) / 10).toFixed(1),
        lost: wk.h.lost, burn: +wk.h.burn.toFixed(2),
        fires: rea.view.effects.fireSources.length,
        blasts: b.c03.blasts.length,
        scale: +b.c03.blasts.reduce((a, x) => Math.max(a, x.core.scale.x), 0).toFixed(3),
        glow: b.c03.blasts.some((x) => x.glow),
        charred: b.c03.stats.charredVerts,
        smoke: rea.view.smoke?.sources?.length || 0,
      });
    }
    b.paused = true; wk.cam();
    return {
      tl,
      lost: wk.h.lost, burn: +wk.h.burn.toFixed(2),
      maxFireball: +b.c03.stats.maxFireball.toFixed(3),
      charredVerts: b.c03.stats.charredVerts,
      smoke: rea.view.smoke?.sources?.length || 0,
      blasts: b.c03.blasts.length, blastsOn: b.c03.on.houseFx,
    };
  }, seconds);

  try {
    // ── A. 默认档：houseFx 必须已开，且失守 → 火球 + 焦黑 + 烟 ─────────────────────
    await boot('http://127.0.0.1:8769/index.html?scene=badnorth&grid=quad');
    await freezeClock();
    const fx = await p.evaluate(burnFixture);
    out.fixture = fx;
    check('默认档 houseFx 开', fx.houseFx === true, `c03.on.houseFx=${fx.houseFx}`);
    check('起始无火无球', fx.fires0 === 0 && fx.blasts0 === 0 && fx.charred0 === 0, `fires=${fx.fires0} blasts=${fx.blasts0} charred=${fx.charred0}`);

    const run = await runTimeline(7);
    out.run = run;
    const firstFire = run.tl.find((x) => x.fires > 0);
    const firstBlast = run.tl.find((x) => x.blasts > 0);
    check('屋先起火后爆', !!firstFire && !!firstBlast && firstFire.t < firstBlast.t, `火 ${firstFire?.t}s / 球 ${firstBlast?.t}s`);
    check('小屋失守', run.lost === true, `lost=${run.lost} burn=${run.burn}s`);
    check('火球有粉色辉光层', run.tl.some((x) => x.blasts > 0 && x.glow), `glow=${run.tl.filter((x) => x.glow).length} 帧组`);
    check('火球先胀后缩', (() => {
      const sc = run.tl.map((x) => x.scale).filter((s) => s > 0);
      if (sc.length < 3) return false;
      const peak = sc.indexOf(Math.max(...sc));
      return peak > 0 && sc[sc.length - 1] < sc[peak] * 0.95;
    })(), `scales=${run.tl.map((x) => x.scale).filter((s) => s > 0).join('/')} max=${run.maxFireball}`);
    check('屋体焦黑', run.charredVerts > 100, `charredVerts=${run.charredVerts}`);
    check('爆炸后留烟', run.smoke > 0, `smokeSources=${run.smoke}`);

    // 屋格中心屏幕落点（相机矩阵手算，截图坐标 = CSS 像素 × dpr）
    out.housePx = await p.evaluate(() => {
      const b = rea.battle, c = window.__fs.h.cell, cam = rea.view.camera;
      const p3 = [c.cx, b.world.top(c) * b.L + 0.25, c.cz, 1];
      const mul = (m, v) => [0, 1, 2, 3].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * v[3]);
      const v = mul(cam.projectionMatrix.elements, mul(cam.matrixWorldInverse.elements, p3));
      return { x: (v[0] / v[3] * 0.5 + 0.5) * innerWidth, y: (-v[1] / v[3] * 0.5 + 0.5) * innerHeight, houseTop: b.world.top(c) };
    });
    await p.waitForTimeout(900);
    const shotOn = await p.screenshot({ path: path.join(dir, 'house-fire-slope-on-r243.png') });
    const shotOn2 = await p.screenshot({ path: '/tmp/hfs-on2.png' });
    const noise = imgDiff(decodePng(shotOn), decodePng(shotOn2)).n;
    check('同状态噪声 0', noise === 0, `${noise}px`);

    // ── B. 坡面：真楼梯/台地上下坡，脚高跟踏面，不浮不埋 ──────────────────────────
    const slope = await p.evaluate(() => {
      const b = rea.battle, nav = b.navigation, w = b.world, L = b.L;
      nav.refresh();
      const st = (nav.stairs || []).filter((s) => (s.rise || 1) >= 1 && s.low && s.high)
        .sort((a, z) => w.top(z.high) - w.top(a.high))[0];
      if (!st) return { none: true };
      const hi = w.top(st.high), lo = w.top(st.low);
      const sq = b.squads.find((s) => s.alive), u = sq.members.find((m) => !m.dead);
      b.houses = []; b.nextWave = 1e9; b.units = [u];
      sq.members = [u]; sq.alive = true; u.dead = false; u.fall = null; u.onBoat = null; u.stun = 0;
      u.team = 0; u.squad = sq; u.cd = 0;
      u.x = st.high.cx; u.z = st.high.cz; u.navFloor = hi; u.y = hi * L;
      sq.goal = st.low; sq.goalFloor = lo;
      const samples = [];
      b.paused = false;
      for (let i = 0; i < 90; i++) {
        b.update(1 / 60);
        const f = nav.footHeight(u);
        samples.push({ y: +u.y.toFixed(4), f: +f.toFixed(4), err: +(u.y - f).toFixed(4), nf: u.navFloor });
      }
      b.paused = true;
      const tread = [...new Set(samples.map((s) => Math.round(s.f / (L / 4))))];
      const tail = samples.slice(-15);
      return {
        stair: { hi, lo, rise: st.rise || 1, lowCell: st.low.id, highCell: st.high.id },
        y0: samples[0].y, y1: samples[samples.length - 1].y,
        maxErr: Math.max(...samples.map((s) => Math.abs(s.err))),
        maxLag: Math.max(...samples.map((s) => s.err)),          // 缓动滞后（y 高于踏面）= 设计上的 1-exp(-10dt) 追平
        sink: Math.min(...samples.map((s) => s.err)),            // 沉进地形（负值）才算真缺陷
        settleErr: Math.max(...tail.map((s) => Math.abs(s.err))),
        midY: samples.filter((s) => s.y > lo * L + 0.15 && s.y < hi * L - 0.15).length,
        treadLevels: tread.length, go: !!sq.goal,
      };
    });
    out.slope = slope;
    check('岛上有楼梯/台地', !slope.none, JSON.stringify(slope.stair));
    check('下坡有位移', Math.abs(slope.y1 - slope.y0) > 0.4 && slope.y1 < slope.y0, `y ${slope.y0}→${slope.y1} (楼层 ${slope.stair.hi}→${slope.stair.lo})`);
    check('从不沉进地形', slope.sink > -0.05, `min(y-footHeight)=${slope.sink}`);
    check('落定后脚高贴踏面', slope.settleErr < 0.02, `settle|y-footHeight|=${slope.settleErr}（过程中缓动滞后 max ${slope.maxLag}）`);
    check('下坡经过中间踏面', slope.treadLevels >= 3, `tread levels=${slope.treadLevels} 中间帧=${slope.midY}`);

    // ── C. 关档对照：?houseFx=0 同夹具 7 s → 不爆火球、不压黑 ──────────────────────
    await p.goto('about:blank');
    await boot('http://127.0.0.1:8769/index.html?scene=badnorth&grid=quad&houseFx=0');
    await freezeClock();
    const fxOff = await p.evaluate(burnFixture);
    const runOff = await runTimeline(7);
    out.off = { houseFx: fxOff.houseFx, lost: runOff.lost, charredVerts: runOff.charredVerts, maxFireball: runOff.maxFireball, blasts: runOff.blasts };
    check('关档 houseFx 关', fxOff.houseFx === false, `c03.on.houseFx=${fxOff.houseFx}`);
    check('关档不爆球', runOff.maxFireball === 0 && runOff.blasts === 0, `maxFireball=${runOff.maxFireball} blasts=${runOff.blasts}`);
    check('关档屋体不压黑', runOff.charredVerts === 0, `charredVerts=${runOff.charredVerts}`);
    await p.waitForTimeout(900);
    const shotOff = await p.screenshot({ path: path.join(dir, 'house-fire-slope-off-r243.png') });

    // ── D. 像素差分：默认档 vs 关档，差异应落在屋格附近 ────────────────────────────
    const A = decodePng(shotOn), B = decodePng(shotOff);
    const d = imgDiff(A, B);
    const hx = out.housePx.x, hy = out.housePx.y;
    const box = [hx - 210, hy - 260, hx + 210, hy + 210];
    const near = d.pts.filter((pt) => inside(pt, box, 40)).length;
    out.pixel = { diff: d.n, bbox: d.bbox, near, frac: +(near / Math.max(1, d.n)).toFixed(3), housePx: [Math.round(hx), Math.round(hy)] };
    check('开/关画面有差异', d.n > 3000, `${d.n}px bbox=${JSON.stringify(d.bbox)}`);
    check('差异落在屋格附近', out.pixel.frac > 0.5, `near=${near}/${d.n} = ${out.pixel.frac}`);

    check('控制台零 error', errors.length === 0, errors.slice(0, 3).join(' | ') || 'none');
    fs.writeFileSync(path.join(dir, 'house-fire-slope-r243.json'), JSON.stringify({ ok, ...out }, null, 2));
    console.log(`\nhouse-fire-slope-browser: ${ok} checks PASS`);
  } catch (e) {
    fs.writeFileSync(path.join(dir, 'house-fire-slope-r243.json'), JSON.stringify({ ok, error: String(e.message || e), ...out, errors }, null, 2));
    console.error('\n' + String(e.stack || e));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
