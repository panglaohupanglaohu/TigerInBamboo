// =====================================================================
// S16 背光高光（Oskar 2024-01）：*adding another inverted mesh outline
// layer that shows up when looking into the sun. And masked by shadows.*
//
// 对山体/城堡几何克隆并等比放大（1.01–1.03）、BackSide 渲染、暖金色
// 半透明——从外部看是轮廓处的亮线（与 applyInkOutlines 的深色描边
// 互补）。三要素：
//   1) rim：法线⊥视线（轮廓边缘）时亮；
//   2) 受光遮罩：法线×太阳 > 0 的面才亮（阴影侧不显示 = masked by shadows）；
//   3) 背光因子：相机看向太阳（逆光构图）时整体最强。
// =====================================================================

export const BACKLIT_HIGHLIGHT_SCHEMA_VERSION = 1;

/**
 * 生成背光高光层。
 * @param {object} THREE three 命名空间
 * @param {import("three").Mesh} sourceMesh 源几何（山体/城堡）
 * @param {object} options
 * @param {number} [options.scale] 等比放大系数（1.01–1.03）
 * @param {number} [options.color] 高光色（暖金）
 * @param {number} [options.maxOpacity] 背光满强度时的 alpha 上限
 */
export function createBacklitHighlightLayer(THREE, sourceMesh, {
  scale = 1.02,
  color = 0xffd9a0,
  maxOpacity = 0.6,
} = {}) {
  if (!THREE?.ShaderMaterial || !sourceMesh?.geometry) throw new Error("backlit highlight requires THREE and source geometry");
  const geometry = sourceMesh.geometry.clone();
  geometry.computeVertexNormals();

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    // 反向轮廓层：放大壳的背面（内壁）位于源物体之后，默认深度测试会把它
    // 完全挡掉（这是我上一版"看不见高光"的根因）。轮廓光必须画在所有
    // 物体之上——depthTest:false + rim（法线⊥视线）只在边缘发亮，
    // 中心 alpha≈0，所以不会糊成整片光罩。
    depthTest: false,
    side: THREE.BackSide,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uSunDir: { value: new THREE.Vector3(0.6, 0.72, 0.35).normalize() },
      uCamPos: { value: new THREE.Vector3(0, 100, 0) },
      uMaxOpacity: { value: maxOpacity },
    },
    vertexShader: `
      uniform vec3 uSunDir;
      uniform vec3 uCamPos;
      varying float vRim;
      varying float vSun;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * world;
        vec3 n = normalize(normalMatrix * normal);
        vec3 viewDir = normalize(uCamPos - world.xyz);
        // 轮廓边缘（法线⊥视线）rim 高
        vRim = pow(1.0 - max(dot(n, viewDir), 0.0), 1.8);
        // 受光面遮罩：只有朝向太阳的面显示高光（阴影侧不显示）
        vSun = max(dot(n, uSunDir), 0.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uMaxOpacity;
      varying float vRim;
      varying float vSun;
      void main() {
        float alpha = vRim * smoothstep(0.04, 0.38, vSun) * uMaxOpacity;
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });

  const layer = new THREE.Mesh(geometry, material);
  layer.name = `backlit-highlight-${sourceMesh.name || "source"}`;
  layer.renderOrder = 4;
  layer.frustumCulled = false;
  layer.userData.backlitHighlight = true;
  layer.userData.backlitSchema = BACKLIT_HIGHLIGHT_SCHEMA_VERSION;
  layer.scale.setScalar(scale);
  layer.userData.sourceName = sourceMesh.name || null;

  return {
    layer,
    /**
     * 每帧驱动：传世界太阳方向与相机世界位置。
     * @param {THREE.Vector3} sunDir 世界太阳方向（从物体指向太阳）
     * @param {THREE.Vector3} cameraPosition 相机世界位置
     */
    update(sunDir, cameraPosition) {
      if (sunDir) material.uniforms.uSunDir.value.copy(sunDir);
      if (cameraPosition) material.uniforms.uCamPos.value.copy(cameraPosition);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      layer.removeFromParent();
    },
  };
}
