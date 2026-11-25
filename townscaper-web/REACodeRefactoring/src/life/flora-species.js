/**
 * flora-species.js — 第 55 批（G2）：植被的两处缺口，在共享 World / 地形形变上落地。
 *
 * 1) REACode levelflora.js / 959530111187013632 "multiple grass types per level"：
 *    core/level-flora.js 早已按台地层级给每格挑物种（每级两种），但几何全是同一种叶丛。
 *    这里给 LEVEL_SPECIES 的六种 shape 各建一套几何：
 *      dots 白花碎点 · tuft 矮圆丛 · blade 高草（交叉细叶）· fan 蕨（扇形五叶）· puff 圆叶灌木 · conifer 松（两节锥）
 *    原片里一级是白花草甸、上去是深色灌丛——形状本身就是层级图例。原版美术素材没有，几何是程序化替代。
 *    r74：落丛改按裁判 buildFlora 参数（levelFloraCluster：presence 密度闸、丛内 4–9、
 *    半径 .20–.46 格、个体缩放 .55–1.25），加表面型密度调制（岸/崖边/内部，本地近似）
 *    与雨生态色组（ecology:'rain'，帧 109+ 紫/灰白近似）；物种材质绑共享 leaf atlas
 *    （Vegetation.leafSurface = sharedLeafTexture 单例，同纹理对象同开关）。
 *
 * 2) REACode dual.js / 959752525867036672 "a dual to the triangular grid and a suitable place to start
 *    with foliage placement"：core/vertex-dual.js 的 dualFoliageSites（每个顶点格一处、跨崖只保留最高台地楔、
 *    排除房子/河道）现在真的被植被用上：dual 模式下地被丛落在对偶落点上，不再是每格随机点。
 *    崖壁竖面：对每条下落边的两个端点，在每一层墙的半高处取一个"竖直对偶格"（墙面网格的顶点列 × 层），
 *    朝外长出一小丛（挂在崖壁上），dualWallSites() 给出这些落点。
 *
 * 坐标都走 shape.at(vertex, level)（与地形网格同一套笼形变形），所以丛不会悬空/埋进崖里。
 */
import * as THREE from 'three';
import { LEVEL_SPECIES, levelFloraSpecies, levelFloraRanks, levelFloraCluster, FLORA_ECOLOGIES } from '../core/level-flora.js';
import { dualFoliageSites } from '../core/vertex-dual.js';
import { LEAF_SURFACE_GLSL } from './leaf-surface.js';

export const SPECIES_SHAPES = Object.freeze(['dots', 'tuft', 'blade', 'fan', 'puff', 'conifer']);
/** 每种形状一格放几丛、基础尺寸（世界单位）。 */
export const SHAPE_PLAN = Object.freeze({ dots: [6, 1], tuft: [4, 1.5], blade: [5, 1.6], fan: [3, 1.6], puff: [2, 1.6], conifer: [1, 1.7] });

function merge(parts) {
  const geos = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  const n = geos.reduce((s, g) => s + g.getAttribute('position').count, 0);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), shade = new Float32Array(n);
  let o = 0;
  for (const g of geos) {
    g.computeVertexNormals();
    const p = g.getAttribute('position'), q = g.getAttribute('normal');
    for (let i = 0; i < p.count; i++, o++) {
      pos.set([p.getX(i), p.getY(i), p.getZ(i)], o * 3); nor.set([q.getX(i), q.getY(i), q.getZ(i)], o * 3);
      shade[o] = .72 + .28 * Math.min(1, p.getY(i) / .12);   // 底暗顶亮
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('aShade', new THREE.BufferAttribute(shade, 1));
  return out;
}
const tri = (a, b, c) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3)); return g; };

