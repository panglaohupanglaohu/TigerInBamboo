/**
 * shrubcard.js — 灌木卡片加一个"中心锚点"：不该是平板的两片，而是往前折的四片。
 *
 * 帖子 ID：1191990107785572352（2019-11-06，life）
 *   "Ah, the timeless problem of shrubbery that look good from all angles without too
 *    much overdraw. Adding an anchored center vert to the billboards makes them a bit
 *    less flat and gives them directionality without messing with the rotation"
 *
 * ---- 画面观察（tmp/cap/1191990107785572352/f01，512²，灰底单栋绿房子） ----
 *   · 房子四周一圈矮灌木，全是**卡片**（不是实体），颜色从墨绿到草绿分几档；
 *   · 每丛的**边缘能看出厚度**：靠外的那片比靠里的亮，叶团有一点点"朝外鼓"的感觉；
 *   · 卡片的旋转没被改动过（还是面向相机的 billboard），变的是**卡片自己不是平的**。
 *   这正是原文最后半句 "without messing with the rotation"：方向感来自顶点，不来自朝向。
 *
 * ---- 机制 ----
 *   普通 billboard：4 顶点 2 三角，整片共面；侧看时宽度 = w·|cosθ| → 到 90° 归零，
 *   于是那丛灌木在正侧面"消失成一条线"，这就是"flat"。
 *   加一个中心锚点（朝相机方向推出 depth），4 顶点变 5 顶点、2 三角变 4 三角，
 *   两个半片各自倾斜 → 法线夹角 φ > 0 → 一左一右明暗不同（方向性），
 *   而侧看到的宽度不再归零（最小 = depth）。
 *
 *   实测（depth=0.28）：三角 2→4、顶点 4→5、侧看最小宽度 0.000→0.280、
 *   半片法线夹角 0°→58.5°、两半片亮度差 0→0.198（约 18%）。开销只多 2 个三角，
 *   比"再交叉一张卡片"（三角 +100%）省，这正是 "without too much overdraw"。
 */

/** 卡片四个角 +（可选）中心锚点，yaw 单位弧度，depth 为锚点朝相机推出的量 */
export function cardFrame(yaw = 0, depth = 0.28, w = 1, h = 1) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const proj = (x, y, z) => ({ x: x * c + z * s, y: -y });
  const tl = proj(-w / 2, h / 2, 0);
  const tr = proj(w / 2, h / 2, 0);
  const br = proj(w / 2, -h / 2, 0);
  const bl = proj(-w / 2, -h / 2, 0);
  const anchor = proj(0, 0, depth);
  return {
    yaw,
    depth,
    flat: [tl, tr, br, bl],
    // 锚点把四边形拆成两个梯形半片（各 2 三角）
    left: [tl, bl, anchor],
    right: [tr, br, anchor],
    anchor,
    width: Math.max(tl.x, tr.x, bl.x, br.x, anchor.x) - Math.min(tl.x, tr.x, bl.x, br.x, anchor.x),
  };
}

/** 半片法线（3D，卡片在 z=0 平面上，锚点推出到 z=depth） */
export function halfNormals(depth = 0.28, w = 1, h = 1) {
  const n = (a, b, c) => {
    const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const v = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    const r = { x: u.y * v.z - u.z * v.y, y: u.z * v.x - u.x * v.z, z: u.x * v.y - u.y * v.x };
    const L = Math.hypot(r.x, r.y, r.z) || 1;
    return { x: r.x / L, y: r.y / L, z: r.z / L };
  };
  const L = [
    { x: -w / 2, y: h / 2, z: 0 },
    { x: -w / 2, y: -h / 2, z: 0 },
    { x: 0, y: 0, z: depth },
  ];
  const R = [
    { x: w / 2, y: h / 2, z: 0 },
    { x: w / 2, y: -h / 2, z: 0 },
    { x: 0, y: 0, z: depth },
  ];
  const nl = n(L[0], L[1], L[2]);
  const nr = n(R[0], R[2], R[1]); // 反向绕序，让两片法线朝同一侧（朝相机）
  return { left: nl, right: nr };
}

/** 两半片法线夹角（度） */
export function foldAngle(depth = 0.28, w = 1, h = 1) {
  const { left, right } = halfNormals(depth, w, h);
  const d = left.x * right.x + left.y * right.y + left.z * right.z;
  return (Math.acos(Math.max(-1, Math.min(1, d))) * 180) / Math.PI;
}

/** 一个半片相对光照方向的亮度（0..1），用来量"方向性" */
export function shadeOf(n, light = { x: 0.45, y: 0.35, z: 0.82 }) {
  const L = Math.hypot(light.x, light.y, light.z);
  const d = (n.x * light.x + n.y * light.y + n.z * light.z) / L;
  return 0.55 + 0.45 * Math.max(0, d);
}

/** 扫一遍 yaw，返回每个角度的投影像宽度与两半片明暗 */
export function sweep(depth = 0.28, steps = 9) {
  const out = [];
  for (let i = 0; i < steps; i++) {
    const yaw = (i / (steps - 1)) * (Math.PI / 2);
    const f = cardFrame(yaw, depth);
    const { left, right } = halfNormals(depth);
    const sl = shadeOf(left), sr = shadeOf(right);
    out.push({
      yaw: (yaw * 180) / Math.PI,
      width: f.width,
      shadeL: sl,
      shadeR: sr,
      contrast: Math.abs(sl - sr),
    });
  }
  return out;
}

/** 汇总：平面卡片 vs 中心锚点卡片 */
export function compareCard(depth = 0.28) {
  const flat = sweep(0, 9); // depth 0 → 另一半在同一平面
  const flatSweep = [];
  for (let i = 0; i < 9; i++) {
    const yaw = (i / 8) * (Math.PI / 2);
    const f = cardFrame(yaw, 0);
    flatSweep.push({ yaw: (yaw * 180) / Math.PI, width: f.width, contrast: 0 });
  }
  const anch = sweep(depth, 9);
  const minW = (a) => Math.min(...a.map((v) => v.width));
  return {
    flat: { minWidth: minW(flatSweep), tris: 2, verts: 4, fold: 0, contrast: 0, sweep: flatSweep },
    anchored: {
      minWidth: minW(anch),
      tris: 4,
      verts: 5,
      fold: foldAngle(depth),
      contrast: Math.max(...anch.map((v) => v.contrast)),
      sweep: anch,
    },
    depth,
  };
}
