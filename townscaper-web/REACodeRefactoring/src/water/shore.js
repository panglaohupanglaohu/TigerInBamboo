/**
 * shore.js — the water's edge, built from what Oskar Stålberg said about it.
 *
 *   1991101097818403263  "It's based on a looping vertex shader. The data is
 *     baked at generation-time. Each vert has an in-direction, an
 *     out-direction and a time offset."
 *   1991101097818403263 (reply)  "There is no main ocean mesh!" / "Waves do
 *     bounce ... this technique is the first time I've managed to capture both
 *     the incoming and outgoing part of the wave"
 *   1849732997945110651  "the shoreline is shown in yellow. A pushed out and
 *     smoothed shoreline is shown in blue. The waves travel from the blue line
 *     to the yellow (and back a little)."
 *   1849730611964973481  "Instead of trying to make the waves roll in and out
 *     inside one shader pass, I'm creating loads of overlapping waves that
 *     each go through their own cycle"
 *   1215644531221311488  "(Also, the wave skirt stretches further this time)"
 *
 * So, per shoreline loop:
 *   - the yellow line is the quay foot (where the stone meets the water),
 *   - the blue line is that loop pushed out to a fixed distance — measured on
 *     an approximate distance field (not a guarantee against folds) — then smoothed along the loop,
 *   - K wave ribbons follow the loop. Every vertex stores its yellow point,
 *     its blue point and a time offset; the vertex shader walks it from blue
 *     to yellow and back a little, on its own clock. Nothing is simulated.
 *   - a static skirt (bright rim at the stone + pale halo) sits under them.
 */

import * as THREE from 'three';
import { traceShoreLoops } from '../core/shore-loops.js';
import { pointInQuad } from '../core/spatial.js';
import { bakeWaveMotion, waveCycleGLSL, waveCrest } from '../core/wave-cycle.js';
import { sampleShoreline, marchShore } from '../core/shore-profile.js';

const hash01 = (n) => {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};

/** Land = columns that touch the water (solid at level 1). */
function isLand(town, cell) { return cell !== null && town.isSolid(cell, 1); }

/** Chamfer distance to land, rasterised from the real quads. */
function distanceField(town, grid, index, ptsOf, res = 0.07, pad = 2.5) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const c of grid.cells) {
    if (!isLand(town, c)) continue;
    for (const p of ptsOf(c)) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    }
  }
  if (!Number.isFinite(minX)) return null;
  minX -= pad; minZ -= pad; maxX += pad; maxZ += pad;
  const W = Math.ceil((maxX - minX) / res) + 1;
  const H = Math.ceil((maxZ - minZ) / res) + 1;
  if (!Number.isSafeInteger(W * H) || W * H > 4000000) throw new RangeError('shore distance-field budget');
  const d = new Float32Array(W * H).fill(1e9);
  for (const c of grid.cells) {
    if (!isLand(town, c)) continue;
    const pts = ptsOf(c);
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
    for (let j = Math.floor((z0 - minZ) / res); j <= Math.ceil((z1 - minZ) / res); j++) {
      for (let i = Math.floor((x0 - minX) / res); i <= Math.ceil((x1 - minX) / res); i++) {
        if (i < 0 || j < 0 || i >= W || j >= H) continue;
        if (pointInQuad(pts, minX + i * res, minZ + j * res)) d[j * W + i] = 0;
      }
    }
  }
  const S = Math.SQRT2;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i; let v = d[k]; if (v === 0) continue;
    if (i > 0) v = Math.min(v, d[k - 1] + 1);
    if (j > 0) v = Math.min(v, d[k - W] + 1);
    if (i > 0 && j > 0) v = Math.min(v, d[k - W - 1] + S);
    if (i < W - 1 && j > 0) v = Math.min(v, d[k - W + 1] + S);
    d[k] = v;
  }
  for (let j = H - 1; j >= 0; j--) for (let i = W - 1; i >= 0; i--) {
    const k = j * W + i; let v = d[k]; if (v === 0) continue;
    if (i < W - 1) v = Math.min(v, d[k + 1] + 1);
    if (j < H - 1) v = Math.min(v, d[k + W] + 1);
    if (i < W - 1 && j < H - 1) v = Math.min(v, d[k + W + 1] + S);
    if (i > 0 && j < H - 1) v = Math.min(v, d[k + W - 1] + S);
    d[k] = v;
  }
  for (let k = 0; k < d.length; k++) d[k] *= res;
  const sample = (x, z) => {
    const fi = (x - minX) / res, fj = (z - minZ) / res;
    if (fi < 0 || fj < 0 || fi >= W - 1 || fj >= H - 1) return 99;
    const i = fi | 0, j = fj | 0, tx = fi - i, tz = fj - j, o = j * W + i;
    return (d[o] * (1 - tx) + d[o + 1] * tx) * (1 - tz) + (d[o + W] * (1 - tx) + d[o + W + 1] * tx) * tz;
  };
  /** walk from (x,z) along n until the field reads `target` */
  const march = (x, z, nx, nz, target, max = 3) => {
    return marchShore(sample, x, z, nx, nz, target, max, res * 0.7);
  };
  return { sample, march };
}

