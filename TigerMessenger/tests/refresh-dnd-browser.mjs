// R10：清爽主题 + 磁吸拖放 + ＋加入 + 资产雷达 + 能力星图 的浏览器验收（需本地 8931 服务）
import assert from 'node:assert/strict';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = process.env.SHOT_DIR || '';
const b = await chromium.launch(process.env.CHROME ? {executablePath: process.env.CHROME} : {});
const p = await b.newPage({viewport: {width: 1440, height: 960}}), errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:8931/TigerMessenger/pipeline.html#scene');
await p.waitForSelector('.cap-item .cap-add', {state: 'attached', timeout: 40000});
await p.waitForTimeout(2500);
assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), 'light');
assert.ok(await p.evaluate(() => document.getElementById('tm-light-derived')?.textContent.length > 1000), '浅色派生样式已生成');
const count = () => p.evaluate(() => document.querySelectorAll('#pipeline .node, .pipe-region .node').length);
// 1) 真实 HTML5 拖放：从卡片握柄拖进磁吸层
const before = await count();
const card = p.locator('.cap-item[draggable=true]').first(), name = (await card.innerText()).split('\n')[0];
const dt = await p.evaluateHandle(() => new DataTransfer());
await card.dispatchEvent('dragstart', {dataTransfer: dt});
await p.waitForTimeout(400); // 磁吸层在下一帧出现
await p.waitForSelector('#cap-magnet.on', {timeout: 3000});
const magnet = p.locator('#cap-magnet');
await magnet.dispatchEvent('dragenter', {dataTransfer: dt}); await magnet.dispatchEvent('dragover', {dataTransfer: dt});
await magnet.dispatchEvent('drop', {dataTransfer: dt}); await card.dispatchEvent('dragend', {dataTransfer: dt});
await p.waitForSelector('.tm-toast', {timeout: 10000});
const toast1 = await p.locator('.tm-toast').last().innerText();
await p.waitForTimeout(1500);
const afterDrag = await count();
console.log('drag', name, before, '→', afterDrag, '|', toast1);
assert.ok(!(await p.locator('#cap-magnet.on').count()), '放下后磁吸层收起');
// 2) ＋加入按钮
await p.evaluate(() => document.querySelectorAll('.tm-toast').forEach(t => t.remove()));
const add = p.locator('.cap-item .cap-add').nth(1); await add.scrollIntoViewIfNeeded(); await add.click({force: true});
await p.waitForSelector('.tm-toast', {timeout: 10000});
const toast2 = await p.locator('.tm-toast').last().innerText(); await p.waitForTimeout(1500);
console.log('quick-add', await count(), '|', toast2);
assert.ok(afterDrag > before || /加入|已/.test(toast1), '拖放生效');
if (out) await p.screenshot({path: out + 'r10-after-dnd.png'});
// 3) 雷达与星图
await p.click('#open-radar-btn'); await p.waitForSelector('.ar-card', {timeout: 20000});
assert.equal(await p.locator('.ar-card').count(), 30);
await p.locator('.ar-chip', {hasText: '物件系统'}).click(); assert.equal(await p.locator('.ar-card').count(), 4);
await p.locator('.learning-tabs button', {hasText: '能力树'}).click(); await p.waitForSelector('.tc-node', {timeout: 40000});
await p.locator('.tc-node').first().hover(); assert.ok(await p.locator('.tc-svg.tc-hover').count());
// 4) 暗色切换并持久化
await p.click('#theme-toggle'); assert.equal(await p.evaluate(() => localStorage.getItem('tm.theme.v1')), 'dark');
await p.click('#theme-toggle');
assert.deepEqual(errs, []);
console.log('refresh-dnd-browser OK');
await b.close();
