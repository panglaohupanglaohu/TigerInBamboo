/**
 * prop-anim-layer.js — r55：把 core/prop-anim.js 的 slot 记录表接到由 World 派生的合并道具网格。
 * 1246074663546916873 "The props now animate when they appear and disappear. This was much trickier than I anticipated."
 *
 * 道具从共享 World 派生（不是手摆）：
 *   - 后院格（core/courtyards.js 封闭地面层）→ 木箱 + 小灌木，key = yard:<格>
 *   - 码头临水边（顶=1 的建筑格、边外是水）→ 系缆桩，key = bollard:<格>:<边>
 * 全部写进**一个** BufferGeometry：每个 slot 占固定的顶点段，每顶点带 aPropSlot；
 * 每帧只上传 slot 记录（根点 xyz + 缩放，DataTexture，capacity×4 float），顶点着色器
 * 绕根点缩放（propScaleGLSL）。World 变了只给**新出生**的 slot 写顶点段（addUpdateRange），
 * 未变的道具不重写、不重放动画；消失的道具保留旧顶点段先缩没，PropLifecycle 释放 slot 后才可复用。
 *
 * 不改 view.js / worldmesh.js（文件归属）：本层自己挂到 view.scene，自己跑 rAF。
 * 主场景接法：index.html?propanim=1（app.js 一处动态 import），或 view.js 构造末尾一行
 *   `import('./prop-anim-layer.js').then(m => this.propAnim = m.attachPropAnim(this, this.town));`
 */
import * as THREE from 'three';
import { PropLifecycle, propScaleGLSL } from '../core/prop-anim.js';
import { classifyCourtyards } from '../core/courtyards.js';

const V = 72;   // 每个 slot 的固定顶点数（非索引三角形）

/** 从 World 派生道具清单：[{key, kind, x, y, z, cell}] —— 纯函数，node 可测。 */
export function collectWorldProps(world, { L = .5 } = {}) {
  const props = [], { mask } = classifyCourtyards(world);
  for (const c of world.cells) {
    const top = world.top(c);
    if (top !== 1 || !world.isBuilt(c, 1)) continue;
    if (mask[c.id]) { props.push({ key: 'yard:' + c.id, kind: 'crate', cell: c.id, x: c.cx, y: L, z: c.cz }); continue; }
    for (let i = 0; i < c.n; i++) {
      const o = world.neighbor(c, i);
      if (o && world.isSolid(o, 1)) continue;
      const a = c.pts[i], b = c.pts[(i + 1) % c.n], mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      // 往格内收一点，桩子站在码头面上
      props.push({ key: `bollard:${c.id}:${i}`, kind: 'bollard', cell: c.id, x: mx + (c.cx - mx) * .18, y: L, z: mz + (c.cz - mz) * .18 });
    }
  }
  return props;
}

const COLORS = { crate: [0.62, 0.42, 0.24], crateTop: [0.74, 0.54, 0.32], bush: [0.33, 0.55, 0.30], bollard: [0.22, 0.22, 0.25], cap: [0.85, 0.82, 0.74] };
function box(out, x, y, z, sx, sy, sz, col, top = col) {
  const X = [x - sx / 2, x + sx / 2], Y = [y, y + sy], Z = [z - sz / 2, z + sz / 2];
  const P = (i, j, k) => [X[i], Y[j], Z[k]];
  const faces = [[P(0, 0, 1), P(1, 0, 1), P(1, 1, 1), P(0, 1, 1)], [P(1, 0, 0), P(0, 0, 0), P(0, 1, 0), P(1, 1, 0)], [P(1, 0, 1), P(1, 0, 0), P(1, 1, 0), P(1, 1, 1)],
    [P(0, 0, 0), P(0, 0, 1), P(0, 1, 1), P(0, 1, 0)], [P(0, 1, 1), P(1, 1, 1), P(1, 1, 0), P(0, 1, 0)], [P(0, 0, 0), P(1, 0, 0), P(1, 0, 1), P(0, 0, 1)]];
  const N = [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]];
  faces.forEach((f, k) => { for (const t of [[0, 1, 2], [0, 2, 3]]) for (const i of t) out.push({ p: f[i], n: N[k], c: k === 4 ? top : col }); });
}
function bush(out, x, y, z, r, col) {   // 八面体
  const v = [[r, 0, 0], [-r, 0, 0], [0, r, 0], [0, -r * .6, 0], [0, 0, r], [0, 0, -r]].map(([a, b, c]) => [x + a, y + b, z + c]);
  for (const [a, b, c] of [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [4, 3, 0], [1, 3, 4], [5, 3, 1], [0, 3, 5]]) {
    const A = v[a], B = v[b], C = v[c], u = A.map((q, i) => B[i] - q), w = A.map((q, i) => C[i] - q);
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], l = Math.hypot(...n) || 1;
    for (const p of [A, B, C]) out.push({ p, n: n.map((q) => q / l), c: col });
  }
}
/** 一个道具的顶点（≤ V），按 key 哈希做一点确定性变化。 */
export function propVerts(p, L = .5) {
  const out = [], h = (Math.imul(p.cell + 1, 2654435761) >>> 0) / 2 ** 32, s = L / .5;
  if (p.kind === 'crate') {
    box(out, p.x - .06 * s, p.y, p.z, .16 * s, .14 * s, .16 * s, COLORS.crate, COLORS.crateTop);
    bush(out, p.x + .1 * s, p.y + .07 * s, p.z + .02 * s, (.08 + .03 * h) * s, COLORS.bush);
  } else {
    box(out, p.x, p.y, p.z, .05 * s, .09 * s, .05 * s, COLORS.bollard);
    box(out, p.x, p.y + .09 * s, p.z, .065 * s, .02 * s, .065 * s, COLORS.cap);
  }
  if (out.length > V) throw new RangeError('prop template exceeds slot size');
  return out;
}

