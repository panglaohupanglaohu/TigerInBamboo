// 906416813810049025 洞内光照的**像素级 + 几何级**开/关验收。
//
// r239：同一个页面、同一个 WebGL 上下文，用同一个 renderer 把 worldMesh 按**无光照顶点色**渲染
//       （帧里只差 cave-light 乘出来的 col），相机贴洞口内侧沿洞轴看进去。
// r240：发现只按「y 带 + 横向距洞轴」这个柱体判据时，贴洞口的外立面/洞顶上表面被一起压暗
//       （148839 px 全落在那面墙上，ViewImage 实看是一整面墙变暗）。
// r241：补面朝向判据（沿三维法线探 0.12 格，落进隧道空腔才算洞内）。本测试因此分三层：
//   A. 几何级：开/关两次重建的**顶点色差分** → 被动过的顶点必须全在洞体格矩形内、y 在洞高区间内，
//      且法线朝向与所在面一致（地板朝上 / 洞顶朝下 / 侧壁近乎水平）；系数落在 [0.5, 1)。
//   B. 像素级（洞内机位）：开 / 关 / 再开 —— 差分够大、回位 0、近洞口亮而深处暗。
//   C. 外立面回归（r240 那台机位）：射线扫一圈屏幕点，**洞外**的点开/关像素必须逐位相同（0 变化）。
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
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : 1, bpp = ch, stride = w * bpp;
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

const lum = (d, p) => 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
function bgColor(img) {
  const { w, h, ch, data } = img; const pts = [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]];
  const c = [0, 0, 0];
  for (const [x, y] of pts) { const p = (y * w + x) * ch; for (let k = 0; k < 3; k++) c[k] += data[p + k] / 4; }
  return c;
}
const isBg = (d, p, bg) => Math.abs(d[p] - bg[0]) + Math.abs(d[p + 1] - bg[1]) + Math.abs(d[p + 2] - bg[2]) < 14;

function diffCount(a, b, th = 6) {
  let n = 0, sum = 0;
  for (let p = 0; p < a.data.length; p += a.ch) {
    const d = Math.abs(a.data[p] - b.data[p]) + Math.abs(a.data[p + 1] - b.data[p + 1]) + Math.abs(a.data[p + 2] - b.data[p + 2]);
    if (d > th) { n++; sum += d / 3; }
  }
  return { n, pct: +((100 * n) / (a.w * a.h)).toFixed(1), mean: n ? +(sum / n).toFixed(2) : 0 };
}
const pxDiff = (a, b, x, y) => {
  const p = (y * a.w + x) * a.ch;
  return Math.abs(a.data[p] - b.data[p]) + Math.abs(a.data[p + 1] - b.data[p + 1]) + Math.abs(a.data[p + 2] - b.data[p + 2]);
};

