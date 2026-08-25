// =====================================================================
//  K3 · 体素 AO —— Three 侧装配（垂直样片：第一层瀑布—木马—相邻楼梯/门洞）
//  - 纯逻辑（坐标/栅格化/AO/dirty/分帧）全在 ./voxelVolume.js（可 Node 单测）
//  - 本文件：current-mesh occupancy adapter（从现有 Three 网格栅格化）、
//    slice-atlas DataTexture 上传（dirty 只上传受影响切片）、材质注入
//    （onBeforeCompile 三线性采样 + 边界淡出）、contact shadow 贴片、调试视图
//  - 开关：?oskLightingV1=1&voxelAoV1=1（挂在 V5 之下，默认关，不进持久化）
//  - K7-577 context loss：lost 时挂起 AO 更新、回退无 AO 直照（uVoxelAoEnabled=0，
//    丢弃在飞分帧任务，只置标志位不抛异常）；restored 时标 AO 全量 dirty 重建；
//    结构化 console.warn 只报一次
// =====================================================================
import * as THREE from "three";
import {
  VOXEL_AO_VERSION,
  createVoxelVolume,
  fitVolumeRegion,
  rasterizeTriangles,
  computeScalarAo,
  countSolidVoxels,
  hashVolume,
  createDirtyTracker,
  runBudgeted,
} from "./voxelVolume.js";

const _box = new THREE.Box3();
const _meshBox = new THREE.Box3();
const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();

// 注入 shader 的材质类型（Basic/Shader/Points/Line/透明水面等一律排除）
// K6-562：带烘焙遮蔽（aoMap 或 userData.bakedOcclusion）的材质不注入 voxel AO，
// 防止同一遮蔽重复相乘。本项目顶点色只承担 albedo 手绘色块（见
// citadelTown makeTownscaperShadeFactory 注释），不算遮蔽来源。
export const INJECTABLE = (m) =>
  m &&
  (m.isMeshToonMaterial ||
    m.isMeshLambertMaterial ||
    m.isMeshStandardMaterial ||
    m.isMeshPhongMaterial) &&
  !m.aoMap &&
  m.userData?.bakedOcclusion !== true;

// ---------------------------------------------------------------------
//  shader 注入：worldPos/normal → atlas 三线性采样 + 边界淡出
// ---------------------------------------------------------------------

const AO_VERT_VARY = `
varying vec3 vVoxelAoWorldPos;
varying vec3 vVoxelAoWorldNormal;
`;

const AO_VERT_BODY = `
#include <project_vertex>
{
  vec4 voxelAoWP = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    voxelAoWP = instanceMatrix * voxelAoWP;
  #endif
  vVoxelAoWorldPos = (modelMatrix * voxelAoWP).xyz;
  vVoxelAoWorldNormal = inverseTransformDirection(transformedNormal, viewMatrix);
}
`;

