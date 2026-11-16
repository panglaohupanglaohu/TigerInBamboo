// 第 101 轮 · 837027901853810688 · 地面红棕斑（ground-stain）并入「烟 × 火 × 地」同一条曲线。
//
// 第 100 轮把烟体积 × 火光做成了逐帧联合曲线（tests/smoke-fire-joint-curve-browser.cjs），
// 但 `src/badnorth/ground-stain.js` 那条地面染色一直只有三个时刻的点断言（tests/ground-stain-browser.cjs）。
// 本文件补的是**同一条时间轴上的第三条曲线**：地面斑到底是跟着火一起起、还是自己慢慢走。
//
// 原片口径（514 帧 / 32.885fps，见 src/badnorth/ground-stain.js 里的实测表）：
//   起爆帧 f0083（2.52s）一步跨到 25%，之后 3.04s→31% / 6.08s→44% / 9.12s→44%（平台）
//   / 10.95s→69% / 12.77s→94% / 13.38s→100%；
//   地面 (r−g) 从 −5.5 走到 +2.5，但 **R 一格没动**（160→161 / 154→154），G −11、B −9
//   → 是「乘性压绿蓝」，不是「叠一层粉」。
//
// 所以这里的断言不是「变粉了」，而是四件可量的事：
//   A 时间轴同源：染色起点 = 第一次受伤那一帧（b.t），不是页面加载后固定延时；
//   B 台阶形状：0.05s→0.25 / 3.56s→0.44 / 10.86s→1.00，且全程不回落；
//   C 渲染真的跟上：p=1 相对 p=0 的地面中位色 **R 几乎不动、G 掉得最多**（乘性特征）；
//   D 曲线耦合：地面 (r−g) 与 stainProgress 单调同向，且火（火光/烟）先起、地面后跟。
// 曲线落盘 artifacts/coverage/stain-joint-curve.json，供后续轮次对比。
const { chromium } = require('playwright');
const fs = require('fs');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'artifacts/coverage';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const problems = [];
  const rows = [];
  const ok = (c, m) => rows.push({ ok: !!c, m });
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 300)); });
  let rep = null;
  try {
    await page.goto('http://127.0.0.1:8769/index.html?scene=badnorth', { waitUntil: 'load' });
    await page.waitForFunction(() => globalThis.rea?.battle?.running === true, { timeout: 90000 });
    await page.waitForTimeout(1200);

    rep = await page.evaluate(async () => {
      const REA = globalThis.rea, b = REA.battle, c = b.c01;
      const v = REA.view, r = v.renderer;
      const W = r.domElement.width, H = r.domElement.height;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const g = cv.getContext('2d', { willReadFrequently: true });
      const grab = () => {
        r.render(v.scene, v.camera);
        g.clearRect(0, 0, W, H); g.drawImage(r.domElement, 0, 0);
        return g.getImageData(0, 0, W, H).data;
      };
      c.set('groundTint', true);
      c.set('fireGlow', true);              // 火光探针（r102 新增 c01.fireStats）要开这个档才有值
      b.update(1 / 60);
      if (!c.stain) return { error: 'stain 层没建起来（groundTint 开关没生效）' };

      // ---- 陆地掩膜：p=0 与 p=1 两次渲染做差，差集就是被染到的陆地格 ----
      c.setStainProgress(0); b.update(1 / 60); const A = grab();
      c.setStainProgress(1); b.update(1 / 60); const B = grab();
      const mask = new Uint8Array(W * H);
      let land = 0;
      for (let i = 0; i < W * H; i++) {
        const j = i * 4;
        if (Math.abs(B[j] - A[j]) + Math.abs(B[j + 1] - A[j + 1]) + Math.abs(B[j + 2] - A[j + 2]) > 6) { mask[i] = 1; land++; }
      }
      const medOver = (px) => {
        const rr = [], gg = [], bb = [];
        for (let i = 0; i < W * H; i++) if (mask[i]) { const j = i * 4; rr.push(px[j]); gg.push(px[j + 1]); bb.push(px[j + 2]); }
        const med = (a) => { a.sort((x, y) => x - y); return a[a.length >> 1]; };
        return [med(rr), med(gg), med(bb)];
      };
      const med0 = medOver(A), med1 = medOver(B);

      // ---- 自动档逐帧曲线：把起点钉在「第一次受伤」，然后 1/60 步进 ----
      // 「一开始就有一所房子失守」= 同一次伤害事件：染色起点与火光起点必须是同一帧
      if (b.houses[0]) { b.houses[0].lost = true; }
      c.setStainProgress(null);
      c.stainT0 = b.t;                       // 与生产一致：#stainStep 用 b.t - stainT0
      b.update(1 / 1000);                    // 走一步让 stats 从「强制 1」回到真实 0（否则第一条是脏值）
      const t0 = b.t, step = 1 / 60, span = 11.4;
      const marks = [0.05, 0.5, 3.56, 8.43, 10.86];
      const curve = [{ t: 0, p: c.stats.stainProgress, color: c.stats.stainColor,
        fire: c.fireStats?.intensity ?? 0, glow: c.fireStats?.houses ?? 0, smoke: 0 }];
      let mi = 0;
      for (let i = 1; i <= Math.round(span / step); i++) {
        b.update(step);
        const t = +(b.t - t0).toFixed(3);
        const smoke = REA.view.smoke;
        curve.push({ t, p: c.stats.stainProgress, color: c.stats.stainColor,
          fire: +(c.fireStats?.intensity ?? 0), glow: c.fireStats?.houses ?? 0, smoke: smoke?.p?.length ?? 0 });
        if (mi < marks.length && t >= marks[mi]) {
          const px = grab(), m = medOver(px);
          curve[curve.length - 1].gnd = m;
          curve[curve.length - 1].rmg = +(m[0] - m[1]).toFixed(1);
          mi++;
        }
      }
      return { W, H, land, med0, med1, curve, t0 };
    });
  } catch (e) {
    problems.push('fatal: ' + e.message);
  } finally {
    await browser.close();
  }

  if (rep?.error) problems.push(rep.error);
  const C = rep?.curve || [];
  const at = (t) => C.reduce((best, r) => (Math.abs(r.t - t) < Math.abs((best?.t ?? 1e9) - t) ? r : best), null);
  const m0 = rep?.med0, m1 = rep?.med1;

  ok(C.length > 600, `自动档采样 ${C.length} 帧（1/60 步长 / 11.4s）`);
  ok(rep?.land > (rep?.W * rep?.H || 1) * 0.05, `陆地掩膜 ${rep?.land}px = ${(100 * (rep?.land || 0) / ((rep?.W || 1) * (rep?.H || 1))).toFixed(1)}% 画幅`);
  // A 起点：t=0 那一帧还没染（stainT0 = 当前 b.t，age=0）
  ok((C[0]?.p ?? 1) <= 0.01, `起点 t=0 时 p=${C[0]?.p}（age≈0，ramp 起点 0，容差 0.01）`);
  // B 台阶形状（对齐 src/badnorth/ground-stain.js 的 ramp）
  const p05 = at(0.05)?.p, p356 = at(3.56)?.p, pEnd = C.at(-1)?.p;
  ok(Math.abs(p05 - 0.25) <= 0.03, `0.05s p=${p05}（原片起爆一帧内到 25%，容差 ±0.03）`);
  ok(Math.abs(p356 - 0.44) <= 0.03, `3.56s p=${p356}（原片 44% 平台，容差 ±0.03）`);
  ok(pEnd >= 0.99, `11.4s p=${pEnd}（原片 10.86s 到 100%）`);
  let drops = 0;
  for (let i = 1; i < C.length; i++) if (C[i].p < C[i - 1].p - 1e-9) drops++;
  ok(drops === 0, `全程不回落（倒退 ${drops} 处）`);
  // C 渲染跟上：乘性特征 = R 几乎不动、G 掉最多
  const dR = m0 && m1 ? m0[0] - m1[0] : 0, dG = m0 && m1 ? m0[1] - m1[1] : 0, dB = m0 && m1 ? m0[2] - m1[2] : 0;
  ok(Math.abs(dR) <= 3, `p0→p1 地面 R 变化 ${dR}（原片 160→161，乘性压绿蓝不是叠粉）`);
  ok(dG > 4 && dG > dR + 3, `p0→p1 地面 G 掉 ${dG}，比 R 的 ${dR} 多`);
  ok(dB > 2 && dB < dG + 2, `p0→p1 地面 B 掉 ${dB}（原片 B −9、G −11，B 略少）`);
  // D 耦合：地面 (r−g) 与 p 同向；火先起
  const gnd = C.filter((r) => r.gnd);
  const sorted = gnd.slice().sort((a, b) => a.p - b.p);
  let mono = 0;
  for (let i = 1; i < sorted.length; i++) if (sorted[i].rmg >= sorted[i - 1].rmg - 0.5) mono++;
  ok(gnd.length >= 4 && mono >= gnd.length - 2, `地面 (r−g) 随 p 单调同向 ${mono}/${gnd.length - 1} 段（${gnd.map((r) => `${r.t}s:${r.rmg}`).join(' / ')}）`);
  const firstFire = C.find((r) => r.fire > 0.05), firstStain = C.find((r) => r.p > 0.01);
  const hasFire = C.some((r) => r.fire > 0.05);
  ok(hasFire, `火光探针有值：max intensity=${Math.max(...C.map((r) => r.fire), 0).toFixed(3)}（c01.fireStats，r102 新增）`);
  ok(hasFire && Math.abs((firstFire?.t ?? 9) - (firstStain?.t ?? 0)) <= 0.02,
    `同帧耦合：火光首次 >0.05 在 ${firstFire?.t}s，地面开染在 ${firstStain?.t}s（时差 ≤0.02s = 同一帧伤害事件）`);

  if (problems.length) console.log('页面报错：\n' + problems.map((p) => '  ! ' + p).join('\n'));
  console.log(rows.map((r) => `  ${r.ok ? '✓' : '✗'} ${r.m}`).join('\n'));
  const summary = { land: rep?.land, med0: m0, med1: m1, dR, dG, dB, p05, p356, pEnd, drops,
    gnd: gnd.map((r) => ({ t: r.t, p: r.p, rmg: r.rmg })) };
  console.log('\n' + JSON.stringify(summary, null, 1));
  if (rep) fs.writeFileSync(`${OUT}/stain-joint-curve.json`, JSON.stringify({ summary, curve: C }, null, 1));
  const bad = rows.filter((r) => !r.ok).length;
  console.log(bad || problems.length ? `\nFAIL ${bad}/${rows.length}` : `\nALL PASS ${rows.length}/${rows.length}`);
  if (bad || problems.length) process.exitCode = 1;
})();
