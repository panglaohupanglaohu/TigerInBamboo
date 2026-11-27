/** 906425294533394432 / 797119718477991936：洞口占用的运行验收（真页面 + 真 Battle + 真 World）。
 *  同一份「岩板 + 洞顶在第 3 层」的世界，只改体型（= 容量）与开关：
 *    宽口（体径 .11，容量 8）→ 6 人零等待；大体型（半径 .25，容量 1）→ 单列排队；关档 → 挤成一团。
 *  运行：NODE_PATH=/tmp/pw-shim:/Users/panglaohu/Downloads/TigerInBamboo/REA-agent/node_modules \
 *        node tests/door-queue-browser.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const base = process.env.REA_TEST_URL || 'http://localhost:8769';
  const out = path.resolve(__dirname, '../artifacts/coverage');
  await p.goto(base + '/index.html?scene=badnorth');
  await p.waitForFunction(() => window.rea?.battle?.running, null, { timeout: 120000 });
  await p.evaluate(() => {
    const w = rea.world; w.reset();
    for (const c of w.cells) { w.fill(c, 1, { rock: true }); if (Math.abs(c.cx) < 1.4) w.setSolid(c, 3, true); }
    rea.view.worldMesh.invalidate();
  });
  await p.waitForFunction(() => rea.view.worldMesh.builtVersion === rea.world.version, null, { timeout: 120000 });
  await p.waitForTimeout(600);

  const runCase = (R, doors) => p.evaluate(({ R, doors }) => {
    const w = rea.world, b = rea.battle;
    b.doorsOn = doors; b.nextWave = Infinity;
    b.start(w);
    const row = w.cells.filter((c) => Math.abs(c.cz) < .6);
    const start = row.reduce((a, c) => (c.cx < a.cx ? c : a)), goal = row.reduce((a, c) => (c.cx > a.cx ? c : a));
    const sq = b.squads[0], keep = sq.members[0];
    for (const other of b.squads.slice(1)) b.group.remove(other.flag, other.flag.userData.cloth);
    b.squads = [sq]; sq.members = []; b.units = []; b.houses = []; b.selected = sq;
    sq.goal = goal; sq.goalFloor = w.top(goal);
    for (let k = 0; k < 6; k++) {
      const u = k === 0 ? keep : { ...keep, uid: 1000 + k, squad: sq, k };
      u.team = 0; u.k = k; u.dead = false; u.onBoat = null; u.fall = null; u.hp = u.max = 3; u.cd = 99; u.soak = 0; u.stunRemaining = 0;
      u.radius = R; u.bodyScale = R / .055;
      u.x = start.cx + (k % 2) * .12; u.z = start.cz + (Math.floor(k / 2) - 1) * .16;
      u.y = .5; u.navFloor = 1;
      sq.members.push(u); b.units.push(u);
    }
    const mouths = b.navigation.mouthStats();
    const maxHold = {};
    let insideMax = 0, arrivedAt = null, maxHolders = 0;
    const crossed = new Set(), crossAt = [];
    for (let t = 0; t < 60 * 30; t++) {
      b.update(1 / 30);
      for (const u of b.units) if (u.x > (start.cx + goal.cx) / 2 + .4 && !crossed.has(u.uid)) { crossed.add(u.uid); crossAt.push(+(t / 30).toFixed(2)); }
      insideMax = Math.max(insideMax, b.units.filter((u) => Math.abs(u.x - (start.cx + 1.5)) < .12).length);
      if (b.doors) for (const [k, m] of b.doors.slots) { maxHold[k] = Math.max(maxHold[k] ?? 0, m.size); maxHolders = Math.max(maxHolders, m.size); }
      if (b.units.every((u) => Math.hypot(u.x - goal.cx, u.z - goal.cz) < .5)) { arrivedAt = +(t / 30).toFixed(2); break; }
    }
    b.paused = true;
    return { radius: R, doorsOn: doors, start: start.id, goal: goal.id, cells: b.units.length, arrived: b.units.filter((u) => Math.hypot(u.x - goal.cx, u.z - goal.cz) < .5).length, arrivedAt, crossed: crossed.size, crossAt, insideMax, maxHolders, maxHoldByKey: maxHold, mouths, waits: b.doorStats.waits, waitFrames: b.doorStats.waitFrames, stalls: b.doorStats.stalls ?? 0, report: b.doorReport() };
  }, { R, doors });

  const wide = await runCase(.055, true);
  if (!(wide.report.on && wide.mouths.mouths >= 2)) throw Error('洞口没被识别 ' + JSON.stringify(wide.mouths));
  if (wide.arrived !== 6 || wide.crossed !== 6) throw Error('宽口没全员过洞 ' + JSON.stringify(wide));
  if (wide.maxHolders > 4) throw Error('宽口占用表异常 ' + wide.maxHolders);

  const big = await runCase(.12, true);
  if (big.arrived !== 6 || big.crossed !== 6) throw Error('大体型没全员过洞 ' + JSON.stringify(big));
  // 大体型（体径 .25）在真实岛的 0.29 窄口只剩 1 人：至少有一个洞口全程单列，且有人被拒
  const single = Object.values(big.maxHoldByKey).some((v) => v <= 1);
  if (!(big.waits >= 1 && single)) throw Error('大体型应在窄口单列排队 ' + JSON.stringify({ waits: big.waits, maxHoldByKey: big.maxHoldByKey }));

  const off = await runCase(.12, false);
  if (off.report.on) throw Error('关档后不该有占用表');
  if (!(off.waits === 0)) throw Error('关档不该有排队账 ' + JSON.stringify(off.waits));
  if (off.arrived !== 6) throw Error('关档对照没全员到达 ' + JSON.stringify(off.arrivedAt));

  const shot = async (rep, name) => {
    await p.evaluate((r) => {
      const el = document.createElement('div');
      el.style = 'position:fixed;left:16px;bottom:16px;z-index:60;background:#f7fbf4;padding:12px 14px;font:13px/1.5 system-ui;border-radius:10px;max-width:520px;white-space:pre-wrap';
      el.textContent = '洞口占用验收：' + JSON.stringify({ radius: r.radius, doorsOn: r.doorsOn, cap: r.maxHolders, waits: r.waits, waitFrames: r.waitFrames, insideMax: r.insideMax, arrivedAt: r.arrivedAt, crossAt: r.crossAt, mouths: r.mouths });
      document.body.appendChild(el);
    }, rep);
    await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(out, 'door-queue-' + name + '.png') });
  };
  await shot(wide, 'wide-r245');
  await shot(big, 'big-narrow-r245');

  fs.writeFileSync(path.join(out, 'door-queue-browser.json'), JSON.stringify({ wide, big, off, errors }, null, 2));
  await b.close();
  if (errors.length) throw Error(errors.join('\n'));
  console.log('PASS door-queue-browser', { wide: { waits: wide.waits, insideMax: wide.insideMax, t: wide.arrivedAt, cap: wide.mouths }, big: { waits: big.waits, maxHolders: big.maxHolders, t: big.arrivedAt, insideMax: big.insideMax }, off: { insideMax: off.insideMax, t: off.arrivedAt } });
})().catch((e) => { console.error(e); process.exit(1); });
