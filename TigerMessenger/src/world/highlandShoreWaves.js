// =====================================================================
// S13 岸浪（台地-海衔接，Oskar 2026-03 推文）：*It's based on a looping
// vertex shader. The data is baked at generation-time. Each vert has an
// in-direction, an out-direction and a time offset.*
//
// 湖岸（waterfront cutout）内侧烘焙一圈浪带：每个顶点带 in-direction
// （来浪方向，指向岸）、out-direction（退浪方向，指向湖）、time offset
// （沿岸错相 → 推进波）与振幅（近岸大、远岸衰减）。运行期一个 looping
// vertex shader 沿 in→out 循环位移，形成涌岸/退岸的循环浪。
// =====================================================================

export const SHORE_WAVES_SCHEMA_VERSION = 1;

function hashString(value) { let h = 2166136261; for (const c of String(value)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }

/**
 * 烘焙岸浪带（纯数据，headless 可测，不依赖 Three.js）。
 * 湖面开口在 z ∈ [zStart, zStart+depth]，半宽 shoreHalfWidth → basinHalfWidth。
 * 每排 z 取左右两岸，每岸沿 x 从岸线向湖内 crossStep×crossCount 生成顶点；
 * 相邻排两两连接成三角带（indices）。
 */
export function bakeHighlandShoreWaves({
  zStart = 24,
  zEnd = 58,
  rowStep = 1.2,
  crossStep = 0.95,
  crossCount = 4,
  shoreGap = 0.7,
  seed = 20260826,
  lakeCenterX = null,
  lakeHalfWidth = null,
} = {}) {
  // 湖岸线函数来自 highlandCitadelDesign；测试可注入常数实现。
  const centerX = lakeCenterX ?? ((z) => Math.sin((z - 24) * 0.16) * 1.35);
  const halfWidth = lakeHalfWidth ?? ((z) => {
    const u = Math.max(0, Math.min(1, (z - 24) / 34));
    const cap = Math.pow(Math.max(0, Math.sin(Math.PI * u)), 0.72);
    return 10.0 + cap * 22.0;
  });

  const positions = [];
  const inDirs = [];
  const outDirs = [];
  const timeOffsets = [];
  const amplitudes = [];
  const dists = [];
  const rows = [];
  const seedState = { value: seed };
  const jitter = () => {
    // 确定性伪随机（±0.2u 沿岸抖动，避免直线条带）
    seedState.value = (Math.imul(seedState.value, 1664525) + 1013904223) >>> 0;
    return (seedState.value / 4294967296) * 0.4 - 0.2;
  };

  for (let z = zStart; z <= zEnd + 1e-6; z += rowStep) {
    const c = centerX(z);
    const half = halfWidth(z);
    const row = [];
    for (const side of [-1, 1]) {
      for (let cross = 0; cross < crossCount; cross++) {
        const x = c + side * (half + shoreGap + cross * crossStep + jitter());
        // 湖面高度（与 buildCurvedLakeSurface 同公式的 4.8 基准 + 球面偏移）
        const y = lakeHeightAt(x, z);
        positions.push(x, y, z);
        // in = 指向岸（陆地），out = 指向湖（远离岸）
        const toShore = [-side, 0, 0];
        const toLake = [side, 0, 0];
        inDirs.push(...toShore);
        outDirs.push(...toLake);
        // 沿岸推进错相：z 每 rowStep 错开固定相位；近岸排比远岸排略滞后
        const t = (z - zStart) / Math.max(1, zEnd - zStart);
        const timeOffset = (z * 0.11 + cross * 0.055) % 1;
        timeOffsets.push(timeOffset);
        const dist = cross / Math.max(1, crossCount - 1);
        const amp = 0.34 * (1 - dist * 0.72);
        amplitudes.push(amp);
        dists.push(dist);
        row.push(positions.length / 3 - 1);
        void t;
      }
    }
    rows.push(row);
  }

  // 三角带：相邻排同侧连接（近岸排对近岸排，远岸对远岸）
  const indices = [];
  for (let r = 0; r < rows.length - 1; r++) {
    for (let side = 0; side < 2; side++) {
      for (let cross = 0; cross < crossCount - 1; cross++) {
        const a = rows[r][side * crossCount + cross];
        const b = rows[r][side * crossCount + cross + 1];
        const c = rows[r + 1][side * crossCount + cross + 1];
        const d = rows[r + 1][side * crossCount + cross];
        if ((r + cross) % 2 === 0) indices.push(a, b, d, b, c, d);
        else indices.push(a, b, c, a, c, d);
      }
    }
  }

  const hash = hashString(`${zStart}:${zEnd}:${rowStep}:${crossStep}:${crossCount}:${seed}:${positions.join(",")}`);
  return Object.freeze({
    version: SHORE_WAVES_SCHEMA_VERSION,
    positions: Object.freeze(positions),
    inDirs: Object.freeze(inDirs),
    outDirs: Object.freeze(outDirs),
    timeOffsets: Object.freeze(timeOffsets),
    amplitudes: Object.freeze(amplitudes),
    dists: Object.freeze(dists),
    indices: Object.freeze(indices),
    vertexCount: positions.length / 3,
    rowCount: rows.length,
    triangleCount: indices.length / 3,
    hash: `shore-waves:${hash}`,
    algorithm: "oskar-looping-vertex-shore-wave-v1",
  });
}

/** 湖面高度基准（与 buildCurvedLakeSurface 的 4.8 一致）。 */
export function lakeHeightAt(x, z, radius = 160) {
  const rhoSq = x * x + z * z;
  const offset = -(radius - Math.sqrt(Math.max(0, radius * radius - rhoSq)));
  const ripple = Math.sin(x * 0.38 + z * 0.17) * 0.009 + Math.cos(z * 0.26 - x * 0.21) * 0.006;
  return offset + 4.8 + ripple;
}

/**
 * 渲染岸浪带：一条 BufferGeometry + looping vertex shader。
 * 顶点沿 in→out 循环位移（涌岸/退岸），time offset 形成沿岸推进波；
 * 近岸振幅大、远岸衰减，fragment 按离岸距离淡出。
 */
export function createHighlandShoreWaveSystem(THREE, scene, data, { speed = 0.55 } = {}) {
  if (!THREE?.BufferGeometry || !scene) throw new Error("shore wave system requires THREE and scene");
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
  geometry.setAttribute("aInDir", new THREE.Float32BufferAttribute(data.inDirs, 3));
  geometry.setAttribute("aOutDir", new THREE.Float32BufferAttribute(data.outDirs, 3));
  geometry.setAttribute("aTimeOffset", new THREE.Float32BufferAttribute(data.timeOffsets, 1));
  geometry.setAttribute("aAmplitude", new THREE.Float32BufferAttribute(data.amplitudes, 1));
  geometry.setAttribute("aDist", new THREE.Float32BufferAttribute(data.dists, 1));
  geometry.setIndex(data.indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uWaveSpeed: { value: speed },
      uDay: { value: 1 },
    },
    vertexShader: `
      attribute vec3 aInDir;
      attribute vec3 aOutDir;
      attribute float aTimeOffset;
      attribute float aAmplitude;
      attribute float aDist;
      uniform float uTime;
      uniform float uWaveSpeed;
      varying float vDist;
      varying float vPhase;
      void main() {
        // Oskar 岸浪：looping vertex shader。phase 在 0→1 循环，
        // swell = sin 包络让顶点先涌向岸（沿 aInDir）再退回湖（沿 aOutDir）。
        float phase = fract(uTime * uWaveSpeed + aTimeOffset);
        float swell = sin(phase * 6.2831853) * 0.5 + 0.5;
        vec3 dir = normalize(mix(aOutDir, aInDir, swell));
        vec3 displaced = position + dir * aAmplitude * (0.45 + 0.55 * swell);
        // 浪高起伏：近岸更高，远岸趋平
        displaced.y += sin(phase * 6.2831853 * 1.0 + aTimeOffset * 3.0) * 0.11 * (1.0 - aDist * 0.65);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
        vDist = aDist;
        vPhase = phase;
      }
    `,
    fragmentShader: `
      uniform float uDay;
      varying float vDist;
      varying float vPhase;
      void main() {
        // 浪花：近岸白青、远岸透明；随相位闪动（涌起亮、退去暗）
        float alpha = (1.0 - vDist) * 0.5 * (0.72 + 0.28 * sin(vPhase * 6.2831853));
        if (alpha < 0.015) discard;
        vec3 foam = mix(vec3(0.62, 0.82, 0.84), vec3(0.94, 0.97, 0.96), 1.0 - vDist);
        gl_FragColor = vec4(foam * mix(0.75, 1.0, uDay), alpha);
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "highland-shore-waves";
  mesh.renderOrder = 5;
  mesh.frustumCulled = false;
  mesh.userData.shoreWaves = true;
  mesh.userData.waveAlgorithm = data.algorithm;
  mesh.userData.vertexCount = data.vertexCount;
  mesh.userData.triangleCount = data.triangleCount;
  mesh.userData.schemaHash = data.hash;
  scene.add(mesh);
  return {
    mesh,
    data,
    update(time, weather = 0, day = 1) {
      material.uniforms.uTime.value = time;
      material.uniforms.uDay.value = day;
      void weather;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      mesh.removeFromParent();
    },
  };
}
