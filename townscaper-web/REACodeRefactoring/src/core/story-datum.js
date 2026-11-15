/** 803190517534248960 / 806856212260278272 (video only; REACode storydatum read from frames):
 * storey lines belong to the town's global elevation grid y = k*H, not to each
 * tower's base. Shared World voxels already store integer levels, so every built
 * wall sits on that grid; snapStoreyBands keeps the original datum rule for
 * non-integer bases (and the local contrast), measureFacade/windowRows are the
 * original audit interface.
 */
const r6 = v => Math.round(v * 1e6) / 1e6;
export function snapStoreyBands(base, floors, H, { mode = 'datum', minFirst = .8 } = {}) {
  if (![base, H, minFirst].every(Number.isFinite) || H <= 0 || !Number.isInteger(floors) || floors < 1) throw new RangeError('invalid storey datum');
  const bands = [];
  if (mode === 'local') { for (let m = 1; m <= floors; m++) bands.push(base + m * H); return { base, floors, bands, top: base + floors * H }; }
  if (mode !== 'datum') throw new RangeError('mode');
  const want = base + floors * H;
  for (let k = Math.ceil((base + minFirst) / H - 1e-9); k * H <= want + 1e-9; k++) bands.push(k * H);
  const top = bands.length ? bands.at(-1) : Math.ceil((base + minFirst) / H) * H;
  return { base, floors, bands, top, truncated: want - top };
}
export function measureFacade(towers, H) {
  const levels = towers.flatMap(t => t.bands.map(r6)), uniq = [...new Set(levels)].sort((a, b) => a - b), users = new Map();
  for (const t of towers) for (const y of new Set(t.bands.map(r6))) users.set(y, (users.get(y) ?? 0) + 1);
  let maxDev = 0; for (const y of levels) { const d = Math.abs(y - Math.round(y / H) * H); maxDev = Math.max(maxDev, d); }
  return { towers: towers.length, bandTotal: levels.length, distinctLevels: uniq.length, sharedLevels: [...users.values()].filter(n => n >= 2).length, maxShared: Math.max(0, ...users.values()), maxDevFromGrid: maxDev, reuse: levels.length / (uniq.length || 1), levels: uniq };
}
export function windowRows(t, { minGap = 1 } = {}) {
  const rows = [];
  for (let i = 0; i < t.bands.length; i++) { const lo = i ? t.bands[i - 1] : t.base, hi = t.bands[i]; if (hi - lo > minGap) rows.push((lo + hi) / 2); }
  return rows;
}
/** World adapter: one "tower" per building component; bands at every built storey top. */
export function worldStoreyBands(world, components, L) {
  const towers = new Map();
  for (const c of world.cells) for (let lv = 2; lv <= world.top(c); lv++) {
    if (!world.isBuilt(c, lv)) continue;
    const id = components.at(c, lv); if (id < 0) continue;
    const t = towers.get(id) ?? towers.set(id, { id, base: Infinity, bands: new Set(), top: 0 }).get(id);
    t.base = Math.min(t.base, (lv - 1) * L); t.bands.add(lv * L); t.top = Math.max(t.top, lv * L);
  }
  return [...towers.values()].map(t => ({ ...t, bands: [...t.bands].sort((a, b) => a - b) }));
}
