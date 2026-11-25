// 793557992931266561 第⑤档 directional AO 的**方向色**验收。
// 原片口径（0003→0004 逐像素，512px）：Δ(R−B) 均值 −5.4、p10 −33 / p90 +19、mean|Δ| 16.3 级 = 11.5% 亮度，
// 暖面（左/前）相对亮度 +16.4%、冷面（顶/右）−18.1%。本测把这套读数搬到本仓的同一对档位上：
//   ① 逐轴顶点账（aoTintAxisReport）：法线朝屏幕左的 −X / +Z 变暖、朝右的 +X / −Z 变冷，第③档两两持平（负对照）；
//   ② 像素账（从截图字节解，第 63 条）：⑤ 与 ③ 的 Δ(R−B) 量级要落在片内量级附近，不能是「几乎重合」。
// 像素口径注意：r235 的截图把页面 #hud（143 个开关面板）与底部进度条一起拍进去了，本测先把它们隐掉再拍。
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const fs = require('node:fs');

function decodePng(buf) {
  let p = 8, w = 0, h = 0, bd = 8, ct = 6; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), d = buf.slice(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; }
    else if (type === 'IDAT') idat.push(d); else if (type === 'IEND') break;
    p += 12 + len;
  }
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : 1, bpp = ch * bd / 8, stride = w * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat)), out = Buffer.alloc(w * h * bpp);
  let o = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[o++], row = raw.slice(o, o + stride); o += stride;
    const cur = out.slice(y * stride, (y + 1) * stride), prev = y ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = row[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += (pa <= pb && pa <= pc) ? a : pb <= pc ? b : c; }
      cur[x] = v & 255;
    }
  }
  return { w, h, ch, data: out };
}
const isBg = (d, p, bg) => Math.abs(d[p] - bg[0]) + Math.abs(d[p + 1] - bg[1]) + Math.abs(d[p + 2] - bg[2]) < 12;
const px = (n) => n;
function luminosityDiff(a, b) {
  let n = 0, sum = 0, warm = 0, cool = 0, big = 0;
  for (let p = 0; p < a.data.length; p += a.ch) {
    const la = 0.299 * a.data[p] + 0.587 * a.data[p + 1] + 0.114 * a.data[p + 2];
    if (la < 70) continue;
    const d = (b.data[p] - b.data[p + 2]) - (a.data[p] - a.data[p + 2]);
    n++; sum += Math.abs(d);
    if (d > 2) warm++; else if (d < -2) cool++;
    if (Math.abs(d) >= 8) big++;
  }
  return { n, meanAbs: +(sum / n).toFixed(2), warmFrac: +(warm / n).toFixed(3), coolFrac: +(cool / n).toFixed(3), bigFrac: +(big / n).toFixed(3) };
}
function diffCount(a, b) {
  let n = 0;
  for (let p = 0; p < a.data.length; p += a.ch) {
    if (Math.abs(a.data[p] - b.data[p]) + Math.abs(a.data[p + 1] - b.data[p + 1]) + Math.abs(a.data[p + 2] - b.data[p + 2]) > 6) n++;
  }
  return n;
}

