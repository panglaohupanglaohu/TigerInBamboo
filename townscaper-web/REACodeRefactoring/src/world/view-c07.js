/**
 * view-c07.js — 第 56 批 C07（Townscaper 生命 / 光照 / 贴图 / 水）接进 View 的开关。全部默认关。
 * View 构造末尾一行：URL 带 `?c07=a,b` 才动态加载本文件并 installC07(view)；之后 `view.c07.set(name, on)`。
 *
 *   townskin   1430227487376781317 全城共用一张 128² TownColor 总贴图，运行时热替换（scribble / paint / loadImage / 拖 PNG 进窗口）
 *              + 1241096929490149376 每隔一像素一条线（放大）/ 色格内 mip（缩小）+ 1241046107125399552 植物读同图 32² 角
 *              （world/town-skin-layer.js · core/town-skin.js）
 *   decalboil  1427721874490933250 每帧往地形图集累加方块贴花 → line boil；图集 chart 带 padding（core/decal-accum.js）
 *   splash     1258421104756097029 冠状水帘 + 3 圈长寿命不规则泡沫环 + 10–12 颗竖直飞沫（life/splash-c07.js）
 *   gardenplots 1178731576982724611 草地块石沿 + 1290997501332525056 门优先细石板小径 / 中心圆台（build/garden-plots-c07.js，world.gardenPlots）
 *   aolayers   1298689301488775169 第四视图「AO baking mesh」的半透明层叠画法：白模（只看光照）+ 三层外扩的半透明烘焙壳
 *   aotex      1168571866405097472「occlusion lives in a layered mesh that's reprojected to a texture at each change. That texture is
 *              then blurred, and sampled in the vertex shader」：左侧面板逐层画出同一份 light/bake.js 分层栅格（上 = 投影后的 0/1 占用，
 *              下 = 两遍盒式模糊后的遮蔽），World 一变就重画；主网格切白模看 AO（r55 ?shade=voxelfield 是顶点着色器采样那一半）
 *   sungizmo   1313840428685447170「sunlight (with shadows) and a gizmo to control it」：屏上二维太阳盘（方位 = 角度，高度 = 半径）
 *              + 高度滑条；太阳压到地平线附近自动切夜（窗户亮），抬回来恢复白天
 */
import * as THREE from 'three';
import { TownSkinLayer } from './town-skin-layer.js';
import { DecalAtlas, BOIL_CHARTS, DECAL_FRAG_PARS } from '../core/decal-accum.js';
import { CrownSplash } from '../life/splash-c07.js';
import { buildBakeShellGeometry } from './ao-mesh-debug.js';
import { bakeLighting } from '../light/bake.js';

export const C07_KEYS = Object.freeze(['townskin', 'decalboil', 'splash', 'gardenplots', 'aolayers', 'aotex', 'sungizmo']);
export function parseC07(search) {
  const p = new URLSearchParams(search || '');
  return new Set((p.get('c07') || '').split(',').map((s) => s.trim()).filter((s) => C07_KEYS.includes(s)));
}

