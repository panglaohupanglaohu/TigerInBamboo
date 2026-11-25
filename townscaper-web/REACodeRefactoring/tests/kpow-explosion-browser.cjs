// 1092709665199345664「k-pow !!」运行验收（第 119 轮）。
//
// 上一轮（r19 起挂到现在的 note）把本片记成「缺 explodeAt 时序编排与焦痕贴片」，
// 本轮 grep 核实：`src/badnorth/battle-c03.js` 的 `explodeAt()` 就是这件事，且文件头直接署了本片 ID。
// 所以本片是 A 性质：机制在、只缺「从页面真的跑一遍并量出来」。
//
// 片子里的四件事（+ 一件场景件）逐条对应：
//   ① 一点白光 → 2–3 帧膨成亮黄白火球 → 收缩变暗（白→黄→橙）；
//   ② 火球正下方半透明红斑，2 s 内转焦黑并留在原地；
//   ③ 橙色火星上抛 + 重力落尽；
//   ④ 黑烟从火球顶部接上、持续数秒；
//   ⑤ 崖顶红底白字「k-pow !!」横幅 + 白色小人图标（战斗播报道具）。
// 场景里的红盾/蓝盾单位是战斗本体，不是本片机制（r119 纠正：上一轮把红盾敌兵读成了"残留焦痕"）。
const {chromium} = require('playwright');
const fs = require('fs'), path = require('path');

