/**
 * tests/megatexture-bounce-browser.cjs
 * 1580846877855338497「slowed down bounce sequence」运行验收（第 136 轮）：
 *   原文「mega texture ↔ light volume 来回互相影响；约第 3 次反弹后看不出变化」。
 *
 * 判据三层，全部来自真页面 / 真 View / 真实像素，不从代码「应该有」推断：
 *   ① 单向往返（状态空间）：volume k 只改光体积、mega texture 逐位不变；texture k 只改 mega texture、光体积逐位不变
 *      —— 「体积从贴图 gather」「贴图用体积重新照亮」两个方向各自成立，且交替进行 = 原文的 back and forth；
 *   ② 慢放入口：页面「慢放反弹序列」按钮真的把第 i 步推到主场景（stage 前进 + 状态栏读数）；
 *   ③ 像素级收敛：主场景 canvas 在 reset / direct / texture 1..6 各阶段的平均亮度、暗像素占比与逐轮差分，
 *      第 3 轮之后再加轮数必须落在「看不出」档（原文 about the 3rd bounce … not noticeable）。
 *
 * 口径对照（原片 41 帧逐帧量，同一量具 = 主场景区平均亮度 / 暗像素占比）：
 *   f0–6 = 99.66 / 0% · f7–9 = 48.39 / 39.6%（reset 全黑）· f10–17 = 84.79 / 9.48%（只有直射、阴影纯黑）
 *   · f18–25 = 98.35 / 0%（体积反弹填进阴影）· f26–40 = 99.16→99.29 / 0%（第 3 次后全程只差 0.13 级）。
 * 本仓像素取证**只留城镇网格 + 灯光**（关掉水/云/鸟/植被这些与 GI 无关的动画层），否则水波与云影会把
 * 只有零点几级的逐轮差分淹掉（r109 / r119 同一坑）。
 */
const { chromium } = require('playwright');
const fs = require('fs');

