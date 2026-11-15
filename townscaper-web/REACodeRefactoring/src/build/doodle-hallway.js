/**
 * doodle-hallway.js — 第 56 批 C11-D：完整室内走廊（两面墙 + 内转角 + 圆弧 cove 弯进天花 + 拱门 + 楼梯 + 竖纹护墙板），
 * 墙饰按 core/doodle-hallway-layout.js 的展开坐标画成一张贴图，UV 沿墙连续（跨转角、跨 cove 不断）。
 *
 *   1897266928961700215 彩色版：分区底色、暖深色线稿、板间窄竖装饰带、白色竖纹护墙板。
 *   1890018647655272491 黑白版：同一版式关掉底色、纹样更密（density）、左右镜像。
 *
 * 原文只有标题，没有给出生成算法；纹样是程序化替身（保留原版 doodlewall 的鱼/鸟/花/虫/面具路径，另加图腾/太阳/卷草/眼/填空小件），
 * 不是作者的手绘美术。
 */
import * as THREE from 'three';
import { drawMotif, INK, PANEL_TINTS, PAPER } from './doodle-wall.js';
import { planHallway, floorAt, wainscotTop, inDoor, surfacePoint } from '../core/doodle-hallway-layout.js';

const GRAY_INK = 'rgba(30,30,30,.95)';
const EXTRA = {
  /** 图腾脸：上眉、双眼、喙、下颌齿 —— 画在中线上，镜像后严格对称。 */
  totem(ctx, s) {
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.62, s * 0.86, 0, 0, Math.PI * 2); ctx.stroke();
    for (const k of [-1, 1]) {
      ctx.beginPath(); ctx.arc(k * s * 0.27, -s * 0.22, s * 0.17, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(k * s * 0.27, -s * 0.22, s * 0.06, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(k * s * 0.08, -s * 0.48); ctx.quadraticCurveTo(k * s * 0.3, -s * 0.64, k * s * 0.5, -s * 0.42); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(-s * 0.12, -s * 0.05); ctx.lineTo(0, s * 0.3); ctx.lineTo(s * 0.12, -s * 0.05); ctx.stroke();
    ctx.beginPath(); ctx.rect(-s * 0.34, s * 0.42, s * 0.68, s * 0.2); ctx.stroke();
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * s * 0.13, s * 0.42); ctx.lineTo(i * s * 0.13, s * 0.62); ctx.stroke(); }
  },
  /** 太阳：圆 + 花瓣光芒 + 内圈。 */
  sun(ctx, s) {
    ctx.beginPath(); ctx.arc(0, 0, s * 0.42, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, s * 0.22, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(s * 0.7, 0, s * 0.2, s * 0.09, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
  },
  /** 卷草：阿基米德螺线 + 叶片。 */
  scroll(ctx, s) {
    ctx.beginPath(); for (let i = 0; i <= 60; i++) { const a = i / 60 * Math.PI * 4, r = s * 0.85 * i / 60; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(0, 0); } ctx.stroke();
    for (const a of [0.6, 2.4, 4.2]) { ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(s * 0.9, 0, s * 0.22, s * 0.1, 0.5, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
  },
  /** 眼：杏仁 + 瞳 + 睫毛。 */
  eye(ctx, s) {
    ctx.beginPath(); ctx.moveTo(-s * 0.8, 0); ctx.quadraticCurveTo(0, -s * 0.7, s * 0.8, 0); ctx.quadraticCurveTo(0, s * 0.7, -s * 0.8, 0); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, s * 0.24, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, s * 0.1, 0, Math.PI * 2); ctx.fill();
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * s * 0.18, -s * 0.36); ctx.lineTo(i * s * 0.24, -s * 0.58); ctx.stroke(); }
  },
  dot(ctx, s) { ctx.beginPath(); ctx.arc(0, 0, s * 0.45, 0, Math.PI * 2); ctx.fill(); },
  ring(ctx, s) { ctx.beginPath(); ctx.arc(0, 0, s * 0.7, 0, Math.PI * 2); ctx.stroke(); },
  bean(ctx, s) { ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.5, 0, 0, Math.PI * 2); ctx.stroke(); },
};
function drawAny(ctx, kind, x, y, size, lw, rot, ink) {
  if (!EXTRA[kind]) { drawMotif(ctx, kind, x, y, size, lw, rot); return; }
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.strokeStyle = ctx.fillStyle = ink; ctx.lineWidth = lw; ctx.lineCap = ctx.lineJoin = 'round';
  EXTRA[kind](ctx, size); ctx.restore();
}

