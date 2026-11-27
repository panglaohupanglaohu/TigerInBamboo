/**
 * edit-fx-main-browser.cjs —— 1260586697538113537（167 帧 / 33.333fps / 5.01s）
 * "Making a trailer is a ton of work. But the good news is I can use the undo/redo stack
 *  for snappier and more directed building footage."
 *
 * 片里的事（sheet-00/01 全 167 帧核过 + 0030/0062/0150 原尺寸回看）：
 *   ① 固定临水机位缓慢推近（全片没有一个剪辑点）；
 *   ② 楼体**一块块**依次长出来，两座粉圆塔在 0080–0150 里逐层长高；
 *   ③ 落水的块脚下白色水花环 + 水滴（0062 原尺寸最清楚：两圈环 + 立柱状水柱）；
 *   ④ 同一段里既有往上盖也有拆掉重盖（undo/redo 栈驱动）。
 *
 * 本仓对应机制：worldMesh.edits（体素差分）→ View.render 里 `editFx.push` 排程错拍
 * （径向波序 + 0.045s 间距，整批压进 maxSpan 1.4s）→ 到期才 `effects.onEdit`
 * （弹性弹出 / 首块落水水花 / 拆除灰尘）与 `sound.onEdit`。
 * 旧 note 的残差「导演镜头轨迹/剪辑节奏/逐动作元数据」= 演示选择（片内就是一台慢推的固定相机），
 * 不是机制；真缺的只是**主场景运行验收** —— node 侧只测了纯数据层，没有一条测试跑过真页面
 * 「一批多格 → 逐条错拍 → 水花/灰尘真的出来」。本轮补这条。
 *
 * 只认页面里的真对象（真 View/真 effects/真渲染帧），不信 exit code。
 */
const { chromium } = require('playwright');
const path = require('path');

