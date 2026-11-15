/**
 * sprite-pack-c09.js — 第 56 批 C09-A：运行时精灵图集（单视角/多视角分配、编号、释放残影、满板扩容）。
 *
 * 1593215065423245313 "Making a lil dynamic sprite packer, able to add and remove sprite allotments at runtime …
 *   the sprites are baked live from meshes. So I guess it's basically impostors."
 *   画面：深灰板上，球 / 方块 / 胶囊 / 花 / 球团 / 雪人等白模被现场烘成精灵，尺寸各不相同；每个分配区有
 *   编号，活着的描黄框；一批批加满、再一批批删掉，删掉的位置留着暗淡的旧图（调试残影），新分配盖上去才清掉；
 *   有的分配区里是同一网格的几个视角（2×2）。
 *
 * 共享件：分配全部走 core/atlas.js 的 Atlas（place 候选 + 跨叶、key 释放、grow 整批重排）；ImpostorBaker 的
 *   8 视角整组预留仍是树/云用的那条路。本文件补"单视角 / 2×2 视角"的分配区、编号、残影与扩容搬运。
 *   SpritePackPlan —— 纯逻辑（node 可测）：编号、key、残影列表、扩容时的新旧位置映射。
 *   LiveSpritePacker —— GPU：在 WebGLRenderTarget 里清槽 → 烘焙 → 释放时压暗（残影）或清透明；扩容时把每个
 *   存活分配区从旧 RT 搬到新 RT 的新位置（UV 由调用方按 moved 映射更新）。
 * 原美术没有：网格都是程序化白模（花 = 5 个压扁椭球花瓣等）。
 */
import { Atlas } from '../core/atlas.js';

function lcg(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

export class SpritePackPlan {
  constructor(size = 512, { grow = false, maxSize = 2048, pad = 4, seed = 1 } = {}) {
    this.atlas = new Atlas(size, size); this.grow = grow; this.maxSize = maxSize; this.pad = pad;
    this.rng = lcg(seed); this.nextId = 0; this.live = new Map(); this.ghosts = [];
  }
  get size() { return this.atlas.width; }
  /** 申请一个 px×px（加 pad）的分配区；views=1 或 4（2×2 子格）。满板时按 grow 扩容（整批重排）或返回 null。 */
  add(px, { views = 1, kind = '' } = {}) {
    if (!Number.isSafeInteger(px) || px < 4) throw new RangeError('sprite px must be an integer ≥4');
    if (views !== 1 && views !== 4) throw new RangeError('views must be 1 or 4');
    const id = this.nextId, key = 's' + id, side = px + this.pad * 2;
    let slot = this.atlas.place(key, side, side, { rng: this.rng, attempts: 48 }), moved = null;
    while (!slot && this.grow && this.atlas.width * 2 <= this.maxSize) {
      const res = this.atlas.grow(); if (!res) break;
      moved = new Map();
      for (const [sid, e] of this.live) { const n = res.atlas.slot('s' + sid); moved.set(sid, { from: e.slot, to: n }); e.slot = n; }
      this.atlas = res.atlas; this.ghosts = [];               // 整批重排后旧残影没有意义
      slot = this.atlas.place(key, side, side, { rng: this.rng, attempts: 48 });
    }
    if (!slot) return null;
    this.nextId++;
    // 新分配盖住的残影清掉（GPU 侧会清整个分配区）
    this.ghosts = this.ghosts.filter((g) => g.x >= slot.x + slot.w || slot.x >= g.x + g.w || g.y >= slot.y + slot.h || slot.y >= g.y + g.h);
    const e = { id, slot, px, views, kind }; this.live.set(id, e);
    return { ...e, moved };
  }
  /** 释放；residue=true 时记一个残影（编号保留，画灰色）。 */
  remove(id, { residue = true } = {}) {
    const e = this.live.get(id); if (!e) return false;
    if (!this.atlas.remove('s' + id)) return false;
    this.live.delete(id);
    if (residue) this.ghosts.push({ id, x: e.slot.x, y: e.slot.y, w: e.slot.w, h: e.slot.h, kind: e.kind });
    return e;
  }
  /** 分配区内各视角的子矩形（像素，左下原点）。 */
  cells(e) {
    const p = this.pad, x = e.slot.x + p, y = e.slot.y + p, s = e.px;
    if (e.views === 1) return [{ x, y, w: s, h: s }];
    const h = Math.floor(s / 2); return [0, 1, 2, 3].map((k) => ({ x: x + (k % 2) * h, y: y + Math.floor(k / 2) * h, w: h, h }));
  }
  /** 所有存活分配区互不重叠且在板内（测试与页面自检用）。 */
  check() {
    const L = [...this.live.values()].map((e) => e.slot), S = this.atlas.width;
    for (let i = 0; i < L.length; i++) {
      const a = L[i]; if (a.x < 0 || a.y < 0 || a.x + a.w > S || a.y + a.h > S) return false;
      for (let j = i + 1; j < L.length; j++) { const b = L[j]; if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) return false; }
    }
    return true;
  }
}

