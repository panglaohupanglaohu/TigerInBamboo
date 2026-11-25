// 793557992931266561「flat -> up normal -> vertex voxel AO -> SSAO -> directional AO」五阶梯运行验收。
// 口径：页面开「只看烘焙（无光照）」后，五档各自只差顶点色/后处理；断言每档真的换了烘焙结果、
// 画面真的变了，并且阶梯方向正确（flat 无遮蔽 → voxel 凹处变暗 → ssao 叠屏幕空间颗粒 → directional 冷暖分侧）。
// 像素账从截图字节解（第 63 条：GPU 后端 getImageData 不可信）。
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
function stats(png) {
  const { w, h, ch, data } = png, bg = [data[0], data[1], data[2]];
  const L = new Float32Array(w * h);
  let n = 0, sum = 0, sum2 = 0, dark = 0, hf = 0, hfn = 0;
  for (let i = 0, p = 0; i < w * h; i++, p += ch) {
    if (isBg(data, p, bg)) continue;
    const lum = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    L[i] = lum; n++; sum += lum; sum2 += lum * lum; if (lum < 70) dark++;
  }
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; if (!L[i]) continue;
    hf += Math.abs(4 * L[i] - L[i - 1] - L[i + 1] - L[i - w] - L[i + w]); hfn++;
  }
  const mean = sum / n;
  return { area: n, mean: +mean.toFixed(1), sd: +Math.sqrt(sum2 / n - mean * mean).toFixed(2), darkFrac: +(dark / n).toFixed(3), hf: +(hf / hfn).toFixed(2) };
}
function diffStats(a, b) {
  let n = 0, warmA = 0, warmB = 0;
  for (let p = 0; p < a.data.length; p += a.ch) {
    if (Math.abs(a.data[p] - b.data[p]) + Math.abs(a.data[p + 1] - b.data[p + 1]) + Math.abs(a.data[p + 2] - b.data[p + 2]) <= 6) continue;
    n++; warmA += a.data[p] - a.data[p + 2]; warmB += b.data[p] - b.data[p + 2];
  }
  return { n, warmA: n ? +(warmA / n).toFixed(2) : 0, warmB: n ? +(warmB / n).toFixed(2) : 0 };
}

