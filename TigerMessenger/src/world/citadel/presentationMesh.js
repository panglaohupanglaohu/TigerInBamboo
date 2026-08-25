// =====================================================================
//  V4 古堡网格：按求解模块在台地格子上建 Three 构件（替换 @legacy 镇体外观）
// =====================================================================
import * as THREE from "three";
import { resolveBuildingTheme } from "./visualTheme.js";
import { createResourceRegistry } from "../../core/resourceRegistry.js";
import { compileCitadelV4 } from "./pipeline.js";
import { isCitadelTownV4 } from "../../core/params.js";

function parseCellId(id) {
  const m = /^cell:(\d+):(\d+):(\d+):(\d+)$/.exec(id || "");
  if (!m) return null;
  return { t: +m[1], ix: +m[2], iy: +m[3], iz: +m[4] };
}

function cellCenter(ix, iy, iz, gridSize, cellSize, cellHeight) {
  return {
    x: (ix - (gridSize - 1) / 2) * cellSize,
    y: (iy + 0.5) * cellHeight,
    z: (iz - (gridSize - 1) / 2) * cellSize,
  };
}

function hexColor(hex) {
  return new THREE.Color(hex);
}

function makeMat(reg, key, hex, extra = {}) {
  return reg.retain("material", key, () => {
    const mat = new THREE.MeshStandardMaterial({
      color: hexColor(hex),
      roughness: extra.roughness ?? 0.88,
      metalness: extra.metalness ?? 0,
      flatShading: true,
    });
    mat.userData.v4Shared = true;
    return mat;
  });
}

function addBox(parent, geo, mat, x, y, z, sx, sy, sz, name) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = name;
  parent.add(mesh);
  return mesh;
}

/**
 * @param {object} v4 compileCitadelV4 结果
 * @param {object} blueprint
 */
export function buildTownV4Mesh(v4, blueprint) {
  const group = new THREE.Group();
  group.name = "citadel-v4-town";
  group.userData.kind = "citadel-v4-town";
  const gridSize = blueprint.grid?.size ?? 25;
  const cellSize = blueprint.grid?.cellSize ?? 2;
  const cellHeight = blueprint.grid?.cellHeight ?? 2;
  const baseYs = blueprint.terrain?.baseYs || [];
  const seed = v4.seed || 1;
  const reg = createResourceRegistry();
  const box = new THREE.BoxGeometry(1, 1, 1);
  const cone = new THREE.ConeGeometry(0.62, 1, 4);
  const supportEdgeGeo = new THREE.BoxGeometry(0.075, 0.075, 1);
  const stats = { cells: 0, roofs: 0, gates: [], families: {} };
  const topSet = new Set();
  for (const cell of v4.town?.cells || []) {
    if (!cell.occupancy?.U) topSet.add(cell.cellId);
  }

  for (const cell of v4.town?.cells || []) {
    const loc = parseCellId(cell.cellId);
    if (!loc) continue;
    const occ = cell.occupancy || {};
    const family = cell.module?.family || "floor";
    const theme = resolveBuildingTheme(`t${loc.t}:${loc.ix}:${loc.iz}`, { seed });
    const baseY = Number.isFinite(baseYs[loc.t]) ? baseYs[loc.t] : 0;
    const c = cellCenter(loc.ix, loc.iy, loc.iz, gridSize, cellSize, cellHeight);
    const x = c.x;
    const y = baseY + c.y;
    const z = c.z;
    const wall = makeMat(reg, `wall:${theme.wallMain}`, theme.wallMain);
    const roof = makeMat(reg, `roof:${theme.roof}`, theme.roof, { roughness: 0.9 });
    const trim = makeMat(reg, `trim:${theme.trim}`, theme.trim, { roughness: 0.7 });
    const tile = makeMat(reg, `tile:${theme.tileAccent}`, theme.tileAccent);
    const win = makeMat(reg, "window", "#294452");
    const cellGroup = new THREE.Group();
    cellGroup.name = `v4-cell-t${loc.t}`;
    cellGroup.userData.terraceIndex = loc.t;
    cellGroup.userData.v4Cell = cell.cellId;
    cellGroup.userData.townModule = { family, variant: cell.module?.role };

    const cs = cellSize * 0.92;
    const ch = cellHeight * 0.92;
    if (family === "foundation") {
      addBox(cellGroup, box, trim, x, y - ch * 0.28, z, cs, ch * 0.35, cs, "town-plinth");
    } else if (family === "gate" || cell.semantic === "gate") {
      addBox(cellGroup, box, makeMat(reg, "gate", "#EEE2CB"), x, y, z, cs, ch, cs * 0.35, "town-gate");
      addBox(cellGroup, box, wall, x - cs * 0.38, y, z, cs * 0.22, ch, cs, "town-gate-post");
      addBox(cellGroup, box, wall, x + cs * 0.38, y, z, cs * 0.22, ch, cs, "town-gate-post");
      stats.gates.push({ terraceIndex: loc.t, x, z, width: 1.4 });
    } else if (family === "stairs") {
      for (let s = 0; s < 3; s++) {
        addBox(cellGroup, box, trim, x, y - ch * 0.35 + s * 0.22, z + (s - 1) * 0.18, cs * 0.7, 0.12, cs * 0.45, "town-stairs");
      }
    } else if (family === "support") {
      // 与 citadelTown.js 保持同一支架语义：四个环向支柱单元组成
      // 八面体式边框，不再使用单根中央柱形成棱锥。
      const frame = new THREE.Group();
      frame.name = "town-support";
      frame.userData.supportShape = "octahedral-four-edge";
      const topApex = new THREE.Vector3(0, ch * 0.5, 0);
      const bottomApex = new THREE.Vector3(0, -ch * 0.5, 0);
      const ringRadius = Math.min(cs * 0.42, ch * 0.42);
      const zAxis = new THREE.Vector3(0, 0, 1);
      const addEdge = (from, to) => {
        const dir = to.clone().sub(from);
        const len = dir.length();
        if (len <= 1e-6) return;
        dir.normalize();
        const edge = new THREE.Mesh(supportEdgeGeo, trim);
        edge.scale.z = len;
        edge.position.copy(from).addScaledVector(dir, len * 0.5);
        edge.quaternion.setFromUnitVectors(zAxis, dir);
        edge.name = "town-support-edge";
        frame.add(edge);
      };
      for (const [sx, sz] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const ringPoint = new THREE.Vector3(sx * ringRadius, 0, sz * ringRadius);
        addEdge(topApex, ringPoint);
        addEdge(ringPoint, bottomApex);
      }
      frame.position.set(x, y, z);
      cellGroup.add(frame);
    } else {
      addBox(cellGroup, box, wall, x, y, z, cs, ch, cs, "town-floor");
    }

    if (!occ.U || family === "roof") {
      const cap = new THREE.Mesh(cone, roof);
      cap.position.set(x, y + ch * 0.55, z);
      cap.scale.set(cs * 0.95, ch * 0.55, cs * 0.95);
      cap.name = "town-roof";
      cap.castShadow = true;
      cellGroup.add(cap);
      stats.roofs += 1;
    }
    if (family === "balcony" || family === "flowerTile" || (!occ.S && family === "floor")) {
      addBox(cellGroup, box, tile, x, y - ch * 0.12, z + cs * 0.48, cs * 0.7, 0.06, 0.28, "town-balcony");
    }
    if (family === "fence" || (!occ.S && loc.iy === 0)) {
      addBox(cellGroup, box, trim, x, y - ch * 0.05, z + cs * 0.46, cs * 0.85, 0.22, 0.05, "town-fence");
    }
    if (family === "decor" || family === "floor") {
      if (!occ.E) addBox(cellGroup, box, win, x + cs * 0.47, y + ch * 0.08, z, 0.04, 0.28, 0.22, "town-window");
      if (!occ.W) addBox(cellGroup, box, win, x - cs * 0.47, y + ch * 0.08, z, 0.04, 0.28, 0.22, "town-window");
    }
    if (family === "decor" && cell.module?.role === "chimney" && !occ.U) {
      addBox(cellGroup, box, trim, x + cs * 0.22, y + ch * 0.7, z, 0.16, 0.35, 0.16, "town-chimney");
    }
    if (family === "decor" && cell.module?.role === "lamp") {
      addBox(cellGroup, box, makeMat(reg, "lamp", "#FFB347", { roughness: 0.4 }), x, y + ch * 0.2, z + cs * 0.4, 0.08, 0.12, 0.08, "town-lamp");
    }

    group.add(cellGroup);
    stats.cells += 1;
    stats.families[family] = (stats.families[family] || 0) + 1;
  }

  group.userData.stats = stats;
  group.userData.registry = reg;
  return group;
}