/** 六种物种几何（单位：一丛，底面在 y=0）。导出给测试量包围盒。 */
export function speciesGeometry(shape) {
  switch (shape) {
    case 'dots': {   // 白花：几颗小球散在一小片上，高低不一
      const parts = [];
      for (let k = 0; k < 7; k++) { const a = k * 2.4, r = .012 + (k % 3) * .012; const s = new THREE.IcosahedronGeometry(.011, 0); s.translate(Math.cos(a) * r, .012 + (k % 2) * .01, Math.sin(a) * r); parts.push(s); }
      return merge(parts);
    }
    case 'tuft': { const s = new THREE.IcosahedronGeometry(.035, 1); s.scale(1, .6, 1); s.translate(0, .018, 0); return merge([s]); }
    case 'blade': {   // 高草：五片细长三角，略外倾
      const parts = [];
      for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), w = .008;
        parts.push(tri([-s * w, 0, c * w], [s * w, 0, -c * w], [c * .022, .085 + (k % 2) * .02, s * .022])); }
      return merge(parts);
    }
    case 'fan': {   // 蕨：五片宽叶从中心扇出、向外下垂
      const parts = [];
      for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + .3, c = Math.cos(a), s = Math.sin(a);
        parts.push(tri([0, .012, 0], [c * .05 - s * .016, .045, s * .05 + c * .016], [c * .075, .028, s * .075]));
        parts.push(tri([0, .012, 0], [c * .075, .028, s * .075], [c * .05 + s * .016, .045, s * .05 - c * .016])); }
      return merge(parts);
    }
    case 'puff': {   // 圆叶灌木：三球一团
      const parts = [[0, .04, 0, .045], [.03, .03, .012, .032], [-.026, .028, -.014, .03]].map(([x, y, z, r]) => { const s = new THREE.IcosahedronGeometry(r, 1); s.translate(x, y, z); return s; });
      return merge(parts);
    }
    case 'conifer': {   // 松：两节锥 + 短干
      const a = new THREE.ConeGeometry(.045, .07, 7); a.translate(0, .06, 0);
      const b = new THREE.ConeGeometry(.033, .06, 7); b.translate(0, .1, 0);
      const t = new THREE.CylinderGeometry(.006, .008, .03, 5); t.translate(0, .015, 0);
      return merge([a, b, t]);
    }
    default: throw new RangeError('unknown species shape ' + shape);
  }
}

/**
 * 物种材质：Lambert + aShade 底暗顶亮 + uLight。
 * 传共享 leaf surface（Vegetation.leafSurface，sharedLeafTexture 单例）时绑同一批
 * uniform 对象：uLeafAtlas/uLeafAtlasOn 与灌木/树冠读同一张纹理、同一个开关；
 * 角落叶纹的球面映射按各物种几何的包围球中心算（uLeafCenter）。不传则无图集支路。
 */
