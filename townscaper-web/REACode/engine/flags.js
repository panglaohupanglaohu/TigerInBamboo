/**
 * flags.js — 旗子不是"加个 sin 摆动"，而是**沿风粒子轨迹拟合出的曲线**做出来的网格。
 *
 * 原文（x.com/OskSta/status/926890207298899969, 2017-11-04）：
 *
 *   "Not really. I build a custom mesh for the flag using a bezier curve along
 *    virtual wind particles"
 *
 * 前面那句（x.com/OskSta/status/926834721392340992）说"给旗子做了个风系统让它
 * 摆得对"，这条补上了做法：**先放虚拟粒子让风把它们吹走，再拿粒子轨迹当曲线**，
 * 布面挂在这条曲线上。
 *
 * 为什么这比 sin 好：sin 摆动的旗子是"整体在晃"，旗杆处也在晃；而真实的旗子是
 * **旗杆处几乎不动、离杆越远越飘**。粒子轨迹天然就是这样 —— 粒子从杆顶出发，
 * 被风吹得越久偏得越多，于是曲线在杆顶切线固定、末端拉长。
 *
 * 画面（`926834721392340992`，24 帧，420²）：一整片城垛上插着几十根细白矛杆，
 * 旗帜是**长条飘带**挂在杆顶 —— 近杆端竖直贴在杆上，往外被风兜平、末端分叉成
 * 2~3 个尖；同一簇里所有旗子的**朝向一致、相位不同**。
 *
 * 第二条片子（`958410200146497537`，"这套做法足够通用，场内旗帜也能用"）是图鉴：
 * 一屏十几面旗正对镜头。这三件事是本轮补的，都是量出来的：
 *   · 宽高比 **2.2~2.5 : 1**（正对镜头的几帧；带透视时更长）；
 *   · 尾端 **燕尾缺口**（从末端往内剪一个 V，深约 35~45% 长度），有的剪两刀成三尖；
 *   · 布面是**平涂高饱和色 + 白色徽记**（兔/树/骷髅/塔），没有渐变、没有明暗。
 * 上一版做成"米白方布"，和这两条片子都不像。
 */

import * as THREE from 'three';
import { sampleCurve } from '../src/wind.js';

const LEVEL = 0.42;

/**
 * 旗帜用色：直接从 `958410200146497537` 的帧里取的像素（不是我编的配色）。
 * 原文说的是"这套做法通用，场内的旗子也用得上"，画面里就是这些平涂色。
 */
const CLOTH_COLORS = [
  [142, 198, 107], // 草绿
  [239, 108, 75],  // 砖红
  [213, 179, 81],  // 赭黄
  [215, 60, 90],   // 洋红
  [60, 200, 190],  // 青
  [167, 200, 95],  // 黄绿
  [108, 140, 220], // 蓝
  [160, 110, 210], // 紫
];

/** 徽记：图鉴里是白色剪影（兔、树、骷髅、塔、猪……）。这里用同样的"极简剪影"语言。 */
const GLYPHS = ['rabbit', 'tree', 'skull', 'tower', 'beast', 'sun'];

/**
 * 画一张"色布 + 白徽记"的小贴图。
 *
 * 为什么要烘成贴图而不是顶点色：参考片里徽记是**硬边剪影**，且随机分布在布面中段；
 * 顶点色做不到图案。32×16 足够 —— 远处每面旗只有十几个像素，再大就是浪费。
 */
