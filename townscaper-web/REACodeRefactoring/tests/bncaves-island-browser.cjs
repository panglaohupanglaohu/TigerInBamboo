// bncaves-island-browser.cjs — 906416813810049025（r214 运行时验收）
// 真页面 index.html?scene=badnorth&bncaves=3（真实 GPU/three + 本机 Chrome swiftshader）：
//   · 洞穴岛真挖出穿山隧道（world.bnCaves，through≥1），洞格同平面双节点（洞底层 + 板顶层）；
//   · 战斗实时推进：守军有限坐标、维京长船出场并卸人上岸（多层战斗与船只的运行时证据）；
//   · 与同种子 ?bncaves=0 同机位截图像素差 > 0（洞真的画出来）；控制台零 error。
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [];
  const open = async (query) => {
    const p = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto('http://127.0.0.1:8769/index.html' + query);
    await p.waitForFunction(() => window.rea?.world && window.rea?.battle, { timeout: 90000 });
    return p;
  };
  try {
    const page = await open('?scene=badnorth&bncaves=3');
    await page.waitForFunction(() => window.rea.world.bnCaves?.length >= 1 && window.rea.battle.navigation, { timeout: 30000 });
    const state0 = await page.evaluate(() => {
      const { world, battle } = window.rea;
      const nav = battle.navigation; nav.refresh();
      const tn = world.bnCaves.filter((t) => t.through);
      let stacked = 0;
      for (const t of tn) for (const id of t.cells) {
        const c = world.cells[id];
        const floors = nav.graph.nodes.filter((n) => n.cell.id === id).map((n) => n.floor);
        if (floors.includes(t.floor) && floors.includes(world.top(c))) stacked++;
      }
      return { tunnels: world.bnCaves.length, through: tn.length, floors: tn.map((t) => t.floor), stacked,
        caves: world.bnCaves.map((t) => ({ n: t.cells.length, through: t.through, f: t.floor })) };
    });
    assert.ok(state0.through >= 1, `穿山隧道（${JSON.stringify(state0.caves)}）`);
    assert.ok(state0.stacked >= 1, `同格双节点（${state0.stacked}）`);
    // 真实战斗推进（页面内直接步进，比等 rAF 快且确定）：长船出场 → 卸人 → 单位上岸
    const landed = await page.evaluate(() => {
      const { battle, world } = window.rea, index = battle.view.index;
      let sawBoat = 0, landedVik = 0;
      for (let k = 0; k < 1800 && !landedVik; k++) {
        battle.update(1 / 30);
        sawBoat = Math.max(sawBoat, battle.boats.length);
        landedVik = battle.units.filter((u) => u.team === 1 && !u.dead && !u.onBoat && index.cellAt(u.x, u.z)).length;
      }
      const finite = battle.units.every((u) => [u.x, u.y, u.z].every(Number.isFinite));
      return { sawBoat, landedVik, finite, units: battle.units.length, wave: battle.wave };
    });
    assert.ok(landed.sawBoat >= 1, '长船出场');
    assert.ok(landed.landedVik >= 1, `维京人上岸（${landed.landedVik}）`);
    assert.ok(landed.finite, '战斗全程无 NaN');
    const shotCaves = await page.locator('#view').screenshot();
    await page.close();
    // 同种子不开洞：岛一样、岩上没洞 → 截图像素差 > 0
    const plain = await open('?scene=badnorth&bncaves=0');
    await plain.waitForFunction(() => window.rea.world.bnCaves === null, { timeout: 30000 });
    await plain.waitForTimeout(1200);
    const shotPlain = await plain.locator('#view').screenshot();
    await plain.close();
    let diff = 0; const n = Math.min(shotCaves.length, shotPlain.length);
    for (let i = 0; i < n; i++) if (shotCaves[i] !== shotPlain[i]) diff++;
    assert.ok(diff > 1000, `洞穴开关截图像素差 ${diff} > 1000`);
    assert.equal(errors.length, 0, `控制台零 error（${JSON.stringify(errors.slice(0, 3))}）`);
    console.log('PASS bncaves 浏览器验收', JSON.stringify({ ...state0, battle: landed, pixelDiff: diff }));
  } finally { await browser.close(); }
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
