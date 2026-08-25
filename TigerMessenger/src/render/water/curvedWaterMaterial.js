// Curved water stays one static mesh; only a low-cost vertex wave and a
// bounded night grade run on the GPU.  No per-frame topology rebuild.

export function createCurvedWaterMaterial(THREE, { color = 0x4a8fa0, opacity = 0.84, night = 1, kind = "ocean" } = {}) {
  const base = new THREE.Color(color);
  const waterKind = kind === "lake" ? 1 : 0;
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uNight: { value: night },
      uColor: { value: base },
      uOpacity: { value: opacity },
      uWaterKind: { value: waterKind },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uWaterKind;
      attribute vec4 waterData0;
      attribute vec4 waterData1;
      varying vec3 vNormal;
      varying float vWave;
      varying vec3 vRadial;
      varying vec4 vWater0;
      varying vec4 vWater1;
      void main() {
        vec3 radial = normalize(position);
        float phase = dot(radial, vec3(1.7, 0.6, -1.1));
        float oceanWave = sin(phase * 8.0 + uTime * 0.9) * 0.045 + cos(phase * 13.0 - uTime * 0.57) * 0.022;
        float lakeWave = sin(phase * 13.0 + uTime * 0.55) * 0.014 + cos(phase * 21.0 - uTime * 0.31) * 0.006;
        float wave = mix(oceanWave, lakeWave, uWaterKind);
        vec3 p = position + radial * wave;
        vWave = wave;
        vRadial = radial;
        vWater0 = waterData0;
        vWater1 = waterData1;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uNight;
      uniform float uOpacity;
      uniform float uWaterKind;
      varying vec3 vNormal;
      varying float vWave;
      varying vec3 vRadial;
      varying vec4 vWater0;
      varying vec4 vWater1;
      void main() {
        float light = 0.66 + 0.34 * max(dot(vNormal, normalize(vec3(0.35, 0.8, 0.42))), 0.0);
        float depth = clamp(vWater0.x, 0.0, 1.0);
        float shore = clamp(vWater0.y, 0.0, 1.0);
        float fetch = clamp(vWater0.z, 0.0, 1.0);
        float crest = smoothstep(0.014, 0.052, abs(vWave)) * (0.18 + fetch * 0.82);
        float shorelineFoam = (1.0 - smoothstep(0.05, 0.32, shore)) * smoothstep(0.008, 0.035, abs(vWave));
        float ripplePhase = length(vRadial.xz - vWater1.xy) * 155.0 + uTime * 1.15 + vWater0.w * 6.2831;
        float lakeRipple = (0.5 + 0.5 * sin(ripplePhase)) * (1.0 - smoothstep(0.15, 0.86, shore));
        float foam = mix(crest + shorelineFoam, lakeRipple * 0.2 + shorelineFoam * 0.7, uWaterKind);
        vec3 deepColor = uColor * mix(0.64, 1.0, depth);
        vec3 color = deepColor * light * mix(0.48, 1.0, uNight);
        color += vec3(0.02, 0.05, 0.065) * (vWave + 0.06) * (1.0 - uWaterKind * 0.35);
        color = mix(color, vec3(0.68, 0.86, 0.86), clamp(foam, 0.0, 1.0));
        float alpha = uOpacity * mix(0.9, 1.0, depth);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
}

export function createCurvedLakeMaterial(THREE, options = {}) {
  return createCurvedWaterMaterial(THREE, { ...options, kind: "lake" });
}