/** 展开贴图。返回 canvas（最终颜色）、mask（只有纹样墨线的透明层，统计用）、stats。 */
export function paintHallwayTexture(plan, { gray = false, ppu = 200, doc = globalThis.document } = {}) {
  const W = Math.round(plan.S * ppu), Hh = Math.round(plan.V * ppu), X = (s) => s * ppu, Y = (v) => (plan.V - v) * ppu;
  const canvas = doc.createElement('canvas'), mask = doc.createElement('canvas'); canvas.width = mask.width = W; canvas.height = mask.height = Hh;
  const ctx = canvas.getContext('2d'), mk = mask.getContext('2d'), lw = plan.lineWidth * ppu, ink = gray ? GRAY_INK : INK;
  ctx.fillStyle = gray ? '#ffffff' : PAPER; ctx.fillRect(0, 0, W, Hh);
  const sym = [];
  // ---- 板：底色 + 纹样（左半画、右半镜像）----
  for (const p of plan.panels) {
    const poly = panelPolygon(plan, p), wpx = Math.ceil(p.w * ppu);
    ctx.save(); pathPoly(ctx, poly, X, Y); ctx.fillStyle = gray ? '#ffffff' : PANEL_TINTS[p.tint]; ctx.fill(); ctx.restore();
    const off = doc.createElement('canvas'); off.width = wpx; off.height = Hh; const oc = off.getContext('2d');
    oc.save(); oc.beginPath(); oc.rect(0, 0, plan.mirror ? wpx / 2 : wpx, Hh); oc.clip();
    // 原版 drawMotif 的 INK 是暖深色；黑白版在合成时整体去色
    for (const m of p.motifs) drawAny(oc, m.kind, m.x * ppu, Y(m.v), m.size * ppu, lw, m.rotation, INK);
    oc.restore();
    mk.save(); pathPoly(mk, poly, X, Y); mk.clip();
    if (plan.door) { mk.beginPath(); mk.rect(0, 0, W, Hh); doorPath(mk, plan.door, X, Y, plan.door.band * 0.5); mk.clip('evenodd'); }
    mk.drawImage(off, X(p.s0), 0);
    if (plan.mirror) { mk.save(); mk.translate(X(p.s0) + wpx, 0); mk.scale(-1, 1); mk.drawImage(off, 0, 0); mk.restore(); }
    mk.restore();
    if (plan.mirror) sym.push({ index: p.index, x0: Math.round(X(p.s0)), w: wpx, stair: !p.bay && Math.abs(wainscotTop(plan, p.s0) - wainscotTop(plan, p.s1)) > 1e-6 });
  }
  // ---- 板间窄竖装饰带：重复的小三角 / 圆点 ----
  for (const st of plan.strips) {
    const x0 = X(st.s0), x1 = X(st.s1), cx = (x0 + x1) / 2, top = Math.min(wainscotTop(plan, st.s0), wainscotTop(plan, st.s1));
    ctx.fillStyle = gray ? '#ffffff' : '#f7f1e4'; ctx.fillRect(x0, 0, x1 - x0, Y(top));
    ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = lw * 0.8;
    const pitch = (x1 - x0) * 1.1;
    for (let y = pitch * 0.6, k = 0; y < Y(top) - pitch * 0.4; y += pitch, k++) {
      ctx.beginPath();
      if (k % 2) { ctx.moveTo(cx - pitch * 0.3, y - pitch * 0.25); ctx.lineTo(cx + pitch * 0.3, y - pitch * 0.25); ctx.lineTo(cx, y + pitch * 0.28); ctx.closePath(); ctx.stroke(); }
      else { ctx.arc(cx, y, pitch * 0.18, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.lineWidth = lw; for (const x of [x0, x1]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, Y(top)); ctx.stroke(); }
  }
  // ---- 纹样墨线合成 ----
  ctx.save(); if (gray) ctx.filter = 'grayscale(1) contrast(1.6)'; ctx.drawImage(mask, 0, 0); ctx.restore();
  // ---- 护墙板：白底竖纹 + 顶线随楼梯斜上 ----
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(0, Hh);
  for (let s = 0; s <= plan.S + 1e-9; s += 0.02) ctx.lineTo(X(s), Y(wainscotTop(plan, s)));
  ctx.lineTo(W, Hh); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = gray ? '#5a5a58' : 'rgba(70,64,58,.75)'; ctx.lineWidth = Math.max(1, lw * 0.5);
  for (let s = plan.flutePitch; s < plan.S; s += plan.flutePitch) { ctx.beginPath(); ctx.moveTo(X(s), Y(wainscotTop(plan, s)) + lw * 2.5); ctx.lineTo(X(s), Hh); ctx.stroke(); }
  ctx.strokeStyle = ink; ctx.lineWidth = lw * 1.4;
  for (const dv of [0, 0.035]) { ctx.beginPath(); for (let s = 0; s <= plan.S + 1e-9; s += 0.02) { const y = Y(wainscotTop(plan, s) - dv); s ? ctx.lineTo(X(s), y) : ctx.moveTo(X(s), y); } ctx.stroke(); }
  // ---- 门位：门框 + 拱外装饰带（片子里门拱外一圈花边），门洞内纹样已被 mask 排除 ----
  if (plan.door) paintDoorBand(ctx, plan, X, Y, lw, ink, gray);
  // ---- 天花尽头线、转角线 ----
  ctx.strokeStyle = ink; ctx.lineWidth = lw * 1.5; ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(W, 1); ctx.stroke();

  // ---- 统计 ----
  const md = mk.getImageData(0, 0, W, Hh).data; let inkA = 0, panelPx = 0, doorInk = 0;
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    const a = md[(y * W + x) * 4 + 3]; if (!a) continue; inkA += a / 255;
    if (plan.door && inDoor(plan.door, x / ppu, plan.V - y / ppu, plan.door.band * 0.4)) doorInk++;
  }
  for (const p of plan.panels) panelPx += p.w * (plan.V - p.vBottom) * ppu * ppu;
  let symErr = 0, symN = 0;
  for (const q of sym) if (!q.stair) for (let y = 0; y < Hh; y += 2) for (let x = 0; x < q.w >> 1; x += 2) {
    const a = md[(y * W + q.x0 + x) * 4 + 3], b = md[(y * W + q.x0 + q.w - 1 - x) * 4 + 3]; if (a || b) { symErr += Math.abs(a - b) / 255; symN++; }
  }
  return { canvas, mask, plan, stats: { W, H: Hh, ppu, panels: plan.panels.length, strips: plan.strips.length, motifs: plan.panels.reduce((n, p) => n + p.motifs.length, 0), inkPct: +(inkA / panelPx * 100).toFixed(2), doorInkPx: doorInk, symmetryErr: symN ? +(symErr / symN).toFixed(4) : null, symPanels: sym.filter((q) => !q.stair).length } };
}

function panelPolygon(plan, p) {
  const pts = [];
  pts.push([p.s0, plan.V], [p.s1, plan.V]);
  if (p.bay) pts.push([p.s1, p.vBottom], [p.s0, p.vBottom]);
  else { for (let s = p.s1; s >= p.s0 - 1e-9; s -= Math.max(0.02, p.w / 40)) pts.push([s, wainscotTop(plan, s)]); pts.push([p.s0, wainscotTop(plan, p.s0)]); }
  return pts;
}
function pathPoly(ctx, pts, X, Y) { ctx.beginPath(); pts.forEach(([s, v], i) => (i ? ctx.lineTo(X(s), Y(v)) : ctx.moveTo(X(s), Y(v)))); ctx.closePath(); }
function doorPath(ctx, d, X, Y, pad) {
  const base = d.v0 - pad, top = d.v0 + d.rectTop, r = d.archR + pad;
  ctx.moveTo(X(d.s0 - pad), Y(base)); ctx.lineTo(X(d.s0 - pad), Y(top));
  ctx.arc(X(d.sc), Y(top), r * (X(1) - X(0)), Math.PI, 0, false);
  ctx.lineTo(X(d.s1 + pad), Y(base)); ctx.closePath();
}
function paintDoorBand(ctx, plan, X, Y, lw, ink, gray) {
  const d = plan.door, top = d.v0 + d.rectTop, ppu = X(1) - X(0);
  ctx.save();
  ctx.beginPath(); doorPath(ctx, d, X, Y, d.band); ctx.fillStyle = gray ? '#ffffff' : '#efd2d4'; ctx.fill();
  ctx.beginPath(); doorPath(ctx, d, X, Y, 0); ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = lw * 1.2;
  ctx.beginPath(); doorPath(ctx, d, X, Y, d.band); ctx.stroke();
  ctx.beginPath(); doorPath(ctx, d, X, Y, 0.02); ctx.stroke();
  // 拱带：放射花瓣 + 环点（门拱外花边）
  const rMid = (d.archR + d.band * 0.5) * ppu, n = 13;
  for (let i = 0; i < n; i++) { const a = Math.PI + (i + 0.5) / n * Math.PI; ctx.save(); ctx.translate(X(d.sc) + Math.cos(a) * rMid, Y(top) + Math.sin(a) * rMid); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(0, 0, d.band * 0.32 * ppu, d.band * 0.16 * ppu, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
  // 门侧竖带：小圆点
  for (const sx of [d.s0 - d.band * 0.5, d.s1 + d.band * 0.5]) for (let v = d.v0 + 0.15; v < top; v += 0.16) { ctx.beginPath(); ctx.arc(X(sx), Y(v), d.band * 0.12 * ppu, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}

/** 走廊壳体几何（两面墙 + cove + 天花），按展开坐标细分，uv = (s/S, v/V)；color 属性按朝向给一点明暗。 */
export function buildHallwayGeometry(plan, { ds = 0.05, dv = 0.05 } = {}) {
  const pos = [], uv = [], col = [], idx = [];
  const vRows = []; for (let v = 0; v < plan.V - 1e-9; v += dv) vRows.push(v); vRows.push(plan.V);
  for (const b of [plan.H, plan.H + plan.coveLen]) if (!vRows.some((v) => Math.abs(v - b) < 1e-9)) vRows.push(b);
  vRows.sort((a, b) => a - b);
  for (const [a, b, shade] of [[0, plan.wallA, 1], [plan.wallA, plan.S, 0.92]]) {
    const cols = []; for (let s = a; s < b - 1e-9; s += ds) cols.push(s); cols.push(b);
    const base = pos.length / 3;
    for (const s of cols) for (const v of vRows) {
      pos.push(...surfacePoint(plan, s, v)); uv.push(s / plan.S, v / plan.V);
      const k = v <= plan.H ? shade : v <= plan.H + plan.coveLen ? shade * 0.97 + 0.03 * (1 - (v - plan.H) / plan.coveLen) : 0.95;
      col.push(k, k, k);
    }
    const nv = vRows.length;
    for (let i = 0; i + 1 < cols.length; i++) for (let j = 0; j + 1 < nv; j++) {
      const p = base + i * nv + j, q = p + nv;
      idx.push(p, q, p + 1, q, q + 1, p + 1);   // 两面墙同一绕向：法线朝屋里
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}

/** 门（门扇 + 半圆拱上的放射格扇窗 + 门框 + 门把），平贴在墙前 4mm。 */
export function buildDoor(plan, { doc = globalThis.document, gray = false } = {}) {
  const d = plan.door; if (!d) return null;
  const sh = new THREE.Shape(); sh.moveTo(d.s0, d.v0); sh.lineTo(d.s1, d.v0); sh.lineTo(d.s1, d.v0 + d.rectTop); sh.absarc(d.sc, d.v0 + d.rectTop, d.archR, 0, Math.PI, false); sh.lineTo(d.s0, d.v0);
  const g = new THREE.ShapeGeometry(sh, 24), p = g.attributes.position, uv = g.attributes.uv, totalH = d.rectTop + d.archR;
  for (let i = 0; i < p.count; i++) {
    const s = p.getX(i), v = p.getY(i); uv.setXY(i, (s - d.s0) / d.width, (v - d.v0) / totalH);
    const off = 0.004, P = s <= plan.wallA ? [s, v, off] : [plan.wallA - off, v, s - plan.wallA]; p.setXYZ(i, ...P);
  }
  g.computeVertexNormals();
  const ppu = 220, c = doc.createElement('canvas'); c.width = Math.round(d.width * ppu); c.height = Math.round(totalH * ppu);
  const x = c.getContext('2d'), W = c.width, H = c.height, Yd = (v) => H - v * ppu, ink = gray ? GRAY_INK : INK, lw = 0.014 * ppu;
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H); x.strokeStyle = ink; x.fillStyle = ink; x.lineWidth = lw;
  const cx = W / 2, ay = Yd(d.rectTop), r = d.archR * ppu;
  x.beginPath(); x.moveTo(lw, H); x.lineTo(lw, ay); x.arc(cx, ay, r - lw, Math.PI, 0); x.lineTo(W - lw, H); x.stroke();      // 门框
  x.beginPath(); x.moveTo(lw, ay); x.lineTo(W - lw, ay); x.stroke();                                                       // 拱脚横档
  x.beginPath(); x.arc(cx, ay, r * 0.32, Math.PI, 0); x.stroke();                                                           // 扇窗内圈
  for (let i = 1; i < 6; i++) { const a = Math.PI + i / 6 * Math.PI; x.beginPath(); x.moveTo(cx + Math.cos(a) * r * 0.32, ay + Math.sin(a) * r * 0.32); x.lineTo(cx + Math.cos(a) * (r - lw), ay + Math.sin(a) * (r - lw)); x.stroke(); }
  const m = 0.12 * ppu; x.strokeRect(m, ay + m, W - 2 * m, (Yd(0) - ay) * 0.42 - m); x.strokeRect(m, ay + (Yd(0) - ay) * 0.48, W - 2 * m, (Yd(0) - ay) * 0.5 - m);   // 门芯两块
  x.beginPath(); x.arc(W * 0.82, Yd(d.rectTop * 0.48), 0.03 * ppu, 0, Math.PI * 2); x.fill();                             // 门把
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })); mesh.name = 'door'; return mesh;
}

/** 楼梯（沿墙 A）+ 平台 + 转角处地面，白色踏步 + 黑描边。 */
export function buildStairs(plan, { depth = 1.15 } = {}) {
  const group = new THREE.Group(), st = plan.stairs, mat = new THREE.MeshBasicMaterial({ color: 0xf3f2ee }), lineMat = new THREE.LineBasicMaterial({ color: 0x2c2a28 });
  const box = (x0, x1, y1, z0, z1) => {
    const g = new THREE.BoxGeometry(x1 - x0, Math.max(0.001, y1), z1 - z0); g.translate((x0 + x1) / 2, y1 / 2, (z0 + z1) / 2);
    const m = new THREE.Mesh(g, mat); group.add(m); group.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), lineMat)); return m;
  };
  if (st) {
    const ds = (st.s1 - st.s0) / st.steps;
    for (let k = 0; k < st.steps; k++) box(st.s0 + k * ds, st.s0 + (k + 1) * ds, (k + 1) / st.steps * st.rise, 0.0, depth);
    box(st.s1, plan.wallA, st.rise, 0, depth);                         // 楼梯顶平台
    box(plan.wallA - depth, plan.wallA, st.rise, depth, plan.wallB);    // 沿墙 B 的平台（门前）
  }
  // 楼梯底下的一级地面（瓷砖线）
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(st ? st.s0 + 0.001 : plan.wallA, depth).rotateX(-Math.PI / 2).translate((st ? st.s0 : plan.wallA) / 2, 0.001, depth / 2), mat);
  group.add(fl); group.name = 'stairs'; return group;
}

/** 组装整条走廊。 */
export function makeHallway({ gray = false, seed = 7, density, ppu = 200, doc = globalThis.document, ...opts } = {}) {
  const plan = planHallway({ seed, density: density ?? (gray ? 1.35 : 1), ...opts });
  const tex = paintHallwayTexture(plan, { gray, ppu, doc });
  const map = new THREE.CanvasTexture(tex.canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const geo = buildHallwayGeometry(plan), group = new THREE.Group();
  const shell = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map, vertexColors: true, side: THREE.DoubleSide })); shell.name = 'shell'; group.add(shell);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ color: 0x1e1c1a })); group.add(edges);
  const door = buildDoor(plan, { doc, gray }); if (door) group.add(door);
  group.add(buildStairs(plan));
  return { group, plan, texture: map, paint: tex, geometry: geo, door, dispose() { map.dispose(); geo.dispose(); door?.material.map?.dispose(); } };
}
export { floorAt, wainscotTop };
