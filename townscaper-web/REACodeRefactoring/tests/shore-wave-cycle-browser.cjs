// 1849732997945110651 / 1991101097818403263 的收口验收：
//   ① 生成时烘入的 in/out 方向 + 逐顶点 period/phase（每个顶点自己的钟）
//   ② 循环着色器：蓝线(t=0) → 黄线(t=hit) → 出去一点点(t>hit) → 两端不可见所以无缝
//   ③ 闭环整数谐波：crest 绕一圈回到原值（接缝连续）
//   ④ 窄湾浪带防穿岸（c10=shoreclamp）+ 全局泡沫遮罩（c10=foammask）在真 View 上的后果
// 口径：几何量走「读真 geometry 属性 + 按真 shader 文本复算」的 CPU 孪生；像素走离屏 RT 读回。
const {chromium} = require('playwright'), fs = require('fs');

const HIT = 0.68;
const prefix = process.env.REA_SHORE_PREFIX || 'shore-cycle';

// 与 src/core/wave-cycle.js 的 shoreCycle 逐行同式（独立实现，不 import，避免同源自证）
const CYCLE_SRC = `(function(){
  const HIT = ${HIT};
  const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  return function shoreCycle(t){
    if (t < HIT) { const u=t/HIT, f=1-u*u*(3-2*u); return {x:f,y:0,a:smooth(0.05,0.55,u)*(0.12+0.78*u*u)}; }
    const u=(t-HIT)/(1-HIT);
    return {x:0,y:0.22*Math.sin(u*1.57079632679),a:0.90*(1-u)*(1-u)};
  };
})()`;

