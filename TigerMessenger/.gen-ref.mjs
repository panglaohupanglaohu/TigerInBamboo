import { groundLiftAt } from './src/world/hills.js';
const WORLD_SCALE = 4, R = 160;
const GRID_MIN_X = -11.5 * WORLD_SCALE, GRID_MAX_X = 16.5 * WORLD_SCALE;
const GRID_MIN_Z = -15.5 * WORLD_SCALE, GRID_MAX_Z = 12.5 * WORLD_SCALE;
const STEP = 0.7 * WORLD_SCALE;
const nx = Math.round((GRID_MAX_X - GRID_MIN_X) / STEP) + 1;
const nz = Math.round((GRID_MAX_Z - GRID_MIN_Z) / STEP) + 1;
console.error('grid', nx, 'x', nz, '=', nx * nz);
const ref = [];
for (let iz = 0; iz < nz; iz++) {
  for (let ix = 0; ix < nx; ix++) {
    const x = GRID_MIN_X + ix * STEP, z = GRID_MIN_Z + iz * STEP;
    ref.push(Math.round((R + groundLiftAt(x, z)) * 100));
  }
}
console.log(ref.join(','));
