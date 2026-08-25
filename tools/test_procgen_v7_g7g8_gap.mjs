// V7-G7/G8 缺口回填测试（TODO 1177-1185、1198-1201、1206-1209）
// 每块注释标注 TODO 行号；只断言真实实现的行为。
import assert from "node:assert/strict";
import { createScalarField } from "../TigerMessenger/src/procgen/field/scalarField.js";
import { sdSphere, sdRoundedBox, sdHeightfield, sdTorusXZ, sdfSubtract, smoothSubtract, smoothUnion } from "../TigerMessenger/src/procgen/field/sdf.js";
import { sdTerraceShoulder, sdMountain, sdCanalVolume, sdWaterfallNotch, sdFoundationCollar, sdCave, sampleWithProvenance } from "../TigerMessenger/src/procgen/field/composites.js";
import { SEMANTIC_NAMES, SEMANTIC_IDS, semanticId, semanticName } from "../TigerMessenger/src/procgen/field/semantics.js";
import { createChunkField, dirtyAabbToChunks, fieldSampleHash, fieldCacheKey, MC_BASELINE_CELLS, MC_BASELINE_HALO, assertUniformChunkResolution } from "../TigerMessenger/src/procgen/field/chunkField.js";
import { marchingCubes } from "../TigerMessenger/src/procgen/field/marchingCubes.js";
import { sliceField, sliceToJson, sliceToSvg, sliceToPng } from "./lib/fieldSliceExport.mjs";
import { decodePng } from "./lib/colorblindSim.mjs";

let passed = 0;
const ok = (msg) => { passed++; console.log(`  ✓ ${msg}`); };

// ---------- TODO 1177：roundedBox / heightfield ----------
{
  assert.ok(sdRoundedBox([0, 0, 0], [0, 0, 0], [1, 1, 1], 0.2) < 0, "roundedBox 内部为负");
  assert.ok(sdRoundedBox([2, 0, 0], [0, 0, 0], [1, 1, 1], 0.2) > 0, "roundedBox 外部为正");
  // 圆角：对角点比同尺寸硬盒更远
  const hard = 1; const p = [hard + 0.15, hard + 0.15, 0];
  assert.ok(sdRoundedBox(p, [0, 0, 0], [1, 1, 1], 0.3) > 0);
  const heights = [1, 1, 1, 1, 2, 1, 1, 1, 1]; // 3×3，中央隆起
  const hf = { minX: -1, maxX: 1, minZ: -1, maxZ: 1, width: 3, depth: 3, heights };
  assert.ok(sdHeightfield([0, 1.5, 0], hf) < 0, "heightfield 峰下为负");
  assert.ok(sdHeightfield([0, 2.5, 0], hf) > 0, "heightfield 峰上为正");
  assert.ok(Math.abs(sdHeightfield([1, 1, 1], hf)) < 1e-12, "heightfield 格点处命中表面");
  assert.equal(sdHeightfield([5, 0, 5], hf), Infinity, "heightfield 域外返回 Infinity");
  ok("G7/1177：roundedBox + heightfield 符号约定与域外行为");
}

// ---------- TODO 1178：smoothSubtract ----------
{
  assert.equal(smoothSubtract(-1, 2, 0), -1, "k<=0 退化为硬 subtract");
  assert.equal(smoothSubtract(2, 1, 0), 2, "硬 subtract = max(a,-b)");
  const hard = Math.max(0.05, -0.1);
  const soft = smoothSubtract(0.05, 0.1, 0.2);
  assert.ok(Number.isFinite(soft) && soft >= hard, "smoothSubtract ≥ 硬 subtract 且无 NaN");
  assert.ok(soft < hard + 0.2, "平滑量受 k 约束");
  assert.throws(() => createScalarField({ min: [0, 0, 0], max: [1, 1, 1], resolution: 3, sample: () => NaN }), /non-finite/, "非法采样仍拒绝");
  ok("G7/1178：smoothSubtract 退化/平滑界/非法拒绝");
}

