// 1241046107125399552 浏览器验收（隔离 context，不碰用户存档）：
// ① leafSurface 是进程级共享单例——模块再 makeLeafSurface 仍同一纹理对象，
//    且 uniform.value === texture（灌木/树冠共用此 surface）；
// ② ?c07=townskin：植物 uniform 指到全城 TownColor 纹理对象（与建筑同一张图），
//    图集角外 alpha=255（证明不是独立叶图集）、角内与叶图集同 motif；
// ③ townskin 关掉后 uniform 还原回共享叶图集。
// 运行：NODE_PATH=<playwright-core 所在 node_modules> node tests/leaf-atlas-shared-browser.cjs
const { chromium } = require('playwright-core'), fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const errors = [], out = {};
  try {
    /* ---- ① 共享单例 ---- */
    const p = await (await b.newContext()).newPage();
    p.on('pageerror', (e) => errors.push('scene: ' + e.message));
    await p.goto('http://localhost:8769/index.html?scene=terrain');
    await p.waitForFunction(() => window.rea?.view?.vegetation?.leafSurface?.texture, null, { polling: 100 });
    out.singleton = await p.evaluate(async () => {
      const v = rea.view.vegetation, s = v.leafSurface;
      const ls = await import('/src/life/leaf-surface.js');
      const again = ls.makeLeafSurface();
      return {
        sharedFlag: s.shared === true,
        uniformIsTexture: s.uniform.value === s.texture,
        singletonAcrossInstances: again.texture === s.texture,
        singletonAcrossSurfaces: again.atlas === s.atlas,
        size: [s.texture.image.width, s.texture.image.height],
        cornerAlpha: s.texture.image.data[(127 * 128 + 127) * 4 + 3],   // 角内 alpha=255
        outsideAlpha: s.texture.image.data[3],                           // 独立图集角外 alpha=0
      };
    });
    if (!out.singleton.sharedFlag || !out.singleton.uniformIsTexture || !out.singleton.singletonAcrossInstances || !out.singleton.singletonAcrossSurfaces)
      throw Error('leafSurface 不是全场景共享单例 ' + JSON.stringify(out.singleton));
    if (out.singleton.size[0] !== 128 || out.singleton.size[1] !== 128) throw Error('atlas 非 128²');
    if (out.singleton.cornerAlpha !== 255 || out.singleton.outsideAlpha !== 0) throw Error('32² 保留区布局不对 ' + JSON.stringify(out.singleton));
    await p.screenshot({ path: 'artifacts/coverage/leaf-atlas-shared-terrain.png' });
    await p.context().close();

    /* ---- ②③ TownSkin：与建筑同一张纹理对象 ---- */
    const q = await (await b.newContext()).newPage();
    q.on('pageerror', (e) => errors.push('skin: ' + e.message));
    await q.goto('http://localhost:8769/index.html?scene=terrain&c07=townskin');
    await q.waitForFunction(() => window.rea?.view?.c07?.skin?.stats?.skinned > 0 && rea.view.vegetation?.leafSurface, null, { polling: 100 });
    out.townskin = await q.evaluate(async () => {
      const v = rea.view.vegetation, s = v.leafSurface, skin = rea.view.c07.skin;
      const own = s.texture;
      const bound = s.uniform.value;
      const d = bound.image.data;
      // 角内取一个叶纹像素对比 motif（(96+8, 96+16) 处与独立图集同字节）
      const leafMod = (await import('/src/core/leaf-atlas.js')).sharedLeafAtlas().data;
      const px = (96 + 16) * 128 + (96 + 8), same = d[px * 4] === leafMod[px * 4] && d[px * 4 + 3] === leafMod[px * 4 + 3];
      const r1 = {
        boundIsSkinTex: bound === skin.tex, notOwnAtlas: bound !== own,
        alphaOutside: d[3], cornerSame: same, skinned: skin.stats.skinned, slots: skin.stats.slots, mismatch: skin.stats.mismatch,
      };
      rea.view.c07.set('townskin', false);
      const r2 = { restored: s.uniform.value === own };
      rea.view.c07.set('townskin', true);
      const r3 = { rebound: s.uniform.value === skin.tex };
      return { ...r1, ...r2, ...r3 };
    });
    if (!out.townskin.boundIsSkinTex || !out.townskin.notOwnAtlas) throw Error('townskin 开时植物未绑全城图集 ' + JSON.stringify(out.townskin));
    if (out.townskin.alphaOutside !== 255) throw Error('绑到的不是全城图集（角外 alpha 应 255）');
    if (!out.townskin.cornerSame) throw Error('全城图集植物角 motif 与叶图集不一致');
    if (!out.townskin.restored || !out.townskin.rebound) throw Error('townskin 开关 uniform 还原/重绑失败 ' + JSON.stringify(out.townskin));
    await q.screenshot({ path: 'artifacts/coverage/leaf-atlas-shared-townskin.png' });
    await q.context().close();

    if (errors.length) throw Error(errors.join('\n'));
    fs.mkdirSync('artifacts/coverage', { recursive: true });
    fs.writeFileSync('artifacts/coverage/leaf-atlas-shared.json', JSON.stringify(out, null, 2));
    console.log('PASS 共享单例 + TownSkin 同纹理对象绑定/还原', JSON.stringify(out));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