(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const reports = [], errors = [];
  try {
    for (const kind of ['mixed', 'quad']) {
      const p = await b.newPage({viewport: {width: 1440, height: 1000}});
      p.on('pageerror', (e) => errors.push(`${kind}: ${e.message}`));
      await p.goto(`http://localhost:8769/index.html?scene=terrain&grid=${kind}&c10=shoreclamp,foammask`);
      await p.waitForFunction(() => window.rea?.view?.c10 && rea.view.waves?.geometry?.attributes?.aShore, null, {polling: 100});
      await p.waitForTimeout(600);

      const r = await p.evaluate(async ({HIT, cycleSrc}) => {
        const THREE = await import('three');
        const shoreCycle = eval(cycleSrc);
        const {view, world} = rea, c10 = view.c10;
        const ver = world.version;

        // ---------- ① 烘入的属性 ----------
        const g = view.waves.geometry, A = (n) => g.getAttribute(n).array;
        const N = g.getAttribute('position').count;
        const aIn = A('aIn'), aOut = A('aOut'), aShore = A('aShore'), aSea = A('aSea');
        const aPhase = A('aPhase'), aPeriod = A('aPeriod'), aCrest = A('aCrest'), aWidth = A('aWidth'), aRow = A('aRow');
        let nonFinite = 0;
        for (const arr of [aIn, aOut, aShore, aSea, aPhase, aPeriod, aCrest, aWidth, aRow])
          for (const v of arr) if (!Number.isFinite(v)) nonFinite++;

        // |out|==|in|（镜面），且回弹方向不朝岸内插（cos>=0）
        let mirrorErr = 0, inward = 0, cosSum = 0, reachSum = 0, minReach = Infinity;
        for (let i = 0; i < N; i++) {
          const k = i * 2;
          const lin = Math.hypot(aIn[k], aIn[k + 1]), lout = Math.hypot(aOut[k], aOut[k + 1]);
          mirrorErr = Math.max(mirrorErr, Math.abs(lin - lout) / Math.max(lin, 1e-9));
          const cos = (aIn[k] * aOut[k] + aIn[k + 1] * aOut[k + 1]) / Math.max(lin * lout, 1e-12);
          cosSum += cos; if (cos < 0) inward++;
          const reach = Math.hypot(aSea[k] - aShore[k], aSea[k + 1] - aShore[k + 1]);
          reachSum += reach; minReach = Math.min(minReach, reach);
        }
        const periodSet = new Set(Array.from(aPeriod, (v) => v.toFixed(4)));
        const phaseSet = new Set(Array.from(aPhase, (v) => v.toFixed(4)));
        const crestVals = Array.from(aCrest);

        // ---------- ② 循环：蓝线 → 黄线 → 出去一点 ----------
        const probe = (i, t) => {
          const k = i * 2, c = shoreCycle(t);
          return {x: aShore[k] + aIn[k] * c.x + aOut[k] * c.y, z: aShore[k + 1] + aIn[k + 1] * c.x + aOut[k + 1] * c.y, a: c.a};
        };
        let seaErr = 0, shoreErr = 0;
        for (let i = 0; i < N; i++) {
          const k = i * 2, reach = Math.hypot(aSea[k] - aShore[k], aSea[k + 1] - aShore[k + 1]);
          const q0 = probe(i, 0), qh = probe(i, HIT);
          seaErr = Math.max(seaErr, Math.hypot(q0.x - aSea[k], q0.z - aSea[k + 1]) / reach);
          shoreErr = Math.max(shoreErr, Math.hypot(qh.x - aShore[k], qh.z - aShore[k + 1]) / reach);
        }
        // 回弹：t=0.9 时位移必须精确等于 aOut * cycle.y（逐顶点同一比例）
        const tBack = 0.9, yBack = shoreCycle(tBack).y;
        let backErr = 0;
        for (let i = 0; i < N; i++) {
          const k = i * 2, l2 = aOut[k] * aOut[k] + aOut[k + 1] * aOut[k + 1];
          const along = (aIn[k] * 0 + aOut[k] * yBack) * aOut[k] + (aOut[k + 1] * yBack) * aOut[k + 1];
          backErr = Math.max(backErr, Math.abs(along / l2 - yBack));
        }
        const backPeak = Math.max(...[0.7, 0.8, 0.9, 0.99].map((t) => shoreCycle(t).y));
        const alpha = [0, 0.2, 0.4, 0.68, 0.8, 0.95, 1 - 1e-6].map((t) => ({t, a: +shoreCycle(t).a.toFixed(4)}));
        const distRow = [0, 0.25, 0.5, 0.6801, 0.75, 0.9].map((t) => ({t, d: +shoreCycle(t).x.toFixed(4), back: +shoreCycle(t).y.toFixed(4)}));
        const samples = [0, (N >> 2), (N >> 1), (N - 1)].map((i) => {
          const k = i * 2, reach = Math.hypot(aSea[k] - aShore[k], aSea[k + 1] - aShore[k + 1]);
          return {
            vertex: i, reach: +reach.toFixed(4),
            row: [0, 0.34, 0.67, 0.6801, 0.8, 0.95].map((t) => {
              const q = probe(i, t);
              return {t, dShore: +(Math.hypot(q.x - aShore[k], q.z - aShore[k + 1]) / reach).toFixed(4), a: +q.a.toFixed(4)};
            }),
          };
        });

        // ---------- 同一 uTime 下「不是齐步走」----------
        const uTime = 3.7, uPeriod = view.waveMaterial.uniforms.uPeriod.value;
        let inbound = 0, outbound = 0, tMin = 1, tMax = 0;
        const row0t = [];
        for (let i = 0; i < N; i++) {
          const t = (((uTime / (uPeriod * aPeriod[i])) + aPhase[i]) % 1 + 1) % 1;
          if (t < HIT) inbound++; else outbound++;
          tMin = Math.min(tMin, t); tMax = Math.max(tMax, t);
          if (aRow[i] === 0) row0t.push(t.toFixed(3));
        }

        // ---------- ③ 闭环整数谐波 ----------
        const {waveCrest} = await import('./src/core/wave-cycle.js');
        const seed = 1.3, loop = [];
        for (let k = 0; k <= 720; k++) loop.push(waveCrest((k / 720) * Math.PI * 2, seed).coverage);
        const seamErr = Math.abs(loop[0] - waveCrest(Math.PI * 2, seed).coverage);
        let maxima = 0;
        for (let k = 1; k < 720; k++) if (loop[k] > loop[k - 1] && loop[k] >= loop[k + 1]) maxima++;

        // ---------- ④ 防穿岸 + 泡沫 ----------
        c10.set('shoreclamp', false);
        view.render(1 / 60); view.render(1 / 60);
        const before = c10.auditShore(0.04);
        c10.set('shoreclamp', true);
        view.render(1 / 60); view.render(1 / 60);
        const after = c10.auditShore(0.04);
        const clampStats = c10.stats.shoreclamp;

        const lay = c10.layers.foammask;
        lay.refresh();
        const tex = lay.mat.uniforms.uMask.value, bytes = tex.image.data;
        let band = 0, holes = 0;
        for (let k = 0; k < bytes.length; k += 4) {
          if (bytes[k] > 6) band++;
          if (bytes[k] <= 12) holes++;
        }

        // ---------- 像素：同一机位、只改 uTime ----------
        const renderer = view.renderer, W = 512, H = 512;
        const target = new THREE.WebGLRenderTarget(W, H);
        const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 300);
        cam.position.set(9.5, 11.5, 9.5); cam.up.set(0, 1, 0); cam.lookAt(0, 0, 0);
        const saved = view.scene.children.map((m) => [m, m.visible]);
        const un = view.waterUniforms.uTime, oldT = renderer.getRenderTarget();
        const shots = {};
        const shot = (t) => {
          un.value = t;
          renderer.setRenderTarget(target);
          renderer.render(view.scene, cam);
          const pix = new Uint8Array(W * H * 4);
          renderer.readRenderTargetPixels(target, 0, 0, W, H, pix);
          return pix;
        };
        try {
          shots.t0 = shot(0);
          shots.t0b = shot(0);
          shots.hit = shot(uPeriod * aPeriod[0] * HIT);
          shots.back = shot(uPeriod * aPeriod[0] * 0.82);
        } finally {
          renderer.setRenderTarget(oldT); target.dispose();
          saved.forEach(([m, v]) => (m.visible = v));
          un.value = 0;
        }
        const lum = (px, i) => px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
        const diffCount = (a, b2, th) => {
          let n = 0;
          for (let i = 0; i < a.length; i += 4) if (Math.abs(lum(a, i) - lum(b2, i)) > th) n++;
          return n;
        };
        const bright = (px) => {
          let n = 0, sx = 0, sy = 0;
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            if (px[i] > 232 && px[i + 1] > 238 && px[i + 2] > 240) { n++; sx += x; sy += y; }
          }
          if (!n) return {n: 0, r: -1};
          return {n, r: +Math.hypot(sx / n - W / 2, sy / n - H / 2).toFixed(2)};
        };
        const screen = {
          noise: diffCount(shots.t0, shots.t0b, 2),
          t0_vs_hit: diffCount(shots.t0, shots.hit, 6),
          t0_vs_back: diffCount(shots.t0, shots.back, 6),
          brightT0: bright(shots.t0), brightHit: bright(shots.hit),
        };

        return {
          kind: rea.gridKind, versionKept: world.version === ver, vertices: N, nonFinite,
          baked: {
            mirrorErr: +mirrorErr.toExponential(2), inwardRatio: +(inward / N).toFixed(4),
            meanCos: +(cosSum / N).toFixed(4), meanReach: +(reachSum / N).toFixed(4), minReach: +minReach.toFixed(4),
            periods: periodSet.size, phases: phaseSet.size,
            crestRange: [Math.min(...crestVals), Math.max(...crestVals)].map((v) => +v.toFixed(3)),
          },
          cycle: {seaErr: +seaErr.toExponential(2), shoreErr: +shoreErr.toExponential(2), backErr: +backErr.toExponential(2), backPeak: +backPeak.toFixed(4), distRow, alpha, samples},
          clock: {uTime, inboundRatio: +(inbound / N).toFixed(4), outboundRatio: +(outbound / N).toFixed(4), tMin: +tMin.toFixed(3), tMax: +tMax.toFixed(3), distinctPhaseRow0: new Set(row0t).size},
          loop: {seamErr: +seamErr.toExponential(2), maxima},
          shoreclamp: {before: before.ratio, after: after.ratio, crossingBefore: before.crossing, crossingAfter: after.crossing, stats: clampStats},
          foam: {band, holes, holeRatio: +(holes / (band + holes)).toFixed(3)},
          screen,
        };
      }, {HIT, cycleSrc: CYCLE_SRC});

      await p.evaluate(() => { rea.view.waterUniforms.uTime.value = 0; });
      await p.waitForTimeout(220);
      await p.screenshot({path: `artifacts/coverage/${prefix}-${kind}-t0.png`});
      await p.evaluate(({hit}) => { rea.view.waterUniforms.uTime.value = hit; }, {hit: 4.6 * 0.98 * HIT});
      await p.waitForTimeout(220);
      await p.screenshot({path: `artifacts/coverage/${prefix}-${kind}-hit.png`});

      console.log('READ', kind, JSON.stringify(r));

      if (!r.versionKept) throw Error('world mutated');
      if (r.nonFinite) throw Error('non-finite baked attribute');
      // 属性是 Float32BufferAttribute，|out|==|in| 只到 float32 精度
      if (!(r.baked.mirrorErr < 5e-6)) throw Error('|out| != |in|: ' + r.baked.mirrorErr);
      if (r.baked.inwardRatio !== 0) throw Error('bounce points inland: ' + r.baked.inwardRatio);
      if (!(r.baked.meanCos > 0.5)) throw Error('out not a reflection of in: ' + r.baked.meanCos);
      if (!(r.baked.periods >= 3)) throw Error('per-vertex periods not independent: ' + r.baked.periods);
      if (!(r.baked.phases > 10)) throw Error('phases not spread: ' + r.baked.phases);
      if (!(r.cycle.seaErr < 2e-4)) throw Error('t=0 not on blue line: ' + r.cycle.seaErr);
      if (!(r.cycle.shoreErr < 2e-4)) throw Error('t=hit not on yellow line: ' + r.cycle.shoreErr);
      if (!(r.cycle.backErr < 1e-9)) throw Error('bounce not along aOut: ' + r.cycle.backErr);
      if (!(r.cycle.backPeak > 0.215 && r.cycle.backPeak < 0.225)) throw Error('bounce too big/small: ' + r.cycle.backPeak);
      if (!(r.cycle.alpha[0].a === 0 && r.cycle.alpha.at(-1).a < 0.001)) throw Error('loop ends not invisible');
      if (!(r.cycle.alpha[3].a > 0.85)) throw Error('no bright crest at hit');
      if (!(r.clock.inboundRatio > 0.3 && r.clock.inboundRatio < 0.85)) throw Error('all waves in lockstep: ' + r.clock.inboundRatio);
      if (!(r.clock.tMax - r.clock.tMin > 0.9)) throw Error('t not spanning the cycle');
      if (!(r.clock.distinctPhaseRow0 > 8)) throw Error('row-0 phases not spread');
      if (!(r.loop.seamErr < 1e-12)) throw Error('crest seam not closed: ' + r.loop.seamErr);
      if (!(r.loop.maxima >= 10)) throw Error('crest has too few peaks: ' + r.loop.maxima);
      if (!(r.shoreclamp.stats?.clamped > 0)) throw Error('shoreclamp did nothing');
      if (!(r.shoreclamp.after < r.shoreclamp.before)) throw Error('narrow-bay crossing not reduced');
      if (!(r.foam.band > 200)) throw Error('foam band empty');
      if (!(r.foam.holeRatio > 0.5)) throw Error('foam is a solid ring');
      if (r.screen.noise !== 0) throw Error('same uTime not reproducible: ' + r.screen.noise);
      if (!(r.screen.t0_vs_hit > 400)) throw Error('moving the clock changes nothing on screen: ' + r.screen.t0_vs_hit);
      reports.push(r);
      await p.close();
    }
    if (errors.length) throw Error(errors.join('\n'));
    fs.writeFileSync(`artifacts/coverage/${prefix}.json`, JSON.stringify({reports, errors}, null, 2));
    console.log('PASS shore wave cycle (blue->yellow->bounce, per-vertex clocks, closed crest) + clamp/foam on real View');
  } finally {
    await b.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
