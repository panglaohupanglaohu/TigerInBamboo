/**
 * butterflies.js — 绕着"可能的落点"打转，靠换落点来漂移。
 *
 * 原文（x.com/OskSta/status/1273520600221433857, 2020-06-18）：
 *
 *   "Butterflies fly quite different from birds. Mine loosely orbit a potential
 *    landing spot, and drift by randomly switching that spot. Additional world
 *    space noise adds variability but also coherence (without boiding)"
 *
 * 三句话，三个机制，缺一个就不像：
 *   ① **松绕落点**：不是圆周运动，是"绕着某点晃"，半径和角速度都在变。
 *      所以轨迹是一团毛线，而不是一圈。
 *   ② **换落点来漂移**：整只蝴蝶的位移来自"目标点换了"，不是自己往前飞。
 *      换点之后一小段时间里位置是**插值**过去的，于是看起来像被风吹走。
 *   ③ **世界空间噪声**：同一位置的蝴蝶被同一个噪声场推，所以一群蝴蝶会有
 *      共同的漂移方向（"coherence"），但不是 boid 那种互相跟随（"without boiding"）。
 *      关键区别：boid 看邻居，这里只看**世界坐标**——互不相识，动作却一致。
 *
 * 画面（24 帧，看过总览）：
 *   · 蝴蝶只有 2~4 像素，白/米色，是两片微微张合的小三角，没有任何描边；
 *   · 它们全在草地/花坛上方 0.15~0.5 世界单位的高度，**不会飞到屋顶高度**；
 *   · 同一帧里三只蝴蝶的朝向互不相同，但位移方向大体一致（就是③）；
 *   · 单只的轨迹里能看到"停一下→窜一下"：换落点的瞬间是加速的。
 */

import * as THREE from 'three';

const LEVEL = 0.42;

