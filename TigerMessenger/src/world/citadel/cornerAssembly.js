// =====================================================================
//  角柱装配（C9）：cornerGeometryParts → 层组网格。
//  有 gridV6 时按四格中心做笼形变形；方格时与轴向 box 恒等。
// =====================================================================
import * as THREE from "three";
import { createCornerGraph, cornerMaskAt } from "./cornerGraphAdapter.js";
import { cornerAllowedProtoIds, cornerGeometryParts } from "./cornerPrototypes.js";
import { cageMapUnit, cornerCageCorners } from "./cageDeform.js";
import { citadelColumnCenter } from "./gridMigration.js";

function pushTri(pos, a, b, c) {
  pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
}

function geomFromHex(THREE, bot, top) {
  const pos = [];
  pushTri(pos, bot[0], bot[1], bot[2]);
  pushTri(pos, bot[0], bot[2], bot[3]);
  pushTri(pos, top[0], top[2], top[1]);
  pushTri(pos, top[0], top[3], top[2]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    pushTri(pos, bot[i], top[i], top[j]);
    pushTri(pos, bot[i], top[j], bot[j]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

function boxGeom(THREE, p, map) {
  const [x0, y0, z0] = p.min;
  const [x1, y1, z1] = p.max;
  const bot = [
    map(x0, y0, z0), map(x1, y0, z0), map(x1, y0, z1), map(x0, y0, z1),
  ];
  const top = [
    map(x0, y1, z0), map(x1, y1, z0), map(x1, y1, z1), map(x0, y1, z1),
  ];
  return geomFromHex(THREE, bot, top);
}

function prismGeom(THREE, p, map) {
  const q = p.quad;
  const yb = Number.isFinite(p.base) ? p.base : (p.yLo ?? 0);
  const yLo = Number.isFinite(p.yLo) ? p.yLo : yb;
  const yHi = Number.isFinite(p.yHi) ? p.yHi : yLo;
  const topY = (x, z) => {
    if (p.along === "x") {
      const z0 = q[0][1];
      const z1 = q[2][1];
      const t = (z - z0) / ((z1 - z0) || 1);
      return yLo + (yHi - yLo) * t;
    }
    if (p.along === "z") {
      const x0 = q[0][0];
      const x1 = q[1][0];
      const t = (x - x0) / ((x1 - x0) || 1);
      return yLo + (yHi - yLo) * t;
    }
    return yHi;
  };
  const bot = q.map(([x, z]) => map(x, yb, z));
  const top = q.map(([x, z]) => map(x, topY(x, z), z));
  return geomFromHex(THREE, bot, top);
}

export function assembleCornerBody({
  grid,
  cols,
  cs,
  ch,
  mesh,
  materials,
  ownSpanning,
  ownNone,
  levelGroups,
  stats,
  gridV6 = null,
}) {
  const floors = levelGroups.length;
  const graph = createCornerGraph(grid, { cols, rows: cols, floors });
  const columnAt = (ix, iz) => citadelColumnCenter(ix, iz, {
    quad: gridV6?.quad ?? null,
    mapping: gridV6?.mapping ?? null,
    cellSize: cs,
    gridSize: cols,
  });
  let parts = 0;
  const emitNode = (gx, gz, iy, mask) => {
    const proto = cornerAllowedProtoIds(mask)[0];
    if (!proto) return;
    const keys = [];
    for (let dy = 0; dy < 2; dy++) {
      for (let dz = 0; dz < 2; dz++) {
        for (let dx = 0; dx < 2; dx++) {
          const k = `${gx - 1 + dx},${iy + dy},${gz - 1 + dz}`;
          if (grid.has(k)) keys.push(k);
        }
      }
    }
    if (!keys.length) return;
    if (!ownSpanning(keys)) return;
    const cornersXZ = cornerCageCorners(gx, gz, { columnAt, cellSize: cs, gridSize: cols });
    const y0 = (iy + 0.5) * ch;
    const y1 = y0 + ch;
    const map = (u, y, v) => cageMapUnit(u, y, v, cornersXZ, y0, y1);
    const char = grid.get(keys[0]);
    const mat = materials[char] ?? materials.W;
    const li = Math.max(0, Math.min(levelGroups.length - 1, iy));
    for (const p of cornerGeometryParts(mask, proto)) {
      let geo = null;
      if (p.kind === "box") geo = boxGeom(THREE, p, map);
      else if (p.kind === "prism") geo = prismGeom(THREE, p, map);
      if (!geo) continue;
      const box = mesh(geo, mat, `town-corner-${p.part}`, 0.012);
      box.position.set(0, 0, 0);
      levelGroups[li].add(box);
      parts++;
    }
    ownNone();
  };

  for (const { index } of graph.cells()) {
    const { gx, gz, iy } = graph.coordOf(index);
    emitNode(gx, gz, iy, graph.maskOf(index));
  }

  // ---------- 地面层下半：必须补一圈 iy = -1 的节点 ----------
  // 节点 iy 覆盖的竖向区间是「层 iy 心 → 层 iy+1 心」（这里 y0=(iy+0.5)*ch），
  // 而 createCornerGraph 从 iy=0 起 → 层 0 的**下半**（0 … 0.5*ch）没有任何柱子。
  // 2026-09-05 A/B 实测：外壳底面从格体路径的 4.950 抬到 5.950，高 1.000 = 半层
  // （ch=2），沿地面是一圈环形洞。`tools/test_corner_assembly.mjs` 第 4 项守这条。
  //
  // iy=-1 的 mask：下四格取层 -1（恒空）、上四格取层 0 → 形态必为 soffit，
  // 而 `soffit.under` 的 `emitWalls(1, 0.5, 1)` 映射到 y0+0.5*ch … y0+ch
  // = 0 … 0.5*ch，正好补满缺口。**目录不用改。**
  // 层组下标已 clamp 到 0，iy=-1 的几何挂在 level-0 组里。
  for (let gz = 0; gz <= cols; gz++) {
    for (let gx = 0; gx <= cols; gx++) {
      const mask = cornerMaskAt(grid, gx, gz, -1);
      if (mask) emitNode(gx, gz, -1, mask);
    }
  }

  if (stats) stats.cornerPartCount = parts;
  return parts;
}

export { cageMapUnit, cornerCageCorners };
