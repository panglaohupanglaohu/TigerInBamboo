/**
 * doodle-hallway-layout.js — 第 56 批 C11-D：走廊墙饰的「展开面」版式（纯数据，node 可测）。
 *
 *   1897266928961700215「Yet another hallway design」：彩色分区底色 + 暖深色密集线稿 + 板间窄竖装饰带 + 下部白色竖纹护墙板；
 *                       拱门、转角墙、墙面经圆弧过渡（cove）弯进天花，分区底色/纹样一路延续到天花上。
 *   1890018647655272491「Further iterations on hallway design」：黑白版，纹样更密、左右镜像（图腾柱一样的对称脸），
 *                       拱门上方单独一块对称板，楼梯旁护墙板顶线随台阶斜上。
 *
 * 两条原文都只有一句话，没有说明生成算法；这里的「展开坐标 + 板 + 镜像 + 门位保留」是本项目的程序化解读，不是作者的生成器。
 *
 * 坐标：整条走廊的墙面沿墙展开成一张纸 (s, v)。s = 沿墙长度（两面墙在转角处连续累加），
 *       v = 从地面沿表面量的弧长：0..H 竖墙，H..H+πR/2 圆弧 cove，再往里 D 是天花。贴图 u=s/S、v=v/V，因此跨墙、跨 cove 都连续。
 */
import { makeRng } from './noise.js';

export const HALLWAY_DEFAULTS = Object.freeze({
  wallA: 4.2, wallB: 3.2, height: 3.9, coveR: 0.5, ceilDepth: 1.1,
  wainscot: 0.95, stairs: { s0: 0.6, s1: 2.9, rise: 0.9, steps: 6 },
  door: { wall: 'B', at: 1.7, width: 0.95, height: 2.05, archR: 0.475, band: 0.22 },
  panelWidth: 0.95, stripWidth: 0.14, mirror: true, density: 1, seed: 7,
});

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);

/** 楼梯：s∈[s0,s1] 内分 steps 级逐级抬高；之前 0、之后 rise。 */
export function floorAt(plan, s) {
  const st = plan.stairs; if (!st) return 0;
  if (s <= st.s0) return 0; if (s >= st.s1) return st.rise;
  const k = Math.min(st.steps - 1, Math.floor((s - st.s0) / (st.s1 - st.s0) * st.steps));
  return (k + 1) / st.steps * st.rise;
}
/** 护墙板顶线：随楼梯坡度连续斜上（片子里是一条斜线，不跟台阶锯齿走）。 */
export function wainscotTop(plan, s) {
  const st = plan.stairs, w = plan.wainscot; if (!st) return w;
  const t = Math.max(0, Math.min(1, (s - st.s0) / (st.s1 - st.s0)));
  return w + t * st.rise;
}

/** 门位（展开坐标）：矩形门洞 + 半圆拱；reserve = 门 + 拱外装饰带，纹样不进。 */
function doorRect(o, wallA) {
  const d = o.door; if (!d) return null;
  const sc = (d.wall === 'A' ? 0 : wallA) + d.at, half = d.width / 2;
  return { s0: sc - half, s1: sc + half, sc, v0: 0, rectTop: d.height, archR: d.archR, top: d.height + d.archR, band: d.band, width: d.width, height: d.height, wall: d.wall };
}
/** 点 (s,v) 是否在门洞（含拱）里；pad 往外扩。 */
export function inDoor(door, s, v, pad = 0) {
  if (!door) return false;
  const base = door.v0;
  if (s < door.s0 - pad || s > door.s1 + pad || v < base - pad) return false;
  if (v <= base + door.rectTop) return true;
  return Math.hypot(s - door.sc, v - (base + door.rectTop)) <= door.archR + pad;
}

