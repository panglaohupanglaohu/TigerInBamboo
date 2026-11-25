/**
 * flat-terraces-browser.cjs —— 807256278154301441（344 帧 / 16.618fps / 20.70s）
 * "Looking at cheap swarm pathfinding. These dots could possibly be crabs …"
 *
 * 片内真实形制（4 张联系表 344/344 帧 + frame-0030/0300 的 4× 裁切逐层数）：
 *   · 五层砖塔的**每一层顶面都是平台**：同一个暖橙面、无脊线、无两面明暗差；
 *   · 临空边一圈**矮护墙**（高约 0.06 格）+ 一道浅色压顶，护墙下**白色腰线**外挑；
 *   · 平台上直接坐烟囱，整片没有一处坡顶 / 山墙面。
 * （原文的"成群紫点"是树冠，r200 已撤销「群体寻路」这个前提。）
 *
 * 本轮给 `src/build/buildings.js` 加 `world.flatRoofs` 平顶平台档（默认关）。本测在真主场景的
 * 多层塔夹具（`?multitile=3&mth=6`）上量：关档无 flatTerraces 账、开档出平台/护墙/烟囱、
 * 开关像素差落在塔身、同状态噪声 0、关回去几何逐顶点相同、`?flatroof=1` 真的写进 world。
 */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('fs');
const zlib = require('zlib');

function decodePng(buf) {
  let pos = 8, w = 0, h = 0, colorType = 6;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); colorType = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let q = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[q++];
    const line = raw.slice(q, q + stride); q += stride;
    const prev = y ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    const cur = out.slice(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, bb = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a; else if (f === 2) v += bb; else if (f === 3) v += (a + bb) >> 1;
      else if (f === 4) { const pp = a + bb - c, pa = Math.abs(pp - a), pb = Math.abs(pp - bb), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? bb : c); }
      cur[i] = v & 255;
    }
  }
  return { w, h, bpp, data: out };
}
function imgDiff(A, B) {
  let n = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let px = 0; px < A.w * A.h; px++) {
    const i = px * A.bpp, j = px * B.bpp;
    if (Math.abs(A.data[i] - B.data[j]) + Math.abs(A.data[i + 1] - B.data[j + 1]) + Math.abs(A.data[i + 2] - B.data[j + 2]) <= 6) continue;
    n++;
    const x = px % A.w, y = Math.floor(px / A.w);
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { n, bbox: n ? [x0, y0, x1, y1] : null };
}

