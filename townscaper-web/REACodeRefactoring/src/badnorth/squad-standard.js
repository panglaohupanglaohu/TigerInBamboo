/**
 * 第 55 批 G3 · REACode/src/squadbanner.js 缺口：金饰盾纹、竖旗横杆、Battle 里实际替换。
 * 827216768783495168（"And another one"，六帧判读）：三队各举一面**竖挂**浅蓝底大旗，旗面挂在杆顶**横杆**下，
 * 杆顶露一颗金属球；白徽记 骷髅 / 剑 / 三叉戟 一队一个；前排盾面刻同一个小徽记，单位头盔 / 盾 / 旗底同一族蓝。
 * 这里全部程序化（原作美术素材没有）：
 *   · 旗面 = 军色派生的旗底 + 金边 + 燕尾下摆 + 图集那一格徽记**逐像素拷进来**（旗面墨量 = 图集格墨量）；
 *   · 盾面 = 盾色圆盘 + 金饰外圈 + 金色盾钉 + 同一格徽记（图集同源）；
 *   · 旗面公告板偏航夹在 ±40°（bannerBillboardYaw）。
 * 纯数据（RGBA）部分不依赖 three，node 可测；THREE 部分在 buildStandardMesh / ShieldFaces。
 */
import * as THREE from 'three';
import { bakeEmblemAtlas, squadRolePalette, SQUAD_EMBLEMS, bannerBillboardYaw } from '../core/banner.js';

export const ARMY_HUE = 205;                 // 片子里三队同一族浅蓝
export const GOLD = [217, 168, 58];
export const STANDARD = Object.freeze({ poleH: .64, barY: .575, barW: .17, bannerW: .135, bannerH: .23, finialR: .016 });
const EMBLEM_CELL = 32;

let atlasCache = null;
export function emblemAtlas() { return (atlasCache ??= bakeEmblemAtlas({ cell: EMBLEM_CELL, emblems: SQUAD_EMBLEMS })); }

const INK_EDGE = [30, 58, 88, 255];
/** 徽记描边（原版 drawEmblem 的深蓝描边）：白色徽记外一圈非白、非透明像素改成深蓝。不改白色墨量。 */
function outline(rgba, w, h) {
  const white = (x, y) => x >= 0 && y >= 0 && x < w && y < h && rgba[(y * w + x) * 4] === 255 && rgba[(y * w + x) * 4 + 1] === 255 && rgba[(y * w + x) * 4 + 2] === 255;
  const mark = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (!rgba[i + 3] || white(x, y)) continue; if (white(x + 1, y) || white(x - 1, y) || white(x, y + 1) || white(x, y - 1)) mark.push(i); }
  for (const i of mark) rgba.set(INK_EDGE, i);
}
/** 竖旗旗面：w×h，v 向下（第 0 行 = 横杆处）。下摆燕尾，金边 2px，徽记居中偏上。 */
export function bakeStandardImage(style, { hue = ARMY_HUE, width = 48, height = 88, tail = .16 } = {}) {
  const A = emblemAtlas(), k = ((style % 3) + 3) % 3, pal = squadRolePalette(hue), rgba = new Uint8Array(width * height * 4);
  const tailH = Math.round(height * tail), inside = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    const fromBottom = height - 1 - y; if (fromBottom >= tailH) return true;
    // 燕尾：中间缺口随离底越近越宽
    const notchHalf = (1 - fromBottom / tailH) * width * .25; return Math.abs(x + .5 - width / 2) >= notchHalf;
  };
  let opaque = 0, gold = 0, ink = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!inside(x, y)) continue;
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]].some(([dx, dy]) => !inside(x + dx, y + dy)) || y < 2;
    rgba.set(edge ? [...GOLD, 255] : [...pal.field, 255], (y * width + x) * 4); opaque++; if (edge) gold++;
  }
  // 徽记：图集第 k 格逐像素拷贝（v 翻转：图集 y=0 是 v 底边）
  const ox = Math.round((width - EMBLEM_CELL) / 2), oy = Math.round(height * .2);
  for (let y = 0; y < EMBLEM_CELL; y++) for (let x = 0; x < EMBLEM_CELL; x++) {
    const src = ((EMBLEM_CELL - 1 - y) * A.width + k * EMBLEM_CELL + x) * 4; if (!A.rgba[src + 3]) continue;
    const dst = ((oy + y) * width + ox + x) * 4; rgba.set([255, 255, 255, 255], dst); ink++;
  }
  outline(rgba, width, height);
  return { width, height, rgba, opaque, gold, ink, atlasInk: Math.round(A.ink[k] * EMBLEM_CELL * EMBLEM_CELL), emblem: A.emblems[k], field: pal.field };
}

