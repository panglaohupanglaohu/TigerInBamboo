/** Reduced two-dimensional wall-decoration CSP. Adapted from surfacedeco's tall-window
 * requires empty-above rule; uses the existing shared iterative WFC solver.
 * Doors retain the existing placement policy. No original 6-tile facade claim.
 */
import{solveWFC,findWFCConflicts}from'./wfc.js';
export function solveWallDecoration(levels,{seed=1,doors=[],width=1}={}){
 if(!Number.isInteger(levels)||levels<1||levels>12)throw new RangeError('wall budget 1..12');
 if(!Number.isInteger(width)||width<1||width>8)throw new RangeError('wall width 1..8');
 const cells=Array.from({length:levels*width},(_,id)=>{const x=id%width,y=Math.floor(id/width);return{id,n:4,edgeNeighbors:[x+1<width?id+1:-1,y+1<levels?id+width:-1,x>0?id-1:-1,y>0?id-width:-1]};});
 const tiles=(width===1?['blank','single','double','tall']:['blank','single','tall']).map(id=>({id,edges:Array.from({length:4},(_,dir)=>({id,dir}))}));
 const compatible=(a,b)=>a.dir===1? a.id!=='tall'||b.id==='blank':a.dir===3?b.id!=='tall'||a.id==='blank':a.id==='blank'||b.id==='blank'||a.id!==b.id;
 const pins={};for(let x=0;x<width;x++)pins[(levels-1)*width+x]=x%2?'blank':'single';for(const d of doors){if(!Number.isInteger(d)||d<0||d>=levels)throw new RangeError('bad door slot');for(let x=0;x<width;x++)pins[d*width+x]='blank';}
 const grid={cells},r=solveWFC(grid,{tiles,seed,pins,compatible,maxSteps:20000});
 return{...r,violations:r.ok?findWFCConflicts(grid,r.tiles,tiles,{compatible}):[],width,styles:r.ok?cells.map(c=>r.tiles[c.id]):[]};
}

const facadeTypes=['none','window','window2','door','arch','shutterL','shutterR'];
const isWindow=s=>s==='window'||s==='window2';
function horizontal(l,r){
 if(l==='shutterR'&&!isWindow(r)||r==='shutterL'&&!isWindow(l))return false;
 if(l==='none'||r==='none'||l.startsWith('shutter')||r.startsWith('shutter'))return true;
 if(['door','arch'].includes(l))return !['door','arch','window2'].includes(r);
 if(['door','arch'].includes(r))return !['door','arch','window2'].includes(l);
 return l!==r;
}
function vertical(below,above){return below==='window2'?above==='none':['door','arch'].includes(below)?['none','window','window2'].includes(above):true;}
/** Six semantic types, two directed shutter variants to enforce an actual
 * adjacent window. Entry location is supplied by the existing safe-door policy.
 */
export function solveFacadeDecoration(levels,{width=3,seed=1,entry=null,pins={}}={}){
 if(!Number.isInteger(levels)||levels<1||levels>12||!Number.isInteger(width)||width<1||width>12)throw new RangeError('facade bounds');
 if(entry!==null&&!['door','arch'].includes(entry))throw new RangeError('entry type');
 const cells=Array.from({length:width*levels},(_,id)=>{const x=id%width,y=Math.floor(id/width);return{id,n:4,edgeNeighbors:[x+1<width?id+1:-1,y+1<levels?id+width:-1,x?id-1:-1,y?id-width:-1]}}),tiles=facadeTypes.map(id=>({id,edges:Array.from({length:4},(_,dir)=>({id,dir}))})),allowed={},effectivePins={...pins};
 for(const c of cells){const x=c.id%width,y=Math.floor(c.id/width);allowed[c.id]=facadeTypes.filter(t=>!['door','arch'].includes(t)&&!(t==='window2'&&y===levels-1)&&!(t==='shutterL'&&x===0)&&!(t==='shutterR'&&x===width-1));}
 if(entry){const id=Math.floor(width/2);allowed[id]=[entry];effectivePins[id]=entry;}
 const compatible=(a,b)=>a.dir===0?horizontal(a.id,b.id):a.dir===2?horizontal(b.id,a.id):a.dir===1?vertical(a.id,b.id):vertical(b.id,a.id);
 const r=solveWFC({cells},{tiles,seed,pins:effectivePins,allowed,compatible,maxSteps:50000});
 const styles=r.ok?cells.map(c=>r.tiles[c.id]):[];
 return{...r,width,styles,violations:r.ok?validateFacade(styles,{width,levels,entry}):[]};
}
// Independent semantic validation, including missing-window shutter rejection.
export function validateFacade(styles,{width,levels,entry=null}){
 const bad=[];if(styles.length!==width*levels)return['size'];
 for(let y=0;y<levels;y++)for(let x=0;x<width;x++){
  const id=y*width+x,t=styles[id],l=x?styles[id-1]:null,r=x+1<width?styles[id+1]:null,up=y+1<levels?styles[id+width]:null;
  if(!facadeTypes.includes(t)){bad.push(id);continue;}
  if(['door','arch'].includes(t)&&(y!==0||x!==Math.floor(width/2)||t!==entry))bad.push(id);
  if(t==='window2'&&up!=='none')bad.push(id);
  if(t==='shutterL'&&!isWindow(l)||t==='shutterR'&&!isWindow(r))bad.push(id);
  if(r&&isWindow(t)&&t===r)bad.push(id);
  if(['door','arch'].includes(t)&&([l,r].some(s=>['door','arch','window2'].includes(s))||up&&!['none','window','window2'].includes(up)))bad.push(id);
 }
 if(entry&&styles[Math.floor(width/2)]!==entry)bad.push('entry');return[...new Set(bad)];
}
