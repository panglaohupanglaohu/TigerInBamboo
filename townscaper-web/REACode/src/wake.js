/**
 * wake.js — 尾迹不是贴在船后面的一条渐变带，是「船舷两个点按固定速度往外走」。
 *
 * 帖子 ID：901469409579061248（2017-08-26，water）
 *   "Working on nicer ship wakes"
 *
 * 画面实测（6 帧，512²，正俯视，浅灰绿色的浅水）：
 *   · 两条长船各拖一条**白色 V 形**尾迹，V 的张角目测 **左右各 ~20°**（合 40°），
 *     不是"跟着船走的一团雾"；
 *   · V 的两条边不是连续实线，是**断续的小段/斑点**，靠近船体处密集、亮，
 *     往后 2~3 个船长逐渐稀疏、变淡，最后散成单点；
 *   · V 内部（船正后方）是**较淡的一层**，比两条边暗 —— 边亮心淡，这是尾迹不像
 *     拖影的关键；
 *   · 船身两侧还有**小方块颗粒**（4~7 px 的实心白方块）飞出去，像被船头推开的水花，
 *     数量很少、寿命短，跟泡沫不是同一层；
 *   · 尾迹两端都从**船头略靠后**开始，不是从船尾开始 —— 发射点在船体最宽的舷侧。
 *
 * 为什么这么做：一条贴在船后的渐变带，转角时会像一块布被拽着走；而两个点以固定
 * 速度向外走，V 是**轨迹的几何后果**：沿速度 v∥、横向 v⊥ = v∥·tan(θ)，粒子走出的
 * 直线与航向夹角恒为 θ（阻力等比衰减不改变方向），船一拐，旧的 V 留在原地。
 *
 * 于是"张角"变成可以直接量出来的数：对所有横向偏移 > 4 px 的泡沫粒子取
 * atan(|横向| / 落后距离) 的中位数，应当收敛到 θ。
 */

const D2R = Math.PI / 180;

/** 开尔文尾迹的半张角（19.47°）。游戏里常用 18~25°，这里按画面取 20°。 */
export const KELVIN = 19.47;

export function rng(seed = 1) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Ship {
  constructor({ x = 0, y = 0, dir = 0, speed = 46, len = 54, beam = 15 } = {}) {
    this.x = x; this.y = y; this.dir = dir; this.speed = speed;
    this.len = len; this.beam = beam;
    this.acc = 0; this.accSpray = 0;
    this.travelled = 0;
  }
}

export class Wake {
  constructor(opts = {}) {
    this.angle = (opts.angle ?? KELVIN) * D2R;
    this.life = opts.life ?? 3.6;          // 泡沫寿命（秒）
    this.rate = opts.rate ?? 300;          // 每个发射点每秒泡沫数
    this.sprayRate = opts.sprayRate ?? 7;  // 每个发射点每秒水花数
    this.soft = opts.soft ?? 0;            // 0=粒子 V；1=一整块三角渐变（对照）
    this.rand = rng(opts.seed ?? 7);
    this.ships = [];
    this.foam = [];
    this.spray = [];
    this.time = 0;
    this.emitted = 0;
  }

  addShip(s) { this.ships.push(new Ship(s)); return this.ships[this.ships.length - 1]; }
  clear() { this.foam.length = 0; this.spray.length = 0; }