export function planHallway(options = {}) {
  const o = { ...HALLWAY_DEFAULTS, ...options };
  if (options.stairs === null) o.stairs = null; else if (options.stairs) o.stairs = { ...HALLWAY_DEFAULTS.stairs, ...options.stairs };
  if (options.door === null) o.door = null; else if (options.door) o.door = { ...HALLWAY_DEFAULTS.door, ...options.door };
  for (const k of ['wallA', 'wallB', 'height', 'coveR', 'ceilDepth', 'wainscot', 'panelWidth', 'stripWidth', 'density'])
    if (!isNum(o[k]) || o[k] < 0) throw new RangeError('planHallway: ' + k);
  if (o.wallA < 1 || o.wallB < 1 || o.height < 1.5 || o.coveR <= 0 || o.panelWidth < 0.3 || !Number.isInteger(o.seed)) throw new RangeError('planHallway: size/seed');
  if (o.ceilDepth + o.coveR > Math.min(o.wallA, o.wallB)) throw new RangeError('planHallway: ceiling deeper than wall');
  const S = o.wallA + o.wallB, coveLen = Math.PI * o.coveR / 2, V = o.height + coveLen + o.ceilDepth;
  const plan = { S, V, H: o.height, R: o.coveR, D: o.ceilDepth, coveLen, wallA: o.wallA, wallB: o.wallB, wainscot: o.wainscot, stairs: o.stairs, mirror: !!o.mirror, seed: o.seed };
  const door = doorRect(o, o.wallA);
  if (door) {
    door.v0 = floorAt(plan, door.sc);   // 门开在当地地面（楼梯顶之后就是 rise）
    if (door.v0 + door.top + door.band > o.height) throw new RangeError('planHallway: door taller than wall');
    if (door.s0 < 0.2 || door.s1 > S - 0.2) throw new RangeError('planHallway: door outside wall');
  }
  plan.door = door;

  // ---- 沿 s 切板：门位单独成一跨（门上方一块对称板），转角处强制断开，其余按 panelWidth 抖动 ----
  const cuts = [0, o.wallA, S];
  if (door) cuts.push(door.s0 - door.band, door.s1 + door.band);
  cuts.sort((a, b) => a - b);
  const spans = [];
  for (let i = 0; i + 1 < cuts.length; i++) if (cuts[i + 1] - cuts[i] > 1e-6) spans.push([cuts[i], cuts[i + 1]]);
  const panels = [], strips = [];
  let index = 0;
  for (const [a, b] of spans) {
    const isBay = door && Math.abs(a - (door.s0 - door.band)) < 1e-9;
    if (isBay) { panels.push(makePanel(plan, o, index++, a, b, { bay: true })); continue; }
    // 普通跨：等分成接近 panelWidth 的若干板，板间夹窄竖带
    const len = b - a, n = Math.max(1, Math.round(len / (o.panelWidth + o.stripWidth)));
    const unit = len / n;
    for (let k = 0; k < n; k++) {
      const s0 = a + k * unit, s1 = s0 + unit - (k < n - 1 ? o.stripWidth : 0);
      panels.push(makePanel(plan, o, index++, s0, s1, {}));
      if (k < n - 1) strips.push({ s0: s1, s1: s1 + o.stripWidth, seed: (o.seed ^ Math.imul(index + 101, 2654435761)) | 0 });
    }
  }
  plan.panels = panels; plan.strips = strips;
  plan.lineWidth = 0.012;    // 线宽按米给（与贴图分辨率无关）
  plan.flutePitch = 0.055;
  return plan;
}