/** GPU 侧。THREE 由调用方传入（node 测试可不加载）。 */
export class LiveSpritePacker {
  constructor(THREE, renderer, plan) {
    this.T = THREE; this.r = renderer; this.plan = plan;
    this.rt = this.#makeRT(plan.size);
    this.scene = new THREE.Scene(); this.scene.add(new THREE.AmbientLight(0xffffff, .55));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(-.5, 1.2, 1); this.scene.add(sun);
    this.mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.dark = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .62, depthTest: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor }));
    this.flat = new THREE.Scene(); this.flatCam = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
  }
  #makeRT(size) { const T = this.T; const rt = new T.WebGLRenderTarget(size, size, { depthBuffer: true }); rt.texture.minFilter = T.LinearFilter; rt.texture.generateMipmaps = false; this.#clearAll(rt); return rt; }
  #clearAll(rt) { const r = this.r, prev = r.getRenderTarget(); r.setRenderTarget(rt); r.setClearColor(0, 0); r.clear(true, true, true); r.setRenderTarget(prev); }
  #scissor(x, y, w, h, fn) {
    const r = this.r, rt = this.rt, prev = r.getRenderTarget(), cc = r.getClearColor(new this.T.Color()), ca = r.getClearAlpha();
    rt.viewport.set(x, y, w, h); rt.scissor.set(x, y, w, h); rt.scissorTest = true;
    try { r.setRenderTarget(rt); r.setClearColor(0, 0); fn(); } finally { rt.scissorTest = false; rt.viewport.set(0, 0, rt.width, rt.height); r.setRenderTarget(prev); r.setClearColor(cc, ca); }
  }
  /** 烘一个网格进新分配区；views=4 时 2×2 四个方位。返回 plan 记录（含 moved），满板返回 null。 */
  bake(geometry, px, { views = 1, kind = '', yaw = .6, pitch = .45 } = {}) {
    const T = this.T, res = this.plan.add(px, { views, kind });
    if (!res) return null;
    if (res.moved) this.#migrate(res.moved);
    geometry.computeBoundingSphere(); const bs = geometry.boundingSphere, rad = bs.radius * 1.05;
    const cam = new T.OrthographicCamera(-rad, rad, rad, -rad, .01, rad * 8), mesh = new T.Mesh(geometry, this.mat);
    this.scene.add(mesh);
    try {
      const s = res.slot; this.#scissor(s.x, s.y, s.w, s.h, () => { this.r.setClearColor(0, 0); this.r.clear(true, true, true); });
      this.plan.cells(res).forEach((c, k) => {
        const a = yaw + k * Math.PI / 2;
        cam.position.set(bs.center.x + Math.sin(a) * Math.cos(pitch) * rad * 4, bs.center.y + Math.sin(pitch) * rad * 4, bs.center.z + Math.cos(a) * Math.cos(pitch) * rad * 4); cam.lookAt(bs.center);
        this.#scissor(c.x, c.y, c.w, c.h, () => this.r.render(this.scene, cam));
      });
    } finally { this.scene.remove(mesh); }
    return res;
  }
  /** 删除：residue=true 把颜色和 alpha 一起乘 0.38（透明处仍透明，精灵变成暗淡残影，原片调试画面），否则清成透明。 */
  release(id, { residue = true } = {}) {
    const e = this.plan.remove(id, { residue }); if (!e) return false;
    const s = e.slot;
    if (residue) { this.flat.add(this.dark); this.#scissor(s.x, s.y, s.w, s.h, () => { this.r.autoClear = false; try { this.r.render(this.flat, this.flatCam); } finally { this.r.autoClear = true; } }); this.flat.remove(this.dark); }
    else this.#scissor(s.x, s.y, s.w, s.h, () => { this.r.setClearColor(0, 0); this.r.clear(true, true, true); });
    return e;
  }
  /** 扩容：新 RT，把每个存活分配区按 moved 从旧纹理搬过来。 */
  #migrate(moved) {
    const T = this.T, old = this.rt, S0 = old.width; this.rt = this.#makeRT(this.plan.size);
    const geo = new T.PlaneGeometry(2, 2), mat = new T.MeshBasicMaterial({ map: old.texture, transparent: true, blending: T.NoBlending, depthTest: false }), quad = new T.Mesh(geo, mat);   // NoBlending：原样拷 RGBA（透明处保持透明）
    this.flat.add(quad);
    try {
      for (const { from, to } of moved.values()) {
        const uv = geo.getAttribute('uv'), u0 = from.x / S0, v0 = from.y / S0, u1 = (from.x + from.w) / S0, v1 = (from.y + from.h) / S0;
        uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0); uv.needsUpdate = true;
        this.#scissor(to.x, to.y, to.w, to.h, () => this.r.render(this.flat, this.flatCam));
      }
    } finally { this.flat.remove(quad); geo.dispose(); mat.dispose(); old.dispose(); }
    this.grew = (this.grew || 0) + 1;
  }
}

