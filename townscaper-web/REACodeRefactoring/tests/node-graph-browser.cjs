// 1724449858369568780 的运行时验收：点 Toggle 后，节点链把 UI 从下面送到上面。
// 判据来自真实 DOM 位置、Inspector 上的实时数值、以及画布/截图。
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader'],
  });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    await page.goto('http://127.0.0.1:8769/node-graph.html');
    await page.waitForFunction(() => window.nodeGraph?.ready, null, { polling: 50 });
    await page.waitForTimeout(250);

    const start = await page.evaluate(() => ({ pos: window.nodeGraph.position(), y: window.nodeGraph.boxY(), insp: window.nodeGraph.inspector() }));
    const snap = { start, errors };
    const fail = (msg) => { throw new Error(msg + ' :: ' + JSON.stringify(snap)); };

    // 1. 初始状态：位置在下面（-226.9），sink 还没被触发过
    if (Math.abs(start.pos.y - (-226.9)) > 2) fail('初始 y 应该是 -226.9 附近，实际 ' + start.pos.y);
    if (start.pos.x !== -5) fail('X 必须固定 -5');
    if (start.insp.condition !== false) fail('初始 bool 应为 false');
    if (!(start.y > 300)) fail('方块初始应在场景下方：' + start.y);

    // 2. 点按钮：bool 翻真、select 立刻切到 -33.8，但位置还没到（lerp 在中间）
    const afterClick = await page.evaluate(() => { const on = window.nodeGraph.toggle(); return { on, insp: window.nodeGraph.inspector(), pos: window.nodeGraph.position() }; });
    snap.afterClick = afterClick;
    if (afterClick.on !== true) fail('toggle 之后 bool 应为 true');
    if (Math.abs(afterClick.insp.select - (-33.8)) > 1e-6) fail('select 必须立刻输出 -33.8，实际 ' + afterClick.insp.select);
    if (!(afterClick.pos.y >= -226.9 && afterClick.pos.y < -220)) fail('lerp 还没走几步，位置应仍在 -226 附近：' + afterClick.pos.y);

    // 3. 动画自己会走：等 1.2s，位置必须明显上移，但还没到位
    await page.waitForTimeout(1200);
    const mid = await page.evaluate(() => ({ pos: window.nodeGraph.position(), y: window.nodeGraph.boxY(), insp: window.nodeGraph.inspector() }));
    snap.mid = mid;
    if (!(mid.pos.y > afterClick.pos.y + 8)) fail('1.2 秒后必须已经往上走了一段：' + JSON.stringify({ before: afterClick.pos.y, after: mid.pos.y }));
    if (!(mid.y < start.y - 6)) fail('方块的 DOM 位置必须真的上移：' + JSON.stringify({ start: start.y, mid: mid.y }));
    if (mid.insp.settled) fail('1.2 秒还到不了目标');

    // 4. 立刻到位：位置正好 -33.8、方块上移约 193px、sink 收到过新值
    const done = await page.evaluate(() => ({ pos: window.nodeGraph.settle(), y: window.nodeGraph.boxY(), insp: window.nodeGraph.inspector() }));
    snap.done = done;
    if (Math.abs(done.pos.y - (-33.8)) > 1e-6) fail('到位后必须正好 -33.8，实际 ' + done.pos.y);
    if (Math.abs(done.pos.x - (-5)) > 1e-6) fail('X 全程必须固定 -5');
    if (!(start.y - done.y > 150)) fail('方块在屏幕上必须上移 150px 以上：' + (start.y - done.y));
    if (!(done.insp.calls >= 2)) fail('sink 至少被调用两次（初始 + 移动）');
    if (!done.insp.settled) fail('到位后 settled 应为 true');

    // 5. Inspector 上的数值必须与运行时的值一致（不能是写死的文案）
    const shown = await page.evaluate(() => document.querySelector('#nodes').innerText);
    if (!shown.includes('-33.80') && !shown.includes('-33.8')) fail('Inspector 没显示 select 输出 -33.8：' + shown.slice(0, 200));
    if (!/FloatSelectNode/.test(shown) || !/FloatLerpTowardsNode/.test(shown) || !/Vector2ComposeNode/.test(shown) || !/Vector2EventNode/.test(shown)) {
      fail('Inspector 缺节点：' + shown.slice(0, 200));
    }
    if (!/RectTransform\.anchoredPosition/.test(shown)) fail('Inspector 缺 UnityEvent 目标');

    // 6. 再按一次回下面，位置原路返回
    const back = await page.evaluate(() => { window.nodeGraph.toggle(); return window.nodeGraph.settle ? null : null; });
    await page.evaluate(() => window.nodeGraph.set(false));
    const backPos = await page.evaluate(() => { window.nodeGraph.tick(100); return { pos: window.nodeGraph.position(), y: window.nodeGraph.boxY() }; });
    snap.back = backPos;
    if (Math.abs(backPos.pos.y - (-226.9)) > 1e-6) fail('回下面后 y 必须回到 -226.9，实际 ' + backPos.pos.y);
    if (!(backPos.y > 300)) fail('方块必须回到场景下方：' + backPos.y);

    // 7. 速度语义：speed 20 → 从 226.9 到 33.8 需要 9.655s；6s 只能走 120
    const timed = await page.evaluate(() => {
      window.nodeGraph.set(false); window.nodeGraph.tick(100);
      window.nodeGraph.set(true);
      window.nodeGraph.tick(6);
      return window.nodeGraph.position();
    });
    snap.timed = timed;
    if (Math.abs(timed.y - (-226.9 + 120)) > 1e-6) fail('6 秒 × speed 20 应该正好走 120：' + timed.y);

    await page.evaluate(() => window.nodeGraph.settle());
    await page.waitForTimeout(120);
    await page.locator('#scene').screenshot({ path: 'artifacts/coverage/node-graph-scene.png' });
    await page.screenshot({ path: 'artifacts/coverage/node-graph-page.png', fullPage: true });

    if (errors.length) fail('控制台有错误：' + errors.join(' | '));
    console.log('node-graph-browser PASS · 上移 ' + (start.y - done.y).toFixed(1) + 'px · sink 回调 ' + done.insp.calls + ' 次 · 6s 位移 ' + (timed.y + 226.9).toFixed(1));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
