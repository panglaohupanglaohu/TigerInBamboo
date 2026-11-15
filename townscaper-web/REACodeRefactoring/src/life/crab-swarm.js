/**
 * 第 56 批 C03 · 807256278154301441（2016-12-09）原文：
 *   「Looking at cheap swarm pathfinding. These dots could possibly be crabs or maybe recently dormant soviet under-water robots.」
 * 全 344 帧：红砖多层塔楼 + 外阶 + 门洞，一群紫色小球点沿屋顶 / 台面 / 台阶成群移动，绕楼上下；镜头绕塔。
 * 旧 note 只记了「四檐顶」那半（hip-roof），群体寻路本身没做。
 *
 * 「便宜」的做法：整群共用**一棵**以目标为根的最短路树（共享分层导航图 layerednav 上的反向 Dijkstra），
 * 每只螃蟹只看「我所在节点的父节点」往那走，加一点个体侧偏 + 邻居分离；不做逐只 A*。
 * 目标每隔几秒换一个（或 setTarget），整群一起改道；节点高度预先向渲染网格打射线取「最接近该层的真实表面」，
 * 所以球点贴着屋顶 / 台面 / 台阶走，而不是飘在整数层高上。
 * 只是 Battle 之外的场景层：?crabs=1 在小镇 / 地形 / 融合场景里都能开（app.js 一行挂钩）。
 */
import * as THREE from 'three';
import { BattleNavigation } from '../world/battle-navigation.js';

