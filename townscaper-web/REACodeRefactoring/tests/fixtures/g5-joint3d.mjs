// G5 r55 shared catalog for the 3D layered joint-subtile demo/test (gridmodes 1447494168448753667 + 787319655648100352).
// Side sockets: 0 open / 1 wall. Vertical sockets carry gravity: solid on air is forbidden.
export const VCOMPAT = (a, b) => {
  if (a === b && !String(a).includes('↑') && !String(a).includes('↓')) return true;
  const pair = [a, b].sort().join('|');
  return ['S↑|S↓', 'A↓|S↑', 'A↑|A↓'].includes(pair);
};
export function joint3dTiles() {
  const quadTiles = [], triTiles = [];
  for (let b = 0; b < 16; b++) {
    quadTiles.push({ id: 'qa' + b, edges: [0, 1, 2, 3].map(e => (b >> e) & 1), up: 'A↑', down: 'A↓', weight: 2, solid: false });
    quadTiles.push({ id: 'qs' + b, edges: [0, 1, 2, 3].map(e => (b >> e) & 1), up: 'S↑', down: 'S↓', weight: 1, solid: true });
  }
  quadTiles.push({ id: 'qT', edges: [1, 1, 1, 1], up: 'A↑', down: 'S↓', levels: 2, weight: 6, solid: true, tall: true });
  for (let b = 0; b < 8; b++) {
    triTiles.push({ id: 'ta' + b, edges: [0, 1, 2].map(e => (b >> e) & 1), up: 'A↑', down: 'A↓', weight: 2, solid: false });
    triTiles.push({ id: 'ts' + b, edges: [0, 1, 2].map(e => (b >> e) & 1), up: 'S↑', down: 'S↓', weight: 1, solid: true });
  }
  return { quadTiles, triTiles };
}
