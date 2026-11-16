// 场景战役入口（2026-11-16）：把 Bad North 玩法层接到任意已注册场景上。
// 复用 reaBattleStage.js（采样实景地形 → REA World → Battle 原逻辑），本文件只负责
// 选场景、起舞台、驱动 update。
//   ?battleAt=apostles   在十二门徒岩群开战（默认）
//   ?battleAt=moss       在苔庭开战
//   ?battleScale=4       舞台 1 单位 = 多少米（默认按场景尺寸自动）
//   ?battleRadius=20     REA 网格半径（格）
import * as THREE from 'three';
import { ReaBattleStage, SOLDIER_HEIGHT_M } from './reaBattleStage.js';

// 各场景的舞台尺度：岩群柱子直径约二三十米，苔庭是低平小岛，圣城是密集城郭
const PRESETS = {
  apostles: { scale: 5, gridRadius: 18 },
  moss: { scale: 6, gridRadius: 16 },
  citadel: { scale: 8, gridRadius: 14 },
  bookshop: { scale: 4, gridRadius: 18 },
};

export function startSceneBattle({ scene, camera, id = 'apostles', scale = null, gridRadius = null } = {}) {
  const t = globalThis.__tmSceneTargets?.().find((x) => x.id === id);
  if (!t?.dir || !t?.root) return { ok: false, reason: `场景 ${id} 未注册或没有根对象` };
  const p = PRESETS[id] || { scale: 4, gridRadius: 16 };
  const stage = new ReaBattleStage({
    scene,
    site: t.root,
    dir: t.dir.clone().normalize(),
    camera,
    name: `battle-${id}`,
    scale: Number(scale) || p.scale,
    gridRadius: Number(gridRadius) || p.gridRadius,
    unitHeightM: SOLDIER_HEIGHT_M,
  });
  stage.start();

  // 舞台自带 update；这里用独立 rAF 驱动，不改主循环
  let last = performance.now(), frames = 0, alive = true;
  const loop = () => {
    if (!alive) return;
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    try { stage.update(dt); } catch (e) { console.warn('[sceneBattle] update', e); }
    frames++;
    if (frames % 600 === 0) {
      const snap = stage.battle?.snapshot?.() || null;
      console.log('[sceneBattle]', id, JSON.stringify({ frames, running: stage.running, snapshot: snap }));
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // 观战锚点：优先落在小屋所在台地（战场核心），没有就用最高层中心
  const houseCell = stage.world.bnHouses?.[0] || null;
  const focusCell = houseCell ? { x: houseCell.cx, z: houseCell.cz, lv: stage.world.top(houseCell) || 1 } : { x: 0, z: 0, lv: stage.report.maxLevel || 4 };
  const result = {
    ok: true,
    id,
    label: t.label || id,
    scale: stage.scale,
    gridRadius: Number(gridRadius) || p.gridRadius,
    report: stage.report,
    // 玩家/相机落点：小屋台地顶面（球面世界坐标）
    focus: stage.toWorld(focusCell.x, focusCell.lv * stage.L, focusCell.z).toArray(),
    units: stage.battle?.units?.length ?? stage.battle?.soldiers?.length ?? null,
  };
  globalThis.__tmBattleStage = stage;
  globalThis.__tmBattleStart = result;
  console.log('[sceneBattle] started', JSON.stringify(result));
  return result;
}

export function stopSceneBattle() {
  const s = globalThis.__tmBattleStage;
  if (!s) return false;
  s.dispose();
  globalThis.__tmBattleStage = null;
  return true;
}
