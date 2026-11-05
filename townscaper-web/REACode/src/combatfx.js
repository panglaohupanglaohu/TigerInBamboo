/**
 * combatfx.js — Bad North 战斗层：击退出崖 / 长矛突刺 / 血贴花附着 / 血浸透当血量 / 血腥开关
 *
 * 全部来自 2026-11-03 那批 fx 帖子的原文，不是凭印象编的：
 *
 * [870296307889573889] "Units can now get knocked off ledges"
 *   关键不是「加个冲量」，而是冲量把单位推到格子外时，脚下高度掉了不止一格，
 *   单位必须从 WALK 切到 AIRBORNE，之后由重力接管、翻滚、落地或落水。
 *   视频里能看到的：被打的兵沿崖边缘平移出去，然后开始转着往下掉。
 *
 * [903647529203634176] "Spears are so weird to implement. I can see why most games don't use them"
 *   矛不是飞行物，是一根在突刺窗口内一直存在于世界里的线段。命中判定 = 点到线段距离，
 *   判一次就记进 hitSet（否则 12 帧的突刺窗口会打出 12 次伤害），
 *   而且命中后目标被「顶着走」而不是被弹开——这就是它和箭手感不同的地方。
 *
 * [946660607008403456] "making blood, corpses and arrows stick to boats"
 *   贴花必须记在载具的局部坐标系里，不是世界坐标。船一开走，世界坐标的贴花会留在原地。
 *   局部锚点 + 船体变换 = 血/尸体/箭跟着船走。
 *
 * [984813819280191488] "Blood soaking as a health indicator for the big fellas
 *                       and a proper stun state for the little ones"
 *   大兵种：soak 0→1 驱动颜色变深 + 贴花半径变大（没有血条）。
 *   小兵种：不靠 soak，靠 stun 状态（头顶星环 + 摇晃），因为小兵血量太小看不出来。
 *
 * [995043346778415104] "The pathfinding in some levels does get a bit convoluted"
 *   底下 buildFactionField 的 parent 指针回溯出来，就是那条看着很绕的路径。
 *   路径绕并不代表寻路错了：BFS 继承树在窄脊上本来就只能贴着墙走，
 *   把它画出来才能区分「路难走」和「路算错」。
 *
 * [999191760944418817] "Adding the option of disabling gore made me realized just how much
 *                       I rely on blood for environmental storytelling"
 *   关血腥只关表现（贴花、粒子、尸体），不关状态机。所以关掉之后战场看起来像没打过。
 */

/* ───────────────────────── 单位状态机 ───────────────────────── */

export const ST = {
  WALK: 'walk',
  AIR: 'air',      // 被击退离地，还在上升/平移
  FALL: 'fall',    // 脚下没有落脚点，重力接管
  LAND: 'land',    // 落地缓冲，短暂硬直
  STUN: 'stun',    // 小兵种专用
  DROWN: 'drown',  // 掉水里
  DEAD: 'dead',
};

/**
 * @param {object} o
 * @param {number} o.x @param {number} o.z  网格图上的位置（格为单位）
 * @param {'big'|'small'} o.kind  大兵种用 soak 表达血量，小兵种用 stun
 */
export function makeUnit(o) {
  return {
    x: o.x, y: 0, z: o.z,
    vx: 0, vy: 0, vz: 0,
    kind: o.kind || 'small',
    hp: o.hp ?? 1,
    soak: 0,          // 0..1，只有 big 用
    state: ST.WALK,
    stateT: 0,
    spin: 0,          // 掉落时的翻滚角速度
    hitThisThrust: -1,
    stunT: 0,
  };
}

/** 格子高度查询：world 是 { heightAt(x,z) -> number, walkable(x,z) -> bool }，高度单位=格 */
const MAX_STEP = 0.55;   // 一步能迈上去的高度；超过就是崖

export function knockback(u, dirX, dirZ, power) {
  const l = Math.hypot(dirX, dirZ) || 1;
  u.vx += (dirX / l) * power;
  u.vz += (dirZ / l) * power;
  if (u.state === ST.WALK || u.state === ST.STUN) {
    u.state = ST.AIR;
    u.stateT = 0;
    u.vy = 0.45 * power;      // 轻微上抛，让"离地"这件事看得见
    u.spin = (Math.random() - 0.5) * 9;
  }
}

