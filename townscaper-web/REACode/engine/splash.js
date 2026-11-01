/**
 * splash.js — 水滴落水的涟漪：环是**一圈一圈生出来的**，不是一个 shader 里的同心圆。
 *
 * 原文（x.com/OskSta/status/1258421104756097029, 2020-05-07）：
 *
 *   "We were long overdue for some splashier splashes"
 *
 * 画面（24 帧，1080²，侧视运河）：屋檐上一滴水落下来（第 4~8 帧是一条白色细竖条），
 * 触水的一瞬间炸出一小圈**白色泡沫冠**，随后 2~3 圈极细的**环形涟漪**由内向外推开，
 * 大约 1 秒内扩散到房子宽度的一半、同时淡到看不见。另外木桩周围一直有更小的、
 * 周期性的环（船靠岸那种）。
 *
 * 为什么不用"shader 里的同心圆"：片子里每一圈是**各自独立的**——出生时间不同、
 * 扩散速度接近但相位不同、寿命也不同（内圈先淡）。用一个解析函数画同心圆，
 * 所有圈的相位被绑死，看起来像塑料。
 *
 * 参数来源：几何比例从帧里量（环最终半径 ≈ 房子宽度的一半，寿命 ≈ 1.0 s），
 * 扩散速度按"半径/寿命"推出来；具体数值是估计值，标注在下面。
 */

import * as THREE from 'three';

const RING_LIFE = 1.0;        // 一圈的寿命（秒）—— 帧里约 1 s 淡完（估计值）
const RING_MAX_R = 1.55;      // 最大半径（世界单位）—— 约等于参考片里半个房子宽（估计值）
const FOAM_LIFE = 0.32;       // 泡沫冠：很短，只在触水那一下

/**
 * @param {THREE.Scene} scene
 * @param {object} opts
 *   waterY   水面高度
 *   scale    整体缩放（场地大小不同时用）
 *   quality  环的分段数相关的倍率
 */
export function createSplash(scene, { waterY = 0, scale = 1, maxRings = 64 } = {}) {
  const group = new THREE.Group();
  group.renderOrder = 3;
  scene.add(group);

  // 环用 RingGeometry：内径靠缩放做，外径固定为 1 → 一个几何体反复用
  const ringGeo = new THREE.RingGeometry(0.93, 1.0, 56, 1);
  ringGeo.rotateX(-Math.PI / 2);          // 躺平在水面上

  const ringMat = new THREE.MeshBasicMaterial({
    color: '#ffffff', transparent: true, opacity: 1, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.NormalBlending,
  });

  // 泡沫冠：一小片"炸开"的白色碟子，用同一个环几何体但更短命、更大更淡
  const foamMat = new THREE.MeshBasicMaterial({
    color: '#ffffff', transparent: true, opacity: 0.95, side: THREE.DoubleSide,
    depthWrite: false,
  });

  const pool = [];        // 活跃的环
  const rings = [];       // 复用的 mesh
  function take() {
    const r = rings.pop() || new THREE.Mesh(ringGeo, ringMat.clone());
    r.visible = true;
    group.add(r);
    return r;
  }
  function give(r) {
    group.remove(r);
    if (rings.length < maxRings) rings.push(r);
  }

  /**
   * 在 (x,z) 打一个水花。
   * @param {{x:number,z:number,strength?:number,delay?:number}} o
   */
  function impact({ x, z, strength = 1, delay = 0 }) {
    // 参考片里一次落水出 3 圈（内圈 + 两圈外扩），每圈错开 0.1~0.13 s
    for (let i = 0; i < 3; i++) {
      pool.push({
        kind: 'ring', x, z,
        t: -delay - i * 0.11,
        life: RING_LIFE * (0.85 + 0.15 * i),
        r0: 0.06 * strength,
        r1: RING_MAX_R * scale * (0.75 + 0.25 * i) * strength,
        mesh: null,
      });
    }
    // 泡沫冠
    pool.push({ kind: 'foam', x, z, t: -delay, life: FOAM_LIFE, r0: 0.10, r1: 0.42 * scale * strength, mesh: null });
  }

  /** 木桩周围那种周期性小环。 */
  function pulse({ x, z, period = 1.5, radius = 0.55 }) {
    pool.push({ kind: 'ring', x, z, t: 0, life: RING_LIFE * 0.7, r0: 0.10, r1: radius, mesh: null, soft: true });
    return { next: period };
  }

  let clock = 0;
  function update(dt) {
    clock += dt;
    for (let i = pool.length - 1; i >= 0; i--) {
      const p = pool[i];
      p.t += dt;
      if (p.t < 0) continue;                      // 还没出生
      if (!p.mesh) p.mesh = take();
      const k = Math.min(1, p.t / p.life);
      const r = p.r0 + (p.r1 - p.r0) * (1 - Math.pow(1 - k, 2));   // ease-out：一开始快，之后慢
      p.mesh.position.set(p.x, waterY + 0.012 + i * 1e-5, p.z);
      p.mesh.scale.set(r, 1, r);
      const a = p.kind === 'foam'
        ? Math.pow(1 - k, 2) * 0.95
        : (p.soft ? 0.35 : 0.85) * Math.pow(1 - k, 1.6);
      p.mesh.material.opacity = a;
      // 泡沫冠厚一点、环始终是细线
      p.mesh.material.opacity = p.kind === 'foam' ? a * 0.9 : a;

      if (k >= 1) { give(p.mesh); pool.splice(i, 1); }
    }
  }

  return {
    group, impact, pulse, update,
    stats() {
      return {
        active: pool.length,
        kinds: pool.reduce((m, p) => { m[p.kind] = (m[p.kind] || 0) + 1; return m; }, {}),
        // 当前最外圈的半径（用来和参考片对比"扩到多宽"）
        maxRadius: +pool.filter((p) => p.mesh && p.kind === 'ring')
          .reduce((mx, p) => Math.max(mx, p.mesh.scale.x), 0).toFixed(3),
        clock: +clock.toFixed(2),
      };
    },
    dispose() {
      ringGeo.dispose(); ringMat.dispose(); foamMat.dispose();
      for (const r of rings) r.material.dispose();
      scene.remove(group);
    },
  };
}
