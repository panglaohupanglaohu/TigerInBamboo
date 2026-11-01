// One-way import of saves written by the previous REACode integration (v3 strings on the
// original quad grid, radius 30). Used only to carry existing castles over to the
// REACodeRefactoring World; nothing else in the game reads the old modules any more.
import {buildQuadGrid as buildLegacyGrid} from '../vendor/townscaper-rea/quadgrid.js';
import {Town,decorateCells as decorateLegacy} from '../vendor/townscaper-rea/town.js';
import {decodeTown} from '../vendor/townscaper-rea/save.js';
import {pointInQuad} from '../vendor/townscaper-rea-refactoring/src/core/spatial.js';
let legacy=null;
function legacyTown(){if(!legacy){const grid=decorateLegacy(buildLegacyGrid({radius:30,hexSize:1}));legacy={grid,town:new Town(grid)};}return legacy;}
/** Decode a REACode v3 string and copy its columns into `world` (new grid) by cell centroid. */
export function migrateLegacyTown(str,world){
 if(typeof str!=='string'||!str.trim())return false;
 const {town}=legacyTown();decodeTown(str.trim(),town);
 const cells=world.grid.cells,at=(x,z)=>{for(const c of cells){if(Math.abs(c.cx-x)>2||Math.abs(c.cz-z)>2)continue;if(pointInQuad(c.pts,x,z))return c;}return null;};
 world.reset();let copied=0;
 for(const old of town.cells){const mask=town.solid[old.id];if(!mask)continue;const cx=old.pts.reduce((s,p)=>s+p.x,0)/old.pts.length,cz=old.pts.reduce((s,p)=>s+p.z,0)/old.pts.length,cell=at(cx,cz);if(!cell)continue;
  world.solid[cell.id]|=mask&0xfff;const col=town.colors[old.id]>=0?town.colors[old.id]:town.roofColors[old.id];if(col>=0)world.color[cell.id]=col;copied++;}
 world.touch();return copied>0;
}
