/**
 * textureslots.js — 一张图集 + 命名槽位：换贴图只换像素，不动几何
 *
 * ── 原文 ─────────────────────────────────────────────────────────────────
 *   1430227487376781317（2021-08-24）：
 *     "Plus you can change the in-game textures now! So I guess the game is now
 *      (in the most liberal use of the word) 'moddable'"
 *
 *   原文没给参数，只给了一个**能力**：贴图可以在游戏里换。所以这条要落地的不是美术，
 *   是"换的时候不许动别的"这条不变量。
 *
 * ── 帧实测（512²，f030 的编辑器窗口是唯一的直接证据）────────────────────
 *   f030 右侧浮着一个像素编辑器窗口，里面是**一张图集**（不是一张贴图）：
 *     · 木纹横板、砖行、带绿/红框的窗、石灰墙、深灰块、草……各自成小块排在一张图上；
 *     · 画面里有人正在图集上用**大号蓝色笔刷**涂（f030 左上角那道蓝弧）；
 *     · 涂完回到游戏（f070），墙面的整体色相从暖白/木色变成**蓝底 + 深蓝斑块**，
 *       而岛的**轮廓、描边宽度、窗洞位置全都没变**。
 *   → 结论：贴图是**外部文件里的一张图集**，游戏按槽位去图集上取子矩形。
 *     换贴图 = 换这张图的像素；UV 与几何完全不变（否则轮廓一定会动）。
 *   图集格子尺寸：编辑窗口里单块约 96px，窗口按 3× 缩略 → 实机单块约 32px（**估计值**，
 *     原片没有可读的像素标尺）。槽位间距一致，没有 padding/edge bleed。
 *   换贴图前后**墙面之外**的颜色分布几乎不变（f000 蓝带 131092 px vs f070 199581 px，
 *     差的是墙那一片），说明他改的是"墙"这一个槽，不是整套。
 *
 * ── 为什么这样写 ────────────────────────────────────────────────────────
 *   ① **槽位是一块矩形 + 一个平铺尺度**，不是"一个材质对象"。换图集时只重取 pattern，
 *      几何/UV 一律不碰 —— 这才是"liberal use of moddable"和真正的资源热重载的分界线。
 *   ② **必须能证明"没重建"。** 所以模块自己数 `geometryBuilds`：换贴图前 1、换贴图后还是 1。
 *      没有这个计数器，"没重建"就只是我说的一句话。
 *   ③ **槽位要能单独认出被改的范围。** 反测里把"只有墙槽覆盖的像素变了"当成断言：
 *      其余像素差必须 ≈ 0。只报"整画面差了 3%"是测不出有没有误伤的。
 */

export const SLOTS = ['stone', 'plaster', 'roof', 'glass', 'wood', 'grass'];

/** 图集布局：一张 256×256，8 列 × 8 行，每格 32px。槽位 = 格坐标。 */
export const ATLAS = {
  size: 256,
  cell: 32,
  cols: 8,
  // [col,row] 只是"这块是什么"的登记，换图集时布局不变 → UV 不变
  rect: {
    stone: [0, 0],
    plaster: [1, 0],
    roof: [2, 0],
    glass: [3, 0],
    wood: [4, 0],
    grass: [5, 0],
  },
};

