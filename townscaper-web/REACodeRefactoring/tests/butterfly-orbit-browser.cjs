// 1273520600221433857 · 蝴蝶"绕着落点松转 + 随机换落点 + 世界空间噪声"；1270725616430530566 · 花园里的蝴蝶；
// 1279107097108635649 · 545 块拼图与模块签名调试色。
// 验收：蝴蝶真的在绕自己的落点转圈、3–9 秒换一次落点、翅膀在扇；
//       模块签名配色能从场景面板打开（本轮补的入口），打开后世界网格顶点色真的换了，且能报出用到几种签名。
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('fs');

(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 1100, height: 800 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(m.text()); });
  try {
    await p.goto('http://127.0.0.1:8769/index.html?scene=town&grid=quad');
    await p.waitForFunction(() => window.rea?.view?.decor?.bugs?.length > 1, null, { timeout: 60000 });
    await p.waitForTimeout(1500);

    const off = await p.screenshot({ path: 'artifacts/coverage/modules-off.png' });

    const r = await p.evaluate(async () => {
      const view = rea.view, d = view.decor;
      const n = d.bugs.length, count = d.butterflies.count;
      // 1) 绕落点：逐帧记录到"当前落点"的水平距离（11 秒）。换落点后前 2 秒是"飘过去"的过程，
      //    统计绕圈只算每段换点 2 秒之后的样本。
      const prevSpot = d.bugs.map((x) => x.spot), since = d.bugs.map(() => 0);
      const switchT = d.bugs.map(() => []), seg = d.bugs.map(() => [[]]), drift = d.bugs.map(() => []);
      let t = 0, maxFlapRange = 0;
      for (let i = 0; i < 660; i++) {
        d.update(1 / 60); t += 1 / 60;
        for (let k = 0; k < n; k++) {
          const bug = d.bugs[k];
          const dd = Math.hypot(bug.pos.x - bug.spot.x, bug.pos.z - bug.spot.z);
          if (bug.spot !== prevSpot[k]) {
            switchT[k].push(+t.toFixed(3)); drift[k].push(null);
            prevSpot[k] = bug.spot; seg[k].push([]); since[k] = 0;
          }
          since[k]++;                                    // 这一段的帧序号（换点后从 0 起）
          if (since[k] > 120) seg[k][seg[k].length - 1].push(dd);   // 跳过换点后的"飘移"阶段
          if (drift[k].length && since[k] === 120) drift[k][drift[k].length - 1] = dd;
        }
        if (i % 10 === 0) {
          const a = Array.from(d.flap.array.slice(0, n));
          maxFlapRange = Math.max(maxFlapRange, Math.max(...a) - Math.min(...a));
        }
      }
      const rad = d.bugs.map((x) => x.rad);
      const stat = [];
      seg.forEach((ss, k) => ss.forEach((a) => {
        if (a.length > 30) stat.push({ rad: +rad[k].toFixed(3), min: +Math.min(...a).toFixed(3), max: +Math.max(...a).toFixed(3), mean: +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(3) });
      }));
      // 换点 2 秒后离新落点还有多远（应该已经飘过去了）
      const driftEnd = drift.flat().filter((v) => v !== null).map((v) => +v.toFixed(3));
      // 2) 换落点间隔：首换时间与相邻间隔
      const gaps = switchT.map((ts) => ts.slice(1).map((v, i) => +(v - ts[i]).toFixed(2)));
      const firstSwitch = switchT.map((ts) => (ts.length ? ts[0] : null));
      // 3) 世界空间噪声带来的"整片同向"：两只同落点的蝴蝶速度方向相关系数
      let corr = null;
      if (n >= 2) {
        const a = d.bugs[0].vel, bb = d.bugs[1].vel;
        corr = +((a.x * bb.x + a.z * bb.z) / ((Math.hypot(a.x, a.z) * Math.hypot(bb.x, bb.z)) || 1)).toFixed(3);
      }
      // 4) 图层开关：蝴蝶
      view.setDebug('butterflies', false); const offHidden = d.butterflies.visible === false;
      view.setDebug('butterflies', true); const onShown = d.butterflies.visible === true;
      // 5) 模块签名配色：开开关 → 世界网格需要重建
      const sigBefore = { modules: view.worldMesh.buildStats.modules, hash: 0 };
      const col = view.worldMesh.geometry.getAttribute('color');
      for (let i = 0; i < Math.min(col.count, 4000); i += 7) sigBefore.hash = (sigBefore.hash * 31 + Math.round(col.getX(i) * 255) + Math.round(col.getY(i) * 255) * 3) | 0;
      view.setDebug('modules', true);
      return { n, count, stat, gaps, firstSwitch, driftEnd, maxFlapRange: +maxFlapRange.toFixed(3), corr, offHidden, onShown, sigBefore, debugModules: view.worldMesh.debugModules };
    });

    await p.waitForTimeout(1500);
    const r2 = await p.evaluate(() => {
      const view = rea.view, col = view.worldMesh.geometry.getAttribute('color');
      let hash = 0, colored = 0;
      for (let i = 0; i < Math.min(col.count, 4000); i += 7) hash = (hash * 31 + Math.round(col.getX(i) * 255) + Math.round(col.getY(i) * 255) * 3) | 0;
      // 同一签名应同色：统计 8 位量化后出现多少种颜色
      const seen = new Set();
      for (let i = 0; i < col.count; i += 3) seen.add(`${Math.round(col.getX(i) * 8)},${Math.round(col.getY(i) * 8)},${Math.round(col.getZ(i) * 8)}`);
      return { hash, colors: seen.size, modules: view.worldMesh.buildStats.modules, vertexCount: col.count / 3, debugModules: view.worldMesh.debugModules };
    });
    const on = await p.screenshot({ path: 'artifacts/coverage/modules-on.png' });

    console.log('蝴蝶数 / instanced count:', r.count, '/', r.n);
    console.log('到落点距离（rad, min, max, mean）:', JSON.stringify(r.stat));
    console.log('首换落点时间(s):', JSON.stringify(r.firstSwitch), ' 相邻间隔:', JSON.stringify(r.gaps), ' 换点2秒后距新落点:', JSON.stringify(r.driftEnd));
    console.log('扇翅幅度:', r.maxFlapRange, ' 两蝶速度同向系数:', r.corr);
    console.log('蝴蝶图层开关 off/on:', r.offHidden, r.onShown);
    console.log('模块签名数 buildStats.modules:', r.sigBefore.modules, ' 顶点色 hash 前/后:', r.sigBefore.hash, r2.hash, ' 量化色数:', r2.colors, ' 顶点:', r2.vertexCount);
    console.log('modules 开关生效:', r.debugModules, '/', r2.debugModules, ' 截图字节:', off.length, on.length);

    assert.ok(r.count > 0 && r.count === r.n, '花园里应该有蝴蝶，且实例数等于行为对象数');
    assert.ok(r.stat.length > 0, '至少要有一段稳定的绕圈样本');
    for (const s of r.stat) {
      assert.ok(s.max < 2.5 * s.rad + 0.5, `绕圈不该跑飞：max ${s.max} vs rad ${s.rad}`);
      assert.ok(s.mean > 0.3 * s.rad && s.mean < 2 * s.rad + 0.3, `应在落点附近松转：mean ${s.mean} vs rad ${s.rad}`);
    }
    const allFirst = r.firstSwitch.filter((v) => v !== null);
    assert.ok(allFirst.length > 0, '10 秒内至少有一只换过落点');
    for (const f of allFirst) assert.ok(f >= 2.4 && f <= 9.2, `首换落点应落在 3–9 秒：${f}`);
    for (const g of r.gaps.flat()) assert.ok(g >= 2.4 && g <= 9.2, `换落点间隔应落在 3–9 秒：${g}`);
    for (const v of r.driftEnd) assert.ok(v < 1.6, `换落点后应飘到新落点附近：${v}`);
    assert.ok(r.maxFlapRange > 0.5, '翅膀应该在扇（aFlap 幅度 ' + r.maxFlapRange + '）');
    assert.ok(r.offHidden && r.onShown, '蝴蝶图层开关应能开关');
    assert.ok(r.sigBefore.modules >= 2, '场景里应该用到多种模块签名：' + r.sigBefore.modules);
    assert.ok(r2.debugModules === true, '模块配色开关应打开');
    assert.ok(r2.hash !== r.sigBefore.hash, '打开模块配色后顶点色应变化');
    assert.ok(r2.colors > 6, '调试色应出现多种颜色：' + r2.colors);
    assert.equal(errors.length, 0, '页面不应有 console error: ' + errors.join(' | '));
    console.log('PASS butterfly-orbit / module-signature colors');
  } finally {
    await b.close();
  }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
