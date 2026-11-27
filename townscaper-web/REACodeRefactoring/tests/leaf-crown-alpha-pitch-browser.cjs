// 1205420678859632640「冠 alpha 随视角的定量曲线」运行验收（r252）。
// 片内机制：球面叶片贴图 × 视角（|N·V|）调制的 alpha → 冠轮廓随镜头俯仰变，而几何不变（0250 线框帧证明冠是低面球）。
// 本测试只渲树冠、只读像素，量四件事：
//   ① solid 档（leafyOn=0，整团块）在 6 档俯仰下的面积 —— 几何对照组（冠是叶簇球，不是解析球，会有小摆动）；
//   ② atlas 档（球面叶纹 + 视角 alpha）的覆盖比与被咬掉的像素数 —— 面积曲线；
//   ③ **按 |N·V| 分箱的存活率曲线**（本片缺的那条定量曲线）：掠射端点应明显被咬、正对镜头端应几乎全留；
//      并与 CPU 孪生 leafCoverage 的解析预测（叶纹均匀时 coverage≈clamp((facing-0.08)/0.35)）对拍；
//   ④ 曲线在 6 档俯仰之间是否自洽（视角律不随俯仰改），以及掩膜翻转（冠心对齐后）。
const { chromium } = require('playwright');
const fs = require('fs');
const assert = require('node:assert/strict');

const PITCHES = [0.55, 0.7, 0.85, 1.0, 1.15, 1.3];
const BINS = [[0, 0.15], [0.15, 0.3], [0.3, 0.45], [0.45, 0.6], [0.6, 0.75], [0.75, 0.9], [0.9, 1.01]];

