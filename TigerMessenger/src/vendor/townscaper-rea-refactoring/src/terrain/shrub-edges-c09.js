/**
 * shrub-edges-c09.js — 第 56 批 C09-C · 1707490274425884929「I added back the lil' shrubbery at the edges of things」。
 *
 * 片子（342 帧，原尺寸 0/160/205 复看）：鲑橙色锯齿灌木带不只在台地崖顶，还压在
 *   ① 房子墙根一圈（frame 160 大屋右下、205 三栋屋脚）；
 *   ② 低台地贴着高崖脚的那条边（frame 0 左下、205 中部台地与高崖交界）。
 * 旧 terrainmesh 只把「邻居更低」的边记作 aEdge=0（崖顶）。这里补「邻居更高」的边（崖脚 / 墙根），
 * 灌木仍是 100% 顶面着色（shrub-texture.js 的 shrubApply，没有几何）。
 *
 * world.shrubFootC09：false/未设 → 与旧行为逐位相同；true → 崖顶 + 崖脚 + 墙根；
 *   也可给对象 { cliffTop = true, cliffFoot = true, houseFoot = true } 单独开关。
 */
export function shrubEdgeFlags(world, c, g, shrubby) {
  const opt = world.shrubFootC09;
  const o = opt && typeof opt === 'object' ? opt : null;
  const cliffTop = o ? o.cliffTop !== false : true;
  const cliffFoot = !!opt && (o ? o.cliffFoot !== false : true);
  const houseFoot = !!opt && (o ? o.houseFoot !== false : true);
  const out = new Array(c.n);
  for (let i = 0; i < c.n; i++) {
    const nb = world.neighbor(c, i), og = nb ? world.top(nb) : 0;
    // 第 68 轮：去掉 `og >= 1` 这个「不含临海」的门控。原片 1707497006640365880 frame-0010 放大看：
    //   ① 右下那座孤立圆盘台地的橙带是**整整一圈**（连朝向沙嘴的一侧都在）；
    //   ② 岛体草地 / 崖顶直接临水的那圈边同样有橙带。
    // 只要本格是草 / 旱草（shrubby 已把 sand、river 排除），邻居更低就长带子——沙岸不长是「格自己是沙」，
    // 不是「邻居是水」。旧门控把 67 条临水边全丢了（第 68 轮实测 coastOn 0/67，2 个孤立台地环不闭合）。
    let on = cliffTop && og < g;                                      // 台地边 / 崖顶 / 直接临水的崖边
    if (!on && og > g && nb) {
      const ng = world.ground(nb);
      const built = world.isBuilt(nb, g + 1);                         // 紧贴本层上方就是建筑 → 墙根
      if (built ? houseFoot : (cliffFoot && ng > g)) on = true;       // 否则邻居岩柱更高 → 崖脚
    }
    out[i] = shrubby && on;
  }
  return out;
}

/** 统计：一个 World 里各类灌木边的数量（测试 / 页面读数用，不影响网格）。 */
export function shrubEdgeStats(world) {
  const s = { cliffTop: 0, cliffFoot: 0, houseFoot: 0 };
  for (const c of world.cells) {
    const g = world.ground(c);
    if (!g || world.isSolid(c, g + 1)) continue;
    for (let i = 0; i < c.n; i++) {
      const nb = world.neighbor(c, i), og = nb ? world.top(nb) : 0;
      if (og < g) s.cliffTop++;                                          // 含临水边（第 68 轮口径）
      else if (og > g && nb) { if (world.isBuilt(nb, g + 1)) s.houseFoot++; else if (world.ground(nb) > g) s.cliffFoot++; }
    }
  }
  return s;
}

/** 崖顶 + 崖脚 + 墙根一起开时，小格两侧都有带，默认宽 0.50 会把窄台地整格盖满；片子里带子窄、格心留草。建议配 view.setShrubStyle(SHRUB_FOOT_STYLE)。 */
export const SHRUB_FOOT_STYLE = Object.freeze({ width: 0.32, ragged: 0.15, shadow: 1, coverage: 0.5 });
