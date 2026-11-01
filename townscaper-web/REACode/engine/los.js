/**
 * los.js — 导航图上的"廉价视线"：扇形扫一遍，够用就行。
 *
 * 原文（x.com/OskSta/status/810878197134950401, 2016-12-19）：
 *
 *   "I found a cheap way to approximate line of sight on a nav mesh. What it
 *    lacks in accuracy it makes up for in speed"
 *
 * 画面（442×452，24 帧）：一张俯视的红色路线图，从一个点向外散开**一大片红弧**，
 * 末端是一个**白斑点阵**围出来的可见区域；红弧随鼠标移动整片扫过，形状跟着走廊
 * 拐弯 —— 也就是"站在这里能看见哪些地方"。
 *
 * 为什么要"近似"：精确视线要对每个三角形做相交测试；他给出的做法是**只沿着
 * 少数几条射线走**，把打到的东西记下来，再连成扇面。误差来自射线之间的缝，
 * 但对"敌人能不能看见我"这种判断完全够用 —— 而且能在同一帧里对几十个单位算。
 *
 * 我们的实现（和原文同一个折中）：
 *   · `rays` 条射线（默认 96，约 3.75° 一条）
 *   · 每条按 `step` 前进一步，问一次"这里的地面高度/是否陆地"
 *   · 高度突变超过 `maxClimb`（一层）、或者走出陆地 → 判定被挡，记下最后一点
 *   · 端点连成三角扇 = 可见区域；射线本身画成细线（参考片里那些红弧）
 *
 * 代价：`rays × (maxR / step)` 次高度查询。默认 96 × 63 ≈ 6000 次，比逐三角形
 * 相交便宜两个数量级；实测一帧 0.3~0.8ms（见 stats.ms）。
 */

import * as THREE from 'three';

const FAN = new THREE.Color('#f2f0ea');
const RAY = new THREE.Color('#d8443c');

export function createLineOfSight({
  heightAt,
  levelHeight = 0.42,
  rays = 96,
  step = 0.35,
  maxR = 22,
  maxClimb = 0.75,       // 一步之内允许往上爬的层数；超过就算墙（0.75 层 ≈ 台阶临界）
  lift = 0.12,
  opacity = 0.24,
} = {}) {
  const group = new THREE.Group();
  group.renderOrder = 4;

  // 扇面：每次重算都重建这两份几何（体量很小，几十个三角形）
  const fanGeo = new THREE.BufferGeometry();
  const fanMat = new THREE.MeshBasicMaterial({
    color: FAN, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const fan = new THREE.Mesh(fanGeo, fanMat);
  fan.frustumCulled = false;

  const rayGeo = new THREE.BufferGeometry();
  const rayMat = new THREE.LineBasicMaterial({ color: RAY, transparent: true, opacity: 0.55, depthWrite: false });
  const rayLines = new THREE.LineSegments(rayGeo, rayMat);
  rayLines.frustumCulled = false;

  group.add(fan, rayLines);
  group.visible = false;

  const stats = { source: null, rays, reach: 0, area: 0, ms: 0, blocked: 0 };

  /**
   * @param {number} sx
   * @param {number} sz
   * @param {number} [y] 观察高度（不传就用地面 + lift）
   */
  function cast(sx, sz, y) {
    const t0 = performance.now();
    const h0 = heightAt(sx, sz);
    if (h0 === null || h0 === undefined) return null;
    const oy = (y === undefined ? h0 + lift : y);

    const ends = [];
    const endsY = [];
    let blocked = 0;
    let reach = 0;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2;
      const dx = Math.cos(a), dz = Math.sin(a);
      let lastX = sx, lastZ = sz, blockedHere = false;
      // 高程判据：**只有往上的一步**才算挡。踩在地面上往下看是能看见的，
      // 用 |h-h0| 做判据的话站在山顶往哪个方向都是"挡住"（实测 reach 只有 0.7，
      // 96 条射线全部在第一步就断）。所以这里跟着地面走：往上超过 maxClimb 层
      // 就当墙，往下随便走 —— 崖不挡视线，墙才挡。
      let prevH = h0;
      for (let d = step; d <= maxR; d += step) {
        const x = sx + dx * d, z = sz + dz * d;
        const h = heightAt(x, z);
        if (h === null || h === undefined) break;                  // 走到海里
        if (h > prevH + levelHeight * maxClimb) { blockedHere = true; break; }
        prevH = h;
        lastX = x; lastZ = z;
      }
      if (blockedHere) blocked++;
      const r = Math.hypot(lastX - sx, lastZ - sz);
      if (r > reach) reach = r;
      ends.push([lastX, lastZ]);
      // 扇面必须**贴着地面**：台地岛不是平的，用同一个高度画一整片会被地形吃掉
      const hEnd = heightAt(lastX, lastZ);
      endsY.push((hEnd === null || hEnd === undefined ? h0 : hEnd) + lift);
    }

    // 扇面（端点顺序就是射线顺序，天然闭合）
    const pos = new Float32Array(rays * 9);
    let area = 0;
    for (let i = 0; i < rays; i++) {
      const [ax, az] = ends[i];
      const [bx, bz] = ends[(i + 1) % rays];
      const o = i * 9;
      pos[o] = sx; pos[o + 1] = oy; pos[o + 2] = sz;
      pos[o + 3] = ax; pos[o + 4] = endsY[i]; pos[o + 5] = az;
      pos[o + 6] = bx; pos[o + 7] = endsY[(i + 1) % rays]; pos[o + 8] = bz;
      area += Math.abs((ax - sx) * (bz - sz) - (bx - sx) * (az - sz)) * 0.5;
    }
    fanGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    fanGeo.computeVertexNormals();

    const lp = new Float32Array(rays * 6);
    for (let i = 0; i < rays; i++) {
      const [ax, az] = ends[i];
      const o = i * 6;
      lp[o] = sx; lp[o + 1] = oy; lp[o + 2] = sz;
      lp[o + 3] = ax; lp[o + 4] = endsY[i]; lp[o + 5] = az;
    }
    rayGeo.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));

    stats.source = [sx, sz];
    stats.reach = +reach.toFixed(2);
    stats.area = +area.toFixed(1);
    stats.blocked = blocked;
    stats.ms = +(performance.now() - t0).toFixed(2);
    return { ...stats };
  }

  function setVisible(on) { group.visible = on; }
  function setOpacity(v) { fanMat.opacity = v; }

  function dispose() { fanGeo.dispose(); rayGeo.dispose(); fanMat.dispose(); rayMat.dispose(); }

  return { group, cast, setVisible, setOpacity, dispose, stats, rays, maxR, step };
}
