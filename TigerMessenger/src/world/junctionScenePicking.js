import * as T from 'three';
import {JUNCTION_GROW_MARGIN,junctionCellValue,junctionCoreCell} from './junctionEditableCells.js';

const buildFloor=/^(irregular-quay|central-open-court|keep-bearing-foundation|court-(left|right|rear)-support)$/;
const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
export function createJunctionScenePicking(city,root,getRegions,groups){
 const foundations=root.children.filter(o=>o.isMesh),groundRay=new T.Raycaster();groundRay.layers.enableAll();
 const centre=(r,c)=>new T.Vector3(r.x+(c.ix-(r.cols-1)/2)*1.6,r.baseY+c.iy*1.7,r.z+(c.iz-(r.rows-1)/2)*1.6);
 function valid(c){const r=getRegions().find(r=>r.id===c.regionId);return r&&[c.ix,c.iy,c.iz].every(Number.isInteger)&&c.iy>=0&&c.iy<24&&c.ix>=-JUNCTION_GROW_MARGIN&&c.ix<r.cols+JUNCTION_GROW_MARGIN&&c.iz>=-JUNCTION_GROW_MARGIN&&c.iz<r.rows+JUNCTION_GROW_MARGIN;}
 function admitted(c){
  if(!valid(c))return false;const regions=getRegions(),r=regions.find(r=>r.id===c.regionId);if(junctionCellValue(r,c)!=='.')return true;
  const p=centre(r,c);
  // Different hand-authored grids must not silently build into each other.
  for(const other of regions){if(other===r)continue;const iy=Math.floor((p.y-other.baseY+.85)/1.7);
   for(let y=Math.max(0,iy-1);y<=Math.min(23,iy+1);y++)for(let x=Math.floor((p.x-other.x)/1.6+(other.cols-1)/2)-1;x<=Math.ceil((p.x-other.x)/1.6+(other.cols-1)/2)+1;x++)for(let z=Math.floor((p.z-other.z)/1.6+(other.rows-1)/2)-1;z<=Math.ceil((p.z-other.z)/1.6+(other.rows-1)/2)+1;z++){
    if(junctionCellValue(other,{ix:x,iy:y,iz:z})==='.')continue;const q=centre(other,{ix:x,iy:y,iz:z});if(Math.abs(p.x-q.x)<1.599&&Math.abs(p.z-q.z)<1.599&&Math.abs(p.y-q.y)<1.699)return false;
   }
  }
  if(c.iy>0)return junctionCellValue(r,{...c,iy:c.iy-1})!=='.'||[[1,0],[-1,0],[0,1],[0,-1]].some(([x,z])=>junctionCellValue(r,{...c,ix:c.ix+x,iz:c.iz+z})!=='.');
  const up=new T.Vector3(0,1,0).transformDirection(city.matrixWorld);
  for(const [dx,dz]of[[0,0],[-.76,-.76],[.76,-.76],[.76,.76],[-.76,.76]]){
   groundRay.set(city.localToWorld(p.clone().add(new T.Vector3(dx,.22,dz))),up.clone().negate());groundRay.far=.44;
   const hit=groundRay.intersectObjects(foundations,false)[0];if(!hit||!buildFloor.test(hit.object.name)||!hit.face||hit.face.normal.clone().transformDirection(hit.object.matrixWorld).dot(up)<.9||Math.abs(city.worldToLocal(hit.point.clone()).y-r.baseY)>.10)return false;
  }
  return true;
 }
 function floorCell(point){
  const local=city.worldToLocal(point.clone()),regions=getRegions();
  // Deleted original plots retain their exact old identity before a new quay grid.
  for(const r of [...regions.filter(r=>!r.freeBuild),...regions.filter(r=>r.freeBuild)]){
   if(Math.abs(local.y-r.baseY)>.10)continue;
   const c={regionId:r.id,ix:Math.round((local.x-r.x)/1.6+(r.cols-1)/2),iy:0,iz:Math.round((local.z-r.z)/1.6+(r.rows-1)/2)};
   if(!junctionCoreCell(r,c)||junctionCellValue(r,c)!=='.'||!admitted(c))continue;return{...c,empty:true,top:true};
  }
  return null;
 }
 function pick(ray){
  root.updateWorldMatrix(true,true);
  for(const hit of ray.intersectObject(root,true)){
   if(!visible(hit.object)||hit.object.userData.isOutline)continue;
   let node=hit.object,rid;while(node){rid ||=node.userData.junctionRegion;node=node.parent;}
   const normal=hit.face?.normal.clone().transformDirection(hit.object.matrixWorld).transformDirection(city.matrixWorld.clone().invert());
   const r=getRegions().find(r=>r.id===rid);
   if(!r){if(!buildFloor.test(hit.object.name)||!normal||normal.y<.9)return null;return floorCell(hit.point);}
   const span=hit.object.userData.faceToCell?.find(s=>hit.faceIndex>=s.triStart&&hit.faceIndex<s.triStart+s.triCount);
   let owner=span?.cell||hit.object.userData.cell;
   const local=groups.get(rid).worldToLocal(hit.point.clone()),guess={ix:Math.round(local.x/1.6+(r.cols-1)/2),iz:Math.round(local.z/1.6+(r.rows-1)/2),iy:Math.max(0,Math.floor((local.y-r.baseY-.01)/1.7))};
   if(!owner){const candidates=span?.cells||hit.object.userData.cells||[];owner=candidates.filter(c=>typeof c==='object'&&junctionCellValue(r,c)!=='.').sort((a,b)=>Math.abs(a.ix-guess.ix)+Math.abs(a.iz-guess.iz)+Math.abs(a.iy-guess.iy)-Math.abs(b.ix-guess.ix)-Math.abs(b.iz-guess.iz)-Math.abs(b.iy-guess.iy))[0];}
   if(!owner&&junctionCellValue(r,guess)!=='.')owner=guess;if(!owner)continue;
   const side=Math.abs(normal?.x||0)>Math.abs(normal?.z||0)?[Math.sign(normal.x),0]:[0,Math.sign(normal?.z||0)];
   return{...owner,char:junctionCellValue(r,owner),regionId:rid,top:(normal?.y||0)>.42,side};
  }
  return null;
 }
 function target(hit,mode='place',char='0'){
  if(!hit)return null;if(mode==='erase')return hit.empty?null:hit;
  const c={...hit};if(!hit.empty){if(hit.top)c.iy++;else if(hit.char===char){c.ix+=hit.side?.[0]||0;c.iz+=hit.side?.[1]||0;}}
  return admitted(c)?c:null;
 }
 return{pick,target,admitted,valid};
}
