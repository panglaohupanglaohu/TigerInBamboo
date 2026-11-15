// 苔庭守军 = 原罗马方阵映射成 REA 守军小队（2026-11-09，规划 §4.2 方案 A）。
// 原方阵（world/saihojiPhalanx.js，圣城红衣驻军）实测 28 人：港口巡逻长矛兵 12（harbor-patrol-soldier）、盾剑兵 12（gladius-soldier）、长弓手 4（longbow-soldier）。
// 维京人来犯时：REA 默认的 3 队守军退场；按原方阵各兵种的人数和站位，用 battle.spawnSquad 编成 REA 小队：
//   长矛 → pike（REA spear-thrust 突刺击退）、盾剑 → 步兵、长弓 → archer（REA 弹道表），穿罗马红（u.bodyColor）+ tier 1 灰铜盔。
// REA 接管期间原方阵的士兵模型先隐藏（同一批人不画两遍），战斗结束 restore() 原样显示。
import * as THREE from 'three';

const ROLES = [
  { test: (o) => /^harbor-patrol-soldier/.test(o.name), squad: { pike: true }, per: 12 },   // 长矛兵按士兵本身的名字认（盾剑、长弓兵身上也挂着长矛装备，按装备认会全算成长矛）
  { test: (o) => /^gladius-soldier/.test(o.name), squad: {}, per: 12 },
  { test: (o) => /^longbow-soldier/.test(o.name), squad: { archer: true }, per: 8 },
];
const soldierOf = (o) => { for (let p = o; p; p = p.parent) if (/soldier/.test(p.name) && p.parent && !/soldier/.test(p.parent.name)) return p; return o; };

// 方阵实测在高山圣城（citadel-red-garrison，离圣城 83 m、离苔庭 273 m）；苔庭的罗马方阵只在它自己的苔庭战触发时坐运兵船来。
// 所以：圣城战 = 原地接管这支红衣驻军（站位用他们自己的，原模型隐藏）；苔庭战 = 按同样编制在 REA 守军集结点上编成（不隐藏任何模型）。
export function romanizeMossDefenders(stage, phalanxRoot, { hideOriginals = null } = {}) {
  const b = stage.battle, inv = stage.anchor.matrixWorld.clone().invert(), hidden = [], report = [];
  if (!phalanxRoot) return { restore() {}, report: ['没找到罗马方阵'] };
  // 1. REA 默认守军退场
  const spots = b.squads.map((sq) => sq.goal).filter(Boolean);
  for (const sq of b.squads) { sq.alive = false; sq.flag.visible = false; if (sq.flag.userData.cloth) sq.flag.userData.cloth.visible = false; for (const u of sq.members) u.left = true; }
  b.units = b.units.filter((u) => !u.left); b.squads.length = 0;
  // 2. 按兵种取原方阵士兵（世界位置 → 舞台局部 → 最近陆地格）
  const v = new THREE.Vector3();
  const cellNear = (x, z) => { let best = null, bd = 1e9; for (const c of stage.grid.cells) { if (stage.world.top(c) < 1) continue; const d = Math.hypot(c.cx - x, c.cz - z); if (d < bd) { bd = d; best = c; } } return best; };
  for (const role of ROLES) {
    const men = []; phalanxRoot.traverse((o) => { if (role.test(o)) { const s = soldierOf(o); if (!men.includes(s) && s.visible) men.push(s); } });
    if (!men.length) continue;
    const pts = men.map((m) => stage.worldToStage(m.getWorldPosition(v), new THREE.Vector3()));   // 贴球舞台坐标
    const inStage = pts.filter((p) => Math.hypot(p.x, p.z) < stage.grid.cells.length ** 0.5).length > pts.length / 2;   // 大多数人在舞台范围内 = 原地接管
    const own = hideOriginals ?? inStage;
    for (let k = 0; k < men.length; k += role.per) {
      const group = pts.slice(k, k + role.per), cx = group.reduce((s, p) => s + p.x, 0) / group.length, cz = group.reduce((s, p) => s + p.z, 0) / group.length;
      const cell = own ? cellNear(cx, cz) : spots[(k / role.per + report.length) % Math.max(1, spots.length)]; if (!cell) continue;
      b.spawnSquad({ cell, size: group.length, tier: 1, bodyColor: '#9e2f2a', ...role.squad });
    }
    if (own) for (const m of men) { hidden.push(m); m.visible = false; }
    report.push(`${role.squad.pike ? '长矛' : role.squad.archer ? '长弓' : '盾剑'} ${men.length}${own ? '（原地接管）' : '（按编制）'}`);
  }
  return { report, restore() { for (const m of hidden) m.visible = true; hidden.length = 0; } };
}