function makeClothTexture(rgb, glyphIdx, notch) {
  const w = 64, h = 32;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  g.fillRect(0, 0, w, h);

  // 布面极淡的竖向折痕：图鉴里每面旗都有一条，不加会像塑料片
  g.fillStyle = 'rgba(0,0,0,0.07)';
  g.fillRect(w * 0.52, 0, 1, h);
  g.fillStyle = 'rgba(255,255,255,0.07)';
  g.fillRect(w * 0.53, 0, 1, h);

  // 白徽记：画在靠杆那一半（参考片里图案都在近杆端，尾部留空）
  g.fillStyle = '#f7f7f2';
  // 半径按**旗面高度的 40%** 给：图鉴里徽记几乎顶到上下边，8px 半径
  // （h*0.26）在 900px 画面里就是一团白糊。位置也往杆那边挪到 0.30w，
  // 因为尾部要留给燕尾缺口。
  const cx = w * 0.30, cy = h * 0.5, r = h * 0.40;
  const kind = GLYPHS[glyphIdx % GLYPHS.length];
  g.beginPath();
  if (kind === 'rabbit') {
    // 身体 + 两只长耳
    g.ellipse(cx, cy + r * 0.25, r * 0.62, r * 0.72, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(cx - r * 0.28, cy - r * 0.75, r * 0.16, r * 0.62, -0.25, 0, Math.PI * 2);
    g.ellipse(cx + r * 0.22, cy - r * 0.72, r * 0.15, r * 0.58, 0.2, 0, Math.PI * 2);
    g.fill();
  } else if (kind === 'tree') {
    g.moveTo(cx, cy - r);
    g.lineTo(cx + r * 0.5, cy + r * 0.1);
    g.lineTo(cx + r * 0.18, cy + r * 0.1);
    g.lineTo(cx + r * 0.58, cy + r * 0.9);
    g.lineTo(cx - r * 0.58, cy + r * 0.9);
    g.lineTo(cx - r * 0.18, cy + r * 0.1);
    g.lineTo(cx - r * 0.5, cy + r * 0.1);
    g.closePath(); g.fill();
  } else if (kind === 'skull') {
    g.ellipse(cx, cy - r * 0.1, r * 0.6, r * 0.62, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(cx - r * 0.3, cy + r * 0.4, r * 0.6, r * 0.42);
  } else if (kind === 'tower') {
    g.fillRect(cx - r * 0.34, cy - r * 0.6, r * 0.68, r * 1.5);
    g.fillRect(cx - r * 0.52, cy - r * 1.05, r * 0.24, r * 0.5);
    g.fillRect(cx + r * 0.28, cy - r * 1.05, r * 0.24, r * 0.5);
    g.fill();
  } else if (kind === 'beast') {
    g.ellipse(cx, cy + r * 0.15, r * 0.7, r * 0.45, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(cx - r * 0.5, cy + r * 0.3, r * 0.16, r * 0.55);
    g.fillRect(cx + r * 0.34, cy + r * 0.3, r * 0.16, r * 0.55);
    g.fillRect(cx - r * 0.75, cy - r * 0.35, r * 0.3, r * 0.16); // 尾巴
  } else {
    g.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
    g.fill();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      g.beginPath();
      g.arc(cx + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r * 0.85, r * 0.1, 0, Math.PI * 2);
      g.fill();
    }
  }

  // 两三个小点：图鉴里几乎每面旗都带，用来打散大面积色块
  g.beginPath();
  g.arc(w * 0.60, h * 0.30, 1.8, 0, Math.PI * 2);
  g.arc(w * 0.60, h * 0.70, 1.8, 0, Math.PI * 2);
  g.fill();

  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * @param {object} opts
 *   town/grid/houses  用来挑旗杆位置（屋顶优先）
 *   wind              src/wind.js 的场
 *   count             旗子数量
 *   groundAt          (cell) => 世界 y（没有就用 top*0.42）
 */
export function createFlags({
  town, grid, houses = [], wind, count = 6, seed = 3,
  groundAt = null, poleHeight = 1.05, clothW = 0.62, clothH = 0.34, levelHeight = LEVEL,
} = {}) {
  let s = (seed | 0) || 1;
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) | 0; return ((s >>> 8) & 0xffff) / 0xffff; };

  // 旗杆位置：屋顶优先，其次高台；太挤就跳过（和 props.js 同一个思路）
  const spots = [];
  for (const h of houses) if (h.cell) spots.push({ cell: h.cell, roof: true });
  if (spots.length < count) {
    const tall = grid.cells.filter((c) => town.top(c) >= 3).sort((a, b) => town.top(b) - town.top(a));
    for (const c of tall) {
      if (spots.length >= count * 2) break;
      if (spots.some((p) => (p.cell.cx - c.cx) ** 2 + (p.cell.cz - c.cz) ** 2 < 1.4)) continue;
      spots.push({ cell: c, roof: false });
    }
  }
  const chosen = spots.slice(0, count);

  // 参考片里旗杆是**细白矛杆**（比人高很多、几乎不显眼），不是棕色木杆；
  // 半径也从 0.016 收到 0.011 —— 之前 7 面旗有 7 根粗棒，比旗还抢眼。
  const poleGeo = new THREE.CylinderGeometry(0.008, 0.011, 1, 5, 1);
  poleGeo.translate(0, 0.5, 0);
  const poleMat = new THREE.MeshLambertMaterial({ color: '#cfd4cc' });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, Math.max(1, chosen.length));
  poles.frustumCulled = false;
  poles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  // 13×7 而不是 9×5：燕尾缺口靠"把越界的列**夹到缺口边界**"实现，
  // 列越少，那条 V 边就越像锯齿（第一版 9 列时尾部是一道斜梯）。
  const NU = 13, NV = 7;
  const clothMats = [];
  const clothTexes = [];

  const flags = chosen.map((spot, i) => {
    const { cell, roof } = spot;
    const baseY = groundAt ? groundAt(cell) : town.top(cell) * levelHeight;
    const topY = baseY + (roof ? 0.66 : 0.10) + poleHeight * (0.8 + rnd() * 0.4);
    const g = new THREE.BufferGeometry();
    const verts = new Float32Array(NU * NV * 3);
    const uvs = new Float32Array(NU * NV * 2);
    for (let v = 0; v < NV; v++) {
      for (let u = 0; u < NU; u++) {
        const k = (v * NU + u) * 2;
        uvs[k] = u / (NU - 1);
        uvs[k + 1] = 1 - v / (NV - 1);
      }
    }
    g.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    const idx = [];
    for (let v = 0; v < NV - 1; v++) {
      for (let u = 0; u < NU - 1; u++) {
        const a = v * NU + u, b = a + 1, c = a + NU, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    g.setIndex(idx);
    g.computeVertexNormals();

    const color = CLOTH_COLORS[(i * 5 + 1) % CLOTH_COLORS.length];
    const tex = makeClothTexture(color, i, 0);
    const mat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide });
    clothTexes.push(tex);
    clothMats.push(mat);
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false;
    mesh.userData.overlayOnly = true;

    return {
      cell, topY,
      baseY,
      mesh,
      verts,
      // 燕尾：`prongs` = 3 表示剪两刀成三尖（图鉴里也有这种），否则两尖
      prongs: rnd() < 0.34 ? 3 : 2,
      notch: 0.34 + rnd() * 0.12,
      phase: rnd() * Math.PI * 2,
      curve: null,
      retrace: rnd() * 0.12,
    };
  });

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const pos = new THREE.Vector3();

  function retraceFlag(f, t) {
    const gy = f.baseY;
    // 虚拟风粒子：从杆顶出发，被风吹一会儿 —— 轨迹就是布面的"上边缘"
    const pts = wind.trace(f.cell.cx, f.topY, f.cell.cz, { steps: 9, dt: 0.085, groundY: gy });
    // 让轨迹末端稍微回卷（旗子不是硬纸片），并把时间写成相位
    const tail = pts[pts.length - 1];
    const back = [tail[0] - (tail[0] - f.cell.cx) * 0.06, tail[1] + Math.sin(t * 1.7 + f.phase) * 0.02, tail[2] - (tail[2] - f.cell.cz) * 0.06];
    f.curve = pts.concat([back]);
  }

  return {
    group: (() => {
      const g = new THREE.Group();
      g.add(poles);
      for (const f of flags) g.add(f.mesh);
      return g;
    })(),
    update(dt, t) {
      // 杆子
      flags.forEach((f, i) => {
        pos.set(f.cell.cx, f.baseY, f.cell.cz);
        sc.set(1, Math.max(0.3, f.topY - f.baseY), 1);
        q.identity();
        m.compose(pos, q, sc);
        poles.setMatrixAt(i, m);
      });
      poles.count = flags.length;
      poles.instanceMatrix.needsUpdate = true;

      for (const f of flags) {
        f.retrace -= dt;
        if (!f.curve || f.retrace <= 0) { retraceFlag(f, t); f.retrace = 0.09; }
        // 布面 = 沿曲线"向下扫"出来的一条带子：
        //   位置(u,v) = curve(u) − 竖直下垂(v) + 横向涟漪(u,v)
        // 横向用**曲线的水平法向**，所以旗面永远贴在风的走向上，不会自己扭。
        for (let v = 0; v < NV; v++) {
          const dv = v / (NV - 1);
          // 燕尾边界：末端能伸到多远，取决于这一行的 v。
          //   prongs=2 → 上下两个角伸满、正中缩进（一个 V 缺口）
          //   prongs=3 → 上/中/下三个角伸满、两处缩进（两刀三尖）
          // 图鉴里两种都有；量到的缺口深度 0.34~0.46 倍旗长。
          const wave = Math.abs(Math.cos((f.prongs - 1) * Math.PI * dv));
          const uMax = 1 - f.notch * (1 - wave);
          for (let u = 0; u < NU; u++) {
            const du = Math.min(u / (NU - 1), uMax);
            const c = sampleCurve(f.curve, du);
            const c2 = sampleCurve(f.curve, Math.min(1, du + 0.02));
            let tx = c2[0] - c[0], tz = c2[2] - c[2];
            const tl = Math.hypot(tx, tz) || 1;
            tx /= tl; tz /= tl;
            // 水平法向 = (tz, -tx)
            const ripple = Math.sin(t * 6.2 + du * 5.0 + f.phase) * 0.024 * du * (1 - dv * 0.35);
            // 离杆越远垂得越少：被风兜起来的那部分
            const droop = (1 - du * 0.55) * clothH * dv;
            const k = (v * NU + u) * 3;
            f.verts[k] = c[0] + tz * ripple;
            f.verts[k + 1] = c[1] - droop + Math.sin(t * 4.0 + du * 3.0 + f.phase) * 0.012 * du;
            f.verts[k + 2] = c[2] - tx * ripple;
          }
        }
        f.mesh.geometry.attributes.position.needsUpdate = true;
        f.mesh.geometry.computeVertexNormals();
      }
    },
    stats() {
      return {
        count: flags.length,
        heights: flags.map((f) => +(f.topY).toFixed(2)),
        // 曲线末端相对杆顶的水平偏移 = "被吹了多远"，用来确认风场真的在起作用
        // 旗面宽高比（参考片 2.2~2.5:1）与燕尾缺口深度
        aspect: +(clothW / clothH).toFixed(2),
        prongs: flags.map((f) => f.prongs),
        notch: flags.map((f) => +f.notch.toFixed(2)),
        lengths: flags.map((f) => {
          if (!f.curve) return 0;
          const e = f.curve[f.curve.length - 1];
          return +Math.hypot(e[0] - f.cell.cx, e[2] - f.cell.cz).toFixed(3);
        }),
      };
    },
    dispose() {
      poleGeo.dispose(); poleMat.dispose();
      for (const m of clothMats) m.dispose();
      for (const t of clothTexes) t.dispose();
    },
  };
}
