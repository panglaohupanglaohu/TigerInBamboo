// 第 88 轮 · 天光柱的**单位版**（912691357440978945 那根）：柱挂在单位本人身上，不是旗顶。
// 判据数字全部来自全片扫描（见 battle-c01.js 里 SKY_BEAM_UNIT / SKY_BEAM_UNIT_STEPS 的注释）：
//   窗1 0275–0294（20 帧 = 0.614s）柱心 x 315→266 单调左移、宽 16–17px、线芯 (230,228,197)
//   窗2 0669–0686（18 帧 = 0.553s）x 恒 297–312、宽 17–18px
//   第 97 轮：逐帧净计数重扫 → 寿命是 0.60s（r91 的「各 15 帧」是硬阈值把淡入淡出帧切掉了）；
//            且不透明度是**拱形包络**（0.38→1.00→0），不是「恒定 0.92 + 末段线性」。
// 这里只锁「口径 + 触发 + 跟随 + 与旗顶版并存 + 可逆 + 包络形状」，不做像素比对（那是浏览器测试的事）。
import assert from 'node:assert/strict';
import { makeIsland, Battle, THREE } from './fixtures/g5-battle.mjs';
const { SKY_BEAM, SKY_BEAM_UNIT, SKY_BEAM_UNIT_STEPS, beamFade, beamFadeUnit } = await import('../src/badnorth/battle-c01.js');

const log = [];
const ok = (name, detail) => log.push(`PASS ${name}${detail ? ' — ' + detail : ''}`);

// ── ① 两套口径都落在帧量测区间里，且**互不相同**（不是把旗顶那根换个名字复用）
{
  const ratio = SKY_BEAM_UNIT.width / SKY_BEAM.width;
  assert.ok(Math.abs(ratio - 3.6 / 6.3) < 0.06, `单位版窄一档：${ratio.toFixed(2)} vs 帧比 3.6%/6.3%=0.57`);
  assert.ok(SKY_BEAM_UNIT.life >= 0.55 && SKY_BEAM_UNIT.life <= 0.65, '寿命覆盖 20/18 帧 = 0.614s/0.553s（两窗净计数）');
  assert.ok(SKY_BEAM_UNIT.life > SKY_BEAM.life * 2.3, '比旗顶版（0.22s）活得久得多');
  assert.equal(new THREE.Color(SKY_BEAM_UNIT.color).getHexString(), 'e6e4c5', '淡奶油 #E6E4C5 ≠ 旗顶版 #F0FA90');
  assert.notEqual(SKY_BEAM_UNIT.color, SKY_BEAM.color);
  assert.equal(SKY_BEAM_UNIT.baseLift, 1.0, '柱底悬在单位上方 1 单位（帧里约 55–60px，不接触地面也不停在旗顶）');
  assert.ok(SKY_BEAM_UNIT.height >= 20, '同样捅破上缘');
  // 拱形包络（912 逐帧 α）：起手就半亮 → 0.12s 满 → 中段持平 → 末端衰减到 0
  assert.ok(beamFadeUnit(0) > 0.3 && beamFadeUnit(0) < 0.5, '起手不是 0 也不是满亮（首帧实测 0.38）');
  assert.ok(beamFadeUnit(0.12) > 0.97, '0.12s 到满亮');
  assert.ok(Math.abs(beamFadeUnit(0.27) - 0.97) < 0.03, '中段仍接近满亮');
  assert.ok(beamFadeUnit(0.48) > 0.4 && beamFadeUnit(0.48) < 0.65, '0.48s 掉到 ~0.52');
  assert.equal(beamFadeUnit(SKY_BEAM_UNIT.life), 0, '表尾归零');
  assert.equal(beamFadeUnit(9), 0, '超寿命 = 0');
  // 单调性：淡入段（0→0.12s）不降；末端（0.36→0.60s）不升（防止改表时插错点）
  let prev = beamFadeUnit(0);
  for (let t = 0.02; t <= 0.12 + 1e-9; t += 0.02) { const v = beamFadeUnit(t); assert.ok(v >= prev - 1e-9, '淡入段单调不降 t=' + t.toFixed(2)); prev = v; }
  prev = beamFadeUnit(0.36);
  for (let t = 0.40; t <= 0.60 + 1e-9; t += 0.02) { const v = beamFadeUnit(t); assert.ok(v <= prev + 1e-9, '淡出段单调不升 t=' + t.toFixed(2)); prev = v; }
  assert.equal(SKY_BEAM_UNIT_STEPS[0][1], 0.38);
  // 旗顶那根仍走自己的阶梯表（两套不能混）
  assert.equal(beamFade(0, SKY_BEAM.life), 1);
  assert.equal(beamFade(SKY_BEAM.life, SKY_BEAM.life), 0);
  ok('SKY_BEAM_UNIT 口径', `w=${SKY_BEAM_UNIT.width} life=${SKY_BEAM_UNIT.life} color=${SKY_BEAM_UNIT.color}`);
}

