/**
 * town-skin-layer.js — 第 56 批 C07：把 core/town-skin.js 的「全城一张 128² 总贴图」接进 View 主材质（默认关）。
 *
 *   1430227487376781317 改一张 TownColor.png → 整城换肤（运行时热替换：画、拖 PNG 进窗口、loadImage、scribble）
 *   1241096929490149376 建筑表面采样走 every-other-pixel-is-a-line（放大）+ 色格内 mip 链（缩小）
 *   1241046107125399552 植物叶纹改读同一张图的 32² 右下角（Vegetation.leafSurface 的 uniform 指过来）
 *
 * 怎么拿到「每个顶点用的是哪种调色板颜色」：WorldMesh 烘焙会把 AO / 反弹光乘进顶点色，原色丢了。
 * 这里按同一 World、同一 shape、同一分块规则再跑一遍地形 + 建筑生成器，写进会记录「颜色对象」的 MeshWriter 子类；
 * 拼接顺序与 WorldMesh 一样（分块 Map 的插入顺序），逐顶点位置必须与主网格完全相等才用（不等就报 mismatch 并不换肤）。
 */
import * as THREE from 'three';
import { MeshWriter } from '../core/meshwriter.js';
import { buildTerrain } from '../terrain/terrainmesh.js';
import { buildBuildings } from '../build/buildings.js';
import { SKIN_SIZE, SKIN_SLOTS, buildSkinAtlas, buildSkinMips, skinAttributes, scribble, SKIN_VERT_PARS, SKIN_VERT_BODY, SKIN_FRAG_PARS, SKIN_FRAG_BODY } from '../core/town-skin.js';

class RecordingWriter extends MeshWriter {
  constructor() { super(); this.base = []; }
  tri(a, b, c, dir, color, ...rest) { super.tri(a, b, c, dir, color, ...rest); this.base.push(color, color, color); }
  triC(a, b, c, dir, ca, cb, cc, g) {
    // 与 MeshWriter.triC 同样的翻绕序判断，保证记录顺序与写入的顶点一致
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const flip = dir && nx * dir[0] + ny * dir[1] + nz * dir[2] < 0;
    super.triC(a, b, c, dir, ca, cb, cc, g);
    this.base.push(ca, flip ? cc : cb, flip ? cb : cc);
  }
}
/** 与 worldmesh.js 内部 ChunkRouter 同样的路由（那个类没导出；这里只读同一 chunkKey）。 */
class RecordingRouter {
  constructor(chunkOf) { this.chunkOf = chunkOf; this.writers = new Map(); this.colorCache = new Map(); this._soft = false; this.cur = this.writer(0); }
  writer(k) { let w = this.writers.get(k); if (!w) { w = new RecordingWriter(); w.colorCache = this.colorCache; w.soft = this._soft; this.writers.set(k, w); } return w; }
  at(cell) { this.cur = this.writer(this.chunkOf(cell)); this.cur.soft = this._soft; this.cur.edgeTri = this._edgeTri; }
  set fieldFrame(v) { this.cur.fieldFrame = v; }
  set edgeTri(v) { this._edgeTri = v; this.cur.edgeTri = v; }
  get edgeTri() { return this._edgeTri; }
  set soft(v) { this._soft = v; this.cur.soft = v; }
  get soft() { return this._soft; }
  c(hex) { return this.cur.c(hex); }
  tri(...a) { this.cur.tri(...a); } quad(...a) { this.cur.quad(...a); } poly(...a) { this.cur.poly(...a); } triC(...a) { this.cur.triC(...a); }
  beam(...a) { this.cur.beam(...a); } box(...a) { this.cur.box(...a); } blob(...a) { this.cur.blob(...a); }
  get triangles() { let n = 0; for (const w of this.writers.values()) n += w.triangles; return n; }
}

