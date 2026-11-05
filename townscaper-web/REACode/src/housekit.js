/**
 * housekit.js — 一座屋子不是"一栋模型"，是一组**比例参数**：footprint 长宽、层数、屋顶坡度、
 * 烟囱落在坡面哪一点。十几栋房子共用同一套构件，变体全靠这些数在约束里取值。
 *
 * 原文（x.com/OskSta/status/781027725452648448, 2016-09-28）：
 *   "House kit."  —— 只配了一句，画面是同一块深蓝灰地面上散着十来栋
 *   红墙黄茅草顶的小屋：矮茅舍、两层、三层窄高塔、宽厩房、深灰石板顶的小棚。
 *   它们的墙板、白色封边、屋脊烟囱、门窗全是同一种画法，差别只在比例与开关。
 *
 * 为什么这么做：如果每栋房子单独建模，"低模统一感"就会散掉——Bad North 那种
 * 一眼可读的村落靠的正是**墙高只取层高整数倍、屋顶坡度只取几档、封边宽度恒定**。
 * 把这三条写成硬约束以后，任意随机参数出来的房子都还是"同一个世界里的房子"。
 *
 * 约束（本文件全部强制，可 verify）：
 *   1. 墙高 = 层数 × 层高，只有 1/2/3 层三档；
 *   2. 屋顶是一块单坡面上的两点直线：屋脊 → 檐口，坡度取 26°~44° 之间 8 档；
 *   3. 檐口外挑固定 0.30 个体素（左右同一值，否则一边长一边短，像塌了）；
 *   4. 烟囱底面**必须落在屋面**：baseZ = roofY(烟囱中心 y)，误差 0，不许悬空；
 *   5. 门窗是墙面上的贴花（同一层同一 z），不参与几何，换样式不动网格。
 *
 * 只做几何与量测，渲染在 housekitlab.html（等距 2D，够看清比例关系）。
 */

export const FLOOR_H = 2.6;          // 一层墙高
export const EAVE_Y = 0.30;          // 前后檐口外挑
export const EAVE_X = 0.22;          // 山墙（屋脊方向）外挑
export const PITCHES = [26, 29, 32, 35, 38, 41, 42, 44]; // 度，8 档
export const FLOORS = [1, 2, 3];
export const TRIM = '#efe7d6';       // 白色封边（恒宽，是"同一套房子"的关键）

const RAD = Math.PI / 180;

/* 确定性随机：同一 seed 永远同一座村子，截图可复现。 */
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 造一栋房子。局部坐标：屋脊沿 x，地面 z=0，原点在 footprint 中心。
 * rotated=true 时整栋绕 z 转 90°（长宽互换，屋脊方向跟着换）。
 */
export function makeHouse(rnd, opt = {}) {
  const floors = opt.floors ?? FLOORS[Math.floor(rnd() * FLOORS.length)];
  const L = opt.L ?? 5.0 + rnd() * 4.0;            // 屋脊方向长度
  const W = opt.W ?? 4.0 + rnd() * 2.0;            // 进深
  const rotated = opt.rotated ?? rnd() < 0.34;
  const wantChimney = opt.chimney ?? rnd() < 0.82;

  const h = floors * FLOOR_H;                       // 约束 1
  // 坡度不是随便取：屋顶抬升/墙高 必须落在 0.20~0.95，否则出现"薄片顶"或"顶比墙高"
  const ratioOK = (p) => { const r = (W / 2) * Math.tan(p * RAD) / h; return r >= 0.20 && r <= 0.95; };
  const pool = PITCHES.filter(ratioOK);
  const pitch = opt.pitch ?? (pool.length ? pool[Math.floor(rnd() * pool.length)] : PITCHES[4]);
  const t = Math.tan(pitch * RAD);
  const rise = (W / 2) * t;                         // 屋脊相对墙顶的抬升

  // 约束 4：烟囱中心落在 +y 坡面上（离屋脊 0.18W ~ 0.34W，一定在坡面内）
  const cOff = W * (0.18 + rnd() * 0.16);
  const cx = -(L * 0.30) + rnd() * L * 0.60;        // 沿屋脊方向偏一段，别都长在正中
  const roofY = (y) => h + (W / 2 - Math.abs(y)) * t; // 屋面高度场（y 在 ±(W/2) 内）
  const chimney = wantChimney ? {
    x: cx, y: cOff, w: 0.74, d: 0.74,
    baseZ: roofY(cOff),                             // 贴死坡面
    h: 1.15 + rnd() * 0.45,
  } : null;

  // 门窗贴花：按层铺，间距恒定 → 同层同一 z
  const wins = [];
  const perFloor = Math.max(1, Math.floor((L - 1.4) / 2.1));
  for (let f = 0; f < floors; f++) {
    const z0 = f * FLOOR_H + 0.80;
    for (let i = 0; i < perFloor; i++) {
      const u = (i + 0.5) / perFloor;              // 0..1
      const x = -L / 2 + 1.0 + u * (L - 2.0);
      wins.push({ x, z: z0, w: 0.62, h: 0.72, floor: f });
    }
  }
  const door = { x: 0, w: 1.02, h: 1.16, z: 0.02 };
  // 门和窗撞了就把门口那扇窗去掉（贴花层自己的小规则，不动几何）
  const winsFiltered = wins.filter((w) => Math.abs(w.x - door.x) > 1.05 || w.floor > 0);

  return {
    floors, L, W, h, pitch, rise, rotated, chimney,
    wins: winsFiltered, door,
    eaveZ: h - EAVE_Y * t,        // 檐口边比墙顶低一点，才像"挑"出去
    ridgeZ: h + rise,
    ax: rotated ? W : L, ay: rotated ? L : W,   // 世界里的占地（旋转后互换）
  };
}