// ── ② 关着的时候命中不起柱（默认关，不能偷偷改玩法观感）
{
  const { world, view } = makeIsland('quad', 7);
  const b = new Battle(view); b.start(world);
  const C = b.c01;
  assert.equal(C.on.skyBeam, false, '默认关');
  const u = b.squads[0].members[0];
  b.applyHit(u, null);
  assert.equal(C.beams.length, 0, '关着 → 挨打不起柱');
  ok('默认关 / 关着不响应命中');
}

// ── ③ 打开后挨打 → 一根单位柱：底 = 单位位置 + baseLift、宽 0.18、色 #e6e4c5
//    第 90 轮：受击自动挂钩默认关，这条几何判据显式打开 setBeamOnHit(true) 再打（口径不变）
{
  const { world, view } = makeIsland('quad', 7);
  const b = new Battle(view); b.start(world);
  const C = b.c01; C.set('skyBeam', true); C.setBeamOnHit(true);
  const u = b.squads[0].members[0];
  u.y = 1.5;   // 站在二层台地上，别让默认 0 让「底=单位+lift」变成空断言
  b.applyHit(u, null);
  assert.equal(C.beams.length, 1, '一根');
  const rec = C.beams[0];
  assert.equal(rec.kind, 'unit', 'kind=unit（与旗顶版分开）');
  assert.equal(rec.followUnit, u, '跟的是单位本人');
  assert.ok(Math.abs(rec.mesh.position.x - u.x) < 1e-9 && Math.abs(rec.mesh.position.z - u.z) < 1e-9, '底点 x/z = 单位');
  assert.ok(Math.abs(rec.mesh.position.y - (u.y + SKY_BEAM_UNIT.baseLift)) < 1e-9, '底点 y = 单位 y + 1.0');
  assert.equal(rec.bar.scale.x, SKY_BEAM_UNIT.width);
  assert.equal(rec.bar.scale.y, SKY_BEAM_UNIT.height);
  assert.equal(rec.bar.material.color.getHexString(), 'e6e4c5');
  b.update(1 / 60);
  assert.equal(C.stats.beamUnits, 1);
  assert.equal(C.stats.beamUnitWidth, 0.18);
  assert.equal(C.stats.beamUnitColor, '#e6e4c5');
  assert.ok(Math.abs(C.stats.beamUnitBaseY - (u.y + 1.0)) < 1e-2, 'stats 单位柱底 = ' + C.stats.beamUnitBaseY);
  ok('命中 → 单位柱几何', `base=${C.stats.beamUnitBaseY} w=${C.stats.beamUnitWidth}`);
}

// ── ④ 跟着单位走（0277–0289 的 x 309→276 = 追着走动中的目标）
// battle.update 每帧重算单位位置，所以「手动挪」会被覆盖 → 只断言不变量 + 证明单位真的动过。
{
  const { world, view } = makeIsland('quad', 7);
  const b = new Battle(view); b.start(world);
  const C = b.c01; C.set('skyBeam', true);
  const sq = b.squads[0], u = sq.members[0];
  b.nextWave = 1e9;
  C.unitBeam(u, { life: 3 });   // 跨 30 帧要放宽寿命；走的是同一条代码路径
  const p0 = C.beams[0].mesh.position.clone();
  let worst = 0, drift = 0;
  for (let k = 0; k < 30; k++) {
    b.update(1 / 30);
    const p = C.beams[0]?.mesh.position; if (!p) break;
    worst = Math.max(worst, Math.hypot(p.x - u.x, p.z - u.z), Math.abs(p.y - (u.y + SKY_BEAM_UNIT.baseLift)));
    drift = Math.max(drift, Math.hypot(p.x - p0.x, p.z - p0.z));
  }
  assert.ok(worst < 1e-9, '每帧底点 = 当前单位位置 + 1.0（误差 ' + worst.toExponential(1) + '）');
  assert.ok(drift > 1e-6, '单位确实走动过，否则这个不变量是空的 drift=' + drift.toFixed(3));
  ok('跟随单位', `drift=${drift.toFixed(3)} 误差=${worst.toExponential(1)}`);
}

