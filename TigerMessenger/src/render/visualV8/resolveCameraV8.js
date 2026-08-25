// =====================================================================
//  V8-K0 镜头解析器 · 纯函数（不 import Three.js，不碰 fs/网络）
//  把 cameras-v1.json 的镜头规格 + landmarkManifest 锚点解析为球面世界
//  相机位姿。约定：
//    - 锚点方向 d = landmark.direction（单位向量）；"global" 用固定参考向
//    - offset.azimuthDeg 绕锚点局部 up 的方位角；offset.polarDeg 为相机
//      地面投影方向相对锚点的角距离（0=正上方俯瞰锚点）
//    - 相机位置 = 偏移方向 × (planetRadius + heightUnits)
//    - 目标点 = 锚点方向 × planetRadius（球面地表）
//    - up = 相机投影点的球面外法线
//  输出坐标按 1e-6 精度取整，保证同输入逐位一致（可 hash）。
// =====================================================================

const DEG = Math.PI / 180;
// global 组镜头的固定参考锚向（无单一 landmark 时的世界参考）
const GLOBAL_ANCHOR_DIR = Object.freeze(normalize([0.3, 0.9, -0.3]));

function normalize(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function scale(v, s) {
  return [v[0] * s, v[1] * s, v[2] * s];
}
function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function round6(v) {
  return v.map((x) => Math.round(x * 1e6) / 1e6);
}

// 锚点切平面右手基：forward 优先取 landmark.forward 的切向投影，退化时用稳定 fallback
function tangentBasis(direction, forward) {
  const d = normalize(direction);
  let f = forward ? add(forward, scale(d, -dot(forward, d))) : [0, 0, 0];
  if (Math.hypot(f[0], f[1], f[2]) < 1e-6) {
    // 极区/平行退化：选一个不与 d 平行的世界轴
    const ref = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    f = add(ref, scale(d, -dot(ref, d)));
  }
  f = normalize(f);
  const right = normalize(cross(d, f));
  return { forward: f, right };
}

/**
 * 解析单个镜头规格。
 * @param {object} spec cameras-v1.json 的单条 camera
 * @param {Map<string, {direction:number[], forward?:number[]}>} landmarks id→entry
 * @param {number} planetRadius 星球半径（由调用方从单一真源注入）
 * @returns {{id:string, position:number[], target:number[], up:number[], fov:number, near:number, far:number, seed:number, timeBand:string, weather:string}}
 */
export function resolveCameraV8(spec, landmarks, planetRadius) {
  if (!(planetRadius > 0)) throw new Error(`resolveCameraV8: planetRadius 必须 >0，实得 ${planetRadius}`);
  const isGlobal = spec.anchorLandmark === "global";
  const entry = isGlobal ? null : landmarks.get(spec.anchorLandmark);
  if (!isGlobal && !entry) throw new Error(`resolveCameraV8: 未知锚点 ${spec.anchorLandmark}`);
  const d = isGlobal ? GLOBAL_ANCHOR_DIR.slice() : normalize(entry.direction);
  const { forward, right } = tangentBasis(d, entry?.forward);
  const az = (spec.offset?.azimuthDeg ?? 0) * DEG;
  const polar = (spec.offset?.polarDeg ?? 0) * DEG;
  const height = spec.offset?.heightUnits ?? 0;
  // 相机地面投影方向：从锚点沿方位角方向偏出 polar 角
  const azDir = add(scale(forward, Math.cos(az)), scale(right, Math.sin(az)));
  const camDir = normalize(add(scale(d, Math.cos(polar)), scale(azDir, Math.sin(polar))));
  return {
    id: spec.id,
    position: round6(scale(camDir, planetRadius + height)),
    target: round6(scale(d, planetRadius)),
    up: round6(camDir),
    fov: spec.fov,
    near: spec.near,
    far: spec.far,
    seed: spec.seed,
    timeBand: spec.timeBand,
    weather: spec.weather,
  };
}

/**
 * 解析整份镜头清单。
 * @param {object} manifestJson cameras-v1.json 已解析对象
 * @param {Array<{id:string, direction:number[], forward?:number[]}>} landmarkEntries
 * @param {number} planetRadius
 */
export function resolveCameraManifestV8(manifestJson, landmarkEntries, planetRadius) {
  const landmarks = new Map((landmarkEntries || []).map((e) => [e.id, e]));
  return (manifestJson.cameras || []).map((spec) => resolveCameraV8(spec, landmarks, planetRadius));
}

/**
 * 解析结果的稳定 hash（FNV-1a），用于"机位改动必然改变 hash"的回归。
 */
export function cameraManifestPoseHash(resolved) {
  const canonical = resolved.map((c) => [c.id, c.position, c.target, c.up, c.fov, c.near, c.far]);
  let hash = 2166136261;
  for (const ch of JSON.stringify(canonical)) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `cam${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
