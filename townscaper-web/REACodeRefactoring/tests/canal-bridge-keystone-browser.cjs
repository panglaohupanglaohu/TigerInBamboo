// 第 123 轮 · [056]：拱券楔石/净空 + 任意塔基全局楼层线的运行验收。
// 片子 806904557502464000（运河拱桥）/ 802496920790777856（穿楼拱洞）的 note 从 r56 起挂着「楔石/完整桥构仍缺」。
// 本测不读日志判断「画了没有」，而是直接数世界网格里真正发出的三角：
//   楔石环（K.frame 近白）= 16 个三角 + 键石（K.stoneDark）= 2 个三角 → 一面 9 块楔石、拱顶 1 块键石；
//   再用射线量「拱下通不通」、用 A/B 重建量「关掉开关后同一面是实心码头」。
// 第二段用 fusion 场景（拱在 4 层与 6 层、base 1.5 / 2.5）验「任意塔基的全局楼层线」：
//   crown = base − slab、spring ≥ floor、每面恰好一块键石、楔石环顶不超过 base。
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('fs');

const BASE = 'http://localhost:8769';

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 640 } });
  const errors = [];
  page.setDefaultTimeout(45000);
  page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR', e.message); });
  const report = { canal: null, budget: null, ab: null };

  try {
    // ---------------- A) 运河拱桥：楔石环 / 键石 / 拱腹 / 拱下可通 -----------------
    await page.goto(`${BASE}/openings-r56.html?scene=canal&grid=quad&flags=canalBridges,archVoussoirs&focus=bridge&k=2&dist=1.9&pitch=.05&clean=1`);
    await page.waitForFunction(() => window.r56 && window.r56bridgeProbe && window.r56.bridges > 0);
    await page.waitForTimeout(600);
    const stats = await page.evaluate(() => window.r56);
    assert.equal(stats.bridges, 4, `two bridges × two canal faces (got ${stats.bridges})`);
    for (const f of stats.bridgeFaces) {
      assert.equal(f.wedges, 9, `face ${f.face}: voussoir ring has 9 wedges`);
      assert.ok(f.vault === 12 || f.vault === 0, `face ${f.face}: vault strips only on the upstream face`);
      assert.ok(f.rise > 0.1 && f.rise < 0.44, `face ${f.face}: rise fits under the coping (${f.rise})`);
    }
    assert.equal(stats.bridgeFaces.filter((f) => f.vault === 12).length, 2, 'one vault per bridge');
    await page.screenshot({ path: 'artifacts/coverage/canal-bridge-keystone-quad.png' });

    // 关顶点烘焙（只影响 AO 乘色、不动几何），按调色板精确数面色
    const faces = await page.evaluate(() => {
      const v = window.r56world.view;
      v.worldMesh.setBakeLighting({ enabled: false });
      v.worldMesh.invalidate();
      v.render(0);
      return [0, 1, 2, 3].map((k) => window.r56bridgeProbe(k));
    });
    for (const p of faces) {
      assert.equal(p.ringTotal, 18, `face ${p.face}: 9 wedges × 2 tris in the drawn mesh (got ${p.ringTotal})`);
      assert.equal(p.ringTris, 16, 'ring minus keystone = 8 light wedges');
      assert.equal(p.keyTris, 2, `face ${p.face}: keystone quad = 2 tris`);
      assert.equal(p.ringWedges, 9, 'ring wedges');
      assert.ok(Math.abs(p.keyS - 0.5) < 0.06, `keystone sits at the crown (s=${p.keyS})`);
      assert.ok(p.keyY > p.crown && p.keyY < p.crown + 0.06, `keystone above crown ${p.crown} → ${p.keyY}`);
      assert.ok(p.ringMinS < 0.15 && p.ringMaxS > 0.85, `ring runs down to both springing feet (${p.ringMinS}..${p.ringMaxS})`);
      assert.ok(p.ringMaxY < p.ya - 0.01, `ring stays under the coping (${p.ringMaxY} < ${p.ya})`);
      assert.ok(p.keySum < 0.55, `keystone is the dark stone (sum ${p.keySum})`);
      assert.ok(p.vaultTris >= 24, `face ${p.face}: vault strips drawn (${p.vaultTris} tris)`);
      assert.equal(p.faceTris > 0, true, 'the face still has wall triangles around the opening');
      // 拱下可通：同一高度射线的首个交点远在对面之外；拱顶以上同一射线在 0.35 处被桥体挡住
      assert.ok(p.firstHitOpen > 0.6, `face ${p.face}: water passes under the arch (first hit ${p.firstHitOpen})`);
      assert.ok(p.firstHitAboveDeck < 0.45, `face ${p.face}: spandrel above the arch is closed (${p.firstHitAboveDeck})`);
      assert.ok(p.firstHitOpen > 2 * p.firstHitAboveDeck, 'open below / solid above');
    }
    report.canal = { bridges: stats.bridges, faces: faces.map(({ cell, face, span, rise, crown, ya, ringTris, keyTris, ringWedges, keyS, keyY, ringMinS, ringMaxS, ringMaxY, vaultTris, firstHitOpen, firstHitAboveDeck }) => ({ cell, face, span, rise, crown, ya, ringTris, keyTris, ringWedges, keyS, keyY, ringMinS, ringMaxS, ringMaxY, vaultTris, firstHitOpen, firstHitAboveDeck })) };

    // ---------------- B) 同一格同一面 A/B：关掉开关 → 实心码头、无楔石环 ----------------
    const off = await page.evaluate(() => {
      const { world, view } = window.r56world;
      world.canalBridges = false; world.touch(); view.worldMesh.invalidate(); view.render(0);
      return [0, 1, 2, 3].map((k) => window.r56bridgeProbe(k));
    });
    for (const p of off) {
      assert.equal(p.flag, false, 'flag really off');
      assert.equal(p.ringTotal, 0, 'no wedge ring without canalBridges');
      assert.equal(p.keyTris, 0, 'no keystone without canalBridges');
      assert.ok(Math.abs(p.firstHitOpen - p.firstHitAboveDeck) < 0.05, `solid quay: same height now hits the block (${p.firstHitOpen} vs ${p.firstHitAboveDeck})`);
      assert.ok(p.firstHitOpen < 0.45, 'solid quay face within 0.45');
    }

    // 像素 A/B（烘焙开回来，看真画面）
    const ab = await page.evaluate(() => {
      const { world, view, grid } = window.r56world;
      view.worldMesh.setBakeLighting({ enabled: true });
      const r = view.renderer, gl = r.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
      const grab = (on) => {
        world.canalBridges = on; world.touch(); view.worldMesh.invalidate(); view.render(0); view.render(0);
        const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px;
      };
      const a = grab(true), b = grab(false), noiseA = grab(true), noiseB = grab(true);
      let changed = 0, noise = 0, sx = 0, sy = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 12) { changed++; sx += (i / 4) % W; sy += Math.floor(i / 4 / W); }
        if (Math.abs(noiseA[i] - noiseB[i]) + Math.abs(noiseA[i + 1] - noiseB[i + 1]) + Math.abs(noiseA[i + 2] - noiseB[i + 2]) > 12) noise++;
      }
      // 变了的像素要聚在镜头目标（桥格）附近，而不是整屏乱变
      const cx = sx / Math.max(1, changed), cy = sy / Math.max(1, changed);
      let near = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 12) {
          const x = (i / 4) % W, y = Math.floor(i / 4 / W);
          if (Math.hypot(x - cx, y - cy) < 240) near++;
        }
      }
      return { W, H, changed, noise, centroid: [+cx.toFixed(1), +cy.toFixed(1)], nearShare: +(near / Math.max(1, changed)).toFixed(3) };
    }, null);
    assert.ok(ab.noise === 0, `same-state noise floor is 0 (got ${ab.noise})`);
    assert.ok(ab.changed > 3000, `turning the flag off changes the arch region (${ab.changed}px)`);
    assert.ok(ab.nearShare > 0.8, `changes cluster on the bridge (${ab.nearShare})`);
    report.ab = ab;
    await page.evaluate(() => { const { world, view } = window.r56world; world.canalBridges = false; world.touch(); view.worldMesh.invalidate(); view.render(0); });
    await page.screenshot({ path: 'artifacts/coverage/canal-bridge-keystone-quad-off.png' });

    // ---------------- C) 任意塔基的全局楼层线（fusion：拱在 4 层与 6 层） ----------------
    // 先补一张能看清「拱券环 + 键石 + 净空」的机位：运河场景里跨渠的悬空楼体拱（4 层，base 1.5）
    await page.goto(`${BASE}/openings-r56.html?scene=canal&flags=archVoussoirs,canalBridges&focus=arch&dist=3&pitch=.22&clean=1`);
    await page.waitForFunction(() => window.r56 && window.r56.arches > 0);
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'artifacts/coverage/canal-arch-keystone-canal.png' });
    const canalArch = await page.evaluate(() => {
      const b = window.r56world.view.worldMesh.build;
      const a = b.archBudgets[0];
      const ws = b.archVoussoirLog;
      return { cell: a.cell, level: a.level, base: +a.base.toFixed(4), floor: +a.floor.toFixed(4), crown: +a.crown.toFixed(4), spring: +a.spring.toFixed(4), rise: +a.rise.toFixed(4), wedges: ws.length, keys: ws.filter((w) => w.keystone).length, groups: [...new Set(ws.map((w) => w.cell + ':' + w.face))].length };
    });
    assert.equal(canalArch.wedges, canalArch.groups * 9, 'canal connector arch: 9 wedges per open face');
    assert.equal(canalArch.keys, canalArch.groups, 'one keystone per open face');

    await page.goto(`${BASE}/openings-r56.html?scene=fusion&grid=quad&flags=archVoussoirs&focus=arch&dist=5&clean=1`);
    await page.waitForFunction(() => window.r56 && window.r56world.view.worldMesh.build);
    await page.waitForTimeout(400);
    const budget = await page.evaluate(() => {
      const b = window.r56world.view.worldMesh.build;
      return {
        arches: b.archBudgets.map((r) => ({ cell: r.cell, level: r.level, base: +r.base.toFixed(4), floor: +r.floor.toFixed(4), crown: +r.crown.toFixed(4), spring: +r.spring.toFixed(4), rise: +r.rise.toFixed(4), slab: r.slab, span: +r.span.toFixed(3), slabsCut: r.slabsCut, corniceContinuous: r.corniceContinuous })),
        vouchers: b.archVoussoirLog.map((r) => ({ cell: r.cell, level: r.level, face: r.face, keystone: r.keystone, maxY: +r.maxY.toFixed(4), base: +r.base.toFixed(4) })),
      };
    });
    assert.ok(budget.arches.length >= 3, `fusion has arches on several bases (${budget.arches.length})`);
    const levels = [...new Set(budget.arches.map((a) => a.level))].sort((x, y) => x - y);
    assert.ok(levels.length >= 2, `arches sit on at least two storey bases (${levels})`);
    for (const a of budget.arches) {
      assert.ok(Math.abs(a.crown - (a.base - a.slab)) < 1e-9, `cell ${a.cell}: crown = base − slab (${a.crown} vs ${a.base - a.slab})`);
      assert.ok(a.spring >= a.floor - 1e-9, `cell ${a.cell}: spring above the floor line (${a.spring} ≥ ${a.floor})`);
      assert.ok(a.rise > 0, `cell ${a.cell}: rise > 0`);
      assert.equal(a.corniceContinuous, true, `cell ${a.cell}: cornice band stays continuous under the supported base`);
    }
    const groups = new Map();
    for (const v of budget.vouchers) {
      const k = `${v.cell}:${v.face}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(v);
    }
    for (const [k, ws] of groups) {
      assert.equal(ws.length, 9, `${k}: 9 wedges on the open face`);
      assert.equal(ws.filter((w) => w.keystone).length, 1, `${k}: exactly one keystone`);
      const top = Math.max(...ws.map((w) => w.maxY));
      assert.ok(top <= ws[0].base - 1e-9, `${k}: ring top ${top} stays under base ${ws[0].base}`);
    }
    report.budget = { canalArch, arches: budget.arches, groups: [...groups.keys()].length, wedges: budget.vouchers.length, levels };
    await page.screenshot({ path: 'artifacts/coverage/canal-bridge-arch-budget-fusion.png' });

    assert.deepEqual(errors, [], `console errors: ${errors.join(' | ')}`);
    fs.writeFileSync('artifacts/coverage/canal-bridge-keystone-browser.json', JSON.stringify({ ...report, errors }, null, 2));
    console.log('PASS canal bridge keystone + arch budget');
    console.log(JSON.stringify(report, null, 1));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