const KINDS = ['fish', 'owl', 'flower', 'clover', 'bug', 'mask', 'totem', 'sun', 'scroll', 'eye'];
function makePanel(plan, o, index, s0, s1, { bay = false }) {
  const rng = makeRng((o.seed ^ Math.imul(index + 1, 16777619)) | 0), w = s1 - s0;
  const door = plan.door;
  const vBottom = bay ? door.v0 + door.top + door.band : Math.min(wainscotTop(plan, s0), wainscotTop(plan, s1));
  const floorV = (x) => bay ? vBottom : wainscotTop(plan, s0 + x);   // 板底随护墙板斜线
  const tint = (((o.seed % 6) + 6) % 6 + index) % 6;
  // 镜像时只在左半边（含跨中线一点）布纹样，右半边由画法镜像得到 → 严格左右对称
  const xMax = plan.mirror ? w / 2 + w * 0.06 : w;
  const motifs = [], area = xMax * (plan.V - vBottom);
  const big = Math.max(4, Math.round(area * 3.2 * o.density)), small = Math.round(area * 26 * o.density);
  const fits = (x, v, r) => {
    if (x - r < 0.02 || v - r < floorV(x) + 0.03 || (plan.mirror && v - r < floorV(w - x) + 0.03) || v + r > plan.V - 0.01 || (!plan.mirror && x + r > w - 0.02)) return false;
    if (door && inDoor(door, s0 + x, v, r + door.band)) return false;
    if (plan.mirror && door && inDoor(door, s1 - x, v, r + door.band)) return false;
    for (const m of motifs) if (Math.hypot(m.x - x, m.v - v) < (m.size + r) * 0.92) return false;
    return true;
  };
  // 中线大件（图腾/脸/太阳）：先沿中线自上而下摆，镜像后成对称柱
  if (plan.mirror) for (let v = plan.V - 0.3; v > vBottom + 0.2; v -= w * 0.62) {
    const r = Math.min(w * 0.3, 0.32) * (0.85 + rng() * 0.25);
    if (fits(w / 2, v, r)) motifs.push({ kind: ['totem', 'sun', 'owl', 'mask', 'eye'][Math.floor(rng() * 5)], x: w / 2, v, size: r, rotation: 0 });
  }
  for (let i = 0, tries = 0; i < big && tries < big * 30; tries++) {
    const r = Math.min(w * 0.22, 0.24) * (0.6 + rng() * 0.6), x = rng() * xMax, v = vBottom + rng() * (plan.V - vBottom);
    if (!fits(x, v, r)) continue;
    motifs.push({ kind: KINDS[Math.floor(rng() * KINDS.length)], x, v, size: r, rotation: (rng() - 0.5) * 0.6 }); i++;
  }
  // 填空小件（点 / 圈 / 豆）：把参考片里密密麻麻的小纹样补上
  for (let i = 0, tries = 0; i < small && tries < small * 20; tries++) {
    const r = 0.025 + rng() * 0.05, x = rng() * xMax, v = vBottom + rng() * (plan.V - vBottom);
    if (!fits(x, v, r)) continue;
    motifs.push({ kind: ['dot', 'ring', 'bean'][Math.floor(rng() * 3)], x, v, size: r, rotation: rng() * Math.PI }); i++;
  }
  return { index, s0, s1, w, bay, vBottom, tint, motifs };
}

/** 镜像后的完整纹样表（左半 + 右半镜像），测试/统计用。 */
export function mirroredMotifs(plan, panel) {
  if (!plan.mirror) return panel.motifs.map((m) => ({ ...m, s: panel.s0 + m.x }));
  const out = [];
  for (const m of panel.motifs) {
    out.push({ ...m, s: panel.s0 + m.x });
    if (Math.abs(m.x - panel.w / 2) > 1e-9) out.push({ ...m, x: panel.w - m.x, s: panel.s1 - m.x, rotation: -m.rotation, mirrored: true });
  }
  return out;
}

/**
 * 展开坐标 → 3D。墙 A 沿 +x（z=0，屋里在 +z），墙 B 在 x=wallA 沿 +z（屋里在 −x）。
 * 内转角 (wallA, 0)：cove/天花往里偏 d 后两面墙按 45° 斜接（各自把 s 夹到 d 外），这样两片在转角严丝合缝。
 */
export function surfacePoint(plan, s, v) {
  const { H, R } = plan;
  let y, d;
  if (v <= H) { y = v; d = 0; }
  else if (v <= H + plan.coveLen) { const th = (v - H) / R; y = H + R * Math.sin(th); d = R * (1 - Math.cos(th)); }
  else { y = H + R; d = R + (v - H - plan.coveLen); }
  if (s <= plan.wallA) { const x = Math.min(s, plan.wallA - d); return [x, y, d]; }
  const z = Math.max(s - plan.wallA, d); return [plan.wallA - d, y, z];
}