/** 重跑生成器拿每顶点底色对象；与 geometry 逐顶点位置比对。 */
export function recordVertexBase(worldMesh, geometry, { buildingsOnly = true } = {}) {
  const world = worldMesh.world, r = new RecordingRouter((c) => worldMesh.chunkKey(c));
  buildTerrain(r, world, { L: worldMesh.L, shape: worldMesh.shape });
  buildBuildings(r, world, { L: worldMesh.L, debugModules: worldMesh.debugModules });
  const ws = [...r.writers.values()].filter((w) => w.pos.length);
  const pos = geometry.getAttribute('position').array, field = geometry.getAttribute('aField')?.array;
  const n = pos.length / 3, base = new Array(n);
  let o = 0, mismatch = 0;
  for (const w of ws) for (let i = 0; i < w.pos.length / 3; i++, o++) {
    if (o >= n) { mismatch++; continue; }
    if (Math.abs(w.pos[i * 3] - pos[o * 3]) > 1e-5 || Math.abs(w.pos[i * 3 + 1] - pos[o * 3 + 1]) > 1e-5 || Math.abs(w.pos[i * 3 + 2] - pos[o * 3 + 2]) > 1e-5) mismatch++;
    // buildingsOnly：地形（aField.z ≠ 0：顶面 / 崖壁）保持顶点色；片子里换肤的是建筑表面
    base[o] = buildingsOnly && field && Math.abs(field[o * 3 + 2]) > 0.5 ? null : w.base[i];
  }
  if (o !== n) mismatch += Math.abs(o - n);
  return { base, mismatch, vertices: n };
}