  /** 前进 + 发射。dt 以秒计，调用方负责 clamp。 */
  step(dt) {
    this.time += dt;
    const r = this.rand;
    for (const s of this.ships) {
      const c = Math.cos(s.dir), sn = Math.sin(s.dir);
      s.x += c * s.speed * dt;
      s.y += sn * s.speed * dt;
      s.travelled += s.speed * dt;

      // 每个舷侧一个发射点，都在船体最宽处略靠前
      s.acc += this.rate * dt * 2;
      while (s.acc >= 1) {
        s.acc -= 1;
        const roll = r();
        const side = roll < 0.32 ? 0 : (r() < 0.5 ? -1 : 1);
        this._emitFoam(s, c, sn, side, side);
      }
      s.accSpray += this.sprayRate * dt * 2;
      while (s.accSpray >= 1) {
        s.accSpray -= 1;
        const side = r() < 0.5 ? -1 : 1;
        this._emitSpray(s, c, sn, side);
      }
    }

    // 泡沫：匀速（等比衰减会让老粒子停在原地、V 的两条边卷成钩子）
    const drag = 1;
    const foam = this.foam;
    for (let i = foam.length - 1; i >= 0; i--) {
      const p = foam[i];
      p.age += dt;
      if (p.age >= p.life) { foam[i] = foam[foam.length - 1]; foam.pop(); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= drag; p.vy *= drag;
      p.size += p.grow * dt;
    }
    const spray = this.spray;
    for (let i = spray.length - 1; i >= 0; i--) {
      const p = spray[i];
      p.age += dt;
      if (p.age >= p.life) { spray[i] = spray[spray.length - 1]; spray.pop(); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.pow(0.12, dt); p.vy *= Math.pow(0.12, dt);
      p.rot += p.spin * dt;
    }
  }

  _emitFoam(s, c, sn, side, sideOverride) {
    const r = this.rand;
    const px = -sn, py = c;                       // 航向的右法线
    // 三分之一的粒子从船尾正中放出：V 的内部那层"淡雾"（画面里 V 中间比两条边淡）
    const veil = sideOverride === 0;
    // 发射点沿船长固定（原来是 0.30~0.44 随机）：随机会让两条边散成一族平行线
    const atBow = veil ? -s.len * 0.45 : s.len * 0.36;
    const along = s.speed * (veil ? 0.30 : 0.42);
    /* 张角是相对**航迹**的，不是相对泡沫自己的漂移速度：
       一条边的斜率 = v⊥ / (speed - v∥)，所以 v⊥ 要用 (speed - v∥) 乘 tanθ。
       一开始写成 v∥·tanθ，量出来是 30°（船跑得比泡沫快，把角压不回去）。 */
    const across = (s.speed - along) * Math.tan(this.angle) * (veil ? 0.12 : 1);
    const scatter = (r() - 0.5) * 3.2;   // 舷侧那一点点厚度，别散成多条线
    const x = s.x + c * (atBow + scatter) + px * side * s.beam * 0.5;
    const y = s.y + sn * (atBow + scatter) + py * side * s.beam * 0.5;
    const jitter = 0.045;
    this.foam.push({
      x: veil ? x + (r() - 0.5) * 16 : x,
      y: veil ? y + (r() - 0.5) * 16 : y,
      vx: c * along + px * side * across + (r() - 0.5) * across * jitter,
      vy: sn * along + py * side * across + (r() - 0.5) * across * jitter,
      age: 0,
      life: this.life * (0.72 + 0.56 * r()),
      size: (veil ? 4.4 : 2.1) + (veil ? 2.6 : 2.0) * r(),
      grow: (veil ? 1.5 : 0.9) + 0.5 * r(),
      shade: (veil ? 0.20 : 0.70) + (veil ? 0.10 : 0.30) * r(),
      soft: this.soft,
      veil,
      ship: s,
    });
    this.emitted++;
  }

  _emitSpray(s, c, sn, side) {
    const r = this.rand;
    const px = -sn, py = c;
    const atBow = s.len * (0.34 + 0.1 * r());
    const speed = s.speed * (0.5 + 0.5 * r());
    const outward = 0.35 + 0.5 * r();
    this.spray.push({
      x: s.x + c * atBow + px * side * s.beam * 0.55,
      y: s.y + sn * atBow + py * side * s.beam * 0.55,
      vx: c * speed * 0.5 + px * side * speed * outward,
      vy: sn * speed * 0.5 + py * side * speed * outward,
      age: 0,
      life: 0.45 + 0.7 * r(),
      w: 3.2 + 3.6 * r(),
      rot: r() * 6.283,
      spin: (r() - 0.5) * 3,
    });
  }

  /** 某个粒子的不透明度：年龄归一后按 1.7 次幂掉下来。 */
  static alphaOf(p, k = 1.7) {
    const t = p.age / p.life;
    return Math.pow(1 - t, k) * p.shade;
  }

  /**
   * 量三个数：实际张角 / 寿命内的衰减曲线 / 尾迹长度。
   * 张角只统计"横向偏移 > 4px、已经落后 > 6px"的粒子，避开船体正后方那堆还没散开的。
   */
  stats() {
    const foam = this.foam;
    const angles = [];
    const pts = [];   // [落后距离, 横向偏移] —— 用来拟合 V 那条边的斜率
    const buckets = [[0, 0.25, 0, 0], [0.25, 0.5, 0, 0], [0.5, 0.75, 0, 0], [0.75, 1.01, 0, 0]];
    let maxBack = 0;
    // 只拿粒子跟**放它出来的那条船**比，否则三条船的坐标系混在一起量出假角度
    for (const p of foam) {
      const s = p.ship;
      const c = Math.cos(s.dir), sn = Math.sin(s.dir);
      const dx = p.x - s.x, dy = p.y - s.y;
      const along = dx * c + dy * sn;
      const lat = Math.abs(-dx * sn + dy * c);
      // 船尾那层雾不是 V 的边：它的横向散布以 0 为中心，混进拟合会把斜率压到 0
      if (!p.veil && along < -20 && lat > 3) pts.push([-along, lat]);
      if (along < 0) maxBack = Math.max(maxBack, -along);
    }
    /* 用最小二乘拟合 lat = k·back，再取 atan(k)：
       逐粒子算 atan(lat/back) 会被船头附近那堆还没散开的粒子拉高（量出来 35°），
       因为 V 的顶点在船头，边线只在大距离上才收敛到 θ。 */
    let k = 0;
    if (pts.length > 8) {
      let sx = 0, sy = 0, sxx = 0, sxy = 0;
      for (const [bx, ly] of pts) { sx += bx; sy += ly; sxx += bx * bx; sxy += bx * ly; }
      const n = pts.length;
      const den = n * sxx - sx * sx;
      k = den !== 0 ? (n * sxy - sx * sy) / den : 0;
    }
    const med = Math.atan(Math.max(0, k)) / D2R;
    for (const p of foam) {
      const t = p.age / p.life;
      for (const b of buckets) {
        if (t >= b[0] && t < b[1]) { b[2] += Wake.alphaOf(p); b[3]++; break; }
      }
    }
    return {
      foam: foam.length,
      spray: this.spray.length,
      emitted: this.emitted,
      angleDeg: med,
      angleSamples: pts.length,
      decay: buckets.map((b) => (b[3] ? b[2] / b[3] : 0)),
      length: maxBack,
      targetDeg: this.angle / D2R,
    };
  }
}
