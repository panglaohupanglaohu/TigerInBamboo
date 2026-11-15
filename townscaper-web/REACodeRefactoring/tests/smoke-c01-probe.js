// 第 56 批 C01 · 1015142746372366336 浏览器探针（tools/shot.py --eval 用，页面 smoke.html）：
// 同机位离屏渲染烟，按 alpha 掩码沿主轴分箱数轮廓凸起（= 瓣数，口径同 smoke-lobes-browser.cjs），
// 再数沿主轴的「断开」（中间某段箱子完全没有烟）与薄雾卡数；shape 关 / 开 各一次。
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 150 && !window.smokeReview?.ready; i++) await sleep(200);
  const win = document.querySelector('#scene').contentWindow, REA = win.rea;
  const THREE = await win.eval("import('three')");
  const { installSmokeShape } = await win.eval("import('./src/life/smoke-c01.js')");
  const view = REA.view, smoke = view.smoke, renderer = view.renderer, shape = installSmokeShape(smoke);
  const probe = (opts) => {
    shape.set(opts); shape.clock = 0; smoke.clear(); smoke.random = (() => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
    smoke.sources = [{ x: 0, y: 0, z: 0 }];
    const wind = new THREE.Vector3(1, 0, 0.2), cam = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    cam.position.set(2.35, 1.05, 5.15); cam.lookAt(1.05, 1.30, 0); cam.updateMatrixWorld();
    for (let i = 0; i < 120; i++) smoke.update(0.05, wind, cam);
    const W = 360, H = 360, scene = new THREE.Scene(), parent = smoke.group.parent; scene.add(smoke.group);
    const rt = new THREE.WebGLRenderTarget(W, H), prevRT = renderer.getRenderTarget(), pc = new THREE.Color(), pa = renderer.getClearAlpha(); renderer.getClearColor(pc);
    renderer.setRenderTarget(rt); renderer.setClearColor(0xffffff, 1); renderer.clear(); renderer.render(scene, cam);
    const buf = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
    renderer.setRenderTarget(prevRT); renderer.setClearColor(pc, pa); parent.add(smoke.group); rt.dispose();
    // 实心烟 = 明显变暗（亮度 < 150）；薄雾 = 轻微变暗（150–245）
    const pts = []; let faint = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const l = buf[(y * W + x) * 4]; if (l < 150) pts.push([x, y]); else if (l < 245) faint++; }
    let cx = 0, cy = 0; for (const [x, y] of pts) { cx += x; cy += y; } cx /= pts.length || 1; cy /= pts.length || 1;
    let sxx = 0, syy = 0, sxy = 0; for (const [x, y] of pts) { const dx = x - cx, dy = y - cy; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), ax = Math.cos(th), ay = Math.sin(th), BINS = 48;
    const HI = new Float64Array(BINS).fill(-1e9), LO = new Float64Array(BINS).fill(1e9), CNT = new Int32Array(BINS);
    const ts = pts.map(([x, y]) => (x - cx) * ax + (y - cy) * ay), ss = pts.map(([x, y]) => -(x - cx) * ay + (y - cy) * ax);
    let t0 = Infinity, t1 = -Infinity; for (const t of ts) { t0 = Math.min(t0, t); t1 = Math.max(t1, t); }
    for (let i = 0; i < pts.length; i++) { const bi = Math.min(BINS - 1, Math.max(0, Math.floor((ts[i] - t0) / Math.max(1, t1 - t0) * BINS))); HI[bi] = Math.max(HI[bi], ss[i]); LO[bi] = Math.min(LO[bi], ss[i]); CNT[bi]++; }
    const peaks = (arr, sg) => { let n = 0; for (let i = 2; i < BINS - 2; i++) { const v = sg * arr[i], w = [i - 2, i - 1, i, i + 1, i + 2].map((k) => sg * arr[k]); if (CNT[i] && v >= Math.max(...w) && v - Math.min(...w) >= 4 && v > sg * arr[i - 1] && v >= sg * arr[i + 1]) n++; } return n; };
    let gaps = 0; for (let i = 1; i < BINS - 1; i++) if (CNT[i] < 3 && CNT.slice(0, i).some((c) => c > 20) && CNT.slice(i + 1).some((c) => c > 20)) gaps++;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.style.cssText = `position:fixed;top:120px;left:${opts.bigLobes ? 380 : 10}px;z-index:9999;border:1px solid #888;background:#fff`;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const si = (y * W + x) * 4, di = ((H - 1 - y) * W + x) * 4; for (let k = 0; k < 3; k++) img.data[di + k] = buf[si + k]; img.data[di + 3] = 255; }
    ctx.putImageData(img, 0, 0); document.body.appendChild(cv);
    const lab = document.createElement('div'); lab.textContent = opts.bigLobes ? 'C01 开：大瓣 + 顶端断开 + 弥散薄雾' : '关（原 smoke.js）'; lab.style.cssText = `position:fixed;top:96px;left:${opts.bigLobes ? 380 : 10}px;z-index:9999;background:#fff;padding:2px 6px`; document.body.appendChild(lab);
    return { ...shape.set({}), particles: smoke.p.length, drawn: shape.drawn, hidden: shape.hidden, hazeCards: shape.hazeCards, solid: pts.length, faint, bulges: peaks(HI, 1) + peaks(LO, -1), gapBins: gaps };
  };
  const off = probe({ bigLobes: false, detach: false, haze: false }), on = probe({ bigLobes: true, detach: true, haze: true });
  // 恢复页面里的烟（截图看全开效果）
  shape.set({ bigLobes: true, detach: true, haze: true }); document.querySelector('#bigLobes').checked = document.querySelector('#detach').checked = document.querySelector('#haze').checked = true;
  document.querySelector('#reset').click();
  await sleep(1500);
  return { off, on };
})()
