// =====================================================================
// Three.js impostor material.  Motion data is per-instance; CPU updates only
// uTime/uWind/uWeather/uDay/uHeroDayWeight.  The distance channel supplies a soft edge and a cheap
// depth/normal cue without per-instance shadow maps.
// =====================================================================

export function createCloudImpostorMaterial(THREE, { atlas = null, views = 12, transparent = true } = {}) {
  if (!THREE?.ShaderMaterial) throw new Error("createCloudImpostorMaterial requires THREE");
  return new THREE.ShaderMaterial({
    transparent,
    depthWrite: false,
    uniforms: {
      uAtlas: { value: atlas },
      uTime: { value: 0 },
      uWind: { value: [1, 0] },
      uWeather: { value: 0 },
      uDay: { value: 1 },
      uHeroDayWeight: { value: 1 },
      // The atlas is a horizontal strip of square view blocks.  Sampling the
      // whole strip makes one cloud card read as a compressed white streak.
      uViews: { value: Math.max(1, views) },
    },
    vertexShader: `
      // attribute 预算：≤16（WebGL MAX_VERTEX_ATTRIBS 下限）。
      // aAnchor/aInDir/aOutDir 已不再被 shader 使用（billboard 由 path 驱动），
      // 移除声明与上传，避免整个 impostor mesh 编译失败。
      attribute float aScale;
      attribute float aRotation;
      attribute float aTimeOffset;
      attribute float aSpeed;
      attribute float aHero;
      attribute vec3 aPath0;
      attribute vec3 aPath1;
      attribute vec3 aPath2;
      attribute vec3 aPath3;
      attribute vec3 aPath4;
      attribute vec3 aPath5;
      varying vec2 vUv;
      varying float vDistance;
      varying float vHero;
      uniform float uTime;
      uniform vec2 uWind;
      uniform float uViews;
      vec3 ridgePath(float t) {
        if (t < 0.2) return mix(aPath0, aPath1, t * 5.0);
        if (t < 0.4) return mix(aPath1, aPath2, (t - 0.2) * 5.0);
        if (t < 0.6) return mix(aPath2, aPath3, (t - 0.4) * 5.0);
        if (t < 0.8) return mix(aPath3, aPath4, (t - 0.6) * 5.0);
        return mix(aPath4, aPath5, (t - 0.8) * 5.0);
      }
      void main() {
        float phase = fract(uTime * aSpeed + aTimeOffset);
        vec2 drift = uWind * (phase - 0.5) * 2.0;
        float c = cos(aRotation), s = sin(aRotation);
        vec2 local = vec2(position.x * c - position.y * s, position.x * s + position.y * c);
        local += drift;
        vec3 pathPosition = ridgePath(phase);
        // 2026-08-27 修复（飞艇验收根因）：云卡片必须在球面切平面内
        // 面向镜头。不能把路径切线直接 normalize：低云的路径可能静止，
        // 零向量会产生 NaN；也不能固定世界 Y，否则贴近极点/侧视会退化成细线。
        vec4 worldPos = modelMatrix * vec4(pathPosition, 1.0);
        vec3 radial = length(pathPosition) > 0.001 ? normalize(pathPosition) : vec3(0.0, 1.0, 0.0);
        vec3 billboardUp = normalize((modelMatrix * vec4(radial, 0.0)).xyz);
        vec3 viewDir = cameraPosition - worldPos.xyz;
        vec3 billboardForward = viewDir - billboardUp * dot(viewDir, billboardUp);
        if (length(billboardForward) < 0.001) {
          vec3 reference = abs(billboardUp.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
          billboardForward = cross(billboardUp, reference);
        }
        billboardForward = normalize(billboardForward);
        vec3 billboardRight = normalize(cross(billboardForward, billboardUp));
        billboardForward = normalize(cross(billboardUp, billboardRight));
        vec3 offset = (billboardRight * local.x + billboardForward * local.y) * aScale;
        vec4 world = vec4(worldPos.xyz + offset, 1.0);
        gl_Position = projectionMatrix * viewMatrix * world;
        // Pure-cloud atlas: keep this card inside one square block.  The
        // dedicated material has no family offset, so block 0 is the stable
        // fallback view for every instance.
        vUv = vec2(uv.x / max(1.0, uViews), uv.y);
        vDistance = 1.0 - length(uv - 0.5) * 1.8;
        vHero = aHero;
      }
    `,
    fragmentShader: `
      uniform sampler2D uAtlas;
      uniform float uWeather;
      uniform float uDay;
      uniform float uHeroDayWeight;
      varying vec2 vUv;
      varying float vDistance;
      varying float vHero;
      void main() {
        vec4 tex = texture2D(uAtlas, vUv);
        float soft = smoothstep(0.02, 0.28, vDistance);
        float alpha = tex.a * soft * mix(1.0, uHeroDayWeight, vHero);
        if (alpha < 0.01) discard;
        vec3 color = mix(tex.rgb, vec3(0.42, 0.48, 0.56), uWeather * 0.48);
        color *= mix(0.56, 1.0, uDay);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
}

// S12 shared impostor material: the same billboard pipeline renders cloud
// cards (aShape 0) and tree-canopy cards (aShape 1).  Both families sample
// the same atlas texture; aShape picks the block family (cloud blocks sit
// first, canopy blocks after them) and disables wind drift for trees.
export function createSharedImpostorMaterial(THREE, { atlas = null, cloudViews = 8, totalViews = 14, transparent = true } = {}) {
  if (!THREE?.ShaderMaterial) throw new Error("createSharedImpostorMaterial requires THREE");
  return new THREE.ShaderMaterial({
    transparent,
    depthWrite: false,
    uniforms: {
      uAtlas: { value: atlas },
      uTime: { value: 0 },
      uWind: { value: [1, 0] },
      uWeather: { value: 0 },
      uDay: { value: 1 },
      uHeroDayWeight: { value: 1 },
      uCloudViews: { value: cloudViews },
      uTotalViews: { value: totalViews },
    },
    vertexShader: `
      // attribute 预算：≤16（WebGL MAX_VERTEX_ATTRIBS 下限）。
      // aAnchor/aInDir/aOutDir 已不再被 shader 使用（billboard 由 path 驱动），
      // 移除声明与上传，避免整个 impostor mesh 编译失败。
      attribute float aScale;
      attribute float aRotation;
      attribute float aTimeOffset;
      attribute float aSpeed;
      // aHero 编码：低位 authored（0/1），高位 shape（canopy=1）→ 云 0/1、树冠 3。
      // 不新增 attribute：总 attribute 数必须 ≤ 16（WebGL MAX_VERTEX_ATTRIBS 下限）。
      attribute float aHero;
      attribute vec3 aPath0;
      attribute vec3 aPath1;
      attribute vec3 aPath2;
      attribute vec3 aPath3;
      attribute vec3 aPath4;
      attribute vec3 aPath5;
      varying vec2 vUv;
      varying float vDistance;
      varying float vHero;
      varying float vShape;
      uniform float uTime;
      uniform vec2 uWind;
      uniform float uCloudViews;
      uniform float uTotalViews;
      vec3 ridgePath(float t) {
        if (t < 0.2) return mix(aPath0, aPath1, t * 5.0);
        if (t < 0.4) return mix(aPath1, aPath2, (t - 0.2) * 5.0);
        if (t < 0.6) return mix(aPath2, aPath3, (t - 0.4) * 5.0);
        if (t < 0.8) return mix(aPath3, aPath4, (t - 0.6) * 5.0);
        return mix(aPath4, aPath5, (t - 0.8) * 5.0);
      }
      void main() {
        float shapeCode = floor(aHero / 2.0);
        float heroCode = mod(aHero, 2.0);
        float phase = fract(uTime * aSpeed + aTimeOffset);
        vec2 drift = uWind * (phase - 0.5) * 2.0 * (1.0 - shapeCode);
        float c = cos(aRotation), s = sin(aRotation);
        vec2 local = vec2(position.x * c - position.y * s, position.x * s + position.y * c);
        local += drift;
        vec3 pathPosition = ridgePath(phase);
        // 与纯云材质保持同一套球面切平面 billboard；静止路径也必须可见。
        vec4 worldPos = modelMatrix * vec4(pathPosition, 1.0);
        vec3 radial = length(pathPosition) > 0.001 ? normalize(pathPosition) : vec3(0.0, 1.0, 0.0);
        vec3 billboardUp = normalize((modelMatrix * vec4(radial, 0.0)).xyz);
        vec3 viewDir = cameraPosition - worldPos.xyz;
        vec3 billboardForward = viewDir - billboardUp * dot(viewDir, billboardUp);
        if (length(billboardForward) < 0.001) {
          vec3 reference = abs(billboardUp.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
          billboardForward = cross(billboardUp, reference);
        }
        billboardForward = normalize(billboardForward);
        vec3 billboardRight = normalize(cross(billboardForward, billboardUp));
        billboardForward = normalize(cross(billboardUp, billboardRight));
        vec3 offset = (billboardRight * local.x + billboardForward * local.y) * aScale;
        vec4 world = vec4(worldPos.xyz + offset, 1.0);
        gl_Position = projectionMatrix * viewMatrix * world;
        // Cloud family lives in blocks [0, uCloudViews), canopy in the rest.
        float blockIndex = shapeCode * uCloudViews;
        vUv = vec2((uv.x + blockIndex) / max(1.0, uTotalViews), uv.y);
        vDistance = 1.0 - length(uv - 0.5) * 1.8;
        vHero = heroCode;
        vShape = shapeCode;
      }
    `,
    fragmentShader: `
      uniform sampler2D uAtlas;
      uniform float uWeather;
      uniform float uDay;
      uniform float uHeroDayWeight;
      varying vec2 vUv;
      varying float vDistance;
      varying float vHero;
      varying float vShape;
      void main() {
        vec4 tex = texture2D(uAtlas, vUv);
        float soft = smoothstep(0.02, 0.28, vDistance);
        float alpha = tex.a * soft * mix(1.0, uHeroDayWeight, vHero);
        if (alpha < 0.01) discard;
        // Weather dims the cloud sea; tree crowns stay closer to their
        // baked green so the slope reads as vegetation in any weather.
        vec3 color = mix(tex.rgb, vec3(0.42, 0.48, 0.56), uWeather * 0.48 * mix(1.0, 0.25, vShape));
        color *= mix(0.56, 1.0, uDay);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
}
