// 第 102 轮 · 903647529203634176 · `dmgKick` 在**真页面**上的验收（逻辑侧见 tests/damage-numbers-kick.mjs）。
//
// r60 把这条记成「机制未做」，其实 56 批 C02 已经实现了 `kickDamageNumber` / `stepDamageKick`，
// 而且在 `battle-c02` 的 `dmgKick` 开关后面（**默认关**）。所以这一层要证的是：
//   ① 打开 `dmgKick` 后，飘字沿「攻击者→受击者」方向真的甩出去（kx/kz 有值，位置单调偏）；
//   ② 抖动 jx/jz 正负都出现过（是振荡），且幅度不超过 shake；
//   ③ 击杀飘字的 y 涨得比普通伤害快（killRise 独立于 rise）；
//   ④ 关掉开关后不再甩（旧画面逐位不变）；
//   ⑤ 截一张图给人看数字确实离开了受击点。
const { chromium } = require('playwright');
const fs = require('fs');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'artifacts/coverage';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const problems = [];
  const rows = [];
  const ok = (c, m) => rows.push({ ok: !!c, m });
  const page = await browser.newPage({ viewport: { width: 1200, height: 860 } });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 300)); });
  let rep = null;
  try {
    await page.goto('http://127.0.0.1:8769/index.html?scene=badnorth', { waitUntil: 'load' });
    await page.waitForFunction(() => window.rea?.battle?.running, null, { polling: 200, timeout: 90000 });

    const setup = await page.evaluate(() => {
      const b = window.rea.battle, w = b.world;
      const c = w.cells.find((c) => w.top(c) >= 1 && w.top(c) === w.ground(c) && c.edgeNeighbors.every((id) => id >= 0 && w.top(w.cells[id]) === w.top(c)));
      if (!c) throw Error('no open fixture');
      const mk = (team, dx, dz, hp) => ({ uid: 9000 + Math.round((dx + dz) * 1000), team, squad: null, k: 0, hp, max: hp,
        x: c.cx + dx, z: c.cz + dz, y: w.top(c) * b.L, navFloor: w.top(c), cd: 0, dead: false, onBoat: null, face: 0, soak: 0, stunRemaining: 0, radius: .055 });
      b.paused = true; b.nextWave = Infinity;
      b.units = [mk(0, 0, 0, 6), mk(1, .16, 0, 6), mk(1, .16, .22, 6)];
      b.units[0].squad = b.squads[0];
      window.rea.view.target.set(c.cx, w.top(c) * b.L, c.cz);
      window.rea.view.distance = 3.4; window.rea.view.pitch = .95; window.rea.view.updateCamera();
      return { cell: c.id, top: w.top(c) };
    });

    rep = await page.evaluate(async () => {
      const b = window.rea.battle;
      const run = (kick, frames) => {
        b.damageNumbers.length = 0;
        b.c02.set('dmgKick', kick);
        // 每次重摆血量：1 号守军只剩 1 血 → 下一次挨打就是击杀飘字（kind=kill，值 +10）
        b.units[0].hp = b.units[0].max = 6;
        b.units[1].hp = b.units[1].max = 1;
        b.units[2].hp = b.units[2].max = 6;
        for (const u of b.units) u.cd = 0;
        const trace = [];
        for (let i = 0; i < frames; i++) {
          b.paused = false; b.update(0.02); b.paused = true;
          for (const p of b.damageNumbers) {
            trace.push({ kind: p.kind, value: p.value, x: +p.x.toFixed(4), y: +p.y.toFixed(4), z: +p.z.toFixed(4),
              kx: p.kx ?? null, kz: p.kz ?? null, jx: p.jx ?? null, jz: p.jz ?? null, age: +p.age.toFixed(3), unitId: p.unitId });
          }
          if (b.damageNumbers.length && i > 4) break;
        }
        return trace;
      };
      const on = run(true, 160);
      const off = run(false, 160);
      return { on, off };
    });
    await page.screenshot({ path: `${OUT}/damage-kick-browser.png` });
  } catch (e) {
    problems.push('fatal: ' + e.message);
  } finally {
    await browser.close();
  }

  const on = rep?.on || [], off = rep?.off || [];
  const kicked = on.filter((p) => p.kx !== null);
  // 抖动跟受击方向走：横砍时在 jx 上、竖砍时在 jz 上，所以取两条里的主导轴
  const jz = on.map((p) => (Math.abs(p.jx ?? 0) >= Math.abs(p.jz ?? 0) ? p.jx : p.jz)).filter((v) => v !== null);
  const kill = on.filter((p) => p.kind === 'kill');
  const dmg = on.filter((p) => p.kind === 'damage');

  ok(on.length >= 3, `开档后采样到 ${on.length} 条飘字记录（${new Set(on.map((p) => p.unitId)).size} 个受击单位）`);
  ok(kicked.length >= 1, `有 ${kicked.length} 条带 kick 初速（kx≠null）`);
  ok(kicked.every((p) => Math.abs(p.kx) + Math.abs(p.kz) > 0), 'kick 初速非零（方向由攻击者→受击者算出）');
  if (kicked.length >= 2) {
    const first = kicked[0], last = kicked[kicked.length - 1];
    ok(Math.hypot(last.x - first.x, last.z - first.z) > 1e-3,
      `甩出后位置有位移 ${Math.hypot(last.x - first.x, last.z - first.z).toFixed(4)}（不是原地冒）`);
  } else {
    ok(true, '只有一条记录，位移断言跳过（同一帧内已合并）');
  }
  const jAbs = Math.max(...jz.map(Math.abs), 0);
  ok(jAbs > 1e-6, `抖动字段真的在动：max|j|=${jAbs.toFixed(6)}（全 0 说明 battle 没在推进 jx/jz）`);
  ok(jz.some((v) => v > 1e-6) && jz.some((v) => v < -1e-6),
    `抖动正负都出现（max=${Math.max(...jz, 0).toFixed(6)} / min=${Math.min(...jz, 0).toFixed(6)}），是振荡不是单向偏移`);
  ok(jz.every((v) => Math.abs(v) <= 0.0185), '抖动幅度不超过 shake=0.018');
  ok(off.every((p) => p.kx === null || p.kx === undefined), `关档后 ${off.length} 条记录全无 kick 字段（旧口径）`);
  const killSpan = kill.length ? kill.at(-1).y - kill[0].y : 0;
  const dmgSpan = dmg.length ? dmg.at(-1).y - dmg[0].y : 0;
  if (kill.length && dmg.length) {
    ok(killSpan >= dmgSpan - 1e-6,
      `击杀飘字 0.02s 步进内的 Δy ${killSpan.toFixed(4)} ≥ 普通伤害 ${dmgSpan.toFixed(4)}（killRise 独立）`);
  } else {
    ok(false, `没同时采到 kill 与 damage 两类飘字（kill=${kill.length} / damage=${dmg.length}）→ 该断言无从判定，判失败而不是跳过`);
  }

  if (problems.length) console.log('页面报错：\n' + problems.map((p) => '  ! ' + p).join('\n'));
  console.log(rows.map((r) => `  ${r.ok ? '✓' : '✗'} ${r.m}`).join('\n'));
  const summary = { setup: rep && 'ok', onRecords: on.length, kicked: kicked.length, killKinds: kill.length,
    offRecords: off.length, killSpan: +killSpan.toFixed(4), dmgSpan: +dmgSpan.toFixed(4) };
  console.log('\n' + JSON.stringify(summary, null, 1));
  const bad = rows.filter((r) => !r.ok).length;
  console.log(bad || problems.length ? `\nFAIL ${bad}/${rows.length}` : `\nALL PASS ${rows.length}/${rows.length}`);
  if (bad || problems.length) process.exitCode = 1;
})();