/** 盾面：size² 圆盘，金饰外圈 + 中心金盾钉 + 同格徽记（缩到盘内）。 */
export function bakeShieldImage(style, { hue = ARMY_HUE, size = 44 } = {}) {
  const A = emblemAtlas(), k = ((style % 3) + 3) % 3, pal = squadRolePalette(hue), rgba = new Uint8Array(size * size * 4);
  let rim = 0, ink = 0, disc = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot(x + .5 - size / 2, y + .5 - size / 2) / (size / 2); if (r > 1) continue;
    const isRim = r > .8 || (r > .66 && r < .7);                       // 金边 + 内圈细金线
    rgba.set(isRim ? [...GOLD, 255] : [...pal.shield, 255], (y * size + x) * 4); disc++; if (isRim) rim++;
  }
  const s = .9, n = Math.round(EMBLEM_CELL * s), o = Math.round((size - n) / 2);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const sx = Math.min(EMBLEM_CELL - 1, Math.floor((x + .5) / s)), sy = Math.min(EMBLEM_CELL - 1, Math.floor((y + .5) / s));
    const src = ((EMBLEM_CELL - 1 - sy) * A.width + k * EMBLEM_CELL + sx) * 4; if (!A.rgba[src + 3]) continue;
    rgba.set([255, 255, 255, 255], ((o + y) * size + o + x) * 4); ink++;
  }
  outline(rgba, size, size);
  return { size, rgba, rim, ink, disc, rimShare: rim / disc, emblem: A.emblems[k], shield: pal.shield };
}

const tex = (img, w, h) => { const t = new THREE.DataTexture(img.rgba, w, h, THREE.RGBAFormat); t.flipY = false; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearFilter; t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; };

/** 竖旗：杆 + 横杆 + 金属球 + 挂在横杆下的旗面（公告板，偏航夹 ±40°）。 */
export function buildStandardMesh(style, opts = {}) {
  const S = STANDARD, img = bakeStandardImage(style, opts), g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#6e5443', roughness: .9 }), metal = new THREE.MeshStandardMaterial({ color: '#e0b84e', roughness: .35, metalness: .6 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.007, .008, S.poleH, 6), wood); pole.position.y = S.poleH / 2;
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(.005, .005, S.barW, 5), wood); bar.rotation.z = Math.PI / 2; bar.position.y = S.barY;
  const finial = new THREE.Mesh(new THREE.SphereGeometry(S.finialR, 10, 8), metal); finial.position.y = S.poleH + S.finialR * .6;
  const pivot = new THREE.Group(); pivot.position.y = S.barY;                // 公告板绕杆转：横杆 + 旗面一起转
  pivot.add(bar); bar.position.y = 0;
  const geo = new THREE.PlaneGeometry(S.bannerW, S.bannerH, 1, 4); geo.translate(0, -S.bannerH / 2 - .006, 0);
  // DataTexture 第 0 行在 v=0：旗面顶边（横杆处）是图像第 0 行 → 翻 v
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  const cloth = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex(img, img.width, img.height), alphaTest: .5, side: THREE.DoubleSide }));
  pivot.add(cloth); g.add(pole, finial, pivot);
  g.userData = { pivot, cloth, img, style, swayPhase: style * 1.7 };
  return g;
}

/** 每帧：旗面朝相机，偏航相对小队朝向夹在 ±40°；一点点摆动（风）。返回 {yaw, clamped, widthRatio}。 */
export function orientStandard(g, camera, { baseYaw = 0, t = 0, wind = 1 } = {}) {
  const { pivot, cloth } = g.userData; const p = new THREE.Vector3(); g.getWorldPosition(p);
  const camYaw = camera ? Math.atan2(camera.position.x - p.x, camera.position.z - p.z) : baseYaw;
  let rel = (camYaw - baseYaw) * 180 / Math.PI; rel = ((rel + 540) % 360) - 180;
  const b = bannerBillboardYaw(rel, 40); pivot.rotation.y = baseYaw + b.yaw * Math.PI / 180;
  cloth.rotation.x = Math.sin(t * 2.3 + g.userData.swayPhase) * .08 * wind;   // 下摆前后摆
  return b;
}

/** 盾面金饰徽记：每个徽记一张 InstancedMesh（贴在盾面前 0.6 mm）。 */
export class ShieldFaces {
  constructor(limit = 260, opts = {}) {
    this.group = new THREE.Group(); this.meshes = [0, 1, 2].map((k) => {
      const img = bakeShieldImage(k, opts), geo = new THREE.CircleGeometry(.04, 16);
      const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ map: tex(img, img.size, img.size), roughness: .6, metalness: .15 }), limit);
      m.count = 0; m.frustumCulled = false; m.userData.img = img; this.group.add(m); return m;
    });
    this.offset = new THREE.Matrix4().makeTranslation(0, .07, .0556); this.count = 0;
  }
  /** units → 每人一张盾面（按 squad.id % 3 选徽记）。bodyMatrix(u) 必须与 Battle #draw 的身体矩阵一致。 */
  update(units, bodyMatrix) {
    const n = [0, 0, 0], m = new THREE.Matrix4();
    for (const u of units) { const k = u.squad.id % 3, mesh = this.meshes[k]; if (n[k] >= mesh.instanceMatrix.count) continue; m.multiplyMatrices(bodyMatrix(u), this.offset); mesh.setMatrixAt(n[k]++, m); }
    this.meshes.forEach((mesh, k) => { mesh.count = n[k]; mesh.instanceMatrix.needsUpdate = true; });
    this.count = n[0] + n[1] + n[2]; return this.count;
  }
  clear() { for (const m of this.meshes) m.count = 0; this.count = 0; }
}
