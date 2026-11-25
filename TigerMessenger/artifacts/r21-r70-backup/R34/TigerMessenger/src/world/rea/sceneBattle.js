// 场景战役入口（2026-11-16）：把 Bad North 玩法层接到任意已注册场景上。
// 复用 reaBattleStage.js（采样实景地形 → REA World → Battle 原逻辑），本文件只负责
// 选场景、起舞台、驱动 update。
//   ?battleAt=apostles   在十二门徒岩群开战（默认）
//   ?battleAt=moss       在苔庭开战
//   ?battleScale=4       舞台 1 单位 = 多少米（默认按场景尺寸自动）
//   ?battleRadius=20     REA 网格半径（格）
//
// 工坊生命周期（pipeline-bridge 的 battle.* 命令）：
//   battle.probe    只采样不交战：起舞台、报 land/houses/maxLevel 供 Worker 扫描
//   battle.preview  按工坊算出的作战计划真开战（候选预览）
//   battle.compare  隐藏 / 显示战斗图层（对照原场景）
//   battle.revert   放弃候选：停战并拆除舞台
//   battle.commit   采用：战斗继续，计划存本机，下次进游戏自动部署
//   battle.state    实况快照（波次 / 单位 / 小屋）
import * as THREE from 'three';
import { ReaBattleStage, SOLDIER_HEIGHT_M } from './reaBattleStage.js';

// 各场景的舞台尺度：岩群柱子直径约二三十米，苔庭是低平小岛，圣城是密集城郭
const PRESETS = {
  apostles: { scale: 5, gridRadius: 18 },
  moss: { scale: 6, gridRadius: 16 },
  citadel: { scale: 8, gridRadius: 14 },
  bookshop: { scale: 4, gridRadius: 18 },
};
export const BATTLE_SCENES = Object.keys(PRESETS);
const ADOPT_KEY = (id) => `tm.battle.adopted.v1:${id}`;

