// Semantic terrain material: palette data is GPU-friendly and versioned; the
// fragment loop never performs string lookups or creates objects.

export function createSemanticTerrainMaterial(THREE, { palette = [0x55875f, 0x78965e, 0x8f8060, 0x6b8f9e], night = 1 } = {}) {
  const colors = palette.map((value) => {
    const color = new THREE.Color(value);
    return [color.r, color.g, color.b];
  });
  const gpuPalette = colors.map(([r, g, b]) => new THREE.Vector3(r, g, b));
  return new THREE.ShaderMaterial({
    uniforms: {
      uPalette: { value: gpuPalette },
      uNight: { value: night },
      uTime: { value: 0 },
    },
    vertexColors: false,
    vertexShader: `
      attribute vec4 terrainData0;
      attribute vec4 terrainData1;
      attribute vec4 flowData;
      attribute vec4 climateData1;
      attribute vec4 ecologyData0;
      varying vec3 vNormal;
      varying vec4 vTerrain0;
      varying vec4 vTerrain1;
      varying vec4 vFlow;
      varying vec4 vClimate1;
      varying vec4 vEcology0;
      varying vec3 vPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vTerrain0 = terrainData0;
        vTerrain1 = terrainData1;
        vFlow = flowData;
        vClimate1 = climateData1;
        vEcology0 = ecologyData0;
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uPalette[4];
      uniform float uNight;
      uniform float uTime;
      varying vec3 vNormal;
      varying vec4 vTerrain0;
      varying vec4 vTerrain1;
      varying vec4 vFlow;
      varying vec4 vClimate1;
      varying vec4 vEcology0;
      varying vec3 vPosition;
      void main() {
        float slope = vTerrain0.y;
        float ecologicalWetness = max(vTerrain0.z, vClimate1.w);
        float precipitation = vClimate1.x;
        float wet = ecologicalWetness;
        float forest = max(vTerrain1.x, vEcology0.x);
        float grassness = vEcology0.y;
        float mud = vEcology0.w;
        vec3 grass = uPalette[0];
        vec3 hill = uPalette[1];
        vec3 rock = uPalette[2];
        vec3 water = uPalette[3];
        vec3 mudColor = vec3(0.42, 0.34, 0.24);
        vec3 snow = vec3(0.86, 0.90, 0.93);
        vec3 wetGrass = mix(grass, vec3(0.20, 0.36, 0.24), clamp(wet * 0.55 + precipitation * 0.35, 0.0, 1.0));
        vec3 color = mix(wetGrass, hill, smoothstep(0.12, 0.72, vTerrain0.x) * (1.0 - grassness * 0.35));
        color = mix(color, rock, smoothstep(0.38, 0.92, slope) * vTerrain1.y);
        color = mix(color, mudColor, mud * 0.72);
        color = mix(color, snow, (1.0 - grassness) * (1.0 - forest) * (1.0 - mud) * smoothstep(0.55, 0.92, vTerrain1.y) * smoothstep(4.2, 6.4, vTerrain0.x));
        color = mix(color, water, wet * 0.18);
        float shore = smoothstep(0.0, 0.65, vTerrain1.z);
        color = mix(color, mix(wetGrass, mix(water, mudColor, mud), 0.42), shore * wet * 0.22);
        float grassMask = (1.0 - smoothstep(0.28, 0.76, slope)) * (1.0 - smoothstep(0.42, 0.9, forest)) * max(grassness, 0.25);
        float detailNoise = fract(sin(dot(vPosition.xz, vec2(12.9898, 78.233))) * 43758.5453);
        float windBend = sin(vPosition.x * 0.18 + uTime * 0.85) * 0.5 + 0.5;
        float detail = (detailNoise * 0.55 + windBend * 0.45) * grassMask;
        color += vec3(0.045, 0.075, 0.035) * detail;
        // Contrast-aware edge ink keeps low-poly grass readable against the
        // neighboring hill without introducing a texture/object lookup.
        float contrastAwareOutline = smoothstep(0.12, 0.52, abs(dot(normalize(vNormal), normalize(vec3(0.2, 0.9, 0.3)))));
        color *= mix(0.86, 1.04, contrastAwareOutline * grassMask);
        color *= mix(0.48, 1.0, uNight) * mix(0.72, 1.0, vTerrain1.w);
        color += vec3(vFlow.x, 0.0, vFlow.y) * 0.015;
        float light = 0.72 + 0.28 * max(dot(normalize(vNormal), normalize(vec3(0.5, 0.8, 0.35))), 0.0);
        gl_FragColor = vec4(color * light, 1.0);
      }
    `,
  });
}
