// 1244892370392489989 · Better Birdies（更像鸟 / 只有停着才有描边 / 会挪步 / 有倒影 / 飞行更顺）
// 验收：结构上"描边只跟坐着的那份几何共用实例矩阵"，行为上停着的鸟会小步挪动、
// 飞行轨迹连续（无瞬移），倒影组与本体同数。
const { chromium } = require('playwright'), fs = require('fs'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(m.text()); });
  try {
    await p.goto('http://localhost:8769/index.html?scene=town&grid=quad');
    await p.waitForFunction(() => window.rea?.view?.birds?.birds?.length > 0, null, { timeout: 60000 });
    await p.waitForTimeout(1200);

    const result = await p.evaluate(async () => {
      const birds = rea.view.birds, group = birds.group;
      // 1) 描边只在"坐着"那份几何上：只有 1 个 outline 材质，且与 sit 共用实例矩阵
      let outlineMeshes = 0, outlineSharesSit = false;
      group.traverse((o) => {
        const m = o.material;
        // outlineMaterial() = MeshBasicMaterial({ side: BackSide })，其余鸟材质都是正面
        const isOutline = o.isMesh && m && m.isMeshBasicMaterial && m.side === 1;
        if (isOutline) { outlineMeshes++; if (o.instanceMatrix === birds.sit.instanceMatrix) outlineSharesSit = true; }
      });
      const hasFlyOutline = group.children.some((c) => /fly.*outline|outline.*fly/i.test(c.name || ''));
      // 2) 停着的鸟会不会挪步
      const sitter = birds.birds.find((x) => x.state === 'sit');
      const start = sitter ? { x: sitter.pos.x, z: sitter.pos.z } : null;
      let maxHop = 0, sitSteps = 0;
      for (let i = 0; i < 900 && sitter; i++) {
        birds.update(1 / 60);
        if (sitter.state !== 'sit') break;
        sitSteps++;
        const d = Math.hypot(sitter.pos.x - start.x, sitter.pos.z - start.z);
        if (d > maxHop) maxHop = d;
      }
      // 3) 飞行是否顺：取一只在飞的鸟，采样一步位移的变化率
      const flyer = birds.birds.find((x) => x.state === 'fly') || birds.birds[0];
      const track = [];
      for (let i = 0; i < 240; i++) { birds.update(1 / 60); track.push([flyer.pos.x, flyer.pos.y, flyer.pos.z]); }
      let maxStep = 0, maxTurn = 0, flips = 0, prevV = null, prevDir = null;
      for (let i = 1; i < track.length; i++) {
        const v = [track[i][0] - track[i - 1][0], track[i][1] - track[i - 1][1], track[i][2] - track[i - 1][2]];
        const sp = Math.hypot(...v);
        if (sp > maxStep) maxStep = sp;
        if (sp > 1e-9) {
          const d = v.map((x) => x / sp);
          if (prevDir) {
            const dot = d[0] * prevDir[0] + d[1] * prevDir[1] + d[2] * prevDir[2];
            const ang = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
            if (ang > maxTurn) maxTurn = ang;
            if (ang > 90) flips++;
          }
          prevDir = d;
        }
        if (prevV !== null && prevV > 0 && sp > prevV * 6 + 0.05) flips++;
        prevV = sp;
      }
      // 4) 倒影组
      const mirror = birds.reflection;
      return {
        count: birds.birds.length,
        perches: birds.perches.length,
        states: birds.birds.reduce((m, x) => (m[x.state] = (m[x.state] || 0) + 1, m), {}),
        outlineMeshes, outlineSharesSit, hasFlyOutline,
        shuffle: { steps: sitSteps, maxHop: +maxHop.toFixed(3) },
        flight: { maxStep: +maxStep.toFixed(3), maxTurnDeg: +maxTurn.toFixed(1), jumps: flips },
        reflection: { groupVisible: !!mirror?.visible, mirroredSit: birds.sitRef?.count, sitCount: birds.sit?.count },
      };
    });

    assert.ok(result.count > 0 && result.perches > 0, 'birds/perches: ' + JSON.stringify(result));
    assert.equal(result.outlineMeshes, 1, 'exactly one outline mesh (sitting only): ' + result.outlineMeshes);
    assert.ok(result.outlineSharesSit, 'outline must share the sitting instance matrices');
    assert.equal(result.hasFlyOutline, false, 'flying birds must not have an outline');
    assert.ok(result.shuffle.maxHop > 0.02, 'sitting birds must shuffle about: ' + result.shuffle.maxHop);
    assert.ok(result.shuffle.maxHop < 0.6, 'shuffle must stay on the perch: ' + result.shuffle.maxHop);
    assert.ok(result.flight.maxTurnDeg < 60, 'flight heading must be smooth: ' + result.flight.maxTurnDeg + 'deg');
    assert.ok(result.flight.maxStep < 1.2, 'no teleporting in flight: ' + result.flight.maxStep);
    assert.equal(result.reflection.groupVisible, true);
    assert.equal(result.reflection.mirroredSit, result.reflection.sitCount, 'reflection mirrors every sitting bird');

    await p.evaluate(() => {
      const v = rea.view;
      if (v.birds) v.birds.visible = true;
      v.distance = 14; v.pitch = 0.55; v.updateCamera();
      document.querySelectorAll('details, .panel, #helpcard, #toast').forEach((e) => (e.style.display = 'none'));
    });
    await p.waitForTimeout(600);
    await p.screenshot({ path: 'artifacts/coverage/birds-perched.png' });
    assert.deepEqual(errors, []);
    fs.writeFileSync('artifacts/coverage/birds-browser.json', JSON.stringify({ result, errors }, null, 2));
    console.log('PASS better birdies', JSON.stringify(result));
  } finally {
    await b.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
