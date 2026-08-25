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
      varying vec3 vNormal;
      varying vec4 vTerrain0;
      varying vec4 vTerrain1;
      varying vec4 vFlow;
      varying vec3 vPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vTerrain0 = terrainData0;
        vTerrain1 = terrainData1;
        vFlow = flowData;
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
      varying vec3 vPosition;
      void main() {
        float slope = vTerrain0.y;
        float wet = vTerrain0.z;
        float forest = vTerrain1.x;
        vec3 grass = uPalette[0];
        vec3 hill = uPalette[1];
        vec3 rock = uPalette[2];
        vec3 water = uPalette[3];
        vec3 color = mix(grass, hill, smoothstep(0.12, 0.72, vTerrain0.x));
        color = mix(color, rock, smoothstep(0.38, 0.92, slope) * vTerrain1.y);
        color = mix(color, water, wet * 0.18);
        float shore = smoothstep(0.0, 0.65, vTerrain1.z);
        color = mix(color, mix(grass, water, 0.35), shore * wet * 0.16);
        float grassMask = (1.0 - smoothstep(0.28, 0.76, slope)) * (1.0 - smoothstep(0.42, 0.9, forest));
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
