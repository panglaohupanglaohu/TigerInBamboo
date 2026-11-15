import { chromium } from '/Users/panglaohu/Downloads/TigerInBamboo/tools/shot/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const root = '/Users/panglaohu/Downloads/TigerInBamboo/CartonBook';
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:8787/chapters/bookshop-letter/book.html', { waitUntil: 'networkidle' });
  const count = await page.locator('.book-section').count();
  for (let i = 0; i < count; i++) {
    await page.locator(`[data-go="${i}"]`).click();
    await page.locator('.book-section:not([hidden]) img').evaluateAll(async imgs => { await Promise.all(imgs.map(img => img.decode())); });
    await page.screenshot({ path: `${root}/artifacts/bookshop-review/page-${i}.png`, fullPage: true });
  }
  const state = await page.evaluate(() => ({
    images: [...document.images].map(i => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0 })),
    pages: document.querySelectorAll('.book-section').length,
    coverLeaves: document.querySelectorAll('.cover-leaf').length,
    story: document.querySelector('.chapter-story')?.innerText,
    prevButtons: document.querySelectorAll('[data-go="prev"]').length,
    nextButtons: document.querySelectorAll('[data-go="next"]').length,
  }));
  const manifest = JSON.parse(fs.readFileSync(`${root}/chapters/bookshop-letter/manifest.json`, 'utf8'));
  const entries = manifest.shots || [];
  const report = { ...state, errors, realCapture: manifest.realCapture, visualReview: manifest.visualReview, entries: entries.length };
  fs.writeFileSync(`${root}/artifacts/bookshop-review/browser-qa.json`, JSON.stringify(report, null, 2));
  const uniqueImages = new Set(state.images.map(i => i.src));
  if (errors.length || !manifest.realCapture || manifest.visualReview?.status !== 'approved' || state.images.some(i => !i.ok || !i.src.startsWith('shots/')) || count !== 5 || state.coverLeaves !== 2 || uniqueImages.size !== 24 || state.prevButtons !== 1 || state.nextButtons !== 1) {
    throw new Error(`Book QA failed: ${JSON.stringify({ errors, count, uniqueImages: uniqueImages.size, visualReview: manifest.visualReview })}`);
  }
  console.log('PASS: 双页封面 + 4 个内跨页，24 张独立实拍全部加载，图片路径正确，导航无重复，无 JS 错误，视觉验收已签署。');
} finally {
  await browser.close();
}