// ── ⑤ 0.60s 后自己消失；起手半亮、0.12s 满亮（第 97 轮：拱形包络，不再是「刚起满亮」）
{
  const { world, view } = makeIsland('quad', 7);
  const b = new Battle(view); b.start(world);
  const C = b.c01; C.set('skyBeam', true);
  const u = b.squads[0].members[0];
  C.unitBeam(u);
  const rec = C.beams[0], kids = C.group.children.length;
  b.update(1 / 60);
  const early = rec.bar.material.opacity;
  assert.ok(early > 0.3 && early < 0.55, '起手半亮（实测首帧 α≈0.38）opacity=' + early.toFixed(2));
  for (let i = 0; i < 7; i++) b.update(1 / 60);    // ≈0.133s
  const full = rec.bar.material.opacity;
  assert.ok(full > 0.85, '0.13s 后接近满亮 opacity=' + full.toFixed(2));
  for (let i = 0; i < 29; i++) b.update(1 / 60);   // ≈0.617s > life 0.60
  assert.equal(C.beams.length, 0, '过期移除');
  assert.equal(C.group.children.length, kids - 1, 'group 里少一个');
  ok('单位柱 0.60s 自动回收');
}

// ── ⑥ 目标死了就收柱（片子里没有对着空地 / 尸体的柱）
{
  const { world, view } = makeIsland('quad', 7);
  const b = new Battle(view); b.start(world);
  const C = b.c01; C.set('skyBeam', true);
  const u = b.squads[0].members[0];
  C.unitBeam(u);
  u.dead = true;
  b.update(1 / 60);
  assert.equal(C.beams.length, 0, '死即收');
  ok('单位死亡即收柱');
}

// ── ⑦ 两套口径并存：下令起旗顶柱 + 挨打起单位柱 → 两根，各自数不同，互不覆盖
{
  const { world, view } = makeIsland('quad', 7);
  const b = new Battle(view); b.start(world);
  const C = b.c01; C.set('skyBeam', true); C.setBeamOnHit(true);
  const sq = b.squads[0], u = sq.members[1];
  C.onMove(sq, {});
  b.applyHit(u, null);
  assert.equal(C.beams.length, 2, '两根同时存在');
  const kinds = C.beams.map((p) => p.kind).sort();
  assert.deepEqual(kinds, ['flag', 'unit']);
  const flag = C.beams.find((p) => p.kind === 'flag'), unit = C.beams.find((p) => p.kind === 'unit');
  assert.equal(flag.width, SKY_BEAM.width);
  assert.equal(unit.width, SKY_BEAM_UNIT.width);
  assert.ok(Math.abs(flag.mesh.position.y - (sq.flag.position.y + SKY_BEAM.baseLift)) < 1e-9, '旗顶柱口径没被改坏');
  assert.ok(Math.abs(unit.mesh.position.y - (u.y + SKY_BEAM_UNIT.baseLift)) < 1e-9);
  ok('旗顶版 / 单位版并存', `flag w=${flag.width} · unit w=${unit.width}`);
}

// ── ⑧ 船上的单位不落柱（912 那两根都在陆上；船上是另一个镜头口径）
// 直接打 c01.onHit（battle.applyHit 会顺带跑 #bleed，船上没有真 mesh，夹具里会炸 —— 与本判据无关）
{
  const { world, view } = makeIsland('quad', 7);
  const b = new Battle(view); b.start(world);
  const C = b.c01; C.set('skyBeam', true);
  const u = b.squads[0].members[0];
  // 第 90 轮：受击自动挂钩默认关（912 frame-0695 = 有火有伤害数字但没柱的反例）
  assert.equal(C.onHit(u), null, '默认不自动起柱');
  assert.equal(C.beams.length, 0, '默认不落柱');
  C.setBeamOnHit(true);
  u.onBoat = {};
  assert.equal(C.onHit(u), null, '船上返回 null');
  assert.equal(C.beams.length, 0, '船上不起柱');
  u.onBoat = null;
  assert.ok(C.onHit(u), '下船后同一发命中就能起柱（显式开自动后）');
  C.setBeamOnHit(false);
  assert.equal(C.onHit(u), null, '关掉后不再自动起柱');
  ok('受击自动挂钩默认关 + 船上跳过');
}

// ── ⑨ start/stop 清干净，stats 复位
{
  const { world, view } = makeIsland('quad', 7);
  const b = new Battle(view); b.start(world);
  const C = b.c01; C.set('skyBeam', true);
  C.unitBeam(b.squads[0].members[0]);
  b.stop();
  assert.equal(C.beams.length, 0, 'stop 清空');
  b.start(world);
  assert.equal(C.beams.length, 0, 'start 不残留');
  assert.equal(C.stats.beamUnits, 0, 'stats 复位');
  ok('start/stop 无残留');
}

console.log(log.join('\n'));
console.log(`\n${log.length} 项全过`);
