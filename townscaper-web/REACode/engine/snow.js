/**
 * snow.js — 雪片被**风场**吹着绕过岛；靠近地面时压暗（粒子也有接触 AO）。
 *
 * 原文（x.com/OskSta/status/943230624369868800, 2017-12-19）：
 *
 *   "And yeah, obviously the snow flakes are affected by the wind system and thus
 *    flow around the island"
 *
 * 前一条（x.com/OskSta/status/943230620242796544）是同一批冬季宣传素材。
 * 画面：雪从天而降，但**不是直落**——绕过建筑与崖壁时整片倾斜，岛的背风面
 * 明显稀疏/斜度更大；靠近地面的雪片比空中的暗一档。
 *
 * 第二条原文（x.com/OskSta/status/823848950553780226, 2017-01-24）：
 *
 *   "O yes, I do have AO on my dust particles O yes, it does work on mobile"
 *
 * 这两条讲的是同一个做法：**粒子不是纯加色光点**。雪/尘靠近表面时被压暗，
 * 否则在亮地面上一片片发白、看起来像噪点。做法很便宜：按"离地高度"给一个
 * 亮度系数，离地越近越暗（相当于粒子的接触 AO），不需要任何深度纹理。
 */

import * as THREE from 'three';

const VERT = /* glsl */`
  attribute float aAlpha;
  attribute float aSize;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // 系数别拍脑袋：320/z 在 z≈15 时给出 20~30px 的"大光斑"（第一版就是这样，
    // 满屏白色圆饼）。参考片里雪片是 1~3px 的小点，所以取 42。
    gl_PointSize = aSize * 42.0 / max(0.001, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */`
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    // 圆点：把方点磨成雪片
    vec2 d = gl_PointCoord - vec2(0.5);
    float r = length(d);
    if (r > 0.5) discard;
    float soft = smoothstep(0.5, 0.28, r);
    gl_FragColor = vec4(uColor, vAlpha * soft);
  }
`;

/**
 * @param {object} opts
 *   wind   src/wind.js 的场（必须给，否则雪就是直落）
 *   town/grid  用来算"离地高度"（接触 AO）
 *   count  粒子数
 *   box    跟随相机/岛的范围（世界单位）
 */
export function createSnow({ wind, town, grid, count = 2200, seed = 9, box = 26, top = 16, bottom = -1.0, colour = '#f7fbff' } = {}) {
  let s = (seed | 0) || 1;
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) | 0; return ((s >>> 8) & 0xffff) / 0xffff; };

  // 只在陆地范围附近下雪："脚下多高"用一张 48² 的粗高度图查。
  // 第一版对每个粒子遍历全部陆地格子找最近点 —— 2200 个粒子 × 1000 格 = 每帧
  // 220 万次距离计算，帧率直接掉一半。查表是 O(1)，精度对雪片足够了。
  const cells = grid.cells.filter((c) => town.top(c) > 0);
  const RES = 48;
  const hg = new Float32Array(RES * RES);
  for (const c of cells) {
    const gx = Math.floor(((c.cx + box) / (box * 2)) * (RES - 1));
    const gz = Math.floor(((c.cz + box) / (box * 2)) * (RES - 1));
    if (gx < 0 || gz < 0 || gx >= RES || gz >= RES) continue;
    const k = gz * RES + gx;
    hg[k] = Math.max(hg[k], town.top(c) * 0.42);
  }
  const groundAt = (x, z) => {
    const gx = Math.round(((x + box) / (box * 2)) * (RES - 1));
    const gz = Math.round(((z + box) / (box * 2)) * (RES - 1));
    if (gx < 0 || gz < 0 || gx >= RES || gz >= RES) return 0;
    return hg[gz * RES + gx];
  };

  const pos = new Float32Array(count * 3);
  const alpha = new Float32Array(count);
  const size = new Float32Array(count);
  const speed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rnd() - 0.5) * box * 2;
    pos[i * 3 + 1] = bottom + rnd() * (top - bottom);
    pos[i * 3 + 2] = (rnd() - 0.5) * box * 2;
    size[i] = 0.55 + rnd() * 0.9;
    speed[i] = 0.7 + rnd() * 0.6;
    alpha[i] = 0.6;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 4, 0), box * 2);

  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(colour) } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.userData.overlayOnly = true;
  points.renderOrder = 5;

  let drift = 0;

  return {
    group: (() => { const g = new THREE.Group(); g.add(points); return g; })(),
    update(dt, t) {
      drift = 0;
      for (let i = 0; i < count; i++) {
        const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
        const gy = groundAt(x, z);
        const [vx, vy, vz] = wind.at(x, y, z, gy);
        const k = speed[i] * dt * 2.2;
        let nx = x + vx * k;
        let ny = y + (vy - 0.55) * k;      // 风给方向，重力给下落
        let nz = z + vz * k;
        // 落到地面/水面就回到顶部（不消失，雪是持续的）
        if (ny < gy + 0.02) { ny = top * (0.85 + Math.random() * 0.15); nx = (Math.random() - 0.5) * box * 2; nz = (Math.random() - 0.5) * box * 2; }
        // 出边界绕回来
        if (nx > box) nx -= box * 2; else if (nx < -box) nx += box * 2;
        if (nz > box) nz -= box * 2; else if (nz < -box) nz += box * 2;
        pos[i * 3] = nx; pos[i * 3 + 1] = ny; pos[i * 3 + 2] = nz;

        // 接触 AO：离地 0 → 0.35，离地 1.5 以上 → 1.0
        const h = Math.max(0, ny - gy);
        const contact = 0.35 + 0.65 * Math.min(1, h / 1.5);
        // 远处的雪片淡一点，避免整个画面糊成一层白
        const dist = Math.hypot(nx, nz) / box;
        alpha[i] = 0.72 * contact * (1 - 0.45 * Math.min(1, dist));
        drift += Math.hypot(vx, vz);
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aAlpha.needsUpdate = true;
    },
    stats() {
      // 平均"水平风速"：证明雪真的被风带走了（≈0 就是直落）。
      // 注意别用 update() 里的累加量 —— stats 在 build 阶段就会被调一次，
      // 那时还没跑过 update，永远是 0（第一版就是这么量出 0 的）。
      let md = 0, n = 0;
      for (let i = 0; i < 16; i++) {
        const x = (i / 16 - 0.5) * box * 1.6;
        const z = (((i * 7) % 16) / 16 - 0.5) * box * 1.6;
        const gy = groundAt(x, z);
        const [vx, vy, vz] = wind.at(x, gy + 3, z, gy);
        md += Math.hypot(vx, vz);
        n++;
      }
      return { count, meanDrift: +(md / n).toFixed(3), box, lastFrameDrift: +(drift / count).toFixed(3) };
    },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}