/**
 * 每帧推进。dt 秒。
 * 返回本帧事件，供表现层用（滚地、落水、硬直）。
 */
export function stepUnits(units, world, dt) {
  const evts = [];
  for (const u of units) {
    if (u.state === ST.DEAD || u.state === ST.DROWN) continue;
    u.stateT += dt;

    if (u.state === ST.WALK || u.state === ST.LAND || u.state === ST.STUN) {
      // 地面上：摩擦吃掉残留速度
      u.vx *= Math.pow(0.001, dt);
      u.vz *= Math.pow(0.001, dt);
      u.x += u.vx * dt;
      u.z += u.vz * dt;
      const g = world.heightAt(u.x, u.z);
      if (!world.walkable(u.x, u.z)) {
        u.state = ST.FALL; u.stateT = 0; u.vy = 0; u.spin = 3;
        evts.push({ type: 'ledge', u });
      } else {
        u.y = g;
      }
      if (u.state === ST.LAND && u.stateT > 0.35) { u.state = ST.WALK; u.stateT = 0; }
      if (u.state === ST.STUN) {
        u.stunT -= dt;
        if (u.stunT <= 0) { u.state = ST.WALK; u.stateT = 0; }
      }
      continue;
    }

    if (u.state === ST.AIR || u.state === ST.FALL) {
      // 重力接管。AIR 是「还有落脚点」的短暂离地，FALL 是「脚下一片空」
      u.vy -= 9.8 * dt;
      u.x += u.vx * dt;
      u.z += u.vz * dt;
      u.y += u.vy * dt;
      u.spin *= Math.pow(0.6, dt);

      const ground = world.heightAt(u.x, u.z);
      const onLand = world.walkable(u.x, u.z);
      if (!onLand) {
        u.state = ST.FALL;
        // 掉到水面以下就结束，不用等到底
        if (u.y < world.waterY - 0.2) {
          u.state = ST.DROWN; u.stateT = 0;
          evts.push({ type: 'drown', u });
        }
      } else if (u.y <= ground) {
        // 落地：落差越大硬直越长，这是"被推下崖"的代价感
        const drop = Math.max(0, (u.yPrev ?? ground) - ground);
        u.y = ground;
        u.vy = 0; u.vx *= 0.15; u.vz *= 0.15;
        u.state = ST.LAND; u.stateT = 0;
        evts.push({ type: 'land', u, drop });
      }
      u.yPrev = ground;
    }
  }
  return evts;
}

/* ───────────────────────── 长矛 ───────────────────────── */

/**
 * 一根矛的一次突刺。方向由单位朝向给，长度/粗细固定。
 * 命中用「点到线段最短距离」，并且同一次突刺对同一目标只算一次。
 */
export function thrust(spear, targets) {
  spear.id = (spear.id || 0) + 1;
  const hits = [];
  const { ox, oz, dx, dz, len, radius, push } = spear;
  const l = Math.hypot(dx, dz) || 1;
  const ux = dx / l, uz = dz / l;
  for (const t of targets) {
    if (t.state === ST.DEAD || t.state === ST.DROWN) continue;
    if (t.hitThisThrust === spear.id) continue;
    // 目标到矛轴线的投影
    const rx = t.x - ox, rz = t.z - oz;
    const proj = rx * ux + rz * uz;
    if (proj < -radius || proj > len + radius) continue;   // 在矛身之外
    const perp = Math.abs(rx * uz - rz * ux);              // 叉积 = 到轴线的垂直距离
    if (perp > radius + 0.22) continue;
    t.hitThisThrust = spear.id;
    // 不是弹开，是沿矛的方向顶着走
    t.vx += ux * push;
    t.vz += uz * push;
    if (t.kind === 'big') {
      t.soak = Math.min(1, t.soak + 0.18);
      t.hp = Math.max(0, 1 - t.soak);
    } else {
      t.state = ST.STUN; t.stunT = 0.7; t.stateT = 0;
    }
    if (t.hp <= 0) t.state = ST.DEAD;
    hits.push({ t, proj, perp });
  }
  // 沿矛身从近到远排序：第一根顶住的人才是真正吃到推力的那个
  hits.sort((a, b) => a.proj - b.proj);
  return hits;
}

/* ───────────────────────── 血贴花（附着在载具局部坐标） ───────────────────────── */