/**
 * @returns {{skirt: THREE.BufferGeometry, waves: THREE.BufferGeometry}}
 */
export function buildShore(town, grid, index, { posts = [], reach = 0.7, waves = 2, foot = 0.075, shape = null, skirtWidth = 1, haloField = true } = {}) {
  if (![reach, foot].every(Number.isFinite) || reach <= 0 || foot < 0 || !Number.isInteger(waves) || waves < 0 || waves > 32) throw new RangeError('shore options');
  // 1215644531221311488 "(Also, the wave skirt stretches further this time)"：
  // 裙带宽度是**尺度**参数（片内那圈三角裙伸到约一个建筑进深），默认 1 = 旧窄带，原片宽档约 1.6。
  if (!Number.isFinite(skirtWidth) || skirtWidth < 0.5 || skirtWidth > 3) throw new RangeError('skirt width');
  // 地形变形后海岸在切面 0（水面）上的真实位置；没有 shape 时就是网格原位
  const posOf = shape ? (p) => { const [x, z] = shape.at(p, 0); return { x, z }; } : (p) => p;
  const ptsOf = shape ? (c) => c.pts.map(posOf) : (c) => c.pts;
  const loops = traceShoreLoops(grid.cells,c=>isLand(town,c));
  const field = distanceField(town, grid, index, ptsOf);

  // skirt: rim + halo (alpha, colour-mix) ; waves: per-vertex shore/sea/phase
  const sPos = [], sA = [], sArc = [], sIdx = [];
  const yLine = [], bLine = [];   // debug: the yellow and blue lines of 1849732997945110651
  const wShore = [], wSea = [], wPhase = [], wRow = [], wIdx = [];
  const wIn = [], wOut = [], wPeriod = [], wCrest = [], wWidth = [];
  const haloAll = [];              // 1664566546683899905：外圈真实外推距离，逐点
  let sv = 0, wv = 0, haloTarget = 0, haloFallback = 0, haloMarched = 0;

  for (const loop of loops) {
    if (!field) break;
    // Recompute edge normals after shape.at: anisotropic deformation changes them.
    const edges = loop.map(seg => {
      const a = posOf(seg.a), b = posOf(seg.b);
      const sign = seg.nx * (-(seg.b.z-seg.a.z)) + seg.nz * (seg.b.x-seg.a.x) >= 0 ? 1 : -1;
      const length = Math.hypot(b.x-a.x,b.z-a.z) || 1;
      return {x:a.x,z:a.z,nx:sign*-(b.z-a.z)/length,nz:sign*(b.x-a.x)/length};
    });
    const raw = edges.map((p,i) => {
      const prev = edges[(i+edges.length-1)%edges.length];
      const nx=p.nx+prev.nx,nz=p.nz+prev.nz,l=Math.hypot(nx,nz);
      return {...p,nx:l>1e-9?nx/l:p.nx,nz:l>1e-9?nz/l:p.nz};
    });
    const pts = sampleShoreline(raw);
    const N = pts.length;
    if (N < 3) continue;

    // yellow line: the quay foot. blue line: pushed out on the field, smoothed.
    const shore = pts.map((p) => ({ x: p.x + p.nx * foot, z: p.z + p.nz * foot }));
    let sea = pts.map((p, i) => {
      const d = field.march(shore[i].x, shore[i].z, p.nx, p.nz, reach + foot, reach * 3);
      return { x: shore[i].x + p.nx * d, z: shore[i].z + p.nz * d };
    });
    for (let pass = 0; pass < 6; pass++) {
      sea = sea.map((p, i) => {
        const a = sea[(i + N - 1) % N], b = sea[(i + 1) % N];
        const q = { x: p.x * 0.5 + (a.x + b.x) * 0.25, z: p.z * 0.5 + (a.z + b.z) * 0.25 };
        // Reject smoothing that puts the sea endpoint back in the rasterised land.
        return field.sample(q.x,q.z) >= 0.035 ? q : p;
      });
    }

    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      yLine.push(shore[i].x, 0.03, shore[i].z, shore[j].x, 0.03, shore[j].z);
      bLine.push(sea[i].x, 0.03, sea[i].z, sea[j].x, 0.03, sea[j].z);
    }

    // arc length for the travelling time offset
    const arc = new Float32Array(N);
    for (let i = 1; i < N; i++) arc[i] = arc[i - 1] + Math.hypot(shore[i].x - shore[i - 1].x, shore[i].z - shore[i - 1].z);
    const perimeter = arc[N-1] + Math.hypot(shore[0].x-shore[N-1].x,shore[0].z-shore[N-1].z);
    const seed = hash01(N * 7919 + Math.round(shore[0].x * 100));

    // ---- static skirt: [rim inner, rim outer, halo outer]
    // 1991099314714902634：片内岸线白带**不是**沿全岸常亮 —— 只在有浪的岸段亮起，
    // 段与段之间留缝，缝隙随时间沿岸移动、宽度来回胀缩（分段展开 / 聚散）。
    // 故给裙带烘一个弧长相位 aArc，遮挡强度由 skirtCoverage(aArc, t) 调制（见 skirtBreakGLSL）。
    const base = sv;
    // 1664566546683899905 "a distance field-like mesh skirt solution … it works
    // for calm waters"：原片那圈淡色裙带的**外缘**是沿距离场等距落点的 ——
    // 湾里变宽、岬角收紧。旧实现把外缘取成 (岸→蓝线) 矢量的 1.35 倍等比外推，
    // 湾内相邻法线收敛时它就会自己翻过去（实测 halo 三角 30/806 反向）。
    // 这里改成沿「平滑后的外推方向」在场上 march 到固定真距离；march 不到
    // （细到没有水的内港）才退回旧等比点，保证不出现超远点。
    const haloK = 1.35 * skirtWidth;
    haloTarget = (reach + foot) * haloK;
    const haloOffsets = new Float32Array(N);
    const hDir = new Float64Array(N * 2), hd = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const s = shore[i], b = sea[i];
      const vx = b.x - s.x, vz = b.z - s.z;
      const len = Math.hypot(vx, vz);
      const nx = len > 1e-9 ? vx / len : 1, nz = len > 1e-9 ? vz / len : 0;
      hDir[i * 2] = nx; hDir[i * 2 + 1] = nz;
      hd[i] = len * haloK;
      if (haloField && len > 1e-6) {
        const travelled = field.march(s.x, s.z, nx, nz, haloTarget, haloTarget * 2.5);
        // 场没走到目标（窄内港/夹缝里场本身到不了）或 marching 撞到栅格外侧读到 99
        // （travelled 反而极小）都退回等比点，别把外圈顶到岸上。
        if (travelled < haloTarget * 2.5 && travelled > haloTarget * 0.5) { hd[i] = travelled; haloMarched++; } else haloFallback++;
      }
      if (haloField) hd[i] = Math.min(hd[i], haloTarget);   // 场档：外圈一律不越过设计距离
    }
    // 沿法线外推的曲线在凹岸处必然自交（片里那句 "a skirt built by offsetting
    // along its normals breaks down in bays" 指的就是这个）。场落点只保证「距离对」，
    // 不保证「次序对」—— 再压一道次序约束：外圈每条边的走向必须与岸线同向，
    // 否则把两端顶点的外推量一起收回来（收到 0.35 倍仍不行就停在 0.35 倍）。
    for (let pass = 0; haloField && pass < 32; pass++) {
      let bad = 0;
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        const ax = shore[i].x + hDir[i * 2] * hd[i], az = shore[i].z + hDir[i * 2 + 1] * hd[i];
        const bx = shore[j].x + hDir[j * 2] * hd[j], bz = shore[j].z + hDir[j * 2 + 1] * hd[j];
        const ex = shore[j].x - shore[i].x, ez = shore[j].z - shore[i].z;
        const fl = Math.hypot(ex, ez) || 1e-9;
        const dot = ((bx - ax) * ex + (bz - az) * ez) / (fl * (Math.hypot(bx - ax, bz - az) || 1e-9));
        if (dot < 0.35) {
          const floor = 0.35 * (reach + foot) * skirtWidth;
          hd[i] = Math.max(hd[i] * 0.6, floor);
          hd[j] = Math.max(hd[j] * 0.6, floor);
          bad++;
        }
      }
      if (!bad) break;
    }
    for (let i = 0; i < N; i++) {
      const s = shore[i], b = sea[i];
      const vx = b.x - s.x, vz = b.z - s.z;
      const u = arc[i] / Math.max(perimeter, 1e-9) * Math.PI * 2;
      sPos.push(s.x - vx * 0.06 * skirtWidth, 0.006, s.z - vz * 0.06 * skirtWidth); sA.push(0.95); sArc.push(u);
      sPos.push(s.x + vx * 0.12 * skirtWidth, 0.006, s.z + vz * 0.12 * skirtWidth); sA.push(0.0); sArc.push(u);
      sPos.push(s.x + vx * 0.04 * skirtWidth, 0.004, s.z + vz * 0.04 * skirtWidth); sA.push(-0.42); sArc.push(u);   // halo: negative = tint
      hd[i] = Math.max(hd[i], 0.05 * (reach + foot) * skirtWidth);
      haloOffsets[i] = hd[i]; haloAll.push(hd[i]);
      sPos.push(s.x + hDir[i * 2] * hd[i], 0.004, s.z + hDir[i * 2 + 1] * hd[i]); sA.push(-0.0); sArc.push(u);
      sv += 4;
    }
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      const a = base + i * 4, b = base + j * 4;
      sIdx.push(a, a + 1, b, b, a + 1, b + 1);          // rim
      sIdx.push(a + 2, a + 3, b + 2, b + 2, a + 3, b + 3); // halo
    }

    // ---- K overlapping wave ribbons, each with its own clock
    for (let k = 0; k < waves; k++) {
      const wb = wv;
      const ks = seed * 10 + k * 1.7;
      for (let i = 0; i < N; i++) {
        const s = arc[i] / Math.max(perimeter,1e-9) * Math.PI * 2;
        const crest = waveCrest(s, ks);
        const motion = bakeWaveMotion(shore[i],sea[i],pts[i]);
        // smooth along the shore so crests arrive at an angle, never in lockstep
        const phase = k / waves + 0.14 * Math.sin(s * 2 + ks) + 0.05 * Math.sin(s * 5 + ks * 2.1);
        for (let row = 0; row < 2; row++) {
          wShore.push(shore[i].x, shore[i].z);
          wSea.push(sea[i].x, sea[i].z);
          wIn.push(...motion.incoming);
          wOut.push(...motion.outgoing);
          wCrest.push(crest.coverage);
          wWidth.push(crest.width);
          wPeriod.push(0.90 + 0.22 * hash01(N * 109 + k * 7919));
          wPhase.push(phase);
          wRow.push(row);
          wv++;
        }
      }
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        const a = wb + i * 2, b = wb + j * 2;
        wIdx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }

  // foam rings around steel legs standing in the sea
  for (const p of posts) {
    const base = sv;
    const R = 12;
    for (let i = 0; i < R; i++) {
      const a = (i / R) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      sPos.push(p.x + c * 0.025, 0.006, p.z + s * 0.025); sA.push(0.9);
      sPos.push(p.x + c * 0.075, 0.006, p.z + s * 0.075); sA.push(0.0);
      sv += 2;
    }
    for (let i = 0; i < R; i++) {
      const a = base + i * 2, b = base + ((i + 1) % R) * 2;
      sIdx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }

  const skirt = new THREE.BufferGeometry();
  skirt.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3));
  skirt.setAttribute('aA', new THREE.Float32BufferAttribute(sA, 1));
  skirt.setAttribute('aArc', new THREE.Float32BufferAttribute(sArc, 1));
  skirt.setIndex(sIdx);
  skirt.computeBoundingSphere();

  const wavesGeo = new THREE.BufferGeometry();
  // `position` is only used for culling bounds; the shader rebuilds the point
  const wPos = new Float32Array(wv * 3);
  for (let i = 0; i < wv; i++) { wPos[i * 3] = wShore[i * 2]; wPos[i * 3 + 1] = 0.01; wPos[i * 3 + 2] = wShore[i * 2 + 1]; }
  wavesGeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3));
  wavesGeo.setAttribute('aShore', new THREE.Float32BufferAttribute(wShore, 2));
  wavesGeo.setAttribute('aSea', new THREE.Float32BufferAttribute(wSea, 2));
  wavesGeo.setAttribute('aPhase', new THREE.Float32BufferAttribute(wPhase, 1));
  wavesGeo.setAttribute('aIn', new THREE.Float32BufferAttribute(wIn, 2));
  wavesGeo.setAttribute('aOut', new THREE.Float32BufferAttribute(wOut, 2));
  wavesGeo.setAttribute('aCrest', new THREE.Float32BufferAttribute(wCrest, 1));
  wavesGeo.setAttribute('aWidth', new THREE.Float32BufferAttribute(wWidth, 1));
  wavesGeo.setAttribute('aPeriod', new THREE.Float32BufferAttribute(wPeriod, 1));
  wavesGeo.setAttribute('aRow', new THREE.Float32BufferAttribute(wRow, 1));
  wavesGeo.setIndex(wIdx);
  wavesGeo.computeBoundingSphere();
  if (wavesGeo.boundingSphere) wavesGeo.boundingSphere.radius += 2;

  const lines = (arr) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    return g;
  };
  const stat = (arr) => {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const sd = Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length);
    return { n: arr.length, min: s[0], p50: s[s.length >> 1], max: s[s.length - 1], mean, cv: sd / mean };
  };
  return {
    skirt, waves: wavesGeo, shoreLine: lines(yLine), seaLine: lines(bLine),
    // 裙带外圈离岸距离账（1664566546683899905）：场落点时 cv→0，等比外推时 cv 大
    rings: { haloField, haloTarget, haloOffsets: haloAll, halo: stat(haloAll), haloMarched, haloFallback },
  };
}

