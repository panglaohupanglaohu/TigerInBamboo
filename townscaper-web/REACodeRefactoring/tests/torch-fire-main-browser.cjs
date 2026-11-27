/**
 * torch-fire-main-browser.cjs —— 890611046435627008（666 帧 / ~30.6fps / 22.2s，原文
 * "Just a birthday gif from yours truly"）在**真主战场**（index.html?scene=badnorth）里的运行验收。
 *
 * 片里四件事（sheet-00..06 全 666 帧核过 + 0060/0115/0240/0610/0660 原尺寸回看）：
 *   ① 三层台地同时开打：高层蓝队 + 中层矛兵 + 低层小屋，单位沿阶梯上下支援；
 *   ② 金色「Move」命令牌在 0045 / 0305 / 0392 三处弹出（属 1016680972610359298，本片不复核）；
 *   ③ **橙色火团从画外飞到屋顶**（0115 原尺寸：亮橙小团 + 黄芯辉光 + 火星拖尾，抛物线掠过墙面），
 *      命中后屋顶持续燃烧（0120–0665 同一位置的橙焰 + 淡烟），不是「失守后才爆一次」；
 *   ④ 击杀飘字 +6 / +6 / +12 / +192（0610 原尺寸，白字带上浮），属 damage-numbers 的击杀奖励池。
 *
 * 本轮真缺口（核实后不是过期账）：`torches`（维京人贴近小屋后每 2–2.8s 朝屋顶抛火团、命中加燃烧）
 * 在 C03 里一直**默认关** —— 主战场只有 `houseFx` 的「失守后爆一次火球」，开打期间屋顶不烧，
 * 与片 ③ 的连续抛火/持续燃烧不符。故把 `torches` 并进 `C03_DEFAULT_ON`，`?torches=0` 关档。
 *
 * 只看真画出来的像素（截图 PNG 解回来数橙色像素），不信 exit code。
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
/** 橙色火团像素：亮橙/黄芯（片中 #ffb340 内核 + #ff7a30 辉光，toneMapped:false 直出）。 */
function countOrange(img, box) {
  let n = 0;
  const [bx0, by0, bx1, by1] = box;
  for (let y = Math.max(0, by0); y < Math.min(img.h, by1); y++) {
    for (let x = Math.max(0, bx0); x < Math.min(img.w, bx1); x++) {
      const i = (y * img.w + x) * img.bpp;
      const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
      if (r > 200 && g > 110 && g < 215 && b < 120 && r - b > 90) n++;
    }
  }
  return n;
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

  /** 夹具：一队维京人（team 1）站在有门小屋门口，同层（片内维京人就是贴到屋边抛火）。 */
  const torchFixture = () => {
    const b = rea.battle, w = b.world;
    b.paused = true; b.scale = 1; b.wave = 2; b.nextWave = 1e9; b.t = 10;
    const h = b.houses.find((x) => x.door && !x.lost);
    const sq = b.squads.find((s) => s.alive);
    const u = sq.members.filter((m) => !m.dead)[0];
    const floor = w.top(h.door);
    b.houses = [h];
    sq.members = [u]; sq.alive = true;
    u.team = 1; u.squad = null; u.cd = 100; u.dead = false; u.fall = null; u.onBoat = null;
    u.x = h.door.cx; u.z = h.door.cz; u.y = floor * b.L; u.navFloor = floor;
    u.torchCd = 0;
    b.units = [u];
    const cam = () => {
      const y = (w.top(h.cell) + 0.3) * b.L;
      rea.view.target.set(h.cell.cx, y, h.cell.cz);
      rea.view.distance = 8.0; rea.view.pitch = 0.95; rea.view.updateCamera();
    };
    cam();
    window.__tf = { h, u, floor, cam };
    return {
      torches: b.c03.on.torches, houseFx: b.c03.on.houseFx,
      floor, cell: h.cell.id, burn0: +h.burn.toFixed(2),
      t0: b.c03.stats.torches, hits0: b.c03.stats.torchHits,
    };
  };

  /** 逐 1/60s 跑到「火团正在飞」的瞬间停下（t 在 0.4–0.65），返回弧线与燃烧读数。 */
  const runToMidFlight = (maxSec = 12) => p.evaluate((lim) => {
    const b = rea.battle, wk = window.__tf, c = b.c03;
    b.paused = false;
    const arc = [];
    let steps = 0, sawMid = false;
    const ceil = Math.round(lim * 60);
    while (steps++ < ceil) {
      b.update(1 / 60);
      for (const f of c.torchList) {
        const t = Math.min(1, f.t);
        const lin = f.from.y + (f.to.y - f.from.y) * t;
        arc.push({ t: +t.toFixed(2), slack: +(f.mesh.position.y - lin).toFixed(4) });
        if (t > 0.45 && t < 0.65) sawMid = true;
      }
      if (sawMid && c.torchList.length) break;
    }
    b.paused = true; wk.cam();
    return {
      steps, sec: +(steps / 60).toFixed(2), sawMid,
      inFlight: c.torchList.length,
      torches: c.stats.torches, hits: c.stats.torchHits,
      burn: +wk.h.burn.toFixed(2), lost: wk.h.lost,
      sparks: c.sparks.length, blasts: c.blasts.length,
      maxSlack: arc.length ? Math.max(...arc.map((a) => a.slack)) : 0,
      arcSamples: arc.length,
    };
  }, maxSec);

  /** 继续跑满 remaining 秒，拿总账（连抛次数 / 命中 / 燃烧）。 */
  const runRest = (sec) => p.evaluate((s) => {
    const b = rea.battle, wk = window.__tf, c = b.c03;
    b.paused = false;
    for (let i = 0; i < Math.round(s * 60); i++) b.update(1 / 60);
    b.paused = true; wk.cam();
    return {
      torches: c.stats.torches, hits: c.stats.torchHits,
      burn: +wk.h.burn.toFixed(2), lost: wk.h.lost,
      fires: rea.view.effects.fireSources.length,
      smoke: rea.view.smoke?.sources?.length || 0,
    };
  }, sec);

  const houseScreen = () => p.evaluate(() => {
    const b = rea.battle, c = window.__tf.h.cell, cam = rea.view.camera;
    const p3 = [c.cx, b.world.top(c) * b.L + 0.25, c.cz, 1];
    const mul = (m, v) => [0, 1, 2, 3].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * v[3]);
    const v = mul(cam.projectionMatrix.elements, mul(cam.matrixWorldInverse.elements, p3));
    return { x: (v[0] / v[3] * 0.5 + 0.5) * innerWidth, y: (-v[1] / v[3] * 0.5 + 0.5) * innerHeight };
  });

  try {
    // ── A. 默认档 quad：torches 必须已开，火团真抛、真走抛物线、真加燃烧 ───────────
    await boot('http://127.0.0.1:8769/index.html?scene=badnorth&grid=quad');
    await freezeClock();
    const fx = await p.evaluate(torchFixture);
    out.fixture = fx;
    check('默认档 torches 开', fx.torches === true, `c03.on.torches=${fx.torches}`);
    check('起始无火团无命中', fx.t0 === 0 && fx.hits0 === 0, `torches=${fx.t0} hits=${fx.hits0}`);

    const mid = await runToMidFlight(12);
    out.mid = mid;
    check('维京人抛火团', mid.torches >= 1, `torches=${mid.torches} @${mid.sec}s`);
    check('截到飞行中的火团', mid.inFlight >= 1 && mid.sawMid, `inFlight=${mid.inFlight} sawMid=${mid.sawMid}`);
    check('火团走抛物线（高于直线）', mid.maxSlack > 0.2, `maxSlack=${mid.maxSlack} 样本=${mid.arcSamples}`);

    const hx = await houseScreen();
    out.housePx = { x: Math.round(hx.x), y: Math.round(hx.y) };
    await p.waitForTimeout(600);
    const shotOn = await p.screenshot({ path: path.join(dir, 'torch-fire-on-quad-r246.png') });
    const shotOn2 = await p.screenshot({ path: '/tmp/torch-on2.png' });
    const noise = imgDiff(decodePng(shotOn), decodePng(shotOn2)).n;
    // 实测 2px 抖动（swiftshader 对 additive 辉光的 AA 差），如实记，不放宽到「随便多少都行」
    check('同状态噪声 ≤4px', noise <= 4, `${noise}px`);

    const rest = await runRest(9);
    out.rest = rest;
    // 屋在 burn>4 就失守（battle.js:1127），片中失守后不再抛 —— 所以连抛只发生在失守前那 ~4s 里
    check('连续抛多枚（2–2.8s 一枚，失守前）', rest.torches >= 2, `torches=${rest.torches} / 9s（屋 ${rest.lost ? '已失守' : '未失守'}）`);
    check('命中计数与抛出资数同步', rest.hits >= 2, `hits=${rest.hits} torches=${rest.torches}`);
    check('命中加燃烧（不是只在失守后烧）', rest.burn >= 2.0, `burn=${rest.burn}`);

    // ── B. 关档对照：?torches=0 同夹具 12s → 一枚都不抛、燃烧不涨 ─────────────────
    await p.goto('about:blank');
    await boot('http://127.0.0.1:8769/index.html?scene=badnorth&grid=quad&torches=0');
    await freezeClock();
    const fxOff = await p.evaluate(torchFixture);
    const midOff = await runToMidFlight(12);
    const restOff = await runRest(9);
    out.off = { torches: fxOff.torches, mid: midOff.torches, rest: restOff.torches, hits: restOff.hits, burn: restOff.burn };
    check('关档 torches 关', fxOff.torches === false, `c03.on.torches=${fxOff.torches}`);
    check('关档不抛火团', restOff.torches === 0 && restOff.hits === 0, `torches=${restOff.torches} hits=${restOff.hits}`);
    // battle.js:1126 里「维京人在场且无守军」本身每秒 +dt 就够 4s 失守 —— 所以关档的 burn 不是 0，
    // 关档该证明的是「没有 1.1/枚 的火团加成」，故与开档同夹具同秒数对比差额。
    check('关档燃烧只按计时累计（无 1.1/枚 加成）', restOff.hits === 0 && (rest.burn - restOff.burn) > 0.9,
      `off burn=${restOff.burn} vs on burn=${rest.burn}（差 ${(rest.burn - restOff.burn).toFixed(2)}）`);
    await p.evaluate(() => { rea.battle.paused = true; window.__tf.cam(); });
    await p.waitForTimeout(600);
    const shotOff = await p.screenshot({ path: path.join(dir, 'torch-fire-off-quad-r246.png') });

    // ── C. 像素账：同一机位，开档屋周有橙色火团/火苗，关档没有 ─────────────────────
    const A = decodePng(shotOn), B = decodePng(shotOff);
    const box = [Math.round(hx.x) - 150, Math.round(hx.y) - 170, Math.round(hx.x) + 150, Math.round(hx.y) + 120];
    const orangeOn = countOrange(A, box), orangeOff = countOrange(B, box);
    const d = imgDiff(A, B);
    out.pixel = { box, orangeOn, orangeOff, diff: d.n, bbox: d.bbox };
    check('开档屋周有橙色火像素', orangeOn > 40, `orange=${orangeOn}（关档 ${orangeOff}）`);
    check('开/关差异落在屋周', d.n > 200 && d.pts.filter((pt) => inside(pt, box, 60)).length / d.n > 0.5,
      `diff=${d.n} frac=${(d.pts.filter((pt) => inside(pt, box, 60)).length / d.n).toFixed(3)} bbox=${JSON.stringify(d.bbox)}`);

    // ── D. mixed 网格同一套夹具复跑（片子是三层台地岛，两种网格都要能抛） ──────────
    await p.goto('about:blank');
    await boot('http://127.0.0.1:8769/index.html?scene=badnorth&grid=mixed');
    await freezeClock();
    const fxm = await p.evaluate(torchFixture);
    const restM = await runRest(12);
    out.mixed = { torches: fxm.torches, ...restM };
    check('mixed 默认抛火', fxm.torches === true && restM.torches >= 2 && restM.hits >= 2,
      `torches=${restM.torches} hits=${restM.hits} burn=${restM.burn}`);

    check('控制台零 error', errors.length === 0, errors.slice(0, 3).join(' | ') || 'none');
    fs.writeFileSync(path.join(dir, 'torch-fire-main-r246.json'), JSON.stringify({ ok, ...out }, null, 2));
    console.log(`\ntorch-fire-main-browser: ${ok} checks PASS`);
  } catch (e) {
    console.error('FAILED: ' + e.message);
    console.error('errors: ' + errors.slice(0, 5).join(' | '));
    fs.writeFileSync(path.join(dir, 'torch-fire-main-r246.json'), JSON.stringify({ ok, error: e.message, ...out }, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