const AO_FRAG_HEAD = `
varying vec3 vVoxelAoWorldPos;
varying vec3 vVoxelAoWorldNormal;
uniform sampler2D tVoxelAoAtlas;
uniform vec3 uVoxelAoOrigin;   // 体素 (0,0,0) 最小角世界坐标
uniform vec3 uVoxelAoDims;     // nx,ny,nz
uniform float uVoxelAoSize;    // 体素边长（世界单位）
uniform vec2 uVoxelAoAtlasInv; // 1/图集宽, 1/图集高
uniform float uVoxelAoStrength;
uniform float uVoxelAoGain;
uniform float uVoxelAoFade;    // 边界淡出宽度（体素数）
uniform float uVoxelAoEnabled;
uniform float uVoxelAoDebug;   // 1 = AO 灰度调试视图

float voxelAoFetch(ivec3 c) {
  c = clamp(c, ivec3(0), ivec3(uVoxelAoDims) - 1);
  float u = (float(c.x) + 0.5) * uVoxelAoAtlasInv.x;
  float v = (float(c.z) * uVoxelAoDims.y + float(c.y) + 0.5) * uVoxelAoAtlasInv.y;
  return texture(tVoxelAoAtlas, vec2(u, v)).r;
}

// world position/normal 的 atlas 采样：手工三线性（跨切片插值，墙面不出切片接缝）
float voxelAoSample(vec3 wp, vec3 wn) {
  if (uVoxelAoEnabled < 0.5) return 0.0;
  vec3 p = wp + wn * (uVoxelAoSize * 0.3); // 沿法线外偏，采表面外侧空体素
  vec3 g = (p - uVoxelAoOrigin) / uVoxelAoSize - 0.5; // 整数点 = 体素中心
  // 边界淡出：距体积任一边 < uVoxelAoFade 体素时渐隐到无 AO（体积外自然为 0）
  vec3 lo = g + 0.5;
  vec3 hi = uVoxelAoDims - 0.5 - g;
  float edge = min(min(lo.x, lo.y), lo.z);
  edge = min(edge, min(min(hi.x, hi.y), hi.z));
  float fade = clamp(edge / uVoxelAoFade, 0.0, 1.0);
  if (fade <= 0.0) return 0.0;
  vec3 base = floor(g);
  vec3 f = g - base;
  ivec3 b = ivec3(base);
  float c000 = voxelAoFetch(b);
  float c100 = voxelAoFetch(b + ivec3(1, 0, 0));
  float c010 = voxelAoFetch(b + ivec3(0, 1, 0));
  float c110 = voxelAoFetch(b + ivec3(1, 1, 0));
  float c001 = voxelAoFetch(b + ivec3(0, 0, 1));
  float c101 = voxelAoFetch(b + ivec3(1, 0, 1));
  float c011 = voxelAoFetch(b + ivec3(0, 1, 1));
  float c111 = voxelAoFetch(b + ivec3(1, 1, 1));
  float c00 = mix(c000, c100, f.x);
  float c10 = mix(c010, c110, f.x);
  float c01 = mix(c001, c101, f.x);
  float c11 = mix(c011, c111, f.x);
  return mix(mix(c00, c10, f.y), mix(c01, c11, f.y), f.z) * fade;
}
`;

const AO_FRAG_APPLY = `
{
  float voxelAoOcc = voxelAoSample(vVoxelAoWorldPos, normalize(vVoxelAoWorldNormal));
  // 强度克制：mix 上限 uVoxelAoStrength（默认 0.35），彩砖接缝不压纯黑
  float voxelAoFactor = 1.0 - uVoxelAoStrength * clamp(voxelAoOcc * uVoxelAoGain, 0.0, 1.0);
  outgoingLight = mix(outgoingLight * voxelAoFactor, vec3(voxelAoFactor), uVoxelAoDebug);
}
#include <opaque_fragment>
`;

// ---------------------------------------------------------------------
//  contact shadow：圆形渐变贴片（士兵/木马不写静态体积，用贴片代替接地影）
// ---------------------------------------------------------------------

let _contactShadowTex = null;
function getContactShadowTexture() {
  if (_contactShadowTex) return _contactShadowTex;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(24,18,12,0.6)");
  grad.addColorStop(0.55, "rgba(24,18,12,0.28)");
  grad.addColorStop(1, "rgba(24,18,12,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  _contactShadowTex = new THREE.CanvasTexture(canvas);
  return _contactShadowTex;
}

/** 轻量脚底 contact shadow（圆形渐变贴片；不进 AO 体积、不投太阳阴影，避免重影） */
export function createContactShadow(radius = 0.6, opacity = 0.3) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({
      map: getContactShadowTexture(),
      transparent: true,
      opacity,
      depthWrite: false,
    })
  );
  mesh.name = "voxel-ao-contact-shadow";
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.04;
  mesh.renderOrder = 6;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.userData.voxelAoExclude = true;
  return mesh;
}

// ---------------------------------------------------------------------
//  体素 AO 系统
// ---------------------------------------------------------------------

/**
 * @param {object} deps
 *   { scene, renderer, camera,
 *     regionObjects: Object3D[]  // 体积范围来源（第一层瀑布 + 木马），Box3 并集外扩
 *     excludeRoots: Object3D[]   // 不写静态体积（木马本体 / 士兵）
 *     contactShadows: [{ object, radius, y? }]  // 贴片宿主
 *     voxelSize=0.5, aoRadius=4, strength=0.35, budgetMs=4, debug="" }
 */
