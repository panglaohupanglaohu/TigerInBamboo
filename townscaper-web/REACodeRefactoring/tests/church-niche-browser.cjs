// 1275089608758484992 运行时验收：教堂高拱龛（第 117 轮收口）。
// 与 openings-c05c-r56.mjs 的分工：那个管几何/射线（不进页面），这个只管「从页面上真跑一遍」：
//   ① 龛真的跨两层：bottom < 2L、top > 2L+0.3，洞有深度 depth > 0；
//   ② 后墙三处开口自下而上不重叠且都在龛内（双开门+扇窗 / 四格方窗 / 菱形窗，与原片 0120·0160 帧同序）；
//      洞前两级台阶落到码头面 L+.006；
//   ③ 同一机位 A/B：关掉 churchDoors 后，龛的屏幕框内「蓝色后墙像素」必须归零、差分像素远超噪声底；
//   ④ 页面 0 console error，截图存 artifacts/coverage/church-niche-on.png / -off.png。
const { chromium } = require('playwright');
const fs = require('fs');

const W = 1200, H = 900, L = 0.5;

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [], out = {};
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    const url = 'http://127.0.0.1:8769/openings-r56.html?scene=town&grid=quad&seed=7'
      + '&flags=churchDoors&focus=church&clean=1&dist=3.2&pitch=0.22&yawOff=0.12';
    await page.goto(url);
    await page.waitForFunction(() => window.r56?.church?.length > 0, null, { polling: 100 });
    await page.waitForTimeout(600);

    const st = await page.evaluate(() => window.r56);

    // ---- ① 跨两层 + 洞深
    if (!st.church.length) throw new Error('夹具不成立：本场景没有教堂龛');
    for (const n of st.church) {
      if (!(n.bottom < 2 * L && n.top > 2 * L + 0.3)) throw new Error('龛没跨两层：' + JSON.stringify(n));
      if (!(n.depth > 0.05)) throw new Error('洞深不对：' + n.depth);
      if (!(n.top - n.bottom > 0.7)) throw new Error('龛高不够：' + (n.top - n.bottom));
    }

    // ---- ② 后墙三处开口自下而上、互不重叠、都在龛内
    const order = [];
    for (const n of st.church) {
      const b = n.backWall, s = n.steps;
      if (!b || !s) throw new Error('后墙/台阶没有可读布局：' + JSON.stringify(n));
      if (!(Math.abs(b.doorFrom - n.bottom) < 1e-9)) throw new Error('门底没落在龛底：' + b.doorFrom + ' vs ' + n.bottom);
      if (!(b.doorTo < b.squareY - b.squareHalf)) throw new Error('方窗压到门/扇窗上：' + JSON.stringify(b));
      if (!(b.squareY + b.squareHalf < b.diamondY - b.diamondHalf)) throw new Error('菱形窗压到方窗上：' + JSON.stringify(b));
      if (!(b.diamondY + b.diamondHalf <= n.top)) throw new Error('菱形窗顶出龛：' + JSON.stringify(b));
      if (!(b.doorHalf > 0 && b.fanRadius === b.doorHalf)) throw new Error('扇窗半径应等于门半宽：' + JSON.stringify(b));
      if (!(b.doorHalf < n.width / 2)) throw new Error('门比龛还宽：' + JSON.stringify(b));
      if (s.count !== 2) throw new Error('台阶不是两级：' + s.count);
      if (!(Math.abs(s.base - (L + 0.006)) < 1e-9 && s.top === n.bottom && s.rise > 0)) throw new Error('台阶没落到码头面：' + JSON.stringify(s));
      if (!(s.halfWidth > n.width / 2)) throw new Error('台阶没比门洞宽：' + JSON.stringify(s));
      order.push({ cell: n.cell, width: +n.width.toFixed(3), bottom: n.bottom, top: n.top, depth: n.depth,
        doorTo: +b.doorTo.toFixed(3), squareY: +b.squareY.toFixed(3), diamondY: +b.diamondY.toFixed(3),
        steps: s.count, rise: +s.rise.toFixed(4) });
    }
    out.niches = order;

    // ---- ③ 同一机位 A/B
    const proj = await page.evaluate(([w, h]) => {
      const { grid, view } = window.r56world, n = window.r56.church[0], c = grid.cells[n.cell];
      const A = c.pts[n.edge], B = c.pts[(n.edge + 1) % c.n], len = Math.hypot(B.x - A.x, B.z - A.z);
      view.camera.updateMatrixWorld();
      const m = view.camera.matrixWorldInverse.elements, e = view.camera.projectionMatrix.elements;
      const P = (t, y) => {
        const px = A.x + (B.x - A.x) * t, pz = A.z + (B.z - A.z) * t;
        const vx = m[0] * px + m[4] * y + m[8] * pz + m[12], vy = m[1] * px + m[5] * y + m[9] * pz + m[13], vz = m[2] * px + m[6] * y + m[10] * pz + m[14];
        const cx = e[0] * vx + e[8] * vz, cy = e[5] * vy + e[9] * vz, cw = -vz;
        return [(cx / cw * 0.5 + 0.5) * w, (0.5 - cy / cw * 0.5) * h];
      };
      const hw = (n.width / 2 + 0.03) / len;
      const pts = [P(n.edge === n.edge ? 0.5 - hw : 0, n.bottom), P(0.5 + hw, n.bottom), P(0.5 - hw, n.top), P(0.5 + hw, n.top)];
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
    }, [W, H]);
    const box = [Math.round(proj.x0), Math.round(proj.y0), Math.round(proj.x1), Math.round(proj.y1)];
    out.box = box;
    if (!(box[0] > 2 && box[1] > 2 && box[2] < W - 2 && box[3] < H - 2)) throw new Error('龛不在画面内：' + JSON.stringify(box));
    if (!(box[2] - box[0] > 40 && box[3] - box[1] > 60)) throw new Error('龛在屏幕上太小，像素账不成立：' + JSON.stringify(box));

    const grab = async (name) => {
      await page.waitForTimeout(260);
      const buf = await page.screenshot(name ? { path: 'artifacts/coverage/' + name } : {});
      return buf.toString('base64');
    };
    const on1 = await grab('church-niche-on.png');
    const on2 = await grab(null);                       // 噪声底：同一状态两帧
    await page.evaluate(() => {
      const { world, view } = window.r56world;
      world.churchDoors = false; world.touch(); view.worldMesh.invalidate();
    });
    const offShot = await grab('church-niche-off.png');
    await page.evaluate(() => {
      const { world, view } = window.r56world;
      world.churchDoors = true; world.touch(); view.worldMesh.invalidate();
    });

    const diff = await page.evaluate(async ({ a64, b64, c64, box }) => {
      const load = (s) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = 'data:image/png;base64,' + s; });
      const [a, b, c] = await Promise.all([load(a64), load(b64), load(c64)]);
      const cv = document.createElement('canvas'); cv.width = a.width; cv.height = a.height;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      const px = (im) => { ctx.clearRect(0, 0, a.width, a.height); ctx.drawImage(im, 0, 0); return ctx.getImageData(0, 0, a.width, a.height).data; };
      const da = px(a), db = px(b), dc = px(c);
      // 蓝色后墙（#5b86c4 → 线性空间仍远蓝于红）：b 明显大于 r、且 g 明显小于 b（排除青绿水面）
      const isBlue = (d, i) => d[i + 2] > d[i] + 25 && d[i + 2] > 80 && d[i + 1] < d[i + 2] - 20;
      let blueOn = 0, blueOff = 0, noise = 0, changed = 0;
      for (let y = Math.max(0, box[1]); y < Math.min(a.height, box[3]); y++) for (let x = Math.max(0, box[0]); x < Math.min(a.width, box[2]); x++) {
        const i = (y * a.width + x) * 4;
        if (isBlue(da, i)) blueOn++;
        if (isBlue(dc, i)) blueOff++;
        const dn = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
        if (dn > 24) noise++;
        const d = Math.abs(da[i] - dc[i]) + Math.abs(da[i + 1] - dc[i + 1]) + Math.abs(da[i + 2] - dc[i + 2]);
        if (d > 24) changed++;
      }
      return { blueOn, blueOff, noise, changed };
    }, { a64: on1, b64: on2, c64: offShot, box });

    out.pixels = diff;
    if (!(diff.blueOn > 800)) throw new Error('看不到蓝色后墙（像素 ' + diff.blueOn + '）');
    if (!(diff.blueOff < diff.blueOn * 0.08)) throw new Error('关掉 churchDoors 后蓝后墙还在：' + diff.blueOff + '/' + diff.blueOn);
    if (!(diff.changed > Math.max(1200, diff.noise * 6))) throw new Error('开关差分没高出噪声底：' + JSON.stringify(diff));

    if (errors.length) throw new Error('console/page errors: ' + errors.slice(0, 3).join(' | '));
    fs.writeFileSync('artifacts/coverage/church-niche-browser.json', JSON.stringify(out, null, 1));
    console.log('PASS church niche', JSON.stringify({
      niches: out.niches.length, box, blueOn: diff.blueOn, blueOff: diff.blueOff, changed: diff.changed, noise: diff.noise,
      sample: out.niches[0],
    }));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
