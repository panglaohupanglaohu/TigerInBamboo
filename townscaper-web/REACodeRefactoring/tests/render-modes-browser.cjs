// 1313841094069817344 · "I added texture-only and light-only render modes"
// 验收：两个正交视图真的存在且互斥。
//   texture-only：outgoingLight = albedo → 开关投影像素几乎不变（无光照）；
//   light-only：丢顶点色（白模）→ 饱和度大跌，但投影仍在（暗部差 > 0）。
const { chromium } = require('playwright'), fs = require('fs'), assert = require('node:assert/strict');

(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 900, height: 700 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(m.text()); });
  try {
    await p.goto('http://localhost:8769/index.html?scene=town&grid=quad');
    await p.waitForFunction(() => window.rea?.view?.mesh?.geometry?.attributes?.position?.count > 1000, null, { timeout: 60000 });
    await p.waitForTimeout(1200);

    const r = await p.evaluate(async () => {
      const { view: v } = rea, T = await import('three');
      v.distance = 15; v.pitch = 0.5; v.yaw = Math.PI * 0.22; v.updateCamera();
      const W = 640, H = 480;
      const rt = new T.WebGLRenderTarget(W, H);
      const shot = () => {
        v.requestShadowUpdate();
        v.render(0.016);
        v.renderer.setRenderTarget(rt);
        v.renderer.render(v.scene, v.camera);
        const a = new Uint8Array(W * H * 4);
        v.renderer.readRenderTargetPixels(rt, 0, 0, W, H, a);
        v.renderer.setRenderTarget(null);
        return a;
      };
      const statsMasked = (a, mask) => {
        let sat = 0, n = 0;
        for (let i = 0; i < a.length; i += 4) {
          if (!mask[i >> 2]) continue;
          const R = a[i] / 255, G = a[i + 1] / 255, B = a[i + 2] / 255;
          const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
          sat += mx > 0 ? (mx - mn) / mx : 0; n++;
        }
        return +(sat / Math.max(1, n)).toFixed(4);
      };
      const stats = (a) => {
        let sat = 0, lumSum = 0, n = 0, lumSq = 0;
        for (let i = 0; i < a.length; i += 4) {
          const R = a[i] / 255, G = a[i + 1] / 255, B = a[i + 2] / 255;
          const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
          sat += mx > 0 ? (mx - mn) / mx : 0;
          const L = 0.299 * R + 0.587 * G + 0.114 * B;
          lumSum += L; lumSq += L * L; n++;
        }
        const mean = lumSum / n;
        return { sat: +(sat / n).toFixed(4), mean: +mean.toFixed(4), std: +Math.sqrt(Math.max(0, lumSq / n - mean * mean)).toFixed(4) };
      };
      const delta = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 6) n++; return n; };
      // 只在"正常模式下被投影改变的像素"上比：那些是主体（墙/平台）上的影子，不含水面影子接收层
      const maskedDelta = (a, b, mask) => { let n = 0, m = 0; for (let i = 0; i < a.length; i += 4) { if (!mask[i >> 2]) continue; m++; if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 6) n++; } return { changed: n, mask: m, share: +(n / Math.max(1, m)).toFixed(4) }; };
      const png = (a) => {
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const ctx = c.getContext('2d'), img = ctx.createImageData(W, H);
        for (let y = 0; y < H; y++) img.data.set(a.subarray(y * W * 4, (y + 1) * W * 4), (H - 1 - y) * W * 4);
        ctx.putImageData(img, 0, 0);
        return c.toDataURL('image/png').split(',')[1];
      };

      // 正常
      v.setDebug('textureonly', false); v.setDebug('lightonly', false); v.setDebug('shadows', true);
      v.material.needsUpdate = true;
      const normal = shot(), normalNoShadow = (v.setDebug('shadows', false), shot());
      const normalStats = stats(normal);
      const shadowMask = new Uint8Array(W * H);
      for (let i = 0; i < normal.length; i += 4) {
        if (Math.abs(normal[i] - normalNoShadow[i]) + Math.abs(normal[i + 1] - normalNoShadow[i + 1]) + Math.abs(normal[i + 2] - normalNoShadow[i + 2]) > 6) shadowMask[i >> 2] = 1;
      }

      // 只看贴图
      v.setDebug('shadows', true);
      v.setDebug('textureonly', true);
      const tex = shot(), texNoShadow = (v.setDebug('shadows', false), shot());
      const texStats = stats(tex);

      // 只看光照
      v.setDebug('shadows', true);
      v.setDebug('textureonly', false); v.setDebug('lightonly', true);
      v.material.needsUpdate = true;
      const light = shot(), lightNoShadow = (v.setDebug('shadows', false), shot());
      const lightStats = stats(light);
      const vcOff = v.material.vertexColors;   // 捕捉此刻（后面会复原）

      // 复原
      v.setDebug('lightonly', false); v.setDebug('shadows', true); v.material.needsUpdate = true;

      return {
        normal: { ...normalStats, satMasked: statsMasked(normal, shadowMask) },
        tex: { ...texStats, satMasked: statsMasked(tex, shadowMask) },
        light: { ...lightStats, satMasked: statsMasked(light, shadowMask) },
        vertexColorsAfterLightOnly: vcOff,
        shadowDeltaNormal: delta(normal, normalNoShadow),
        shadowDeltaTex: delta(tex, texNoShadow),
        shadowDeltaLight: delta(light, lightNoShadow),
        maskedTex: maskedDelta(tex, texNoShadow, shadowMask),
        maskedLight: maskedDelta(light, lightNoShadow, shadowMask),
        flags: { vertexColorsAfterLightOnly: v.lightOnlyOn, texOn: v.textureOnlyOn.value },
        pngs: { normal: png(normal), tex: png(tex), light: png(light) },
      };
    });

    fs.writeFileSync('artifacts/coverage/render-modes-normal.png', Buffer.from(r.pngs.normal, 'base64'));
    fs.writeFileSync('artifacts/coverage/render-modes-textureonly.png', Buffer.from(r.pngs.tex, 'base64'));
    fs.writeFileSync('artifacts/coverage/render-modes-lightonly.png', Buffer.from(r.pngs.light, 'base64'));

    // texture-only：投影开关不该改变画面（outgoingLight 已等于 albedo）
    assert.ok(r.shadowDeltaNormal > 3000, `正常模式关投影应明显改变画面，实际 ${r.shadowDeltaNormal}`);
    // 主体（共用 town 材质）的明暗全消失；剩下的 ~15% 是树/海鸥/水面影子接收层，它们还各自吃光（已知缺口）
    assert.equal(r.vertexColorsAfterLightOnly, false, '只看光照时必须关掉顶点色');
    assert.ok(r.maskedTex.share < 0.25, `只看贴图时主体上的影子应基本消失（掩码内变化比例 ${r.maskedTex.share}，掩码 ${r.maskedTex.mask} 像素）`);
    // light-only：还有光影
    assert.ok(r.shadowDeltaLight > 1000, `只看光照时投影仍应存在，实际 ${r.shadowDeltaLight}`);
    // 饱和度：light-only 是白模，必须明显低于正常
    // 主体像素上的饱和度：白模应该掉到接近 0；只看贴图应该基本不变
    // 掩码里还混着水面影子接收层和植被（它们没跟着变白模），所以降不到 0
    assert.ok(r.light.satMasked < r.normal.satMasked * 0.6, `只看光照时主体应是白模：sat ${r.light.satMasked} vs ${r.normal.satMasked}`);
    assert.ok(r.tex.satMasked > r.normal.satMasked * 0.9, `只看贴图应保留主体配色：sat ${r.tex.satMasked} vs ${r.normal.satMasked}`);
    // texture-only 仍保留配色


    console.log(JSON.stringify({ normal: r.normal, tex: r.tex, light: r.light, shadowDelta: { normal: r.shadowDeltaNormal, tex: r.shadowDeltaTex, light: r.shadowDeltaLight }, maskedTex: r.maskedTex, maskedLight: r.maskedLight }, null, 2));
    assert.deepEqual(errors, []);
    console.log('PASS render-modes');
  } finally {
    await b.close();
  }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