let loopAlive = false;
/** 独立 rAF 驱动舞台 update（不改主循环）；波次间隔按计划收紧（REA 原逻辑 26s 一波，这里只压不放松） */
function ensureLoop() {
  if (loopAlive) return; loopAlive = true;
  let last = performance.now(), frames = 0, lastWave = 0;
  const loop = () => {
    const st = globalThis.__tmBattleStage;
    if (!st) { loopAlive = false; return; }
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    try {
      const iv = st.plan?.waves?.interval;
      if (iv && st.battle?.wave !== lastWave) { lastWave = st.battle.wave; if (lastWave) st.battle.nextWave = Math.min(st.battle.nextWave, st.battle.t + iv); }
      else if (iv && st.battle && st.battle.t + iv < st.battle.nextWave) st.battle.nextWave = st.battle.t + iv;
      st.update(dt);
    } catch (e) { console.warn('[sceneBattle] update', e); }
    frames++;
    if (frames % 600 === 0) console.log('[sceneBattle]', st.sceneId, JSON.stringify(snapshot()));
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function snapshot() {
  const st = globalThis.__tmBattleStage, b = st?.battle;
  if (!st || !b) return { stage: false };
  const units = b.units || [];
  return {
    stage: true, running: st.running, t: +((b.t || 0).toFixed(1)), wave: b.wave,
    units: units.length, alive: units.filter((u) => !u.dead).length,
    vikings: units.filter((u) => u.team === 1 && !u.dead).length,
    defenders: units.filter((u) => u.team === 0 && !u.dead).length,
    boats: (b.boats || []).length, houses: (b.houses || []).length,
    housesLost: (b.houses || []).filter((h) => h.lost).length,
    plan: st.plan || null,
  };
}

/** 采样：建舞台但不交战。已有同场景舞台直接复用；参数变了重建。 */
export function probeSceneBattle({ scene, camera, id = 'apostles', scale = null, gridRadius = null, unitHeight = null } = {}) {
  const t = globalThis.__tmSceneTargets?.().find((x) => x.id === id);
  if (!t?.dir || !t?.root) return { ok: false, reason: `场景 ${id} 未注册或没有根对象` };
  const p = PRESETS[id] || { scale: 4, gridRadius: 16 };
  const want = { scale: Number(scale) || p.scale, gridRadius: Number(gridRadius) || p.gridRadius, unitHeight: Number(unitHeight) || SOLDIER_HEIGHT_M };
  const cur = globalThis.__tmBattleStage;
  if (cur && (cur.sceneId !== id || cur.scale !== want.scale || cur.gridRadius !== want.gridRadius)) { cur.dispose(); globalThis.__tmBattleStage = null; }
  let stage = globalThis.__tmBattleStage;
  if (!stage) {
    stage = new ReaBattleStage({ scene, site: t.root, dir: t.dir.clone().normalize(), camera, name: `battle-${id}`, scale: want.scale, gridRadius: want.gridRadius, unitHeightM: want.unitHeight });
    stage.sceneId = id; stage.gridRadius = want.gridRadius;
    globalThis.__tmBattleStage = stage;
    globalThis.__tmBattleStart = null;
  }
  return { ok: true, id, label: t.label || id, site: { ...stage.report, scale: stage.scale, gridRadius: stage.gridRadius, unitHeight: want.unitHeight }, running: stage.running };
}

/** 按计划真开战：舞台已在 probe 备好；参数不同先重建；守军增援与波次节奏按计划生效 */
export function deploySceneBattle({ scene, camera, id = 'apostles', plan = null } = {}) {
  const r = probeSceneBattle({ scene, camera, id, scale: plan?.scale, gridRadius: plan?.gridRadius, unitHeight: plan?.unitHeight });
  if (!r.ok) return r;
  const stage = globalThis.__tmBattleStage;
  stage.plan = plan || null;
  stage.start();
  const b = stage.battle;
  // 守军增援：默认 3 队之外按计划再补小队（矛 / 盾刀 / 弓循环，弓手队可选）
  const g = plan?.garrison;
  if (g?.squads > 0) {
    const spots = (b.houses || []).map((h) => h.door).filter(Boolean);
    const at = (i) => spots[i % Math.max(1, spots.length)] || stage.grid.cells.find((c) => stage.world.top(c) >= 2);
    for (let s = 0; s < g.squads; s++) b.spawnSquad({ cell: at(s), size: g.size || 8, tier: g.tier || 1, archer: g.archer ? s === g.squads - 1 : false, pike: s % 3 === 1 });
  }
  if (plan?.waves?.first) b.nextWave = Math.min(b.nextWave, plan.waves.first);
  ensureLoop();
  // 观战锚点：优先小屋台地，没有就用最高层中心
  const houseCell = stage.world.bnHouses?.[0] || null;
  const focusCell = houseCell ? { x: houseCell.cx, z: houseCell.cz, lv: stage.world.top(houseCell) || 1 } : { x: 0, z: 0, lv: stage.report.maxLevel || 4 };
  const result = { ok: true, id, label: r.label, scale: stage.scale, report: stage.report, units: b.units.length, houses: b.houses.length, focus: stage.toWorld(focusCell.x, focusCell.lv * stage.L, focusCell.z).toArray() };
  globalThis.__tmBattleStart = result;
  console.log('[sceneBattle] deployed', JSON.stringify(result));
  return result;
}

export function stopSceneBattle() {
  const s = globalThis.__tmBattleStage;
  if (!s) return false;
  s.dispose();
  globalThis.__tmBattleStage = null;
  globalThis.__tmBattleStart = null;
  return true;
}

/** 对照原样：隐藏 / 显示战斗图层（单位、船、血、旗、HUD） */
export function compareSceneBattle(on) {
  const st = globalThis.__tmBattleStage;
  if (!st) return { ok: false, reason: '没有正在预览的战斗' };
  st.battle.group.visible = !on;
  if (st.battle.hud) st.battle.hud.style.display = on ? 'none' : 'block';
  return { ok: true, hidden: !!on };
}

/** 采用：战斗继续，计划写入本机；下次进游戏自动部署（见 main.js adoptedBattle） */
export function commitSceneBattle(id, plan) {
  try { localStorage.setItem(ADOPT_KEY(id), JSON.stringify({ plan, at: Date.now() })); } catch {}
  return { ok: true, adopted: id, plan };
}
export function adoptedBattle(id) {
  try { return JSON.parse(localStorage.getItem(ADOPT_KEY(id)) || 'null'); } catch { return null; }
}
export function adoptedBattles() {
  const out = [];
  for (const id of BATTLE_SCENES) { const a = adoptedBattle(id); if (a) out.push({ id, ...a }); }
  return out;
}
export const battleSnapshot = snapshot;

/** URL 入口（?battleAt=…）：沿用旧签名，直接默认计划开战 */
export function startSceneBattle({ scene, camera, id = 'apostles', scale = null, gridRadius = null } = {}) {
  const plan = adoptedBattle(id)?.plan || null;
  const r = deploySceneBattle({ scene, camera, id, plan: plan || (scale || gridRadius ? { scale: Number(scale) || undefined, gridRadius: Number(gridRadius) || undefined } : null) });
  if (!r.ok) return r;
  return { ...r, focus: r.focus };
}