export function makeSkirtMaterial(waterTint) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    // 裙带是贴在水面上的一层薄条：环向绕序让法线朝下，FrontSide 从上往下看几乎全被剔除
    // （同机位实测可读像素只有双面的 6%）→ 必须双面，否则「静态白边 + 淡晕」只画出零星几段。
    side: THREE.DoubleSide,
    uniforms: {
      uFoam: { value: new THREE.Color('#f7fbfa') },
      uTint: { value: waterTint },
      uTime: { value: 0 },
      uSkirtBreak: { value: 1 },     // 1 = 岸段分段（片内形制）；0 = 沿全岸常亮的旧档
      uSkirtDrift: { value: 0.35 },  // 缝隙沿岸扫过的角速度（弧度/秒）
      uSkirtGap: { value: 0.14 },    // 缝隙里残留的湿痕强度（不是全黑）
    },
    vertexShader: /* glsl */ `
      attribute float aA;
      attribute float aArc;
      uniform float uTime;
      uniform float uSkirtBreak;
      uniform float uSkirtDrift;
      uniform float uSkirtGap;
      varying float vA;
      varying float vCover;
      ${skirtBreakGLSL}
      void main() {
        float cover = skirtCoverage(aArc - uTime * uSkirtDrift);
        vCover = mix(1.0, mix(uSkirtGap, 1.0, cover), clamp(uSkirtBreak, 0.0, 1.0));
        vA = aA;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uFoam;
      uniform vec3 uTint;
      varying float vA;
      varying float vCover;
      void main() {
        // positive: foam rim; negative: the pale halo ("the skirt stretches further")
        if (vA >= 0.0) gl_FragColor = vec4(uFoam, vA * vA * vCover);
        else gl_FragColor = vec4(uTint, -vA * vCover);
        #include <colorspace_fragment>
      }`,
  });
}