const STAGES = ['flat', 'up', 'voxel', 'directional'];
(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 1100, height: 820 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  try {
    // 本机静态服务在并发拉 ES module 时偶发 ERR_CONNECTION_RESET（ThreadingHTTPServer 的 backlog=5）→ 失败重载
    let loaded = false;
    for (let i = 0; i < 4 && !loaded; i++) {
      await p.goto('http://127.0.0.1:8769/ao-stages.html?baked=1&grid=quad&stage=flat', { timeout: 60000 });
      for (let k = 0; k < 40 && !loaded; k++) {
        await p.waitForTimeout(500);
        loaded = await p.evaluate(() => { const r = window.aoStageReport && window.aoStageReport(); return !!r && !r.rebuilding; });
      }
    }
    assert.ok(loaded, '页面应在 4 次重载内烘完（worldMesh.builtVersion 追上 world.version）');
    const frame = p.frameLocator('#scene');
    // 原片五帧里只有建筑本体：场景里除主网格与灯以外的子对象隐掉，页面 UI 也隐掉（否则 R−B/高频全被面板污染）
    await p.evaluate(() => {
      const v = window.aoStageReview.view;
      for (const o of v.scene.children) if (!o.isLight && o !== v.mesh) o.visible = false;
      v.scene.background?.setHex?.(0x101418);
      const d = document.querySelector('#scene').contentDocument;
      for (const el of d.body.children) if (el.tagName !== 'CANVAS') el.style.visibility = 'hidden';
      d.querySelectorAll('#hud,#learnpanel,#toast,#helpcard').forEach((e) => { e.style.visibility = 'hidden'; });
    });
    await p.waitForTimeout(800);
    const canvas = frame.locator('canvas').first();
    const box = await canvas.boundingBox();
    const shots = {}, reports = {}, axis = {};
    const settle = async (stage) => {
      for (let k = 0; k < 40; k++) {
        await p.waitForTimeout(500);
        const ok = await p.evaluate((s) => { const r = window.aoStageReport && window.aoStageReport(); return !!r && !r.rebuilding && r.stage === s; }, stage);
        if (ok) return true;
      }
      return false;
    };
    for (const stage of STAGES) {
      await p.selectOption('#stage', stage);
      assert.ok(await settle(stage), `${stage} 档应在 20s 内重建完成`);
      await p.waitForTimeout(600);
      shots[stage] = decodePng(await canvas.screenshot());
      reports[stage] = await p.evaluate(() => window.aoStageReport());
      axis[stage] = await p.evaluate(() => window.aoTintAxisReport());
      fs.writeFileSync(`artifacts/coverage/ao-stages-dir-${stage}-r236.png`, await canvas.screenshot());
    }
    // 裁一块「有左朝向墙 + 右朝向墙」的近景存证（页坐标裁剪，画布在 iframe 里，box 是页坐标）
    const clip = { x: Math.round(box.x + box.width * 0.18), y: Math.round(box.y + box.height * 0.34), width: 460, height: 330 };
    for (const stage of ['voxel', 'directional']) {
      await p.selectOption('#stage', stage);
      await settle(stage);
      await p.waitForTimeout(500);
      fs.writeFileSync(`artifacts/coverage/ao-stages-dir-${stage}-crop-r236.png`, await p.screenshot({ clip }));
    }

    // ① 负对照：第③档（无方向色）逐轴 R−B 两两持平
    const v = axis.voxel, d = axis.directional;
    assert.ok(Math.abs(v.gapPlusMinusX) < 3, `第③档 ±X 冷暖差 ${v.gapPlusMinusX} 应≈0（这是负对照，说明差值是第⑤档带来的）`);
    assert.ok(Math.abs(v.gapPlusMinusZ) < 3, `第③档 ±Z 冷暖差 ${v.gapPlusMinusZ} 应≈0`);

    // ② 第⑤档：法线朝屏幕左的 −X / +Z 变暖、朝右的 +X / −Z 变冷（相机在 +X+Z 侧，见 bake.js FACE_TINT 注释）
    assert.ok(d.gapPlusMinusX > 8, `⑤档 −X 应比 +X 暖（屏幕左暖右冷），实测 ${d.gapPlusMinusX}`);
    assert.ok(d.gapPlusMinusZ < -8, `⑤档 +Z 应比 −Z 暖，实测 ${d.gapPlusMinusZ}`);
    const Rb = (k) => d.axes[k] && d.axes[k].rb, lum = (k) => d.axes[k] && (d.axes[k].r + d.axes[k].g + d.axes[k].b) / 3;
    for (const [warm, cool] of [['-X', '+X'], ['+Z', '-Z']]) {
      const rel = (Rb(warm) - Rb(cool)) / ((lum(warm) + lum(cool)) / 2);
      assert.ok(rel > 0.15, `${warm} 对 ${cool} 的 (R−B) 相对差 ${rel.toFixed(3)} 应 >15%（片内 ±16–18%）`);
    }
    // 顶面（+Y）偏冷：比左向墙更冷
    assert.ok(Rb('+Y') < Rb('+Z') - 4, `+Y 顶面 ${Rb('+Y')} 应比暖墙 +Z ${Rb('+Z')} 冷`);

    // ③ 像素账：⑤ 与 ③ 的 Δ(R−B) 量级贴近片内（11.5% 亮度 / |Δ|≥8 占 72%）
    const tint = luminosityDiff(shots.voxel, shots.directional);
    assert.ok(tint.meanAbs >= 8, `⑤−③ 的 mean|Δ(R−B)| ${tint.meanAbs} 级应 ≥8（片内 16.3 级，本仓 10.7%）`);
    assert.ok(tint.bigFrac >= 0.5, `|Δ(R−B)|≥8 的像素占比 ${tint.bigFrac} 应 ≥0.5（片内 0.72）`);
    assert.ok(tint.warmFrac > 0.06 && tint.coolFrac > 0.03, `冷暖两侧都要有成片像素（暖 ${tint.warmFrac} / 冷 ${tint.coolFrac}）`);

    // ④ 阶梯仍逐级可见；噪声远小于阶梯差
    await p.selectOption('#stage', 'voxel'); await settle('voxel');
    const n1 = decodePng(await canvas.screenshot());
    await p.waitForTimeout(1200);
    const n2 = decodePng(await canvas.screenshot());
    const noise = diffCount(n1, n2);
    const ladder = [];
    for (let i = 1; i < STAGES.length; i++) {
      const n = diffCount(shots[STAGES[i - 1]], shots[STAGES[i]]);
      ladder.push({ from: STAGES[i - 1], to: STAGES[i], px: n });
      assert.ok(n > Math.max(noise, 3000) * 1.2, `${STAGES[i - 1]}→${STAGES[i]} 差分 ${n}px 应明显大于噪声 ${noise}px`);
    }
    // ⑤ 中性夹具复核：原片是灰色单体楼，本仓是彩色小镇（墙色+橙屋顶本身就把冷暖差掩掉）。
    // 把墙色调成哑光灰再拍一对，确认「左暖右冷」是机制带来的，不是调色板的巧合。
    // 注意：左右半屏读数在这两个场景都不成立（voxel 档左右基线就差 17 级：左半屏橙屋顶多、右半屏铺地多），
    // 所以冷暖账一律走逐轴顶点口径，不拿左右半屏当判据（r235 原计划的这条路已量过，不可用）。
    await p.evaluate(() => {
      const w = window.aoStageReview.world;
      w.palette.colors = w.palette.colors.map(() => '#cfcabf');
    });
    // 换调色板不会自己让块缓存失效（缓存键是几何 hash），必须先切一个别的档逼一次重烘，
    // 否则拍到的还是上一张（本轮踩过：gray-voxel 与 voxel 两张截图逐字节相同）。
    await p.selectOption('#stage', 'flat');
    assert.ok(await settle('flat'), '换调色板后要先切档逼一次重烘');
    const grayReport = {};
    for (const stage of ['voxel', 'directional']) {
      await p.selectOption('#stage', stage);
      assert.ok(await settle(stage), `灰夹具 ${stage} 档应重建完成`);
      await p.waitForTimeout(600);
      grayReport[stage] = await p.evaluate(() => window.aoTintAxisReport());
      fs.writeFileSync(`artifacts/coverage/ao-stages-dir-gray-${stage}-r236.png`, await canvas.screenshot());
    }
    assert.ok(Math.abs(grayReport.voxel.gapPlusMinusX) < 3 && Math.abs(grayReport.voxel.gapPlusMinusZ) < 3, '灰夹具第③档也应是负对照（≈0）');
    assert.ok(grayReport.directional.gapPlusMinusX > 8 && grayReport.directional.gapPlusMinusZ < -8,
      `灰夹具第⑤档同样左暖右冷（±X ${grayReport.directional.gapPlusMinusX} / ±Z ${grayReport.directional.gapPlusMinusZ}）`);

    assert.deepEqual(errors, [], '页面不应有 JS 错误');
    console.log(JSON.stringify({ noise, ladder, tint, axisGaps: { voxel: [v.gapPlusMinusX, v.gapPlusMinusZ], directional: [d.gapPlusMinusX, d.gapPlusMinusZ] }, grayGaps: { voxel: [grayReport.voxel.gapPlusMinusX, grayReport.voxel.gapPlusMinusZ], directional: [grayReport.directional.gapPlusMinusX, grayReport.directional.gapPlusMinusZ] }, axisRB: Object.fromEntries(Object.entries(d.axes).map(([k, x]) => [k, x && +x.rb.toFixed(2)])) }, null, 1));
    console.log('PASS ao directional tint: 逐轴左暖右冷 + 片内量级色偏 + 五档阶梯');
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