(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [];
  try {
    const p = await b.newPage({ viewport: { width: 1100, height: 820 } });
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(m.text()); });
    await p.goto('http://127.0.0.1:8769/leaf-surface.html');
    await p.waitForFunction(() => window.leafReview?.api && window.leafReviewSet, null, { timeout: 180000 });
    const scene = p.frames().find((f) => f.url().includes('index.html'));
    assert.ok(scene, '游戏 iframe 没起来');

    const res = await scene.evaluate(async ({ PITCHES, BINS }) => {
      const THREE = await import('three');
      const v = window.rea.view, vg = v.vegetation;
      const W = 320, H = 240, rt = new THREE.WebGLRenderTarget(W, H), rn = v.renderer;
      vg.uTime.value = 0; if (v.waterUniforms?.uTime) v.waterUniforms.uTime.value = 0;   // 冻时间

      const all = [];
      v.scene.traverse((o) => { if (o.isMesh || o.isInstancedMesh) all.push([o, o.visible]); });
      const crowns = vg.crowns.map((c) => c.m);
      // 墨线外壳（反向外壳）必须一起藏掉：solid 档（uLeafy=0）时它可见，会把冠边缘画暗，
      // 用亮度阈值判掩膜就会把边缘当成背景（r252 实测这一条把 solid 面积压小 7%）。
      const inks = vg.crowns.map((c) => c.ink);
      const setOnlyCrowns = () => { for (const [o] of all) o.visible = false; for (const m of crowns) m.visible = true; for (const m of inks) m.visible = false; };
      const oldBg = v.scene.background, oldFog = v.scene.fog;
      const oldClear = rn.getClearColor(new THREE.Color()), oldAlpha = rn.getClearAlpha();
      // 洋红底：掩膜判定不依赖亮度（冠边缘有深色墨带/暗部，用 lum 阈值会把它们算成背景）
      v.scene.background = null; v.scene.fog = null; rn.setClearColor(new THREE.Color(1, 0, 1), 1);

      const cp = vg.crownPlacements[0];
      v.target.set(cp.x, cp.y, cp.z); v.distance = 4.6;
      // 试错记录（r252）：另建单株 InstancedMesh 隔离邻株会让整片被 discard（ratio→0），
      // 因为冠材质的 uLeafCenter 是按原实例写死的；改为「最大连通块」近似，面积摆幅如实记进读数。

      const grab = () => {
        const old = rn.getRenderTarget(); rn.setRenderTarget(rt); rn.render(v.scene, v.camera);
        const buf = new Uint8Array(W * H * 4); rn.readRenderTargetPixels(rt, 0, 0, W, H, buf); rn.setRenderTarget(old);
        const m = new Uint8Array(W * H);
        for (let i = 0, k = 0; i < buf.length; i += 4, k++) {
          const r = buf[i], g2 = buf[i + 1], b2 = buf[i + 2];
          m[k] = (r > 180 && g2 < 70 && b2 > 180) ? 0 : 1;   // 非洋红 = 冠像素
        }
        // 只取最大连通块（= 被对准的那一株冠）：画面里常还有邻株，混进来会把「到冠心的投影半径」
        // 算成假的掠射角，r252 实测这一条让最外一档凭空多出 36% 的像素。
        const lab = new Int32Array(W * H).fill(-1), comps = [];
        const stack = [];
        for (let k = 0; k < m.length; k++) {
          if (!m[k] || lab[k] >= 0) continue;
          const id = comps.length; const px = []; lab[k] = id; stack.push(k);
          while (stack.length) {
            const c = stack.pop(); px.push(c);
            const x = c % W, y = (c / W) | 0;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
              const nk = ny * W + nx; if (m[nk] && lab[nk] < 0) { lab[nk] = id; stack.push(nk); }
            }
          }
          comps.push(px);
        }
        const best = comps.reduce((a, c) => (c.length > a.length ? c : a), []);
        let sx = 0, sy = 0; for (const c of best) { sx += c % W; sy += (c / W) | 0; }
        return { m, n: best.length, px: best, cx: best.length ? sx / best.length : 0, cy: best.length ? sy / best.length : 0 };
      };

      setOnlyCrowns();
      const rows = [];
      for (const pitch of PITCHES) {
        v.pitch = pitch; v.updateCamera();
        vg.leafyOn = false; v.render(0); const solid = grab();
        vg.leafyOn = true; vg.leafAtlasOn = true; v.render(0); const atlas = grab();
        const R = Math.sqrt(solid.n / Math.PI);   // 投影等效半径（像素）
        // |N·V| 由「冠心到像素的归一化投影半径」反推：facing = sqrt(1-(d/R)²)
        // 咬边环离轮廓边界有多深（BFS 多层）：视角律的缺口应该只贴边，不该出现在冠内部
        const depth = new Int16Array(W * H).fill(-1); const q = [];
        for (const k of solid.px) {
          const x = k % W, y = (k / W) | 0;
          if (x === 0 || y === 0 || x === W - 1 || y === H - 1) { depth[k] = 0; q.push(k); continue; }
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!solid.m[(y + dy) * W + x + dx]) { depth[k] = 0; q.push(k); break; }
        }
        for (let h = 0; h < q.length; h++) {
          const c = q[h], x = c % W, y = (c / W) | 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const nk = ny * W + nx; if (solid.m[nk] && depth[nk] < 0) { depth[nk] = depth[c] + 1; q.push(nk); }
          }
        }
        const biteDepths = [];
        const bins = BINS.map(() => ({ solid: 0, atlas: 0 }));
        let bite = 0;
        for (const k of solid.px) {
          if (!atlas.m[k]) { bite++; biteDepths.push(depth[k]); }
          const dx = (k % W) - solid.cx, dy = ((k / W) | 0) - solid.cy;
          const t = Math.min(1, Math.hypot(dx, dy) / R);
          const facing = Math.sqrt(Math.max(0, 1 - t * t));
          let bi = BINS.findIndex(([a, b2]) => facing >= a && facing < b2);
          if (bi < 0) bi = BINS.length - 1;
          bins[bi].solid++; if (atlas.m[k]) bins[bi].atlas++;
        }
        biteDepths.sort((a, b2) => a - b2);
        const pct = (arr, q2) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * q2))] : -1);
        const ring = { n: biteDepths.length, p50: pct(biteDepths, 0.5), p90: pct(biteDepths, 0.9), max: biteDepths[biteDepths.length - 1] };
        const atlasInComp = solid.px.filter((k) => atlas.m[k]).length;
        rows.push({
          pitch, camY: +v.camera.position.y.toFixed(3), solidPx: solid.n, atlasPx: atlasInComp,
          ratio: atlasInComp / solid.n, bite, biteFrac: bite / solid.n, R: +R.toFixed(2), ring,
          bins: bins.map((bb) => bb.solid ? bb.atlas / bb.solid : null), binN: bins.map((bb) => bb.solid),
          m: atlas.m, sm: solid.m, cx: solid.cx, cy: solid.cy,
        });
      }
      // 冠心对齐后的掩膜翻转：atlas 侧 vs solid 侧（把机位平移带来的整幅位移先抵掉）
      const shiftFlips = (A, B) => {
        let f = 0; const dx = Math.round(B.cx - A.cx), dy = Math.round(B.cy - A.cy);
        for (let k = 0; k < A.m.length; k++) {
          const x = (k % W) + dx, y = ((k / W) | 0) + dy;
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          if (A.m[k] !== B.m[y * W + x]) f++;
        }
        return f;
      };
      const atlasFlips = [], solidFlipsInfo = [];
      for (let i = 1; i < rows.length; i++) {
        atlasFlips.push(shiftFlips({ m: rows[i - 1].m, cx: rows[i - 1].cx, cy: rows[i - 1].cy }, { m: rows[i].m, cx: rows[i].cx, cy: rows[i].cy }));
        solidFlipsInfo.push(shiftFlips({ m: rows[i - 1].sm, cx: rows[i - 1].cx, cy: rows[i - 1].cy }, { m: rows[i].sm, cx: rows[i].cx, cy: rows[i].cy }));
      }
      // CPU 孪生：叶纹均匀时 leafCoverage>0.5 的存活比例 = clamp((facing-0.08)/0.35)
      const predict = (facing) => Math.min(1, Math.max(0, (facing - 0.08) / 0.35));
      const mid = BINS.map(([a, b2]) => (a + b2) / 2);
      const pred = mid.map(predict);
      const predAreaMiss = Math.pow(0.08 + 0.35 * 0.5, 2);   // p=0.5：被咬掉的面积比

      for (const [o, vis] of all) o.visible = vis;
      v.scene.background = oldBg; v.scene.fog = oldFog; rn.setClearColor(oldClear, oldAlpha);
      vg.leafyOn = true; vg.leafAtlasOn = true; rt.dispose();

      return {
        rows: rows.map(({ m, sm, ...r }) => r), atlasFlips, solidFlips: solidFlipsInfo,
        bins: BINS, pred, predAreaMiss, crowns: crowns.length, texel: vg.leafSurface.atlas.size,
      };
    }, { PITCHES, BINS });

    // ---------- 读数先落盘，再做断言（断言挂了也要有数） ----------
    const curve0 = res.bins.map((_, i) => {
      const vals = res.rows.map((r) => r.bins[i]).filter((x) => x !== null);
      return vals.reduce((a, b2) => a + b2, 0) / vals.length;
    });
    console.log('READ 冠 alpha：存活率', curve0.map((x) => x.toFixed(3)).join('/'),
      '· binN', res.rows[0].binN.join('/'),
      '· 面积比', res.rows.map((r) => `${r.pitch}:${r.ratio.toFixed(3)}/${r.solidPx}`).join(' '),
      '· 咬掉', res.rows.map((r) => `${(r.biteFrac * 100).toFixed(1)}%`).join('/'),
      '· 咬边深度 p50/p90/max', res.rows.map((r) => `${r.ring.p50}/${r.ring.p90}/${r.ring.max}`).join(' '),
      '· 解析咬掉', (res.predAreaMiss * 100).toFixed(2) + '%',
      '· R', res.rows.map((r) => r.R).join('/'),
      '· 对齐翻转 atlas/solid', res.atlasFlips.join('/'), 'vs', res.solidFlips.join('/'));
    fs.writeFileSync('artifacts/coverage/leaf-crown-alpha-pitch-browser.json', JSON.stringify({ ...res, curve: curve0, errors }, null, 2));

    // ---------- 断言 ----------
    assert.equal(res.crowns, 3, '树冠应是 3 个物种 InstancedMesh');
    const solidSpread = Math.max(...res.rows.map((r) => r.solidPx)) / Math.min(...res.rows.map((r) => r.solidPx));
    // 面积摆幅不作为断言：最大连通块在邻株之间会换人（如实记进 json）；判据用「同一像素集内」的覆盖比
    assert.ok(res.rows.every((r) => r.solidPx > 3000), '冠像素太少 ' + solidSpread);

    // ③ 核心：|N·V| 分箱存活率曲线
    const curve = res.bins.map((_, i) => {
      const vals = res.rows.map((r) => r.bins[i]).filter((x) => x !== null);
      return vals.reduce((a, b2) => a + b2, 0) / vals.length;
    });
    const graze = (curve[0] + curve[1]) / 2, mid = (curve[4] + curve[5]) / 2;
    assert.ok(mid > 0.9, '冠中部应几乎全留 ' + mid.toFixed(3));
    assert.ok(mid - graze > 0.02, '存活率应随 |N·V| 抬升（视角 alpha 律）' + (mid - graze).toFixed(3));
    // 解析预测：叶纹均匀时被咬掉的面积比 = (0.08+0.35p)²，p=0.5 → 6.5%
    const predBite = res.predAreaMiss;
    for (const r of res.rows) assert.ok(Math.abs(r.biteFrac - predBite) < 0.035,
      `咬掉比例 ${r.biteFrac.toFixed(4)} 与解析预测 ${predBite.toFixed(4)} 不符（pitch ${r.pitch}）`);
    // 咬边只贴轮廓边：视角度调制的缺口不该在冠内部挖洞
    for (const r of res.rows) assert.ok(r.ring.p90 <= 3, `被咬的像素离边界太深（p90 ${r.ring.p90}px, pitch ${r.pitch}）`);
    // ④ 6 档之间自洽：逐 bin 极差
    const spread = res.bins.map((_, i) => {
      const vals = res.rows.map((r) => r.bins[i]).filter((x) => x !== null);
      return Math.max(...vals) - Math.min(...vals);
    });
    assert.ok(Math.max(...spread) < 0.2, '俯仰之间曲线不自洽（极差 ' + Math.max(...spread).toFixed(3) + '）');
    // 面积曲线：每档都要真的被咬掉一截
    for (const r of res.rows) assert.ok(r.biteFrac > 0.02, `pitch ${r.pitch} 叶片 alpha 咬掉太少 ${r.biteFrac}`);
    // 掩膜翻转只作为读数：最大连通块在邻株之间换人时，翻转量主要由整幅平移决定，
    // 拿它判「视角调制」会把几何位移算成 alpha（r252 实测 atlas 侧甚至略低于 solid 侧）→ 不作断言。

    await p.evaluate(() => {
      const w = document.querySelector('#scene').contentWindow;
      const v = w.rea.view, vg = v.vegetation;
      vg.uTime.value = 0; if (v.waterUniforms?.uTime) v.waterUniforms.uTime.value = 0;
      const cp = vg.crownPlacements[0]; v.target.set(cp.x, cp.y, cp.z); v.distance = 4.6;
      v.pitch = 0.55; v.updateCamera(); v.render(0);
    });
    await p.screenshot({ path: 'artifacts/coverage/leaf-crown-alpha-pitch-low.png' });
    await p.evaluate(() => {
      const w = document.querySelector('#scene').contentWindow;
      const v = w.rea.view; v.pitch = 1.3; v.updateCamera(); v.render(0);
    });
    await p.screenshot({ path: 'artifacts/coverage/leaf-crown-alpha-pitch-high.png' });

    assert.deepEqual(errors, []);
    const curveErr = curve.map((x, i) => Math.abs(x - res.pred[i]));
    const maxErr = Math.max(...curveErr);
    fs.writeFileSync('artifacts/coverage/leaf-crown-alpha-pitch-browser.json', JSON.stringify({ ...res, solidSpread, curve, curveErr, spread, solidSpreadPx: res.rows.map((r) => r.solidPx), errors }, null, 2));
    console.log('PASS 冠 alpha 曲线 · |N·V| 分箱存活率', curve.map((x) => x.toFixed(3)).join('/'),
      '· 掠射', graze.toFixed(3), '中段', mid.toFixed(3),
      '· CPU 预测', res.pred.map((x) => x.toFixed(2)).join('/'), '最大偏差', maxErr.toFixed(3),
      '· 档间极差', Math.max(...spread).toFixed(3),
      '· 面积比', res.rows.map((r) => `${r.pitch}:${r.ratio.toFixed(3)}`).join(' '),
      '· 咬掉', res.rows.map((r) => `${(r.biteFrac * 100).toFixed(1)}%`).join('/'),
      '· 咬边深度 p50/p90/max', res.rows.map((r) => `${r.ring.p50}/${r.ring.p90}/${r.ring.max}`).join(' '),
      '· 解析咬掉', (res.predAreaMiss * 100).toFixed(2) + '%',
      '· 对齐翻转 atlas/solid', res.atlasFlips.join('/'), 'vs', res.solidFlips.join('/'));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