// ---------- TODO 1179：复合 primitives ----------
{
  // terrace shoulder：底部宽、顶部窄
  const shoulder = { center: [0, 1, 0], halfSize: [2, 1, 2], steps: 4, shoulderScale: 0.5 };
  assert.ok(sdTerraceShoulder([0, 1, 0], shoulder) < 0);
  assert.ok(sdTerraceShoulder([1.9, 0.2, 0], shoulder) < 0, "底层边缘在内");
  assert.ok(sdTerraceShoulder([1.9, 1.9, 0], shoulder) > 0, "顶层同 x 已收缩出外");
  assert.throws(() => sdTerraceShoulder([0, 0, 0], { center: [0, 0, 0], halfSize: [1, 1, 1], steps: 0 }), /steps/);
  // mountain：底心在内、顶之上在外、远处在外
  const mountain = { center: [0, 0, 0], radius: 2, height: 3 };
  assert.ok(sdMountain([0, 0.5, 0], mountain) < 0);
  assert.ok(sdMountain([0, 4, 0], mountain) > 0);
  assert.ok(sdMountain([3, 0.5, 0], mountain) > 0);
  assert.throws(() => sdMountain([0, 0, 0], { center: [0, 0, 0], radius: -1, height: 1 }), /positive/);
  // canal volume：路径上 depth 内为负，离路径/床面以下为正
  const canal = { path: [[-5, 0], [5, 0]], width: 1, floorY: 0, depth: 2 };
  assert.ok(sdCanalVolume([0, 1, 0], canal) < 0);
  assert.ok(sdCanalVolume([0, 1, 3], canal) > 0, "离槽为正");
  assert.ok(sdCanalVolume([0, -1, 0], canal) > 0, "河床以下为正");
  assert.throws(() => sdCanalVolume([0, 0, 0], { path: [[0, 0]], width: 1, floorY: 0, depth: 1 }), />= 2/);
  // waterfall notch：凹槽内负外正
  const notch = { center: [0, 2, 0], halfSize: [0.5, 1, 0.3] };
  assert.ok(sdWaterfallNotch([0, 2, 0], notch) < 0);
  assert.ok(sdWaterfallNotch([2, 2, 0], notch) > 0);
  // foundation collar：环带内为负、建筑 footprint 内为正（被减掉）
  const collar = { center: [0, 0, 0], halfSize: [1, 1, 1], collar: 0.5, height: 0.4 };
  assert.ok(sdFoundationCollar([1.25, 0.1, 0], collar) < 0, "裙边环带在内");
  assert.ok(sdFoundationCollar([0, 0.1, 0], collar) > 0, "footprint 内部被减除");
  assert.ok(sdFoundationCollar([3, 0, 0], collar) > 0);
  // cave（sdf.js 已有，统一出口）：球腔中心在内部
  assert.ok(sdCave([0, 0, 0], [0, 0, 0], [1.2, 1.1, 1.2], 0.55) < 0);
  ok("G7/1179：terrace shoulder/mountain/canal/waterfall notch/foundation collar/cave");
}

// ---------- TODO 1180：命名语义集 ----------
{
  assert.deepEqual(SEMANTIC_NAMES, ["none", "grass", "cliff", "shore", "canal-bed", "foundation", "moss", "waterfall"]);
  assert.equal(SEMANTIC_IDS.grass, 1);
  assert.equal(SEMANTIC_IDS["canal-bed"], 4);
  assert.equal(SEMANTIC_IDS.waterfall, 7);
  for (const name of SEMANTIC_NAMES) assert.equal(semanticName(semanticId(name)), name, "name↔id 往返");
  assert.throws(() => semanticId("lava"), /unknown semantic name/);
  assert.throws(() => semanticName(99), /unknown semantic id/);
  ok("G7/1180：grass/cliff/shore/canal-bed/foundation/moss/waterfall 命名集锁定");
}

