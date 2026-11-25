// R54–R60 单元测试共用的合成场地：一个外圈是海的岛，中间两级台地（台地边是 6 m 的坎），西边有一块已有建筑，南边一条轨道。
// 与山形采样同格式：{ n, step, half, h[n*n]（米，<= 0.3 是海）, cls[n*n]（0 地形 1 建筑 2 轨道）, sea }
export function terraceField({ n = 61, step = 3, building = true, rail = true } = {}) {
  const half = (n - 1) * step / 2, N = n * n, h = new Array(N), cls = new Array(N).fill(0);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = i * step - half, z = j * step - half, r = Math.hypot(x, z), q = j * n + i;
    h[q] = r > half * 0.92 ? 0 : Math.round((4 + 0.03 * x + (r < half * 0.35 ? 6 : 0)) * 100) / 100;
  }
  if (building) for (let j = 27; j <= 33 && j < n; j++) for (let i = 8; i <= 13 && i < n; i++) cls[j * n + i] = 1;
  if (rail) { const rj = n > 47 ? 47 : n - 5, ri1 = Math.min(54, n - 7); for (let i = 6; i <= ri1; i++) cls[rj * n + i] = 2; }
  return { n, step, half, h, cls, sea: 0.3 };
}
/** 山形能力要的 site（mountain/capabilities.js：site.field + site.plan）。 */
export const mountainSite = (field) => ({ scene: { id: 'citadel', label: '高山圣城' }, field: { n: field.n, step: field.step, h: field.h.slice(), cls: field.cls.slice(), railY: new Array(field.n * field.n).fill(null) } });
/** 建筑能力要的 site。 */
export const buildingSite = (field, extra = {}) => ({ scene: { id: 'citadel', label: '高山圣城' }, field: { ...field, h: field.h.slice(), cls: field.cls.slice() }, terrain: 'original', ...extra });