/**
 * 岸段分段覆盖率：u 是沿闭合岸线的弧长相位（0..2π），整数谐波保证绕一圈接缝连续。
 * `amp` 随时间呼吸 → 白段变宽（聚）/ 变窄、缝隙张开（散），即片内 0010–0140 的展开与聚拢。
 * 与 skirtBreakGLSL 逐式同源；JS 版供测试做 CPU 孪生。
 */
export function skirtCoverage(u, time = 0, { breathe = 0.16, base = 0.34 } = {}) {
  const amp = base + breathe * Math.sin(0.55 * time);
  const raw = 0.54 + amp * Math.sin(3 * u + 1.1 - 0.35 * time) + 0.14 * Math.sin(7 * u + 2.3 - 0.62 * time);
  const t = Math.min(1, Math.max(0, (raw - 0.24) / 0.40));
  return t * t * (3 - 2 * t);
}

export const skirtBreakGLSL = /* glsl */ `
float skirtCoverage(float u) {
  float amp = 0.34 + 0.16 * sin(0.55 * uTime);
  float raw = 0.54 + amp * sin(3.0 * u + 1.1 - 0.35 * uTime)
                  + 0.14 * sin(7.0 * u + 2.3 - 0.62 * uTime);
  return smoothstep(0.24, 0.64, raw);
}`;