// ---------- TODO 1181：flow/tangent 通道 ----------
{
  const flow = [];
  const field = createScalarField({ min: [0, 0, 0], max: [1, 1, 1], resolution: 3, sample: (p) => p[0] - 0.5 });
  for (let i = 0; i < field.count; i++) flow.push(0, -1, 0); // 瀑布稳定向下
  const withFlow = createScalarField({ min: [0, 0, 0], max: [1, 1, 1], resolution: 3, data: [...field.data], flow });
  assert.deepEqual(withFlow.flowAt(1, 1, 1), [0, -1, 0]);
  assert.equal(withFlow.flow.length, withFlow.count * 3);
  assert.throws(() => createScalarField({ min: [0, 0, 0], max: [1, 1, 1], resolution: 3, flow: [1, 2, 3] }), /flow length mismatch/);
  ok("G7/1181：flow 通道 3 分量/点、长度校验、flowAt 读取");
}

// ---------- TODO 1182：dirty AABB→chunk 映射 ----------
{
  const single = dirtyAabbToChunks({ min: [0.1, 0.1, 0.1], max: [0.9, 0.9, 0.9], chunkSize: [1, 1, 1] });
  assert.deepEqual(single.map((c) => c.key), ["0:0:0"]);
  const cross = dirtyAabbToChunks({ min: [0.9, 0.1, 0.1], max: [1.1, 0.9, 0.9], chunkSize: [1, 1, 1] });
  assert.deepEqual(cross.map((c) => c.key).sort(), ["0:0:0", "1:0:0"], "跨界 AABB 命中两侧 chunk");
  const haloed = dirtyAabbToChunks({ min: [0.1, 0.1, 0.1], max: [0.9, 0.9, 0.9], chunkSize: [1, 1, 1], halo: 1 });
  assert.equal(haloed.length, 27, "halo=1 扩成 3×3×3");
  ok("G7/1182：dirty AABB→chunk 映射（单块/跨界/halo 扩展）");
}

// ---------- TODO 1184：field sample hash + 版本联动缓存键 ----------
{
  const bounds = { min: [0, 0, 0], max: [1, 1, 1], resolution: 4 };
  const a = createScalarField({ ...bounds, sample: (p) => p[0] + p[1] });
  const b = createScalarField({ ...bounds, sample: (p) => p[0] + p[1] });
  assert.equal(fieldSampleHash(a), fieldSampleHash(b), "同 sampler 同 hash");
  b.data[0] += 0.01;
  assert.notEqual(fieldSampleHash(a), fieldSampleHash(b), "任一采样变化 → hash 变化");
  const key = fieldCacheKey({ field: a, blueprintVersion: 3, moduleVersion: 5, recipeVersion: 7 });
  assert.ok(key.includes(fieldSampleHash(a)));
  assert.notEqual(fieldCacheKey({ field: a, blueprintVersion: 4, moduleVersion: 5, recipeVersion: 7 }), key, "blueprint 版本变化 → 缓存键变化");
  assert.notEqual(fieldCacheKey({ field: a, blueprintVersion: 3, moduleVersion: 6, recipeVersion: 7 }), key, "module 版本变化 → 缓存键变化");
  assert.notEqual(fieldCacheKey({ field: a, blueprintVersion: 3, moduleVersion: 5, recipeVersion: 8 }), key, "recipe 版本变化 → 缓存键变化");
  ok("G7/1184：fieldSampleHash + fieldCacheKey（bp/mod/rec 版本联动失效）");
}

