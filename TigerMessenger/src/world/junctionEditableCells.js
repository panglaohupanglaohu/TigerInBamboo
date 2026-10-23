// Logical cell coordinates stay stable when a hand-authored region grows.
// Padding exists only in the assembly input, never in the player's save.
export const JUNCTION_GROW_MARGIN=8;
export const junctionCellKey=c=>`${c.ix},${c.iy},${c.iz}`;
export const junctionCoreCell=(r,c)=>c.ix>=0&&c.ix<r.cols&&c.iz>=0&&c.iz<r.rows;
export function junctionCellValue(r,c){return junctionCoreCell(r,c)?r.levels[c.iy]?.[c.iz]?.[c.ix]??'.':r.extensions?.[junctionCellKey(c)]??'.';}
export function junctionSetCell(r,c,value){
 if(!junctionCoreCell(r,c)){r.extensions??={};if(value==='.')delete r.extensions[junctionCellKey(c)];else r.extensions[junctionCellKey(c)]=value;return;}
 while(r.levels.length<=c.iy)r.levels.push(Array(r.rows).fill('.'.repeat(r.cols)));
 const row=[...r.levels[c.iy][c.iz]];row[c.ix]=value;r.levels[c.iy][c.iz]=row.join('');
}
export function junctionAssemblyInput(r){
 const entries=Object.entries(r.extensions||{});if(!entries.length)return{levels:r.levels,padding:0};
 const padding=JUNCTION_GROW_MARGIN,rows=r.rows+padding*2,cols=r.cols+padding*2;
 const height=Math.max(r.levels.length,...entries.map(([key])=>Number(key.split(',')[1])+1));
 const levels=Array.from({length:height},(_,y)=>Array.from({length:rows},(_,z)=>Array.from({length:cols},(_,x)=>junctionCellValue(r,{ix:x-padding,iy:y,iz:z-padding})).join('')));
 return{levels,padding};
}
export function junctionRestoreLogicalOwners(group,padding){
 if(!padding)return;const seen=new Set();
 const cell=c=>{if(!c||typeof c!=='object'||seen.has(c)||!Number.isInteger(c.ix))return;seen.add(c);c.ix-=padding;c.iz-=padding;};
 group.traverse(o=>{cell(o.userData.cell);for(const c of o.userData.cells||[])cell(c);for(const span of o.userData.faceToCell||[]){cell(span.cell);for(const c of span.cells||[])cell(c);}});
}
