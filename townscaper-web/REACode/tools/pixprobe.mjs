/**
 * pixprobe.mjs — 从抽出来的帧 PNG 里量数字（不靠眼睛估）。
 *
 *   node tools/pixprobe.mjs foam   <png...>
 *   node tools/pixprobe.mjs badge  <png...>
 *   node tools/pixprobe.mjs color  <png...>
 *
 * foam  : 近白像素（L>阀值 且低饱和）的水平游程长度 = 岸线泡沫带厚度
 * badge : 蓝白像素连通块的边长 = 单位等级徽章在屏幕上的像素尺寸
 * color : 量化色簇 top-N，用来算墙/屋顶的 HSV 关系
 *
 * 为什么不用我自己的 python：这个仓库的验证链一直是 local Chrome + canvas，
 * 跟着走就不用为一张 PNG 再引一个依赖。
 */
import { chromium } from '/Users/panglaohu/Downloads/TigerInBamboo/REA-agent/node_modules/playwright-core/index.mjs';

const mode = process.argv[2];
const files = process.argv.slice(3);
// crop 模式的参数：pixprobe.mjs crop x y w h scale out.png <png>
const cropArgs = mode === 'crop' ? files.splice(0, 6) : null;
if (!mode || !files.length) {
  console.error('usage: node tools/pixprobe.mjs <foam|badge|color> <png...>');
  process.exit(1);
}

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox', '--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
// about:blank 读不了 file:// 的图（decode 直接失败），先落到同源宿主页
await page.goto('file:///tmp/vidcap/probe.html');

