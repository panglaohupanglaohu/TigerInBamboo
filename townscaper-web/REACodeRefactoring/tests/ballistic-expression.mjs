// 第 53 批 G5 · 987267068495003648「Using inspector expressions, I can live tweak the cost function of my projectile
// trajectory lookup tables」。原 REACode/src/ballistic.js：Cost / Valid 两条表达式字符串 + 烘好的（带阻力）轨迹表 + 候选扇子。
// 验：表达式白名单报错、Cost 与 Valid 各自独立生效、阻力让同速同角射程变短且积分器在 drag=0 时对上解析解、
//     现场改 Cost 字符串最优弧会换、真实 Battle 里弓手用带阻力的表射中维京人（箭按烘好折线飞，水平速度逐渐变慢）。
import assert from 'node:assert/strict';
import { stripWorld, makeView, Battle, THREE } from './fixtures/g5-battle.mjs';
import { compileBallisticExpr, createExpressionBallisticTable, bakeBallisticArc, projectileState, PROJECTILE_GRAVITY as G } from '../src/core/ballistic-table.js';

// ① 表达式：白名单 + 布尔原样放行 + 打错字报错
assert.equal(compileBallisticExpr('minDist < 0.2')({ minDist: .1 }), true);
assert.equal(compileBallisticExpr('minDist + time * impactSpeed')({ minDist: 1, time: 2, impactSpeed: 3 }), 7);
assert.equal(compileBallisticExpr('Math.abs(angleDeg - 45)')({ angleDeg: 30 }), 15);
for (const bad of ['min-dist < 2', 'window.alert(1)', 'minDist; x=1', 'globalThis', '(()=>1)()']) assert.throws(() => compileBallisticExpr(bad), bad);

// ② 积分器：drag=0 对上解析射程（带落地插值误差 <1%）；drag>0 同速同角更短
const v = 7, ang = 35, flat = bakeBallisticArc({ speed: v, angleDeg: ang, drag: 0, minY: -1e-9 });
const exact = v * v * Math.sin(2 * ang * Math.PI / 180) / G;
assert.ok(Math.abs(flat.range - exact) / exact < .01, `无阻力射程 ${flat.range.toFixed(3)} vs ${exact.toFixed(3)}`);
const dragged = bakeBallisticArc({ speed: v, angleDeg: ang, drag: 1, minY: -1e-9 });
assert.ok(dragged.range < flat.range * .8, '阻力让射程明显变短');

// ③ Cost / Valid 独立：同一张表换 Valid 只改「能不能用」，换 Cost 只改排序
const base = createExpressionBallisticTable({ drag: .8, speedSteps: 21, angleSteps: 19 });
const strict = createExpressionBallisticTable({ drag: .8, speedSteps: 21, angleSteps: 19, validExpr: 'minDist < 0.06 && apex < 0.6' });
const lob = createExpressionBallisticTable({ drag: .8, speedSteps: 21, angleSteps: 19, costExpr: '-apex' });
const target = [3.2, .3];
const cb = base.candidates(...target, 4000), cs = strict.candidates(...target, 4000), cl = lob.candidates(...target, 4000);
assert.equal(cb.length, cs.length, '同一批弧都在半径内');
assert.ok(cs.filter((c) => c.ok).length < cb.filter((c) => c.ok).length && cs.filter((c) => c.ok).length > 0, 'Valid 收紧只减少合法弧');
assert.ok(cs.filter((c) => c.ok).every((c) => base.arcs[c.arcId].apex < .6));
const sb = base.lookup(...target), sl = lob.lookup(...target), sst = strict.lookup(...target);
assert.ok(sb && sl && sst);
assert.notEqual(sb.arcId, sl.arcId, '改 Cost 字符串 → 最优弧换了一条（live tweak）');
assert.ok(lob.arcs[sl.arcId].apex > base.arcs[sb.arcId].apex + .3, 'Cost=-apex 选高抛');
for (const s of [sb, sl, sst]) { const e = s.sample(s.time); assert.ok(Math.hypot(e.h - target[0], e.y - target[1]) < .06, '最近点落在 Valid 半径内'); }
let reach = 0, total = 0;
for (let dx = .4; dx < 5; dx += .41) for (let dy = -1.2; dy < 1.3; dy += .37) { total++; const s = base.lookup(dx, dy); if (s) { reach++; const e = s.sample(s.time); assert.ok(Math.hypot(e.h - dx, e.y - dy) < .06); } }
assert.ok(reach / total > .95, `覆盖率 ${reach}/${total}`);
assert.equal(base.lookup(NaN, 0), null); assert.equal(base.lookup(9, 0), null);

// ④ 真实 Battle：弓手 + 维京人，换带阻力的表；箭沿烘好折线飞并命中
const S = stripWorld(9, 1); for (const c of S.cells) S.world.fill(c, 1, { rock: true });
const b = new Battle(makeView(S.world, S.index)); b.start(S.world); b.nextWave = 1e9;
b.projectileTable = base;
const squad = { id: 2, archer: true, members: [], alive: true, goal: S.at(1, 0), goalFloor: 1 };
const archer = { uid: 1, team: 0, squad, k: 0, hp: 3, max: 3, x: 1, z: 0, y: .5, navFloor: 1, cd: 0, dead: false, onBoat: null, face: 0, soak: 0, radius: .055 };
const vik = { uid: 2, team: 1, squad: null, k: 0, hp: 2, max: 2, x: 4.2, z: 0, y: .5, navFloor: 1, cd: 99, dead: false, onBoat: null, face: 0, soak: 0, radius: .055, stunRemaining: 9 };
squad.members.push(archer); b.units = [archer, vik]; b.squads = [];
const xs = []; let hits = 0;
for (let i = 0; i < 240 && !hits; i++) {
  vik.stunRemaining = 9; vik.x = 4.2; vik.z = 0;   // 靶子不动（僵直、钉住），只看弹道
  b.update(1 / 60);
  const a = b.arrows[0]; if (a && !a.stuck) xs.push(a.mesh.position.x);
  if (vik.hp < 2) hits++;
}
assert.ok(b.arrows.length >= 1 && typeof b.arrows[0].shot.sample === 'function', '箭用的是烘表 shot');
assert.equal(hits, 1, '带阻力的表射中了');
const dv = xs.slice(1).map((x, i) => x - xs[i]).filter((d) => d > 0);
assert.ok(dv.length > 8 && dv.at(-1) < dv[0] * .9, `阻力：水平步长逐帧变短 ${dv[0].toFixed(4)} → ${dv.at(-1).toFixed(4)}`);
// 默认表（无阻力解析）走同一个求位置函数，结果与旧公式一致
const shot = { v: 6, th: .6, time: .9 }, ps = projectileState([0, 1, 0], [3, 0, 4], shot, .45);
assert.ok(Math.abs(ps.x - 1.5) < 1e-12 && Math.abs(ps.z - 2) < 1e-12 && Math.abs(ps.y - (1 + 6 * Math.sin(.6) * .45 - .5 * G * .45 * .45)) < 1e-12);
console.log('PASS 表达式白名单/布尔、Cost 与 Valid 独立、阻力积分、live tweak 换弧、候选扇子、真实 Battle 带阻力命中', JSON.stringify({ arcs: base.stats.arcs, reach: `${reach}/${total}`, best: sb.arcId, lob: sl.arcId, firstStep: +dv[0].toFixed(4), lastStep: +dv.at(-1).toFixed(4) }));