export class CrabSwarm {
  constructor(view, world, { count = 140, color = '#7a5ac8', retarget = 7, seed = 5 } = {}) {
    this.view = view; this.world = world; this.count = count; this.retarget = retarget;
    let s = seed >>> 0 || 1; this.rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(.035, 8, 6), new THREE.MeshStandardMaterial({ color, roughness: .6 }), count);
    this.mesh.frustumCulled = false; this.mesh.castShadow = true; this.mesh.count = 0; view.scene.add(this.mesh);
    this.crabs = []; this.t = 0; this.stats = { nodes: 0, retargets: 0, arrived: 0, floors: 0, maxStep: 0 };
  }
  #rebuild() {
    const v = this.view, w = this.world;
    this.nav ??= new BattleNavigation(w, v.index, { levelHeight: v.levelHeight }); this.nav.refresh();
    const g = this.nav.graph, L = v.levelHeight, ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
    const surfaces = [v.mesh, v.navLayer?.stairs].filter((m) => m?.geometry?.attributes?.position);
    // 每节点真实表面高（屋顶是坡的、台阶是一级级的）：取最接近 floor·L 的命中
    this.h = new Float32Array(g.nodes.length);
    g.nodes.forEach((n, i) => {
      const want = n.floor * L; let y = want;
      if (surfaces.length) { ray.set(new THREE.Vector3(n.x, want + 1.2, n.z), down); ray.far = 2.4; const hits = ray.intersectObjects(surfaces, false); if (hits.length) y = hits.reduce((a, h) => Math.abs(h.point.y - want) < Math.abs(a - want) ? h.point.y : a, hits[0].point.y); }
      this.h[i] = y;
    });
    // 最大连通块里的节点才放螃蟹 / 当目标
    const comp = new Int32Array(g.nodes.length).fill(-1); let best = -1, bestN = 0;
    for (let s0 = 0, c = 0; s0 < g.nodes.length; s0++) { if (comp[s0] >= 0) continue; const q = [s0]; comp[s0] = c; for (let k = 0; k < q.length; k++) for (const e of g.adj[q[k]]) if (comp[e.to] < 0) { comp[e.to] = c; q.push(e.to); } if (q.length > bestN) { bestN = q.length; best = c; } c++; }
    this.pool = g.nodes.map((n, i) => i).filter((i) => comp[i] === best);
    this.version = w.version; this.stats.nodes = this.pool.length; this.stats.floors = new Set(this.pool.map((i) => g.nodes[i].floor)).size;
    const spawnAt = this.pool[(this.rand() * this.pool.length) | 0];
    // 世界重建后节点编号全变：整群重新撒在一个节点附近（片头那一团）
    this.crabs = Array.from({ length: this.count }, () => { const n = g.nodes[spawnAt]; return { node: spawnAt, x: n.x + (this.rand() - .5) * .3, z: n.z + (this.rand() - .5) * .3, y: this.h[spawnAt], side: (this.rand() - .5) * .14, speed: .55 + this.rand() * .35 }; });
    this.setTarget(this.pool[(this.rand() * this.pool.length) | 0]);
  }
  /** 新目标：反向 Dijkstra 一次，得到全图「下一跳」表（整群共用）。 */
  setTarget(id) {
    const g = this.nav.graph, n = g.nodes.length, dist = new Float64Array(n).fill(Infinity), next = new Int32Array(n).fill(-1), rev = Array.from({ length: n }, () => []);
    for (let a = 0; a < n; a++) for (const e of g.adj[a]) rev[e.to].push({ from: a, cost: e.cost });
    const heap = [[0, id]]; dist[id] = 0;
    const pop = () => { let bi = 0; for (let i = 1; i < heap.length; i++) if (heap[i][0] < heap[bi][0]) bi = i; const t = heap[bi]; heap[bi] = heap[heap.length - 1]; heap.pop(); return t; };
    while (heap.length) { const [d, v] = pop(); if (d > dist[v]) continue; for (const r of rev[v]) { const nd = d + r.cost; if (nd < dist[r.from]) { dist[r.from] = nd; next[r.from] = v; heap.push([nd, r.from]); } } }
    this.target = id; this.next = next; this.dist = dist; this.t = 0; this.stats.retargets++;
    return dist;
  }
  step(dt) {
    if (this.version !== this.world.version || !this.nav) this.#rebuild();
    if (!this.pool.length) return;
    this.t += dt; if (this.t > this.retarget) this.setTarget(this.pool[(this.rand() * this.pool.length) | 0]);
    const g = this.nav.graph, m = new THREE.Matrix4(), cell = .12, hash = new Map(), key = (x, z) => Math.floor(x / cell) + ',' + Math.floor(z / cell);
    for (const c of this.crabs) { const k = key(c.x, c.z); if (!hash.has(k)) hash.set(k, []); hash.get(k).push(c); }
    let arrived = 0, maxStep = 0;
    this.crabs.forEach((c, i) => {
      const nx = this.next[c.node], here = g.nodes[c.node], to = nx >= 0 ? g.nodes[nx] : here;
      // 朝下一跳节点（带个体侧偏，避免排成一列）
      let dx = to.x - c.x, dz = to.z - c.z; const d = Math.hypot(dx, dz) || 1;
      const tx = to.x + (-dz / d) * c.side, tz = to.z + (dx / d) * c.side; dx = tx - c.x; dz = tz - c.z;
      const l = Math.hypot(dx, dz);
      if (nx < 0) arrived++;
      let vx = l > 1e-4 ? dx / l * c.speed : 0, vz = l > 1e-4 ? dz / l * c.speed : 0;
      // 分离
      const gx = Math.floor(c.x / cell), gz = Math.floor(c.z / cell);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const o of hash.get((gx + a) + ',' + (gz + b)) || []) { if (o === c) continue; const ox = c.x - o.x, oz = c.z - o.z, od = Math.hypot(ox, oz); if (od < .07 && od > 1e-6) { vx += ox / od * .5; vz += oz / od * .5; } }
      if (nx < 0) { vx *= .25; vz *= .25; }
      c.x += vx * dt; c.z += vz * dt;
      // 高度：当前节点 → 下一跳节点的表面高按走过的比例插值（上下台阶 / 屋坡连续）
      const dh = Math.hypot(to.x - here.x, to.z - here.z) || 1, f = Math.max(0, Math.min(1, 1 - Math.hypot(to.x - c.x, to.z - c.z) / dh));
      const y = nx >= 0 ? this.h[c.node] * (1 - f) + this.h[nx] * f : this.h[c.node];
      if (nx >= 0 && Math.hypot(to.x - c.x, to.z - c.z) < .14) c.node = nx;
      maxStep = Math.max(maxStep, Math.abs(y - c.y)); c.y = y;
      m.makeTranslation(c.x, c.y + .03, c.z); this.mesh.setMatrixAt(i, m);
    });
    this.mesh.count = this.crabs.length; this.mesh.instanceMatrix.needsUpdate = true;
    this.stats.arrived = arrived; this.stats.maxStep = Math.max(this.stats.maxStep * .98, maxStep);
  }
  dispose() { this.view.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.disposed = true; }
}

/** app.js 挂钩：?crabs=1。自带 rAF 循环（不占 view.onFrame，那是 Battle 的）。 */
export function attachCrabSwarm(view, world, opts = {}) {
  const swarm = new CrabSwarm(view, world, opts); let last = performance.now();
  const loop = (now) => { if (swarm.disposed) return; const dt = Math.min(.05, (now - last) / 1000); last = now; try { swarm.step(dt); } catch (e) { console.warn('crab swarm', e); } requestAnimationFrame(loop); };
  requestAnimationFrame(loop); return swarm;
}
