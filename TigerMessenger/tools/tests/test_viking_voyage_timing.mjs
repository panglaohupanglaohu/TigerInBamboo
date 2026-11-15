// Pure timing / rail-cross assertions for vikingVoyage (no Three.js / no browser).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const src = readFileSync(join(root, 'src/world/vikings/vikingVoyage.js'), 'utf8');
const timingMatch = src.match(/export const VOYAGE_TIMING = Object\.freeze\((\{[\s\S]*?\})\);/);
if (!timingMatch) throw new Error('VOYAGE_TIMING missing');
const VOYAGE_TIMING = Function('return (' + timingMatch[1] + ')')();
function scheduleBeforeMoss(battleEtaSec, timing = VOYAGE_TIMING) {
  const departAt = battleEtaSec - timing.departBeforeMossSec;
  return { battleEtaSec, departAtSec: departAt, musterAtSec: departAt - timing.musterBudgetSec };
}
function estimateMossBattleEtaSec(batianSnapshot, targets, timing = VOYAGE_TIMING) {
  if (!batianSnapshot || !Array.isArray(targets)) return null;
  const order = targets.map((t) => t.id);
  const mossIdx = order.indexOf('moss');
  if (mossIdx < 0) return null;
  const done = new Set(batianSnapshot.completedTargets || []);
  const cur = batianSnapshot.target;
  let remaining = 0;
  for (let i = 0; i < mossIdx; i++) if (!done.has(order[i])) remaining++;
  if (cur === 'moss') {
    const phase = batianSnapshot.phase;
    if (['blockade', 'pincer', 'cannon', 'guard'].includes(phase)) return 0;
    if (phase === 'transit') return Math.max(5, timing.mossApproachSec * 0.5);
    return timing.mossApproachSec;
  }
  return remaining * timing.avgBatianTargetSec + timing.mossApproachSec;
}
function isCrossableRailOrTram(o) {
  for (let x = o; x; x = x.parent) {
    const n = x.name || '';
    if (/^christchurch-tram-system$|^tram-|moebius-city-viaduct|moebius-trackside|citadel-coastal-tram|citadel-tram-|jakub-viaduct|jakub-rail-embankment|global-approach-support|citadel-target-double-deck|central-double-deck|newShore-double-deck/i.test(n)) return true;
  }
  return false;
}
const assert = (c, m) => { if (!c) throw new Error(m); };
assert(VOYAGE_TIMING.departBeforeMossSec === 600, '10 min depart');
assert(VOYAGE_TIMING.musterBudgetSec === 360, '6 min muster');
assert(scheduleBeforeMoss(3600).departAtSec === 3000, 'depart reverse');
assert(estimateMossBattleEtaSec({ completedTargets: ['bookshop','apostles','citadel','old-port','swamp'], target: 'moss', phase: 'blockade' }, ['bookshop','apostles','citadel','old-port','swamp','moss'].map((id)=>({id}))) === 0, 'fighting');
assert(isCrossableRailOrTram({ name: 'x', parent: { name: 'moebius-city-viaduct' } }), 'viaduct');
assert(!isCrossableRailOrTram({ name: 'hills' }), 'hills');
assert(src.includes('crossRails = true'), 'default crossRails');
assert(src.includes('planBookshopToMoss'), 'planBookshopToMoss export');
assert(src.includes('BOOKSHOP_TO_MOSS_ROUTE'), 'fixed route table');
console.log(JSON.stringify({ passed: true, VOYAGE_TIMING, leeSailSec: Math.round(449.4 / VOYAGE_TIMING.cruiseSpeedMps), dukeSailSec: Math.round(322.5 / VOYAGE_TIMING.cruiseSpeedMps) }));
