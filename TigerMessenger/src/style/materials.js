/**
 * style/materials.js — 风格材质工厂（重构第 2 步的内核）。
 *
 * 场景代码不再直接 new T.XxxMaterial(...)，而是 styleMat('角色', '类型', 参数)：
 *   - 现在：参数原样传给 three 构造，生成的材质与原来逐项相同（外观不变），只多了 userData.styleRole；
 *   - 第 3 步起：风格包按「角色」给出覆盖（颜色、粗糙度、贴图……），applyStylePack 统一改，场景代码不用动。
 * 角色名 = 场景.文件.用途（如 morris.flora.green-stem），由 tools/refactor/codemod-materials.mjs 生成，可手工改成更语义的名字。
 */
import * as T from 'three';

const live = new Set();          // WeakRef<Material>
const base = new WeakMap();      // material → 原始参数（只记可覆盖的简单字段）
const OVERRIDABLE = ['color', 'emissive', 'roughness', 'metalness', 'opacity', 'emissiveIntensity'];
let activePack = null;

export function styleMat(role, type, params = {}) {
  const Ctor = T[type];
  if (typeof Ctor !== 'function' || !/Material$/.test(type)) throw Error('未知材质类型：' + type);
  const m = new Ctor(params);
  m.userData.styleRole = role;
  const b = {};
  for (const k of OVERRIDABLE) if (m[k] !== undefined) b[k] = m[k]?.isColor ? m[k].getHex() : m[k];
  base.set(m, b);
  live.add(new WeakRef(m));
  if (activePack) applyTo(m, activePack);
  return m;
}

function applyTo(m, pack) {
  const role = m.userData.styleRole, b = base.get(m);
  const o = pack ? matchRole(pack, role) : null;
  for (const k of OVERRIDABLE) {
    if (b[k] === undefined) continue;
    let v = o && o[k] !== undefined ? o[k] : b[k];
    // 一个角色有多种颜色（如按参数传色的工厂函数）：用 colorMap 逐色替换
    if (k === 'color' && o?.colorMap) { const key = '#' + b.color.toString(16).padStart(6, '0'); if (o.colorMap[key]) v = o.colorMap[key]; }
    if (m[k]?.isColor) m[k].set(v); else m[k] = v;
  }
  m.needsUpdate = true;
}
/** 风格包里的角色规则：精确角色名优先，其次通配前缀（'morris.flora.*'） */
function matchRole(pack, role) {
  const r = pack.roles || {};
  if (r[role]) return r[role];
  let best = null, len = -1;
  for (const k of Object.keys(r)) if (k.endsWith('*') && role.startsWith(k.slice(0, -1)) && k.length > len) { best = r[k]; len = k.length; }
  return best;
}

/** 套用 / 取消风格包（null = 回到原始参数） */
export function applyStylePack(pack) {
  activePack = pack;
  let n = 0;
  for (const ref of live) { const m = ref.deref(); if (!m) { live.delete(ref); continue; } applyTo(m, pack); n++; }
  return n;
}
export const activeStylePack = () => activePack;

/** 当前存活的风格材质：角色 → 数量（工坊风格分区用） */
export function listStyleRoles() {
  const out = new Map();
  for (const ref of live) { const m = ref.deref(); if (!m) { live.delete(ref); continue; } const r = m.userData.styleRole; out.set(r, (out.get(r) || 0) + 1); }
  return [...out].map(([role, count]) => ({ role, count })).sort((a, b) => a.role.localeCompare(b.role));
}

/**
 * 外观指纹：遍历场景里所有材质，按影响外观的字段序列化后排序。重构前后指纹完全一致 = 材质外观一致。
 * （贴图只比是否存在与尺寸；uuid、name、userData 不参与。）
 */
export function materialFingerprint(root) {
  const seen = new Set(), rows = [];
  const tex = (t) => (t ? `tex:${t.image?.width || 0}x${t.image?.height || 0}` : '');
  const col = (c) => (c?.isColor ? c.getHexString() : '');
  root.traverse((o) => {
    if (!o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (seen.has(m)) continue; seen.add(m);
      rows.push([m.type, col(m.color), col(m.emissive), m.roughness ?? '', m.metalness ?? '', m.opacity, m.transparent, m.side, m.vertexColors, m.flatShading ?? '', m.depthWrite, m.depthTest, m.visible,
        m.polygonOffset, m.polygonOffsetFactor, m.alphaTest, tex(m.map), tex(m.alphaMap), tex(m.normalMap), m.fog ?? '', m.wireframe ?? ''].join('|'));
    }
  });
  return rows.sort();
}

/** 导出各角色的原始参数（生成风格包初稿用）：单一值，或多种颜色时给出颜色表 */
export function exportStyleBase() {
  const out = {};
  for (const ref of live) {
    const m = ref.deref(); if (!m) continue;
    const r = m.userData.styleRole, b = base.get(m);
    const row = out[r] || (out[r] = { type: m.type, colors: new Set(), roughness: new Set(), metalness: new Set(), opacity: new Set(), count: 0 });
    row.count++;
    if (b.color !== undefined) row.colors.add('#' + b.color.toString(16).padStart(6, '0'));
    for (const k of ['roughness', 'metalness', 'opacity']) if (b[k] !== undefined) row[k].add(b[k]);
  }
  for (const r of Object.values(out)) for (const k of ['colors', 'roughness', 'metalness', 'opacity']) r[k] = [...r[k]].sort();
  return out;
}
