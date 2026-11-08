/** 959530111187013632 "multiple grass types per level".
 * Local palette policy inspired by REACode/levelflora, not recovered original species.
 * Two colors per level; repeating palettes above four levels deliberately allowed.
 */
const PALETTES = Object.freeze([
  Object.freeze(['#9cc48a','#b8d9a6']), Object.freeze(['#7fae6a','#5f9a63']),
  Object.freeze(['#3f7a52','#b6a0d8']), Object.freeze(['#2e6248','#a8b0a4']),
]);
export function levelFloraPalette(level) {
  if (!Number.isSafeInteger(level) || level < 0) throw new RangeError('nonnegative integer level required');
  return PALETTES[level % PALETTES.length];
}