export class PropAnimLayer {
  constructor(world, { L = .5, capacity = 1024, spread = .35, collect = collectWorldProps, verts = propVerts } = {}) {
    this.world = world; this.L = L; this.capacity = capacity;
    this.collect = collect; this.verts = verts;   // r56 C05：可换道具来源/模板（world/prop-anim-yard-r56.js 用后院真实树木）
    this.life = new PropLifecycle({ capacity, spread });
    this.version = -1; this.kindOf = new Map();
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(capacity * V * 3); this.nrm = new Float32Array(capacity * V * 3); this.col = new Float32Array(capacity * V * 3);
    const slot = new Float32Array(capacity * V); for (let i = 0; i < capacity; i++) slot.fill(i, i * V, (i + 1) * V);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nrm, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aPropSlot', new THREE.BufferAttribute(slot, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.geometry = g;
    this.recTex = new THREE.DataTexture(this.life.records, capacity, 1, THREE.RGBAFormat, THREE.FloatType);
    this.recTex.needsUpdate = true;
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uPropRec = { value: this.recTex };
      sh.vertexShader = 'attribute float aPropSlot;\nuniform highp sampler2D uPropRec;\n' + propScaleGLSL + '\n' + sh.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n  vec4 propRec = texelFetch(uPropRec, ivec2(int(aPropSlot + .5), 0), 0);\n  transformed = propScaled(transformed, propRec);');
      this.compiled = true;
    };
    mat.customProgramCacheKey = () => 'prop-anim-slot';
    this.material = mat;
    this.mesh = new THREE.Mesh(g, mat); this.mesh.frustumCulled = false; this.mesh.name = 'propAnim';
    this.stats = { props: 0, live: 0, born: 0, vanishing: 0, syncs: 0, slotWrites: 0, geometryFloats: 0, recordFloats: 0, rebuildFloats: 0 };
  }
  /** World 变了：同步道具清单，只给新出生的 slot 写顶点段。返回本次写入。 */
  refresh(now) {
    if (this.world.version === this.version) return null;
    this.version = this.world.version;
    const props = this.collect(this.world, { L: this.L });
    const before = new Map([...this.life.byKey].map(([k, e]) => [k, e.hideAt === undefined]));
    this.life.sync(props, now);
    const ranges = [];
    for (const p of props) {
      const wasLive = before.get(p.key);
      if (wasLive === true) continue;                                 // 未变：不重写、不重放
      const slot = this.life.slotOf(p.key);
      if (wasLive === false && this.kindOf.get(slot) === p.kind) continue;   // 消失中又回来：同一 slot 原地长回
      this.writeSlot(slot, p); ranges.push(slot);
    }
    const attrs = ['position', 'normal', 'color'].map((k) => this.geometry.attributes[k]);
    for (const a of attrs) { a.clearUpdateRanges?.(); for (const s of ranges) a.addUpdateRange(s * V * 3, V * 3); if (ranges.length) a.needsUpdate = true; }
    const floats = ranges.length * V * 9;
    this.stats.syncs++; this.stats.slotWrites += ranges.length; this.stats.geometryFloats += floats; this.stats.props = props.length; this.stats.born = ranges.length;
    // 对照：每次 World 变更都整批重建合并网格要写的 float 数
    this.stats.rebuildFloats += props.length * V * 9;
    return { born: ranges.length, floats, props: props.length };
  }
  writeSlot(slot, p) {
    const vs = this.verts(p, this.L), o = slot * V * 3;
    this.pos.fill(0, o, o + V * 3); this.nrm.fill(0, o, o + V * 3); this.col.fill(0, o, o + V * 3);
    vs.forEach((v, i) => { this.pos.set(v.p, o + i * 3); this.nrm.set(v.n, o + i * 3); this.col.set(v.c, o + i * 3); });
    // 剩余顶点退化在根点（缩放后仍是零面积）
    for (let i = vs.length; i < V; i++) this.pos.set([p.x, p.y, p.z], o + i * 3);
    this.kindOf.set(slot, p.kind);
  }
  /** 每帧：推进 PropLifecycle，上传 slot 记录表。 */
  update(now) {
    this.refresh(now);
    const live = this.life.update(now);
    this.recTex.needsUpdate = true;
    this.stats.live = live; this.stats.recordFloats = this.capacity * 4;
    let vanishing = 0; for (const e of this.life.byKey.values()) if (e.hideAt !== undefined) vanishing++;
    this.stats.vanishing = vanishing;
    return live;
  }
  scaleOf(key) { const s = this.life.slotOf(key); return s < 0 ? null : this.life.records[s * 4 + 3]; }
  dispose() { this.geometry.dispose(); this.material.dispose(); this.recTex.dispose(); this.mesh.removeFromParent(); }
}

/** 挂到 View：自带 rAF，不需要改 view.js。 */
export function attachPropAnim(view, world, opts = {}) {
  const layer = new PropAnimLayer(world, { L: view.levelHeight ?? .5, ...opts });
  view.scene.add(layer.mesh);
  const tick = () => { if (!layer.mesh.parent) return; layer.update(layer.clock ? layer.clock() : performance.now() / 1000); requestAnimationFrame(tick); };   // layer.clock：验收时可冻结时间
  requestAnimationFrame(tick);
  return layer;
}
