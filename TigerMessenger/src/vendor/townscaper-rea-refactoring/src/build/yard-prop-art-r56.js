/**
 * yard-prop-art-r56.js — 后院道具的程序化美术（第 56 批 C05·C）。
 *
 * 片子 1205416648397721601（"New prop placement system! It tries to place as many props as it can without overlap"）
 * 里被塞满的是桌椅、盆栽、木箱这类小件。摆放算法（凸格内贪心 + SAT 不重叠 + 标准刚性框）早已在
 * core/opening-footprint.js · placeProps，buildings.js 用 world.yardProps 接到真实后院格；那里画的是统一木盒。
 * 这里只换“画法”：按贪心给出的同一个刚性矩形 footprint（不改位置 / 大小 / 朝向，所以零重叠结论不变），
 * 大的画成桌子（桌面 + 四腿）、中等画木箱、小的画石盆栽。开关 world.yardPropArt（默认关，关时照旧木盒）。
 * 原版道具美术没有迁移，这是程序化替代。
 */
import { UP } from '../core/meshwriter.js';

export function propKind(p) {
  const a = p.poly[0], b = p.poly[1], d = p.poly[3];
  const hu = Math.hypot(b.x - a.x, b.z - a.z) / 2, hv = Math.hypot(d.x - a.x, d.z - a.z) / 2, m = Math.min(hu, hv);
  return m >= 0.045 ? 'table' : m >= 0.034 ? 'crate' : 'planter';
}

const side = (w, poly, y0, y1, col, shade) => {
  for (let k = 0; k < 4; k++) {
    const a = poly[k], b = poly[(k + 1) % 4], l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    w.quad([a.x, y0, a.z], [b.x, y0, b.z], [b.x, y1, b.z], [a.x, y1, a.z], [(b.z - a.z) / l, 0, -(b.x - a.x) / l], col, shade);
  }
};
const inset = (poly, t) => { const cx = poly.reduce((s, p) => s + p.x, 0) / 4, cz = poly.reduce((s, p) => s + p.z, 0) / 4; return poly.map((p) => ({ x: p.x + (cx - p.x) * t, z: p.z + (cz - p.z) * t })); };

/** 画一件道具；返回种类。footprint 恒为 p.poly（与 placeProps 的不重叠判定同一个矩形）。 */
export function drawYardProp(w, p, y, K) {
  const kind = propKind(p), poly = p.poly;
  if (kind === 'table') {
    const top = y + 0.06, th = 0.012;
    w.poly(poly.map((q) => [q.x, top, q.z]), UP, K.frame, 1.02);
    side(w, poly, top - th, top, K.frame, 0.85);
    for (const q of inset(poly, 0.22)) w.beam([q.x, y, q.z], [q.x, top - th, q.z], 0.008, K.rail, 1);
  } else if (kind === 'crate') {
    const h = y + 0.045;
    w.poly(poly.map((q) => [q.x, h, q.z]), UP, K.door, 1.05);
    side(w, poly, y, h, K.door, 0.85);
  } else {
    const h = y + 0.03, cx = poly.reduce((s, q) => s + q.x, 0) / 4, cz = poly.reduce((s, q) => s + q.z, 0) / 4;
    const r = Math.min(...poly.map((q) => Math.hypot(q.x - cx, q.z - cz))) * 0.7;
    side(w, poly, y, h, K.stone, 0.95);
    w.poly(poly.map((q) => [q.x, h, q.z]), UP, K.stoneDark, 0.9);
    w.blob(cx, h + r * 0.6, cz, r, r * 0.9, K.treeLight);
  }
  return kind;
}
