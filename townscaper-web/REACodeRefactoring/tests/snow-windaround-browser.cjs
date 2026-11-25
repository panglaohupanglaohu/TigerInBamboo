/* 943230624369868800 · "the snow flakes are affected by the wind system and thus flow around the island"
 * 运行：NODE_PATH=/tmp/pw-shim:<REA-agent>/node_modules node tests/snow-windaround-browser.cjs
 * 口径：这条片子里能看见的只有「空中细小雪点在动 + 雪落不到岛体内部 + 地面混白」，
 *       所以这里只认四件可在真场景里读到的事：
 *       ① 雪点是软圆片（片元按 gl_PointCoord 半径丢弃），不是方点；
 *       ② 每粒尺寸/透明度不是统一值（aSize/aAlpha 有分布，且接触 AO 让贴地的那层更实）；
 *       ③ 风场在障碍面法向上把「撞向岛体」的分量去掉（= 绕着走），并往上抬；
 *       ④ 画面里真的多了白色粒子、且同状态不会自己乱跳。
 */
const { chromium } = require('playwright'), fs = require('fs'), path = require('path'), assert = require('node:assert/strict');
const OUT = path.resolve(__dirname, '../artifacts/coverage');
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const errors = [], reports = [], shots = [];
  let p;
  try {
    p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
    p.on('pageerror', (e) => { errors.push(e.message); console.error('PAGE', e.message); });
    p.on('console', (m) => { if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(m.text()); });
    await p.goto('http://localhost:8769/flow.html');
    await p.waitForFunction(() => window.flowReview?.ready, null, { timeout: 90000 });
    await p.click('#open');                       // 楼板1 + 洞顶3 的夹具（岛体 + 悬挑）
    await p.check('#snow');
    await p.waitForTimeout(300);

    const R = await p.evaluate(() => {
      const r = document.querySelector('#scene').contentWindow.rea, A = r.view.atmosphere, view = r.view, world = r.world;
      const P = A.snowPos, N = A.snowN, sz = A.snowSize, al = A.snowAlpha;
      const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
      const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };
      const out = {};

      // ① 软圆片：着色器里按 gl_PointCoord 半径丢弃 + 边缘 smoothstep（方点是整块矩形）
      const vs = A.snow.material.vertexShader, fs = A.snow.material.fragmentShader;
      out.shader = {
        pointCoord: /gl_PointCoord/.test(fs),
        radialDiscard: /length\s*\(\s*gl_PointCoord\s*-\s*\.5\s*\)/.test(fs) && /discard/.test(fs),
        softEdge: /smoothstep/.test(fs),
        perParticleSize: /attribute\s+float\s+aSize/.test(vs) && /aSize\s*\*/.test(vs),
        perParticleAlpha: /attribute\s+float\s+aAlpha/.test(vs),
        sizeNotConstant: !/gl_PointSize\s*=\s*[\d.]+\s*;/.test(vs),
      };

      // ② 逐粒尺寸分布（不是统一值）
      const sizes = Array.from(sz);
      out.size = { n: sizes.length, min: +Math.min(...sizes).toFixed(4), max: +Math.max(...sizes).toFixed(4), cv: +(sd(sizes) / mean(sizes)).toFixed(4), distinct: new Set(sizes.map((v) => v.toFixed(3))).size };

      // ③ 风场绕岛：把「撞向障碍」的法向分量去掉 + 障碍处上抬
      const f = A.field, base = A.uWind.value, RES = f.res;
      const cells = world.cells;
      const cx = mean(cells.map((c) => c.cx)), cz = mean(cells.map((c) => c.cz));
      const solidAt = (x, y, z) => A.probes.occupied(x, y, z);
      // 岛体半径（用真实实心格的最远距离）
      let Rdeg = 0; for (const c of cells) if (world.isSolid(c, 1)) Rdeg = Math.max(Rdeg, Math.hypot(c.cx - cx, c.cz - cz));
      out.island = { cells: cells.length, solidRadius: +Rdeg.toFixed(3), center: [+cx.toFixed(3), +cz.toFixed(3)], levelHeight: view.levelHeight };

      const wn = Math.hypot(base.x, base.z) || 1, wu = [base.x / wn, base.z / wn];
      const sampleAt = (x, y, z) => { const v = A.sample(x, y, z); return [v.x, v.y, v.z]; };
      // 迎风面/障碍侧取一圈采样点（三个高度 × 两档半径）：沿风分量应被压低、切向分量与上抬应出现 = 绕行
      const H = view.levelHeight;
      const ring = [];
      for (const rt of [.5, .75, 1.0]) for (const hy of [.5, 1.0, 1.5]) {
        for (let a = 0; a < 24; a++) {
          const th = a / 24 * Math.PI * 2, rr = Math.max(0.6, Rdeg * rt);
          const x = cx + Math.cos(th) * rr, z = cz + Math.sin(th) * rr, y = H * hy;
          const v = sampleAt(x, y, z);
          const along = v[0] * wu[0] + v[2] * wu[1], across = -v[0] * wu[1] + v[2] * wu[0];
          ring.push({ th: +th.toFixed(3), rt, hy, along: +along.toFixed(4), across: +across.toFixed(4), lift: +v[1].toFixed(4), inSolid: solidAt(x, y, z) });
        }
      }
      const far = sampleAt(f.x0 + 1, H * 1.2, cz);         // 远处（同高度、场边界内侧）
      const farAlong = far[0] * wu[0] + far[2] * wu[1];
      const air = ring.filter((q) => !q.inSolid);
      const blocked = air.filter((q) => q.along < farAlong * .85);        // 沿风分量被压掉 >15%
      out.ring = {
        farAlong: +farAlong.toFixed(4), points: ring.length, air: air.length, blocked: blocked.length,
        blockedHalf: air.filter((q) => q.along < farAlong * .5).length,
        inSolid: ring.length - air.length,
        maxLift: +Math.max(...air.map((q) => q.lift)).toFixed(4),
        minAlong: +Math.min(...air.map((q) => q.along)).toFixed(4),
        maxAcross: +Math.max(...air.map((q) => Math.abs(q.across))).toFixed(4),
      };

      // ③b 轨迹：在岛体上风侧、岛体投影宽度内撒点 —— 同一批点跑「直线」与「风场」两条路，
      //     风场路径必须被推偏（横向偏移）且 0 步进入实心；直线路径作为对照（照直走会撞进去）
      const spanX = f.W * RES, spanZ = f.H * RES;
      const dt = 1 / 60, fall = -.32, steps = 240;
      const paths = [];
      let inside = 0, respawn = 0, deflected = 0, straightHit = 0, seeds = 0;
      for (const hy of [.6, 1.0, 1.5]) for (let s = -6; s <= 6; s++) {
        const z0 = cz + s * Rdeg / 6, y0 = H * hy;
        const x0 = cx - (Rdeg + .8) * wu[0], zz0 = cz + s * Rdeg / 6 - (Rdeg + .8) * wu[1];
        seeds++;
        // 直线对照：同样的基础风 + 下落，不含绕行
        let sx = x0, sy = y0, sz = zz0, hit = false;
        for (let k = 0; k < steps; k++) {
          sx += base.x * .9 * dt; sz += base.z * .9 * dt; sy += fall * dt;
          if (sy < .02) break;
          if (solidAt(sx, sy, sz)) { hit = true; break; }
        }
        if (hit) straightHit++;
        // 风场路径
        let x = x0, y = y0, z = zz0, dev = 0, n = 0, lift = 0, sx2 = x0, sy2 = y0, sz2 = zz0;
        for (let k = 0; k < steps; k++) {
          const v = sampleAt(x, y, z);
          const nx = x + v[0] * .9 * dt, ny = y + (v[1] * .6 + fall) * dt, nz = z + v[2] * .9 * dt;
          sx2 += base.x * .9 * dt; sz2 += base.z * .9 * dt; sy2 += fall * dt;
          if (ny < .02 || nx < f.x0 || nz < f.z0 || nx > f.x0 + spanX || nz > f.z0 + spanZ || solidAt(nx, ny, nz)) { respawn++; break; }
          x = nx; y = ny; z = nz; n++;
          if (solidAt(x, y, z)) inside++;
          dev = Math.max(dev, Math.abs((x - x0) * -wu[1] + (z - zz0) * wu[0]));
          lift = Math.max(lift, y - sy2);   // 相对「只有基础风+下落」的直线，风场把粒子抬多高
        }
        if (lift > .02 || dev > Rdeg * .2) deflected++;
        paths.push({ n, dev: +dev.toFixed(3), lift: +lift.toFixed(3), hy, straightHit: hit });
      }
      out.trace = {
        seeds, straightHit, deflected, insideSteps: inside, respawn,
        meanSteps: +(mean(paths.map((q) => q.n))).toFixed(1),
        maxDev: +Math.max(...paths.map((q) => q.dev)).toFixed(3),
        meanDev: +mean(paths.map((q) => q.dev)).toFixed(3),
        devAboveHalfR: paths.filter((q) => q.dev > Rdeg * .5).length,
        maxLift: +Math.max(...paths.map((q) => q.lift)).toFixed(3),
        meanLift: +mean(paths.map((q) => q.lift)).toFixed(3),
        lifted: paths.filter((q) => q.lift > .02).length,
      };

      // ④ 接触 AO：贴支撑面的粒子更淡（particleContactAlpha: base*(near+(1-near)*min(1,h/fade))），
      //    离岛越远越淡（*(1-.45*distance01)）；且透明度不是统一值
      A.snow.visible = true;
      for (let i = 0; i < 90; i++) A.update(1 / 60);
      const buckets = { near: [], mid: [], high: [] };
      const recs = [];
      let ns = 0;
      for (let k = 0; k < N; k++) {
        const x = P[k * 3], y = P[k * 3 + 1], z = P[k * 3 + 2];
        const sup = A.probes.supportBelow(x, z, y);
        if (!sup) continue;
        const h = y - sup.y, a = al[k]; ns++;
        recs.push({ h, a, d: Math.hypot(x - cx, z - cz) });
        (h < .35 ? buckets.near : h < 1.0 ? buckets.mid : buckets.high).push(a);
      }
      const ds = recs.map((q) => q.d).sort((a, c) => a - c), dmed = ds[ds.length >> 1] ?? 0;
      const radial = { inner: recs.filter((q) => q.d < dmed).map((q) => q.a), outer: recs.filter((q) => q.d >= dmed).map((q) => q.a) };
      const mn = (a) => a.length ? +mean(a).toFixed(4) : null;
      out.alpha = {
        n: ns, min: +Math.min(...al).toFixed(4), max: +Math.max(...al).toFixed(4), cv: +(sd(al) / mean(al)).toFixed(4),
        near: mn(buckets.near), mid: mn(buckets.mid), high: mn(buckets.high),
        nNear: buckets.near.length, nHigh: buckets.high.length,
        inner: mn(radial.inner), outer: mn(radial.outer), nInner: radial.inner.length, nOuter: radial.outer.length,
      };
      // 落地/穿模：跑 90 帧后不应有粒子待在实心里
      let inSolidNow = 0;
      for (let k = 0; k < N; k++) if (solidAt(P[k * 3], P[k * 3 + 1], P[k * 3 + 2])) inSolidNow++;
      out.inSolidNow = inSolidNow;
      out.fieldVersion = A.field.worldVersion;
      out.worldVersion = world.version;

      // 反向风：同一个点沿风分量符号翻转（证明读数来自共享风场，而不是常量）
      A.setWindDirection(180);
      const rev = A.sample(cx + (wu[0] > 0 ? 2 : -2), H * 1.2, cz);
      A.setWindDirection(0);
      const fwd = A.sample(cx + (wu[0] > 0 ? 2 : -2), H * 1.2, cz);
      out.reversed = { along: +(rev.x * wu[0] + rev.z * wu[1]).toFixed(4), forward: +(fwd.x * wu[0] + fwd.z * wu[1]).toFixed(4) };
      return out;
    });
    reports.push({ grid: await p.evaluate(() => document.querySelector('#mixed').checked ? 'mixed' : 'quad'), ...R });
    console.log('MEASURED', JSON.stringify(R, null, 1).slice(0, 2600));

    // 结构断言
    for (const k of ['pointCoord', 'radialDiscard', 'softEdge', 'perParticleSize', 'perParticleAlpha', 'sizeNotConstant'])
      assert.ok(R.shader[k], '雪片着色器缺 ' + k + '：' + JSON.stringify(R.shader));
    assert.ok(R.size.cv > .1, '每粒尺寸几乎是统一值（cv ' + R.size.cv + '）');
    assert.ok(R.size.distinct > 100, 'aSize 只有 ' + R.size.distinct + ' 种取值');
    assert.ok(R.ring.blocked >= 3, '障碍侧沿风分量被压低的采样点太少：' + JSON.stringify(R.ring));
    assert.ok(R.ring.maxLift > 0, '障碍处没有上抬：' + R.ring.maxLift);
    assert.ok(R.ring.maxAcross > 0, '没有切向绕行分量：' + R.ring.maxAcross);
    // 环上落在实心的点只计数（r=0.5R 的高度带会切到岛体本身），不当作违例
    assert.equal(R.trace.insideSteps, 0, '轨迹进入了实心体素 ' + R.trace.insideSteps + ' 步');
    assert.ok(R.trace.straightHit > 0, '对照组（直线）一条都没撞进岛体，夹具没有挡住粒子：' + JSON.stringify(R.trace));
    assert.ok(R.trace.deflected >= 8, '被风场推偏/抬升的轨迹太少：' + JSON.stringify(R.trace));
    assert.ok(R.trace.maxLift > .05, '风场没把粒子抬过障碍：' + R.trace.maxLift);
    // 岛体直径 26.8 wu（Rdeg），绕行只在障碍近旁几格内发生，故按「> 1/4 格」而不是按岛半径判
    assert.ok(R.trace.maxDev > .1, '轨迹横向偏移太小（没有绕行）：max ' + R.trace.maxDev);
    assert.equal(R.inSolidNow, 0, '跑 90 帧后有粒子卡在实心里：' + R.inSolidNow);
    assert.ok(R.alpha.cv > .05, '透明度几乎是统一值：' + JSON.stringify(R.alpha));
    assert.ok(R.alpha.nNear > 0 && R.alpha.nHigh > 0 && R.alpha.near < R.alpha.high, '贴支撑面的一层没有更淡（接触 AO 方向不对）：' + JSON.stringify(R.alpha));
    assert.ok(R.alpha.inner != null && R.alpha.outer != null && R.alpha.inner > R.alpha.outer, '离岛越远没有更淡：' + JSON.stringify(R.alpha));
    assert.ok(R.reversed.along < 0 && R.reversed.forward > 0, '反向风没有翻转共享风场读数：' + JSON.stringify(R.reversed));

    // 画面：雪 关 / 开 / 再关 —— 只在**纯天空带**（上 20%，岛体与地表混白都不在内）数白色像素
    const shot = async (name) => { const f = path.join(OUT, name); await p.locator('#scene').screenshot({ path: f }); shots.push(f); return (await p.locator('#scene').screenshot()).toString('base64'); };
    const grab = async (on) => {
      await p.evaluate((v) => document.querySelector('#scene').contentWindow.rea.view.setDebug('snow', v), on);
      await p.waitForTimeout(450);
      return (await p.locator('#scene').screenshot()).toString('base64');
    };
    const off1 = await grab(false), off2 = await grab(false), on1 = await grab(true), on2 = await grab(true), back = await grab(false), back2 = await grab(false);
    const pix = await p.evaluate(async ({ off1, off2, on1, on2, back, back2 }) => {
      const dec = async (s) => { const r = await fetch('data:image/png;base64,' + s), bm = await createImageBitmap(await r.blob()); const c = new OffscreenCanvas(bm.width, bm.height), x = c.getContext('2d'); x.drawImage(bm, 0, 0); return x.getImageData(0, 0, bm.width, bm.height); };
      const A = await dec(off1), B = await dec(off2), C = await dec(on1), D = await dec(on2), E = await dec(back), F = await dec(back2);
      const W = A.width, H = A.height, skyH = Math.floor(H * .20);
      // 带内差分（雪点是 1–2px 的淡点：亮度阈值抓不到，按 abs diff 数）
      const diff = (X, Y, y1) => { let n = 0, sum = 0; for (let y = 0; y < y1; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; const d = Math.abs(X.data[i] - Y.data[i]) + Math.abs(X.data[i + 1] - Y.data[i + 1]) + Math.abs(X.data[i + 2] - Y.data[i + 2]); if (d > 12) { n++; sum += d; } } return { n, sum }; };
      // 提亮像素：雪点是「比底更亮的点」，云的缓慢漂移提亮不到 30 级
      const brighten = (X, Y, y1, th = 30) => { let n = 0; for (let y = 0; y < y1; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; const lx = .299 * X.data[i] + .587 * X.data[i + 1] + .114 * X.data[i + 2], ly = .299 * Y.data[i] + .587 * Y.data[i + 1] + .114 * Y.data[i + 2]; if (ly - lx > th) n++; } return n; };
      // 亮像素增量（用来分开「雪点」与「地面混白」）
      const white = (X, y0, y1) => { let n = 0; for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; const r = X.data[i], g = X.data[i + 1], b = X.data[i + 2]; if (r > 205 && g > 205 && b > 205 && Math.max(r, g, b) - Math.min(r, g, b) < 24) n++; } return n; };
      return {
        size: [W, H], skyH,
        skyNoise: diff(A, B, skyH).n, skyOn: diff(A, C, skyH).n, skyOff2: diff(A, E, skyH).n, skySum: diff(A, C, skyH).sum,
        fullNoise: diff(A, B, H).n, fullOn: diff(A, C, H).n,
        skyBrightOn: brighten(A, C, skyH), skyBrightNoise: brighten(A, B, skyH), skyBrightBack: brighten(E, F, skyH),   // 关雪之后连续两张之间：不应再有雪点源
        whiteSky: [white(A, 0, skyH), white(C, 0, skyH)],
        whiteFull: [white(A, 0, H), white(C, 0, H)],
      };
    }, { off1, off2, on1, on2, back, back2 });
    reports.push({ pix });
    console.log('PIX', JSON.stringify(pix));
    // 天空带里飘云也在动（差分噪声 ~5e2 px），所以判据用「提亮 ≥30 级的点」= 真雪点
    assert.ok(pix.skyBrightOn > 300, '纯天空带里提亮的雪点太少：' + pix.skyBrightOn);
    assert.ok(pix.skyBrightOn > pix.skyBrightNoise * 3, '雪点提亮没盖过云噪声：' + pix.skyBrightOn + ' vs ' + pix.skyBrightNoise);
    assert.ok(pix.skyBrightBack < pix.skyBrightOn * .6, '关掉雪后天空带仍有一批提亮点：' + pix.skyBrightBack + ' vs on ' + pix.skyBrightOn);
    assert.ok(pix.whiteFull[1] > pix.whiteFull[0] * 1.3, '地面混白（uSnow）没有生效：' + JSON.stringify(pix.whiteFull));
    // 回位由 skyBrightBack（关雪后连续两张）判：1200px 级 diff 是飘云在几秒里的位移，不是雪

    // 真实画面：把镜头拉近拍两张（近景看雪点 + 岛体）
    await p.evaluate(() => { const v = document.querySelector('#scene').contentWindow.rea.view; v.target.set(0, 1.2, 0); v.distance = 9; v.pitch = .12; v.updateCamera(); });
    await p.check('#wind');
    await p.waitForTimeout(600);
    await shot('snow-wind-close-r210.png');
  } finally {
    fs.writeFileSync(path.join(OUT, 'snow-windaround-browser.json'), JSON.stringify({ reports, errors, shots }, null, 2));
    await b.close();
  }
  assert.deepEqual(errors, []);
  console.log('PASS 943230624369868800 软圆片/逐粒尺寸/接触 AO/风场绕岛 + 画面 A/B');
})().catch((e) => { console.error(e); process.exit(1); });
