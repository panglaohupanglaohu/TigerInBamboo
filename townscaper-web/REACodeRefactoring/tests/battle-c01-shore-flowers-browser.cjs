// r185 · 946660607008403456 运行验收（浏览器，真页面 index.html?scene=badnorth）。
// 片子原文："making blood, corpses and arrows stick to boats and adding pretty little flowers"
// → 四条机制一起验，全部读真页面里的真对象（不是 node 替身）：
//   ① 岸上小花簇：默认开（本轮从 shoreFoam 拆出 shoreFlowers）、每簇 4–7 朵、全在四邻同高的台面格、贴顶 +0.012；
//   ② 花与泡沫带解耦：花开着时水面干净（foam 网格根本没建），对上原片「白线是栈桥白边、水面无泡沫带」；
//   ③ 像素 A/B：花层开/关整帧差分 > 0 且差分像素**落在花点投影附近**（不是全屏亮度漂移），同状态噪声 0、开→关→开回位 0；
//   ④ 尸体 / 箭贴附在船上：杀死船上单位 → corpseAnchor 存在、船横摇后逐元素一致；射空的箭 parent === boat.mesh、随船零漂移；
//      甲板血池 opacity 随 gore 上升（整片暗红，不是斑点）。
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');

const OUT = 'artifacts/coverage';
const report = { checks: [], pixels: {}, flowers: {}, attachments: {} };
const check = (name, ok, detail) => { report.checks.push({ name, ok: !!ok, detail }); if (!ok) throw new Error(name + ' → ' + detail); };

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(m.text()); });
  try {
    let booted = false;
    for (let attempt = 0; attempt < 2 && !booted; attempt++) {
      await p.goto('http://localhost:8769/index.html?scene=badnorth&grid=quad');
      booted = await p.waitForFunction(() => window.rea?.battle?.running && window.rea.battle.boats.length > 0, null, { timeout: 60000 }).then(() => true).catch(() => false);
    }
    assert.ok(booted, 'badnorth 场景起不来');

    /* ---------------- ①② 花层读数（真页面默认档） ---------------- */
    const fl = await p.evaluate(() => {
      const b = rea.battle, C = b.c01;
      // 冻住世界：花的位置只与 World 有关，但血/烟会改画面
      b.paused = true;
      const probe = C.flowerProbe();
      const cells = probe.cells;
      // 簇间距：同一簇内点数应==size，簇心不重复
      const uniq = new Set(cells.map((c) => c.cell)).size;
      return {
        probe: { ...probe, cells: cells.slice(0, 8) }, clusters: probe.clusters, points: probe.points,
        sizes: probe.sizes, offLand: probe.offLand, maxYOff: probe.maxYOff, colorMix: probe.colorMix,
        foamOn: probe.foamOn, foamBuilt: probe.foamBuilt, flowersVisible: probe.visible, on: probe.on,
        statsFlowers: C.stats.flowers, statsClusters: C.stats.flowerClusters, uniq,
        flagsDefaultOn: C.on.shoreFlowers, foamDefaultOn: C.on.shoreFoam,
        nsegs: (b.boats[0]?.mesh?.userData?.deckPool?.geometry?.index?.count ?? 0) / 6,
      };
    });
    report.flowers = fl;
    check('花层默认开', fl.on === true && fl.flagsDefaultOn === true && fl.flowersVisible === true, JSON.stringify({ on: fl.on, visible: fl.flowersVisible }));
    check('泡沫带仍默认关（该片水面干净）', fl.foamOn === false && fl.foamBuilt === false, JSON.stringify({ foamOn: fl.foamOn, foamBuilt: fl.foamBuilt }));
    check('花簇存在且每簇 4–7 朵', fl.clusters > 0 && fl.sizes.min >= 4 && fl.sizes.max <= 7, `${fl.clusters} 簇 / ${fl.points} 朵，簇内 ${fl.sizes.min}–${fl.sizes.max}`);
    check('花点全在陆地台面上', fl.offLand === 0, `离地 ${fl.offLand} 朵`);
    check('花贴台面顶 +0.012（视觉偏移后）', fl.maxYOff < 1e-6, `平均 |Δy| ${fl.maxYOff.toExponential(2)}`);
    check('簇格不重复', fl.uniq === fl.clusters, `${fl.uniq} / ${fl.clusters}`);
    check('stats 与探针一致', fl.statsFlowers === fl.points && fl.statsClusters === fl.clusters, JSON.stringify([fl.statsFlowers, fl.statsClusters]));
    check('颜色以米白为主', fl.colorMix && fl.colorMix.cream > 0.6, JSON.stringify(fl.colorMix));

    /* ---------------- ③ 像素 A/B（同机位，冻时间轴） ---------------- */
    await p.evaluate(async () => {
      const T = await import('three');
      const b = rea.battle, v = rea.view, w = b.world;
      document.getElementById('hud')?.style.setProperty('display', 'none');
      document.querySelectorAll('[data-progress-badge]').forEach((n) => { n.closest('div').style.display = 'none'; });
      // 机位：整岛俯视（花长在台面上）
      let cx = 0, cz = 0, n = 0;
      for (const c of w.cells) { if (w.top(c) >= 1) { cx += c.cx; cz += c.cz; n++; } }
      cx /= n || 1; cz /= n || 1;
      const lockCam = () => { v.target.set(cx, 1.2, cz); v.distance = 13; v.pitch = 1.05; v.yaw = Math.PI * 0.2; v.updateCamera(); };
      lockCam();
      window.__pin = lockCam;
      if (!window.__pinT) window.__pinT = setInterval(lockCam, 120);
      window.__camSave = { p: v.camera.position.clone(), q: v.camera.quaternion.clone() };
      window.__origUpdateCamera = v.updateCamera.bind(v);
      v.updateCamera = () => { v.camera.position.copy(window.__camSave.p); v.camera.quaternion.copy(window.__camSave.q); v.camera.updateMatrixWorld(); };
      const orig = v.render.bind(v);
      window.__origRender = orig;
      v.render = () => { orig(0); };
      window.__origFrame = v.onFrame ?? null;
      v.onFrame = null;      // 主循环的 per-frame 钩子（水面 uTime / 旗帜 / 烟）必须停，否则两次截图差 77px（r166 同型）
      b.paused = true;
      // 花点投影（截图坐标系换算要乘 DPR）
      window.__flowerUV = () => {
        const arr = b.c01.flowers.geometry.attributes.position.array, out = [], v3 = new T.Vector3();
        for (let i = 0; i < arr.length / 3; i++) {
          v3.set(arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]).project(v.camera);
          if (v3.z > 1) continue;
          out.push([(v3.x * 0.5 + 0.5), (0.5 - v3.y * 0.5)]);
        }
        return out;
      };
    });
    const state = async () => p.evaluate(() => { window.__pin(); rea.view.render(0); });
    const snap = async (name) => {
      await state();
      await p.waitForTimeout(260);
      await state();
      return { buf: await p.locator('canvas').screenshot({ path: path.join(OUT, name) }) };
    };
    const cmpPng = (bufA, bufB, uv) => p.evaluate(async ([A, B, pts]) => {
      const load = async (b64) => { const blob = await (await fetch('data:image/png;base64,' + b64)).blob(); return createImageBitmap(blob); };
      const ia = await load(A), ib = await load(B), w = ia.width, h = ia.height;
      const c = new OffscreenCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true });
      const grab = async (img) => { g.clearRect(0, 0, w, h); g.drawImage(img, 0, 0); return g.getImageData(0, 0, w, h).data; };
      const da = await grab(ia), db = await grab(ib);
      const near = new Uint8Array(w * h);
      if (pts) { const R = 10; for (const [ux, uy] of pts) { const px = ux * w, py = uy * h; for (let y = Math.max(0, (py - R) | 0); y < Math.min(h, py + R); y++) for (let x = Math.max(0, (px - R) | 0); x < Math.min(w, px + R); x++) near[y * w + x] = 1; } }
      let cnt = 0, onFlower = 0;
      for (let i = 0; i < da.length; i += 4) {
        const la = 0.299 * da[i] + 0.587 * da[i + 1] + 0.114 * da[i + 2];
        const lb = 0.299 * db[i] + 0.587 * db[i + 1] + 0.114 * db[i + 2];
        if (Math.abs(la - lb) > 8) { cnt++; if (near[i / 4]) onFlower++; }
      }
      return { w, h, diffPx: cnt, onFlower, ratio: cnt ? onFlower / cnt : 0 };
    }, [bufA.toString('base64'), bufB.toString('base64'), uv]);

    const on1 = await snap('946660607008403456-flowers-on-r185.png');
    const on2 = await snap('946660607008403456-flowers-on2-r185.png');
    await p.evaluate(() => rea.battle.c01.set('shoreFlowers', false));
    const off = await snap('946660607008403456-flowers-off-r185.png');
    const offProbe = await p.evaluate(() => rea.battle.c01.flowerProbe());
    await p.evaluate(() => rea.battle.c01.set('shoreFlowers', true));
    const back = await snap('946660607008403456-flowers-back-r185.png');
    const backProbe = await p.evaluate(() => rea.battle.c01.flowerProbe());
    const uv = await p.evaluate(() => window.__flowerUV());
    report.pixels = {
      noise: await cmpPng(on1.buf, on2.buf, null),
      onOff: await cmpPng(on1.buf, off.buf, uv),
      restored: await cmpPng(on1.buf, back.buf, null),
      uvPoints: uv.length,
    };
    check('同状态噪声 0', report.pixels.noise.diffPx === 0, `${report.pixels.noise.diffPx} px`);
    check('关花层后花真的不画（几何仍在、visible=false）', offProbe.visible === false && offProbe.points > 0 && backProbe.visible === true, JSON.stringify({ off: offProbe.visible, pts: offProbe.points, back: backProbe.visible }));
    check('花层开/关在画面上可分', report.pixels.onOff.diffPx > 150, `${report.pixels.onOff.diffPx} px（${report.pixels.onOff.w}×${report.pixels.onOff.h}）`);
    check('差分像素落在花点投影附近（不是全屏亮度漂移）', report.pixels.onOff.ratio > 0.6, `${(report.pixels.onOff.ratio * 100).toFixed(1)}% 在 ${report.pixels.uvPoints} 个花点 ±10px 内`);
    check('开→关→开 回位 0', report.pixels.restored.diffPx === 0, `${report.pixels.restored.diffPx} px`);

    /* ---------------- ④ 尸体 / 箭贴附 / 甲板血池（真 Battle） ---------------- */
    const att = await p.evaluate(async () => {
      const T = await import('three'), b = rea.battle;
      const err = (a, c) => Math.max(...a.elements.map((v, i) => Math.abs(v - c.elements[i])));
      b.paused = true; b.t = 4; b.nextWave = 3; b.update(0);
      const boat = b.boats[0], u = boat.crew[0];
      if (!boat || !u) throw Error('没有长船/船员');
      const pool = boat.mesh.userData.deckPool;
      const poolBefore = { opacity: pool.material.opacity, sx: pool.scale.x, segs: pool.geometry.index.count / 6 };
      const arrow = (target, x, y, z) => { const mesh = new T.Object3D(); b.group.add(mesh); const a = { mesh, t: 1, dur: 1, from: [x, y, z], to: [x, y, z], shot: { v: 3, th: Math.PI / 2 }, target, stuck: false }; b.arrows.push(a); b.update(0); return a; };
      u.hp = 1; arrow(u, u.x, u.y + 0.08, u.z);
      const dead = !!u.dead, hasAnchor = !!u.corpseAnchor;
      const anchor = u.corpseAnchor.clone();
      const pose = () => { const m = new T.Matrix4(), i = b.units.filter((v) => !v.dead || !rea.view.goreOff).indexOf(u); b.mBody.getMatrixAt(i, m); return m; };
      const poseErr0 = err(pose(), boat.mesh.matrix.clone().multiply(anchor));
      const oldRoll = boat.mesh.rotation.z;
      const a = arrow({ dead: true }, boat.x, boat.mesh.position.y + 0.12, boat.z);
      const arrowParented = a.mesh.parent === boat.mesh;
      const arrowLocal = a.mesh.matrix.clone();
      b.paused = false; for (let i = 0; i < 24; i++) b.update(1 / 30); b.paused = true;
      const rollChange = Math.abs(oldRoll - boat.mesh.rotation.z);
      const poseErr = err(pose(), boat.mesh.matrix.clone().multiply(anchor));
      b.group.updateMatrixWorld(true);
      const arrowDrift = err(a.mesh.matrixWorld, boat.mesh.matrixWorld.clone().multiply(arrowLocal));
      const poolAfter = { opacity: pool.material.opacity, sx: pool.scale.x, segs: pool.geometry.index.count / 6 };
      const gore = boat.gore ?? 0;
      // 花层：波形开关经 #apply 立即生效，不动到花几何
      return { dead, hasAnchor, poseErr0, poseErr, rollChange, arrowParented, arrowDrift, poolBefore, poolAfter, gore, boatState: boat.state };
    });
    report.attachments = att;
    check('船上单位被击杀 → 捕获贴船姿态', att.dead && att.hasAnchor && att.poseErr0 < 1e-6, JSON.stringify({ dead: att.dead, anchor: att.hasAnchor, err: att.poseErr0 }));
    check('船横摇后尸体仍贴船（逐元素 <1e-6）', att.rollChange > 0.001 && att.poseErr < 1e-6, `roll Δ ${att.rollChange.toFixed(4)} / pose Δ ${att.poseErr.toExponential(2)}`);
    check('射空的箭 attach 到 boat.mesh 且零漂移', att.arrowParented && att.arrowDrift < 1e-9, `parent=${att.arrowParented} drift=${att.arrowDrift.toExponential(2)}`);
    check('甲板血池随 gore 铺开（24 段带子、opacity↑）', att.poolAfter.segs === 24 && att.poolAfter.opacity > att.poolBefore.opacity && att.poolAfter.sx > att.poolBefore.sx, JSON.stringify({ segs: att.poolAfter.segs, o: [att.poolBefore.opacity, +att.poolAfter.opacity.toFixed(3)], sx: [+att.poolBefore.sx.toFixed(3), +att.poolAfter.sx.toFixed(3)] }));

    // 还原现场后拍一张船侧近景（人工看）
    await p.evaluate(() => {
      clearInterval(window.__pinT); window.__pinT = null;
      if (window.__origRender) rea.view.render = window.__origRender;
      if (window.__origUpdateCamera) rea.view.updateCamera = window.__origUpdateCamera;   // 机位锁必须解掉，否则近景不生效
      const b = rea.battle, boat = b.boats[0], v = rea.view;
      v.target.copy(boat.mesh.position); v.distance = 4.2; v.pitch = 1.15; v.yaw = Math.atan2(boat.mesh.position.z, boat.mesh.position.x) + Math.PI * 0.75; v.updateCamera();
      b.paused = false;
    });
    await p.waitForTimeout(1200);
    await p.screenshot({ path: path.join(OUT, '946660607008403456-boat-close-r185.png') });
    check('无 console error', errors.length === 0, errors.slice(0, 2).join(' | '));
    report.errors = errors;
    fs.writeFileSync(path.join(OUT, 'battle-c01-shore-flowers-r185.json'), JSON.stringify(report, null, 1));
    console.log('\nPASS 9466 运行验收（花层 / 解耦 / 尸体·箭贴船 / 甲板血池）', report.checks.length, '项');
    console.log(JSON.stringify({ flowers: { clusters: fl.clusters, points: fl.points, sizes: fl.sizes, colorMix: fl.colorMix }, pixels: report.pixels, att: { rollChange: +att.rollChange.toFixed(4), arrowDrift: att.arrowDrift, pool: att.poolAfter } }));
    await browser.close();
  } catch (e) {
    console.error('FAIL ' + e.message);
    fs.writeFileSync(path.join(OUT, 'battle-c01-shore-flowers-r185.json'), JSON.stringify({ ...report, error: e.message }, null, 1));
    await browser.close();
    process.exit(1);
  }
})();
