// 903647529203634176 · 刺击命中集 ↔ 伤害飘字 同源验收。
// 第 44 轮记的缺口是「伤害数字与每次刺击的命中集是两处实现未联动」：现在 battle.js 的 thrust 分支
// 先拿 stepSpearThrust 的 hits 数组，再逐个 #hit —— 掉血和飘字都从同一个数组派生。
// 这里不看代码"应该有"，而是逐帧读 damageStats 的联动度量 + 每个单位的真实掉血 + 飘字记录，对数：
//   ① 每一刺：lastThrustHits == 实际掉血的单位数 == 该刺产生的伤害飘字数（非致命时）；
//   ② 飘字数值 == damageValue(扣血前后) == 4（1 点血 = +4），且 unitId 就是被刺中那一个；
//   ③ 致命那一刺：飘字 = hits + kills（伤害 +4 与击杀 +10 各一条），击杀计数同步；
//   ④ 同一次刺击不会重复命中同一单位（命中集是 Set）。
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('http://localhost:8769/index.html?scene=badnorth&grid=quad');
    await page.waitForFunction(() => window.rea?.battle?.running);

    // —— 非致命一刺穿两人 ——
    const probe = await page.evaluate(async () => {
      const { beginSpearThrust } = await import('./src/core/spear-thrust.js');
      const b = rea.battle, w = b.world;
      const u = b.units.find((x) => x.squad?.pike);
      if (!u) throw Error('没有矛兵');
      const c = w.cells.find((c) => w.top(c) >= 1 && w.top(c) === w.ground(c) &&
        c.edgeNeighbors.every((id) => id >= 0 && w.top(w.cells[id]) === w.top(c)));
      if (!c) throw Error('没有平整格');
      b.nextWave = Infinity;
      u.x = c.cx; u.z = c.cz; u.y = w.top(c) * b.L; u.navFloor = w.top(c);
      u.cd = 100; u.thrust = null; u.spearRecovery = null; u.face = Math.PI / 2;
      // 敌人全程僵直：不会还手、不会走开，装配在整个刺击期间是静止的（僵直不影响被刺中）
      const foe = (uid, dx, hp) => ({ ...u, uid, squad: null, team: 1, x: u.x + dx, z: u.z, y: u.y, hp, max: 5, cd: 1e9, stunRemaining: 100, thrust: null, spearRecovery: null, brace: null });
      const a = foe(9001, .27, 5), d = foe(9002, .39, 5);
      b.units = [u, a, d]; b.paused = false;
      b.damageNumbers.length = 0; b.damageStats.spawned = 0; b.damageStats.kills = 0; b.damageStats.hitSet = 0; b.damageStats.thrustFrames = 0;

      u.thrust = beginSpearThrust(u, { x: 1, z: 0 }, { length: .44, duration: .18, targets: b.units });
      const frames = [];
      for (let i = 0; i < 6; i++) {
        b.update(.05);
        frames.push({
          t: +(i * .05 + .05).toFixed(2),
          hits: b.damageStats.lastThrustHits, popups: b.damageStats.lastThrustPopups,
          kills: b.damageStats.lastThrustKills, hitSet: b.damageStats.hitSet, thrustFrames: b.damageStats.thrustFrames,
          hpA: a.hp, hpB: d.hp,
          recs: b.damageNumbers.map((p) => ({ unitId: p.unitId, value: p.value, kind: p.kind, x: +p.x.toFixed(3), z: +p.z.toFixed(3) })),
        });
      }
      const after = { hpA: a.hp, hpB: d.hp, spawned: b.damageStats.spawned, hitSet: b.damageStats.hitSet, thrustFrames: b.damageStats.thrustFrames, kills: b.damageStats.kills };
      const posA = { x: a.x, z: a.z };

      // —— 致命一刺：只剩一个 1 血的敌人 ——
      const e = foe(9003, .27, 1);
      b.units = [u, e]; b.paused = false;
      u.thrust = null; u.spearRecovery = null; u.cd = 100;
      b.damageNumbers.length = 0; b.damageStats.spawned = 0; b.damageStats.kills = 0; b.damageStats.hitSet = 0; b.damageStats.thrustFrames = 0;
      u.thrust = beginSpearThrust(u, { x: 1, z: 0 }, { length: .44, duration: .18, targets: b.units });
      let lethal = null;
      for (let i = 0; i < 6; i++) {
        b.update(.05);
        if (b.damageStats.lastThrustHits) lethal = { hits: b.damageStats.lastThrustHits, popups: b.damageStats.lastThrustPopups, kills: b.damageStats.lastThrustKills, hp: e.hp, dead: !!e.dead, recs: b.damageNumbers.map((p) => ({ unitId: p.unitId, value: p.value, kind: p.kind })) };
      }
      // 截图用：再来一刺（非致命），把镜头压到单位跟前，让「+4」和矛一起入画
      const g = foe(9004, .27, 5);
      b.units = [u, g]; b.paused = false;
      u.thrust = null; u.spearRecovery = null; u.cd = 100;
      b.damageNumbers.length = 0; b.damageStats.spawned = 0;
      u.thrust = beginSpearThrust(u, { x: 1, z: 0 }, { length: .44, duration: .18, targets: b.units });
      for (let i = 0; i < 3; i++) b.update(.05);
      rea.view.setDebug('unitsprites', false);
      rea.view.target.set(u.x, u.y + .12, u.z);
      rea.view.distance = 1.9; rea.view.pitch = 1.05; rea.view.updateCamera();
      b.paused = true; b.update(0);
      const shot = { hpEnemy: g.hp, popups: b.damageNumbers.map((p) => ({ unitId: p.unitId, value: p.value, kind: p.kind })) };
      return { frames, after, posA, lethal, shot, damageStats: { ...b.damageStats } };
    });

    const f = probe.frames.filter((x) => x.hits > 0);
    const fail = (msg) => { throw new Error(msg + ' :: ' + JSON.stringify(probe)); };
    if (!f.length) fail('整条刺击没有任何命中，装配失效');
    const totalHits = probe.frames.reduce((s, x) => s + (x.hits || 0), 0);
    if (totalHits !== 2) fail('一刺穿过两人应恰好 2 次命中，实得 ' + totalHits);
    if (probe.after.hitSet !== totalHits) fail('hitSet 累计与逐帧命中之和不一致：' + probe.after.hitSet + ' vs ' + totalHits);
    if (probe.after.hpA !== 4 || probe.after.hpB !== 4) fail('两个敌人各应只掉 1 点血（同一刺不重复命中）：' + probe.after.hpA + '/' + probe.after.hpB);
    if (probe.after.spawned !== 2) fail('非致命两命中应产生 2 条飘字，实得 ' + probe.after.spawned);
    for (const x of f) if (x.popups !== x.hits) fail('该帧飘字数 ≠ 命中数：' + x.popups + ' vs ' + x.hits);

    const recs = f[f.length - 1].recs;
    const ids = new Set(recs.map((r) => r.unitId));
    if (recs.length !== 2) fail('飘字条数不对：' + recs.length);
    if (![...ids].every((i) => i === 9001 || i === 9002)) fail('飘字的 unitId 不是被刺中的那两个：' + [...ids]);
    if (!recs.every((r) => r.value === 4 && r.kind === 'damage')) fail('飘字数值/类型不对（1 点血应显示 +4）：' + JSON.stringify(recs));
    // 飘字坐标就是被命中单位的位置（同一事实源），不是攻击者位置
    for (const r of recs) {
      if (!(Math.abs(r.z - probe.posA.z) < 0.35)) fail('飘字没有落在敌人身上（z 偏太多）：' + r.z);
    }

    const L = probe.lethal;
    if (!L) fail('致命一刺没有命中');
    if (L.hits !== 1) fail('致命刺命中数应为 1：' + L.hits);
    if (L.popups !== L.hits + L.kills) fail('致命刺的飘字应 = 命中 + 击杀：' + L.popups + ' vs ' + (L.hits + L.kills));
    if (L.kills !== 1 || !L.dead || L.hp !== 0) fail('击杀计数/死亡状态不对：' + JSON.stringify(L));
    const kinds = L.recs.map((r) => r.kind + ':' + r.value).sort();
    if (!(kinds.length === 2 && kinds.includes('damage:4') && kinds.includes('kill:10'))) fail('致命刺应同时有 +4 与 +10：' + JSON.stringify(kinds));

    await page.screenshot({ path: 'artifacts/coverage/spear-hit-popup-quad.png' });
    if (errors.length) fail('页面报错：' + errors.join(' | '));
    const out = {
      frames: probe.frames, after: probe.after, lethal: L, shot: probe.shot,
      summary: {
        totalHits, hitSet: probe.after.hitSet, popups: probe.after.spawned,
        hpAfterA: probe.after.hpA, hpAfterB: probe.after.hpB,
        lethal: { hits: L.hits, popups: L.popups, kills: L.kills, kinds },
      },
    };
    fs.writeFileSync('artifacts/coverage/spear-hit-popup-browser.json', JSON.stringify({ ...out, errors }, null, 2));
    console.log('PASS spear hit-set ↔ damage popup 同源：', JSON.stringify(out.summary));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
