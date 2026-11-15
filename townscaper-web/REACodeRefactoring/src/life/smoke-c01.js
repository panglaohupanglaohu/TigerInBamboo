/**
 * 【已 native 化 · 第 74 轮标注】本文件的三条口径（大瓣 / 顶端断开 / 弥散薄雾）在第 63 轮就搬进了
 * `src/life/smoke.js` 本体（`setLobeStyle('big'|'fine')` / `setTopBreak()` / `setHaze()`），smoke.html
 * 也不再调用 `installSmokeShape()` —— 页面走的是 native 那一套。**本文件因此没有生产调用方**，
 * 只剩两个测试还拿它做「外挂近似 vs native」的对照：`tests/smoke-c01.mjs`、`tests/smoke-c01-probe.js`。
 * 保留（不删）原因：它是第 56 批唯一一份可复跑的近似实现记录，删了就没有对照基线。
 * 新代码请一律改 smoke.js 的 native API，不要再往这里加分支。
 *
 * 第 56 批 C01 · 1015142746372366336「drawing the effect in 2 passes …」原片逐帧实核后留下的三条缺口，
 * 作为 Smoke 的外挂层实现（不改 smoke.js 本体，旧行为不变；installSmokeShape(smoke).set({...}) 打开）：
 *
 *   bigLobes  原片柱身是 6–7 个「直径≈柱宽」的大瓣：每 3 片只留 2 片、留下的放大 1.32 倍 → 瓣更少更大
 *   detach    原片主柱顶端之后断开、另有一团独立烟：发射按 3.6s 周期留出 1.2s 空档（空档里出生的片不画），
 *             空档随烟上升 → 柱顶之上是一团与主柱分开的独立烟团
 *   haze      两柱之间的低对比弥散薄雾：每个较老的烟团再画一张 2.4 倍的软圆卡（alpha ≤ 0.13、无硬边），
 *             在两遍烟之前画（renderOrder 5），只把背景压暗一点点
 *
 * 做法：包一层 smoke.update —— 原 update 照旧写完实例矩阵后，按 drawOrder（serial）逐实例改缩放；薄雾是独立 InstancedMesh。
 */
import * as THREE from 'three';

const N = 240, PERIOD = 3.6, GAP = 1.2;

/** 纯函数：一片烟在这三条规则下的缩放系数（0 = 不画）。 */
export function lobeFactor(p, clock, { bigLobes = false, detach = false } = {}) {
  if (detach) { const birth = clock - p.age * p.life; if (((birth % PERIOD) + PERIOD) % PERIOD > PERIOD - GAP) return 0; }
  if (bigLobes) return p.serial % 3 === 2 ? 0 : 1.32;
  return 1;
}

export function installSmokeShape(smoke) {
  if (smoke.shape) return smoke.shape;
  const geo = new THREE.PlaneGeometry(1, 1), aA = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
  geo.setAttribute('aA', aA);
  const haze = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `attribute float aA; varying float vA; varying vec2 vUv;
      void main(){ vA = aA; vUv = uv; vec3 c = (instanceMatrix * vec4(0.,0.,0.,1.)).xyz; float s = length(instanceMatrix[0].xyz);
        vec3 r = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), u = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        gl_Position = projectionMatrix * viewMatrix * vec4(c + (r * position.x + u * position.y) * s, 1.); }`,
    fragmentShader: /* glsl */ `varying float vA; varying vec2 vUv;
      void main(){ float r = length(vUv - .5) * 2.; float a = vA * exp(-3.2 * r * r) * (1. - smoothstep(.85, 1., r));
        gl_FragColor = vec4(vec3(.16, .16, .18), a);
        #include <colorspace_fragment>
      }`,
  }), N);
  haze.count = 0; haze.frustumCulled = false; haze.renderOrder = 5; smoke.group.add(haze);
  const state = { bigLobes: false, detach: false, haze: false, clock: 0, hidden: 0, hazeCards: 0, drawn: 0, mesh: haze };
  const orig = smoke.update.bind(smoke);
  const m = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  smoke.update = (dt = 0, wind, camera = null) => {
    orig(dt, wind, camera);
    state.clock += Math.min(Math.max(0, dt), 0.1);
    const any = state.bigLobes || state.detach;
    let hidden = 0, drawn = 0, nh = 0;
    const bySerial = any || state.haze ? new Map(smoke.p.map((p) => [p.serial, p])) : null;
    const order = smoke.drawOrder ?? smoke.p.map((p) => p.serial);
    for (let i = 0; i < smoke.back.count; i++) {
      const p = bySerial?.get(order[i]);
      if (!p) { drawn++; continue; }
      smoke.back.getMatrixAt(i, m); m.decompose(pos, q, sc);
      if (any) {
        const f = lobeFactor(p, state.clock, state);
        if (f === 0) hidden++; else drawn++;
        sc.multiplyScalar(f === 0 ? 1e-5 : f); m.compose(pos, q, sc);
        smoke.back.setMatrixAt(i, m); smoke.front.setMatrixAt(i, m);
      } else drawn++;
      if (state.haze && p.seed < 0.45 && p.age > 0.25 && nh < N) {
        m.compose(pos, q, sc.multiplyScalar(2.4)); haze.setMatrixAt(nh, m); aA.setX(nh, 0.13 * (1 - p.age)); nh++;
      }
    }
    if (any) { smoke.back.instanceMatrix.needsUpdate = smoke.front.instanceMatrix.needsUpdate = true; }
    haze.count = state.haze ? nh : 0; haze.instanceMatrix.needsUpdate = true; aA.needsUpdate = true;
    state.hidden = hidden; state.drawn = drawn; state.hazeCards = haze.count;
  };
  state.set = (opts = {}) => { for (const k of ['bigLobes', 'detach', 'haze']) if (k in opts) state[k] = !!opts[k]; return { bigLobes: state.bigLobes, detach: state.detach, haze: state.haze }; };
  smoke.shape = state;
  return state;
}