const OUT = 'artifacts/coverage';
const url = (p) => 'http://127.0.0.1:8769/' + p;

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [], report = {};
  try {
    const p = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
    p.on('pageerror', (e) => errors.push('mega: ' + e.message));
    await p.goto(url('megatexture-gi.html'), { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.megaReview?.stats, null, { timeout: 240000, polling: 300 });

    /* ---------- ② 慢放入口：先点一次真按钮，确认 stage 前进 ---------- */
    await p.waitForFunction(() => !document.getElementById('play').disabled, null, { timeout: 120000 });
    await p.click('#play');
    await p.waitForFunction(() => window.megaReview?.stage?.stage === 'reset', null, { timeout: 60000, polling: 100 });
    const playStage = await p.evaluate(() => ({ ...window.megaReview.stage, status: document.getElementById('status').textContent.slice(-30) }));
    await p.waitForTimeout(1100);
    const playAdvanced = await p.evaluate(() => window.megaReview?.stage?.index ?? -1);
    await p.click('#end');
    await p.waitForTimeout(1400);                        // 结束后循环必须真的停（旧版没有取消令牌，会继续覆写 stage）
    const endedStage = await p.evaluate(() => window.megaReview?.stage ?? null);

    /* ---------- 重烘 6 轮并保留全部快照 ---------- */
    const snap = await p.evaluate(async () => {
      const pg = window.megaPage, v = pg.view;
      pg.gi.options({ bounces: 6, keepSnapshots: true });
      for (let i = 0; i < 400 && !(v.megaGI?.snapshots?.length >= 14); i++) await new Promise((r) => setTimeout(r, 50));
      const r = v.megaGI;
      const eq = (a, b) => { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
      const diffN = (a, b) => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; };
      const sum = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };
      const S = r.snapshots;
      const out = { count: S.length, stages: S.map((s) => s.stage + (s.bounce || '')), dir: [] };
      out.resetZero = S[0].exitance.every((x) => x === 0) && S[0].lv.every((x) => x === 0);
      out.direct = { lvZero: S[1].lv.every((x) => x === 0), exitanceSum: +sum(S[1].exitance).toFixed(2) };
      for (let b = 1; b <= 6; b++) {
        const vIdx = S.findIndex((s) => s.stage === 'volume' && s.bounce === b), tIdx = S.findIndex((s) => s.stage === 'texture' && s.bounce === b);
        const before = S[vIdx - 1], vol = S[vIdx], tex = S[tIdx];
        out.dir.push({
          bounce: b,
          volumeStep: { lvChanged: diffN(vol.lv, before.lv), exitanceBitSame: eq(vol.exitance, before.exitance), lvSum: +sum(vol.lv).toFixed(2) },
          textureStep: { lvBitSame: eq(tex.lv, vol.lv), exitanceChanged: diffN(tex.exitance, vol.exitance), exitanceSum: +sum(tex.exitance).toFixed(2) },
        });
      }
      out.bounceStats = r.bounceStats.map((b) => ({ bounce: b.bounce, meanChange: +b.meanChange.toFixed(5), relativeChange: +(b.relativeChange ?? 0).toFixed(5) }));
      out.stats = { texels: r.stats.texels, charts: r.stats.charts, uvMatchRate: +r.stats.uvMatchRate.toFixed(4), lvCells: r.stats.lvCells, raysPerLobe: r.stats.raysPerLobe };
      out.idx = { reset: 0, direct: 1, texture1: 3, texture2: 5, texture3: 7, texture4: 9, texture6: 13 };
      return out;
    });
    report.state = snap;

    /* ---------- ③ 主场景像素：阶段 → 渲染 0 秒 → 把 WebGL canvas 画进 2D canvas ---------- */
    const pix = await p.evaluate(async (idx) => {
      const pg = window.megaPage, v = pg.view, f = document.querySelector('#scene').contentDocument, gl = f.querySelector('canvas');
      const grab = () => {
        v.render(0);                                     // 同一时钟值 → 同状态两帧应逐像素相同
        const cv = document.createElement('canvas'); cv.width = gl.width; cv.height = gl.height;
        cv.getContext('2d').drawImage(gl, 0, 0);
        return cv;
      };
      const data = (cv) => cv.toDataURL('image/png');
      const stage = async (i) => { pg.show(i); await new Promise((r) => setTimeout(r, 260)); return grab(); };

      // (a) 全场景取证（水/云/鸟都在，画面观感对照用）
      const full = {};
      for (const n of ['reset', 'direct', 'texture1', 'texture3']) full[n] = data(await stage(idx[n]));

      // (b) 只留城镇网格 + 灯光（关掉与 GI 无关的动画层），量逐轮差分
      const hidden = [];
      { const keep = new Set([v.mesh]); for (let o = v.mesh.parent; o && o !== v.scene; o = o.parent) keep.add(o);
        for (const ch of v.scene.children) if (!keep.has(ch) && !ch.isLight) { hidden.push([ch, ch.visible]); ch.visible = false; } }
      const clean = {};
      let noiseCv = null;
      for (const n of Object.keys(idx)) { clean[n] = await stage(idx[n]); if (n === 'texture3') noiseCv = grab(); }   // 同阶段第二帧
      const cleanData = Object.fromEntries(['reset', 'direct', 'texture1', 'texture3', 'texture6'].map((n) => [n, data(clean[n])]));
      for (const [o, vis] of hidden) o.visible = vis;
      pg.gi.endStages();

      const stats = (cv) => {
        const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let s = 0, dark = 0, n = cv.width * cv.height;
        for (let i = 0; i < d.length; i += 4) { const l = .2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2]; s += l; if (l < 10) dark++; }
        return { meanL: +(s / n).toFixed(2), darkPct: +(100 * dark / n).toFixed(2) };
      };
      const diff = (A, B) => {
        const a = A.getContext('2d').getImageData(0, 0, A.width, A.height).data, b = B.getContext('2d').getImageData(0, 0, B.width, B.height).data;
        let n = 0, s = 0, mx = 0;
        for (let i = 0; i < a.length; i += 4) { const d = Math.abs(.2126 * a[i] + .7152 * a[i + 1] + .0722 * a[i + 2] - (.2126 * b[i] + .7152 * b[i + 1] + .0722 * b[i + 2])); if (d > 2) { n++; s += d; mx = Math.max(mx, d); } }
        return { px: n, mean: +(s / Math.max(1, n)).toFixed(2), max: +mx.toFixed(1) };
      };
      return {
        size: [gl.width, gl.height], full, clean: cleanData,
        means: Object.fromEntries(Object.entries(clean).map(([k, cv]) => [k, stats(cv)])),
        diffs: {
          noise: diff(clean.texture3, noiseCv),
          reset_direct: diff(clean.reset, clean.direct),
          direct_tex1: diff(clean.direct, clean.texture1),
          tex1_tex2: diff(clean.texture1, clean.texture2),
          tex2_tex3: diff(clean.texture2, clean.texture3),
          tex3_tex4: diff(clean.texture3, clean.texture4),
          tex3_tex6: diff(clean.texture3, clean.texture6),
        },
        restored: { sun: v.sun.intensity, amb: v.ambient.intensity, hemi: v.hemi.intensity, fill: v.fill?.intensity ?? null },
      };
    }, snap.idx);
    report.pixels = pix;

    /* ---------- 落盘取证 ---------- */
    const save = (b64, name) => fs.writeFileSync(`${OUT}/${name}`, Buffer.from(b64.split(',')[1], 'base64'));
    for (const [n, b] of Object.entries(pix.full)) save(b, `megatexture-bounce-r136-full-${n}.png`);
    for (const [n, b] of Object.entries(pix.clean)) save(b, `megatexture-bounce-r136-clean-${n}.png`);

    /* ---------- 三张贴图在当前阶段非空白 + 页头 ---------- */
    report.canvases = await p.evaluate(() => {
      const o = {};
      for (const id of ['c-sdf', 'c-lv', 'c-mega']) {
        const c = document.getElementById(id), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        const set = new Set(); let ink = 0;
        for (let i = 0; i < d.length; i += 4) { set.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); if (d[i] + d[i + 1] + d[i + 2] > 24) ink++; }
        o[id] = { colors: set.size, inkShare: +(ink / (c.width * c.height)).toFixed(3) };
      }
      return o;
    });
    await p.screenshot({ path: `${OUT}/megatexture-bounce-r136-maps.png`, clip: { x: 0, y: 0, width: 1280, height: 340 } });
    await p.close();

    /* ---------- 断言 ---------- */
    const fail = [];
    const st = report.state, px = report.pixels, M = px.means, df = px.diffs;
    if (st.count !== 14) fail.push(`快照数 ${st.count} != 14（reset + direct + 6×(volume,texture)）`);
    if (!st.resetZero) fail.push('reset 阶段不是全 0');
    if (!st.direct.lvZero || !(st.direct.exitanceSum > 0)) fail.push(`direct 阶段应「贴图亮 / 体积全黑」，实为 ${JSON.stringify(st.direct)}`);
    for (const d of st.dir) {
      if (!(d.volumeStep.lvChanged > 0)) fail.push(`第${d.bounce}轮 volume 阶段光体积没变`);
      if (!d.volumeStep.exitanceBitSame) fail.push(`第${d.bounce}轮 volume 阶段居然改了 mega texture（说明不是先 gather 体积）`);
      if (!d.textureStep.lvBitSame) fail.push(`第${d.bounce}轮 texture 阶段光体积被改了（说明不是用固定体积重照贴图）`);
      if (!(d.textureStep.exitanceChanged > 0)) fail.push(`第${d.bounce}轮 texture 阶段 mega texture 没变`);
    }
    const rc = st.bounceStats.map((b) => b.relativeChange);
    if (!(rc[1] < rc[0] && rc[2] < rc[1] && rc[3] < rc[2])) fail.push(`反弹未单调衰减 ${JSON.stringify(rc)}`);
    if (!(rc[2] < 0.02)) fail.push(`第 3 轮相对变化 ${rc[2]} 未进 2% 内`);
    if (playStage.stage !== 'reset' || !(playAdvanced >= 1)) fail.push(`慢放按钮没推进 stage（${playStage.stage} → ${playAdvanced}）`);
    if (endedStage !== null) fail.push(`点「结束慢放」后播放循环仍在写 stage（${JSON.stringify(endedStage)}）`);
    if (df.noise.px !== 0) fail.push(`同阶段两帧噪声 ${df.noise.px}px（渲染不确定）`);
    if (!(M.reset.meanL < M.direct.meanL - 20)) fail.push(`reset 不够黑 ${M.reset.meanL} vs direct ${M.direct.meanL}`);
    if (!(M.direct.darkPct > 0.5)) fail.push(`direct 阶段没有暗阴影 dark%=${M.direct.darkPct}`);
    if (!(M.texture1.darkPct < Math.max(0.2, M.direct.darkPct * 0.5))) fail.push(`texture1 阴影没被填起来（${M.direct.darkPct}% → ${M.texture1.darkPct}%）`);
    if (!(M.texture1.meanL > M.direct.meanL + 5)) fail.push(`texture1 平均亮度只抬了 ${(M.texture1.meanL - M.direct.meanL).toFixed(2)} 级`);
    if (!(df.direct_tex1.px > 100000)) fail.push(`direct→texture1 差分只有 ${df.direct_tex1.px}px`);
    if (!(df.tex1_tex2.px > df.tex2_tex3.px && df.tex2_tex3.px > df.tex3_tex4.px)) fail.push(`逐轮差分未递减 ${JSON.stringify([df.tex1_tex2, df.tex2_tex3, df.tex3_tex4])}`);
    if (!(df.tex3_tex6.px <= df.direct_tex1.px * 0.02)) fail.push(`第 3 轮之后还在明显变化：tex3→tex6 ${df.tex3_tex6.px}px vs direct→tex1 ${df.direct_tex1.px}px`);
    if (!(M.texture6.meanL - M.texture3.meanL <= 0.5)) fail.push(`tex3→tex6 平均亮度还差 ${(M.texture6.meanL - M.texture3.meanL).toFixed(2)} 级`);
    if (!(Math.abs(px.restored.sun - 2.7) < 1e-6 && Math.abs(px.restored.amb - 0.5) < 1e-6 && Math.abs(px.restored.hemi - 0.95) < 1e-6 && Math.abs(px.restored.fill - 0.45) < 1e-6)) fail.push(`endStages 没还原灯光 ${JSON.stringify(px.restored)}`);
    for (const id of ['c-sdf', 'c-lv', 'c-mega']) if (!(report.canvases[id].colors > 20 && report.canvases[id].inkShare > 0.05)) fail.push(`${id} 近乎空白 ${JSON.stringify(report.canvases[id])}`);
    if (errors.length) fail.push('pageerror: ' + errors.join(' | '));

    fs.writeFileSync(`${OUT}/megatexture-bounce-browser.json`, JSON.stringify({ report, errors, fail }, null, 2));
    if (fail.length) { console.error('FAIL\n - ' + fail.join('\n - ')); console.error(JSON.stringify(report, null, 1)); process.exitCode = 1; }
    else console.log('PASS 1580846877855338497 往返反弹（慢放序列）\n'
      + `  快照 ${st.count} 步（${st.stages.join(' / ')}）· ${st.stats.texels} 纹素 / ${st.stats.charts} 片 · SDF-UV 命中 ${(100 * st.stats.uvMatchRate).toFixed(1)}%\n`
      + '  单向往返：' + st.dir.map((d) => `b${d.bounce} 体积改 ${d.volumeStep.lvChanged}/贴图 0 → 贴图改 ${d.textureStep.exitanceChanged}/体积 0`).join(' · ') + '\n'
      + `  慢放按钮：${playStage.stage} → index ${playAdvanced} → 结束后 stage=${endedStage}\n`
      + `  净场景像素（${px.size.join('×')}）：reset ${M.reset.meanL}/${M.reset.darkPct}% · direct ${M.direct.meanL}/${M.direct.darkPct}% · tex1 ${M.texture1.meanL}/${M.texture1.darkPct}% · tex2 ${M.texture2.meanL}% · tex3 ${M.texture3.meanL}% · tex4 ${M.texture4.meanL}% · tex6 ${M.texture6.meanL}%\n`
      + `  差分：噪声 ${df.noise.px} · reset→direct ${df.reset_direct.px} · direct→tex1 ${df.direct_tex1.px} · tex1→2 ${df.tex1_tex2.px} · tex2→3 ${df.tex2_tex3.px} · tex3→4 ${df.tex3_tex4.px} · tex3→6 ${df.tex3_tex6.px} px\n`
      + '  相对变化：' + rc.map((x) => (100 * x).toFixed(2) + '%').join(' → ') + '（原片 f26–40 全程只差 0.13 亮度级）');
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