function speciesMaterial(uLight, surface = null, center = new THREE.Vector3()) {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  m.alphaToCoverage = !!surface;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uLight = uLight;
    if (surface) { sh.uniforms.uLeafAtlas = surface.uniform; sh.uniforms.uLeafAtlasOn = surface.on; sh.uniforms.uLeafCenter = { value: center }; }
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aShade;\nvarying float vShade;' + (surface ? '\nuniform vec3 uLeafCenter;\nvarying vec3 vLeafSphere;' : ''))
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvShade = aShade;' + (surface ? '\nvLeafSphere = position - uLeafCenter;' : ''));
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vShade;\nuniform float uLight;' + (surface ? LEAF_SURFACE_GLSL : ''))
      .replace('#include <opaque_fragment>', 'outgoingLight *= vShade * uLight;\n#include <opaque_fragment>');
    if (surface) sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
      float rimF = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
      float leafA = leafCoverage(1.0 - rimF, leafPattern(vLeafSphere));
      if (leafA <= .001) discard;
      gl_FragColor.a *= leafA;`);
  };
  m.customProgramCacheKey = () => 'flora-species-' + !!surface;
  return m;
}

const hash = (i, s = 0) => { let h = Math.imul(i + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(s + 0x165667b1, 0xc2b2ae35); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; return (h >>> 0) / 4294967296; };

/** 崖壁竖面的对偶落点：下落边端点（顶点列）× 每层墙半高。去重；带外法线。纯函数。 */
export function dualWallSites(world, { levelHeight = .5, at = (v) => [v.x, v.z], density = 1 } = {}) {
  const seen = new Set(), out = [];
  for (const c of world.cells) {
    const g = world.ground(c);
    if (!g || world.topIsBuilt(c)) continue;
    for (let i = 0; i < c.n; i++) {
      const o = world.neighbor(c, i), og = o ? world.top(o) : 0;
      if (og >= g || (o && world.topIsBuilt(o))) continue;
      const a = c.pts[i], b = c.pts[(i + 1) % c.n];
      let nx = b.z - a.z, nz = -(b.x - a.x);
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      if (nx * (mx - c.cx) + nz * (mz - c.cz) < 0) { nx = -nx; nz = -nz; }
      const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
      for (const v of [a, b]) for (let k = og; k < g; k++) {
        const key = v.id + ':' + k;
        if (seen.has(key) || hash(v.id * 31 + k, 5) > .45 * density) continue;
        seen.add(key);
        const p0 = at(v, k), p1 = at(v, k + 1), y = (k + .5) * levelHeight;
        out.push({ vertex: v.id, level: k, x: (p0[0] + p1[0]) / 2, y, z: (p0[1] + p1[1]) / 2, nx, nz, cell: c.id });
      }
    }
  }
  return out;
}

export class FloraSpecies {
  constructor(view) {
    this.view = view;
    this.veg = view.vegetation;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.veg.group.add(this.group);
    this.levelFlora = false;   // 物种几何
    this.dual = false;         // 对偶落点 + 崖壁竖面
    this.ecology = 'meadow';   // 'rain' = 帧 109+ 紫/灰白生态色组近似（同物种键/形状）
    const max = 6000, uLight = this.veg.uLight, leafSurface = this.veg.leafSurface ?? null;
    this.meshes = Object.fromEntries(SPECIES_SHAPES.map((s) => {
      const g = speciesGeometry(s);
      g.computeBoundingBox();
      const m = new THREE.InstancedMesh(g, speciesMaterial(uLight, leafSurface, g.boundingBox.getCenter(new THREE.Vector3())), max);
      m.count = 0; m.frustumCulled = false; m.receiveShadow = false;
      m.setColorAt(0, new THREE.Color(1, 1, 1));
      this.group.add(m);
      return [s, m];
    }));
    this.stats = {};
  }

  setModes({ levelFlora = this.levelFlora, dual = this.dual, ecology = this.ecology } = {}) {
    if (!FLORA_ECOLOGIES.includes(ecology)) throw new RangeError('unknown flora ecology ' + ecology);
    const changedLevel = levelFlora !== this.levelFlora;
    this.levelFlora = !!levelFlora; this.dual = !!dual; this.ecology = ecology;
    const on = this.levelFlora || this.dual;
    this.group.visible = on;
    this.veg.tufts.visible = !on && (this.veg.layers?.grass ?? true);   // 物种 / 对偶丛替换通用地被丛
    if (changedLevel) this.veg.levelFlora = this.levelFlora;           // Vegetation 的物种调色也跟着切
    if (this.levelFlora) this.veg.floraEcology = this.ecology;         // 生态色组同步（草甸/雨景近似）
    return on;
  }

  /** 在 Vegetation.refresh 之后调用（同一 World / shape）。 */
  rebuild(world, shape) {
    if (!this.levelFlora && !this.dual) return this.stats;
    const t0 = performance.now(), L = this.veg.L;
    const at = shape ? (p, s) => shape.at(p, s) : (p) => [p.x, p.z];
    const counts = Object.fromEntries(SPECIES_SHAPES.map((s) => [s, 0]));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
    const kindOk = (c) => { const g = world.ground(c); return g > 1 && world.top(c) === g && !world.river[c.id]; };
    const ranks = levelFloraRanks(world.cells.map((c) => (kindOk(c) ? world.ground(c) : 0)));
    const speciesOf = (c) => this.levelFlora ? levelFloraSpecies(ranks.get(world.ground(c)) ?? 0, c.id, { ecology: this.ecology }) : { key: 'grass', shape: 'tuft', colors: ['#8fa85a', '#9fb465', '#7e9c50'] };
    // 表面型：顶层台地内部 / 崖顶边（邻居更低）/ 临水（最低草层，邻居是水或界外）
    const surfaceOf = (c) => {
      const g = world.ground(c); let lo = Infinity;
      for (let i = 0; i < c.n; i++) { const o = world.neighbor(c, i); lo = Math.min(lo, o ? world.top(o) : 0); }
      return g <= 2 && lo <= 1 ? 'shore' : lo < g ? 'edge' : 'interior';
    };
    let seed = 1;
    const put = (shape, x, y, z, colors, scale, tilt = null, jitter = true) => {
      const mesh = this.meshes[shape];
      if (counts[shape] >= mesh.instanceMatrix.count) return;
      const r = hash(seed++, 3);
      if (tilt) { e.set(tilt.ax, r * Math.PI * 2, tilt.az, 'YXZ'); q.setFromEuler(e); } else q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r * Math.PI * 2);
      m.compose(v.set(x, y, z), q, sc.setScalar(scale * (jitter ? .8 + .4 * hash(seed, 9) : 1)));
      mesh.setMatrixAt(counts[shape], m);
      mesh.setColorAt(counts[shape], col.set(colors[(hash(seed, 11) * colors.length) | 0]));
      counts[shape]++;
    };
    const rows = [];
    let sites = 0, wall = 0;
    if (this.dual) {
      // 对偶落点：每个顶点格一丛（跨崖只在最高台地），物种按落点所在格
      const ds = dualFoliageSites(world, { levelHeight: L, spacing: 0 });
      for (const s of ds.sites) {
        const c = world.cells[s.cells[0]];
        if (!kindOk(c)) continue;
        const sp = speciesOf(c), [n, size] = SHAPE_PLAN[sp.shape];
        const vtx = world.grid.verts[s.vertex], d = at(vtx, s.level), ox = d[0] - vtx.x, oz = d[1] - vtx.z;
        const k = Math.max(1, Math.ceil(n / 2));
        for (let j = 0; j < k; j++) { const a = hash(s.vertex * 7 + j, 6) * 6.283, r = j ? .05 + .05 * hash(s.vertex + j, 8) : 0; put(sp.shape, s.x + ox + Math.cos(a) * r, s.y, s.z + oz + Math.sin(a) * r, sp.colors, size); }
        rows.push({ cell: c.id, level: s.level, key: sp.key, shape: sp.shape }); sites++;
      }
      // 崖壁竖面：朝外倾 70° 的小丛，挂在墙半高
      for (const w of dualWallSites(world, { levelHeight: L, at })) {
        const c = world.cells[w.cell], sp = speciesOf(c), shape = sp.shape === 'conifer' || sp.shape === 'dots' ? 'tuft' : sp.shape;
        const tiltAngle = 1.2;
        // 把丛的 +Y 转到"外法线 + 少许向上"的方向
        q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(w.nx * Math.sin(tiltAngle), Math.cos(tiltAngle), w.nz * Math.sin(tiltAngle)));
        const mesh = this.meshes[shape];
        if (counts[shape] < mesh.instanceMatrix.count) {
          m.compose(v.set(w.x + w.nx * .012, w.y, w.z + w.nz * .012), q, sc.setScalar(SHAPE_PLAN[shape][1] * .9));
          mesh.setMatrixAt(counts[shape], m); mesh.setColorAt(counts[shape], col.set(sp.colors[w.vertex % sp.colors.length])); counts[shape]++;
        }
        wall++;
      }
    } else {
      // 物种几何：每格一丛同物种（裁判 buildFlora 口径：presence 密度闸、丛内 4–9 个、
      // 丛半径 .20–.46 格、个体缩放 .55–1.25；items 的 dx/dz 以格半宽为单位）。
      // 表面型调制（岸/崖边/内部密度系数）是本地近似，裁判只有层绑 species set。
      let absent = 0;
      for (const c of world.cells) {
        if (!kindOk(c)) continue;
        const g = world.ground(c), surface = surfaceOf(c);
        const cl = levelFloraCluster(ranks.get(g) ?? 0, c.id, { seed: 11, mode: 'perLevel', ecology: this.ecology, surface });
        if (!cl.present) { absent++; continue; }
        const pts = c.pts.map((p) => at(p, g));
        const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cz = pts.reduce((a, p) => a + p[1], 0) / pts.length;
        const cellR = pts.reduce((a, p) => a + Math.hypot(p[0] - cx, p[1] - cz), 0) / pts.length;   // ≈ 格半宽
        const size = SHAPE_PLAN[cl.shape][1];
        for (const it of cl.items) put(cl.shape, cx + it.dx * 2 * cellR, g * L, cz + it.dz * 2 * cellR, cl.colors, it.scale * size, null, false);   // 裁判缩放 .55–1.25 已含抖动，不再二次乘
        rows.push({ cell: c.id, level: g, key: cl.key, shape: cl.shape, surface, items: cl.count });
      }
      this.absentCells = absent;
    }
    for (const s of SPECIES_SHAPES) { const mesh = this.meshes[s]; mesh.count = counts[s]; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
    this.rows = rows;
    this.stats = { counts, dualSites: sites, wallSites: wall, cells: rows.length, absentCells: this.dual ? null : (this.absentCells ?? 0), ecology: this.ecology, ms: +(performance.now() - t0).toFixed(1) };
    return this.stats;
  }
}

export { LEVEL_SPECIES };
