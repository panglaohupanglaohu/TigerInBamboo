import {citadelRevision} from "./layoutRelease.js";
import * as THREE from 'three';
import {mergeStaticGroup} from '../geometryMerge.js';
import {CITADEL_TOWN_SPEC} from '../citadelTown.js';

import {OLD_CITY_PARCEL_OWNERSHIP} from "../../../assets/models/optimized/citadel-master-terrain/oldCityParcelOwnershipR05.js";

const parcels=[[-17,0,5],[1,-4,7],[16,-11,10],[-12,-14,12],[3,-22,16],[-17,-28,19],[13,-33,23]];
// Actual original cell characters feed the existing WFC/module builder.
export function applyOldCityParcelCandidate(castle,buildAssembly){
 if(typeof location==='undefined'||citadelRevision('citadelPlacement')!=='1')return;
 if(castle.userData.masterTerrainCandidate?.status!=='ready')throw new Error('Parcel layout requires frozen terrain candidate');
 const previous=castle.getObjectByName('old-city-staggered-parcels');
 const source=castle.userData.townSpec,n=source.gridSize,center=(n-1)/2,columns=[];
 for(const [terraceIndex,terrace] of source.terraces.entries())for(let z=0;z<n;z++)for(let x=0;x<n;x++){
  const chars=terrace.levels.map(rows=>rows[z]?.[x]??'.').filter(c=>c!=='.');
  if(chars.length)columns.push({x:(x-center)*2,z:(z-center)*2,chars,ix:x,iz:z,terraceIndex});
 }
 const root=new THREE.Group();root.name='old-city-staggered-parcels';root.position.x=-52;root.rotation.y=Math.PI/6;
 const reports=[];let newCells=0;
 function build(spec,baseY,label,x=0,z=0,ownership=null){
  const a=buildAssembly(spec,{baseY,highlandColors:true,wfcTownV1:true,wfcSeed:917,leanDecor:true,skipDecor:false});
  a.group.name=label;a.group.position.set(x,0,z);root.add(a.group);
  if(ownership)a.group.traverse(o=>{const cell=o.userData.cell??o.userData.townModule;if(!cell)return;const original=ownership[`${cell.ix},${cell.iy},${cell.iz}`];if(original)o.userData.cell={...original};});
  for(const level of a.levels)mergeStaticGroup(level,{skip:o=>o.userData.citadelWindow===true||o.name==='town-window',onSurface:(mesh,material,segments)=>{
   mesh.userData.faceToCell=segments.filter(s=>s.mesh.userData.cell).map(s=>({triStart:s.triStart,triCount:s.triCount,cell:s.mesh.userData.cell}));
  }});
  newCells+=a.stats.cellCount;reports.push({name:label,cells:a.stats.cellCount,wfc:a.stats.wfcTown});
 }
 const core=source.terraces[0].levels.map(rows=>rows.map((row,z)=>[...row].map((c,x)=>Math.abs(x-center)<=2&&Math.abs(z-center)<=2?c:'.').join('')));
 if(core.some(rows=>rows.some(row=>/[^.]/.test(row))))build({cellSize:CITADEL_TOWN_SPEC.cellSize,cellHeight:CITADEL_TOWN_SPEC.cellHeight,gridSize:n,levels:core},4.95,'old-city-original-core');
 // Stable project-owned mapping survives source edits and a fresh game session.
 if(n!==OLD_CITY_PARCEL_OWNERSHIP.gridSize)throw new Error("Old-city source grid changed; explicit parcel migration required");
 castle.userData.oldCityParcelOwnership=structuredClone(OLD_CITY_PARCEL_OWNERSHIP.parcels);
 for(const [index,[x,z,y]]of parcels.entries()){
  if(!columns.length)break;
  const selected=castle.userData.oldCityParcelOwnership[index],ownership={};
  const levels=Array.from({length:3},()=>Array.from({length:5},()=>Array(5).fill('.')));
  const sites=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
  sites.forEach(([dx,dz],i)=>{const column=selected[i];if(!column)return;for(let h=0;h<3;h++){
   const char=source.terraces[column.terraceIndex]?.levels[h]?.[column.iz]?.[column.ix]??'.';
   levels[h][dz+2][dx+2]=char;if(char!=='.')ownership[`${dx+2},${h},${dz+2}`]={...column,iy:h,char};
  }});
  build({cellSize:2,cellHeight:CITADEL_TOWN_SPEC.cellHeight,gridSize:5,levels:levels.map(rows=>rows.map(r=>r.join('')))},y,'old-city-parcel-'+index,x,z,ownership);
 }
 // Build first, retire only original town level groups after successful creation.
 const retired=[];castle.traverse(o=>{
  if(/^town-terrace-\d+-level-\d+$/.test(o.name)||o.name==='highland-town-foundation-platform'||o.userData.designRole==='target-dense-terraced-old-city'){
   o.visible=false;retired.push(o.name);
  }
 });
 castle.add(root);
 castle.updateWorldMatrix(true,true);
 const terrain=castle.getObjectByName('citadel-oskar-grid-mountain-surface'),ray=new THREE.Raycaster();ray.layers.enableAll();ray.far=150;
 const down=new THREE.Vector3(0,-1,0).transformDirection(root.matrixWorld),supports=[];
 for(const [index,[px,pz,py]]of parcels.entries()){
  if(!columns.length)break;
  let best=null;
  for(const sx of [0,-4,4,-8,8])for(const sz of [0,-4,4,-8,8]){
   const x=px+sx,z=pz+sz,heights=[];
   if(supports.some(p=>Math.hypot(p.placed[0]-x,p.placed[2]-z)<7.2))continue;
   for(const dx of [-3.2,0,3.2])for(const dz of [-3.2,0,3.2]){
    ray.set(root.localToWorld(new THREE.Vector3(x+dx,100,z+dz)),down);
    const hit=ray.intersectObject(terrain,false)[0];if(hit)heights.push(root.worldToLocal(hit.point.clone()).y);
   }
   if(heights.length!==9)continue;
   const low=Math.min(...heights),high=Math.max(...heights),score=(high-low)*3+Math.hypot(sx,sz)*.2+Math.abs(high-py)*.12;
   if(!best||score<best.score)best={x,z,low,high,score};
  }
  if(!best)throw new Error('No ground under old-city parcel '+index);
  const {x,z,low,high}=best,y=high+.08,bottom=low-.15;
  const building=root.getObjectByName('old-city-parcel-'+index);building.position.set(x,y-py,z);
  supports.push({index,proposed:[px,py,pz],placed:[x,y,z],minimumRockY:low,maxRockY:high,samples:9,foundationHeight:y-bottom});
  if(y-bottom>=5)throw new Error('Parcel requires excessive footing: '+index+' / '+(y-bottom));
  const base=new THREE.Mesh(new THREE.BoxGeometry(6.4,y-bottom,6.4),new THREE.MeshStandardMaterial({color:0xaaa69b,roughness:1}));
  base.name='old-city-parcel-foundation-'+index;base.position.set(x,(y+bottom)/2,z);root.add(base);
 }
 if(previous){previous.removeFromParent();const geometries=new Set();previous.traverse(o=>{if(o.isMesh)geometries.add(o.geometry);});for(const geometry of geometries)geometry.dispose();}
 castle.userData.refreshOldCityParcels=()=>applyOldCityParcelCandidate(castle,buildAssembly);
 castle.userData.oldCityParcelCandidate={status:'candidate',oldColumns:columns.length,oldCells:columns.reduce((sum,c)=>sum+c.chars.length,0),newCells,reports,supports,retiredGroups:retired.length,rebuilds:(castle.userData.oldCityParcelCandidate?.rebuilds??0)+1,scope:'Original palette rebuilt after town edits; direct picking of migrated parcels and story-path reconciliation remain pending.'};
 return root;
}