const OUT = path.resolve(__dirname, '../artifacts/coverage');
const BASE = process.env.REA_TEST_URL || 'http://localhost:8769';

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({viewport: {width: 1280, height: 900}});
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  const out = {};
  try {
    // kpow=1 走的是页面入口（scene-capability-panel 的「周期爆炸演示」同一个 URL 开关）
    await page.goto(BASE + '/index.html?scene=badnorth&kpow=1');
    await page.waitForFunction(() => window.rea?.battle?.running, null, {timeout: 60000});
    await page.waitForTimeout(1400);            // 横幅在 #apply 里建，等一帧后取

    // 冻结时间轴：水面涟漪 / 烟 / 相机阻尼都吃真实 dt，同一状态两帧能差出 1 万像素（本轮实测 9867）。
    // dt 钉成 0 后画面只剩「这一帧的可见性」，逐个图层隐藏的 A/B 才是干净的。
    await page.evaluate(() => {
      const v = rea.view, orig = v.render.bind(v);
      v.render = () => orig(0);
      rea.battle.paused = true;                // 单位也不走，dt=0
    });
    await page.waitForTimeout(400);

    /* ---------------- ① 横幅：画布像素 + 挂点 ---------------- */
    out.banner = await page.evaluate(() => {
      const b = rea.battle, c03 = b.c03;
      const sp = c03.banner;
      if (!sp) throw new Error('kpow 开着却没有横幅 sprite');
      const cv = sp.material.map.image;
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let red = 0, white = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], bl = d[i + 2];
        if (r > 150 && g < 100 && bl < 100) red++;
        if (r > 230 && g > 230 && bl > 230) white++;
      }
      const w = b.world; let top = -1, best = null;
      for (const c of w.cells) if (w.top(c) > top) { top = w.top(c); best = c; }
      return {
        w: cv.width, h: cv.height, red, white, visible: sp.visible,
        scale: +sp.scale.x.toFixed(3),
        atTop: Math.abs(sp.position.y - (top * b.L + .75)) < 1e-6,
        onTopCell: Math.hypot(sp.position.x - best.cx, sp.position.z - best.cz) < 1e-6,
        y: +sp.position.y.toFixed(3), top: top,
      };
    });
    if (!(out.banner.red > 3000 && out.banner.white > 300)) throw new Error('横幅贴图不是红底白字：' + JSON.stringify(out.banner));
    if (!out.banner.visible || !out.banner.atTop || !out.banner.onTopCell) throw new Error('横幅没挂在最高台地上：' + JSON.stringify(out.banner));

    /* ---------------- ② 一次性爆炸编排（冻帧逐步推进，时序可复现） ---------------- */
    out.blast = await page.evaluate(() => {
      const b = rea.battle, c03 = b.c03, L = b.L;
      b.paused = true;                       // 暂停后 dt=0：只有手动 afterDraw 推进
      c03.kpowT = 1e9;                       // 关掉自动周期爆炸，免得混进账
      // 清干净（连 mesh 一起摘，否则残留火球会冻在画面上污染截图）
      c03.blasts.forEach((x) => c03.group.remove(x.g)); c03.blasts = [];
      c03.scorches.forEach((x) => c03.group.remove(x.mesh)); c03.scorches = [];
      c03.sparks = []; c03.sparkPoints.geometry.setDrawRange(0, 0);
      // 挑一块台地（top>=2）正中炸：地面可解析，焦痕不会被崖壁挡住
      const w = b.world, cells = w.cells.filter((c) => w.top(c) >= 2);
      cells.sort((a, z) => Math.hypot(a.cx, a.cz) - Math.hypot(z.cx, z.cz));
      const cell = cells[0], gy = w.top(cell) * L;
      const e0 = c03.stats.explosions, s0 = c03.stats.sparks, sc0 = c03.stats.scorches;
      // 不传 ground：焦痕要落在**形变后**的渲染面上（传名义格高会把贴片埋进地形里，本轮踩过）
      c03.explodeAt({x: cell.cx, y: gy + .15, z: cell.cz}, {r: .42, sparks: 28, smokeLife: 2});
      const gReal = +c03.groundAt(cell.cx, cell.cz, gy).toFixed(4);
      const blast = c03.blasts.at(-1), sc = c03.scorches.at(-1), spk = c03.sparks[0];
      const sparkStart = {n: c03.sparks.length, y: +spk.y.toFixed(3), vy: +spk.vy.toFixed(3)};
      // 整条时间线：0.02 s 一步推到火球自己消失（life=.75）
      const samples = []; let aliveAt070 = 0;
      for (let i = 0; i < 60; i++) {
        c03.afterDraw(0.02);
        if (!c03.blasts.includes(blast)) break;         // 到期被摘掉
        samples.push({t: +blast.t.toFixed(3), s: +blast.core.scale.x.toFixed(4),
          rgb: [blast.core.material.color.r, blast.core.material.color.g, blast.core.material.color.b].map((v) => +v.toFixed(3)),
          op: +blast.core.material.opacity.toFixed(3)});
        if (blast.t >= .7) aliveAt070 = 1;
      }
      const aliveAt076 = c03.blasts.length;
      const peak = samples.reduce((a, s) => (s.s > a.s ? s : a), samples[0]);
      const sparkLate = {y: +c03.sparks[0].y.toFixed(3), vy: +c03.sparks[0].vy.toFixed(3), drawRange: c03.sparkPoints.geometry.drawRange.count, t: +blast.t.toFixed(2)};
      // 焦痕：贴地 + 由红（.88,.29,.24）转焦黑，且 2 s 后仍在
      const col = () => [sc.mesh.material.color.r, sc.mesh.material.color.g, sc.mesh.material.color.b].map((v) => +v.toFixed(3));
      while (sc.t < 1) c03.afterDraw(.05);
      const c1 = col();
      while (sc.t < 2.05) c03.afterDraw(.05);
      const c2 = col();
      return {
        cell: {top: w.top(cell), cx: +cell.cx.toFixed(2), cz: +cell.cz.toFixed(2)}, ground: +gy.toFixed(3),
        grewTo: peak.s, peakT: peak.t, tailS: samples.at(-1).s, tailOp: samples.at(-1).op,
        peakRGB: peak.rgb, tailRGB: samples.at(-1).rgb,
        monotoneGrow: samples.filter((s) => s.t <= 0.165).every((s, i, a) => i === 0 || s.s >= a[i - 1].s - 1e-9),
        firstHalf: samples.filter((s) => s.t <= 0.165).map((s) => s.s),
        n: samples.length,
        aliveAt070, aliveAt076,
        scorch: {count: c03.scorches.length, meshY: +sc.mesh.position.y.toFixed(4), groundY: gReal, nominalY: +gy.toFixed(4),
          c0: [0.88, 0.29, 0.24], c1, c2, op: +sc.mesh.material.opacity.toFixed(3), r: +sc.mesh.scale.x.toFixed(3)},
        sparks: {n: sparkStart.n, stats: c03.stats.sparks - s0, start: sparkStart, late: sparkLate},
        counts: {explosions: c03.stats.explosions - e0, scorches: c03.stats.scorches - sc0},
        smokeSources: rea.view.smoke ? rea.view.smoke.sources.length : null,
        smokeTracked: c03.smokes.length,
      };
    });
    const Bl = out.blast;
    if (!(Bl.grewTo > 0.42 * 0.92)) throw new Error('火球没膨胀到半径量级：' + Bl.grewTo);
    if (!Bl.monotoneGrow) throw new Error('膨胀段不是单调长大：' + Bl.firstHalf.join(','));
    if (!(Bl.tailS < Bl.grewTo * 0.5)) throw new Error('火球没收缩：' + Bl.tailS + ' / ' + Bl.grewTo);
    if (!(Bl.tailRGB[1] < Bl.peakRGB[1] && Bl.tailRGB[2] <= Bl.peakRGB[2])) throw new Error('火球没变暗变红：' + JSON.stringify([Bl.peakRGB, Bl.tailRGB]));
    if (!(Bl.tailOp < 0.35)) throw new Error('火球没收尾淡出：' + Bl.tailOp);
    if (!(Bl.aliveAt070 === 1 && Bl.aliveAt076 === 0)) throw new Error('火球寿命不对（.70 应在、.76 应没了）：' + Bl.aliveAt070 + '/' + Bl.aliveAt076);
    if (!(Math.abs(Bl.scorch.meshY - (Bl.scorch.groundY + 0.012)) < 1e-6)) throw new Error('焦痕没贴地：' + Bl.scorch.meshY + ' vs ' + Bl.scorch.groundY);
    if (!(Bl.scorch.c2[0] < 0.2 && Bl.scorch.c2[1] < 0.15)) throw new Error('焦痕没转焦黑：' + JSON.stringify(Bl.scorch.c2));
    if (!(Bl.scorch.count >= 1 && Bl.scorch.op > 0.55)) throw new Error('焦痕贴片不对：' + JSON.stringify(Bl.scorch));
    if (!(Bl.sparks.n === 28 && Bl.sparks.stats === 28 && Bl.counts.scorches === 1 && Bl.counts.explosions === 1)) throw new Error('爆炸台账不对：' + JSON.stringify({s: Bl.sparks, c: Bl.counts}));
    if (!(Bl.sparks.late.vy < Bl.sparks.start.vy - 1.2)) throw new Error('火星没有重力下沉：' + JSON.stringify(Bl.sparks));
    if (!(Bl.sparks.late.drawRange === 28)) throw new Error('火星没进绘制批次：' + Bl.sparks.late.drawRange);

    /* ---------------- ③ 自动周期爆炸（3.5 s 一次，片子里正是这个节拍） ---------------- */
    out.auto = await page.evaluate(() => {
      const c03 = rea.battle.c03;
      c03.scorches.forEach((x) => c03.group.remove(x.mesh)); c03.scorches = [];
      c03.blasts.forEach((x) => c03.group.remove(x.g)); c03.blasts = [];
      const n0 = c03.stats.explosions;
      c03.kpowT = 0.02; c03.afterDraw(0.05);
      return {n0, n1: c03.stats.explosions, reset: +c03.kpowT.toFixed(3), scorches: c03.scorches.length};
    });
    if (!(out.auto.n1 === out.auto.n0 + 1 && out.auto.reset === 3.5)) throw new Error('周期爆炸没按 3.5s 重挂：' + JSON.stringify(out.auto));

    /* ---------------- ④ 像素证据：逐个图层隐藏做 A/B ---------------- */
    const grab = async (name) => {
      const buf = await page.locator('#view').screenshot();
      if (name) fs.writeFileSync(path.join(OUT, name), buf);
      return buf.toString('base64');
    };
    // 横幅先在全岛取景下拍（横幅挂在最高台地，拉近就出画了）
    // 注意：#ensureBanner() 每帧都会把 visible 强置回 true，所以只能连 on.kpow 一起关（=把演示关掉）
    const bannerOn = await grab('kpow-banner-on.png');
    const bannerOff = await (async () => {
      await page.evaluate(() => { const c03 = rea.battle.c03; c03.on.kpow = false; c03.banner.visible = false; });
      return grab('kpow-banner-off.png');
    })();
    await page.evaluate(() => { const c03 = rea.battle.c03; c03.on.kpow = true; c03.banner.visible = true; });
    await page.waitForTimeout(250);

    // 火球 / 焦痕：把相机贴到爆炸点（全岛机位下 r=.42 只有 ~20px，量不出信号），再逐个隐藏
    await page.evaluate(() => {
      const b = rea.battle, c03 = b.c03, v = rea.view, w = b.world, L = b.L;
      // 拍到最高那层台地的开阔面（横幅就挂在那儿）：不会被自己这层台地的边/房子挡住
      const cells = w.cells.filter((c) => w.top(c) >= 2)
        .sort((a, z) => (w.top(z) - w.top(a)) || (Math.hypot(a.cx, a.cz) - Math.hypot(z.cx, z.cz)));
      const cell = cells[0], gy = w.top(cell) * L;
      c03.blasts.forEach((x) => c03.group.remove(x.g)); c03.blasts = [];
      c03.scorches.forEach((x) => c03.group.remove(x.mesh)); c03.scorches = [];
      c03.sparks = []; c03.sparkPoints.geometry.setDrawRange(0, 0);
      c03.explodeAt({x: cell.cx, y: gy + .15, z: cell.cz}, {r: .42, sparks: 28, smokeLife: 2});
      for (let i = 0; i < 9; i++) c03.afterDraw(.01);        // 推到峰值
      const gReal = c03.groundAt(cell.cx, cell.cz, gy);
      v.target.set(cell.cx, gReal + .25, cell.cz);
      v.distance = 6.5; v.pitch = 1.05; v.updateCamera();     // 俯视：贴地圆片不会被自己这层台地的边挡住
      window.__kp = {blast: c03.blasts.at(-1), sc: c03.scorches.at(-1), banner: c03.banner};
    });
    await page.waitForTimeout(400);                            // 等一帧重新出图（render 已被钉成 dt=0）
    const on1 = await grab(null);
    const on2 = await grab(null);                               // 同状态噪声底
    const fireOff = await (async () => {
      await page.evaluate(() => { const {blast} = window.__kp; blast.core.visible = false; blast.halo.visible = false;
        rea.battle.c03.sparks = []; rea.battle.c03.sparkPoints.geometry.setDrawRange(0, 0); });
      return grab('kpow-fireball-off.png');
    })();
    await page.evaluate(() => { const {blast} = window.__kp; blast.core.visible = true; blast.halo.visible = true; });
    await page.waitForTimeout(250);
    const scorchOff = await (async () => {
      await page.evaluate(() => { window.__kp.sc.mesh.visible = false; });
      return grab('kpow-scorch-off.png');
    })();
    await page.evaluate(() => { window.__kp.sc.mesh.visible = true; });
    await page.waitForTimeout(250);
    const onShot = await grab('kpow-explosion-on.png');

    out.diff = await page.evaluate(async ({a, b, c, d, e, f}) => {
      const load = (s) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = 'data:image/png;base64,' + s; });
      const imgs = await Promise.all([a, b, c, d, e, f].map(load));
      const cv = document.createElement('canvas'); cv.width = imgs[0].width; cv.height = imgs[0].height;
      const ctx = cv.getContext('2d', {willReadFrequently: true});
      const px = (im) => { ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(im, 0, 0); return ctx.getImageData(0, 0, cv.width, cv.height).data; };
      const [da, db, dc, dd, de, df] = imgs.map(px);
      // 时间轴冻结后底噪应≈0；仍按「同一变化包围盒内比噪声」的口径算，防止以后又飘。
      const W = cv.width;
      const mask = (x, y, thr) => {
        const m = []; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, ds = [0, 0, 0], n = 0;
        for (let p = 0, i = 0; i < x.length; i += 4, p++) {
          const d = Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]);
          m[p] = d;
          if (d <= thr) continue;
          n++; const cx = p % W, cy = (p / W) | 0;
          if (cx < x0) x0 = cx; if (cx > x1) x1 = cx; if (cy < y0) y0 = cy; if (cy > y1) y1 = cy;
          ds[0] += x[i]; ds[1] += x[i + 1]; ds[2] += x[i + 2];
        }
        return {t: thr, m, n, box: n ? [x0, y0, x1 - x0 + 1, y1 - y0 + 1] : null, mean: n ? ds.map((v) => +(v / n).toFixed(1)) : null};
      };
      const inBox = (m, thr, box) => {
        if (!box) return 0;
        const [bx, by, bw, bh] = box; let n = 0;
        for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) if (m[y * W + x] > thr) n++;
        return n;
      };
      const layer = (x, y, thr) => {
        const all = mask(x, y, thr);
        return {changed: all.n, box: all.box, mean: all.mean, boxPx: all.box ? all.box[2] * all.box[3] : 0};
      };
      const noise = mask(da, db, 40);
      const fireball = layer(da, dc, 60);
      const scorch = layer(da, dd, 30);
      const banner = layer(df, de, 40);          // 横幅两张都是全岛取景，单独配对
      // 噪声只数在各自变化盒里的部分（同面积同位置的公平对照）
      fireball.noiseInBox = inBox(noise.m, 40, fireball.box);
      scorch.noiseInBox = inBox(noise.m, 40, scorch.box);
      banner.noiseInBox = 0;
      const redPx = (x) => { let n = 0; for (let i = 0; i < x.length; i += 4) if (x[i] - x[i + 1] > 30 && x[i] > 110) n++; return n; };
      return {
        noiseGlobal: noise.n,
        fireball, scorch, banner,
        redOn: redPx(da), redOffScorch: redPx(dd),
      };
    }, {a: on1, b: on2, c: fireOff, d: scorchOff, e: bannerOff, f: bannerOn});

    const D = out.diff;
    if (!(D.fireball.changed > Math.max(800, D.fireball.noiseInBox * 4)))
      throw new Error('隐藏火球后画面几乎没变：' + JSON.stringify(D.fireball) + ' 全局噪声=' + D.noiseGlobal);
    if (!(D.scorch.changed > Math.max(400, D.scorch.noiseInBox * 4)))
      throw new Error('隐藏焦痕后画面几乎没变：' + JSON.stringify(D.scorch) + ' 全局噪声=' + D.noiseGlobal);
    if (!(D.banner.changed > Math.max(300, D.banner.noiseInBox * 4)))
      throw new Error('隐藏横幅后画面几乎没变：' + JSON.stringify(D.banner) + ' 全局噪声=' + D.noiseGlobal);
    // 焦痕是红色的：藏掉它以后画面里的红色像素必须减少（同机位同状态，差值只可能来自贴片）。
    // 阈值给 80：贴片是 opacity .55 叠在亮地面上，混完的 r-g 差不大，但方向必须对。
    if (!(D.redOn - D.redOffScorch > 80)) throw new Error('红色焦痕像素没有随贴片消失：' + JSON.stringify({on: D.redOn, off: D.redOffScorch}));
    if (!onShot) throw new Error('没截到开启态');

    if (errors.length) throw new Error('console/page errors: ' + errors.slice(0, 3).join(' | '));
    fs.writeFileSync(path.join(OUT, 'kpow-explosion-browser.json'), JSON.stringify(out, null, 1));
    console.log('PASS kpow explosion', JSON.stringify({
      banner: {red: out.banner.red, white: out.banner.white, onTop: out.banner.atTop, y: out.banner.y},
      blast: {grew: +Bl.grewTo.toFixed(3), shrinkTo: +Bl.tailS.toFixed(3), tailOp: Bl.tailOp, tailRGB: Bl.tailRGB, life: [Bl.aliveAt070, Bl.aliveAt076]},
      scorch: {meshY: Bl.scorch.meshY, groundY: Bl.scorch.groundY, rgb: [Bl.scorch.c1, Bl.scorch.c2], op: Bl.scorch.op},
      sparks: {n: Bl.sparks.n, vyStart: Bl.sparks.start.vy, vyLate: Bl.sparks.late.vy, drawRange: Bl.sparks.late.drawRange},
      auto: out.auto,
      diff: {noiseGlobal: D.noiseGlobal, fireball: D.fireball.changed, fbNoise: D.fireball.noiseInBox,
        scorch: D.scorch.changed, scNoise: D.scorch.noiseInBox, banner: D.banner.changed,
        redOn: D.redOn, redOff: D.redOffScorch},
    }));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
