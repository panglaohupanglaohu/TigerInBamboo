// 轻量 4D 高斯泼溅建模（参考 4DV.ai 团队的 4D Gaussian Splatting：
// 「高斯基元集合 + 时间形变场」——本模块为其本机轻量近似）。
// 不训练、不优化、无需 CUDA：直接把原画像素初始化为高斯点云——
//   位置 = 像素锚点（x/y 按画幅映射，z 取亮度伪深度，与浮雕路径同语义）
//   颜色 = 原画像素；尺度 = 像素世界尺寸；不透明度 = 常值（高斯衰减自然羽化边缘）
// 第 4 维（时间）由程序化形变场近似：风驱动各向位移，权重随高度（底部生根）。
import * as THREE from "../assets/vendor/three/three.module.js";

const MAX_SPLATS = 9000; // 单层高斯上限（自适应步长控制）

const VERT = /* glsl */ `
attribute vec3 aColor;
attribute float aScale;
attribute float aPhase;
attribute float aOpacity;
uniform float uTime;
uniform float uWind;
uniform float uSway;      // 形变场强度（草木大、山石近 0）
uniform float uHeight;    // 层局部高度（摆动权重归一化）
uniform float uPointScale; // 视口投影换算（设备像素/单位）
varying vec3 vColor;
varying float vOpacity;

void main() {
  // 4D 形变场（程序化近似）：风驱动的时间位移场，底部权重为 0（生根）
  float w = clamp(position.y / max(uHeight, 1e-3) * 0.5 + 0.5, 0.0, 1.0);
  float t = uTime * (0.9 + uWind * 1.6) + aPhase * 6.2831;
  vec3 disp = vec3(
    sin(t + position.y * 2.2) * 0.6 + sin(t * 2.7) * 0.4,
    sin(t * 1.7 + position.x * 1.9) * 0.25,
    cos(t * 1.3 + position.x * 2.6) * 0.35
  ) * (uWind * uSway * w);
  vec4 mv = modelViewMatrix * vec4(position + disp, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aScale * uPointScale / max(-mv.z, 0.1), 1.0, 64.0);
  vColor = aColor;
  vOpacity = aOpacity;
}
`;

const FRAG = /* glsl */ `
precision mediump float;
varying vec3 vColor;
varying float vOpacity;

void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(uv, uv);
  if (r2 > 1.0) discard;
  float alpha = vOpacity * exp(-2.0 * r2); // 高斯核（σ²=1/2）径向衰减
  if (alpha < 0.012) discard;
  gl_FragColor = vec4(vColor, alpha);
}
`;

// 活跃高斯材质注册表：由主循环统一推进时间/风/投影参数
const liveMaterials = new Set();

/** 每帧推进：time 场景时钟；wind 0~1；pointScale = 画布设备像素高 / (2·tan(fov/2)) */
export function updateGaussianSplats(time, wind, pointScale) {
  for (const mat of liveMaterials) {
    mat.uniforms.uTime.value = time;
    mat.uniforms.uWind.value = wind;
    if (pointScale) mat.uniforms.uPointScale.value = pointScale;
  }
}

// 原画像素色采样：把源图画到 ref 网格尺寸的离屏画布读像素（失败则退回亮度灰）
function sampleLayerColors(sourceImage, gridWidth, gridHeight) {
  if (!sourceImage) return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = gridWidth;
    canvas.height = gridHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(sourceImage, 0, 0, gridWidth, gridHeight);
    return ctx.getImageData(0, 0, gridWidth, gridHeight).data;
  } catch (_) {
    return null;
  }
}

/** 由候选图层构建高斯点云（与 createIndependentLayerGeometry 同局部坐标/锚点语义）。
 *  返回 { object, anchor, splatCount }；像素不足/数据缺失返回 null。 */
