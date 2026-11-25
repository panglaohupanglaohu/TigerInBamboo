// 表现层 R37–R40 单元测试共用的合成舞台（形状同 battle.probe 的 site）：规则方格岛，台阶式升高，东侧有一道 2 层落差的崖，四座小屋，外圈是海格（lv 0）。
export function cliffStage({ houses = true, cliff = true } = {}) {
  const grid = [];
  const H = new Set(['0,0', '-3,2', '2,-4', '5,1']);
  for (let i = -12; i <= 12; i++) for (let j = -12; j <= 12; j++) {
    const r = Math.hypot(i, j); if (r > 12) continue;
    let lv = r > 10.5 ? 0 : Math.min(6, 1 + Math.floor((10.5 - r) / 1.8));
    if (cliff && lv > 0 && i >= 3 && r < 8) lv += 2;
    grid.push([i, j, lv, houses && lv > 0 && H.has(i + ',' + j) ? 1 : 0]);
  }
  return { scene: { id: 'test', label: '合成舞台' }, scale: 5, unitHeight: 1.7, levelHeight: 0.5, land: grid.filter((c) => c[2] > 0).length, maxLevel: Math.max(...grid.map((c) => c[2])), houses: grid.filter((c) => c[3]).length, grid };
}
export function flatStage() {
  const grid = []; for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) grid.push([i, j, Math.hypot(i, j) > 5 ? 0 : 1, 0]);
  return { scene: { id: 'flat' }, scale: 5, levelHeight: 0.5, land: grid.length, maxLevel: 1, houses: 0, grid };
}
export const clone = (x) => JSON.parse(JSON.stringify(x));