/**
 * 裙带分段的量具：把笔直的「亮段 / 缝」按 aArc 回放成 run。
 * 每条闭合岸线一圈从 u=0 起算（aArc 会回跳），按 `thr` 切亮/缝，报段数、缝隙占比与最长缝。
 */
export function skirtStats(geometry, time = 0, thr = 0.5, drift = 0.35, brk = 1) {
  const arc = geometry?.getAttribute?.('aArc');
  const aA = geometry?.getAttribute?.('aA');
  if (!arc || !aA) return { loops: 0, runs: 0, gaps: 0, gapShare: 0, longestGapDeg: 0, coveredShare: 0 };
  const step = arc.count / aA.count === 1 ? 1 : 4;   // 每个岸点 4 个顶点（rim in/out + halo in/out）
  const loops = [];
  let cur = null, prev = -1;
  for (let i = 0; i < arc.count; i += step) {
    const u = arc.getX(i);
    if (u < prev - 1e-6) { cur = []; loops.push(cur); }
    else if (!cur) { cur = []; loops.push(cur); }
    cur.push(u); prev = u;
  }
  let runs = 0, gaps = 0, covered = 0, total = 0, longest = 0;
  for (const loop of loops) {
    // 亮段 = 覆盖串；绕一圈因此要看「首尾是否都亮」（否则跨接缝的那一段会被切成两段）
    let inGap = false, gapStart = 0, gapSpan = 0, anyGap = false, firstCovered = false;
    for (let i = 0; i < loop.length; i++) {
      // 与顶点着色器同口径：相位先减去 uTime·uSkirtDrift（缝隙沿岸扫过），再按 uSkirtBreak 混回常亮
      const c = 1 - brk * (1 - skirtCoverage(loop[i] - time * drift, time));
      total++;
      if (c >= thr) covered++;
      const g = c < thr;
      if (i === 0) firstCovered = !g;
      if (g && !inGap) { inGap = true; anyGap = true; gaps++; gapStart = loop[i]; gapSpan = 0; }
      if (g) gapSpan = loop[i] - gapStart;
      if (!g && inGap) { inGap = false; runs++; }
      if (g) longest = Math.max(longest, gapSpan);
    }
    if (!anyGap) runs++;            // 整圈常亮 = 1 段
    else if (firstCovered && inGap) runs++;   // 首端亮、末端缝：跨接缝那段单独算一段
  }
  return {
    loops: loops.length, runs, gaps,
    gapShare: total ? +(1 - covered / total).toFixed(4) : 0,
    coveredShare: total ? +(covered / total).toFixed(4) : 0,
    longestGapDeg: +(longest * 180 / Math.PI).toFixed(1),
  };
}