export class TownSkinLayer {
  constructor(view) {
    this.view = view; this.on = false; this.geo = null; this.stats = {};
    this.data = new Uint8Array(SKIN_SIZE * SKIN_SIZE * 4);
    this.tex = new THREE.DataTexture(this.data, SKIN_SIZE, SKIN_SIZE, THREE.RGBAFormat);
    this.mip = new THREE.DataTexture(new Uint8Array(SKIN_SIZE * SKIN_SIZE * 4), SKIN_SIZE, SKIN_SIZE, THREE.RGBAFormat);
    for (const t of [this.tex, this.mip]) { t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true; }
    this.u = { uC07Skin: { value: 0 }, uC07SkinTex: { value: this.tex }, uC07SkinMip: { value: this.mip }, uC07SkinScale: { value: 1.25 } };
    this.colors = null; this.edited = false;
    this.#patch(view.material);
    this.#dropTarget(view.renderer?.domElement);
    // 主网格一重建就立刻补属性（不能等到这一帧画完：拖动建造 / 开场演示时每帧都在重建，晚一帧就整帧缺属性 → 光照比 0 → 全黑）
    const wm = view.worldMesh, rawRebuild = wm.rebuild.bind(wm);
    wm.rebuild = (...a) => { const r = rawRebuild(...a); if (r && this.on) this.refresh(); return r; };
  }
  #patch(material) {
    const prev = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      prev?.call(material, shader, renderer);
      Object.assign(shader.uniforms, this.u);
      for (const t of ['#include <common>', '#include <begin_vertex>']) if (!shader.vertexShader.includes(t)) throw new Error('town-skin: vertex token ' + t);
      if (!shader.fragmentShader.includes('#include <color_fragment>')) throw new Error('town-skin: fragment token');
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + SKIN_VERT_PARS).replace('#include <begin_vertex>', '#include <begin_vertex>\n' + SKIN_VERT_BODY);
      // 紧跟在 color_fragment 之后：先换底色，后面的积雪 / 斑块 / 阴影等效果照常叠在上面
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + SKIN_FRAG_PARS).replace('#include <color_fragment>', '#include <color_fragment>\n' + SKIN_FRAG_BODY);
    };
    const prevKey = material.customProgramCacheKey;
    material.customProgramCacheKey = () => (prevKey ? prevKey.call(material) : '') + '+town-skin-c07';
    material.needsUpdate = true;
  }
  /** 主网格换了（编辑 / 换场景）→ 重新记录底色、写顶点属性。图集被改过就保留改过的图，只给新颜色补格。 */
  refresh() {
    const g = this.view.worldMesh.geometry;
    if (!this.on || this.geo === g) return;
    const t0 = performance.now();
    const rec = recordVertexBase(this.view.worldMesh, g);
    if (rec.mismatch) { this.stats = { mismatch: rec.mismatch, vertices: rec.vertices }; this.u.uC07Skin.value = 0; this.geo = g; return; }
    const col = g.getAttribute('color').array;
    const a = skinAttributes(col, rec.base);
    g.setAttribute('aC07Cell', new THREE.BufferAttribute(a.cell, 2));
    g.setAttribute('aC07Ratio', new THREE.BufferAttribute(a.ratio, 3));
    const same = this.colors && a.colors.length === this.colors.length && a.colors.every((c, i) => c === this.colors[i]);
    if (!this.edited || !this.colors) { this.data.set(buildSkinAtlas(a.colors)); this.#upload(); }
    else if (!same) { // 改过图：保住已有格（同颜色对象落同一格的前提是排序不变；不同就重画那些格之外的新格）
      const fresh = buildSkinAtlas(a.colors);
      a.colors.forEach((c, i) => { if (this.colors[i] !== c) copyCell(fresh, this.data, i); });
      this.#upload();
    }
    this.colors = a.colors; this.geo = g; this.u.uC07Skin.value = 1;
    let skinned = 0; for (let i = 0; i < a.cell.length; i += 2) if (a.cell[i] >= 0) skinned++;
    this.stats = { vertices: rec.vertices, skinned, slots: a.colors.length, overflow: a.overflow, mismatch: 0, ms: Math.round(performance.now() - t0) };
  }
  #upload() { this.mip.image.data.set(buildSkinMips(this.data)); this.tex.needsUpdate = true; this.mip.needsUpdate = true; }
  set(on) {
    this.on = !!on;
    const veg = this.view.vegetation?.leafSurface;
    if (on) { this.geo = null; this.refresh(); if (veg) { this.savedLeaf ??= veg.uniform.value; veg.uniform.value = this.tex; } }
    else { this.u.uC07Skin.value = 0; if (veg && this.savedLeaf) veg.uniform.value = this.savedLeaf; }
    return this.on;
  }
  /** 片子里的那几笔：蓝色 S 形涂鸦 → 整城一起变 */
  scribble(opts) { const n = scribble(this.data, opts); this.edited = true; this.#upload(); return n; }
  /** 任意 2D 画法：fn(ctx, size)；画完读回图集 */
  paint(fn) {
    const cv = document.createElement('canvas'); cv.width = cv.height = SKIN_SIZE; const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.putImageData(new ImageData(new Uint8ClampedArray(this.data), SKIN_SIZE, SKIN_SIZE), 0, 0); fn(ctx, SKIN_SIZE);
    this.data.set(ctx.getImageData(0, 0, SKIN_SIZE, SKIN_SIZE).data); this.edited = true; this.#upload();
  }
  /** 热替换：PNG/JPG 的 URL、Blob 或 File（任意尺寸，缩放到 128²，最近邻） */
  async loadImage(src) {
    const url = typeof src === 'string' ? src : URL.createObjectURL(src);
    const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
    this.paint((ctx, s) => { ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, s, s); ctx.drawImage(img, 0, 0, s, s); });
    return { width: img.width, height: img.height };
  }
  /** 导出当前 TownColor.png（data URL），可拿去任意画图软件改了再拖回来 */
  toPNG() {
    const cv = document.createElement('canvas'); cv.width = cv.height = SKIN_SIZE;
    cv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(this.data), SKIN_SIZE, SKIN_SIZE), 0, 0);
    return cv.toDataURL('image/png');
  }
  reset() { this.edited = false; if (this.colors) { this.data.set(buildSkinAtlas(this.colors)); this.#upload(); } }
  #dropTarget(el) {
    if (!el?.addEventListener) return;
    el.addEventListener('dragover', (e) => { if (this.on) e.preventDefault(); });
    el.addEventListener('drop', (e) => { if (!this.on) return; const f = e.dataTransfer?.files?.[0]; if (f && /^image\//.test(f.type)) { e.preventDefault(); this.loadImage(f); } });
  }
}
function copyCell(from, to, slot) {
  const [gx, gy] = SKIN_SLOTS[slot];
  for (let y = 0; y < 16; y++) { const o = ((gy * 16 + y) * SKIN_SIZE + gx * 16) * 4; to.set(from.subarray(o, o + 64), o); }
}