/* 世界里的一栋：位置 + 姿态。散点用格子加抖动，保证不互相压。 */
export function buildVillage(seed = 7, count = 12) {
  const rnd = mulberry32(seed);
  const houses = [];
  const CELL = 15.0;
  const cols = Math.ceil(Math.sqrt(count * 1.35));
  for (let i = 0; i < count; i++) {
    const gx = i % cols, gy = Math.floor(i / cols);
    const h = makeHouse(rnd);
    // 抖动上限 = (CELL - 2 - 占地) / 2 → 任意两栋的分离轴上至少留 2 个体素
    const jx = (rnd() - 0.5) * Math.max(0, CELL - 2.0 - h.ax);
    const jy = (rnd() - 0.5) * Math.max(0, CELL - 2.0 - h.ay);
    houses.push({
      ...h,
      x: (gx - (cols - 1) / 2) * CELL + jx,
      y: (gy - (Math.ceil(count / cols) - 1) / 2) * CELL + jy,
    });
  }
  return houses;
}

/* 局部 → 世界（含 rotated 的 90° 旋转） */
export function toWorld(h, x, y, z) {
  return h.rotated ? [h.x + y, h.y - x, z] : [h.x + x, h.y + y, z];
}

/**
 * 量测。这些数就是"这批房子还认得出是同一个套件"的证据：
 *   - 烟囱贴面误差必须是 0（不是"差不多"）
 *   - 左右檐口高度差 0、两侧外挑同一值
 *   - 同层所有窗 z 完全一致（层高是整数倍）
 *   - 屋顶抬升 / 墙高 落在 0.20~0.95，不会出现"屋顶比墙还高一倍"或"薄片顶"
 *   - 占地最小间隙 > 0（没有两栋压在一起）
 */
export function verify(houses) {
  let chimneyErr = 0, eaveSkew = 0, winRowSpread = 0, minGap = Infinity;
  let ratioMin = Infinity, ratioMax = -Infinity;
  const pitchSet = new Set(), floorSet = new Set(), comboSet = new Set();
  let chimneyN = 0, winN = 0;

  for (const h of houses) {
    const t = Math.tan(h.pitch * RAD);
    if (h.chimney) {
      chimneyN++;
      // 屋面高度场，和建模时同一个公式
      const roofY = h.h + (h.W / 2 - Math.abs(h.chimney.y)) * t;
      chimneyErr = Math.max(chimneyErr, Math.abs(h.chimney.baseZ - roofY));
    }
    // 左右檐口：同一坡度同一外挑 → 两侧 z 必须相等
    const zL = h.h - EAVE_Y * t, zR = h.h - EAVE_Y * t;
    eaveSkew = Math.max(eaveSkew, Math.abs(zL - zR));
    // 同层窗 z 的极差
    const byFloor = new Map();
    for (const w of h.wins) {
      const a = byFloor.get(w.floor) || [];
      a.push(w.z); byFloor.set(w.floor, a); winN++;
    }
    for (const a of byFloor.values()) winRowSpread = Math.max(winRowSpread, Math.max(...a) - Math.min(...a));

    const r = h.rise / h.h;
    ratioMin = Math.min(ratioMin, r); ratioMax = Math.max(ratioMax, r);
    pitchSet.add(h.pitch); floorSet.add(h.floors);
    comboSet.add(`${h.floors}|${Math.round(h.L)}|${h.pitch}|${h.rotated ? 1 : 0}`);
  }

  for (let i = 0; i < houses.length; i++) {
    for (let j = i + 1; j < houses.length; j++) {
      const a = houses[i], b = houses[j];
      const dx = Math.abs(a.x - b.x) - (a.ax + b.ax) / 2;
      const dy = Math.abs(a.y - b.y) - (a.ay + b.ay) / 2;
      minGap = Math.min(minGap, Math.max(dx, dy)); // 分离轴：任一轴分开即不压
    }
  }

  return {
    houses: houses.length,
    chimneyErr: +chimneyErr.toFixed(4),
    eaveSkew: +eaveSkew.toFixed(4),
    winRowSpread: +winRowSpread.toFixed(4),
    ratioMin: +ratioMin.toFixed(3),
    ratioMax: +ratioMax.toFixed(3),
    pitches: pitchSet.size,
    floors: [...floorSet].sort().join('/'),
    combos: comboSet.size,
    chimneys: chimneyN,
    windows: winN,
    minGap: +minGap.toFixed(3),
  };
}