/**
 * Looping vertex shader. t walks 0..1 on the vertex's own clock:
 *   0 .. tIn   the wave runs in from the blue line to the yellow line,
 *              accelerating and narrowing as it shoals;
 *   tIn .. 1   it bounces back a little and dissolves.
 * Because the wave is invisible at both ends of the loop, the wrap is seamless.
 */
export function makeWaveMaterial({ period = 4.6 } = {}) {
  if (!Number.isFinite(period) || period <= 0) throw new RangeError('wave period');
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uPeriod: { value: period },
      uCrestBreakup: { value: 1 },
      uFoam: { value: new THREE.Color('#fbfeff') },
    },
    vertexShader: /* glsl */ `
      attribute vec2 aShore;
      attribute vec2 aSea;
      attribute float aPhase;
      attribute float aRow;
      attribute vec2 aIn;
      attribute vec2 aOut;
      attribute float aPeriod;
      attribute float aCrest;
      attribute float aWidth;
      uniform float uCrestBreakup;
      uniform float uTime;
      uniform float uPeriod;
      varying float vA;
      ${waveCycleGLSL}
      void main() {
        float t = fract(uTime / (uPeriod * aPeriod) + aPhase);
        vec3 cycle = shoreCycle(t);
        float f = cycle.x + cycle.y;
        float a = cycle.z;
        vec2 center = aShore + aIn * cycle.x + aOut * cycle.y;
        float len = max(length(aIn), 1e-4);
        float w = mix(0.07, 0.24, f) * mix(1.0, aWidth, uCrestBreakup) / len;
        vec2 p = center + aIn * (aRow * w);
        vA = a * (1.0 - aRow) * 0.62 * mix(1.0, aCrest, uCrestBreakup);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p.x, 0.012 + 0.004 * (1.0 - f), p.y, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uFoam;
      varying float vA;
      void main() {
        if (vA < 0.004) discard;
        gl_FragColor = vec4(uFoam, vA);
        #include <colorspace_fragment>
      }`,
  });
}
