// =====================================================================
// 迷你 Bloom（S18 夜港辉光 · 主人验收 2026-08-28 参考图夜港）
// 参考建议是 UnrealBloomPass + EffectComposer；但本项目约束是零构建、
// 离线 GitHub Pages、vendor 兜底（vendor/jsm 无 postprocessing），所以
// 这里用核心 three 自包含实现同一算法：
//   场景 → 亮通（threshold + 软 knee）→ 可分离 H/V 模糊 → 屏幕叠加。
// 只让灯头/窗光/塔冠这类超亮自发光起晕；强度乘夜权重（白天为 0，
// 等价自动关闭）。开关 P.nightBloomV1，回滚即回 renderer.render 直出。
// =====================================================================
import * as THREE from "three";

export const MINI_BLOOM_SCHEMA_VERSION = 1;

function fullscreenQuad(THREE_, material) {
  const scene = new THREE_.Scene();
  const camera = new THREE_.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mesh = new THREE_.Mesh(new THREE_.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return { scene, camera };
}

const BRIGHT_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uThreshold: { value: 0.72 },
    uTexel: { value: [1 / 128, 1 / 128] },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uThreshold;
    uniform vec2 uTexel;
    varying vec2 vUv;
    void main() {
      // 3x3 降采样亮通：软 knee（低于阈值不贡献，超过平滑进入辉光）
      vec3 sum = vec3(0.0);
      for (int dy = -1; dy <= 1; dy++) {
        for (int dx = -1; dx <= 1; dx++) {
          sum += texture2D(tDiffuse, vUv + vec2(float(dx), float(dy)) * uTexel).rgb;
        }
      }
      vec3 color = sum / 9.0;
      float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
      float knee = 0.28;
      float soft = clamp((luminance - uThreshold + knee) / (2.0 * knee + 1e-5), 0.0, 1.0);
      float contribution = max(luminance - uThreshold, 0.0) / max(luminance, 1e-5) * smoothstep(0.0, 1.0, soft + 1e-4);
      gl_FragColor = vec4(color * contribution, 1.0);
    }
  `,
};

const BLUR_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uDirection: { value: [1, 0] },
    uTexel: { value: [1 / 128, 1 / 128] },
  },
  vertexShader: BRIGHT_SHADER.vertexShader,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 uDirection;
    uniform vec2 uTexel;
    varying vec2 vUv;
    void main() {
      // 5-tap 高斯近似（可分离模糊）
      vec3 sum = texture2D(tDiffuse, vUv).rgb * 0.294;
      vec2 o1 = uDirection * uTexel * 1.407;
      vec2 o2 = uDirection * uTexel * 3.294;
      sum += (texture2D(tDiffuse, vUv + o1).rgb + texture2D(tDiffuse, vUv - o1).rgb) * 0.233;
      sum += (texture2D(tDiffuse, vUv + o2).rgb + texture2D(tDiffuse, vUv - o2).rgb) * 0.097 / 2.0;
      gl_FragColor = vec4(sum, 1.0);
    }
  `,
};

const COMPOSITE_SHADER = {
  uniforms: {
    tScene: { value: null },
    tBloom: { value: null },
    uStrength: { value: 0.55 },
  },
  vertexShader: BRIGHT_SHADER.vertexShader,
  fragmentShader: `
    uniform sampler2D tScene;
    uniform sampler2D tBloom;
    uniform float uStrength;
    varying vec2 vUv;
    void main() {
      vec3 scene = texture2D(tScene, vUv).rgb;
      vec3 bloom = texture2D(tBloom, vUv).rgb;
      gl_FragColor = vec4(scene + bloom * uStrength, 1.0);
      #include <colorspace_fragment>
    }
  `,
};

/**
 * 创建迷你 bloom 后处理。render(scene, camera) 替代 renderer.render。
 * @param {THREE} THREE_
 * @param {THREE.WebGLRenderer} renderer
 * @param {{ strength?: number, threshold?: number, getTimeOfDay?: () => number, nightWeightAt?: (t: number) => number }} opts
 */
