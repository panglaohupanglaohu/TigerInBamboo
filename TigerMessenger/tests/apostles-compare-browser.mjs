// R32 端到端：十二门徒三套方案并排对照（工坊「场景管线」页，十二门徒地形面板下方）。
//   新隔离上下文 → pipeline.html#scene → 选十二门徒 → 对照区三张卡（认可现状 / 软坡 / 软坡 + 库地形色）都在，标出「实景当前」= 认可现状；
//   有 R29 截图清单（artifacts/apostles-look-views-e2e/latest.json）时，每张卡 4 个机位的图都要真的加载出来（naturalWidth > 0）；
//   点「软坡」卡的「切到这套看实景」→ 游戏重载、实景外观 = soft、软坡卡变成当前 → 再点「认可现状」切回。全程不写 tm.apostles.look.v1（不改默认）。
//   截图 artifacts/apostles-compare-e2e/run-*/：1-compare.png（对照区）、2-switched-soft.png、3-back-approved.png。
// 运行：先跑 tests/apostles-look-views-browser.mjs 生成截图清单，再 cd TigerMessenger && $NODE tests/apostles-compare-browser.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { launch, BASE, waitApostlesStable, expect } from './lib/apostles-e2e.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../artifacts/apostles-compare-e2e/run-' + Date.now()); fs.mkdirSync(out, { recursive: true });
const manifestFile = path.resolve(here, '../artifacts/apostles-look-views-e2e/latest.json'), hasManifest = fs.existsSync(manifestFile);
const report = { out, manifest: hasManifest ? manifestFile : null, steps: {}, errors: [], pass: false };
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1200 } }), page = await ctx.newPage();
page.on('pageerror', (e) => report.errors.push('pageerror: ' + e.message));
const C = '#apostles-compare';
const state = () => page.evaluate((C) => ({ cards: [...document.querySelectorAll(C + ' .apt-card')].map((c) => ({ scheme: c.dataset.scheme, current: c.classList.contains('current'), shots: [...c.querySelectorAll('figure')].map((f) => ({ view: f.dataset.view, img: !!f.querySelector('img'), loaded: (f.querySelector('img')?.naturalWidth || 0) > 0, missing: f.classList.contains('missing') })), surface: c.querySelector('.apt-surface')?.textContent || '' })), pending: document.querySelector(C + ' .apt-pending')?.textContent || '', note: document.querySelector(C + ' .apt-note')?.textContent || '', live: document.querySelector('.apt-side p[data-look]')?.dataset.look || null, storage: localStorage.getItem('tm.apostles.look.v1') }), C);
async function switchTo(scheme, look) {
  await page.locator(`${C} .apt-card[data-scheme="${scheme}"] button[data-switch]`).click();
  await page.waitForFunction((look) => document.querySelector('.apt-side p[data-look]')?.dataset.look === look, look, { timeout: 900000 });
  const w = await waitApostlesStable(page, { need: 3 }); await page.waitForTimeout(1200);
  return { stable: { ok: w.ok, look: w.sample?.look, count: w.sample?.count }, ...(await state()) };
}
try {
  await page.goto(BASE + 'pipeline.html#scene');
  await page.waitForFunction(() => document.querySelector('#connection')?.textContent.includes('游戏已连接'), {}, { timeout: 300000 });
  await page.waitForFunction(() => [...document.querySelectorAll('#scene option')].some((o) => o.value === 'apostles'), {}, { timeout: 90000 });
  await page.locator('#scene').selectOption('apostles');
  await page.waitForFunction((C) => document.querySelector(C + ' .apt-card') && document.querySelector('.apt-side p[data-look]'), C, { timeout: 360000 });
  await page.waitForTimeout(2500);   // 等截图加载
  const s0 = await state(); report.steps.initial = s0;
  await page.locator(C).scrollIntoViewIfNeeded(); await page.locator(C).screenshot({ path: path.join(out, '1-compare.png') });
  expect(s0.cards.map((c) => c.scheme).join() === 'approved,soft,soft+palette', '三张卡不对：' + s0.cards.map((c) => c.scheme));
  expect(s0.live === 'soft' && s0.cards.filter((c) => c.current).map((c) => c.scheme).join() === 'soft', '实景当前应标默认 soft（2026-11-25 定案启用）：' + JSON.stringify(s0.cards.map((c) => [c.scheme, c.current])));
  expect(/十二门徒采用哪套/.test(s0.pending), '对照区没有写待决定事项');
  if (hasManifest) for (const c of s0.cards) { const withImg = c.shots.filter((x) => x.img); expect(withImg.every((x) => x.loaded), c.scheme + ' 有截图没加载出来'); report.steps.loadedShots = (report.steps.loadedShots || 0) + withImg.length; }
  else report.steps.note = '没有 R29 截图清单：卡片应显示「未拍」，只验证切换（先跑 apostles-look-views-browser.mjs）';
  const soft = await switchTo('soft', 'soft'); report.steps.soft = soft;
  await page.locator(C).scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(out, '2-switched-soft.png') });
  expect(soft.stable.ok && soft.stable.look === 'soft', '切换后游戏里的外观不是 soft：' + JSON.stringify(soft.stable));
  expect(soft.cards.find((c) => c.scheme === 'soft').current, '软坡卡没有标成当前'); expect(!soft.storage, '切换写了 tm.apostles.look.v1');
  const back = await switchTo('approved', 'approved'); report.steps.back = back;
  await page.screenshot({ path: path.join(out, '3-back-approved.png') });
  expect(back.stable.ok && back.stable.look === 'approved' && !back.storage, '没切回认可现状或写了默认');
  report.pass = !report.errors.length; if (!report.pass) throw Error(report.errors.join(' | '));
} catch (e) { report.failure = e.message; try { await page.screenshot({ path: path.join(out, 'zz-failure.png') }); } catch {} }
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ pass: report.pass, failure: report.failure || null, out }, null, 1));
await browser.close(); process.exit(report.pass ? 0 : 1);
