// V7-G16（TODO 1326）：MC 标准形状矩阵——sphere/plane/box/torus/cave，NaN=0、degenerate=0
import assert from "node:assert/strict";
import { createScalarField } from "../TigerMessenger/src/procgen/field/scalarField.js";
import { marchingCubes } from "../TigerMessenger/src/procgen/field/marchingCubes.js";
import { sdSphere, sdPlane, sdBox, sdTorusXZ, sdCave } from "../TigerMessenger/src/procgen/field/sdf.js";

let passed = 0;
const ok = (msg) => { passed++; console.log(`  ✓ ${msg}`); };

function meshFor(sample, { min = [-2, -2, -2], max = [2, 2, 2], resolution = 33 } = {}) {
  const field = createScalarField({ min, max, resolution, sample });
  const mesh = marchingCubes(field);
  return { mesh, cell: (max[0] - min[0]) / (resolution - 1) };
}

function assertClean(mesh, label) {
  assert.ok(mesh.stats.triangleCount > 0, `${label}: no triangles`);
  assert.equal(mesh.stats.degenerateTriangles, 0, `${label}: degenerate=${mesh.stats.degenerateTriangles}`);
  assert.ok([...mesh.positions].every(Number.isFinite), `${label}: NaN in positions`);
  assert.ok([...mesh.normals].every(Number.isFinite), `${label}: NaN in normals`);
  const vertexCount = mesh.positions.length / 3;
  assert.ok([...mesh.indices].every((index) => index >= 0 && index < vertexCount), `${label}: index out of range`);
}

function vertices(mesh) {
  const out = [];
  for (let i = 0; i < mesh.positions.length; i += 3) out.push([mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2]]);
  return out;
}

{
  const { mesh, cell } = meshFor((p) => sdSphere(p, [0, 0, 0], 1.2));
  assertClean(mesh, "sphere");
  const tol = cell * 1.6;
  for (const v of vertices(mesh)) assert.ok(Math.abs(Math.hypot(...v) - 1.2) < tol, `sphere vertex off surface: ${v}`);
  // 封闭凸体：face normal 大致朝外
  const outward = vertices(mesh).filter((v, i) => {
    const n = [mesh.normals[i * 3], mesh.normals[i * 3 + 1], mesh.normals[i * 3 + 2]];
    return v[0] * n[0] + v[1] * n[1] + v[2] * n[2] > 0;
  });
  assert.ok(outward.length / (mesh.positions.length / 3) > 0.98, "sphere normals not outward");
  ok("sphere：顶点贴面、法线朝外、NaN/degenerate=0");
}

{
  const { mesh } = meshFor((p) => sdPlane(p, [0, 1, 0], -0.3));
  assertClean(mesh, "plane");
  for (let i = 0; i < mesh.normals.length; i += 3) {
    const n = [mesh.normals[i], mesh.normals[i + 1], mesh.normals[i + 2]];
    const len = Math.hypot(...n);
    assert.ok(Math.abs(n[1]) / len > 0.99, `plane normal tilted: ${n}`);
  }
  ok("plane：法线全部平行平面法向、NaN/degenerate=0");
}

{
  const half = [0.9, 0.7, 1.1];
  const { mesh, cell } = meshFor((p) => sdBox(p, [0, 0, 0], half));
  assertClean(mesh, "box");
  const tol = cell * 1.6;
  for (const v of vertices(mesh)) {
    const onFace = v.some((value, axis) => Math.abs(Math.abs(value) - half[axis]) < tol);
    assert.ok(onFace, `box vertex off faces: ${v}`);
  }
  ok("box：顶点全在六个面上、NaN/degenerate=0");
}

{
  const { mesh, cell } = meshFor((p) => sdTorusXZ(p, [0, 0, 0], 1.1, 0.4));
  assertClean(mesh, "torus");
  const tol = cell * 1.6;
  for (const v of vertices(mesh)) {
    const d = Math.hypot(Math.hypot(v[0], v[2]) - 1.1, v[1]);
    assert.ok(Math.abs(d - 0.4) < tol, `torus vertex off surface: ${v}`);
  }
  ok("torus：顶点满足环面方程、NaN/degenerate=0");
}

{
  const halfSize = [1.0, 1.0, 1.0];
  const openingRadius = 0.45;
  const { mesh } = meshFor((p) => sdCave(p, [0, 0, 0], halfSize, openingRadius));
  assertClean(mesh, "cave");
  // 开口竖井壁面必须存在：开口轴附近（水平半径≈openingRadius、位于下半部）应有表面顶点
  const tunnelWall = vertices(mesh).filter((v) => {
    const radial = Math.hypot(v[0], v[2]);
    return Math.abs(radial - openingRadius) < 0.15 && v[1] < -halfSize[1] * 0.3;
  });
  assert.ok(tunnelWall.length >= 8, `cave opening tunnel wall missing (verts=${tunnelWall.length})`);
  // 腔体被竖井打通：中轴底部区域不应被完整封口——底面附近中轴上无顶点
  const plugged = vertices(mesh).filter((v) => Math.hypot(v[0], v[2]) < openingRadius * 0.4 && v[1] < -halfSize[1] * 0.85);
  assert.equal(plugged.length, 0, `cave opening plugged by ${plugged.length} verts`);
  ok("cave：竖井壁面存在、开口未封口、NaN/degenerate=0");
}

{
  // 形状被场边界裁切时同样不得产生 NaN/退化三角形
  const { mesh } = meshFor((p) => sdSphere(p, [1.6, 0, 0], 1.2));
  assertClean(mesh, "clipped-sphere");
  ok("边界裁切：半出场域的球体依然 NaN/degenerate=0");
}

console.log(`✅ MC shapes assertions=${passed}`);