// ---------- TODO 1185：场切片导出 PNG/SVG/JSON ----------
{
  const samplers = [
    { name: "hill", fn: (p) => sdMountain(p, { center: [0, -1, 0], radius: 1.5, height: 2 }) },
    { name: "boulder", fn: (p) => sdSphere(p, [0.8, 0.2, 0.4], 0.5) },
  ];
  const sample = (p) => sampleWithProvenance(samplers, p).value;
  const field = createScalarField({ min: [-2, -2, -2], max: [2, 2, 2], resolution: 17, sample });
  field.semantics = new Uint8Array(field.count);
  for (let i = 0; i < field.count; i++) field.semantics[i] = field.data[i] < 0 ? semanticId("grass") : 0;
  const provenanceAt = (x, y, z) => sampleWithProvenance(samplers, field.worldPosition(x, y, z)).index;
  const slice = sliceField(field, { axis: 1, index: 10, provenanceAt });
  assert.equal(slice.width, 17); assert.equal(slice.height, 17);
  // JSON：iso/语义/provenance 齐
  const json = sliceToJson(slice, { iso: 0, provenanceNames: samplers.map((s) => s.name) });
  assert.equal(json.iso, 0);
  assert.deepEqual(json.semanticNames, SEMANTIC_NAMES.slice());
  assert.deepEqual(json.provenanceNames, ["hill", "boulder"]);
  assert.equal(json.values.length, 289);
  assert.ok(json.semantics.some((s) => s === semanticId("grass")), "切片含 grass 语义");
  assert.ok(new Set(json.provenance).size >= 2, "切片含 ≥2 个 primitive provenance");
  // SVG：字符串含 iso 边界描边与语义色
  const svg = sliceToSvg(slice, { iso: 0 });
  assert.ok(svg.startsWith("<svg") && svg.includes("iso=0") && svg.includes('stroke="#000"'), "SVG 含 iso 边界");
  // PNG：编码→解码往返，尺寸一致且非纯色
  const png = sliceToPng(slice, { iso: 0 });
  const decoded = decodePng(png);
  assert.equal(decoded.width, 17); assert.equal(decoded.height, 17);
  const colors = new Set();
  for (let i = 0; i < decoded.data.length; i += 4) colors.add(`${decoded.data[i]},${decoded.data[i + 1]},${decoded.data[i + 2]}`);
  assert.ok(colors.size >= 3, "PNG 含 iso 边界黑 + 内/外多色");
  ok(`G7/1185：切片 JSON/SVG/PNG 导出（iso+语义+provenance，PNG 颜色数=${colors.size}）`);
}

// ---------- TODO 1198：中央差分 gradient normal（可选模式，默认不变） ----------
{
  const sphere = (p) => Math.hypot(...p) - 0.6;
  const field = createScalarField({ min: [-1, -1, -1], max: [1, 1, 1], resolution: 12, sample: sphere });
  const faceMesh = marchingCubes(field);
  assert.equal(faceMesh.stats.normalMode, "face", "默认面法线模式不变");
  const grad = marchingCubes(field, { normalMode: "gradient" });
  assert.equal(grad.stats.normalMode, "gradient");
  let inward = 0;
  for (let i = 0; i < grad.positions.length; i += 3) {
    const dot = grad.positions[i] * grad.normals[i] + grad.positions[i + 1] * grad.normals[i + 1] + grad.positions[i + 2] * grad.normals[i + 2];
    if (dot <= 0) inward++;
  }
  assert.equal(inward, 0, "gradient 法线全部朝外");
  // 与解析方向一致：球心→顶点
  let maxErr = 0;
  for (let i = 0; i < grad.positions.length; i += 3) {
    const len = Math.hypot(grad.positions[i], grad.positions[i + 1], grad.positions[i + 2]) || 1;
    maxErr = Math.max(maxErr, 1 - (grad.positions[i] * grad.normals[i] + grad.positions[i + 1] * grad.normals[i + 1] + grad.positions[i + 2] * grad.normals[i + 2]) / len);
  }
  assert.ok(maxErr < 0.05, `gradient 法线与解析方向最大偏差 ${maxErr.toFixed(4)} < 0.05`);
  ok(`G8/1198：gradient 中央差分法线（朝外，maxErr=${maxErr.toFixed(4)}），默认 face 不变`);
}

