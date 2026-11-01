/**
 * fog.js — 贴海的雾：漂、薄、跟着风绕岛。
 *
 * 原文（x.com/OskSta/status/906207980802252801, 2017-09-09）：
 *
 *   "I've been working on some new fog (sped up in the gif). For background
 *    effects, subtlety is key."
 *
 * 画面（620×300，24 帧，整段 9.8s 是被加速过的）：
 *   · 岛底下**贴着水面**一层雾，厚度大约是全岛高度的 1/5（岛约 8 世界单位 → 雾 1.2~1.8）
 *   · 雾不是一整片，是**几团丝丝缕缕的云絮**横向掠过；有的从岛前过、有的从岛后过
 *   · 极低对比：雾比背景亮一点点（背景偏青，雾偏白），叠在岩体上只是"蒙了一层"
 *   · 运动很慢（原片加速了，所以真实速度还要再慢 2~3 倍）
 *
 * 为什么不用后处理/屏幕空间雾：参考片里的雾会**从岛前面飘过去**，也会被岛挡住 ——
 * 那是世界空间里的东西。这里用一圈朝向相机的软片（billboard），用风场推着走，
 * 撞到岛的高度场就绕着走 —— 和 `engine/snow.js` 是同一套"粒子吃风场"的做法，
 * 只是雾片比雪片大三个数量级、透明度低一个数量级。
 */

import * as THREE from 'three';

const VERT = /* glsl */`
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const FRAG = /* glsl */`
  uniform float uTime;
  uniform float uDensity;
  uniform float uSeed;
  uniform vec3  uColour;
  uniform float uBand;
  uniform vec3  uCamPos;
  varying vec2 vUv;
  varying vec3 vWorld;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21) + uSeed);
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  // 三层分形：一层管大团，两层管丝缕
  float fbm(vec2 p) {
    return noise(p) * 0.55 + noise(p * 2.07 + 11.3) * 0.3 + noise(p * 4.13 + 27.7) * 0.15;
  }

  void main() {
    // 圆角软边：雾片不能有直角，否则一圈方片很明显
    vec2 c = vUv - 0.5;
    float r = length(c) * 2.0;
    float soft = 1.0 - smoothstep(0.55, 1.0, r);

    // 丝缕：沿雾片自身 uv 拉长（横向是风的方向，所以 x 方向频率低）
    vec2 p = vec2(vUv.x * 2.2 + uTime * 0.05, vUv.y * 4.5) + uSeed * 7.0;
    float n = fbm(p);
    // 阈值推到中段：只有噪声的高处才成"丝"，其余是空的
    float wisp = smoothstep(0.42, 0.78, n);

    // 竖直带：雾只贴水面。片子里的雾顶大约在 1.3~1.7，再往上就没了；
    // 不乘这一项的话 12 片叠起来会把整座岛糊成一片白（实测 mean +16%）。
    float band = 1.0 - smoothstep(uBand, uBand * 2.4, vWorld.y);
    // 离相机太近的雾片压淡：不然一块 13 单位的片子贴脸飞过时，整屏都是白的
    float near = smoothstep(3.0, 9.0, distance(uCamPos, vWorld));
    float a = soft * (0.25 + 0.75 * wisp) * uDensity * band * near;
    if (a < 0.002) discard;
    gl_FragColor = vec4(uColour, a);
  }
`;

/**
 * @param {object} o
 * @param {object} o.wind    `makeWindField()` 的返回值（有 at(x,y,z)）
 * @param {number} [o.count] 雾片数
 * @param {number} [o.radius] 雾片分布的外半径（要盖过全岛）
 * @param {number} [o.top]   雾带顶（世界单位）—— 参考片里 ≈ 岛高的 1/5
 * @param {number} [o.density] 总浓度（0 = 关）
 */
export function createFogLayer({
  wind,
  count = 12,
  radius = 26,
  inner = 5,
  bottom = 0.15,
  top = 1.35,
  size = 13,
  density = 0.02,
  colour = '#eef6f8',
  seed = 5,
} = {}) {
  const group = new THREE.Group();
  group.renderOrder = 3;

  let s = (seed * 1664525 + 1013904223) | 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) | 0) & 0x7fffffff) / 0x7fffffff;

  const quads = [];
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDensity: { value: density },
      uSeed: { value: seed * 0.37 },
      uColour: { value: new THREE.Color(colour) },
      uBand: { value: Math.max(0.2, top) },
      uCamPos: { value: new THREE.Vector3() },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
  });

  const geo = new THREE.PlaneGeometry(1, 1);
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(geo, mat);
    const a = rnd() * Math.PI * 2;
    const r = inner + rnd() * (radius - inner);
    const scale = size * (0.6 + rnd() * 0.8);
    m.position.set(Math.cos(a) * r, bottom + rnd() * (top - bottom), Math.sin(a) * r);
    m.scale.set(scale, scale * (0.28 + rnd() * 0.18), 1);   // 扁：雾比云薄
    m.userData = { speed: 0.5 + rnd() * 0.7, phase: rnd() * 100, r: r, a: a };
    m.frustumCulled = false;
    group.add(m);
    quads.push(m);
  }

  const camDir = new THREE.Vector3();
  const v = new THREE.Vector3();

  /**
   * @param {number} dt
   * @param {number} t      同一个全局时钟（和岸浪、雪共用，避免各走各的）
   * @param {THREE.Camera} camera  雾片绕 Y 轴朝向相机
   */
  function update(dt, t, camera) {
    mat.uniforms.uTime.value = t;
    if (camera) mat.uniforms.uCamPos.value.copy(camera.position);
    if (!group.visible) return;
    for (const m of quads) {
      // 风场平流：雾片跟着风走，撞到陆地处 wind 会自动掉速（wind.js 里做了绕流），
      // 于是雾会在岛周围慢下来、堆一下 —— 参考片里那点"绕过去"的感觉来自这里
      const w = wind ? wind.at(m.position.x, m.position.y, m.position.z, null) : [1, 0, 0];
      const sp = m.userData.speed;
      m.position.x += w[0] * sp * dt;
      m.position.z += w[2] * sp * dt;
      // 跑出外圈就从对面绕回来（不是重置到原点，否则会看到"整片突然消失"）
      const d = Math.hypot(m.position.x, m.position.z);
      if (d > radius) {
        const k = (radius - 0.5) / d;
        m.position.x *= -k;
        m.position.z *= -k;
        m.position.y = bottom + ((t * 0.03 + m.userData.phase) % 1) * (top - bottom);
      }
      if (camera) {
        camDir.subVectors(camera.position, m.position);
        m.rotation.y = Math.atan2(camDir.x, camDir.z);
      }
    }
  }

  function setDensity(v2) { mat.uniforms.uDensity.value = v2; group.visible = v2 > 0.001; }
  function dispose() { geo.dispose(); mat.dispose(); }

  return { group, update, setDensity, dispose, stats: { quads: quads.length, radius, top } };
}