const BASE = 'http://localhost:8769';

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [];
  const out = {};
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 820 } });
    page.setDefaultTimeout(180000);
    page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR', e.message); });
    page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.log('CONSOLE', m.text()); } });
    await page.goto(`${BASE}/index.html?scene=town&grid=mixed&multitile=3&mth=6`);
    await page.waitForFunction(() => window.rea?.multitile && window.rea.view.worldMesh.build && window.rea.view.worldMesh.build.roofStats, null, { timeout: 180000 });
    await page.waitForTimeout(400);

    // 机位：对准塔身，隐藏悬浮面板（只影响截图，不改页面行为）
    await page.evaluate(() => {
      const { view, world } = window.rea;
      for (const el of document.body.children) if (el.tagName === 'DIV' && getComputedStyle(el).position === 'fixed') el.style.display = 'none';
      const cells = world.cells.filter((c) => world.top(c) >= 2);
      const cx = cells.reduce((s, c) => s + c.cx, 0) / cells.length, cz = cells.reduce((s, c) => s + c.cz, 0) / cells.length;
      const top = Math.max(...cells.map((c) => world.top(c)));
      view.target.set(cx, top * 0.5 * 0.5, cz); view.distance = 11.5; view.pitch = 0.62; view.yaw = 0.72; view.updateCamera();
      view.waterUniforms.uTime.value = 7.5;
      view.worldMesh.invalidate(); view.render(0); view.render(0);
    });

    const read = () => page.evaluate(() => {
      const { view } = window.rea; view.render(0);
      const b = view.worldMesh.build, rs = b.roofStats || {};
      return {
        flatRoofs: !!window.rea.world.flatRoofs,
        flatRegions: rs.flatRegions ?? 0, flatCells: rs.flatCells ?? 0,
        flatRimSegments: rs.flatRimSegments ?? 0, flatRimLength: +(rs.flatRimLength ?? 0).toFixed(3),
        flatDeckArea: +(rs.flatDeckArea ?? 0).toFixed(4), flatChimneys: rs.flatChimneys ?? 0,
        terraces: (rs.flatTerraces ?? []).slice(0, 4), hMax: Math.max(0, ...(rs.flatTerraces ?? []).map((t) => t.maxY - t.base)),
        verts: view.worldMesh.geometry.attributes.position.count,
        roofEls: (rs.hipAudit ?? []).length,
        multTower: window.rea.multitile?.cells?.length ?? window.rea.multitile?.voxels ?? 0,
      };
    });

    // ---- ① 关档（默认）：无平台账 ----
    const off = await read();
    out.off = off;
    console.log('OFF', JSON.stringify(off));
    assert.equal(off.flatRoofs, false, '默认档 world.flatRoofs 未设');
    assert.equal(off.flatRegions, 0, '默认档不出平台账');
    assert.equal(off.terraces.length, 0);

    await page.screenshot({ path: 'artifacts/coverage/flat-terraces-off.png' });
    const shotOff = decodePng(fs.readFileSync('artifacts/coverage/flat-terraces-off.png'));

    // ---- ② 开档：平台 + 护墙 + 烟囱 ----
    await page.evaluate(() => { const { world, view } = window.rea; world.flatRoofs = true; view.worldMesh.invalidate(); view.render(0); view.render(0); });
    const on = await read();
    out.on = on;
    console.log('ON', JSON.stringify(on));
    assert.ok(on.flatRegions >= 3, `塔上至少 3 个平台区（实际 ${on.flatRegions}）`);
    assert.ok(on.flatCells >= 8, `平台格数 ≥8（实际 ${on.flatCells}）`);
    assert.ok(on.flatRimSegments >= 8, `护墙段 ≥8（实际 ${on.flatRimSegments}）`);
    assert.ok(on.flatChimneys >= 1, `平台上至少 1 座烟囱（实际 ${on.flatChimneys}）`);
    for (const t of on.terraces) {
      assert.equal(t.gables, 0, '平台档不出山墙');
      assert.ok(Math.abs(t.minY - t.base) < 1e-9, '平台板就在 h·L 上');
      assert.ok(Math.abs(t.deckArea / (t.rimLength || 1)) > 0.004, '平台面积与护墙长度同量级');
    }
    assert.ok(on.hMax <= 0.34, `平台区最高点不超 base+0.34（实际 ${on.hMax.toFixed(3)}）`);
    assert.ok(on.verts > off.verts, `开档多出护墙/腰线几何（${off.verts} → ${on.verts}）`);
    await page.screenshot({ path: 'artifacts/coverage/flat-terraces-on.png' });
    const shotOn = decodePng(fs.readFileSync('artifacts/coverage/flat-terraces-on.png'));

    // ---- ③ 像素 A/B + 同状态噪声（显式 render(0)，不推进 rAF） ----
    const ab = await page.evaluate(() => {
      const { view } = window.rea;
      const r = view.renderer, gl = r.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
      const grab = () => { const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
      const diff = (x, y) => { let n = 0; for (let i = 0; i < x.length; i += 4) if (Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]) > 12) n++; return n; };
      const posHash = (a) => { let h = 0; for (let i = 0; i < a.length; i++) h = (h * 31 + Math.round(a[i] * 1e5)) % 2147483647; return h; };
      view.worldMesh.invalidate(); view.render(0); view.render(0);
      const a1 = grab(); view.render(0); view.render(0); const a2 = grab();
      const onPos = view.worldMesh.geometry.attributes.position.array;
      const onHash = posHash(onPos), onVerts = onPos.length / 3;
      window.rea.world.flatRoofs = false; view.worldMesh.invalidate(); view.render(0); view.render(0);
      const b = grab();
      const offPos = view.worldMesh.geometry.attributes.position.array;
      const offHash = posHash(offPos), offVerts = offPos.length / 3;
      window.rea.world.flatRoofs = true; view.worldMesh.invalidate(); view.render(0); view.render(0);
      const backPos = view.worldMesh.geometry.attributes.position.array;
      const backHash = posHash(backPos), backVerts = backPos.length / 3;
      return { W, H, noise: diff(a1, a2), onVsOff: diff(a1, b), onHash, offHash, backHash, onVerts, offVerts, backVerts };
    });
    out.ab = ab;
    console.log('AB', JSON.stringify(ab));
    assert.equal(ab.noise, 0, `同状态噪声 0（实际 ${ab.noise}）`);
    assert.ok(ab.onVsOff > 400, `开/关像素差分够大（实际 ${ab.onVsOff} px / ${ab.W}×${ab.H}）`);
    assert.equal(ab.backHash, ab.onHash, `开→关→开 几何逐顶点相同（${ab.onHash} vs ${ab.backHash}）`);
    assert.equal(ab.backVerts, ab.onVerts);
    assert.notEqual(ab.offHash, ab.onHash, '关档几何与开档不同');
    assert.notEqual(ab.offVerts, ab.onVerts);

    // 截图差（从 PNG 字节解，不信 readPixels 单通道）
    const png = imgDiff(shotOn, shotOff);
    out.png = png;
    assert.ok(png.n > 300, `截图差分够大（实际 ${png.n} px）`);

    // ---- ④ URL 档 `?flatroof=1` 真的读进 world ----
    await page.goto(`${BASE}/index.html?scene=town&grid=mixed&multitile=3&mth=6&flatroof=1`);
    await page.waitForFunction(() => window.rea?.multitile && window.rea.view.worldMesh.build?.roofStats, null, { timeout: 180000 });
    await page.waitForTimeout(500);
    const url = await read();
    out.url = url;
    console.log('URL', JSON.stringify(url));
    assert.equal(url.flatRoofs, true, '?flatroof=1 写进 world.flatRoofs');
    assert.ok(url.flatRegions >= 3, `URL 档也出平台（实际 ${url.flatRegions}）`);

    assert.equal(errors.length, 0, `0 pageerror / 0 console error（${errors.join(' | ')}）`);
    fs.writeFileSync('artifacts/coverage/flat-terraces-browser.json', JSON.stringify({ out, errors }, null, 2));
    console.log('PASS flat terraces browser', JSON.stringify({
      off: { regions: off.flatRegions, verts: off.verts },
      on: { regions: on.flatRegions, cells: on.flatCells, rim: on.flatRimSegments, chimneys: on.flatChimneys, hMax: +on.hMax.toFixed(3), verts: on.verts },
      ab: out.ab, png,
    }));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
