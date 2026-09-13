// Author-space mountain shelves. Pure data: renderer, editor and terrain agree.
export const OLD_CITY_SHELVES_VERSION = 'highland-old-city-shelves-v2';
export const OLD_CITY_SHELF_BASE_YS = Object.freeze([4.95,10.95,16.95,4.95,4.95]);
export function oldCityShelfIndex(x,z) {
  if (Math.abs(x)<=4 && Math.abs(z)<=4) return 0;
  return z<=-13 ? 2 : z<-3 ? 1 : 0;
}
export function isOldCityShelves(layout) { return layout?.compositionVersion===OLD_CITY_SHELVES_VERSION || layout?.compositionVersion==='highland-old-city-shelves-v1'; }
export function oldCityShelfSupported(x,z,index) {
  return index<3 && Math.abs(x)<=25 && Math.abs(z)<=25 && oldCityShelfIndex(x,z)===index;
}

/** Convex support outline of the surviving WFC lots, plus the original shore
 * approach and harbor-side landing. Coordinates stay in the old-town frame. */
export function oldCityFoundationOutline(layout) {
  if(!isOldCityShelves(layout))return null;
  const n=layout.gridSize||25,center=(n-1)/2,points=[];
  for(const terrace of layout.terraces)for(const rows of terrace.levels)
    for(let z=0;z<rows.length;z++)for(let x=0;x<rows[z].length;x++){
      if(rows[z][x]==='.')continue;
      for(const dx of [-1.6,1.6])for(const dz of [-1.6,1.6])points.push([(x-center)*2+dx,(z-center)*2+dz]);
    }
  if(!points.length)return null;
  points.push([1,21.5],[23,21.5],[23,23],[1,23],[-23,8],[-23,19]);
  const sorted=[...new Map(points.map(p=>[p.join(','),p])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const half=items=>{const result=[];for(const p of items){while(result.length>1&&cross(result.at(-2),result.at(-1),p)<=0)result.pop();result.push(p);}return result;};
  return [...half(sorted).slice(0,-1),...half([...sorted].reverse()).slice(0,-1)];
}
export function migrateOldCityShelves(layout) {
  if (isOldCityShelves(layout)) return layout;
  const n=layout.gridSize||25, center=(n-1)/2;
  const floors=layout.terraces[0].levels.length;
  const grids=Array.from({length:5},()=>Array.from({length:floors},()=>Array.from({length:n},()=>Array(n).fill('.'))));
  let before=0, after=0;
  const levels=layout.terraces[0].levels;
  for(let iz=0;iz<n;iz++) for(let ix=0;ix<n;ix++) {
    const occupied=[];
    for(let iy=0;iy<floors;iy++) {const c=levels[iy]?.[iz]?.[ix]||'.';if(c!=='.') occupied.push([iy,c]);}
    before+=occupied.length;
    if(!occupied.length) continue;
    // Keep original houses in irregular hillside clusters, exposing rock between them.
    const gx=ix-center,gz=iz-center;
    const clusters=[[-6,7,3.1],[5,7,3.0],[-5,1,3.0],[6,0,2.7],[-6,-5,3.0],[4,-5,2.5],[-6,-9,2.8],[2,-9,2.4]];
    if(!(gx===0&&gz===10)&&!clusters.some(([x,z,r])=>Math.hypot(gx-x,(gz-z)*.9)<=r))continue;
    const shelf=oldCityShelfIndex((ix-center)*2,(iz-center)*2);
    // Keep the surviving top silhouette, never add invisible foundation cells.
    const drop=Math.min(shelf*3,occupied.length-1);
    const survivors=occupied.slice(drop);
    const origin=shelf ? survivors[0][0] : 0;
    for(const [iy,char] of survivors) {grids[shelf][iy-origin][iz][ix]=char;after++;}
  }
  return {...layout,compositionVersion:OLD_CITY_SHELVES_VERSION,
    shelfMigration:{beforeCells:before,afterCells:after,removedCells:before-after},
    terraces:grids.map((g,terraceIndex)=>({terraceIndex,levels:g.map(rows=>rows.map(row=>row.join('')))}))};
}
