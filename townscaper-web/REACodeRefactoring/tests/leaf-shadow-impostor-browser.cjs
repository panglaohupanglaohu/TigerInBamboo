// 1205420678859632640 残差补全的浏览器验收：叶纹页（leaf-surface.html，iframe 跑 index.html?scene=terrain）
//   ① 阴影 caster：树冠 customDepthMaterial 真实编进阴影图——leaf-depth 程序在
//      renderer.info.programs 里、阴影重画后无 GL/shader 报错（console/pageerror 全程监听）。
//   ② 远景 impostor：view.setDebug('treelod') 开距离 LOD，updateCrownLOD 按真实相机
//      划分 近网格/远面片，面片场共享 32² 叶图集 uniform（单例不分裂）。
// 截屏 artifacts/coverage/leaf-shadow-impostor.png；报告 leaf-shadow-impostor-browser.json。
const { chromium } = require('playwright'), fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const errors = [], reports = [];
  try {
    const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto('http://localhost:8769/leaf-surface.html');
    await p.waitForFunction(() => window.leafReview?.api?.view?.vegetation?.crowns.some((c) => c.m.count > 0), null, { polling: 100 });
    const report = await p.evaluate(async () => {
      const { view } = window.leafReview.api, v = view.vegetation, cam = view.camera;
      const r = { trees: v.crownPlacements.length };
      if (!r.trees) throw Error('terrain scene has no crowns');
      // ① 深度材质：三种树冠都有 customDepthMaterial（RGBADepthPacking）
      r.depth = v.crowns.map((c) => !!c.m.customDepthMaterial);
      if (r.depth.some((x) => !x)) throw Error('crown missing customDepthMaterial');
      // ② LOD：取真实相机下各树距离的中位数作阈值 → 两档都非空
      const ds = v.crownPlacements.map((pl) => Math.hypot(pl.x - cam.position.x, pl.y - cam.position.y, pl.z - cam.position.z)).sort((a, b) => a - b);
      const D = ds[Math.floor(ds.length / 2)];
      r.threshold = +D.toFixed(3);
      view.setDebug('treelod', true);                       // 开关入口：距离 8（默认）
      const part = v.updateCrownLOD(cam, D);                // 实测阈值重划
      r.near = part.near; r.far = part.far;
      if (part.near + part.far !== r.trees) throw Error('LOD partition lost crowns');
      if (!part.near || !part.far) throw Error('median threshold should split both ways');
      r.meshCounts = v.crowns.map((c) => c.m.count);
      r.farCounts = v.farFields.map((f) => f.mesh.count);
      r.farVisible = v.farFields.every((f) => f.mesh.visible);
      r.sharedAtlas = v.farFields.every((f) => f.material.uniforms.uLeafAtlas.value === v.leafSurface.uniform.value);
      if (!r.sharedAtlas) throw Error('far field texture is not the shared atlas singleton');
      // ③ 强制阴影图重画 + 主动渲染两帧（页面 RAF 也在跑），观察深度材质是否真实编译
      view.requestShadowUpdate();
      view.render(0.016); view.render(0.016);
      r.programs = view.renderer.info.programs.map((pr) => String(pr.cacheKey));
      r.leafDepthCompiled = r.programs.some((k) => k.includes('leaf-depth-'));
      if (!r.leafDepthCompiled) throw Error('leaf depth program never compiled');
      r.shadowMapExists = !!view.sun?.shadow?.map;
      // ④ 关掉 LOD 回原状
      view.setDebug('treelod', false);
      const back = v.updateCrownLOD(cam, 0);
      r.restore = back.near === r.trees && back.far === 0;
      if (!r.restore) throw Error('LOD off did not restore all mesh crowns');
      return r;
    });
    reports.push(report);
    await p.screenshot({ path: 'artifacts/coverage/leaf-shadow-impostor.png', fullPage: true });
    if (errors.length) throw Error(errors.join('\n'));
    fs.writeFileSync('artifacts/coverage/leaf-shadow-impostor-browser.json', JSON.stringify({ reports, errors }, null, 2));
    console.log('PASS leaf-shadow-impostor browser', JSON.stringify(report));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
