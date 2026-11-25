// REA 地形候选（2026-11-21）：用户授权「轨道保留，其他可编辑」——
// 把圣城等地形用 REACodeRefactoring 的方法重建：采样实景高度 → REA World 细胞网格层化 →
// WorldMesh 台地几何贴回球面。轨道 / 桥 / 高架在采样时就被排除（与 ReaBattleStage 同一套
// 过滤），净空保留原样；网格化只做形状，不碰轨道与建筑。
//   terrain.rea.probe    采样 + 净空审计，不替换显示（报告网格 / 层 / 轨道净空）
//   terrain.rea.preview  隐藏原地形网格，显示 REA 地形候选
//   terrain.rea.revert   拆候选，恢复原地形
//   terrain.rea.state    当前候选状态与审计
import * as THREE from 'three';
import { ReaBattleStage } from './reaBattleStage.js';
import { isCrossableRailOrTram } from '../vikings/vikingVoyage.js';

// 候选网格要覆盖整城：半径 ~32 格 × 5 m = 160 m，层高 2.25 m
const PRESETS = {
  citadel: { scale: 5, gridRadius: 32, levelHeight: 0.45 },
};
const TERRAIN = /mountain-surface|terrain|cliff-seal|mountain-face/i;

let cur = null;

function makeTerrainMaterial() {
  // WorldMesh 已烘焙 vertex color + 光照；标准材质只负责把它显示出来。
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
}

/** 轨道净空审计：沿轨道网格顶点逐点查。净空 = 轨面 − 地面（stage.trueY 是实景真高）；
 * 层化抬高 = REA 层顶 − 实景地面（round 量化上界 +0.5 层）。隧道段实景地面本来就在轨道上方，
 * 属于设计内；只有露天净空被层化吃掉才算收紧。 */
function railClearance(scene, stage) {
  const hits = [];
  scene.traverse((o) => { if (o.isMesh && isCrossableRailOrTram(o)) hits.push(o); });
  if (!hits.length) return { rails: 0, samples: 0 };
  const v = new THREE.Vector3();
  let maxRaise = -Infinity, maxRaiseAt = null, minTight = Infinity, minTightAt = null, n = 0, tunnel = 0;
  for (const o of hits) {
    const pos = o.geometry?.attributes?.position; if (!pos) continue;
    const step = Math.max(1, Math.floor(pos.count / 4000));
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      const s = stage.worldToStage(v, new THREE.Vector3());
      const c = stage.index.cellAt(s.x, s.z); if (!c) continue;
      const trueY = stage.trueY.get(c.id); if (trueY == null) continue;
      const realClear = s.y - trueY;                       // 轨面离实景地面（stage 单位）
      const raise = stage.world.top(c) * stage.L - trueY;  // 层化相对实景抬高
      n++;
      if (realClear < 0) { tunnel++; continue; }           // 隧道：地面本就在轨上方
      if (raise > maxRaise) { maxRaise = raise; maxRaiseAt = { x: +s.x.toFixed(1), z: +s.z.toFixed(1) }; }
      if (realClear < 8 / stage.scale) {                    // 露天净空 <8m 的贴地段才看收紧
        const eff = realClear - Math.max(0, raise);
        if (eff < minTight) { minTight = eff; minTightAt = { x: +s.x.toFixed(1), z: +s.z.toFixed(1), realClear: +(realClear * stage.scale).toFixed(2) }; }
      }
    }
  }
  return {
    rails: hits.length, samples: n, tunnelSamples: tunnel,
    maxRaise: Number.isFinite(maxRaise) ? +(maxRaise * stage.scale).toFixed(2) : null, maxRaiseAt,
    minTightClearance: Number.isFinite(minTight) ? +(minTight * stage.scale).toFixed(2) : null, minTightAt,
    halfLevel: +(stage.L * 0.5 * stage.scale).toFixed(2),
  };
}

export function probeReaTerrain({ scene, camera, id = 'citadel', scale = null, gridRadius = null, levelHeight = null } = {}) {
  const t = globalThis.__tmSceneTargets?.().find((x) => x.id === id);
  if (!t?.dir || !t?.root) return { ok: false, reason: `场景 ${id} 未注册或没有根对象` };
  const p = PRESETS[id] || { scale: 5, gridRadius: 24, levelHeight: 0.4 };
  const want = { scale: scale || p.scale, gridRadius: gridRadius || p.gridRadius, levelHeight: levelHeight || p.levelHeight };
  if (cur && (cur.id !== id || cur.stage.scale !== want.scale || cur.stage.gridRadius !== want.gridRadius || cur.stage.L !== want.levelHeight)) revertReaTerrain();
  let stage = cur?.stage;
  if (!stage) {
    stage = new ReaBattleStage({
      scene, site: t.root, dir: t.dir.clone().normalize(), camera,
      scale: want.scale, gridRadius: want.gridRadius, levelHeight: want.levelHeight,
      name: `rea-terrain-${id}`, houseFilter: null,
    });
    // 地形候选不需要战斗：Battle 已建但不开战，隐藏其图层 / HUD
    stage.battle.group.visible = false;
    stage.battle.hud?.remove();
    stage.gridRadius = want.gridRadius;
    cur = { id, stage, hidden: [], previewing: false };
  }
  const clearance = railClearance(scene, stage);
  return {
    ok: true, id, label: t.label || id, previewing: cur.previewing,
    site: { ...stage.report, scale: stage.scale, gridRadius: want.gridRadius, levelHeight: stage.L },
    clearance,
  };
}

export function previewReaTerrain({ scene, camera, id = 'citadel', ...opts } = {}) {
  const r = probeReaTerrain({ scene, camera, id, ...opts });
  if (!r.ok) return r;
  const stage = cur.stage;
  if (!cur.previewing) {
    // 隐藏原地形网格（只藏形状层：山体/地形/密封裙，不碰轨道、建筑、植被）
    const hidden = [];
    cur.stage.site.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      const path = `${o.name}<${o.parent?.name || ''}`;
      if (o.userData.reaBattleStage || o.userData.reaIgnore) return;
      if (TERRAIN.test(path)) { o.visible = false; hidden.push(o); }
    });
    cur.hidden = hidden;
    // 换可见地形材质并贴球
    stage.mesh.material = makeTerrainMaterial();
    stage.mesh.visible = true;
    stage.warpMaterials();
    cur.previewing = true;
  }
  return { ...r, previewing: true, hiddenMeshes: cur.hidden.length, hiddenNames: cur.hidden.map((o) => o.name) };
}

export function revertReaTerrain() {
  if (!cur) return { reverted: false };
  const stage = cur.stage;
  for (const o of cur.hidden) o.visible = true;
  stage.dispose();
  cur = null;
  return { reverted: true };
}

export function reaTerrainState() {
  if (!cur) return { active: false };
  const stage = cur.stage;
  return {
    active: true, id: cur.id, previewing: cur.previewing, hiddenMeshes: cur.hidden.length,
    site: { ...stage.report, scale: stage.scale, levelHeight: stage.L },
  };
}