export function createGaussianSplatLayer(ref, mask, layer, width, height, sourceImage, opts = {}) {
  const gridWidth = ref.width;
  const gridHeight = ref.height;
  if (!mask?.length || mask.length !== gridWidth * gridHeight || gridWidth < 2 || gridHeight < 2) return null;
  let pixelCount = 0;
  let sumX = 0;
  let sumY = 0;
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      if (!mask[y * gridWidth + x]) continue;
      pixelCount++;
      sumX += x;
      sumY += y;
    }
  }
  if (pixelCount < 4) return null;

  // —— 锚点与幅度：与浮雕几何路径完全一致（实体定位/安置系统复用同一语义） ——
  const centroid = layer.anchor?.centroid || [sumX / pixelCount / (gridWidth - 1), sumY / pixelCount / (gridHeight - 1)];
  const centerX = (centroid[0] - 0.5) * width;
  const centerY = (0.5 - centroid[1]) * height;
  const amplitude = ref.source === "local-luminance" ? 0.11 : 0.72;
  const centerRelief = Number.isFinite(layer.anchor?.reliefMedian)
    ? layer.anchor.reliefMedian
    : (ref.values[Math.round(centroid[1] * (gridHeight - 1)) * gridWidth + Math.round(centroid[0] * (gridWidth - 1))] || 0);
  const centerZ = THREE.MathUtils.clamp(centerRelief, -1, 1) * amplitude;

  // —— 自适应步长：把高斯数压到上限内 ——
  const stride = Math.max(1, Math.floor(Math.sqrt(pixelCount / MAX_SPLATS)));
  const cellWorld = Math.sqrt(
    ((width * stride) / (gridWidth - 1)) * ((height * stride) / (gridHeight - 1))
  );
  const colors = sampleLayerColors(sourceImage, gridWidth, gridHeight);

  const positions = [];
  const splatColors = [];
  const scales = [];
  const phases = [];
  const opacities = [];
  let minY = Infinity, maxY = -Infinity;
  for (let y = 0; y < gridHeight; y += stride) {
    for (let x = 0; x < gridWidth; x += stride) {
      if (!mask[y * gridWidth + x]) continue;
      const u = x / (gridWidth - 1);
      const fromTop = y / (gridHeight - 1);
      const relief = THREE.MathUtils.clamp(ref.values[y * gridWidth + x] || 0, -1, 1) * amplitude;
      const px = (u - 0.5) * width - centerX;
      const py = (0.5 - fromTop) * height - centerY;
      const pz = relief - centerZ;
      positions.push(px, py, pz);
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
      const i4 = (y * gridWidth + x) * 4;
      if (colors) splatColors.push(colors[i4] / 255, colors[i4 + 1] / 255, colors[i4 + 2] / 255);
      else { const g = 0.55 + 0.45 * (ref.values[y * gridWidth + x] || 0); splatColors.push(g, g * 0.96, g * 0.88); }
      scales.push(cellWorld * (1.15 + ((x * 7 + y * 13) % 5) * 0.06)); // 微抖动尺度，避免均匀栅格感
      phases.push(((x * 31 + y * 17) % 97) / 97);                     // 形变场相位（确定性散列）
      opacities.push(0.9);
    }
  }
  const splatCount = phases.length;
  if (splatCount < 4) return null;

  // 深度排序：沿画幅法线由远及近（画墙场景主视角），透明混合正确叠色
  const order = Array.from({ length: splatCount }, (_, i) => i)
    .sort((a, b) => positions[a * 3 + 2] - positions[b * 3 + 2]);
  const reorder = (arr, n) => {
    const out = new Float32Array(arr.length);
    order.forEach((src, dst) => { for (let k = 0; k < n; k++) out[dst * n + k] = arr[src * n + k]; });
    return out;
  };

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(reorder(positions, 3), 3));
  geometry.setAttribute("aColor", new THREE.Float32BufferAttribute(reorder(splatColors, 3), 3));
  geometry.setAttribute("aScale", new THREE.Float32BufferAttribute(reorder(scales, 1), 1));
  geometry.setAttribute("aPhase", new THREE.Float32BufferAttribute(reorder(phases, 1), 1));
  geometry.setAttribute("aOpacity", new THREE.Float32BufferAttribute(reorder(opacities, 1), 1));
  geometry.computeBoundingSphere();

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uWind: { value: 0.35 },
      uSway: { value: opts.sway ?? 0.03 },
      uHeight: { value: Math.max(maxY - minY, 0.05) },
      uPointScale: { value: 600 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  });
  liveMaterials.add(material);
  const points = new THREE.Points(geometry, material);
  points.renderOrder = 4;
  points.userData = { gaussianSplat: true, layerId: layer.id, splatCount };
  // 释放时从注册表摘除
  points.addEventListener("removed", () => liveMaterials.delete(material));
  return { object: points, anchor: { x: centerX, y: centerY, z: centerZ }, splatCount };
}
