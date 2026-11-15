// 第 72 轮 · 1015142746372366336（303f）：补第 71 轮遗留缺口 ②「顶团独立尺寸/寿命」。
// 原片复核（sheet-00…02，看的是整个 303 帧）：断口上方那一团在柱身已经散开之后仍然挂着（frame-0150 断口、
//   frame-0170…0190 柱顶化开而顶团边界仍清楚）→ 顶团必须有**自己的寿命**，不能共用柱身的 lifeMin/lifeSpan；
//   它上升也比柱身快，缝才拉得开。第 64 轮只做了 +24% 尺寸，寿命是共用的 → 顶团比柱身早淡。
// 判据（读 smoke.crownStats，不是读代码）：
//   A. 顶团卡 >0，且 crownStats.lifeRatio ≈ 1.45（顶团寿命 / 柱身寿命）；
//   B. crownStats.vyRatio ≈ 1.18（顶团上升速度 / 柱身）；
//   C. 尺寸倍率仍是 CROWN_STYLE.scale=1.24（第 64 轮判据不回归）；
//   D. setCrown(false) → crownCards=0 且 crownStats.crown=0（能关掉）。
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');

const PROBE = `
import * as THREE from 'three';
import { makeRng } from './src/core/noise.js';
const REA = window.rea;

window.__crownLifeProbe = (crownOn) => {
  const smoke = REA.view.smoke;
  if (!window.__frozen) { window.__frozen = 1; REA.view.render = () => {}; }
  smoke.setLobes(true); smoke.setSolidBase(true); smoke.setPasses({ back: true, front: true });
  smoke.setLobeStyle('big'); smoke.setTopBreak(true); smoke.setHaze(false); smoke.setCrown(crownOn);
  smoke.clear(); smoke.random = makeRng(7);
  smoke.sources = [{ x: 0, y: 0, z: 0 }];
  const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  cam.position.set(2.35, 1.05, 5.15); cam.lookAt(1.05, 1.30, 0); cam.updateMatrixWorld();
  for (let i = 0; i < 160; i++) smoke.update(0.05, new THREE.Vector3(1, 0, 0.2), cam);
  return { crownOn: smoke.crownOn, stats: smoke.crownStats, cards: smoke.back.count, crownCount: smoke.crownCount };
};
window.__crownLifeReady = true;
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
  await p.waitForFunction(() => document.querySelector('#scene').contentWindow.__crownLifeReady, {}, { timeout: 30000 });

  const on = await p.evaluate(() => document.querySelector('#scene').contentWindow.__crownLifeProbe(true));
  const off = await p.evaluate(() => document.querySelector('#scene').contentWindow.__crownLifeProbe(false));
  await p.screenshot({ path: out + 'smoke-crown-life-r72.png' });
  await b.close();

  fs.writeFileSync(out + 'smoke-crown-life-r72.json', JSON.stringify({ on, off, errors }, null, 2));
  console.log('on  ' + JSON.stringify(on));
  console.log('off ' + JSON.stringify(off));

  if (errors.length) throw Error(errors.join('\n'));
  const S = on.stats || {};
  // 逐卡倍率（life/l0、vy/v0）不受随机抽样影响 → 直接对 1.45 / 1.18 收紧
  const A = on.crownCount > 0 && Math.abs((S.lifeMulAvg || 0) - 1.45) <= 0.001 && S.lifeCrown > S.lifeShaft;
  const B = Math.abs((S.vyMulAvg || 0) - 1.18) <= 0.001;
  const C = S.style && Math.abs(S.style.scale - 1.24) < 1e-9;
  const D = off.crownCount === 0 && (off.stats?.crown ?? -1) === 0;
  if (!A) throw Error('crown lifetime ratio not 1.45: ' + JSON.stringify(S));
  if (!B) throw Error('crown rise ratio not 1.18: ' + JSON.stringify(S));
  if (!C) throw Error('crown scale changed: ' + JSON.stringify(S.style));
  if (!D) throw Error('setCrown(false) left crown cards: ' + JSON.stringify(off));
  console.log('PASS smoke crown life/rise ' + JSON.stringify({ A, B, C, D, stats: S }));
})().catch((e) => { console.error('FAIL ' + e.message); process.exitCode = 1; });