/* ---------------- 贴花累加（line boil） ---------------- */
class DecalBoil {
  constructor(view, { perFrame = 10, pad = 2 } = {}) {
    this.view = view; this.perFrame = perFrame;
    this.atlas = new DecalAtlas({ charts: BOIL_CHARTS, size: 64, pad, seed: 1427 });
    this.tex = new THREE.DataTexture(this.atlas.data, this.atlas.width, this.atlas.height, THREE.RGBAFormat);
    this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.magFilter = this.tex.minFilter = THREE.LinearFilter; this.tex.generateMipmaps = false; this.tex.needsUpdate = true;
    this.u = { uC07Decal: { value: 0 }, uC07DecalTex: { value: this.tex }, uC07DecalGeo: { value: new THREE.Vector4(this.atlas.stride, this.atlas.pad, this.atlas.size, this.atlas.width) }, uC07DecalScale: { value: 0.55 } };
    const m = view.material, prev = m.onBeforeCompile;
    m.onBeforeCompile = (shader, r) => {
      prev?.call(m, shader, r); Object.assign(shader.uniforms, this.u);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + DECAL_FRAG_PARS).replace('#include <color_fragment>', '#include <color_fragment>\n' + DECAL_BODY);
    };
    const pk = m.customProgramCacheKey; m.customProgramCacheKey = () => (pk ? pk.call(m) : '') + '+decal-c07'; m.needsUpdate = true;
    this.frames = 0; this.changed = [];
  }
  set(on) { this.u.uC07Decal.value = on ? 1 : 0; if (on) { this.atlas.clear(); this.tex.needsUpdate = true; } }
  /** 每渲染一帧盖一批（不看 dt：片子就是"每帧"） */
  step() { const c = this.atlas.stamp(this.perFrame); this.tex.needsUpdate = true; this.frames++; this.changed.push(c); if (this.changed.length > 120) this.changed.shift(); return c; }
}
// 地形顶面（vField.z∈(.5,1.5) 且朝上）→ 草 chart；岩壁（vField.z<-.5）→ 岩 chart（按屏幕导数求世界法线做三平面投影）
const DECAL_BODY = /* glsl */ `
vec3 c07wn = normalize(cross(dFdx(vWPos), dFdy(vWPos)));   // 导数放在分支外
if (uC07Decal > 0.5 && abs(vField.z) > 0.5) {
  float lum = dot(diffuseColor.rgb, vec3(.3, .59, .11));
  vec3 wn = c07wn;
  vec2 pp = abs(wn.y) > 0.7 ? vWPos.xz : (abs(wn.x) > abs(wn.z) ? vWPos.zy : vWPos.xy);
  float rock = (vField.z < -0.5 || abs(wn.y) < 0.7) ? 1.0 : 0.0;
  vec3 dc = c07Decal(rock, pp * uC07DecalScale);
  diffuseColor.rgb = dc * clamp(lum / (rock > 0.5 ? 0.16 : 0.2), 0.55, 1.3);
}
`;