/** 默认图集：按"石/灰泥/屋瓦/玻璃/木/草"六格程序化画出来。 */
export function makeAtlas(kind = 'default', { size = ATLAS.size } = {}) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  const C = ATLAS.cell;
  g.fillStyle = '#3b3b3b';
  g.fillRect(0, 0, size, size);
  const put = (slot, fn) => {
    const [cx, cy] = ATLAS.rect[slot];
    g.save();
    g.translate(cx * C, cy * C);
    g.beginPath();
    g.rect(0, 0, C, C);
    g.clip();
    fn(g, C);
    g.restore();
  };
  const noise = (g, c, amp, n, seed = 7) => {
    let s = seed >>> 0;
    const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < n; i++) {
      const d = (rnd() * 2 - 1) * amp;
      g.fillStyle = `rgba(${c[0] + d},${c[1] + d},${c[2] + d},.55)`;
      g.fillRect(rnd() * C, rnd() * C, 1 + rnd() * 2, 1 + rnd() * 2);
    }
  };
  const mod = kind === 'mod';

  put('stone', (g, C) => {
    g.fillStyle = mod ? '#4a7ea0' : '#c9c4b6';
    g.fillRect(0, 0, C, C);
    // 横向砖缝：4 行，交错半格
    g.strokeStyle = mod ? 'rgba(28,60,86,.55)' : 'rgba(120,112,96,.55)';
    g.lineWidth = 1;
    for (let r = 1; r < 4; r++) {
      g.beginPath();
      g.moveTo(0, r * C / 4);
      g.lineTo(C, r * C / 4);
      g.stroke();
    }
    for (let r = 0; r < 4; r++) {
      const off = (r % 2) * C / 4;
      g.beginPath();
      g.moveTo(off + C / 4, r * C / 4);
      g.lineTo(off + C / 4, (r + 1) * C / 4);
      g.stroke();
    }
    noise(g, mod ? [74, 126, 160] : [201, 196, 182], 8, 160);
    if (mod) {
      // mod 版：叠深蓝斑块 —— 对应 f070 墙上那种"蓝底 + 深蓝团"
      let s = 991;
      const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
      for (let i = 0; i < 7; i++) {
        g.fillStyle = 'rgba(22,74,132,.72)';
        const x = rnd() * C, y = rnd() * C, w = 5 + rnd() * 11, h = 3 + rnd() * 6;
        g.beginPath();
        g.ellipse(x, y, w / 2, h / 2, rnd() * 3.14, 0, 6.283);
        g.fill();
      }
    }
  });
  put('plaster', (g, C) => {
    g.fillStyle = mod ? '#3f7290' : '#e8e3d6';
    g.fillRect(0, 0, C, C);
    noise(g, mod ? [63, 114, 144] : [232, 227, 214], 5, 220, 13);
  });
  put('roof', (g, C) => {
    // ⚠ roof/glass/wood/grass 两版必须**逐像素一致**：否则"只改了 stone+plaster"这个前提
    //   自己就被违反了，反测里"允许区之外的改动"永远降不到 0（第一版就差 0.50%，
    //   全落在屋顶上 —— 因为第一版顺手把 mod 的屋瓦颜色也改了）。
    g.fillStyle = '#c9752f';
    g.fillRect(0, 0, C, C);
    g.strokeStyle = 'rgba(90,40,20,.5)';
    for (let r = 1; r < 6; r++) {
      g.beginPath();
      g.moveTo(0, r * C / 6);
      g.lineTo(C, r * C / 6);
      g.stroke();
    }
    noise(g, [200, 120, 50], 12, 140, 31);
  });
  put('glass', (g, C) => {
    g.fillStyle = '#4c6f79';
    g.fillRect(0, 0, C, C);
    g.fillStyle = 'rgba(180,220,225,.28)';
    g.beginPath();
    g.moveTo(0, C * 0.7);
    g.lineTo(C * 0.7, 0);
    g.lineTo(C, 0);
    g.lineTo(0, C);
    g.closePath();
    g.fill();
  });
  put('wood', (g, C) => {
    g.fillStyle = '#9a6a3c';
    g.fillRect(0, 0, C, C);
    g.strokeStyle = 'rgba(60,36,18,.45)';
    for (let r = 1; r < 5; r++) {
      g.beginPath();
      g.moveTo(0, r * C / 5);
      g.lineTo(C, r * C / 5);
      g.stroke();
    }
    noise(g, [154, 106, 60], 10, 120, 47);
  });
  put('grass', (g, C) => {
    g.fillStyle = '#73734f';
    g.fillRect(0, 0, C, C);
    noise(g, [115, 115, 80], 13, 260, 59);
  });
  return cv;
}

/**
 * 槽位表：持有图集与"哪些槽被改过"的记录。
 * 换图集 = setAtlas()：只清 pattern 缓存 + bump version，**不碰几何**。
 */
export class TextureSlots {
  constructor(atlas) {
    this.atlas = atlas || null;
    this.patterns = new Map();
    this.version = 1;      // 建好几何时就算一次「已装载」
    // ⚠ pattern 缓存必须按"图集身份"分桶：第一版只按 slot+scale 缓存，
    //   于是 lab 里先画 A（默认图集）再画 B（mod 图集）时，B 全部命中了 A 的缓存，
    //   两张图一模一样、差异 0.00% —— 看着像"换贴图没生效"，其实是缓存串了。
    this._ids = new WeakMap();
    this._nextId = 1;
    this.geometryBuilds = 0;      // 只有 buildGeometry() 会加，用来证明换贴图没重建
    this.swaps = 0;
    this._dirtySlots = new Set();
  }
  setAtlas(atlas, { dirty = SLOTS } = {}) {
    this.atlas = atlas;
    this.patterns.clear();        // 只丢 pattern，UV/索引表一个都没动
    this.version++;
    this.swaps++;
    this._dirtySlots = new Set(dirty);
    return this.version;
  }
  buildGeometry() { this.geometryBuilds++; }
  idOf(atlas) {
    if (!atlas) return 0;
    if (!this._ids.has(atlas)) this._ids.set(atlas, this._nextId++);
    return this._ids.get(atlas);
  }
  /** 取槽位的平铺 pattern；scale 用于把 32px 的格子铺成需要的世界尺度 */
  pattern(ctx, slot, scale = 1, atlas = this.atlas) {
    const key = this.idOf(atlas) + ':' + slot + '@' + scale;
    if (this.patterns.has(key)) return this.patterns.get(key);
    const [cx, cy] = ATLAS.rect[slot] || [0, 0];
    const C = ATLAS.cell;
    const sub = document.createElement('canvas');
    sub.width = sub.height = C;
    sub.getContext('2d').drawImage(atlas, cx * C, cy * C, C, C, 0, 0, C, C);
    const p = ctx.createPattern(sub, 'repeat');
    if (p && p.setTransform) p.setTransform(new DOMMatrix([scale, 0, 0, scale, 0, 0]));
    this.patterns.set(key, p);
    return p;
  }
  /** 某个槽在这张图集里的平均色，用来做"只改了墙槽"的断言 */
  slotAvg(slot) {
    const [cx, cy] = ATLAS.rect[slot] || [0, 0];
    const C = ATLAS.cell;
    const c = document.createElement('canvas');
    c.width = c.height = C;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(this.atlas, cx * C, cy * C, C, C, 0, 0, C, C);
    const d = g.getImageData(0, 0, C, C).data;
    let r = 0, gg = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 4;
    return [Math.round(r / n), Math.round(gg / n), Math.round(b / n)];
  }
  get stats() {
    return { version: this.version, swaps: this.swaps, geometryBuilds: this.geometryBuilds };
  }
}