export function createVoxelAoSystem({
  scene,
  renderer,
  camera = null,
  regionObjects = [],
  excludeRoots = [],
  contactShadows = [],
  voxelSize = 0.5,
  aoRadius = 4,
  strength = 0.35,
  budgetMs = 4,
  debug = "",
}) {
  // ---------- 体积范围：regionObjects 的 Box3 并集外扩 ~20% ----------
  const regionBox = new THREE.Box3();
  let hasRegion = false;
  for (const obj of regionObjects) {
    if (!obj) continue;
    obj.updateWorldMatrix(true, true);
    _box.setFromObject(obj);
    if (_box.isEmpty()) continue;
    regionBox.union(_box);
    hasRegion = true;
  }
  if (!hasRegion) return null;

  const fit = fitVolumeRegion(regionBox.min.toArray(), regionBox.max.toArray(), {
    voxelSize,
    padVoxels: aoRadius * 2,
  });
  const volume = createVoxelVolume(fit);
  const [nx, ny, nz] = volume.dims;
  // 最终体积盒（含外扩），调试视图/着色器边界以此为准
  const volumeBox = new THREE.Box3(
    new THREE.Vector3().fromArray(volume.origin),
    new THREE.Vector3(
      volume.origin[0] + nx * volume.voxelSize,
      volume.origin[1] + ny * volume.voxelSize,
      volume.origin[2] + nz * volume.voxelSize
    )
  );

  // ---------- slice-atlas 纹理（宽 nx、高 ny*nz；z 切片沿纵轴堆叠） ----------
  const atlasTex = new THREE.DataTexture(volume.ao, nx, ny * nz, THREE.RedFormat, THREE.UnsignedByteType);
  atlasTex.name = "voxel-ao-slice-atlas";
  atlasTex.minFilter = THREE.NearestFilter;
  atlasTex.magFilter = THREE.NearestFilter;
  atlasTex.wrapS = THREE.ClampToEdgeWrapping;
  atlasTex.wrapT = THREE.ClampToEdgeWrapping;
  atlasTex.generateMipmaps = false;
  atlasTex.unpackAlignment = 1;
  atlasTex.needsUpdate = true;

  const sharedUniforms = {
    tVoxelAoAtlas: { value: atlasTex },
    uVoxelAoOrigin: { value: new THREE.Vector3().fromArray(volume.origin) },
    uVoxelAoDims: { value: new THREE.Vector3(nx, ny, nz) },
    uVoxelAoSize: { value: volume.voxelSize },
    uVoxelAoAtlasInv: { value: new THREE.Vector2(1 / nx, 1 / (ny * nz)) },
    uVoxelAoStrength: { value: 0 }, // 首次全量构建完成前不露 AO（半成品切片不上屏）
    uVoxelAoGain: { value: 2.2 },
    uVoxelAoFade: { value: aoRadius },
    uVoxelAoEnabled: { value: 1 },
    uVoxelAoDebug: { value: 0 },
  };

  // ---------- 材质注入（共享 toon 材质缓存安全：onBeforeCompile 链式追加） ----------
  function injectMaterial(mat) {
    if (!INJECTABLE(mat) || mat.userData.voxelAoInjected) return;
    mat.userData.voxelAoInjected = true;
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (shader, r) => {
      prev?.(shader, r);
      Object.assign(shader.uniforms, sharedUniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>${AO_VERT_VARY}`)
        .replace("#include <project_vertex>", AO_VERT_BODY);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>${AO_FRAG_HEAD}`)
        .replace("#include <opaque_fragment>", AO_FRAG_APPLY);
    };
    mat.needsUpdate = true;
  }

  // ---------- current-mesh occupancy adapter：收集区域内静态网格 ----------
  const excludeSet = new Set(excludeRoots.filter(Boolean));

  function isExcluded(o) {
    let p = o;
    while (p) {
      if (excludeSet.has(p) || p.userData?.voxelAoExclude) return true;
      if (p.visible === false) return true; // 隐藏链不参与栅格化
      p = p.parent;
    }
    return false;
  }

  function collectMeshes() {
    const out = [];
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      if (!o.isMesh || !o.geometry?.attributes?.position || !o.material) return;
      if (isExcluded(o)) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const solid = mats.some((m) => INJECTABLE(m) && !m.transparent && m.side !== THREE.BackSide);
      if (!solid) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      _meshBox.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
      if (!_meshBox.intersectsBox(volumeBox)) return;
      out.push(o);
    });
    return out;
  }

  /** 单网格世界空间三角形提取（含 InstancedMesh；无剔除，供缓存复用） */
  function extractMeshTriangles(mesh) {
    const arr = [];
    const geom = mesh.geometry;
    const pos = geom.attributes.position;
    const idx = geom.index;
    const triMaxCount = Math.floor((idx ? idx.count : pos.count) / 3);
    const emit = (mat4, i0, i1, i2) => {
      for (const i of [i0, i1, i2]) {
        _v.fromBufferAttribute(pos, i).applyMatrix4(mat4);
        arr.push(_v.x, _v.y, _v.z);
      }
    };
    const emitRange = (mat4) => {
      for (let t = 0; t < triMaxCount; t++) {
        const a = t * 3;
        if (idx) emit(mat4, idx.getX(a), idx.getX(a + 1), idx.getX(a + 2));
        else emit(mat4, a, a + 1, a + 2);
      }
    };
    if (mesh.isInstancedMesh) {
      for (let k = 0; k < mesh.count; k++) {
        mesh.getMatrixAt(k, _m);
        _m.premultiply(mesh.matrixWorld);
        emitRange(_m);
      }
    } else {
      emitRange(mesh.matrixWorld);
    }
    return new Float32Array(arr);
  }

  // 三角形缓存：mesh.uuid → { geomVersion, matrix, tris }；几何/位姿未变则复用。
  // 编辑器重建会换 mesh（uuid 变），旧条目自然作废；重建前的 dirty 提取因此只重算新网格。
  const meshTriCache = new Map();
  function getMeshTriangles(mesh) {
    const cached = meshTriCache.get(mesh.uuid);
    const m = mesh.matrixWorld.elements;
    const instVersion = mesh.instanceMatrix?.version ?? 0;
    if (
      cached &&
      cached.geomVersion === mesh.geometry.version &&
      cached.instVersion === instVersion &&
      cached.matrix.every((v, i) => v === m[i])
    ) {
      return cached.tris;
    }
    const tris = extractMeshTriangles(mesh);
    meshTriCache.set(mesh.uuid, {
      geomVersion: mesh.geometry.version,
      instVersion,
      matrix: Float64Array.from(m),
      tris,
    });
    return tris;
  }

  /**
   * 拼接 + 逐三角形体积剔除 + z 切片预分桶：
   * 返回 { positions, buckets }，buckets[z] = Int32Array（该切片要测的三角形下标）。
   * 任一切片只测落在自己 z 范围的三角形，保证单片耗时 ≤4ms。
   */
  function buildBuckets(meshes, filterBox) {
    const positions = [];
    const bucketLists = Array.from({ length: nz }, () => []);
    const costLists = Array.from({ length: nz }, () => []);
    const s = volume.voxelSize;
    for (const mesh of meshes) {
      const tris = getMeshTriangles(mesh);
      for (let t = 0; t < tris.length; t += 9) {
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        for (let k = 0; k < 9; k += 3) {
          const x = tris[t + k], y = tris[t + k + 1], z = tris[t + k + 2];
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
          if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
        }
        // 体积剔除（filterBox 默认 = 整个体积盒；dirty 时收紧到受影响 z 段）
        if (
          maxX < filterBox.min.x || minX > filterBox.max.x ||
          maxY < filterBox.min.y || minY > filterBox.max.y ||
          maxZ < filterBox.min.z || minZ > filterBox.max.z
        ) {
          continue;
        }
        const ti = positions.length / 9;
        for (let k = 0; k < 9; k++) positions.push(tris[t + k]);
        // z 分桶：与 rasterizeTriangles 同一候选范围约定（ceil-1 / floor）
        let za = Math.ceil((minZ - volume.origin[2]) / s) - 1;
        let zb = Math.floor((maxZ - volume.origin[2]) / s);
        if (za < 0) za = 0;
        if (zb > nz - 1) zb = nz - 1;
        // 单切片候选体素数（x×y 同约定）：大三角形跨半个体积，任务按成本切分
        const cx0 = Math.max(0, Math.ceil((minX - volume.origin[0]) / s) - 1);
        const cx1 = Math.min(nx - 1, Math.floor((maxX - volume.origin[0]) / s));
        const cy0 = Math.max(0, Math.ceil((minY - volume.origin[1]) / s) - 1);
        const cy1 = Math.min(ny - 1, Math.floor((maxY - volume.origin[1]) / s));
        const triCost = Math.max(1, (cx1 - cx0 + 1) * (cy1 - cy0 + 1));
        for (let z = za; z <= zb; z++) {
          bucketLists[z].push(ti);
          costLists[z].push(triCost);
        }
      }
    }
    return {
      positions: new Float32Array(positions),
      buckets: bucketLists.map((l) => Int32Array.from(l)),
      costs: costLists.map((l) => Int32Array.from(l)),
    };
  }

  // ---------- dirty 调度：合并 + 扩 kernel 半径 + 分帧执行 ----------
  const tracker = createDirtyTracker({ expand: aoRadius });
  let job = null; // { kind, z0, z1, stage, tasks, cursor, triangles }
  let lastMeshes = []; // 最近一次收集的区域内网格（probe 射线用）

  const stats = {
    version: VOXEL_AO_VERSION,
    voxelSize: volume.voxelSize,
    dims: [nx, ny, nz],
    voxelCount: nx * ny * nz,
    origin: [...volume.origin],
    meshCount: 0,
    triCount: 0,
    solidVoxels: 0,
    atlasHash: null,
    builds: 0,
    dirtyBuilds: 0,
    lastExtractMs: 0,
    lastBatchMs: 0,
    maxSliceMs: 0, // 任一主线程切片耗时峰值（预算断言用）
    maxDirtySliceMs: 0, // 只统计 dirty 重建（不含初次全量 build）的切片峰值——K7 580 门
    maxRasterSliceMs: 0, // 同上，仅栅格化阶段（定位超限来源）
    maxAoSliceMs: 0, // 同上，仅 AO 计算阶段
    lastUploadMode: null,
    enabled: true,
  };

  function startJob(kind, z0, z1) {
    const t0 = performance.now();
    const meshes = collectMeshes();
    lastMeshes = meshes; // probe 射线复用（不打全场景）
    for (const mesh of meshes) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) injectMaterial(m);
    }
    // 提取范围：dirty 只取受影响切片的世界盒（扩 1 体素兜底浮点边界）；
    // full 也按体积盒剔除（星球壳等大网格的远处三角形不进内存）
    const pad = volume.voxelSize;
    const filter = new THREE.Box3(
      new THREE.Vector3(
        volumeBox.min.x - pad,
        volumeBox.min.y - pad,
        volume.origin[2] + z0 * volume.voxelSize - pad
      ),
      new THREE.Vector3(
        volumeBox.max.x + pad,
        volumeBox.max.y + pad,
        volume.origin[2] + (z1 + 1) * volume.voxelSize + pad
      )
    );
    const { positions, buckets, costs } = buildBuckets(meshes, filter);
    stats.lastExtractMs = performance.now() - t0;
    stats.meshCount = meshes.length;
    stats.triCount = positions.length / 9;
    // 任务粒度：栅格化按候选体素成本切分（RASTER_COST_CAP ≈ 1ms 级 SAT 测试量；
    // 单三角形超限也独占一个任务——最小粒度即一个三角形）；AO 每切片再按
    // AO_Y_CHUNK 行块细分（每体素只依赖 occupancy，块边界不影响结果），
    // 保证任一主线程任务 ≤4ms（稠密切片/大三角形不会在单帧内跑完整个 bucket）
    const RASTER_COST_CAP = 24000;
    const rasterTasks = [];
    for (let z = z0; z <= z1; z++) {
      const len = buckets[z].length;
      if (len === 0) {
        rasterTasks.push({ z, offset: 0, chunk: 0 }); // 空切片也要清一次（append=false）
        continue;
      }
      const cost = costs[z];
      let off = 0;
      while (off < len) {
        let acc = 0;
        let end = off;
        while (end < len && (end === off || acc + cost[end] <= RASTER_COST_CAP)) {
          acc += cost[end];
          end++;
        }
        rasterTasks.push({ z, offset: off, chunk: end - off });
        off = end;
      }
    }
    const AO_Y_CHUNK = 12;
    const aoTasks = [];
    for (let z = z0; z <= z1; z++) {
      for (let y0 = 0; y0 < ny; y0 += AO_Y_CHUNK) {
        aoTasks.push({ z, y0, y1: Math.min(ny - 1, y0 + AO_Y_CHUNK - 1) });
      }
    }
    job = {
      kind, z0, z1,
      stage: "rasterize",
      tasks: rasterTasks,
      aoTasks,
      cursor: 0,
      positions,
      buckets,
    };
  }

  function processSlice(task) {
    if (job.stage === "rasterize") {
      // 只测本切片分桶内的一段三角形（确定性：分块边界由桶内容唯一决定）
      const bucket = job.buckets[task.z];
      const end = Math.min(bucket.length, task.offset + task.chunk);
      rasterizeTriangles(volume, job.positions, {
        zRange: [task.z, task.z],
        triIndices: bucket.subarray(task.offset, end),
        append: task.offset > 0, // 首块清切片，后续块叠加
      });
    } else {
      computeScalarAo(volume, { radius: aoRadius, zRange: [task.z, task.z], yRange: [task.y0, task.y1] });
    }
  }

  /** dirty 切片局部上传（three 内部句柄；取不到则整图 needsUpdate 兜底） */
  function uploadRange(z0, z1) {
    if (z0 === 0 && z1 === nz - 1) {
      atlasTex.needsUpdate = true;
      return "full";
    }
    const gl = renderer.getContext?.();
    const glTex = renderer.properties?.get?.(atlasTex)?.__webglTexture;
    if (!gl || !glTex) {
      atlasTex.needsUpdate = true;
      return "full-fallback";
    }
    const rowStart = z0 * ny;
    const rows = (z1 - z0 + 1) * ny;
    const data = volume.ao.subarray(rowStart * nx, (rowStart + rows) * nx);
    const prev = gl.getParameter(gl.TEXTURE_BINDING_2D);
    gl.bindTexture(gl.TEXTURE_2D, glTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, rowStart, nx, rows, gl.RED, gl.UNSIGNED_BYTE, data);
    gl.bindTexture(gl.TEXTURE_2D, prev);
    return "partial";
  }

  function advanceStage() {
    if (job.stage === "rasterize") {
      job.stage = "ao";
      job.tasks = job.aoTasks;
      job.cursor = 0;
      return;
    }
    // ao 完成 → 上传 + 收尾
    stats.lastUploadMode = uploadRange(job.z0, job.z1);
    stats.solidVoxels = countSolidVoxels(volume);
    stats.atlasHash = hashVolume(volume);
    if (job.kind === "full") {
      sharedUniforms.uVoxelAoStrength.value = strength; // 首版全量构建完成后启用
      stats.builds++;
    } else {
      stats.dirtyBuilds++;
    }
    lastDirtyBox = job.kind === "dirty" ? zRangeToWorldBox(job.z0, job.z1) : null;
    if (lastDirtyBox && dirtyHelper) {
      dirtyHelper.box.copy(lastDirtyBox);
      dirtyHelper.visible = true;
      dirtyHelperTimer = 2.5;
    }
    refreshOccupancyPlanes();
    job = null;
  }

  function zRangeToWorldBox(z0, z1) {
    return new THREE.Box3(
      new THREE.Vector3(volume.origin[0], volume.origin[1], volume.origin[2] + z0 * volume.voxelSize),
      new THREE.Vector3(
        volume.origin[0] + nx * volume.voxelSize,
        volume.origin[1] + ny * volume.voxelSize,
        volume.origin[2] + (z1 + 1) * volume.voxelSize
      )
    );
  }

  // ---------- contact shadow 贴片（士兵/木马；不写静态体积） ----------
  const contactMeshes = [];
  for (const spec of contactShadows) {
    if (!spec?.object) continue;
    const m = createContactShadow(spec.radius ?? 0.6, spec.opacity ?? 0.3);
    if (spec.y != null) m.position.y = spec.y;
    spec.object.add(m);
    contactMeshes.push(m);
  }

  // ---------- K7-577 context loss：挂起 AO、回退无 AO 直照、restored 全量重建 ----------
  let contextLost = false;
  let contextWarned = false;

  function onContextLost() {
    if (contextLost) return;
    contextLost = true;
    job = null; // 丢弃在飞的分帧任务（GPU 侧 atlas 已失效，续跑无意义）
    sharedUniforms.uVoxelAoEnabled.value = 0; // 回退无 AO 直照（着色器早退）
    for (const m of contactMeshes) m.visible = false;
    if (!contextWarned) {
      contextWarned = true;
      console.warn("[v5-lighting] webglcontextlost", {
        code: "VOXEL_AO_CONTEXT_LOST",
        scope: "voxelAoRenderer",
        action: "suspend-ao-fallback-direct",
      });
    }
  }

  function onContextRestored() {
    if (!contextLost) return;
    contextLost = false;
    // context 恢复后 atlas 纹理句柄已失效：标记 AO 全量 dirty（CPU 侧 volume 数据仍在，
    // 走正常分帧管线重栅格 + 整图重传），并恢复 AO/贴片可见性
    tracker.markWorldRange(volume, null, null);
    atlasTex.needsUpdate = true;
    sharedUniforms.uVoxelAoEnabled.value = stats.enabled ? 1 : 0;
    for (const m of contactMeshes) m.visible = stats.enabled;
  }

  // 监听挂在渲染 canvas 上；无 DOM 环境（Node 单测 mock renderer）静默跳过，
  // 处理器同时经返回值暴露供测试直调。
  const contextCanvas = renderer?.domElement;
  if (contextCanvas?.addEventListener) {
    contextCanvas.addEventListener("webglcontextlost", onContextLost);
    contextCanvas.addEventListener("webglcontextrestored", onContextRestored);
  }

  // ---------- 调试视图（?voxelAoDebug=ao,occupancy,volume,dirty,probe） ----------
  const modes = new Set(String(debug || "").split(",").map((s) => s.trim()).filter(Boolean));
  let volumeHelper = null;
  let dirtyHelper = null;
  let dirtyHelperTimer = 0;
  let lastDirtyBox = null;
  let occupancyGroup = null;
  let probeEl = null;
  let probeTimer = 0;
  const probeRay = new THREE.Raycaster();
  const probeNdc = new THREE.Vector2(0, 0);

  if (modes.has("ao")) sharedUniforms.uVoxelAoDebug.value = 1;
  if (modes.has("volume")) {
    volumeHelper = new THREE.Box3Helper(volumeBox, 0x35d0a5);
    volumeHelper.name = "voxel-ao-debug-volume";
    scene.add(volumeHelper);
  }
  if (modes.has("dirty")) {
    dirtyHelper = new THREE.Box3Helper(new THREE.Box3(), 0xff4444);
    dirtyHelper.name = "voxel-ao-debug-dirty";
    dirtyHelper.visible = false;
    scene.add(dirtyHelper);
  }

  function buildOccupancyPlanes() {
    const group = new THREE.Group();
    group.name = "voxel-ao-debug-occupancy";
    group.userData.voxelAoExclude = true;
    const levels = 6;
    for (let i = 0; i < levels; i++) {
      const y = Math.min(ny - 1, Math.floor(((i + 0.5) / levels) * ny));
      const data = new Uint8Array(nx * nz * 4);
      const tex = new THREE.DataTexture(data, nx, nz, THREE.RGBAFormat);
      tex.minFilter = tex.magFilter = THREE.NearestFilter;
      tex.needsUpdate = true;
      const mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false,
      });
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(nx * volume.voxelSize, nz * volume.voxelSize),
        mat
      );
      plane.rotation.x = -Math.PI / 2;
      const [cx, , cz] = volume.voxelCenterToWorld((nx - 1) / 2, y, (nz - 1) / 2);
      plane.position.set(cx, volume.origin[1] + (y + 0.5) * volume.voxelSize, cz);
      plane.renderOrder = 8;
      plane.userData.voxelY = y;
      group.add(plane);
    }
    return group;
  }

  /** occupancy 切片平面图内容刷新（每次上传后同步） */
  function refreshOccupancyPlanes() {
    if (!occupancyGroup) return;
    for (const plane of occupancyGroup.children) {
      const y = plane.userData.voxelY;
      const data = plane.material.map.image.data;
      for (let z = 0; z < nz; z++) {
        for (let x = 0; x < nx; x++) {
          const o = (z * nx + x) * 4;
          const solid = volume.occupancy[volume.index(x, y, z)];
          data[o] = 255;
          data[o + 1] = solid ? 64 : 200;
          data[o + 2] = 64;
          data[o + 3] = solid ? 170 : 14;
        }
      }
      plane.material.map.needsUpdate = true;
    }
  }

  if (modes.has("occupancy")) {
    occupancyGroup = buildOccupancyPlanes();
    scene.add(occupancyGroup);
    refreshOccupancyPlanes();
  }

  if (modes.has("probe")) {
    probeEl = document.createElement("div");
    probeEl.id = "voxel-ao-probe";
    probeEl.style.cssText =
      "position:fixed;left:8px;bottom:8px;z-index:9999;background:rgba(0,0,0,.55);" +
      "color:#8f8;font:12px/1.5 monospace;padding:4px 8px;border-radius:4px;pointer-events:none;white-space:pre";
    probeEl.textContent = "voxel-ao probe: --";
    document.body.appendChild(probeEl);
  }

  /** sample probe：准星射线命中点 → CPU 侧三线性采样（与着色器同约定） */
  function updateProbe() {
    if (!probeEl || !camera) return;
    probeRay.setFromCamera(probeNdc, camera);
    const hits = probeRay.intersectObjects(lastMeshes, false);
    const hit = hits.find((h) => h.object.userData?.voxelAoExclude !== true);
    if (!hit) {
      probeEl.textContent = "voxel-ao probe: 无命中";
      return;
    }
    const n = hit.face?.normal
      ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
      : new THREE.Vector3(0, 1, 0);
    const p = hit.point.clone().addScaledVector(n, volume.voxelSize * 0.3);
    const g = volume.worldToGrid(p.x, p.y, p.z);
    const occ = volume.sampleAo(g[0], g[1], g[2]);
    probeEl.textContent =
      `voxel-ao probe\nwp  ${hit.point.x.toFixed(2)}, ${hit.point.y.toFixed(2)}, ${hit.point.z.toFixed(2)}\n` +
      `vox ${g.map((v) => v.toFixed(1)).join(", ")}\nocc ${occ.toFixed(3)}  hash ${stats.atlasHash ?? "--"}`;
  }

  // ---------- 首版全量构建（入队即走分帧预算） ----------
  tracker.markWorldRange(volume, null, null);

  return {
    volume,
    regionBox: volumeBox,
    uniforms: sharedUniforms,

    /** 城堡编辑器钩子：世界包围盒 dirty（null = 整个体积） */
    markWorldDirty(box3) {
      const ok = tracker.markWorldRange(
        volume,
        box3 ? box3.min.toArray() : null,
        box3 ? box3.max.toArray() : null
      );
      return ok;
    },

    /** 主循环每帧：消费 dirty → 分帧执行（任一切片 ≤ budgetMs）；context lost 时挂起 */
    update(dt = 0.016) {
      if (!stats.enabled || contextLost) return;
      if (!job) {
        const range = tracker.consume();
        if (range) startJob(stats.builds === 0 ? "full" : "dirty", range.min[2], range.max[2]);
      }
      if (job) {
        const stage = job.stage;
        const res = runBudgeted(job, processSlice, { budgetMs, now: () => performance.now() });
        stats.lastBatchMs = res.elapsedMs;
        if (res.maxTaskMs > stats.maxSliceMs) stats.maxSliceMs = res.maxTaskMs;
        if (job.kind === "dirty" && res.maxTaskMs > stats.maxDirtySliceMs) stats.maxDirtySliceMs = res.maxTaskMs;
        const stageKey = stage === "rasterize" ? "maxRasterSliceMs" : "maxAoSliceMs";
        if (res.maxTaskMs > stats[stageKey]) stats[stageKey] = res.maxTaskMs;
        if (res.done) advanceStage();
      }
      if (dirtyHelperTimer > 0) {
        dirtyHelperTimer -= dt;
        if (dirtyHelperTimer <= 0 && dirtyHelper) dirtyHelper.visible = false;
      }
      if (probeEl) {
        probeTimer -= dt;
        if (probeTimer <= 0) {
          probeTimer = 0.25;
          updateProbe();
        }
      }
    },

    setEnabled(on) {
      stats.enabled = on === true;
      // context lost 期间保持无 AO 直照，restored 时由 onContextRestored 恢复
      sharedUniforms.uVoxelAoEnabled.value = stats.enabled && !contextLost ? 1 : 0;
      for (const m of contactMeshes) m.visible = stats.enabled && !contextLost;
    },

    isEnabled: () => stats.enabled,

    /** K7-577 context loss 状态（测试/面板只读；处理器供无 DOM 环境直调） */
    isContextLost: () => contextLost,
    handleContextLost: onContextLost,
    handleContextRestored: onContextRestored,

    /** 调试/验收：体积、hash、实测耗时、dirty 边界 */
    getDebugInfo() {
      return {
        ...stats,
        contextLost,
        strength: sharedUniforms.uVoxelAoStrength.value,
        pending: tracker.peek(),
        lastDirtyBox: lastDirtyBox
          ? { min: lastDirtyBox.min.toArray(), max: lastDirtyBox.max.toArray() }
          : null,
      };
    },

    dispose() {
      volumeHelper && scene.remove(volumeHelper);
      dirtyHelper && scene.remove(dirtyHelper);
      occupancyGroup && scene.remove(occupancyGroup);
      probeEl?.remove();
      for (const m of contactMeshes) m.parent?.remove(m);
      meshTriCache.clear();
      atlasTex.dispose();
    },
  };
}
