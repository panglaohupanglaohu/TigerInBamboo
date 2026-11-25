// 1168571866405097472 浏览器验收：voxelfield 开关的常驻分层场在真实页面里逐次重投影。
// 首建 mode=full 出纹理 → world.fill → update() 防抖重烘（worldMesh.shape 从无到有那次
// 按口径回退 full 属预期）→ 基线对齐后再编辑一格 → mode=dirty（只重投影改动格 + 只重模糊
// 脏矩形）→ GPU 顶点采样纹理重打包、uShVField=1、CPU 顶点烘焙关着。
// 数值等价（增量 ≡ 全量）在 tests/ao-field-cache.mjs 里逐纹素断言，这里验真实页面接线。
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } }), errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  try {
    await p.goto('http://localhost:8769/index.html?scene=town&grid=quad&shade=voxelfield', { waitUntil: 'load' });
    await p.waitForFunction(() => window.rea?.view?.shading?.stats?.voxelfield && rea.view.shading.fieldCache?.field, null, { timeout: 30000 });
    const first = await p.evaluate(() => {
      const s = rea.view.shading, st = s.stats.voxelfield, u = s.u;
      return {
        mode: st.update.mode, dirty: st.update.dirty, ms: st.update.ms, W: st.W, H: st.H, layers: st.layers, texW: st.texW, texH: st.texH,
        on: u.uShVField.value, cpuBakeOff: st.cpuBakeOff, texIsFloat: u.uFieldTex.value.type,
      };
    });
    assert.equal(first.mode, 'full', '首建全量');
    assert.equal(first.dirty, 0);
    assert.equal(first.on, 1, 'uShVField 开');
    assert.equal(first.cpuBakeOff, true, 'CPU 顶点烘焙已让位给 GPU 采样');
    assert.ok(first.texW > 0 && first.texH === first.H * first.layers, '分层纹理尺寸 = W×H·layers');
    await p.screenshot({ path: 'artifacts/coverage/ao-field-cache-full.png' });

    // 编辑 #1：吸收一次性回退（worldMesh.shape 就位后 grow 口径变 → 按设计回退一次 full）
    const edit = async (maxTop) => p.evaluate((mt) => {
      const w = rea.view.town, c = w.cells.find((x) => w.top(x) >= 1 && w.top(x) <= mt);
      const t0 = w.top(c); w.fill(c, t0 + 1);
      return { id: c.id, t0, t1: w.top(c), ver: w.version };
    }, maxTop);
    const e1 = await edit(3);
    assert.ok(e1.t1 > e1.t0, '编辑真的改了高度 ' + JSON.stringify(e1));
    await p.waitForFunction(() => rea.view.shading.fieldVersion === rea.view.town.version, null, { timeout: 15000 });
    const m1 = await p.evaluate(() => rea.view.shading.stats.voxelfield.update);
    console.log('  update#1 (基线对齐):', JSON.stringify(m1));
    assert.ok(m1.mode === 'full' || m1.mode === 'dirty', '首次编辑后重烘');

    // 编辑 #2：缓存已与 world/shape/包围盒对齐 → 必走增量
    const e2 = await edit(4);
    await p.waitForFunction(() => rea.view.shading.fieldVersion === rea.view.town.version && rea.view.shading.stats.voxelfield.update.mode === 'dirty', null, { timeout: 15000 });
    const second = await p.evaluate(() => {
      const s = rea.view.shading, st = s.stats.voxelfield, upd = st.update;
      return { mode: upd.mode, dirty: upd.dirty, ms: upd.ms, blurMs: upd.blurMs ?? null, rect: upd.rect, W: st.W, H: st.H, layers: st.layers };
    });
    assert.equal(second.mode, 'dirty', '基线后的单次编辑走增量重投影');
    assert.equal(second.dirty, 1, '只脏一格');
    assert.ok(second.rect && second.rect.i1 >= second.rect.i0 && second.rect.j1 >= second.rect.j0, '脏矩形非空');
    assert.equal(second.W, first.W, '场网格不变（同一张常驻纹理）');
    assert.equal(second.layers, first.layers);
    console.log('  dirty update:', JSON.stringify(second));
    await p.screenshot({ path: 'artifacts/coverage/ao-field-cache-dirty.png' });

    // 无改动：直接问缓存应是 clean（update() 防抖不触发时 stats 不会覆盖成 clean，直接调缓存）
    const clean = await p.evaluate(() => rea.view.shading.fieldCache.update(rea.view.town, { shape: rea.view.worldMesh.shape }).mode);
    assert.equal(clean, 'clean', '无改动 → clean，不重投影');
    // 逐纹素等价在浏览器里也抽一次（同一 world 全量重建对比，verifyAgainstFull 内建）
    const verify = await p.evaluate(() => rea.view.shading.fieldCache.verifyAgainstFull(rea.view.town, { shape: rea.view.worldMesh.shape }));
    assert.ok(verify && verify.badTexels === 0, '增量场 ≡ 全量重建（浏览器内）: ' + JSON.stringify(verify));
    console.log('  browser verify:', JSON.stringify(verify));
    assert.deepEqual(errors, [], 'no page errors');
    console.log('PASS ao-field-cache-browser: voxelfield 走常驻场——首建 full→纹理，编辑→dirty(1格,脏矩形)，clean 不动，verify 逐纹素一致。');
  } finally { await b.close(); }
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
