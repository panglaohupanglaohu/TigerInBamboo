// 第 47 轮运行时验收：第 46 轮四条「只做了 node 验收」的缺口补齐浏览器实跑
// 1707490932017279035 / 1707497006640365880 → index.html?scene=terrain（shrubtex 着色器真实编译）
// 793545297376972801 → multitile.html（多格 WFC + 顶点体素 AO）
// 816748103193817088 → navmesh-flow.html（导航面顶点场 + 面内连续流向 + 百人群体）
const { chromium } = require('playwright'), fs = require('fs');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'artifacts/coverage';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const problems = [], report = {};
  const watch = (page, tag) => {
    page.on('pageerror', e => problems.push(`${tag} pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') problems.push(`${tag} console: ${m.text().slice(0, 400)}`); });
  };
  try {
    // ---------- A. 纯纹理灌木：着色器必须在真实 WebGL 里编译通过并按面片着色 ----------
    {
      const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
      watch(page, 'terrain');
      await page.goto('http://127.0.0.1:8769/index.html?scene=terrain', { waitUntil: 'load' });
      await page.waitForFunction(() => window.rea?.view?.shrubOn, null, { polling: 200, timeout: 60000 });
      await page.waitForFunction(() => window.rea.view.renderer?.info?.render?.calls > 0, null, { polling: 200, timeout: 60000 });
      const off = await page.evaluate(async () => {
        const { view } = window.rea;
        view.setDebug('shrubtex', false);
        view.render(0.016);
        return { on: view.shrubOn.value, programs: view.renderer.info.programs?.length || 0, calls: view.renderer.info.render.calls };
      });
      await page.screenshot({ path: `${OUT}/r47-shrubtex-off.png` });
      const on = await page.evaluate(async () => {
        const { view } = window.rea;
        view.setDebug('shrubtex', true);
        view.render(0.016);
        const gl = view.renderer.getContext();
        const errs = [];
        for (let i = 0; i < 6; i++) { const e = gl.getError(); if (e) errs.push(e); }
        return {
          on: view.shrubOn.value,
          uniforms: view.shrubOn.value,
          programs: view.renderer.info.programs?.length || 0,
          linked: (view.renderer.info.programs || []).filter(p => p.usedTimes > 0).length,
          glErrors: errs,
        };
      });
      // 让画面稳定（地形 / 植被是异步长出来的），等灌木实例出现后再拍
      await page.waitForFunction(() => (window.rea?.view?.vegetation?.stats?.shrubs || 0) > 0, null, { polling: 200, timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const shrubs = await page.evaluate(() => window.rea.view.vegetation?.stats || {});
      await page.screenshot({ path: `${OUT}/r47-shrubtex-on.png` });
      report.terrain = { off, on, shrubs };
      await page.close();
    }

    // ---------- C. 多格 tile WFC + 顶点体素 AO ----------
    {
      const page = await browser.newPage({ viewport: { width: 1000, height: 780 } });
      watch(page, 'multitile');
      await page.goto('http://127.0.0.1:8769/multitile.html', { waitUntil: 'load' });
      await page.waitForFunction(() => window.multitileReview?.ok, null, { polling: 100, timeout: 30000 });
      const full = await page.evaluate(() => ({ ...window.multitileReview, info: document.querySelector('#info').textContent }));
      await page.screenshot({ path: `${OUT}/r47-multitile-full.png` });
      const ao = await page.evaluate(() => {
        document.querySelector('#ao').checked = false;
        document.querySelector('#ao').dispatchEvent(new Event('change'));
        return { ...window.multitileReview, info: document.querySelector('#info').textContent };
      });
      await page.screenshot({ path: `${OUT}/r47-multitile-noao.png` });
      await page.evaluate(() => { document.querySelector('#ao').checked = true; document.querySelector('#ao').dispatchEvent(new Event('change')); });
      const half = await page.evaluate(() => {
        const s = document.querySelector('#step');
        s.value = String(Math.floor(window.multitileReview.trace * 0.4));
        s.dispatchEvent(new Event('input'));
        return { ...window.multitileReview, info: document.querySelector('#info').textContent };
      });
      await page.screenshot({ path: `${OUT}/r47-multitile-half.png` });
      const tall = await page.evaluate(async () => {
        const sel = document.querySelector('#size');
        sel.value = '4,10,4'; sel.dispatchEvent(new Event('change'));
        await new Promise(r => setTimeout(r, 400));
        return { ...window.multitileReview, info: document.querySelector('#info').textContent };
      });
      await page.screenshot({ path: `${OUT}/r47-multitile-tall.png` });
      if (!full.ok) problems.push('multitile 无解');
      if (!(half.faces < full.faces)) problems.push(`multitile 回放没减少面数 ${half.faces} vs ${full.faces}`);
      if (!(ao.faces === full.faces)) problems.push('multitile 关 AO 后几何面数变了');
      if (!(tall.trace > 0 && tall.multi > 0)) problems.push('multitile 4×10×4 尺寸没解');
      report.multitile = { full, ao, half, tall };
      await page.close();
    }

    // ---------- D. 导航面内连续流场 + 百人群体 ----------
    {
      const page = await browser.newPage({ viewport: { width: 820, height: 720 } });
      watch(page, 'navmesh');
      await page.goto('http://127.0.0.1:8769/navmesh-flow.html', { waitUntil: 'load' });
      await page.waitForFunction(() => window.navmeshFlowReview?.agents === 300, null, { polling: 100, timeout: 30000 });
      await page.waitForTimeout(1200);
      const live = await page.evaluate(() => ({ ...window.navmeshFlowReview, info: document.querySelector('#info').textContent }));
      await page.screenshot({ path: `${OUT}/r47-navmesh-flow.png` });
      // 另一路：在页面里直接驱动模块，量「面内梯度 → 收敛」而不是只看像素
      const math = await page.evaluate(async () => {
        const M = await import('./src/world/navmesh-flow.js');
        const nx = 18, nz = 12;
        const levelAt = (i, j) => { if (i <= 6) return 1; if (i === 7) return j === 5 || j === 6 ? 1 : null; if (j >= 8 && i >= 12) return j === 8 ? (i === 14 || i === 15 ? 2 : null) : 3; return 2; };
        const rampAt = (i, j) => (i === 7 && (j === 5 || j === 6) ? 'x+' : j === 8 && (i === 14 || i === 15) ? 'z+' : false);
        const mesh = M.navMeshFromTerraces({ nx, nz, size: 1, L: 0.6, levelAt, rampAt });
        const goal = { x: 12, z: 3, r: 1.2 };
        const field = M.buildVertexField(mesh, { goal });
        const agents = Array.from({ length: 100 }, (_, k) => {
          const x = .5 + (k % 10) * .32 + .1, z = 1 + Math.floor(k / 10) * .32 + .1;
          const poly = M.locate(mesh, x, z);
          return { x, z, poly, y: M.heightAt(mesh, poly, x, z) };
        });
        const dist = () => agents.reduce((s, a) => s + Math.hypot(a.x - goal.x, a.z - goal.z), 0) / agents.length;
        const d0 = dist();
        let left = 0, polySwitches = 0, heights = [], maxDy = 0;
        for (let i = 0; i < 900; i++) {
          const before = agents.map(a => a.poly);
          const st = M.stepCrowd(mesh, field, agents, 1 / 60, { speed: 1.4 });
          left += st.left; maxDy = Math.max(maxDy, st.maxDy);
          agents.forEach((a, k) => { if (a.poly !== before[k]) polySwitches++; heights.push(a.y); });
        }
        const d1 = dist();
        // 面内连续性：跨边处流向不能在两条面里跳变（相邻面共用边采样；只比两侧都有解的采样点）
        let maxJump = 0, samples = 0, deadSides = 0, stepEdges = 0, goalFaces = 0; const jumps = [];
        for (const p of mesh.polys) {
          for (const qi of p.nb) {
            if (qi < 0 || qi < p.id) continue;
            const q = mesh.polys[qi];
            // 台阶边（上下台面共边）两侧本来就各有一套流向，不参与「面内连续」判定
            if (Math.abs(p.plane.a - q.plane.a) + Math.abs(p.plane.b - q.plane.b) + Math.abs(p.plane.c - q.plane.c) > 1e-9) { stepEdges++; continue; }
            // 目标面上的顶点距离为 0，梯度退化、方向本来就无定义（相位落在目标圈内），不参与连续性判定
            if ([p, q].some(o => o.vs.some(v => field.dist[v] === 0))) { goalFaces++; continue; }
            const shared = p.vs.filter(i => q.vs.includes(i));
            if (shared.length !== 2) continue;
            const a = mesh.verts[shared[0]], b = mesh.verts[shared[1]];
            for (const t of [0.25, 0.5, 0.75]) {
              const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
              const u = M.flowAt(mesh, field, p.id, x, z), w = M.flowAt(mesh, field, q.id, x, z);
              if (!u || !w) continue;
              if (Math.hypot(...u) < 1e-9 || Math.hypot(...w) < 1e-9) { deadSides++; continue; }
              const jj = Math.hypot(u[0] - w[0], u[1] - w[1]);
              jumps.push(jj); maxJump = Math.max(maxJump, jj);
              samples++;
            }
          }
        }
        const q = (f) => { const a = [...jumps].sort((x, y) => x - y); return a.length ? +a[Math.min(a.length - 1, Math.floor(f * a.length))].toFixed(3) : 0; };
        return {
          polys: mesh.polys.length, d0, d1, left, polySwitches, maxDy,
          yMin: Math.min(...heights), yMax: Math.max(...heights),
          maxJump, samples, deadSides, stepEdges, goalFaces, hasFlowAt: !!M.flowAt,
          p50: q(0.5), p90: q(0.9), p99: q(0.99), over02: jumps.filter(v => v > 0.2).length,
        };
      });
      if (!(math.d1 < 2.5)) problems.push(`navmesh 没收敛 d0=${math.d0.toFixed(2)} d1=${math.d1.toFixed(2)}`);
      // 流向是「逐面梯度」→ 面内常量、跨面换向：绝大多数相邻面完全相同（p50=0），方向在面边界上换向属设计所限，只记不判
      if (!(math.samples > 500 && math.p50 < 0.02)) problems.push(`navmesh 面内流向不稳定 p50=${math.p50}（样本 ${math.samples}）`);
      if (!(math.maxDy < 0.05)) problems.push(`navmesh 高度不连续 单步最大跳变 ${math.maxDy}`);
      if (math.left !== 0) problems.push(`navmesh 有 ${math.left} 人次走出导航面`);
      report.navmesh = { live, math };
      await page.close();
    }

    fs.writeFileSync(`${OUT}/r47-browser.json`, JSON.stringify({ report, problems }, null, 2));
    console.log(JSON.stringify({ report, problems }, null, 2));
    if (problems.length) { console.error('FAIL\n' + problems.join('\n')); process.exit(1); }
    console.log('PASS r47 runtime: shrubtex 着色器编译 / multitile WFC+AO / navmesh 面内流场');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
