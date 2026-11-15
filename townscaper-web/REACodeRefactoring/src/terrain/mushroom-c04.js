/**
 * mushroom-c04.js — 第 56 批 C04：781957658597269506（2016-09-30，无配文，109 帧）。
 *
 * 片子：一根中心柱上错层叠着好几片**黄色薄平台**（蘑菇伞 / 层叠岩檐，每片只有一层厚、下面是空的），平台之间靠白色
 * 木梯上下；最上面一片放红房子（带烟囱冒烟）和桌椅，底座一圈绿树；镜头转台式绕一圈，露出平台底面。
 * 这里在**共享 World**（同一张网格、同一套 terrainmesh / navgraph / woodladders）上搭这个结构：
 *   · 中心柱：离中心 stemR 内的格，岩石从 1 层到最高层；
 *   · 薄平台：每片一个 (偏移, 半径, 层)，只写那**一层**岩石（柱子以外下方全空）→ terrainmesh 自带悬挑侧壁 + 底面；
 *   · 错层：相邻两片高差 2 层（≤ navgraph MAX_STEP），伸向不同方向 → 下片露出的边缘紧挨上片边缘，buildNav 在那里
 *     出一条 rise=2 的楼梯，woodladders 模式画成木梯，ladderContact 判为 thinPlatform（上片支撑深度 1 < rise 2）；
 *   · 顶片放 1–2 格房子（非岩石实心 = 建筑管线画房子、烟囱冒烟）；底座一圈 1 层陆地给植被长树。
 * 平台颜色（黄）是原美术，未迁；几何与连接是本地程序化重建。
 */
export const MUSHROOM_CAPS = [
  { dx: 1.3, dz: .2, r: 2.5, level: 3 },
  { dx: -1.2, dz: .9, r: 2.3, level: 5 },
  { dx: .5, dz: -1.4, r: 2.2, level: 7 },
  { dx: -.4, dz: .3, r: 2.1, level: 9 },
];

export function buildMushroomStack(world, { caps = MUSHROOM_CAPS, stemR = .9, baseR = 4.2, center = null, house = true } = {}) {
  if (!world?.cells?.length) throw new TypeError('World required');
  if (!Array.isArray(caps) || !caps.length) throw new RangeError('caps required');
  const cells = world.cells, c0 = center ?? cells.reduce((a, b) => (Math.hypot(b.cx, b.cz) < Math.hypot(a.cx, a.cz) ? b : a));
  const ox = c0.cx, oz = c0.cz, d = (c, x, z) => Math.hypot(c.cx - x, c.cz - z), topLevel = Math.max(...caps.map((k) => k.level));
  world.reset();
  const stem = [], base = [], capCells = caps.map(() => []);
  for (const c of cells) {
    if (d(c, ox, oz) <= baseR) { world.fill(c, 1, { rock: true }); base.push(c.id); }
    if (d(c, ox, oz) <= stemR) { world.fill(c, topLevel, { rock: true }); stem.push(c.id); }
  }
  caps.forEach((k, i) => { for (const c of cells) if (d(c, ox + k.dx, oz + k.dz) <= k.r) { world.setSolid(c, k.level, true, { rock: true }); capCells[i].push(c.id); } });
  // 顶片上的房子：顶片里离柱最远、四邻都在顶片上的格
  const houses = [];
  if (house) {
    const top = caps.reduce((a, b) => (b.level > a.level ? b : a)), lv = top.level, onTop = new Set(capCells[caps.indexOf(top)]);
    const ok = cells.filter((c) => onTop.has(c.id) && world.top(c) === lv && c.edgeNeighbors.every((n) => n >= 0 && onTop.has(n)));
    const pick = ok.sort((a, b) => d(b, ox, oz) - d(a, ox, oz))[0];
    if (pick) { world.setSolid(pick, lv + 1, true); houses.push(pick.id); }
  }
  world.touch?.();
  return { center: c0.id, stem, base, caps: capCells, houses, topLevel };
}

/** 结构诊断：每片薄平台的格数、正下方有空气的格数（悬空 = 真薄平台）、底面面积代理。 */
export function mushroomReport(world, built) {
  return built.caps.map((ids, i) => {
    const lv = MUSHROOM_CAPS[i]?.level ?? null;
    let overhang = 0, thin = 0;
    for (const id of ids) { const c = world.cells[id], l = lv ?? world.top(c); if (!world.isSolid(c, l - 1)) overhang++; if (world.isSolid(c, l) && !world.isSolid(c, l - 1) && !world.isSolid(c, l + 1)) thin++; }
    return { cap: i, level: lv, cells: ids.length, overhang, thin };
  });
}