export function createMiniBloom(THREE_, renderer, {
  strength = 0.55,
  threshold = 0.72,
  getTimeOfDay = () => 0.5,
  nightWeightAt = (tod) => (tod >= 0.62 || tod < 0.22 ? 1 : 0),
} = {}) {
  if (!THREE_?.WebGLRenderTarget || !renderer) throw new Error("mini bloom requires THREE and renderer");
  const rtOptions = {
    type: THREE_.HalfFloatType,
    depthBuffer: true,
    stencilBuffer: false,
  };
  let width = Math.max(2, renderer.domElement?.width || 2);
  let height = Math.max(2, renderer.domElement?.height || 2);
  const rtScene = new THREE_.WebGLRenderTarget(width, height, rtOptions);
  const halfW = Math.max(2, Math.floor(width / 2));
  const halfH = Math.max(2, Math.floor(height / 2));
  const rtBright = new THREE_.WebGLRenderTarget(halfW, halfH, { ...rtOptions, depthBuffer: false });
  // 模糊链降四分之一分辨率（2026-08-28 性能）：辉光本来就是低频内容
  const quarterW = Math.max(2, Math.floor(width / 4));
  const quarterH = Math.max(2, Math.floor(height / 4));
  const rtBlurA = new THREE_.WebGLRenderTarget(quarterW, quarterH, { ...rtOptions, depthBuffer: false });
  const rtBlurB = new THREE_.WebGLRenderTarget(quarterW, quarterH, { ...rtOptions, depthBuffer: false });

  const brightMaterial = new THREE_.ShaderMaterial(BRIGHT_SHADER);
  const blurMaterial = new THREE_.ShaderMaterial(BLUR_SHADER);
  const compositeMaterial = new THREE_.ShaderMaterial(COMPOSITE_SHADER);
  const brightQuad = fullscreenQuad(THREE_, brightMaterial);
  const blurQuad = fullscreenQuad(THREE_, blurMaterial);
  const compositeQuad = fullscreenQuad(THREE_, compositeMaterial);

  let disposed = false;
  let renderCount = 0;

  const setSize = (w, h) => {
    width = Math.max(2, Math.floor(w));
    height = Math.max(2, Math.floor(h));
    rtScene.setSize(width, height);
    rtBright.setSize(Math.max(2, Math.floor(width / 2)), Math.max(2, Math.floor(height / 2)));
    rtBlurA.setSize(Math.max(2, Math.floor(width / 4)), Math.max(2, Math.floor(height / 4)));
    rtBlurB.setSize(Math.max(2, Math.floor(width / 4)), Math.max(2, Math.floor(height / 4)));
    const texel = [1 / width, 1 / height];
    const blurTexel = [1 / Math.max(2, Math.floor(width / 4)), 1 / Math.max(2, Math.floor(height / 4))];
    brightMaterial.uniforms.uTexel.value = texel;
    blurMaterial.uniforms.uTexel.value = blurTexel;
  };
  setSize(width, height);

  // ---- 帧时间自适应降级（2026-08-28 卡顿治理）----
  // 夜间 bloom 激活时记录帧间隔；滚动均值 > 26ms（<38fps）持续 45 帧
  // → 永久回落 renderer.render 直出（下次刷新恢复）。跳过 >250ms 的
  // 切后台间隔。
  let lastFrameNow = null;
  let degraded = false;
  const frameIntervals = [];
  const recordFrame = (now = performance.now()) => {
    if (lastFrameNow !== null) {
      const interval = now - lastFrameNow;
      if (interval > 0 && interval < 250) {
        frameIntervals.push(interval);
        if (frameIntervals.length > 45) frameIntervals.shift();
      }
    }
    lastFrameNow = now;
    if (!degraded && frameIntervals.length >= 45) {
      const avg = frameIntervals.reduce((sum, v) => sum + v, 0) / frameIntervals.length;
      if (avg > 26) degraded = true;
    }
    return degraded;
  };

  const render = (scene, camera) => {
    recordFrame();
    if (disposed || degraded) return renderer.render(scene, camera);
    renderCount += 1;
    const nightWeight = nightWeightAt(getTimeOfDay());
    if (nightWeight <= 0.001) {
      // 白天：直出（辉光强度为 0，省掉全部后处理 pass）
      renderer.setRenderTarget(null);
      return renderer.render(scene, camera);
    }
    // 1. 场景 → RT
    renderer.setRenderTarget(rtScene);
    renderer.render(scene, camera);
    // 2. 亮通 → half
    brightMaterial.uniforms.tDiffuse.value = rtScene.texture;
    renderer.setRenderTarget(rtBright);
    renderer.render(brightQuad.scene, brightQuad.camera);
    // 3. H/V 可分离模糊（half → quarterA → quarterB）
    blurMaterial.uniforms.uDirection.value = [1, 0];
    blurMaterial.uniforms.tDiffuse.value = rtBright.texture;
    renderer.setRenderTarget(rtBlurA);
    renderer.render(blurQuad.scene, blurQuad.camera);
    blurMaterial.uniforms.uDirection.value = [0, 1];
    blurMaterial.uniforms.tDiffuse.value = rtBlurA.texture;
    renderer.setRenderTarget(rtBlurB);
    renderer.render(blurQuad.scene, blurQuad.camera);
    // 4. 合成到屏幕
    compositeMaterial.uniforms.tScene.value = rtScene.texture;
    compositeMaterial.uniforms.tBloom.value = rtBlurB.texture;
    compositeMaterial.uniforms.uStrength.value = strength * nightWeight;
    renderer.setRenderTarget(null);
    renderer.render(compositeQuad.scene, compositeQuad.camera);
    return undefined;
  };

  const dispose = () => {
    disposed = true;
    rtScene.dispose();
    rtBright.dispose();
    rtBlurA.dispose();
    rtBlurB.dispose();
    brightMaterial.dispose();
    blurMaterial.dispose();
    compositeMaterial.dispose();
  };

  return {
    render,
    setSize,
    dispose,
    recordFrame,
    get degraded() {
      return degraded;
    },
    get params() {
      return { strength, threshold, version: MINI_BLOOM_SCHEMA_VERSION };
    },
    get renderCount() {
      return renderCount;
    },
    setNightWeightSource(fn) {
      if (typeof fn === "function") getTimeOfDay = fn;
    },
  };
}
