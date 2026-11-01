/**
 * measure.mjs — 把推文的文字说明"对"到动画上，用数字验证。
 *
 * 每段片子都在页面里播放一遍，抓下每一帧的 96x96 灰度，然后：
 *   1. 帧间差随 lag 的曲线 —— 如果动画整体在循环，曲线会在"周期"处出现极小值
 *   2. 固定像素区域的时间序列做 FFI，找主频 —— 水面的呼吸频率
 *
 * 用法：
 *   cd tools && python3 -m http.server 8801 &
 *   node measure.mjs clip.mp4 [clip2.mp4 ...]
 * 片子放到 tools/ 下（或改 load 的路径）。
 */

/**
 * 把文字说明"对"到动画上：逐帧量化，用数据验证推文里的说法。
 *
 * 对每段片子：
 *   1. 播放并用 requestVideoFrameCallback 抓下每一帧（降采样成 96x96 灰度）
 *   2. 用帧间相似度曲线找时间周期性 —— 即"循环"的周期
 *   3. 用固定像素的时间序列做自相关，看水面/岸线是否在某个频率上重复
 *
 * 输出：帧数、fps、最佳循环周期（秒）、相似度曲线的局部极小值。
 */
import { chromium } from '/Users/panglaohu/Downloads/TigerInBamboo/REA-agent/node_modules/playwright-core/index.mjs';

const files = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 700, height: 700 } });
await page.goto('http://127.0.0.1:8801/measure.html', { waitUntil: 'load' });

for (const f of files) {
  const meta = await page.evaluate((src) => window.load(src), '/' + f);
  const out = await page.evaluate(() => window.run());
  console.log('\n=== ' + f + '  ' + meta.w + 'x' + meta.h + '  ' + meta.dur.toFixed(2) + 's');
  console.log(JSON.stringify(out, null, 1));
}
await browser.close();