// 画面中间三分之一再分三带（下→上 = 近→远，相机沿洞轴水平看）
function bands(img) {
  const { w, h, ch, data } = img, bg = bgColor(img);
  const out = [];
  for (let k = 0; k < 3; k++) {
    const y0 = Math.floor((h * (k + 2)) / 6), y1 = Math.floor((h * (k + 3)) / 6);
    let n = 0, s = 0;
    for (let y = y0; y < y1; y++) for (let x = 0; x < w; x++) {
      const p = (y * w + x) * ch;
      if (isBg(data, p, bg)) continue;
      const L = lum(data, p);
      if (L < 6) continue;
      n++; s += L;
    }
    out.push(n ? +(s / n).toFixed(2) : null);
  }
  return out;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const report = { steps: [] };
  const check = (name, ok, detail) => { report.steps.push({ name, ok, detail }); if (!ok) throw new Error('FAIL ' + name + ' :: ' + detail); };

  try {
    await page.goto('http://127.0.0.1:8769/index.html?scene=badnorth&bncaves=3&cavelight=1', { timeout: 120000 });
    await page.waitForFunction(() => !!window.rea?.world?.caveLight, null, { timeout: 120000 });

    await page.evaluate(() => {
      const v = rea.view, orig = v.render.bind(v);
      v.render = () => orig(0);       // 冻时间轴（r131 做法）
      v.__frozen = true;
      document.getElementById('hud').style.display = 'none';
      v.setDebug('vegetation', false);
      v.setDebug('birds', false);
    });
    await page.waitForTimeout(300);

    // —— A. 几何级：开/关两次重建，比顶点色 ——
    const geo = await page.evaluate(async () => {
      const PV = await import('/src/light/cave-light.js');
      const plan = rea.world.caveLight;
      const T = await import('three');
      const v = rea.view, r = v.renderer;
      r.setSize(640, 480, false);
      const scene = new T.Scene();
      const mesh = new T.Mesh(v.mesh.geometry, new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide, fog: false }));
      scene.add(mesh);
      const cam = new T.PerspectiveCamera(60, 640 / 480, 0.02, 400);
      window.__probe = { scene, mesh, cam, r, T, PV };
      window.__plan = plan;

      const rebuild = (on) => {
        rea.world.caveLight = on ? plan : null;
        rea.view.worldMesh.caveShadeVerts = 0;
        rea.view.worldMesh.invalidate();     // 缓存按几何 hash，不显式失效不会重烘
        rea.view.render(0);
      };
      const grab = () => {
        const g = rea.view.mesh.geometry;
        return { pos: Array.from(g.getAttribute('position').array), col: Array.from(g.getAttribute('color').array), nor: Array.from(g.getAttribute('normal').array) };
      };
      rebuild(true);  const A = grab();
      rebuild(false); const B = grab();
      rebuild(true);  const A2 = grab();
      if (rea.view.mesh.geometry !== mesh.geometry) mesh.geometry = rea.view.mesh.geometry;

      const L = 0.5;
      const changed = [];
      for (let i = 0; i < A.col.length; i += 3) {
        if (Math.abs(A.col[i] - B.col[i]) > 1e-6) changed.push({ i, f: A.col[i] / (B.col[i] || 1) });
      }
      const bad = [];
      let fMin = 9, fMax = 0, horiz = 0, floorUp = 0, ceilDown = 0, maxGap = 0, gapVerts = 0;
      // 到洞体格矩形的水平间隙（地形平滑会把洞壁顶点推出原格最多 ~0.1，故按间隙分级判）
      const rectGap = (x, z, rr) => Math.hypot(Math.max(rr.minX - x, 0, x - rr.maxX), Math.max(rr.minZ - z, 0, z - rr.maxZ));
      for (const c of changed) {
        const i = c.i;
        const x = A.pos[i], y = A.pos[i + 1], z = A.pos[i + 2];
        const nx = A.nor[i], ny = A.nor[i + 1], nz = A.nor[i + 2];
        fMin = Math.min(fMin, c.f); fMax = Math.max(fMax, c.f);
        // 必须落在某条隧道的格矩形内（或间隙 ≤ 0.12 的平滑位移容差内）、且 y 在洞高区间（容差 0.02）
        let hit = null, gap = 9;
        for (const t of plan.tunnels) {
          const lo = t.floor * L - 0.02, hi = (t.floor + 2) * L + 0.02;
          if (!(y > lo && y < hi)) continue;
          for (const rr of t.rects) gap = Math.min(gap, rectGap(x, z, rr));
          if (gap <= 0.12) hit = { t, lo, hi, gap };
        }
        if (!hit) { bad.push({ why: 'outOfTunnel', p: [+x.toFixed(2), +y.toFixed(2), +z.toFixed(2)], gap: +gap.toFixed(3), f: +c.f.toFixed(3) }); continue; }
        if (hit.gap > 0) { gapVerts++; maxGap = Math.max(maxGap, hit.gap); }
        // 法线朝向：地板（贴洞底、朝上）/ 洞顶（贴洞顶、朝下）/ 侧壁（近乎水平）
        const hlen = Math.hypot(nx, nz);
        const atFloor = Math.abs(y - hit.t.floor * L) < 0.02;
        const atCeil = Math.abs(y - (hit.t.floor + 2) * L) < 0.02;
        if (atFloor && ny > 0.5) floorUp++;
        else if (atCeil && ny < -0.5) ceilDown++;
        else if (hlen > 0.5) horiz++;
        else bad.push({ why: 'faceMismatch', p: [+x.toFixed(2), +y.toFixed(2), +z.toFixed(2)], n: [+nx.toFixed(2), +ny.toFixed(2), +nz.toFixed(2)] });
      }
      // 幂等：再开一次，颜色逐位一致
      let idem = 0;
      for (let i = 0; i < A.col.length; i++) if (A.col[i] !== A2.col[i]) idem++;
      return {
        tunnels: plan.tunnels.map((t) => ({ len: +t.len.toFixed(3), floor: t.floor, mouths: t.mouthCount, hw: +t.halfWidth.toFixed(3) })),
        verts: A.col.length / 3, changed: changed.length, bad: bad.slice(0, 8), badN: bad.length,
        faceKinds: { floorUp, ceilDown, wall: horiz }, fMin: +fMin.toFixed(3), fMax: +fMax.toFixed(3),
        gapVerts, maxGap: +maxGap.toFixed(3),
        idemMismatch: idem,
        shadedVerts: rea.view.worldMesh.caveShadeVerts, rejected: rea.caveLight().faceRejected,
        report: rea.caveLight().report,
      };
    });
    report.geo = geo;

    // —— B/C. 像素级：两个机位 ——
    const shoot = (on, mode) => page.evaluate(([on, mode]) => {
      const { scene, mesh, cam, r, T, PV } = window.__probe;
      const P = window.__plan;
      rea.world.caveLight = on ? P : null;
      rea.view.worldMesh.caveShadeVerts = 0;
      rea.view.worldMesh.invalidate();
      rea.view.render(0);
      if (rea.view.mesh.geometry !== mesh.geometry) mesh.geometry = rea.view.mesh.geometry;
      const t = P.tunnels.slice().sort((a, b) => b.len - a.len)[0], poly = t.poly, n = poly.length;
      const at = (s) => {
        for (let i = 1; i < n; i++) {
          if (t.cum[i] >= s || i === n - 1) {
            const seg = Math.max(1e-6, t.cum[i] - t.cum[i - 1]), u = Math.max(0, Math.min(1, (s - t.cum[i - 1]) / seg));
            return [poly[i - 1].x + (poly[i].x - poly[i - 1].x) * u, poly[i - 1].z + (poly[i].z - poly[i - 1].z) * u];
          }
        }
        return [poly[0].x, poly[0].z];
      };
      const y = (t.floor + 0.52) * 0.5;
      // inside：站在洞身里（s=len·0.35）往深处看；outside：r240 原机位（洞口外 0.10）
      const from = mode === 'inside' ? at(t.len * 0.35) : at(0.04);
      const to = at(mode === 'inside' ? t.len - 0.02 : t.len - 0.02);
      const dx = to[0] - from[0], dz = to[1] - from[1], d = Math.hypot(dx, dz) || 1;
      const back = mode === 'inside' ? 0 : 0.10;
      cam.position.set(from[0] - (dx / d) * back, y, from[1] - (dz / d) * back);
      cam.lookAt(to[0], y, to[1]);
      cam.updateMatrixWorld();
      r.render(scene, cam);
      const url = r.domElement.toDataURL('image/png');
      // 射线扫一圈屏幕点，分类「落在洞里 / 洞外」（给 C 层外立面回归用）
      const rc = new T.Raycaster(); rc.near = 0.01; rc.far = 30;
      const probeMesh = new T.Mesh(mesh.geometry, new T.MeshBasicMaterial({ side: T.DoubleSide }));
      probeMesh.updateMatrixWorld();
      // 像素色是**三角形三个顶点色插值**出来的，所以按「命中三角形有几个顶点在洞内」分类，
      // 不能只按命中点判（跨洞口的三角形：命中点在洞外，但另一头顶点被压暗 → 像素也会变）。
      const gp = mesh.geometry.getAttribute('position').array, L2 = 0.5;
      const rectGap = (x, z, rr) => Math.hypot(Math.max(rr.minX - x, 0, x - rr.maxX), Math.max(rr.minZ - z, 0, z - rr.maxZ));
      const vertIn = (i) => {
        const x = gp[i], y = gp[i + 1], z = gp[i + 2];
        for (const t of P.tunnels) {
          if (!(y > t.floor * L2 - 0.02 && y < (t.floor + 2) * L2 + 0.02)) continue;
          for (const rr of t.rects) if (rectGap(x, z, rr) <= 0.12) return true;
        }
        return false;
      };
      const rays = [];
      for (let gy = 0; gy < 6; gy++) for (let gx = 0; gx < 8; gx++) {
        const sx = Math.round((gx + 0.5) * 640 / 8), sy = Math.round((gy + 0.5) * 480 / 6);
        rc.setFromCamera({ x: (sx / 640) * 2 - 1, y: -((sy / 480) * 2 - 1) }, cam);
        const hit = rc.intersectObject(probeMesh, false)[0];
        if (!hit) continue;
        const f = hit.face;
        const vIn = [f.a, f.b, f.c].filter((v) => vertIn(v * 3)).length;
        rays.push({ sx, sy, d: +hit.distance.toFixed(2), vIn, vAllIn: vIn === 3, vNoneIn: vIn === 0,
          y: +hit.point.y.toFixed(2), p: [+hit.point.x.toFixed(2), +hit.point.z.toFixed(2)] });
      }
      return { url, shaded: rea.view.worldMesh.caveShadeVerts ?? 0, rejected: rea.view.worldMesh.caveShadeStats?.rejected ?? 0, rays,
        cam: cam.position.toArray().map((x) => +x.toFixed(3)), tgt: [+to[0].toFixed(3), +y.toFixed(3), +to[1].toFixed(3)] };
    }, [on, mode]);

    const save = (name, shot) => {
      const f = `artifacts/coverage/${name}.png`;
      fs.writeFileSync(f, Buffer.from(shot.url.split(',')[1], 'base64'));
      return decodePng(fs.readFileSync(f));
    };

    const inA = await shoot(true, 'inside'), inB = await shoot(false, 'inside'), inA2 = await shoot(true, 'inside');
    const imgInA = save('cave-light-inside-on', inA), imgInB = save('cave-light-inside-off', inB), imgInA2 = save('cave-light-inside-on2', inA2);
    const outA = await shoot(true, 'outside'), outB = await shoot(false, 'outside');
    const imgOutA = save('cave-light-outside-on', outA), imgOutB = save('cave-light-outside-off', outB);

    const dIn = diffCount(imgInA, imgInB), dIn2 = diffCount(imgInA, imgInA2), dOut = diffCount(imgOutA, imgOutB);
    const bandInA = bands(imgInA), bandInB = bands(imgInB);

    // C 层：外立面回归 —— 射线判为「洞外」的屏幕点，开/关像素必须逐位相同
    const outsidePts = outB.rays.filter((x) => x.vNoneIn);   // 三角形三顶点全在洞外
    const insidePts = outB.rays.filter((x) => x.vAllIn);     // 三顶点全在洞内
    const outChanged = outsidePts.filter((x) => pxDiff(imgOutA, imgOutB, x.sx, x.sy) > 0);
    const inChanged = insidePts.filter((x) => pxDiff(imgOutA, imgOutB, x.sx, x.sy) > 0);

    report.readings = {
      shadedVerts: { insideOn: inA.shaded, insideOff: inB.shaded, insideOn2: inA2.shaded, outsideOn: outA.shaded },
      faceRejected: { insideOn: inA.rejected, outsideOn: outA.rejected },
      cam: { inside: inA.cam, outside: outA.cam }, tgt: inA.tgt,
      diffInside: dIn, diffInsideRecovery: dIn2, diffOutside: dOut,
      bandsInsideOn: bandInA, bandsInsideOff: bandInB,
      outsideRays: { total: outB.rays.length, allIn: insidePts.length, noneIn: outsidePts.length, partial: outB.rays.filter((x) => x.vIn > 0 && x.vIn < 3).length, outsideChanged: outChanged.length, insideChanged: inChanged.length },
      r240OutsideBaseline: 148839,
    };

    // A 层断言（几何级）
    check('洞体计划在（多条隧道，都是穿山拱）', geo.tunnels.length >= 1 && geo.tunnels.every((t) => t.mouths >= 1), JSON.stringify(geo.tunnels));
    check('开档真的压暗了顶点', geo.changed > 0 && geo.shadedVerts > 0, `changed=${geo.changed} shadedVerts=${geo.shadedVerts}`);
    check('面朝向判据挡掉了顶点（不是没算）', geo.rejected > 0, `faceRejected=${geo.rejected}`);
    check('被压暗的顶点全在洞体格内、且法线朝向与所在面一致', geo.badN === 0, JSON.stringify(geo.bad));
    check('洞内地面与侧壁都被覆盖（两族都有）', geo.faceKinds.floorUp > 0 && geo.faceKinds.wall > 0, JSON.stringify(geo.faceKinds));
    check('洞口系数=1、洞身最暗=1−strength（渐变两端）',
      geo.report.ts.every((t) => t.atMouth > 0.995 && Math.abs(t.atMid - 0.54) < 0.02), JSON.stringify(geo.report.ts.map((t) => [t.atMouth, t.atMid])));
    check('系数落在 [0.5, 1)（一档多，不是全黑）', geo.fMin >= 0.5 && geo.fMax < 1, `f∈[${geo.fMin}, ${geo.fMax}]`);
    check('再开一次颜色逐位一致（重建幂等）', geo.idemMismatch === 0, `mismatch=${geo.idemMismatch}`);

    // B 层断言（像素级 · 洞内机位）
    check('洞内机位开档压暗、关档不压暗', inA.shaded > 0 && inB.shaded === 0, `${inA.shaded} / ${inB.shaded}`);
    check('洞内机位开/关差分够大', dIn.n > 5000, `diffPx=${dIn.n}（${dIn.pct}%）mean|Δ|=${dIn.mean}`);
    check('洞内机位开→关→开回位无噪声', dIn2.n < 200, `diffPx=${dIn2.n}`);
    check('差分均值 5–45 级（一档多，不是全黑）', dIn.mean > 5 && dIn.mean < 45, `mean|Δ|=${dIn.mean}`);

    // C 层断言（外立面回归 —— r240 的缺陷）
    check('洞口外机位射线覆盖到洞内与洞外两类点', outsidePts.length >= 1 && insidePts.length >= 3, `outside=${outsidePts.length} inside=${insidePts.length}`);
    check('洞外表面像素开/关逐位不变（外立面不再被压暗）', outChanged.length === 0, `changed=${outChanged.length}/${outsidePts.length} ${JSON.stringify(outChanged.slice(0, 4))}`);
    check('洞内表面像素确实变了（对照）', inChanged.length >= Math.min(2, insidePts.length), `changed=${inChanged.length}/${insidePts.length}`);
    // 注：r240 把这台机位的 148839px 差分读成「整面外墙被压暗」，其实是**洞身内壁**（本层射线 17/19 落在洞内）。
    // 真正的外立面回归由上面两条承担：三顶点全在洞外的屏幕点逐位不变 + 被压暗顶点全在洞体内（A 层）。

    report.errors = errors;
    assert.deepEqual(errors, []);
    fs.writeFileSync('artifacts/coverage/cave-light-pixel-browser.json', JSON.stringify(report, null, 1));
    console.log(JSON.stringify({ geo: { changed: geo.changed, badN: geo.badN, faceKinds: geo.faceKinds, f: [geo.fMin, geo.fMax] }, px: report.readings }, null, 1));
    console.log('PASS', report.steps.length);
  } catch (e) {
    report.errors = errors;
    fs.writeFileSync('artifacts/coverage/cave-light-pixel-browser.json', JSON.stringify(report, null, 1));
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
