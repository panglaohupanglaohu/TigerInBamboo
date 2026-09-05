import os
p = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/render/stencilWindows.js")
s = open(p).read()

start = s.index("/**\n * 每扇窗的 XZ 投影落在哪一格")
end = s.index("// ---------------------------------------------------------------------\n// 材质：只 clone")
new = '''/**
 * 门 L 的「窗位不跨格角」判据。
 *
 * ⚠️ **G-19 工单原来写的判据是错的**（2026-09-04 实测）：它说「每窗 AABB 落在单格内」。
 * 做不到，也不该做到——窗**就贴在墙面上**，而墙面就是两格的分界面（窗心在
 * `cx(ix) + dx*(cs/2 + 0.028)`）。所以每扇窗的 AABB 天然跨在分界线上：
 * 420 扇里 217 扇「跨格」，全部是这个原因，不是缺陷。
 *
 * 真正该守的是**不跨格角**：窗沿着墙走的那一段（along-wall 区间）必须完整落在
 * 它所属那一格的边长之内。跨过格角意味着一扇窗折过 90° 贴到两面墙上——
 * 那才是穿帮。
 *
 * @param {{cell:{ix:number,iz:number}, center:[number,number], dir:[number,number], halfWidth:number}} win
 *   `dir` 是墙的外法线在 XZ 上的方向（DIRS 里的 [dx,dz]，只会是 ±1/0）
 * @returns {{ ok:boolean, along:string, overhang:number }} overhang = 超出格边的量（世界单位，≤0 为合格）
 */
export function windowSpansCellCorner(win, { cellSize, gridSize }) {
  const half = (gridSize - 1) / 2;
  const [dx, dz] = win.dir;
  // 墙面朝 ±X → 窗沿 Z 走；朝 ±Z → 窗沿 X 走
  const alongZ = Math.abs(dx) > Math.abs(dz);
  const idx = alongZ ? win.cell.iz : win.cell.ix;
  const c = alongZ ? win.center[1] : win.center[0];
  const cellCenter = (idx - half) * cellSize;
  const overhang = Math.abs(c - cellCenter) + win.halfWidth - cellSize / 2;
  return { ok: overhang <= 1e-6, along: alongZ ? "z" : "x", overhang: Math.round(overhang * 1e6) / 1e6 };
}

/**
 * 旧名保留：单纯回答「AABB 四角落在同一格吗」。**不要拿它当门 L 的判据**
 * （理由见 `windowSpansCellCorner`）。留着是因为它对「装饰是否溢出到邻格」还有用。
 */
export function windowCellFootprint(cornersXZ, { cellSize, gridSize }) {
  const half = (gridSize - 1) / 2;
  const idx = ([x, z]) => [
    Math.floor(x / cellSize + half + 0.5),
    Math.floor(z / cellSize + half + 0.5),
  ];
  const first = idx(cornersXZ[0]);
  for (let i = 1; i < cornersXZ.length; i++) {
    const c = idx(cornersXZ[i]);
    if (c[0] !== first[0] || c[1] !== first[1]) return { cell: null, spans: true };
  }
  return { cell: first, spans: false };
}

'''
s = s[:start] + new + s[end:]

# plan() 里补上 dir，供门 L 判据用
s = s.replace(
"""        windows.push({
          cell: { ix: u.cellIx ?? u.cell?.ix, iy: u.cellIy ?? u.cell?.iy, iz: u.cellIz ?? u.cell?.iz },
          position: o.position?.toArray?.() ?? [0, 0, 0],""",
"""        // 窗的朝向：yaw = atan2(dx, dz)（citadelTown 里就是这么摆的），反解回 [dx,dz]
        const yaw = o.rotation?.y ?? 0;
        const dir = [Math.round(Math.sin(yaw)), Math.round(Math.cos(yaw))];
        windows.push({
          cell: { ix: u.cellIx ?? u.cell?.ix, iy: u.cellIy ?? u.cell?.iy, iz: u.cellIz ?? u.cell?.iz },
          dir,
          position: o.position?.toArray?.() ?? [0, 0, 0],"""
)
open(p, "w").write(s)

p2 = os.path.expanduser("~/mnt/TigerInBamboo/tools/probe_stencil_windows.mjs")
t = open(p2).read()
old = t[t.index("// ---------- ④ 窗位不跨格"):t.index('console.log("✅ probe_stencil_windows')]
new = '''// ---------- ④ 窗位不跨格角（门 L 的那一半；判据已修正，见模块注释） ----------
const CS = 1.6;
const GRID = castle.userData.townSpec?.gridSize ?? 25;
let bad = 0;
let worst = -Infinity;
const badSamples = [];
for (const w of plan.windows) {
  const r = sw.windowSpansCellCorner(
    { cell: w.cell, center: [w.position[0], w.position[2]], dir: w.dir, halfWidth: 0.19 },
    { cellSize: CS, gridSize: GRID }
  );
  worst = Math.max(worst, r.overhang);
  if (!r.ok) { bad++; if (badSamples.length < 5) badSamples.push(`${w.cell.ix},${w.cell.iy},${w.cell.iz} 越界 ${r.overhang}`); }
}
console.log(`✓ 窗位不跨格角：${plan.windows.length} 扇，越界 ${bad} 扇，最大越界 ${worst.toFixed(4)}（格宽 ${CS}）`);
if (badSamples.length) console.log("  " + badSamples.join(" | "));
assert.equal(bad, 0, "有窗跨过格角（沿墙方向超出所属格的边长）");

// 顺带记录一下「AABB 跨格」的数字，说明为什么它不能当门
let aabbSpanning = 0;
for (const w of plan.windows) {
  const [x, , z] = w.position;
  const corners = [[x - 0.19, z - 0.19], [x + 0.19, z - 0.19], [x + 0.19, z + 0.19], [x - 0.19, z + 0.19]];
  if (sw.windowCellFootprint(corners, { cellSize: CS, gridSize: GRID }).spans) aabbSpanning++;
}
console.log(
  `  参考：按「AABB 四角同格」这个旧判据会有 ${aabbSpanning}/${plan.windows.length} 扇"跨格"——` +
  `因为窗就贴在墙面上，而墙面正是两格的分界面。**那个判据不能当门 L 用。**`
);

'''
t = t.replace(old, new)
open(p2, "w").write(t)
print("ok")