export function restoreLegacyTownPresentation(castle) {
  if (!castle) return null;
  const prev = castle.getObjectByName("citadel-v4-town");
  if (prev) prev.removeFromParent();
  castle.traverse((o) => {
    if (o.name?.startsWith("town-terrace-")) o.visible = true;
  });
  if (castle.userData.townStats) castle.userData.townStats.v4 = false;
  castle.userData.v4Town = null;
  return castle;
}

/** 开关真实：visual=legacy 必须露出 legacy 镇体；visual=v6 才挂 V4 网格。 */
export function syncTownPresentation(castle, v4, sources) {
  const visual = sources?.visual ?? (isCitadelTownV4() ? "v6" : "legacy");
  if (visual === "v6") return applyTownV4Presentation(castle, v4);
  return restoreLegacyTownPresentation(castle);
}

export function applyTownV4Presentation(castle, v4) {
  if (!castle || !v4) return null;
  const prev = castle.getObjectByName("citadel-v4-town");
  if (prev) {
    prev.userData.registry?.snapshot?.().forEach((r) => prev.userData.registry.release(r.kind, r.id.split(":")[1]));
    prev.removeFromParent();
  }
  castle.traverse((o) => {
    if (o.name?.startsWith("town-terrace-") && o !== castle) o.visible = false;
  });
  const mesh = buildTownV4Mesh(v4, castle.userData.blueprint || {});
  castle.add(mesh);
  const gates = mesh.userData.stats?.gates || [];
  if (gates.length && castle.userData.townStats) {
    castle.userData.townStats.gates = gates;
    castle.userData.townStats.gate = gates[0];
    castle.userData.townStats.v4 = true;
  }
  castle.userData.v4Town = mesh;
  return mesh;
}

export function refreshTownV4(castle, seed = 1) {
  if (!castle?.userData?.blueprint) return null;
  const rt = castle.userData.v4Runtime;
  if (rt?.recompile) {
    rt.recompile({ seed });
    rt.flushCommit();
    return castle.userData.v4Town ?? castle;
  }
  if (!isCitadelTownV4()) return restoreLegacyTownPresentation(castle);
  const v4 = compileCitadelV4(castle.userData.blueprint, seed);
  castle.userData.v4 = v4;
  return applyTownV4Presentation(castle, v4);
}
