/**
 * info-graph.js — 883447205176238083「A dynamic node graph help the fellas keep track of their mates and share local info.
 *   Makes for somewhat more cohesive groups」。迁自 REACode/src/infograph.js，接真实 Battle。
 *
 * 三件事（与原版一致）：
 *   ① dynamic graph：每次更新按距离重建边（同队、同层、半径内、视线不被地形挡住），走散就断、靠拢就连；
 *   ② local info：只有「我亲眼看到的敌人」是源（信心 1）；邻居沿边转告，每跳 × decay，最多 hops 跳——没有全局广播；
 *   ③ somewhat cohesive：不替代流场/寻路，只在没有自己目标时「跟着情报走」，并给一点朝邻居质心的偏移。
 * 情报内容 = 最近被看到的那个敌人（cell / floor / 位置）与信心；Battle 里给维京人用：一人看到守军，旁边几人一起扑过去，
 * 而不是各自继续奔向小屋。参数是本地工程取值（原片无数值）。
 */
export class InfoGraph {
  constructor({ radius = 1.1, sight = 1.2, hops = 2, decay = .55, threshold = .25, heightTolerance = .3, cohesion = .25 } = {}) {
    if (![radius, sight, decay, threshold, heightTolerance, cohesion].every(Number.isFinite) || radius <= 0 || sight <= 0 || !(decay > 0 && decay < 1) || !Number.isInteger(hops) || hops < 0) throw new RangeError('invalid info graph');
    Object.assign(this, { radius, sight, hops, decay, threshold, heightTolerance, cohesion });
    this.stamp = -1; this.stats = { members: 0, edges: 0, components: 0, sources: 0, informed: 0 }; this.info = new Map();
  }
  /** units: 同一阵营的成员；foes: 敌方；canSee(a,b)：视线（Battle 里是 navigation.canMelee 同款的 clearSegment）。 */
  update(units, foes, { canSee = () => true, cellAt = null } = {}) {
    const n = units.length, nb = Array.from({ length: n }, () => []), r2 = this.radius * this.radius;
    let edges = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = units[i], b = units[j], dx = a.x - b.x, dz = a.z - b.z;
      if (dx * dx + dz * dz > r2 || Math.abs((a.y ?? 0) - (b.y ?? 0)) > this.heightTolerance || !canSee(a, b)) continue;
      nb[i].push(j); nb[j].push(i); edges++;
    }
    // 源：亲眼看见的最近敌人
    const conf = new Float64Array(n), intel = new Array(n).fill(null);
    let sources = 0;
    for (let i = 0; i < n; i++) {
      const u = units[i]; let best = null, bd = this.sight;
      for (const f of foes) { const d = Math.hypot(f.x - u.x, f.z - u.z); if (d < bd && Math.abs((f.y ?? 0) - (u.y ?? 0)) <= this.heightTolerance && canSee(u, f)) { bd = d; best = f; } }
      if (best) { conf[i] = 1; intel[i] = { foe: best, x: best.x, z: best.z, floor: best.navFloor, cell: cellAt ? cellAt(best.x, best.z) : null, from: u, hops: 0 }; sources++; }
    }
    // 沿边传：原版修过的那一处——源在第 0 跳就写进初值，不慢一拍
    for (let h = 0; h < this.hops; h++) {
      const cur = conf.slice(), curIntel = intel.slice();
      for (let i = 0; i < n; i++) for (const j of nb[i]) {
        const v = cur[j] * this.decay;
        if (v > conf[i] && curIntel[j]) { conf[i] = v; intel[i] = { ...curIntel[j], hops: curIntel[j].hops + 1 }; }
      }
    }
    // 连通块
    const seen = new Uint8Array(n); let comps = 0;
    for (let i = 0; i < n; i++) { if (seen[i]) continue; comps++; const st = [i]; seen[i] = 1; while (st.length) { const k = st.pop(); for (const j of nb[k]) if (!seen[j]) { seen[j] = 1; st.push(j); } } }
    this.info.clear(); let informed = 0;
    for (let i = 0; i < n; i++) {
      const u = units[i];
      // 质心偏移（邻居越有信息越信它：权重 0.4 + conf，原版 stepUnits 的 coherence）
      let mx = 0, mz = 0, w = 0;
      for (const j of nb[i]) { const ww = .4 + conf[j]; mx += units[j].x * ww; mz += units[j].z * ww; w += ww; }
      const entry = { conf: conf[i], intel: conf[i] >= this.threshold ? intel[i] : null, neighbors: nb[i].map((j) => units[j]), centroid: w ? { x: mx / w, z: mz / w } : null };
      if (entry.intel && entry.intel.hops > 0) informed++;
      this.info.set(u, entry);
    }
    this.stats = { members: n, edges, components: comps, sources, informed, avgDegree: n ? 2 * edges / n : 0 };
    return this.stats;
  }
  /** 有转告来的情报（不是自己看到的）才返回——自己看到的已经由 Battle 的近敌逻辑处理。 */
  relayed(u) { const e = this.info.get(u); return e?.intel && e.intel.hops > 0 && !e.intel.foe.dead ? e.intel : null; }
  /** 朝邻居质心的小偏移（cohesion × 自己的信心），给调用方叠到移动目标上。 */
  cohesionOffset(u) {
    const e = this.info.get(u); if (!e?.centroid) return { x: 0, z: 0 };
    const dx = e.centroid.x - u.x, dz = e.centroid.z - u.z, d = Math.hypot(dx, dz); if (d < 1e-6) return { x: 0, z: 0 };
    const k = this.cohesion * Math.min(1, d / 1.6) * (.35 + e.conf);
    return { x: dx / d * k, z: dz / d * k };
  }
  /** Battle 用：每个模拟时刻只重建一次。返回 u 的转告目标 {cell, floor} 或 null。 */
  goalFor(u, battle, alive) {
    if (battle.t !== this.stamp) {
      this.stamp = battle.t;
      const mates = alive.filter((v) => v.team === u.team && !v.onBoat && !v.fall), foes = alive.filter((v) => v.team !== u.team && !v.onBoat && !v.fall);
      const nav = battle.navigation;
      this.update(mates, foes, { canSee: (a, b) => nav.clearSegment({ x: a.x, y: a.y + .1, z: a.z }, { x: b.x, y: b.y + .1, z: b.z }), cellAt: (x, z) => battle.view.index.cellAt(x, z) });
    }
    const k = this.relayed(u); return k?.cell ? { cell: k.cell, floor: k.floor, intel: k } : null;
  }
}
