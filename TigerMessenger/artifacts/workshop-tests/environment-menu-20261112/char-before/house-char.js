/**
 * 屋体炭黑（charred house）—— 837027901853810688 / 828984794407170048 / 1007587828992266240 共用。
 *
 * 原片证据（837 514 帧）：小屋失守 → 火球炸开的那一帧起，**屋体自己**变成近黑多边形并一直黑到片尾
 * （f0082 近黑像素 1076 → f0083 5681，一帧跳完，之后 13 s 稳定在 5.5–6.6 k，不再扩大）。
 * 所以它不是「地面黑坑贴花」，而是把渲染网格里落在这栋屋范围内的顶点色压到焦黑。
 *
 * 不 import three：node 端可直接喂假 BufferAttribute 测。
 */

/**
 * 焦黑色（线性空间）。**不再沿用 c03 的暖焦 (.045/.036/.04)**：837 片近黑区屏幕中位色是 [46,29,51]
 * （B 最高 = 冷紫黑），按「渲染值/反照率」逐通道折算得 (.044/.021/.070)。旧值渲出来是 [47,40,39]，
 * G 偏亮 38%、B 偏暗 23% —— 见第 93 轮证据 md 的量测表。
 */
export const CHAR = {
  r: 0.044,
  g: 0.021,
  b: 0.07,
  /** 斑驳：逐顶点正弦扰动，幅度 0.375 与原实现等效（k=.16+.06·sin → k/.16 = 1+.375·sin）。 */
  mottle: 0.375,
  /** 屋格轮廓外扩倍数（含屋檐）。原实现 1.3。 */
  grow: 1.3,
  /** 地面以上的判定抬高（世界单位）。原实现 0.02。 */
  lift: 0.02,
};

/** 屋格轮廓外扩：cell.pts 元素是 {x,z}（不是数组，别用 p[0]）。 */
export function expandOutline(cell, k = CHAR.grow) {
  return cell.pts.map((p) => ({ x: cell.cx + (p.x - cell.cx) * k, z: cell.cz + (p.z - cell.cz) * k }));
}

/** 凸多边形内外（原实现的符号一致法；凹多边形会误判，屋格是凸的）。 */
export function inOutline(pts, x, z) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], d = pts[(i + 1) % pts.length];
    const cr = (d.x - a.x) * (z - a.z) - (d.z - a.z) * (x - a.x);
    if (Math.abs(cr) < 1e-9) continue;
    const sg = Math.sign(cr);
    if (s && sg !== s) return false;
    s = sg;
  }
  return true;
}

/** 第 i 个顶点的明暗系数（确定性，便于测试复算）。 */
export function charShade(i, mottle = CHAR.mottle) {
  return 1 + mottle * Math.sin(i * 12.9898);
}

/**
 * 把网格里「在屋格轮廓内 + 高于地面」的顶点压成焦黑。
 * @param {object} a
 * @param {object} a.color     BufferAttribute（geometry.attributes.color）
 * @param {object} a.position  BufferAttribute（geometry.attributes.position）
 * @param {ArrayLike<number>} a.matrix  mesh.matrixWorld.elements
 * @param {object} a.cell      世界格（cx/cz/pts）
 * @param {number} a.baseY     地面世界高度
 * @returns {{count:number, idx:number[], rgb:number[]}}
 */
export function charHouseVerts({ color, position, matrix, cell, baseY, k = CHAR.grow, lift = CHAR.lift, mottle = CHAR.mottle }) {
  const out = { count: 0, idx: [], rgb: [] };
  if (!color || !position) return out;
  const e = matrix, pts = expandOutline(cell, k), base = baseY + lift;
  for (let i = 0; i < position.count; i++) {
    const lx = position.getX(i), ly = position.getY(i), lz = position.getZ(i);
    const x = lx * e[0] + ly * e[4] + lz * e[8] + e[12];
    const y = lx * e[1] + ly * e[5] + lz * e[9] + e[13];
    const z = lx * e[2] + ly * e[6] + lz * e[10] + e[14];
    if (y < base || !inOutline(pts, x, z)) continue;
    out.idx.push(i);
    out.rgb.push(color.getX(i), color.getY(i), color.getZ(i));
    const s = charShade(i, mottle);
    color.setXYZ(i, CHAR.r * s, CHAR.g * s, CHAR.b * s);
    out.count++;
  }
  return out;
}

/** 还原（stop / 重建时）。color 已被换掉（换了几何）就放弃，避免写到别人的缓冲上。 */
export function restoreChar(color, saved) {
  if (!color || !saved) return 0;
  let n = 0;
  for (let j = 0; j < saved.idx.length; j++) {
    const i = saved.idx[j];
    if (i >= color.count) continue;
    color.setXYZ(i, saved.rgb[j * 3], saved.rgb[j * 3 + 1], saved.rgb[j * 3 + 2]);
    n++;
  }
  return n;
}
