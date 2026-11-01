/**
 * video-frames.mjs — pull every distinct frame out of an mp4 without ffmpeg.
 *
 * Why this exists: `video.seek(t)` + `drawImage` looks like it works and does
 * not — every seek drew frame 0, so a 16-second animation "measured" as a
 * single still. Playing the file and hooking requestVideoFrameCallback gives
 * the frames that were actually presented, which is the only thing you can
 * measure timing off.
 *
 * Usage:
 *   cd tools && python3 -m http.server 8801 &
 *   node video-frames.mjs clip.mp4 [maxFrames]
 * Frames + times.txt land in ./<clip>/
 */

import { chromium } from '/Users/panglaohu/Downloads/TigerInBamboo/REA-agent/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';

const file = process.argv[2];
const MAX = Number(process.argv[3] || 90);
// Overridable port: another session may already hold 8801 serving a different
// root (that one 404s on /gifs/...), and killing it would break that session.
const PORT = Number(process.env.VF_PORT || 8801);
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 800, height: 800 } });
await page.goto(`http://127.0.0.1:${PORT}/player.html`, { waitUntil: 'load' });

const meta = await page.evaluate((src) => window.loadSrc(src), '/' + file);
console.log('=== ' + file + ' === ' + meta.w + 'x' + meta.h + '  ' + meta.dur.toFixed(2) + 's');

const dir = '/tmp/vidcap/' + file.replace('.mp4', '');
fs.mkdirSync(dir, { recursive: true });

// start playback; page queues unique frames, node drains them in small batches
await page.evaluate(() => {
  const v = document.getElementById('v');
  window.__q = [];
  window.__done = false;
  let lastSig = null;
  const onFrame = () => {
    const r = window.capture();
    if (r.sig !== lastSig) {
      window.__q.push(r);
      lastSig = r.sig;
    }
    if (v.ended) { window.__done = true; return; }
    v.requestVideoFrameCallback(onFrame);
  };
  v.currentTime = 0;
  v.play().then(() => v.requestVideoFrameCallback(onFrame));
});

let saved = 0;
const t0 = Date.now();
while (Date.now() - t0 < 45000) {
  const batch = await page.evaluate(() => window.__q.splice(0, 4));
  for (const fr of batch) {
    if (saved >= MAX) break;
    fs.writeFileSync(dir + '/f' + String(saved).padStart(3, '0') + '.png', Buffer.from(fr.png.split(',')[1], 'base64'));
    fs.appendFileSync(dir + '/times.txt', fr.t.toFixed(3) + ' ' + fr.sig + '\n');
    saved++;
  }
  const done = await page.evaluate(() => window.__done);
  if (done && batch.length === 0) break;
  if (saved >= MAX) break;
  await new Promise((r) => setTimeout(r, 120));
}
console.log('saved ' + saved + ' unique frames -> ' + dir);
await browser.close();