// ---------- TODO 1199：flow 顶点通道 + material group 输出 ----------
{
  const field = createScalarField({ min: [-1, -1, -1], max: [1, 1, 1], resolution: 12, sample: (p) => Math.hypot(...p) - 0.6 });
  const flowData = [];
  for (let i = 0; i < field.count; i++) flowData.push(0, -1, 0);
  field.flow = Float32Array.from(flowData);
  const mesh = marchingCubes(field, {
    semanticAt: (p) => (p[1] > 0 ? semanticId("grass") : semanticId("cliff")),
    materialGroups: true,
  });
  assert.ok(mesh.flow instanceof Float32Array);
  assert.equal(mesh.flow.length, mesh.positions.length, "flow 每顶点 3 分量");
  for (let i = 0; i < mesh.flow.length; i += 3) {
    assert.ok(Math.abs(mesh.flow[i]) < 1e-6 && Math.abs(mesh.flow[i + 1] + 1) < 1e-6 && Math.abs(mesh.flow[i + 2]) < 1e-6, "常量 flow 场插值不变");
  }
  assert.ok(Array.isArray(mesh.groups) && mesh.groups.length >= 2, "grass/cliff 至少两组");
  const covered = mesh.groups.reduce((sum, g) => sum + g.count, 0);
  assert.equal(covered, mesh.indices.length, "groups 连续覆盖全部 index");
  for (let g = 0; g < mesh.groups.length; g++) {
    const group = mesh.groups[g];
    if (g > 0) assert.equal(group.start, mesh.groups[g - 1].start + mesh.groups[g - 1].count, "group 区间相接");
    for (let i = group.start; i < group.start + group.count; i += 3) {
      assert.equal(mesh.semantics[mesh.indices[i]], group.material, "组内三角形语义一致");
    }
  }
  // 组内材质即命名语义 id
  assert.ok(mesh.groups.every((g) => [semanticId("grass"), semanticId("cliff")].includes(g.material)));
  ok(`G8/1199：flow 顶点通道 + material groups=${mesh.groups.length} 连续覆盖`);
}

// ---------- TODO 1201：torus fixture 全顶点法线朝外 ----------
{
  const R = 0.85; const r = 0.25;
  const field = createScalarField({ min: [-2, -2, -2], max: [2, 2, 2], resolution: 18, sample: (p) => sdTorusXZ(p, [0, 0, 0], R, r) });
  for (const mode of ["face", "gradient"]) {
    const mesh = marchingCubes(field, { normalMode: mode });
    assert.ok(mesh.stats.triangleCount > 0);
    assert.equal(mesh.stats.degenerateTriangles, 0);
    let inward = 0;
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const px = mesh.positions[i]; const py = mesh.positions[i + 1]; const pz = mesh.positions[i + 2];
      const d = Math.hypot(px, pz) || 1;
      // 环管中心圆上最近点，法线应背离它
      const ox = px - (R * px) / d; const oy = py; const oz = pz - (R * pz) / d;
      if (ox * mesh.normals[i] + oy * mesh.normals[i + 1] + oz * mesh.normals[i + 2] <= 0) inward++;
    }
    assert.equal(inward, 0, `torus(${mode}) 存在朝内法线`);
  }
  ok("G8/1201：torus fixture face/gradient 两模式全顶点法线朝外");
}