/**
 * 载具（船）有自己的 position/rotation。贴花存局部坐标 + 局部朝向，
 * 每帧用载具变换算世界位置。船开走，血跟着走；这就是"stick to boats"。
 */
export class DecalSet {
  constructor(limit = 64) {
    this.limit = limit;
    this.items = [];     // {lx, lz, r, seed, kind:'blood'|'corpse'|'arrow'}
  }
  add(decal) {
    this.items.push({ kind: 'blood', r: 0.18 + Math.random() * 0.12, seed: Math.random(), ...decal });
    if (this.items.length > this.limit) this.items.shift();   // 老的先掉，控制上屏数
    return this.items[this.items.length - 1];
  }
  /** 从世界坐标记一笔（箭插在船上那一刻） */
  addWorld(worldX, worldZ, platform, extra = {}) {
    const p = platform.toLocal(worldX, worldZ);
    return this.add({ lx: p.x, lz: p.z, ...extra });
  }
  /** 逐条解算世界位置 */
  resolve(platform) {
    return this.items.map((d) => {
      const w = platform.toWorld(d.lx, d.lz);
      return { ...d, x: w.x, z: w.z, yaw: platform.rot + (d.seed - 0.5) * 0.8 };
    });
  }
  clear() { this.items.length = 0; }
}

/* ───────────────────────── 血浸透 → 颜色 ───────────────────────── */

/**
 * soak 0..1 映射成材质色。不是线性刷红：先变暗（湿），再饱和（血）。
 * 这个顺序是视频里"大兵种被越打越黑"的观感来源。
 */
export function soakTint(soak, base = [0.72, 0.66, 0.55]) {
  const s = Math.min(1, Math.max(0, soak));
  const dark = 1 - 0.55 * s;                 // 变暗
  const bloodR = 0.42, bloodG = 0.06, bloodB = 0.05;
  const mix = Math.pow(s, 1.7);              // 后段才明显泛红
  return [0, 1, 2].map((i) => {
    const b = [base[0], base[1], base[2]][i] * dark;
    const blood = [bloodR, bloodG, bloodB][i];
    return b * (1 - mix) + blood * mix;
  });
}

/* ───────────────────────── 按兵种/阵营的流场 + 数据继承 ───────────────────────── */

/**
 * [901842167508992000] "it can now tell you what type they are"
 * [902069261304287232] "visualization of data inheritance in my flow/distance/influence fields"
 *
 * 每个格子继承「最近的那个源」的 type 和 parent 指针。parent 指回去就得到 BFS 树，
 * 树的形状就是那段"convoluted pathfinding"视频里蛇形绕墙的路径。
 */
export function buildFactionField({ w, h, blocked, sources }) {
  const N = w * h;
  const dist = new Int32Array(N).fill(-1);
  const parent = new Int32Array(N).fill(-1);
  const type = new Int8Array(N).fill(-1);
  const queue = [];
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    const c = s.z * w + s.x;
    dist[c] = 0; type[c] = s.type; parent[c] = -1;
    queue.push(c);
  }
  // 4 邻域 BFS：距离场 + 继承
  for (let qi = 0; qi < queue.length; qi++) {
    const c = queue[qi];
    const cx = c % w, cz = (c / w) | 0;
    const nbs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dz] of nbs) {
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
      const nc = nz * w + nx;
      if (blocked[nc] || dist[nc] !== -1) continue;
      dist[nc] = dist[c] + 1;
      parent[nc] = c;
      type[nc] = type[c];
      queue.push(nc);
    }
  }
  return {
    w, h, dist, parent, type,
    at(x, z) { const c = z * w + x; return { d: dist[c], type: type[c], p: parent[c] }; },
    /** 从某格回溯到源：这就是那个单位会走的路线 */
    pathTo(x, z) {
      const out = [];
      let c = z * w + x;
      let guard = 0;
      while (c !== -1 && guard++ < w * h) {
        out.push([c % w, (c / w) | 0]);
        c = parent[c];
      }
      return out;
    },
  };
}

/* ───────────────────────── 血腥开关 ───────────────────────── */

/**
 * 只关表现。注意 gore=false 时 decals 不再新增、已有的淡出，
 * 但 soak / stun / DEAD 这些状态照常跑——否则关血腥会变成关战斗。
 */
export const gore = {
  on: true,
  /** 返回 true 表示这次可以掉血贴花 */
  allow() { return this.on; },
};
