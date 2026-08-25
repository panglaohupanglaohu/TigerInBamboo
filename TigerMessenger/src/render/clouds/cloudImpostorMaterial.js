// =====================================================================
// Three.js impostor material.  Motion data is per-instance; CPU updates only
// uTime/uWind/uWeather/uDay/uHeroDayWeight.  The distance channel supplies a soft edge and a cheap
// depth/normal cue without per-instance shadow maps.
// =====================================================================

export function createCloudImpostorMaterial(THREE, { atlas = null, transparent = true } = {}) {
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
    },
    vertexShader: `
      attribute vec3 aAnchor;
      attribute float aScale;
      attribute float aRotation;
      attribute vec3 aInDir;
      attribute vec3 aOutDir;
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
        vec3 tangent = normalize(ridgePath(min(1.0, phase + 0.02)) - pathPosition);
        vec3 billboardUp = normalize(pathPosition);
        vec3 billboardRight = normalize(cross(billboardUp, tangent));
        vec3 billboardForward = normalize(cross(billboardRight, billboardUp));
        vec3 offset = (billboardRight * local.x + billboardForward * local.y) * aScale;
        vec4 world = modelMatrix * vec4(pathPosition + offset, 1.0);
        gl_Position = projectionMatrix * viewMatrix * world;
        vUv = uv;
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
