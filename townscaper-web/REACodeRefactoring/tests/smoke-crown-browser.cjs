// 1015142746372366336 第 64 轮：断口上方那一组要和柱身不同。
// 原片（frame-0030 / 0200 2.5× 放大）：脱开的那一团更圆、边界更清楚、尺寸比柱身略大、颜色更暗；
// 第 63 轮只做到「位置脱开」，外观仍与柱身一样。本轮加 aCrown（每卡标记）+ 三处着色差异：
//   尺寸 ×1.24 / soft 压到 0.015（边界清楚）/ uCore +0.20（散得更晚）/ 前遍颜色 ×0.80（更暗）。
// 判据（不靠肉眼）：① 顶团卡数 >0，且这些卡的实例缩放比非顶团大 20%±6；
//                  ② 顶团的世界 y 均值显著高于非顶团（它就是最上面那一组）；
//                  ③ 关掉 setCrown → 一张顶团卡都没有（回到第 63 轮口径）。
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');

const PROBE = `
import * as THREE from 'three';
import { makeRng } from './src/core/noise.js';
const REA = window.rea;

window.__crownProbe = (crownOn) => {
  const smoke = REA.view.smoke;
  if (!window.__frozen) { window.__frozen = 1; REA.view.render = () => {}; }
  smoke.setLobes(true); smoke.setSolidBase(true); smoke.setPasses({ back: true, front: true });
  smoke.setLobeStyle('big'); smoke.setTopBreak(true); smoke.setHaze(false); smoke.setCrown(crownOn);
  smoke.clear(); smoke.random = makeRng(7);
  smoke.sources = [{ x: 0, y: 0, z: 0 }];
  const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  cam.position.set(2.35, 1.05, 5.15); cam.lookAt(1.05, 1.30, 0); cam.updateMatrixWorld();
  for (let i = 0; i < 140; i++) smoke.update(0.05, new THREE.Vector3(1, 0, 0.2), cam);

  const mm = new THREE.Matrix4(), v = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const wpos = new THREE.Vector3();
  const crown = [], other = [];
  const n = smoke.back.count;
  for (let i = 0; i < n; i++) {
    mm.fromArray(smoke.back.instanceMatrix.array, i * 16);
    mm.decompose(wpos, q, sc);
    const rec = { i, s: +sc.x.toFixed(4), x: +wpos.x.toFixed(3), y: +wpos.y.toFixed(3), z: +wpos.z.toFixed(3) };
    (smoke.aCrown.getX(i) > 0.5 ? crown : other).push(rec);
  }
  const mean = (a, k) => (a.length ? a.reduce((s, o) => s + o[k], 0) / a.length : 0);
  return {
    crownOn: smoke.crownOn, cards: n, crownCards: crown.length, otherCards: other.length,
    crownCount: smoke.crownCount,
    sizeCrown: +mean(crown, 's').toFixed(4), sizeOther: +mean(other, 's').toFixed(4),
    ratio: +(mean(other, 's') ? mean(crown, 's') / mean(other, 's') : 0).toFixed(3),
    yCrown: +mean(crown, 'y').toFixed(3), yOther: +mean(other, 'y').toFixed(3),
    crownAbove: crown.length && other.length ? crown.filter((c) => c.y > Math.max(...other.map((o) => o.y))).length : 0,
    // 第 72 轮：顶团有了自己的寿命（×1.45），同一面色号在「开/关顶团」两次跑里的归一化年龄就不同
    // （开的那次更年轻）→ 逐卡尺寸比要按各自 aAge 折算，不能直接拿两个数相除。
    ages: Array.from({ length: n }, (_, i) => +smoke.aAge.getX(i).toFixed(4)),
    // 第 72 轮：顶团寿命变长后两次跑的死亡时刻不同 → 跨跑配对失效；改为在同一次跑里按公式回算，
    // 需要每卡的 seed（尺寸离散度）与口径表里的 spreadMin/spreadSpan。
    seeds: Array.from({ length: n }, (_, i) => +smoke.aSeed.getX(i).toFixed(4)),
    spreadMin: smoke.style?.spreadMin, spreadSpan: smoke.style?.spreadSpan,
    baseMin: smoke.style?.baseMin, baseAge: smoke.style?.baseAge, lifeMul: 1.45,
    sizes: Array.from({ length: n }, (_, i) => +new THREE.Matrix4().fromArray(smoke.back.instanceMatrix.array, i * 16).getMaxScaleOnAxis().toFixed(4)),
    flags: Array.from({ length: n }, (_, i) => (smoke.aCrown.getX(i) > 0.5 ? 1 : 0)),
  };
};
window.__crownReady = true;
`;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  const out = path.resolve(__dirname, '../artifacts/coverage') + path.sep;
  await p.goto((process.env.REA_TEST_URL || 'http://localhost:8769') + '/smoke.html');
  await p.waitForFunction(() => window.smokeReview?.ready && document.querySelector('#scene').contentWindow.rea?.view?.smoke?.p.length > 10, {}, { timeout: 90000 });
  await p.evaluate((code) => {
    const doc = document.querySelector('#scene').contentDocument;
    const s = doc.createElement('script'); s.type = 'module'; s.textContent = code;
    doc.head.appendChild(s);
  }, PROBE);
  await p.waitForFunction(() => document.querySelector('#scene').contentWindow.__crownReady, {}, { timeout: 30000 });

  const on = await p.evaluate(() => document.querySelector('#scene').contentWindow.__crownProbe(true));
  const off = await p.evaluate(() => document.querySelector('#scene').contentWindow.__crownProbe(false));
  await p.evaluate(() => { const w = document.querySelector('#scene').contentWindow; w.rea.view.render = w.rea.view.$render0 || w.rea.view.render; });
  await p.screenshot({ path: out + 'smoke-crown-r64.png' });
  await b.close();

  fs.writeFileSync(out + 'smoke-crown-r64.json', JSON.stringify({ on, off, errors }, null, 2));
  // 同种子跑两遍：粒子集合完全一致（crown 标记不影响发射）→ 逐实例缩放的比值就是那个 ×1.24
  // 第 72 轮：顶团寿命 ×1.45 后，两次跑的粒子集合在时间上不再对齐（开的那次死得晚），
  // 跨跑按下标配对会配错卡（实测 serial 也对不上，因为 serial 计数器跨 probe 累加）。
  // 改成在同一次跑里按公式回算每卡的期望尺寸：
  //   size = (baseMin + age×baseAge) × (spreadMin + seed×spreadSpan) × (crown?1.24:1)
  const sizeOf = (r, i, crown) => (r.baseMin + r.ages[i] * r.baseAge) * (r.spreadMin + r.seeds[i] * r.spreadSpan) * (crown ? 1.24 : 1);
  const per = on.sizes.map((v, i) => +(v / sizeOf(on, i, on.flags[i] > 0.5)).toFixed(3));
  const expect = per.map(() => 1);
  const onSummary = { ...on, sizes: undefined, flags: undefined }, offSummary = { ...off, sizes: undefined, flags: undefined };
  console.log('crown on  ' + JSON.stringify(onSummary));
  console.log('crown off ' + JSON.stringify(offSummary));
  console.log('per-crown size ratio ' + JSON.stringify(per));

  if (errors.length) throw Error(errors.join('\n'));
  if (!(on.crownCards >= 2)) throw Error('no crown cards: ' + on.crownCards);
  if (!(per.length >= 2)) throw Error('no crown cards to compare');
  if (per.some((r) => Math.abs(r - 1) > 0.005)) throw Error('per-card size does not match formula (crown ×1.24): ' + JSON.stringify({ per, sizes: on.sizes, ages: on.ages, seeds: on.seeds }));
  if (!(on.yCrown > on.yOther)) throw Error('crown is not the top group: ' + JSON.stringify({ yCrown: on.yCrown, yOther: on.yOther }));
  if (!(on.crownCards < on.otherCards)) throw Error('crown should be a minority of the column: ' + JSON.stringify({ c: on.crownCards, o: on.otherCards }));
  if (off.crownCards !== 0 || off.crownCount !== 0) throw Error('setCrown(false) left crown flags: ' + JSON.stringify(off));
  // 公式回算里非顶团卡要按 ×1 算 —— 上面 per 已逐卡覆盖（含非顶团），这里只补一条方向性检查：
  if (!(on.sizeCrown > on.sizeOther)) throw Error('crown cards not larger on average: ' + JSON.stringify({ c: on.sizeCrown, o: on.sizeOther }));
  console.log('PASS smoke crown (aCrown / size / top-group) ' + JSON.stringify({ crownCards: on.crownCards, ratio: on.ratio, yCrown: on.yCrown, yOther: on.yOther }));
})().catch((e) => { console.error('FAIL ' + e.message); process.exitCode = 1; });