const BASE = process.env.REA_BASE || 'http://127.0.0.1:8769';
const DIR = path.resolve(__dirname, '../artifacts/coverage');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const p = await browser.newPage({ viewport: { width: 1100, height: 780 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  let ok = 0;
  const check = (name, cond, detail) => {
    if (!cond) throw new Error(`FAIL ${name}: ${detail}`);
    ok++;
    console.log(`  PASS ${name} — ${detail}`);
  };

  const boot = async (url) => {
    for (let a = 0; a < 3; a++) {
      await p.goto(url, { waitUntil: 'domcontentloaded' });
      try {
        await p.waitForFunction(() => window.rea?.view?.worldMesh?.geometry && window.rea.view.town, null, { timeout: 120000 });
        return;
      } catch (e) { if (a === 2) throw e; console.log('  retry boot ' + (a + 1)); }
    }
  };

  /** 挂钩：记录每次 onEdit 的真实 uTime；水花计数取 effects.crown.n（crown 风格）。 */
  const hook = () => p.evaluate(() => {
    const v = rea.view;
    v.__fx = { log: [] };
    if (!v.__fxHooked) {
      v.__fxHooked = true;
      const orig = v.effects.onEdit.bind(v.effects);
      v.effects.onEdit = (cell, before, after, L) => {
        v.__fx.log.push({ t: +v.waterUniforms.uTime.value.toFixed(4), id: cell.id, before, after });
        return orig(cell, before, after, L);
      };
    }
    v.__fx.log.length = 0;
    return { style: v.effects.splashStyle || 'ring', crown: v.effects.crown?.n || 0, ring: v.effects.ringN || 0 };
  });

  /** 一次 world 变更 → 一帧里出 N 条 edits（真页面 rebuild 路径）。返回排程与已发情况。 */
  const enqueue = (n, op, frames = 2) => p.evaluate(async ({ n, op, frames }) => {
    const { world: w, grid: g, view: v } = rea;
    const sea = (op === 'remove'
      ? g.cells.filter((c) => w.top(c) === 1 && c.edgeNeighbors.some((i) => i >= 0 && w.top(g.cells[i]) === 0))
      : g.cells.filter((c) => w.top(c) === 0 && c.edgeNeighbors.some((i) => i >= 0 && w.top(g.cells[i]) > 0))
    ).slice(0, n);
    const ids = sea.map((c) => c.id);
    const before = { log: v.__fx.log.length, fired: v.editFx.fired, dropped: v.editFx.dropped };
    for (const c of sea) w.setSolid(c, 1, op !== 'remove');
    v.changed();
    for (let k = 0; k < frames; k++) await new Promise((r) => requestAnimationFrame(r));
    const dues = v.editFx.pending.map((x) => +x.due.toFixed(4));
    const t0 = v.waterUniforms.uTime.value;
    return {
      ids, dues, pending: v.editFx.pending.length, t0: +t0.toFixed(4),
      firedNow: v.__fx.log.length - before.log, firedAll: v.editFx.fired - before.fired,
      dropped: v.editFx.dropped - before.dropped, enabled: v.editFx.enabled,
    };
  }, { n, op, frames });

  /** 手动推进动画时钟（1/60 一帧）+ 真队列 drain：只看排程是否按 0.045s 到期。 */
  const drainClock = (seconds = 1.2) => p.evaluate((sec) => {
    const v = rea.view, out = [];
    const stepSec = 1 / 60;
    let t = v.waterUniforms.uTime.value;
    for (let k = 0; k < Math.round(sec / stepSec); k++) {
      t += stepSec;
      v.waterUniforms.uTime.value = t;
      const nf = v.editFx.drain(t, (e) => v.effects.onEdit(e.cell, e.before, e.after, v.levelHeight));
      if (nf) out.push({ t: +t.toFixed(4), n: nf });
    }
    return { fires: out, pending: v.editFx.pending.length };
  }, seconds);

  const stats = (log) => {
    const ts = log.map((x) => x.t);
    const d = ts.slice(1).map((t, i) => +(t - ts[i]).toFixed(4));
    const s = [...d].sort((a, b) => a - b);
    return { n: log.length, deltas: d, median: s.length ? s[Math.floor(s.length / 2)] : 0, span: ts.length > 1 ? +(ts[ts.length - 1] - ts[0]).toFixed(4) : 0 };
  };

  try {
    // ── ① 默认档：一批 12 格落水 ──────────────────────────────────────────
    await boot(`${BASE}/index.html`);
    const h0 = await hook();
    await p.evaluate(() => { rea.view.target.set(0, 1.2, 0); rea.view.distance = 15; rea.view.pitch = 0.6; rea.view.updateCamera(); });
    const A = await enqueue(12, 'add');
    const due0 = A.dues.slice().sort((a, b) => a - b);
    const dd = due0.slice(1).map((t, i) => +(t - due0[i]).toFixed(4));
    const ddS = [...dd].sort((a, b) => a - b);
    console.log('  · 落水批：' + JSON.stringify({ pending: A.pending, firedNow: A.firedNow, dues: due0.slice(0, 4) }));
    check('默认开档', A.enabled === true, `editFx.enabled=${A.enabled} · splashStyle=${h0.style}`);
    check('一批 12 格全进队列', A.pending + A.firedAll >= 11 && (A.pending >= 9),
      `队列还剩 ${A.pending} 条、已发 ${A.firedAll} 条（合计 12；真渲染帧在排空）`);
    check('排程按 12 个不同到期时刻摊开', due0.length >= 9 && ddS[Math.floor(ddS.length / 2)] >= 0.028 && ddS[Math.floor(ddS.length / 2)] <= 0.052,
      `到期差中位 ${ddS[Math.floor(ddS.length / 2)]}s（步长 0.045）· 队列跨度 ${(due0[due0.length - 1] - due0[0]).toFixed(3)}s`);
    const d1 = await drainClock(1.2);
    const L1 = await p.evaluate(() => rea.view.__fx.log.slice());
    const S1 = stats(L1);
    const spl1 = await p.evaluate((n0) => ({ crown: (rea.view.effects.crown?.n || 0) - n0.crown, ring: (rea.view.effects.ringN || 0) - n0.ring }), h0);
    console.log('  · 逐帧 drain：' + JSON.stringify({ fires: d1.fires.slice(0, 5), pending: d1.pending, ...S1, spl: spl1 }));
    check('每帧只发 1 条（错拍）', d1.fires.length >= 9 && d1.fires.every((f) => f.n === 1),
      `${d1.fires.length} 个到期帧全为 1 条/帧 → 不是整片瞬现`);
    check('间隔 ≈0.045s', S1.median >= 0.028 && S1.median <= 0.09 && S1.span >= 0.38 && S1.span <= 0.58,
      `中位 ${S1.median}s · 跨度 ${S1.span}s（11×0.045=0.495 理论）`);
    check('12 条全部到期', S1.n === 12 && d1.pending === 0, `${S1.n} 条 · 队列剩 ${d1.pending}`);
    check('落水水花真的生成', spl1.crown + spl1.ring === 12,
      `12 块 before=0 → crown 水花 +${spl1.crown}（effects.crown.n）· 环 +${spl1.ring}`);

    // ── ② 真渲染帧也能排空（证明 render 里那条 drain 在跑） ────────────────
    await hook();
    const B0 = await enqueue(4, 'add');
    await p.evaluate(() => new Promise((r) => setTimeout(r, 4000)));
    const B1 = await p.evaluate(() => ({ fired: rea.view.__fx.log.length, pending: rea.view.editFx.pending.length }));
    console.log('  · 真渲染 4s：' + JSON.stringify({ B0: { pending: B0.pending, firedNow: B0.firedNow, firedAll: B0.firedAll }, B1 }));
    check('真 render 循环在 drain', B1.fired + B1.pending >= 3 && B1.fired >= 2,
      `4s 内真帧发 ${B1.fired} 条（swiftshader 约 1–2 fps）· 队列剩 ${B1.pending}`);
    await p.screenshot({ path: path.join(DIR, 'edit-fx-stagger-r249.png') });

    // ── ③ 拆除批 → 灰尘（同一条排程） ────────────────────────────────────
    await hook();
    const C = await enqueue(8, 'remove');
    const C1 = await drainClock(0.8);
    const CL = await p.evaluate(() => rea.view.__fx.log.slice());
    const CS = stats(CL);
    const dust = CL.filter((x) => x.after < x.before).length;
    console.log('  · 拆除批：' + JSON.stringify({ pending: C.pending, ...CS, dust }));
    check('拆除也错拍且计入灰尘', CS.n === C.pending + C.firedAll && dust >= 3 && CS.span >= 0.1,
      `${CS.n} 条 · 灰尘 ${dust} 次 · 跨度 ${CS.span}s · 队列剩 ${C1.pending}`);

    // ── ④ 关档对照 ?editfx=0 ─────────────────────────────────────────────
    await boot(`${BASE}/index.html?editfx=0`);
    await hook();
    const D = await enqueue(12, 'add');
    const D1 = await drainClock(0.6);
    const D2 = await p.evaluate(() => ({ fired: rea.view.__fx.log.length, firedCnt: rea.view.editFx.fired }));
    console.log('  · 关档：' + JSON.stringify({ enabled: D.enabled, pending: D.pending, dropped: D.dropped, after: D2 }));
    check('?editfx=0 整层关', D.enabled === false && D.pending === 0 && D.dropped >= 12 && D2.fired === 0 && D2.firedCnt === 0,
      `enabled=${D.enabled} · pending=${D.pending} · dropped=${D.dropped} · onEdit ${D2.fired} 次`);

    check('0 console error', errors.length === 0, errors.length ? errors[0] : '无');
    console.log(`\nPASS edit-fx-main-browser：${ok}/${ok} 项`);
    await browser.close();
    process.exit(0);
  } catch (e) {
    console.log('\n' + (e && e.message ? e.message : e));
    if (errors.length) console.log('pageerror: ' + errors.slice(0, 3).join(' | '));
    await browser.close();
    process.exit(1);
  }
})();
