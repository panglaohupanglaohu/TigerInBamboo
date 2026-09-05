import os
p = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/citadel/gridMigration.js")
s = open(p).read()

# 1) 换掉设计说明
old_head = s[s.index("//  ---------------------------------------------------------------\n//  为什么映射**不看占用**"):s.index("//  纯数据，禁止 import Three.js / DOM.")] if "//  纯数据，禁止 import Three.js / DOM." in s else None
i = s.index("//  为什么映射**不看占用**")
j = s.index("//  为什么是**列**不是格")
s = s[:i] + """//  为什么映射表要**写进存档**（2026-09-04 实测后改的设计）
//  ---------------------------------------------------------------
//  第一版想让映射是「(gridSize, cellSize, 网格几何) 的纯函数」，好处是两个方向
//  都能重算、不用存表。实测不行：25×25=625 个列 与 六边形网格里落在方格范围内的
//  face **数量几乎相等**，于是配对是一场「紧配对」，最近优先的贪心会产生连锁挤位——
//  实测 P50 只有 0.40 格，但 **P95 1.5 格、最坏 6.9 格**（一个中心列被一路推到边缘），
//  而每个列到最近 face 的距离最坏只有 **0.85 格**。差距全是算法的，不是几何的。
//  2-opt 交换救不了它（换一下的距离和不变，要的是增广路）。
//
//  改成：**只给非空列配 face**，并把 `faceId → "ix,iz"` 这张表**存进存档**。
//    · 非空列 300 个（高山）/ 82 个（运河），face 1264 个 —— 松配对，贪心接近最优
//    · 回读不用重算，逐字符可逆是构造出来的，不是碰运气
//    · 代价是存档多存一张 300 行的表（几 KB），换来的是「迁移一次、永远可逆」
//
//  ---------------------------------------------------------------
""" + s[j:]

# 2) buildFaceCellMapping 增加 cellKeys 入参
s = s.replace(
"export function buildFaceCellMapping(quad, { candidates = Infinity } = {}) {",
"""export function buildFaceCellMapping(quad, { candidates = Infinity, cellKeys = null } = {}) {"""
)
s = s.replace(
"""  const cells = [];
  for (let iz = 0; iz < gridSize; iz++) {
    for (let ix = 0; ix < gridSize; ix++) {
      cells.push({ key: `${ix},${iz}`, x: (ix - half) * cellSize, z: (iz - half) * cellSize });
    }
  }""",
"""  // cellKeys 给了就只配这些列（正常路径：只配非空列）。稳定序：ix,iz 升序。
  const wanted = cellKeys
    ? [...new Set(cellKeys)].sort((a, b) => {
        const [ax, az] = a.split(",").map(Number);
        const [bx, bz] = b.split(",").map(Number);
        return (az - bz) || (ax - bx);
      })
    : null;
  const cells = [];
  if (wanted) {
    for (const key of wanted) {
      const [ix, iz] = key.split(",").map(Number);
      cells.push({ key, x: (ix - half) * cellSize, z: (iz - half) * cellSize });
    }
  } else {
    for (let iz = 0; iz < gridSize; iz++) {
      for (let ix = 0; ix < gridSize; ix++) {
        cells.push({ key: `${ix},${iz}`, x: (ix - half) * cellSize, z: (iz - half) * cellSize });
      }
    }
  }"""
)

# 3) migrateAsciiToFaces：只配非空列，并输出 legacy 表
old = s[s.index("export function migrateAsciiToFaces"):s.index("export function facesToAscii")]
new = '''export function migrateAsciiToFaces(levels, quad, { mapping = null } = {}) {
  // 只收集**非空列**：紧配对是上面那段注释里说的坑，松配对才有好数字
  const occupied = new Set();
  levels.forEach((rows) => {
    (rows ?? []).forEach((row, iz) => {
      [...String(row)].forEach((char, ix) => { if (char !== ".") occupied.add(`${ix},${iz}`); });
    });
  });
  const map = mapping ?? buildFaceCellMapping(quad, { cellKeys: [...occupied] });
  const byFace = new Map();
  const unmapped = [];
  levels.forEach((rows, iy) => {
    (rows ?? []).forEach((row, iz) => {
      [...String(row)].forEach((char, ix) => {
        if (char === ".") return;
        const fid = map.cellToFace.get(`${ix},${iz}`);
        if (!fid) { unmapped.push(`${ix},${iy},${iz}`); return; }
        byFace.set(`${fid},${iy}`, char);
      });
    });
  });
  // legacy：faceId → 它来自哪个 ASCII 列。回读靠它，**必须进存档**。
  const legacy = new Map([...map.faceToCell.entries()]);
  return { byFace, legacy, unmapped, mapping: map, floors: levels.length, gridSize: quad.gridSize, occupiedColumns: occupied.size };
}

'''
s = s.replace(old, new)

# 4) facesToAscii：用 legacy
old = s[s.index("export function facesToAscii"):s.index("export function createCitadelLevelsV6")]
new = '''export function facesToAscii(byFace, quad, { floors, legacy, mapping = null } = {}) {
  const faceToCell = legacy instanceof Map
    ? legacy
    : legacy
      ? new Map(legacy)
      : (mapping ?? buildFaceCellMapping(quad)).faceToCell;
  const gridSize = quad.gridSize;
  let maxLevel = -1;
  for (const key of byFace.keys()) {
    const iy = Number(key.slice(key.lastIndexOf(",") + 1));
    if (Number.isFinite(iy)) maxLevel = Math.max(maxLevel, iy);
  }
  const levelCount = Number.isFinite(floors) ? floors : maxLevel + 1;
  const levels = [];
  for (let iy = 0; iy < levelCount; iy++) {
    const rows = [];
    for (let iz = 0; iz < gridSize; iz++) rows.push(new Array(gridSize).fill("."));
    levels.push(rows);
  }
  for (const [key, char] of byFace) {
    const cut = key.lastIndexOf(",");
    const fid = key.slice(0, cut);
    const iy = Number(key.slice(cut + 1));
    const cell = faceToCell.get(fid);
    if (!cell || !Number.isFinite(iy) || !levels[iy]) continue;
    const [ix, iz] = cell.split(",").map(Number);
    if (!levels[iy][iz]) continue;
    levels[iy][iz][ix] = char;
  }
  return levels.map((rows) => rows.map((row) => row.join("")));
}

'''
s = s.replace(old, new)

# 5) 信封带上 legacy
s = s.replace(
"""  const { byFace, unmapped, mapping } = migrateAsciiToFaces(levels, quad);""",
"""  const { byFace, legacy, unmapped, mapping } = migrateAsciiToFaces(levels, quad);"""
)
s = s.replace(
"""    cells: [...byFace.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)),
    unmapped,
    _mapping: mapping,""",
"""    cells: [...byFace.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)),
    // 回读必需：faceId → 它来自哪个 ASCII 列。丢了这张表就再也逆不回方格。
    legacy: [...legacy.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)),
    unmapped,
    _mapping: mapping,"""
)
s = s.replace(
"""  const byFace = new Map(save.cells ?? []);
  return facesToAscii(byFace, quad, { floors: save.floors });""",
"""  const byFace = new Map(save.cells ?? []);
  return facesToAscii(byFace, quad, { floors: save.floors, legacy: new Map(save.legacy ?? []) });"""
)

open(p, "w").write(s)
print("patched", len(s))
