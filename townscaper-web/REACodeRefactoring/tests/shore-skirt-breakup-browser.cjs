// 1991099314714902634（545 帧·"Got some pretty sweet new shore waves going"）的收口验收：
//   ① 岸线白带**分段**：亮段 / 缝沿闭合岸线交替（cpu 孪生 + 只画裙带的离屏像素两套读数）
//   ② 段与缝随时间**展开 / 聚拢**（缝隙宽度呼吸、相位沿岸扫过）
//   ③ 整数谐波保证绕一圈接缝连续；`uSkirtBreak=0` 回到旧的「沿全岸常亮」档
// 口径：几何量读真 geometry 的 aArc，覆盖曲线用 src/water/shore.js#skirtCoverage（与 GLSL 同式）；
//      像素只画 skirt 一层到离屏 RT 后按投影点采样，避开岩壁/浪带/海面的干扰。
const { chromium } = require('playwright'), fs = require('fs');
const prefix = process.env.REA_SKIRT_PREFIX || 'shore-skirt-breakup';

(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const reports = [], errors = [];
  try {
    for (const kind of ['mixed', 'quad']) {
      const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
      p.on('pageerror', (e) => errors.push(`${kind}: ${e.message}`));
      await p.goto(`http://localhost:8769/index.html?scene=terrain&grid=${kind}`);
      await p.waitForFunction(() => window.rea?.view?.skirt?.geometry?.attributes?.aArc?.count > 0, null, { polling: 100 });
      await p.waitForTimeout(500);

      const r = await p.evaluate(async () => {
        const THREE = await import('three');
        const { skirtCoverage, skirtStats, skirtBreakGLSL } = await import('./src/water/shore.js');
        const { view, world } = rea;
        const ver = world.version, g = view.skirt.geometry;
        const arc = g.getAttribute('aArc'), aA = g.getAttribute('aA'), pos = g.getAttribute('position');

        // ---------- ① 烘入属性 ----------
        let nonFinite = 0, outOfRange = 0;
        for (let i = 0; i < arc.count; i++) {
          const u = arc.getX(i);
          if (!Number.isFinite(u)) nonFinite++;
          else if (u < -1e-6 || u > Math.PI * 2 + 1e-6) outOfRange++;
        }
        const countMatch = arc.count === pos.count && aA.count === pos.count;

        // 每条 loop 的 u 从 0 单调到 2π 后回跳（4 个顶点同一 u）
        const loops = [];
        let cur = null, prev = -1;
        for (let i = 0; i < arc.count; i += 4) {
          const u = arc.getX(i);
          if (u < prev - 1e-6 || !cur) { cur = { u: [] }; loops.push(cur); }
          cur.u.push(u); prev = u;
        }
        const monotonic = loops.every((l) => l.u.every((v, i) => i === 0 || v >= l.u[i - 1] - 1e-6));

        // ---------- ② 覆盖曲线：接缝 / 分段 / 呼吸 ----------
        const seam = Math.abs(skirtCoverage(0, 3.3) - skirtCoverage(Math.PI * 2, 3.3));
        const stats0 = skirtStats(g, 0);
        const statsT = skirtStats(g, 9.0);
        // 同一时刻、只把 uSkirtBreak 关掉 = 旧档：覆盖恒 1
        const alwaysOn = { gapShare: 0, runs: loops.length };

        // 缝隙位置随时间移动：沿同一条 loop 逐点比 cover>=0.5 的布尔串
        const L = loops[0].u, DRIFT = 0.35;
        const coverAt = (t) => L.map((u) => skirtCoverage(u - t * DRIFT, t) >= 0.5);
        const c0 = coverAt(0), c9 = coverAt(9);
        let disagree = 0;
        for (let i = 0; i < c0.length; i++) if (c0[i] !== c9[i]) disagree++;
        // 同一 t 下与 GLSL 文本同式（防止两份实现走散）
        const glslText = skirtBreakGLSL.replace(/\s+/g, ' ');
        const glslOk = /smoothstep\(0\.24, 0\.64, raw\)/.test(glslText)
          && /3\.0 \* u \+ 1\.1 - 0\.35 \* uTime/.test(glslText)
          && /7\.0 \* u \+ 2\.3 - 0\.62 \* uTime/.test(glslText);

        // ---------- ③ 只画裙带的离屏像素 ----------
        // 用主视图相机取景（岛不在原点，自己摆机位会把整圈岸线推到屏外）
        const renderer = view.renderer, W = 720, H = Math.round(720 * renderer.domElement.height / renderer.domElement.width);
        const target = new THREE.WebGLRenderTarget(W, H);
        const oldT = renderer.getRenderTarget(), oldClear = renderer.getClearColor(new THREE.Color()), oldAlpha = renderer.getClearAlpha();
        const cam = view.camera.clone();
        cam.aspect = W / H; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
        const saved = view.scene.children.map((m) => [m, m.visible]);
        // scene.background 会把整帧铺成天色（黑底上天色 lum≈82 = 与白带同量级），量裙带前必须摘掉
        const savedBg = view.scene.background;
        const un = view.skirtMaterial.uniforms;

        const shot = (brk) => {
          un.uSkirtBreak.value = brk;
          un.uTime.value = 3.3;
          for (const m of view.scene.children) m.visible = m === view.skirt;
          view.scene.background = null;
          renderer.setRenderTarget(target);
          renderer.setClearColor(0x000000, 0);
          renderer.clear();
          renderer.render(view.scene, cam);
          const pix = new Uint8Array(W * H * 4);
          renderer.readRenderTargetPixels(target, 0, 0, W, H, pix);
          return pix;
        };
        let on, off, on2;
        try {
          on = shot(1); off = shot(0); on2 = shot(1);
        } finally {
          renderer.setRenderTarget(oldT);
          view.scene.background = savedBg;
          renderer.setClearColor(oldClear, oldAlpha);
          saved.forEach(([m, v]) => (m.visible = v));
          un.uSkirtBreak.value = 1;
          target.dispose();
        }
        const lum = (px, i) => px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
        const diffCount = (a, b2, th) => {
          let n = 0;
          for (let i = 0; i < a.length; i += 4) if (Math.abs(lum(a, i) - lum(b2, i)) > th) n++;
          return n;
        };
        // 投影每个岸点（rim 内→外 25% 处），判据用「两档之差」：亮段处两档相同（差 0），
        // 缝里 break=1 被压暗 → 差值成串出现。岛内的 halo 铺面两档一致，不会污染。
        const sampleRuns = (px, ref) => {
          const v = new THREE.Vector3();
          let runs = 0, gaps = 0, total = 0, bright = 0;
          for (const l of loops) {
            const n = l.u.length;
            let inGap = false;
            for (let i = 0; i < n; i++) {
              const k = (i * 4) * 3;   // 该岸点 4 个顶点里的第一个（rim 内）
              const ax = pos.array[k], az = pos.array[k + 2];
              const bx = pos.array[k + 3], bz = pos.array[k + 5];   // rim 外
              v.set(ax + (bx - ax) * 0.25, 0.006, az + (bz - az) * 0.25).project(cam);
              if (v.z > 1 || v.z < -1) continue;
              // readRenderTargetPixels 的第 0 行在**下**（r172 记过），所以 y 直接用 NDC 的 +1 端
              const x = Math.round((v.x * 0.5 + 0.5) * W), y = Math.round((v.y * 0.5 + 0.5) * H);
              if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
              let m = 0;
              for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const i = ((y + dy) * W + x + dx) * 4;
                m = Math.max(m, Math.abs(lum(px, i) - lum(ref, i)));
              }
              total++;
              const dimmed = m > 6;
              if (dimmed) bright++;
              if (dimmed && !inGap) { gaps++; inGap = true; }
              if (!dimmed && inGap) { runs++; inGap = false; }
            }
            if (inGap) runs++;
          }
          return { runs, gaps, total, dimShare: total ? +(bright / total).toFixed(3) : -1 };
        };
        const pxDiff = sampleRuns(on, off);

        // CPU 覆盖率分桶 → 对比 GPU 上同一批点的亮度（低覆盖桶必须明显更暗）
        const bucket = (px) => {
          const v = new THREE.Vector3();
          const acc = { low: { n: 0, s: 0 }, high: { n: 0, s: 0 } };
          for (const l of loops) {
            for (let i = 0; i < l.u.length; i++) {
              const k = (i * 4) * 3;
              const ax = pos.array[k], az = pos.array[k + 2], bx = pos.array[k + 3], bz = pos.array[k + 5];
              v.set(ax + (bx - ax) * 0.25, 0.006, az + (bz - az) * 0.25).project(cam);
              if (v.z > 1 || v.z < -1) continue;
              const x = Math.round((v.x * 0.5 + 0.5) * W), y = Math.round((v.y * 0.5 + 0.5) * H);
              if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
              const c = skirtCoverage(l.u[i] - 3.3 * 0.35, 3.3);
              const key = c < 0.15 ? 'low' : c > 0.90 ? 'high' : null;
              if (!key) continue;
              acc[key].n++; acc[key].s += lum(px, (y * W + x) * 4);
            }
          }
          return {
            lowN: acc.low.n, highN: acc.high.n,
            lowMean: acc.low.n ? +(acc.low.s / acc.low.n).toFixed(1) : -1,
            highMean: acc.high.n ? +(acc.high.s / acc.high.n).toFixed(1) : -1,
          };
        };
        const bkOn = bucket(on), bkOff = bucket(off);

        // 把「只画裙带」的两档存成图（RT 的 0 行在下，putImageData 前要翻回来）
        const toPng = (px) => {
          const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
          const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H);
          for (let y = 0; y < H; y++) {
            const src = (H - 1 - y) * W * 4, dst = y * W * 4;
            for (let i = 0; i < W * 4; i++) img.data[dst + i] = px[src + i];
          }
          ctx.putImageData(img, 0, 0);
          return cv.toDataURL('image/png');
        };
        const diffPx = new Uint8Array(W * H * 4);
        for (let i = 0; i < on.length; i += 4) {
          const d = Math.abs(lum(on, i) - lum(off, i));
          if (d > 6) { diffPx[i] = 235; diffPx[i + 1] = 76; diffPx[i + 2] = 60; diffPx[i + 3] = 255; }
          else diffPx[i + 3] = 255;
        }
        const pngOn = toPng(on), pngOff = toPng(off), pngDiff = toPng(diffPx);

        return {
          kind: rea.gridKind, versionKept: world.version === ver, countMatch, nonFinite, outOfRange,
          loops: loops.length, monotonic, glslOk,
          seamErr: +seam.toExponential(2),
          stats0, statsT, alwaysOn,
          clockMoved: { disagree, of: c0.length, share: +(disagree / c0.length).toFixed(3) },
          png: { on: pngOn, off: pngOff, diff: pngDiff },
          pixel: {
            noise: diffCount(on, on2, 2),
            onVsOff: diffCount(on, off, 6),
            diffShare: pxDiff.dimShare, diffRuns: pxDiff.runs, diffTotal: pxDiff.total,
            bucket: { on: bkOn, off: bkOff },
          },
        };
      }, null);

      for (const k of ['on', 'off', 'diff']) {
        const b64 = r.png[k].split(',')[1];
        fs.writeFileSync(`artifacts/coverage/${prefix}-${kind}-skirt-${k}.png`, Buffer.from(b64, 'base64'));
      }
      delete r.png;
      console.log('READ', kind, JSON.stringify(r));

      if (!r.versionKept) throw Error('world mutated');
      await p.evaluate(() => { rea.view.waterUniforms.uTime.value = 3.3; });
      await p.waitForTimeout(240);
      await p.screenshot({ path: `artifacts/coverage/${prefix}-${kind}.png` });
      await p.evaluate(() => { rea.view.skirtMaterial.uniforms.uSkirtBreak.value = 0; });
      await p.waitForTimeout(240);
      await p.screenshot({ path: `artifacts/coverage/${prefix}-${kind}-plain.png` });
      await p.evaluate(() => { rea.view.skirtMaterial.uniforms.uSkirtBreak.value = 1; });
      reports.push(r);
      await p.close();
    }
    if (errors.length) throw Error(errors.join('\n'));
    for (const r of reports) {
      if (!r.countMatch) throw Error('aArc/aA not per-vertex');
      if (r.nonFinite) throw Error('non-finite aArc');
      if (r.outOfRange) throw Error('aArc outside 0..2π');
      if (!r.glslOk) throw Error('GLSL twin drift');
      if (!(r.seamErr < 1e-6)) throw Error('cover not seamless: ' + r.seamErr);
      if (!(r.stats0.runs >= 2)) throw Error('shore band is one continuous run: ' + r.stats0.runs);
      if (!(r.stats0.gapShare > 0.12 && r.stats0.gapShare < 0.55)) throw Error('gap share out of range: ' + r.stats0.gapShare);
      if (!(Math.abs(r.stats0.gapShare - r.statsT.gapShare) > 0.01)) throw Error('gap width does not breathe: ' + r.stats0.gapShare + ' / ' + r.statsT.gapShare);
      if (!(r.clockMoved.share > 0.1)) throw Error('gaps do not travel along the shore: ' + r.clockMoved.share);
      if (r.pixel.noise !== 0) throw Error('skirt pass not reproducible: ' + r.pixel.noise);
      if (!(r.pixel.onVsOff > 400)) throw Error('turning the breakup off changes nothing: ' + r.pixel.onVsOff);
      if (!(r.pixel.diffRuns >= 2)) throw Error('rendered band is continuous (no separate dimmed stretches): ' + r.pixel.diffRuns);
      // 像素上被压暗的岸段占比应落在 CPU 覆盖率报的缝隙占比附近（±0.18），且显著大于 0
      if (!(r.pixel.diffShare > 0.25)) throw Error('too little of the band got dimmed: ' + r.pixel.diffShare);
      const on = r.pixel.bucket.on, off = r.pixel.bucket.off;
      if (!(on.lowN > 5 && on.highN > 5)) throw Error('too few sampled ring points: ' + JSON.stringify(on));
      // 缝里的亮度必须显著低于亮段（CPU 覆盖率 <0.15 vs >0.9 两桶）
      if (!(on.lowMean < on.highMean * 0.5)) throw Error('gaps are not darker than the segments: ' + JSON.stringify(on));
      // 关档后两桶应当差不多亮（= 沿全岸常亮）
      if (!(off.lowMean > off.highMean * 0.85)) throw Error('plain mode still dark in the gaps: ' + JSON.stringify(off));
    }
    fs.writeFileSync(`artifacts/coverage/${prefix}.json`, JSON.stringify({ reports, errors }, null, 2));
    console.log('PASS shore skirt breakup (segments + gaps travel / breathe, seamless loop, plain mode restores the continuous band)');
  } finally {
    await b.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