/* ---------------- 半透明 AO 烘焙壳 ---------------- */
class AOLayers {
  constructor(view) { this.view = view; this.group = new THREE.Group(); this.group.renderOrder = 8; view.scene.add(this.group); this.version = -1; this.stats = {}; }
  refresh() {
    const v = this.view, w = v.town; if (this.version === w.version) return;
    for (const m of this.group.children.slice()) { m.geometry.dispose(); m.material.dispose(); this.group.remove(m); }
    const g = buildBakeShellGeometry(w, { L: v.levelHeight, shape: v.worldMesh.shape });
    const nrm = g.getAttribute('normal').array, pos = g.getAttribute('position').array;
    // 三层：原壳 + 沿法线外扩两次（越外越淡）—— 片子里一团团奶白、边缘发虚的层叠体
    [[0.01, 0.42], [0.07, 0.26], [0.15, 0.15]].forEach(([d, a], k) => {
      const gg = new THREE.BufferGeometry(), p = new Float32Array(pos.length);
      for (let i = 0; i < p.length; i++) p[i] = pos[i] + nrm[i] * d;
      gg.setAttribute('position', new THREE.BufferAttribute(p, 3)); gg.setAttribute('color', g.getAttribute('color'));
      const mat = new THREE.MeshBasicMaterial({ color: 0xffe2c0, vertexColors: true, transparent: true, opacity: a, depthWrite: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(gg, mat); mesh.renderOrder = 8 + k; this.group.add(mesh);
    });
    let building = 0; for (const c of w.cells) for (let lv = 2; lv <= w.top(c); lv++) if (w.isSolid(c, lv) && !w.isRock(c, lv)) building++;
    this.stats = { faces: g.userData.voxels, layers: 3, buildingVoxels: building };
    g.dispose(); this.version = w.version;
  }
  set(on) { this.group.visible = on; this.view.setDebug('lightonly', on); if (on) { this.version = -1; this.refresh(); } }
}

/* ---------------- 分层 AO 纹理面板 ---------------- */
export function aoLayerField(world, L) {
  const probe = { pos: [0, 0, 0, 0, 0, 0.01, 0.01, 0, 0], col: new Array(9).fill(1) };
  const r = bakeLighting(probe, world, { L, colorOf: () => ({ r: 1, g: 1, b: 1 }), keepField: true });
  return r.field ?? null;
}
class AOTexPanel {
  constructor(view) {
    this.view = view; this.version = -1; this.stats = {};
    this.cv = document.createElement('canvas'); this.cv.width = 360; this.cv.height = 560;
    this.cv.style.cssText = 'position:fixed;left:104px;top:86px;z-index:30;width:180px;height:280px;background:#fff;border:2px solid #24406e;display:none;image-rendering:pixelated';
    document.body.appendChild(this.cv);
  }
  refresh() {
    const v = this.view, w = v.town; if (this.version === w.version) return;
    const f = aoLayerField(w, v.levelHeight); this.version = w.version; if (!f) return;
    const ctx = this.cv.getContext('2d'), show = Math.min(3, f.layers - 2), cw = 180, ch = Math.floor(560 / show), size = f.W * f.H;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 360, 560);
    for (let k = 0; k < show; k++) {
      const lv = k + 1, sc = Math.min(cw / f.W, ch / f.H);
      for (const [col, arr] of [[0, f.bits], [1, f.occ]]) {
        const img = ctx.createImageData(f.W, f.H);
        for (let j = 0; j < f.H; j++) for (let i = 0; i < f.W; i++) { const val = 255 - Math.round(255 * Math.min(1, arr[lv * size + j * f.W + i])); const o = (j * f.W + i) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = val; img.data[o + 3] = 255; }
        const tmp = document.createElement('canvas'); tmp.width = f.W; tmp.height = f.H; tmp.getContext('2d').putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = false; ctx.drawImage(tmp, col * cw, k * ch, f.W * sc, f.H * sc);
      }
      ctx.strokeStyle = '#24406e'; ctx.strokeRect(0, k * ch, 360, ch);
    }
    let raw = 0, blurred = 0; for (let i = size; i < size * f.layers; i++) { raw += f.bits[i]; if (f.occ[i] > 0.02 && !f.bits[i]) blurred++; }
    this.stats = { W: f.W, H: f.H, layers: f.layers, res: +f.res.toFixed(3), rawTexels: raw, haloTexels: blurred };
  }
  set(on) { this.cv.style.display = on ? 'block' : 'none'; this.view.setDebug('lightonly', on); if (on) { this.version = -1; this.refresh(); } }
}

/* ---------------- 二维太阳盘 ---------------- */
class SunGizmo {
  constructor(view) {
    this.view = view; this.az = 210; this.el = 38; this.mode = 'day';
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:30;background:rgba(240,248,246,.92);border-radius:12px;padding:8px;box-shadow:0 2px 10px rgba(0,0,0,.18);font:12px sans-serif;color:#234;display:none;width:132px;text-align:center';
    host.innerHTML = '<div style="margin-bottom:4px">太阳</div>';
    const cv = document.createElement('canvas'); cv.width = cv.height = 116; cv.style.cssText = 'width:116px;height:116px;cursor:crosshair;touch-action:none'; host.appendChild(cv);
    const sl = document.createElement('input'); sl.type = 'range'; sl.min = '1'; sl.max = '85'; sl.value = String(this.el); sl.style.width = '116px'; host.appendChild(sl);
    document.body.appendChild(host); Object.assign(this, { host, cv, sl });
    const pick = (e) => { const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 2 - 1, y = (e.clientY - r.top) / r.height * 2 - 1, d = Math.min(1, Math.hypot(x, y)); this.setSun(Math.atan2(x, -y) * 180 / Math.PI, Math.max(1, (1 - d) * 85)); };
    let drag = false; cv.addEventListener('pointerdown', (e) => { drag = true; pick(e); }); window.addEventListener('pointermove', (e) => drag && pick(e)); window.addEventListener('pointerup', () => (drag = false));
    sl.addEventListener('input', () => this.setSun(this.az, +sl.value));
  }
  /** 方位（度，0 = 北 / 屏上方）+ 高度（度）；高度 < 8° 自动夜里点窗，回升到 ≥ 8° 回到白天 */
  setSun(az, el) {
    this.az = ((az % 360) + 360) % 360; this.el = Math.max(1, Math.min(85, el)); this.sl.value = String(Math.round(this.el));
    const mode = this.el < 8 ? 'night' : 'day';
    if (mode !== this.mode) { this.view.setTimeOfDay(mode); this.mode = mode; }
    this.view.setSunPosition(this.az, Math.max(3, this.el)); this.view.requestShadowUpdate?.(); this.draw();
    return { az: this.az, el: this.el, mode, sun: this.view.sunDir.toArray().map((x) => +x.toFixed(3)) };
  }
  draw() {
    const c = this.cv.getContext('2d'), R = 54, o = 58; c.clearRect(0, 0, 116, 116);
    c.fillStyle = this.mode === 'night' ? '#2b3a55' : '#bfe3ea'; c.beginPath(); c.arc(o, o, R, 0, 7); c.fill();
    c.strokeStyle = 'rgba(30,60,70,.35)'; for (const r of [R / 3, R * 2 / 3]) { c.beginPath(); c.arc(o, o, r, 0, 7); c.stroke(); }
    const d = (1 - this.el / 85) * R, a = this.az * Math.PI / 180, x = o + Math.sin(a) * d, y = o - Math.cos(a) * d;
    c.beginPath(); c.moveTo(o, o); c.lineTo(x, y); c.stroke();
    c.fillStyle = this.mode === 'night' ? '#e8e4c8' : '#ffd23a'; c.beginPath(); c.arc(x, y, 8, 0, 7); c.fill();
  }
  set(on) { this.host.style.display = on ? 'block' : 'none'; if (on) this.setSun(this.az, this.el); }
}

export function installC07(view, { search = globalThis.location?.search ?? '' } = {}) {
  if (view.c07) return view.c07;
  const state = Object.fromEntries(C07_KEYS.map((k) => [k, false])), stats = {};
  let skin = null, boil = null, crown = null, ao = null, sun = null, aotex = null;
  // 水花：包一层 effects.onEdit —— 触发口径不变；打开时原 1 圈 1.1s 的环 / 外抛飞沫换成冠状水帘
  const fx = view.effects, rawEdit = fx.onEdit.bind(fx);
  fx.onEdit = (cell, before, after, L) => {
    rawEdit(cell, before, after, L);
    if (!state.splash) return;
    if ((after > before && before === 0) || (after < before && after === 0)) {
      for (let i = 0; i < fx.N; i++) if (fx.kind[i] === 0 && fx.life[i] > 0) fx.life[i] = 0;
      crown.spawn(cell);
    }
  };
  const origRender = view.render.bind(view);
  view.render = (dt) => {
    origRender(dt);
    if (state.townskin) { skin.refresh(); stats.townskin = skin.stats; }
    if (state.decalboil) boil.step();
    if (state.splash) crown.update(dt);
    if (state.aolayers) { ao.refresh(); stats.aolayers = ao.stats; }
    if (state.aotex) { aotex.refresh(); stats.aotex = aotex.stats; }
  };
  function set(name, on) {
    if (!C07_KEYS.includes(name)) throw new RangeError('unknown c07 switch ' + name);
    on = !!on; if (state[name] === on) return on; state[name] = on;
    switch (name) {
      case 'townskin': skin ??= new TownSkinLayer(view); skin.set(on); stats.townskin = skin.stats; break;
      case 'decalboil': boil ??= new DecalBoil(view); boil.set(on); break;
      case 'splash': crown ??= new CrownSplash({ scene: view.scene, uTime: view.waterUniforms.uTime }); fx.rings.visible = !on; crown.group.visible = on; break;
      case 'gardenplots': view.town.gardenPlots = on; view.worldMesh.invalidate(); break;
      case 'aolayers': ao ??= new AOLayers(view); ao.set(on); break;
      case 'aotex': aotex ??= new AOTexPanel(view); aotex.set(on); break;
      case 'sungizmo': sun ??= new SunGizmo(view); sun.set(on); break;
    }
    return on;
  }
  view.c07 = { state, stats, set, get skin() { return skin; }, get boil() { return boil; }, get crown() { return crown; }, get ao() { return ao; }, get sun() { return sun; } };
  for (const k of parseC07(search)) set(k, true);
  return view.c07;
}
