#!/usr/bin/env node
/**
 * tests/bary-gizmo-3d-browser.cjs — 974564862729838592 / 974579499802202113 的浏览器运行验收
 *
 * 两条片子拍的是同一件东西：灰地上的三角网 + 一个白球（RGB 移动箭头）被**拖着走**，
 * 白球可离开三角面升到空中、也可拖到三角形外（露出负权重），投影点用白线连到三个顶点，
 * 顶点球大小 ∝ 权重，三角形还能被拉窄/张开。
 *
 * 本测不读日志，全部从页面状态量 + 真实指针事件量：
 *  ① 权重口径：Σw=1、与 Cramer 对账 ≤1e-12、baryPrep3 的 1 减 + 每坐标 1 点积；
 *  ② 离面：|P−平面| == h，投影点 Q 落在平面上（三项点积为 0）；
 *  ③ 真拖白球（pointerdown/move/up）：u/v 跟到落点、Σw 仍 1；
 *  ④ 拖到三角形外：inside=false 且出现负权重；
 *  ⑤ 拖第三个顶点：spread 变、面积比 ≈ spread₂/spread₁（线性）、仍与顶点共面、Σw=1；
 *  ⑥ 像素 A/B：gizmo.group.visible 开/关整帧差分（同帧两次渲染 → 噪声 0）。
 * 用法：NODE_PATH=/tmp/pw-shim:<REA-agent>/node_modules node tests/bary-gizmo-3d-browser.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = 'artifacts/coverage';
const BASE = 'http://127.0.0.1:8769/bary-gizmo.html';
const results = [];
const ok = (name, pass, detail) => { results.push({ name, pass, detail }); if (!pass) throw new Error(`FAIL ${name}: ${JSON.stringify(detail)}`); };
const near = (a, b, eps) => Math.abs(a - b) <= eps;

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  try {
    await page.goto(`${BASE}?grid=quad&clean=1&hud=0&auto=0&u=0.3&v=0.3&h=0.2&spread=1&dist=2.4&pitch=0.78`);
    await page.waitForFunction(() => window.baryGizmoReview?.gizmo, null, { timeout: 90000 });
    await page.waitForTimeout(800);

    // 指针事件直接派发进 iframe 的 canvas（clientX/Y 就是 iframe 视口坐标）。
    // 不用 page.mouse 的 page 坐标：父页 header 会随字体加载变高，iframe 顶边会在 150/167 之间跳，
    // 一旦跳了就整体错位 17px（本轮踩过，表现为"拖到的 u 差了 0.1"）。
    const drag = async (fromClient, toClient, opts = {}) => page.evaluate(([a, b, o]) => {
      const c = window.baryGizmoReview.rea.view.renderer.domElement;
      const ev = (type, p, extra = {}) => c.dispatchEvent(new PointerEvent(type, { clientX: p.x, clientY: p.y, button: 0, buttons: type === 'pointerup' ? 0 : 1, pointerId: 1, pointerType: 'mouse', shiftKey: !!o.shift, bubbles: true, cancelable: true, ...extra }));
      ev('pointerdown', a);
      for (let i = 1; i <= 6; i++) ev('pointermove', { x: a.x + (b.x - a.x) * i / 6, y: a.y + (b.y - a.y) * i / 6 });
      ev('pointerup', b);
    }, [fromClient, toClient, opts]);
    const proj = (p) => page.evaluate((q) => {
      const R = window.baryGizmoReview, cam = R.rea.view.camera, T = R.THREE;
      const v = new T.Vector3(q.x, q.y, q.z).project(cam), c = R.rea.view.renderer.domElement;
      return { x: (v.x * .5 + .5) * c.clientWidth, y: (-v.y * .5 + .5) * c.clientHeight };
    }, p);
    const stats = () => page.evaluate(() => JSON.parse(JSON.stringify(window.baryGizmoReview.gizmo.stats)));
    const state = () => page.evaluate(() => { const s = window.baryGizmoReview.state(); return { A: s.A, B: s.B, C: s.C, P: s.P, Q: s.Q, w: s.w, height: s.height, inside: s.inside, normal: s.normal }; });
    const shot = (name) => page.locator('#scene').screenshot({ path: path.join(OUT, name) });

    /* ① 权重口径 + 运算量 ---------------------------------------------------- */
    const s0 = await stats();
    const st0 = await state();
    ok('Σw=1（1e-12）', near(st0.w[0] + st0.w[1] + st0.w[2], 1, 1e-12), st0.w);
    ok('与 Cramer 对账 ≤1e-12', s0.cramerErr <= 1e-12, s0.cramerErr);
    ok('运算量 = 1 减 + 每坐标 1 点积', s0.ops.sub === 1 && s0.ops.dotPerWeight === 1, s0.ops);
    ok('h=0.2 时 inside=true', s0.inside === true && s0.height > 0.19 && s0.height < 0.201, { inside: s0.inside, h: s0.height });

    /* ② 离面：P 与平面的距离 = h，投影点 Q 在平面上 --------------------------- */
    const plane = await page.evaluate(() => {
      const R = window.baryGizmoReview, s = R.state(), n = s.normal;
      const dist = (p) => (p.x - s.A.x) * n[0] + (p.y - s.A.y) * n[1] + (p.z - s.A.z) * n[2];
      const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
      const pq = [s.P.x - s.Q.x, s.P.y - s.Q.y, s.P.z - s.Q.z], len = Math.hypot(...pq);
      return { qOnPlane: dist(s.Q), pDist: dist(s.P), pqAlongNormal: Math.abs(dot(pq, n) / (len || 1)), len };
    });
    ok('投影点 Q 在三角面上（|dQ|≤1e-12）', Math.abs(plane.qOnPlane) <= 1e-12, plane.qOnPlane);
    ok('|P−平面| = h = 0.2', near(plane.pDist, 0.2, 1e-12), plane.pDist);
    ok('P→Q 沿法线（cos≈1）', plane.pqAlongNormal > 0.999999, plane.pqAlongNormal);

    /* ③ 真拖白球：拖到三角形内部 (u,v)=(0.7,0.15) --------------------------- */
    const dragTo = async (u, v) => {
      const p0 = await page.evaluate(([uu, vv]) => {
        const R = window.baryGizmoReview, p = R.params();
        // 拖动是"在三角面上跟手指"：落点取平面上的点（h=0），球随 h 悬在上方
        return R.gizmoState(R.gizmo.tri, { u: uu, v: vv, h: 0, spread: p.spread }).P;
      }, [u, v]);
      const from = await proj((await state()).P), to = await proj(p0);
      await drag(from, to);
      await page.waitForTimeout(150);
      return { from, to, target: { u, v } };
    };
    const d1 = await dragTo(0.72, 0.14);
    const s1 = await stats();
    ok('拖球后 u 跟到落点（±0.06）', near(s1.u, 0.72, 0.06), { u: s1.u, want: 0.72 });
    ok('拖球后 v 跟到落点（±0.06）', near(s1.v, 0.14, 0.06), { v: s1.v, want: 0.14 });
    ok('拖拽计数 起1/移>0/收1', s1.drag?.mode === 'ball' && s1.drag.starts === 1 && s1.drag.moves > 0 && s1.drag.ends === 1, s1.drag);
    ok('拖完 Σw 仍 1', near(s1.w[0] + s1.w[1] + s1.w[2], 1, 1e-12), s1.w);
    await shot('bary-gizmo-r128-inside.png');

    /* ④ 拖到三角形外 → 负权重 ---------------------------------------------- */
    const d2 = await dragTo(-0.22, 0.35);
    const s2 = await stats();
    ok('拖出三角形后 inside=false', s2.inside === false, s2);
    ok('出现负权重（min w < -0.02）', Math.min(...s2.w) < -0.02, s2.w);
    ok('三角形外 Σw 仍 1', near(s2.w[0] + s2.w[1] + s2.w[2], 1, 1e-12), s2.w);
    ok('拖拽累计 起2/收2', s2.drag.starts === 2 && s2.drag.ends === 2, s2.drag);
    await shot('bary-gizmo-r128-outside.png');

    /* ⑤ 拖第三个顶点 → 三角形拉窄/张开 -------------------------------------- */
    const before = await stats();
    const cScreen = await proj((await state()).C);
    const aScreen = await proj((await state()).A);
    const away = { x: cScreen.x + (cScreen.x - aScreen.x) * 0.45, y: cScreen.y + (cScreen.y - aScreen.y) * 0.45 };
    await drag(cScreen, away);
    await page.waitForTimeout(150);
    const after = await stats();
    const sA = await state();
    ok('拖顶点改变了 spread（>+0.15）', after.spread - before.spread > 0.15, { before: before.spread, after: after.spread });
    // 第三顶点沿 A–B 中位线走 → 与 AB 平行的那一段对面积不贡献，所以面积随 spread **线性**（不是平方）
    ok('面积比 ≈ spread₂/spread₁（线性，±2%）', near(after.area / before.area, after.spread / before.spread, 0.02), { ratio: after.area / before.area, want: after.spread / before.spread });
    ok('拖顶点后 Σw 仍 1、仍在同一平面', near(sA.w[0] + sA.w[1] + sA.w[2], 1, 1e-12) && Math.abs(after.cramerErr) <= 1e-12, { w: sA.w, err: after.cramerErr });
    ok('顶点拖拽计入 drag.mode=vertex', after.drag.mode === 'vertex' && after.drag.starts === 3, after.drag);
    await shot('bary-gizmo-r128-vertex.png');

    /* ⑤b Shift + 拖球 = 把球抬离平面（原片里球是被拖起来的，不是拉滑杆） -------- */
    const hBefore = (await stats()).h;
    const ballNow = await proj((await state()).P);
    await drag(ballNow, { x: ballNow.x, y: ballNow.y - 90 }, { shift: true });
    await page.waitForTimeout(150);
    const sLift = await stats();
    ok('Shift 拖球把球抬起来（h +> 0.1）', sLift.h - hBefore > 0.1, { before: hBefore, after: sLift.h });
    ok('抬起后 height == h、u/v 不变（±0.02）', near(sLift.height, sLift.h, 1e-6) && near(sLift.u, after.u, 0.02) && near(sLift.v, after.v, 0.02), { h: sLift.h, height: sLift.height, u: sLift.u, v: sLift.v });
    ok('抬起计入 drag.mode=lift', sLift.drag.mode === 'lift', sLift.drag);

    /* ⑥ 升空 h=0.6（974579499802202113 那条片子的高离面镜头） --------------- */
    await page.evaluate(() => { document.querySelector('#h').value = 0.6; document.querySelector('#auto').checked = false; });
    await page.waitForTimeout(200);
    const s3 = await stats();
    ok('h 拉到 0.6 后 height=0.6、投影仍在面上', near(s3.h, 0.6, 1e-9) && near(s3.height, 0.6, 1e-6), { h: s3.h, height: s3.height });
    await shot('bary-gizmo-r128-lifted.png');

    /* ⑦ 像素 A/B：gizmo 开/关整帧差分（同一帧两次渲染 → 噪声 0） -------------- */
    const px = await page.evaluate(() => {
      const R = window.baryGizmoReview, T = R.THREE, v = R.rea.view;
      const W = 480, H = 320, rt = new T.WebGLRenderTarget(W, H), buf = new Uint8Array(W * H * 4);
      const grab = (vis) => {
        R.gizmo.group.visible = vis; if (window.baryGizmoWire) window.baryGizmoWire.visible = true;
        v.renderer.setRenderTarget(rt); v.renderer.render(v.scene, v.camera);
        v.renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf); v.renderer.setRenderTarget(null);
        return Uint8Array.from(buf);
      };
      const on = grab(true), off = grab(false), on2 = grab(true);   // on2 = 同状态复测，做噪声底
      R.gizmo.group.visible = true;
      const diff = (a, b) => { let n = 0, white = 0; for (let i = 0; i < a.length; i += 4) { if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 24) n++; if (a[i] > 235 && a[i + 1] > 235 && a[i + 2] > 235) white++; } return { n, white }; };
      const noise = diff(on, on2), onOff = diff(on, off);
      rt.dispose();
      return { noise: noise.n, diff: onOff.n, whiteOn: onOff.white, total: W * H };
    });
    ok('同状态噪声 0', px.noise === 0, px.noise);
    ok('开/关 gizmo 差分 > 300px', px.diff > 300, px);
    ok('关掉后白色像素显著减少', px.whiteOn > 100, px.whiteOn);

    ok('0 console error', errors.length === 0, errors);
    fs.writeFileSync(path.join(OUT, 'bary-gizmo-3d-browser.json'), JSON.stringify({ results, pixels: px, drags: [d1, d2], stats: [s0, s1, s2, after, s3] }, null, 1));
    console.log(results.map((r) => `${r.pass ? 'PASS' : 'FAIL'} ${r.name}`).join('\n'));
    console.log(`\n${results.length}/${results.length} PASS · 像素差分 ${px.diff}px（噪声 ${px.noise}）· 白像素 ${px.whiteOn}`);
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