for (const f of files) {
  const res = await page.evaluate(async ({ mode, src, cropArgs }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const W = c.width, H = c.height;
    const d = ctx.getImageData(0, 0, W, H).data;
    const at = (x, y) => { const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    const lum = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    if (mode === 'foam') {
      // 近白且近灰：泡沫线是白描边，水/岛都是灰
      let n = 0, runs = [], bbox = [W, H, 0, 0];
      for (let y = 0; y < H; y++) {
        let run = 0;
        for (let x = 0; x < W; x++) {
          const [r, g, b] = at(x, y);
          const L = lum(r, g, b);
          const sat = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
          const hit = L > 0.94 && sat < 0.10;
          if (hit) {
            n++; run++;
            bbox[0] = Math.min(bbox[0], x); bbox[2] = Math.max(bbox[2], x);
            bbox[1] = Math.min(bbox[1], y); bbox[3] = Math.max(bbox[3], y);
          } else if (run) { runs.push(run); run = 0; }
        }
        if (run) runs.push(run);
      }
      runs.sort((a, b) => a - b);
      const med = runs.length ? runs[runs.length >> 1] : 0;
      const mean = runs.reduce((a, b) => a + b, 0) / (runs.length || 1);
      return { mode, W, H, whitePx: n, pct: +(100 * n / (W * H)).toFixed(2), runs: runs.length, runMed: med, runMean: +mean.toFixed(2), bbox };
    }

    if (mode === 'badge') {
      // 徽章：亮蓝白（B 明显高于 R，且够亮）。找连通块，报宽高
      const mask = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const [r, g, b] = at(x, y);
        if (b > 120 && b - r > 35 && lum(r, g, b) > 0.42) mask[y * W + x] = 1;
      }
      const seen = new Uint8Array(W * H); const blobs = [];
      for (let i = 0; i < W * H; i++) {
        if (!mask[i] || seen[i]) continue;
        const st = [i]; seen[i] = 1; let minx = W, maxx = 0, miny = H, maxy = 0, cnt = 0;
        while (st.length) {
          const p = st.pop(); const x = p % W, y = (p - x) / W; cnt++;
          if (x < minx) minx = x; if (x > maxx) maxx = x;
          if (y < miny) miny = y; if (y > maxy) maxy = y;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const q = ny * W + nx;
            if (mask[q] && !seen[q]) { seen[q] = 1; st.push(q); }
          }
        }
        if (cnt >= 12) blobs.push({ w: maxx - minx + 1, h: maxy - miny + 1, px: cnt, ar: +((maxx - minx + 1) / (maxy - miny + 1)).toFixed(2) });
      }
      blobs.sort((a, b) => b.px - a.px);
      return { mode, W, H, blobs: blobs.slice(0, 6), count: blobs.length };
    }

    if (mode === 'crop') {
      const [cx, cy, cw, ch, sc] = cropArgs.slice(0, 5).map(Number);
      const cc = document.createElement('canvas');
      cc.width = cw * sc; cc.height = ch * sc;
      const cctx = cc.getContext('2d');
      cctx.imageSmoothingEnabled = false;
      cctx.drawImage(img, cx, cy, cw, ch, 0, 0, cw * sc, ch * sc);
      return { mode, png: cc.toDataURL('image/png') };
    }

    if (mode === 'area') {
      // 建造进度：背景是均匀灰蓝，和角落平均色差 >22 的像素算"已建出来的东西"
      const bg = [0, 0, 0];
      let bn = 0;
      for (const [x, y] of [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3], [W >> 1, 2]]) {
        const [r, g, b] = at(x, y); bg[0] += r; bg[1] += g; bg[2] += b; bn++;
      }
      bg[0] /= bn; bg[1] /= bn; bg[2] /= bn;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        const dr = d[i] - bg[0], dg = d[i + 1] - bg[1], db = d[i + 2] - bg[2];
        if (dr * dr + dg * dg + db * db > 22 * 22 * 3) n++;
      }
      return { mode, W, H, bg: bg.map(v => Math.round(v)), area: n, pct: +(100 * n / (W * H)).toFixed(2) };
    }

    // color：量化到 16 级色簇，报占比
    const hist = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const k = (r >> 4) + ',' + (g >> 4) + ',' + (b >> 4);
      const e = hist.get(k) || [0, 0, 0, 0];
      e[0]++; e[1] += r; e[2] += g; e[3] += b; hist.set(k, e);
    }
    const top = [...hist.entries()].sort((a, b) => b[1][0] - a[1][0]).slice(0, 10).map(([k, e]) => {
      const r = Math.round(e[1] / e[0]), g = Math.round(e[2] / e[0]), b = Math.round(e[3] / e[0]);
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      let h = 0; const dd = mx - mn;
      if (dd) {
        if (mx === r) h = 60 * (((g - b) / dd) % 6);
        else if (mx === g) h = 60 * ((b - r) / dd + 2);
        else h = 60 * ((r - g) / dd + 4);
      }
      if (h < 0) h += 360;
      const v = mx / 255, s = mx ? dd / mx : 0;
      return { rgb: [r, g, b], hex: '#' + [r, g, b].map(v2 => v2.toString(16).padStart(2, '0')).join(''), pct: +(100 * e[0] / (W * H)).toFixed(2), h: Math.round(h), s: +s.toFixed(2), v: +v.toFixed(2) };
    });
    // 再按色相分段统计：屋顶（黄）和墙（红）在 top-N 里常常被背景挤掉，
    // 只有按 hue 段取均值才量得到"墙→屋顶"的色相关系。
    const bands = [[0, 25], [25, 50], [50, 75], [75, 160], [160, 260], [260, 360]].map(([lo, hi]) => {
      let n = 0, r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) {
        const rr = d[i], gg = d[i + 1], bb = d[i + 2];
        const mx = Math.max(rr, gg, bb), mn = Math.min(rr, gg, bb), dd2 = mx - mn;
        if (!dd2 || mx < 60) continue;
        const s2 = dd2 / mx; if (s2 < 0.35) continue;
        let h2 = mx === rr ? 60 * (((gg - bb) / dd2) % 6) : mx === gg ? 60 * ((bb - rr) / dd2 + 2) : 60 * ((rr - gg) / dd2 + 4);
        if (h2 < 0) h2 += 360;
        if (h2 < lo || h2 >= hi) continue;
        n++; r += rr; g += gg; b += bb;
      }
      if (!n) return { band: `${lo}-${hi}`, n: 0 };
      const R = Math.round(r / n), G = Math.round(g / n), B = Math.round(b / n);
      const mx = Math.max(R, G, B), mn = Math.min(R, G, B), dd3 = mx - mn;
      let h3 = mx === R ? 60 * (((G - B) / dd3) % 6) : mx === G ? 60 * ((B - R) / dd3 + 2) : 60 * ((R - G) / dd3 + 4);
      if (h3 < 0) h3 += 360;
      return { band: `${lo}-${hi}`, n, hex: '#' + [R, G, B].map(v2 => v2.toString(16).padStart(2, '0')).join(''), h: Math.round(h3), s: +(dd3 / mx).toFixed(2), v: +(mx / 255).toFixed(2) };
    }).filter(x => x.n > 200);
    return { mode, W, H, top: top.slice(0, 5), bands };
  }, { mode, src: 'file://' + f, cropArgs });
  if (res.png) {
    const fs = await import('node:fs');
    fs.writeFileSync(cropArgs[5], Buffer.from(res.png.split(',')[1], 'base64'));
    console.log('crop ->', cropArgs[5]);
    continue;
  }
  console.log(JSON.stringify({ file: f.split('/').pop(), ...res }));
}
await browser.close();
