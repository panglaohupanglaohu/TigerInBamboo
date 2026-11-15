/**
 * penumbra-terrain.js — 第 55 批（G2）：REACode penumbra.js 的"画三遍"半影接到**地形与悬挑接收面**，
 * 不再只画在水面上。
 *
 * 1305951750638231552 "I draw the shadow thrice, once normal, once pulled in slightly and once with big voxels"
 * 1313840428685447170 太阳 gizmo + 投影。
 *
 * 数据：light/penumbra.js 的 bakeVoxelPenumbra（共享 World 的体素占用；每个"上方为空、下方为实"的体素
 * 都是一个接收面——悬挑下面的地面和悬挑顶面是**两个**接收者）。这里把每个接收者的 alpha 打包成
 * 一张 2D 纹理：第 y 层体素占 V 方向的一段（nx × nz·ny），片元按 round(p.y / L) 选层。
 * 着色：链到 View 地形材质的 onBeforeCompile 之后（不改 view.js 主体），只作用在朝上的面
 * （侧墙仍由 N·L 明暗负责），outgoingLight *= 1 − strength·alpha。
 * 开启时关闭地形网格自己的 PCF 接收（半影替代它），并开 View 原有的水面半影层；关闭全部还原。
 */
import * as THREE from 'three';
import { bakeVoxelPenumbra } from '../light/penumbra.js';

export const PENUMBRA_TERRAIN_GLSL = /* glsl */ `
uniform sampler2D uPenTex;
uniform vec4 uPenGrid;   // minX, minZ, res, L
uniform vec3 uPenDims;   // nx, nz, ny
uniform float uPenOn;
float penumbraTone(vec3 p, vec3 nW) {
  if (uPenOn < .5) return 1.;
  float up = smoothstep(.55, .9, nW.y);
  if (up <= 0.) return 1.;
  float layer = clamp(floor(p.y / uPenGrid.w + .5), 0., uPenDims.z - 1.);
  vec2 ij = vec2((p.x - uPenGrid.x) / uPenGrid.z, (p.z - uPenGrid.y) / uPenGrid.z);
  if (ij.x < 0. || ij.y < 0. || ij.x > uPenDims.x || ij.y > uPenDims.y) return 1.;
  ij = clamp(ij, vec2(.5), uPenDims.xy - .5);
  vec2 uv = vec2(ij.x / uPenDims.x, (layer * uPenDims.y + ij.y) / (uPenDims.y * uPenDims.z));
  return 1. - uPenOn * .62 * up * texture2D(uPenTex, uv).r;
}`;

/** 把 bakeVoxelPenumbra 的接收者打包成 (nx, nz·ny) 的单通道字节图。纯函数，node 可测。 */
export function packPenumbraReceivers(field) {
  const { nx, nz, ny, receivers } = field;
  const data = new Uint8Array(nx * nz * ny * 4);
  for (const r of receivers) {
    const k = ((r.y * nz + r.z) * nx + r.x) * 4;
    data[k] = Math.round(Math.max(0, Math.min(1, r.alpha)) * 255);
    data[k + 3] = 255;
  }
  // 非接收者（实心 / 半空）格子沿列向下继承最近的接收者，避免线性过滤在崖边把影子"漂白"
  for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
    let last = 0;
    for (let y = 0; y < ny; y++) {
      const k = ((y * nz + z) * nx + x) * 4;
      if (data[k + 3]) last = data[k]; else data[k] = last;
    }
  }
  return { data, width: nx, height: nz * ny };
}

/** CPU 版着色器采样（最近邻），给测试对表：返回 alpha 0..1。 */
export function samplePacked(packed, field, x, y, z) {
  const layer = Math.max(0, Math.min(field.ny - 1, Math.floor(y / field.L + .5)));
  const i = Math.floor((x - field.minX) / field.res), j = Math.floor((z - field.minZ) / field.res);
  if (i < 0 || j < 0 || i >= field.nx || j >= field.nz) return 0;
  return packed.data[((layer * field.nz + j) * field.nx + i) * 4] / 255;
}

export class PenumbraTerrain {
  constructor(view) {
    this.view = view;
    this.enabled = false;
    this.uniforms = {
      uPenTex: { value: null }, uPenGrid: { value: new THREE.Vector4(0, 0, 1, view.levelHeight) },
      uPenDims: { value: new THREE.Vector3(1, 1, 1) }, uPenOn: { value: 0 },
    };
    this.version = -1; this.sun = new THREE.Vector3();
    const mat = view.material, prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey;
    mat.onBeforeCompile = (sh, r) => {
      prev?.call(mat, sh, r);
      Object.assign(sh.uniforms, this.uniforms);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + PENUMBRA_TERRAIN_GLSL)
        .replace('#include <opaque_fragment>', 'outgoingLight *= penumbraTone(vWPos, inverseTransformDirection(normal, viewMatrix));\n#include <opaque_fragment>');
    };
    mat.customProgramCacheKey = () => (prevKey ? prevKey.call(mat) : '') + '|penumbra-terrain';
    mat.needsUpdate = true;
  }

  setEnabled(on) {
    const v = this.view;
    on = !!on;
    if (on === this.enabled) return;
    this.enabled = on;
    if (on) {
      this.prevReceive = v.mesh.receiveShadow;
      v.mesh.receiveShadow = false;   // 半影替代 PCF 接收
      this.hadWater = !!v.penumbra;
      if (!v.penumbra) v.setPenumbra(true);
      this.version = -1;
      this.refresh();
    } else {
      v.mesh.receiveShadow = this.prevReceive ?? true;
      if (!this.hadWater && v.penumbra) v.setPenumbra(false);
      this.uniforms.uPenOn.value = 0;
    }
    v.material.needsUpdate = true;
    v.requestShadowUpdate?.();
  }

  refresh() {
    if (!this.enabled) return;
    const v = this.view;
    if (this.version === v.town.version && this.sun.equals(v.sunDir)) return;
    const t0 = performance.now();
    const f = bakeVoxelPenumbra(v.town, v.index, v.sunDir.toArray(), { L: v.levelHeight, res: .25 });
    this.version = v.town.version; this.sun.copy(v.sunDir);
    if (!f) { this.uniforms.uPenOn.value = 0; return; }
    const p = packPenumbraReceivers(f);
    this.texture?.dispose();
    this.texture = new THREE.DataTexture(p.data, p.width, p.height, THREE.RGBAFormat);
    this.texture.magFilter = this.texture.minFilter = THREE.LinearFilter; this.texture.needsUpdate = true;
    const u = this.uniforms;
    u.uPenTex.value = this.texture;
    u.uPenGrid.value.set(f.minX, f.minZ, f.res, f.L);
    u.uPenDims.value.set(f.nx, f.nz, f.ny);
    u.uPenOn.value = 1;
    this.field = f;
    this.stats = { ...f.stats, ms: +(performance.now() - t0).toFixed(1), texture: [p.width, p.height] };
  }
}