/** 程序化白模（片中那几类：球、方块、胶囊、圆柱、花、球团、雪人、扭结、方块组）。 */
export function spriteMeshes(THREE) {
  const merge = (parts) => {
    const geos = parts.map(([g, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, ry = 0]) => { const q = (g.index ? g.toNonIndexed() : g); q.scale(sx, sy, sz); q.rotateY(ry); q.translate(x, y, z); return q; });
    const n = geos.reduce((s, g) => s + g.getAttribute('position').count, 0), pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
    for (const g of geos) { g.computeVertexNormals(); pos.set(g.getAttribute('position').array, o * 3); nor.set(g.getAttribute('normal').array, o * 3); o += g.getAttribute('position').count; }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); return out;
  };
  return {
    sphere: () => new THREE.SphereGeometry(1, 24, 16),
    box: () => new THREE.BoxGeometry(1.4, 1.4, 1.4),
    capsule: () => new THREE.CapsuleGeometry(.55, 1.1, 6, 16),
    cylinder: () => new THREE.CylinderGeometry(.8, .8, 1.3, 24),
    flower: () => merge([0, 1, 2, 3, 4].map((k) => [new THREE.SphereGeometry(.5, 16, 10), Math.cos(k * 1.2566) * .8, Math.sin(k * 1.2566) * .8, 0, 1.7, .5, .35, 0]).map((p, k) => { const g = p[0]; g.scale(1.7, .5, .35); g.rotateZ(k * 1.2566); g.translate(Math.cos(k * 1.2566) * .8, Math.sin(k * 1.2566) * .8, 0); return [g]; })),
    blobs: () => merge([[new THREE.SphereGeometry(.6, 16, 12), -.4, 0, 0], [new THREE.SphereGeometry(.55, 16, 12), .45, .1, .1], [new THREE.SphereGeometry(.5, 16, 12), 0, .6, -.1]]),
    snowman: () => merge([[new THREE.SphereGeometry(.6, 16, 12), 0, -.6, 0], [new THREE.SphereGeometry(.45, 16, 12), 0, .25, 0], [new THREE.SphereGeometry(.32, 16, 12), 0, .9, 0]]),
    knot: () => new THREE.TorusKnotGeometry(.6, .2, 64, 8),
    pom: () => merge(Array.from({ length: 14 }, (_, k) => [new THREE.SphereGeometry(.28, 10, 8), Math.cos(k * 2.4) * .55 * Math.sin(k * .7 + 1), Math.sin(k * 2.4) * .55 * Math.sin(k * .7 + 1), Math.cos(k * .7 + 1) * .5])),
  };
}