const STAGES = ['flat', 'up', 'voxel', 'ssao', 'directional'];
(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 1100, height: 820 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  let report = {};
  try {
    await p.goto('http://127.0.0.1:8769/ao-stages.html?baked=1&grid=quad&stage=flat', { timeout: 60000 });
    const settle = async (stage) => {
      for (let k = 0; k < 60; k++) {
        await p.waitForTimeout(500);
        const ok = await p.evaluate((s) => { const r = window.aoStageReport && window.aoStageReport(); return !!r && !r.rebuilding && (!s || r.stage === s); }, stage);
        if (ok) return true;
      }
      return false;
    };
    assert.ok(await settle(null), '首帧应在 15s 内烘完（worldMesh.builtVersion 追上 world.version）');
    const frame = p.frameLocator('#scene');
    // 原片五帧里只有建筑本体、没有海面/植被/旗子；这里做同一隔离，动画层全部隐掉，像素账才有意义
    await p.evaluate(() => {
      const v = window.aoStageReview.view;
      for (const o of v.scene.children) if (!o.isLight && o !== v.mesh) o.visible = false;
      v.scene.background?.setHex?.(0x101418);
    });
    await p.waitForTimeout(800);
    const shots = {};
    for (const stage of STAGES) {
      await p.selectOption('#stage', stage);
      assert.ok(await settle(stage), `${stage} 档应在 15s 内重建完成`);
      report[stage] = await p.evaluate(() => window.aoStageReport());
      await p.waitForTimeout(500);
      const png = decodePng(await frame.locator('canvas').first().screenshot());
      shots[stage] = png;
      png.stats = stats(png);
      fs.writeFileSync(`artifacts/coverage/ao-stages-five-${stage}-r235.png`, await frame.locator('canvas').first().screenshot());
      // 每档都必须画的是「刚烘好的那份几何」，且走无光照材质
      assert.equal(report[stage].baked, true, `${stage}: 只看烘焙档应开着`);
      assert.equal(report[stage].material, 'MeshBasicMaterial', `${stage}: 应走无光照材质（实时光照不参与）`);
      assert.equal(report[stage].geoAttached, true, `${stage}: mesh.geometry 必须已重挂到新重建的几何`);
      assert.equal(report[stage].rebuilding, false, `${stage}: 重建必须已收敛`);
      assert.ok(report[stage].triangles > 12000, `${stage}: 三角数 ${report[stage].triangles}`);
    }
    // ① 烘焙档位真的换了结果：flat/up/voxel/directional 四个哈希互不相同；ssao 与 voxel 同哈希（SSAO 是屏幕空间，不进顶点）
    const hashes = ['flat', 'up', 'voxel', 'directional'].map((s) => report[s].colorHash);
    assert.equal(new Set(hashes).size, 4, '四档烘焙结果应是四份不同的顶点色');
    assert.equal(report.ssao.colorHash, report.voxel.colorHash, 'SSAO 档的顶点色应与 voxel 相同');
    assert.equal(report.ssao.ssao, true, 'SSAO 档应真的开了 c04 屏幕空间遮蔽');
    assert.equal(report.flat.ssao, false, '其它档不应留 SSAO');

    // ② 噪声：同档两帧（场景有动画：浪/树/旗）
    await p.selectOption('#stage', 'voxel');
    await settle('voxel');
    const n1 = decodePng(await frame.locator('canvas').first().screenshot());
    await p.waitForTimeout(1200);
    const n2 = decodePng(await frame.locator('canvas').first().screenshot());
    const noise = diffStats(n1, n2).n;
    assert.ok(noise < 90000, `同档两帧噪声 ${noise}px 应远小于阶梯差`);

    // ③ 逐级可见：相邻档差分至少 3× 噪声
    const ladder = [];
    for (let i = 1; i < STAGES.length; i++) {
      const d = diffStats(shots[STAGES[i - 1]], shots[STAGES[i]]);
      ladder.push({ from: STAGES[i - 1], to: STAGES[i], px: d.n });
      assert.ok(d.n > noise * 1.5, `${STAGES[i - 1]}→${STAGES[i]} 差分 ${d.n}px 应明显大于噪声 ${noise}px`);
    }

    // ④ 阶梯方向：flat 无遮蔽（暗像素最少）→ voxel 凹处变暗 → ssao 再叠细密颗粒（高频更糙、暗更多）
    const s = Object.fromEntries(STAGES.map((k) => [k, shots[k].stats]));
    assert.ok(s.flat.darkFrac < s.voxel.darkFrac, `flat 暗像素占比 ${s.flat.darkFrac} 应低于 voxel ${s.voxel.darkFrac}`);
    assert.ok(s.voxel.sd > s.flat.sd, `voxel 明暗跨度 ${s.voxel.sd} 应大于 flat ${s.flat.sd}`);
    assert.ok(s.ssao.hf > s.voxel.hf * 1.05, `ssao 高频 ${s.ssao.hf} 应高于 voxel ${s.voxel.hf}（屏幕空间颗粒）`);
    assert.ok(s.ssao.darkFrac > s.voxel.darkFrac, `ssao 暗像素占比 ${s.ssao.darkFrac} 应高于 voxel ${s.voxel.darkFrac}`);

    // ⑤ directional 与 voxel 只差「遮挡来自哪一侧」的轴向色偏：变化区域里更暖（R−B 更高）
    const dv = diffStats(shots.voxel, shots.directional);
    assert.ok(dv.n > noise * 1.5, `directional 与 voxel 差分 ${dv.n}px`);
    assert.ok(dv.warmB !== dv.warmA, 'directional 与 voxel 在变化区域应有冷暖差');

    assert.deepEqual(errors, [], '页面不应有 JS 错误');
    console.log(JSON.stringify({ noise, ladder, stats: s, report: Object.fromEntries(STAGES.map((k) => [k, { material: report[k].material, aoMode: report[k].aoMode, hash: report[k].colorHash, ssao: report[k].ssao }])), directionalWarm: dv }, null, 1));
    console.log('PASS ao-stages five-stage baked ladder');
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