// ---------- TODO 1206：low-poly flat normal + visual/collision 同源 ----------
{
  const field = createScalarField({ min: [-1, -1, -1], max: [1, 1, 1], resolution: 10, sample: (p) => Math.hypot(...p) - 0.6 });
  const shared = marchingCubes(field);
  // visual/collision 共用同一 position/index 引用（所有模式）
  assert.equal(shared.collision.positions, shared.positions);
  assert.equal(shared.collision.indices, shared.indices);
  const flat = marchingCubes(field, { normalMode: "flat", splitVertices: true });
  assert.equal(flat.stats.normalMode, "flat");
  assert.equal(flat.stats.splitVertices, true);
  assert.equal(flat.stats.triangleCount, shared.stats.triangleCount, "split 不改变三角形数");
  assert.equal(flat.positions.length / 3, flat.indices.length, "split 后顶点=index 数");
  // 每个三角形三顶点法线相同且等于几何面法线
  for (let i = 0; i < flat.indices.length; i += 3) {
    const [a, b, c] = [flat.indices[i], flat.indices[i + 1], flat.indices[i + 2]];
    const ax = flat.positions[b * 3] - flat.positions[a * 3]; const ay = flat.positions[b * 3 + 1] - flat.positions[a * 3 + 1]; const az = flat.positions[b * 3 + 2] - flat.positions[a * 3 + 2];
    const bx = flat.positions[c * 3] - flat.positions[a * 3]; const by = flat.positions[c * 3 + 1] - flat.positions[a * 3 + 1]; const bz = flat.positions[c * 3 + 2] - flat.positions[a * 3 + 2];
    const nx = ay * bz - az * by; const ny = az * bx - ax * bz; const nz = ax * by - ay * bx;
    const len = Math.hypot(nx, ny, nz) || 1;
    for (const v of [a, b, c]) {
      assert.ok(Math.abs(flat.normals[v * 3] - nx / len) < 1e-5 && Math.abs(flat.normals[v * 3 + 1] - ny / len) < 1e-5 && Math.abs(flat.normals[v * 3 + 2] - nz / len) < 1e-5, "flat 法线=面法线");
    }
  }
  // split 顶点位置值 ⊆ 非 split 顶点位置集合
  const key = (arr, i) => `${arr[i].toFixed(6)},${arr[i + 1].toFixed(6)},${arr[i + 2].toFixed(6)}`;
  const sharedSet = new Set();
  for (let i = 0; i < shared.positions.length; i += 3) sharedSet.add(key(shared.positions, i));
  for (let i = 0; i < flat.positions.length; i += 3) assert.ok(sharedSet.has(key(flat.positions, i)), "split 位置值来自同一插值");
  assert.equal(flat.collision.positions, flat.positions, "split 模式 collision 同源");
  ok("G8/1206：flat+split low-poly 法线；visual/collision 共用 position/index");
}

// ---------- TODO 1207：24³ cells+halo 基准与均匀分辨率强制 ----------
{
  assert.equal(MC_BASELINE_CELLS, 24);
  assert.equal(MC_BASELINE_HALO, 1);
  const sample = (p) => Math.hypot(p[0] - 12, p[1] - 12, p[2] - 12) - 8;
  const mk = (origin) => createChunkField({ origin, size: [24, 24, 24], resolution: MC_BASELINE_CELLS, halo: MC_BASELINE_HALO, sample });
  const chunks = [mk([0, 0, 0]), mk([24, 0, 0])];
  assert.equal(chunks[0].field.resolution.x, MC_BASELINE_CELLS + 2 * MC_BASELINE_HALO, "24³+2halo=26³ 采样");
  assert.equal(assertUniformChunkResolution(chunks), "24x24x24");
  const odd = createChunkField({ origin: [0, 0, 0], size: [16, 16, 16], resolution: 16, halo: 1, sample });
  assert.throws(() => assertUniformChunkResolution([chunks[0], odd]), /mixed chunk resolutions/, "混合分辨率被拒绝");
  ok("G8/1207：24³+1halo 基准常量 + 相邻 chunk 分辨率均匀断言");
}

// ---------- TODO 1209：MC 分阶段计时（benchmark 由 tools/bench_procgen_v7_mc.mjs 出 JSON） ----------
{
  const field = createScalarField({ min: [-1, -1, -1], max: [1, 1, 1], resolution: 12, sample: (p) => Math.hypot(...p) - 0.6 });
  const mesh = marchingCubes(field, { normalMode: "gradient", materialGroups: true, semanticAt: () => 1 });
  const t = mesh.stats.timings;
  for (const stageName of ["meshMs", "normalMs", "groupMs"]) {
    assert.ok(Number.isFinite(t[stageName]) && t[stageName] >= 0, `timings.${stageName} 有限非负`);
  }
  ok(`G8/1209：stats.timings 分阶段（mesh=${t.meshMs.toFixed(2)}ms normal=${t.normalMs.toFixed(2)}ms group=${t.groupMs.toFixed(2)}ms）`);
}

console.log(`✅ V7-G7/G8 gap assertions=${passed}`);