function hash2(x, z, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 世界空间漂移场：只吃位置，不吃邻居（"without boiding"）。 */
function driftField(x, z, t, out) {
  out.x = Math.sin(z * 0.45 + t * 0.55) * 0.5 + Math.sin(z * 1.31 - t * 0.23) * 0.18;
  out.z = Math.cos(x * 0.41 - t * 0.47) * 0.5 + Math.cos(x * 1.17 + t * 0.31) * 0.18;
  return out;
}

/** 两片小三角 + 一点身体：远看就是一张会张合的纸片。 */
function wingGeometry() {
  const g = new THREE.BufferGeometry();
  // 两片翅膀（左右各一）在内侧留一条缝，中间那道缝就是"身体"
  const v = new Float32Array([
    0, 0, -0.5, -1, 0, 0.5, 0, 0, 0.5,     // 左翅
    0, 0, -0.5, 0, 0, 0.5, 1, 0, 0.5,      // 右翅
  ]);
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * @param {object} opts
 *   town/grid  用来找落点（只取 top>0 且不是屋顶的格子）
 *   count      数量
 *   groundAt   (cell) => 世界 y（没有就用 top*0.42）
 */
export function createButterflies({ town, grid, count = 14, seed = 5, groundAt = null, scale = 1, avoid = [] } = {}) {
  let s = (seed | 0) || 1;
  const rnd = () => {
    s = (Math.imul(s, 1103515245) + 12345) | 0;
    return ((s >>> 8) & 0xffff) / 0xffff;
  };

  // 落点只取"草地/花坛"：房子周围的格子剔掉（原文里蝴蝶全在屋外的绿地上，
  // 没有一只停在屋顶或屋檐上）。avoid 是房子中心点列表。
  const cand = grid.cells.filter((c) => {
    if (town.top(c) <= 0) return false;
    for (const h of avoid) {
      const hc = h.cell || h;
      if ((hc.cx - c.cx) ** 2 + (hc.cz - c.cz) ** 2 < 1.1) return false;
    }
    return true;
  });
  const geo = wingGeometry();
  const mat = new THREE.MeshBasicMaterial({
    color: '#fdfaf0',
    side: THREE.DoubleSide,
    // 蝴蝶太小，进光照会变成灰点；原文里它们就是纯亮色块
    toneMapped: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  // 别让描边通道给它画圈：2px 的东西加 1px 描边就成一团黑
  mesh.userData.overlayOnly = true;

  const items = [];
  const pickSpot = () => {
    const c = cand.length ? cand[(rnd() * cand.length) | 0] : null;
    if (!c) return { x: 0, y: 1, z: 0, cell: null };
    const y = groundAt ? groundAt(c) : town.top(c) * LEVEL;
    return { x: c.cx + (rnd() - 0.5) * 0.5, y: y + 0.12 + rnd() * 0.4, z: c.cz + (rnd() - 0.5) * 0.5, cell: c };
  };

  for (let i = 0; i < count; i++) {
    const spot = pickSpot();
    items.push({
      spot,                 // 当前落点
      prev: { ...spot },    // 上一个落点（换点时插值用）
      blend: 1,             // 0..1 换点过渡
      orbitR: 0.22 + rnd() * 0.55,
      orbitS: (0.6 + rnd() * 1.4) * (rnd() < 0.5 ? -1 : 1),
      phase: rnd() * Math.PI * 2,
      bob: 0.05 + rnd() * 0.10,
      bobF: 1.4 + rnd() * 1.6,
      timer: 1.5 + rnd() * 4,
      yaw: rnd() * Math.PI * 2,
      flap: rnd() * 10,
      pos: new THREE.Vector3(spot.x, spot.y, spot.z),
    });
  }

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const sc = new THREE.Vector3();
  const p = new THREE.Vector3();
  const d = { x: 0, z: 0 };
  const target = new THREE.Vector3();

  return {
    group: (() => { const g = new THREE.Group(); g.add(mesh); return g; })(),
    mesh,
    update(dt, t) {
      for (let i = 0; i < items.length; i++) {
        const b = items[i];
        b.timer -= dt;
        if (b.timer <= 0) {
          // ② 换落点：把当前点存成 prev，新点成为目标，blend 从 0 走到 1
          b.prev = { x: b.pos.x, y: b.pos.y, z: b.pos.z };
          b.spot = pickSpot();
          b.blend = 0;
          b.timer = 2.2 + rnd() * 3.5;
          b.orbitR = 0.20 + rnd() * 0.55;
          b.orbitS = (0.6 + rnd() * 1.4) * (rnd() < 0.5 ? -1 : 1);
        }
        // 换点过渡：越到后面越慢（ease-out），于是"窜一下然后飘过去"
        if (b.blend < 1) b.blend = Math.min(1, b.blend + dt * 0.55);
        const k = 1 - (1 - b.blend) * (1 - b.blend);

        // ① 松绕：半径调制 + 相位漂移，所以不是正圆
        const a = b.phase + t * b.orbitS;
        const r = b.orbitR * (1 + 0.35 * Math.sin(t * 0.9 + b.phase * 2));
        target.set(
          b.prev.x + (b.spot.x - b.prev.x) * k + Math.cos(a) * r,
          b.prev.y + (b.spot.y - b.prev.y) * k + Math.sin(t * b.bobF + b.phase) * b.bob,
          b.prev.z + (b.spot.z - b.prev.z) * k + Math.sin(a) * r
        );

        // ③ 世界空间漂移场（同一个位置 → 同一个推力，互不相识却一起走）
        driftField(target.x, target.z, t, d);
        target.x += d.x * 0.06;
        target.z += d.z * 0.06;

        p.set(target.x, target.y, target.z);
        b.pos.copy(p);

        // 朝向 = 位移方向（看着像"被推着走"而不是"自己飞"）
        const vx = p.x - (b.lastX ?? p.x);
        const vz = p.z - (b.lastZ ?? p.z);
        if (vx * vx + vz * vz > 1e-8) b.yaw = Math.atan2(vx, vz);
        b.lastX = p.x; b.lastZ = p.z;

        // 翅膀张合：把 x 缩放到 0.25~1（从侧面看就是一闪一闪）
        const flap = 0.35 + 0.65 * Math.abs(Math.sin(t * 9.5 + b.flap));
        e.set(0, b.yaw, Math.sin(t * 2.1 + b.phase) * 0.25, 'YXZ');
        q.setFromEuler(e);
        // 尺寸是从参考片量的：整岛在画面里 ~500px 时蝴蝶约 4px，
        // 而我们的岛宽 ≈ 40 世界单位 → 一只蝴蝶 ≈ 0.13 世界单位。
        // 第一版给了 0.052，画面里就是 1px 的杂点，等于没画。
        sc.set(0.135 * scale * flap, 0.135 * scale, 0.135 * scale);
        m.compose(p, q, sc);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.count = items.length;
    },
    stats() {
      return {
        count: items.length,
        spots: items.map((b) => ({ x: +b.spot.x.toFixed(2), y: +b.spot.y.toFixed(2), z: +b.spot.z.toFixed(2) })),
      };
    },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}
