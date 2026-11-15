/**
 * flow-lod-badnorth.cjs — 第 75 轮 · 902069261304287232 / 901842167508992000 缺口「远景散须 LOD」
 *
 * 背景：第 71–74 轮连续四次在**录像里**想量 LOD 都没成 —— 两条片子都是固定等轴机位、整岛一次入画，
 *   近处与画面最远端的须长/密度看不出差别。缺口因此改成「必须到实景页量」。
 * 本脚本就是那一步：在 `index.html?scene=badnorth`（真实战斗场景）里打开流线，按**投影后的屏幕纵向**分三档
 *   （下=近、中、上=远），量每档的「线段平均像素长」和「每 100×100 px 的线段数」，并报告 远/近 比。
 *
 * 判据：
 *   ① 场景起来、流线有几何（三档各自都有段，说明量测真的落在画面上）；
 *   ② 三档的段均像素长与密度都量出来（不当断言用，只做记录）；
 *   ③ 输出 lodVerdict：远/近 长度比落在 0.85–1.15 且密度比也在 0.85–1.15 → 'not-applicable'（画面本身没有 LOD），
 *      否则 'measurable'（说明实景页有 LOD，缺口要按量到的比值写进 next）。
 */
const { chromium } = require('playwright');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const out = { ok: true, checks: [] };
  const check = (n, c, d) => { out.checks.push({ name: n, pass: !!c, detail: d }); if (!c) out.ok = false; console.log(`  ${c ? 'PASS' : 'FAIL'} ${n} — ${d}`); };

  try {
    await page.goto('http://127.0.0.1:8769/index.html?scene=badnorth', { waitUntil: 'load' });
    await page.waitForFunction(() => window.rea?.battle?.running === true, null, { timeout: 90000 });
    await page.waitForTimeout(1200);

    // 流线开关在 view 上（battle.#drawFlow 读 view.flowDebug），并且要等 0.25s 的流场重建把 flowDef 建出来
    await page.evaluate(() => { rea.view.flowDebug = true; rea.battle.flowT = 0; });
    await page.waitForFunction(() => (rea.battle.flowLines?.geometry?.attributes?.position?.count || 0) > 100, null, { timeout: 60000 });
    const m = await page.evaluate(() => {
      const b = rea.battle, v = rea.view;
      v.render(0.016);
      const pos = b.flowLines?.geometry?.attributes?.position?.array || [];
      const cam = v.camera; cam.updateMatrixWorld(); cam.updateProjectionMatrix();
      const W = v.renderer.domElement.clientWidth, H = v.renderer.domElement.clientHeight;
      const V = new (window.THREE?.Vector3 || Object)();
      const toPx = (x, y, z) => {
        const p = { x, y, z };
        // 手写投影：与 three 一致（project → NDC → 屏幕），避免依赖 window.THREE
        const m = cam.projectionMatrix.elements, mv = cam.matrixWorldInverse.elements;
        const ex = mv[0] * p.x + mv[4] * p.y + mv[8] * p.z + mv[12];
        const ey = mv[1] * p.x + mv[5] * p.y + mv[9] * p.z + mv[13];
        const ez = mv[2] * p.x + mv[6] * p.y + mv[10] * p.z + mv[14];
        const cw = m[3] * ex + m[7] * ey + m[11] * ez + m[15];
        const cx = m[0] * ex + m[4] * ey + m[8] * ez + m[12];
        const cy = m[1] * ex + m[5] * ey + m[9] * ez + m[13];
        if (!isFinite(cw) || cw <= 1e-6) return null;
        return { x: (cx / cw * .5 + .5) * W, y: (1 - (cy / cw * .5 + .5)) * H };
      };
      const bands = { near: { len: 0, n: 0, area: 0 }, mid: { len: 0, n: 0, area: 0 }, far: { len: 0, n: 0, area: 0 } };
      for (let i = 0; i + 5 < pos.length; i += 6) {
        const a = toPx(pos[i], pos[i + 1], pos[i + 2]), c = toPx(pos[i + 3], pos[i + 4], pos[i + 5]);
        if (!a || !c) continue;
        const yMid = (a.y + c.y) / 2;
        if (yMid < 0 || yMid > H) continue;
        const k = yMid > H * 0.62 ? 'near' : yMid < H * 0.38 ? 'far' : 'mid';
        bands[k].len += Math.hypot(c.x - a.x, c.y - a.y); bands[k].n++;
      }
      bands.near.area = (H * 0.38) * W / 1e4; bands.mid.area = (H * 0.24) * W / 1e4; bands.far.area = (H * 0.38) * W / 1e4;
      const rep = {};
      for (const [k, s] of Object.entries(bands)) rep[k] = { segs: s.n, meanPx: s.n ? +(s.len / s.n).toFixed(2) : null, per10k: s.area ? +(s.n / s.area).toFixed(1) : null };
      return {
        units: b.units?.length ?? null, segs: pos.length / 6, rep,
        wispLen: b.flowWispLen ?? null, flowCalls: v.renderer.info.render.calls, W, H,
      };
    });

    console.log('  量测：' + JSON.stringify(m));
    const { near, mid, far } = m.rep;
    check('① 场景起来、三档都有流线段', m.segs > 0 && near.segs > 50 && mid.segs > 20 && far.segs > 50,
      `总段 ${m.segs}，近 ${near.segs} / 中 ${mid.segs} / 远 ${far.segs}`);
    check('② 三档像素长度与密度都可量', near.meanPx != null && far.meanPx != null, `均长 px 近 ${near.meanPx} / 中 ${mid.meanPx} / 远 ${far.meanPx}`);
    const lenRatio = +(far.meanPx / near.meanPx).toFixed(3), denRatio = +(far.per10k / near.per10k).toFixed(3);
    const verdict = (lenRatio > 0.85 && lenRatio < 1.15 && denRatio > 0.85 && denRatio < 1.15) ? 'not-applicable' : 'measurable';
    console.log(`  LOD 判读：远/近 长度比 ${lenRatio}、密度比 ${denRatio} → ${verdict}`);
    console.log('  flowWispLen=' + JSON.stringify(m.wispLen));
    check('③ 得出 LOD 判读（不改默认值，只记录）', verdict === 'not-applicable' || verdict === 'measurable', `lenRatio=${lenRatio} denRatio=${denRatio} verdict=${verdict}`);
    check('无页面错误', errors.length === 0, errors.slice(0, 2).join(' | ') || 'none');
  } catch (e) {
    check('运行', false, e.message);
  } finally {
    await browser.close();
  }
  console.log(out.ok ? 'flow-lod-badnorth DONE' : 'flow-lod-badnorth FAILED');
  process.exit(out.ok ? 0 : 1);
})();
