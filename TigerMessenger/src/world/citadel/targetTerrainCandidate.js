import {createTargetNewCityRetreatField} from './targetNewCityRetreatField.js';
import {createTargetOldShoreApronField} from './targetOldShoreApronField.js';
import {createTargetCoastalCliffCutField} from './targetCoastalCliffCutField.js';
import {createTargetRailCliffField} from './targetRailCliffField.js';
import {targetCityParams} from './targetCityRelease.js';
import * as THREE from 'three';
import {buildTargetTerrainHeightfield} from './targetTerrainHeightfield.js';
import {createCastleOceanSampler} from './newCityRidgeCandidate.js';

// A terrain-first authored layout. IDs remain stable for the following city
// and route phases; old foundations/rail curves do not define this candidate.
export const TARGET_TERRAIN_RIDGES=[
 {id:'old-main',a:[-103,-27,31],b:[-82,-35,43],width:31},
 {id:'old-rear',a:[-82,-35,43],b:[-50,-33,31],width:29},
 {id:'old-right-shoulder',a:[-50,-33,31],b:[-29,-29,33],width:25},
 {id:'central-saddle',a:[-29,-34,30],b:[-3,-41,12],width:13},
 {id:'bay-rear-join',a:[-3,-41,12],b:[32,-37,24],width:15},
 {id:'new-rear',a:[32,-32,24],b:[77,-29,34],width:27},
 {id:'new-east',a:[77,-29,34],b:[111,-4,26],width:26},
 {id:'old-coastal-terraces',a:[-107,-4,30],b:[-91,42,23],width:28},
 {id:'new-coastal-terraces',a:[109,-5,26],b:[111,62,19],width:23},
];
export const TARGET_CITY_PLATFORMS=[
 {id:'old-city-platform',center:[-55,9],radii:[31,30],height:17},
 {id:'new-city-platform',center:[74,33],radii:[29,37],height:12},
 {id:'new-city-plaza',center:[62,76],radii:[30,22],height:3},
];
const mix=THREE.MathUtils.lerp,smooth=(v,a,b)=>THREE.MathUtils.smoothstep(v,a,b);
function section(d,crest,sea,phase=0){
 const highBreak=.29+.05*Math.sin(phase),midStart=highBreak+.10,midEnd=.66+.05*Math.cos(phase),lowStart=midEnd+.11,drop1=6.5+1.7*Math.sin(phase*.7),drop2=14+1.5*Math.cos(phase*.8);
 // Broad draining benches separated by narrow, steep cliff breaks.
 if(d<highBreak)return crest-.22*d;
 if(d<midStart)return mix(crest-.22*highBreak,crest-drop1,smooth(d,highBreak,midStart));
 if(d<midEnd)return crest-drop1-(d-midStart)*.7;
 if(d<lowStart)return mix(crest-drop1-(midEnd-midStart)*.7,crest-drop2,smooth(d,midEnd,lowStart));
 if(d<1.04)return crest-drop2-(d-lowStart)*.65;
 return mix(crest-drop2-(1.04-lowStart)*.65,sea-3,smooth(d,1.04,1.25));
}
export function targetTerrainHeight(x,z,sea,{aprons=false,saddle=false,valleyBenches=false}={}){
 let y=sea-3;
 for(const [i,{a,b,width,id}] of TARGET_TERRAIN_RIDGES.entries()){
  const dx=b[0]-a[0],dz=b[1]-a[1],t=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);
  const outward=id==='old-coastal-terraces'?-(x-a[0]-dx*t):id==='new-coastal-terraces'?(x-a[0]-dx*t):0;
  const sideScale=id.includes('coastal')?(outward>0?1.08:.62):1;
  const dist=Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t),warp=1+.04*Math.sin(x*.15+z*.08)+.025*Math.sin(z*.19-x*.08),d=dist/(width*warp*sideScale);
  if(d<1.25)y=Math.max(y,section(d,mix(a[2],b[2],smooth(t,0,1)),sea,i*1.2+t*1.7));
 }
 for(const p of TARGET_CITY_PLATFORMS){const d=Math.hypot((x-p.center[0])/p.radii[0],(z-p.center[1])/p.radii[1]);if(d<1.15)y=mix(y,p.height-.25*Math.min(d,1),1-smooth(d,.78,1.15));}
 // Bay-facing aprons divide the platform-to-sea drop into two short breaks.
 // Rear shoulders are left connected. The scalloped outer collar is separate
 // from the flat, stable construction footprint used by the city phase.
 const originalSurface=y;
 const coreWeight=Math.min(...TARGET_CITY_PLATFORMS.map(p=>smooth(Math.hypot((x-p.center[0])/p.radii[0],(z-p.center[1])/p.radii[1]),.78,.96)));
 // Cut into existing land instead of filling the bay; overlapping collars must
 // never shave another city's reserved construction core.
 if(aprons&&coreWeight>0&&originalSurface>=sea)for(const [i,p] of TARGET_CITY_PLATFORMS.entries()){
  const nx=(x-p.center[0])/p.radii[0],nz=(z-p.center[1])/p.radii[1],r=Math.hypot(nx,nz);
  if(r<.78||r>1.84)continue;
  const d=r/(1+.045*Math.sin(Math.atan2(nz,nx)*3+i*1.4));
  const facing=smooth(nz,.15,.5)*(1-smooth(Math.abs(nx),.75,1.35));
  let level=p.height-.2;
  if(d>.89)level=mix(p.height-.2,p.height-8,smooth(d,.89,.99));
  if(d>1.24)level=mix(p.height-8,p.height-16,smooth(d,1.24,1.34));
  const weight=facing*coreWeight*smooth(originalSurface-sea,.5,5)*smooth(r,.78,.88)*(1-smooth(d,1.56,1.72));
  y=mix(y,Math.max(sea-3,level),weight);
 }
 // A low, recessed connection between the two shoulders, rather than the
 // overlapping capsule ends producing a tall narrow wall across the bay.
 // This operation only lowers land and keeps at least 4m above the sea where
 // the original surface had that clearance. It cannot fill a water opening.
 if(saddle){
  const across=1-smooth(Math.abs(x-1),16,31);
  const along=smooth(z,-60,-52)*(1-smooth(z,-10,2));
  const crest=4+.037*(x-1)*(x-1);
  const ledgeZ=z+2.3*Math.sin(x*.12);
  const frontRetreat=valleyBenches
   ?4*smooth(ledgeZ,-43,-40)+7*smooth(ledgeZ,-34,-31)+8*smooth(ledgeZ,-24,-21)
   :21*smooth(z,-43,-10);
  const cap=Math.max(sea+4,crest-frontRetreat);
  y=mix(y,Math.min(y,cap),across*along);
  if(valleyBenches){
   // One broad shoulder shelf, not another concentric step around the whole
   // valley. It occupies existing dry land on the old-city side only.
   const shelf=smooth(x,-30,-26)*(1-smooth(x,-10,-5))*smooth(z,-38,-33)*(1-smooth(z,-19,-13));
   const dry=smooth(y-sea,4,10);
   y=mix(y,9-.012*(z+27),shelf*dry*coreWeight);
  }
 }
 return Math.max(sea-3,y);
}
export function applyTargetTerrainCandidate(castle,{radius=160,curves=null,railCliffSamples=null,coastalCliffCuts=null,cliffTransitRelease=null}={}){
 const params=targetCityParams();
 if(params.get('citadelTerrainFirst')!=='1'||params.get('citadelTargetRemesh')!=='1')return null;
 const source=castle.getObjectByName('citadel-oskar-grid-mountain-surface');if(!source)return null;
 castle.updateWorldMatrix(true,true);const seaAt=createCastleOceanSampler(castle.matrixWorld,radius),cache=new Map();
 const sea=(x,z)=>{const key=x+','+z;if(!cache.has(key))cache.set(key,seaAt(x,z));return cache.get(key);};
 const aprons=params.get('citadelTerraceAprons')==='1';
 const saddle=params.get('citadelRecessedSaddle')==='1';
 const valleyBenches=params.get('citadelValleyBenches')==='1';
 if(!railCliffSamples&&curves&&Object.keys(curves).length&&params.get('citadelRailCliff')!=='0'){
  const lanes={};for(const[name,curve]of Object.entries(curves)){const count=Math.ceil(curve.getLength());lanes[name]={samples:Array.from({length:count},(_,i)=>({i,world:curve.getPointAt(i/count).toArray()}))};}railCliffSamples={castleMatrix:castle.matrixWorld,lanes};
 }
 const newCityRetreat=params.get('citadelNewCityRetreat')!=='0'?createTargetNewCityRetreatField({platforms:TARGET_CITY_PLATFORMS}):null;
 const railCliff=railCliffSamples?createTargetRailCliffField({...railCliffSamples,platforms:TARGET_CITY_PLATFORMS}):null;
 const coastCut=coastalCliffCuts?createTargetCoastalCliffCutField({...coastalCliffCuts,platforms:TARGET_CITY_PLATFORMS}):null;
 const afterCut=(x,z)=>{const s=sea(x,z);if(s===null)return null;const original=targetTerrainHeight(x,z,s,{aprons,saddle,valleyBenches});const railHeight=railCliff?railCliff.height(x,z,original,s):original;const retreated=newCityRetreat?newCityRetreat.height(x,z,railHeight,s):railHeight;return coastCut?coastCut.height(x,z,retreated,s):retreated;};
 const oldShoreApron=cliffTransitRelease&&coastCut?createTargetOldShoreApronField({castleMatrix:castle.matrixWorld,worldCurve:cliffTransitRelease.segments.center.oldShore,sampleTerrain:afterCut,sampleSea:sea,platforms:TARGET_CITY_PLATFORMS,profile:'stepped-rock-link',maxGap:32,maxChartX:-47,walkwayHeight:6.9,vehicleTop:5.71}):null;
 const {geometry,audit}=buildTargetTerrainHeightfield({bounds:{minX:-143,maxX:143,minZ:-72,maxZ:107},step:1.7,floorAt:(x,z)=>{const s=sea(x,z);return s===null?null:s-12;},heightAt:(x,z)=>{const s=sea(x,z),h=afterCut(x,z);return s===null||h===null?null:oldShoreApron?oldShoreApron.height(x,z,h,s):h;}});
 const toMesh=source.matrixWorld.clone().invert().multiply(castle.matrixWorld);geometry.applyMatrix4(toMesh);
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count*3).fill(1),3));
 source.geometry=geometry;source.userData.targetTerrainCandidate=true;
 const retired=[];castle.traverse(o=>{if(o!==source&&o.isMesh&&/^(citadel-coastal-cliff-seal|highland-ravine-wall|citadel-backdrop-ridge|new-city-rock-shoulder|old-shore-blender-rock-support)/.test(o.name)){o.visible=false;o.userData.supersededTerrain=true;retired.push(o.name);}});
 const report={revision:saddle&&valleyBenches?'target-terrain-r09-asymmetric-shoulder':saddle?'target-terrain-r07-recessed-saddle':aprons?'target-terrain-r06-front-aprons':'target-terrain-r04',aprons,saddle,valleyBenches,railCliff:railCliff?.report??null,newCityRetreat:newCityRetreat?.report??null,status:'terrain-only candidate; city and routes not rebuilt',defaultEnabled:false,mesh:audit,platforms:TARGET_CITY_PLATFORMS,ridges:TARGET_TERRAIN_RIDGES,retired,oldSourceGeometryReplaced:true,worldSaveModified:false};
 report.coastalCliffCut=coastCut?.report??null;
 report.oldShoreApron=oldShoreApron?.report??null;
 source.userData.targetTerrainReport=report;return report;
}
