import {resolveMountainParams} from './mountainRelease.js';
import {refreshRidgeFlowClouds} from './ridgeFlowClouds.js';
import * as THREE from 'three';
import {refineRockFaces} from './mountainRockGeometry.js';
import {rockSurfaceOptions,rockCrestFold} from './mountainRockNormals.js';
import {addMountainCrags} from './mountainCrags.js';
import {conformNewCityBackdropToOcean} from './newCityBackdrop.js';
import {openFinalMountainRailCoast} from './mountainRailCoast.js';
import {shapeMountainLandform,landformProtection} from './mountainLandform.js';
import {shapeMountainSummits} from './mountainSummits.js';
import {plantStudyMountains} from './mountainPlanting.js';
import {buildMountainSurfaceIndex} from './mountainSurfaceIndex.js';
import {applyMountainLightCandidate} from './mountainLightField.js';

// Approved target: citadel-current-diagram/citadel-istanbul-study-v3.png.
// Rock and planting study after final bay relocation. Existing building and
// walkable meshes remain fixed; r13 separately raises the dry rear-coast railway
// through its shared construction curve. Round 0 is the comparison view.
const ROCK_NAMES=/^(citadel-oskar-grid-mountain-surface|highland-ravine-wall-west|citadel-backdrop-ridge-.*|new-city-rock-shoulder|citadel-coastal-cliff-seal|old-shore-blender-rock-support)$/;
export function mountainStudyRound(){
 const value=typeof location==='undefined'?null:resolveMountainParams(location.search).params.get('citadelMountain');
 return value===null?13:Math.max(0,Math.min(13,Number(value)||0));
}
let geologyMap;
function rockMask(){
 if(geologyMap)return geologyMap;
 const n=256,data=new Uint8Array(n*n*4),hash=(x,y)=>{const v=Math.sin(x*127.1+y*311.7)*43758.5453;return v-Math.floor(v);};
 const noise=(x,y)=>{const a=Math.floor(x),b=Math.floor(y),u=x-a,v=y-b,s=u*u*(3-2*u),t=v*v*(3-2*v);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(a,b),hash(a+1,b),s),THREE.MathUtils.lerp(hash(a,b+1),hash(a+1,b+1),s),t);};
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const i=(y*n+x)*4;
  data[i]=255*(noise(x/32,y/32)*.55+noise(x/11,y/11)*.30+noise(x/3,y/3)*.15);
  data[i+1]=255*noise(x/17,y/47);
  data[i+2]=255*(noise(x/3,y/3)*.75+hash(x,y)*.25);
  data[i+3]=255;
 }
 geologyMap=new THREE.DataTexture(data,n,n);geologyMap.wrapS=geologyMap.wrapT=THREE.RepeatWrapping;
 geologyMap.minFilter=THREE.LinearMipmapLinearFilter;geologyMap.magFilter=THREE.LinearFilter;
 geologyMap.generateMipmaps=true;geologyMap.anisotropy=4;geologyMap.needsUpdate=true;
 geologyMap.name='citadel-natural-rock-noise';return geologyMap;
}
function rockMaterial(original,inverse,radius,round,surface={pass:0,bump:.38},normalToCastle=new THREE.Matrix3()){
 const m=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.97,metalness:0,side:original.side,flatShading:!surface.pass});
 m.name='citadel-blue-grey-geology';
 const mossExplicit=Number.isFinite(surface.moss),mossGain=mossExplicit?THREE.MathUtils.clamp(surface.moss,0,1):(round>=12?.60:0);
 m.userData.effectiveMossGain=mossGain;
 const detailGain=Number.isFinite(surface.detail)?THREE.MathUtils.clamp(surface.detail,0,1):1,detailOverride=detailGain!==1;
 m.userData.effectiveRockDetailGain=detailGain;
 const base=new THREE.Color(round>=4?'#68838c':'#747f87'),shade=new THREE.Color(round>=4?'#405661':'#465662'),chalk=new THREE.Color('#a2aaa9');
 m.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,{mtInverse:{value:inverse},mtRadius:{value:radius},mtMap:{value:rockMask()},mtBase:{value:base},mtShade:{value:shade},mtChalk:{value:chalk},mtVerdure:{value:new THREE.Color('#485e49')}});
  shader.vertexShader='varying vec3 vMt; varying vec3 vMtWorld; uniform mat4 mtInverse;\n'+shader.vertexShader;
  if(surface.pass){shader.uniforms.mtNormalToCastle={value:normalToCastle};shader.vertexShader='varying vec3 vMtShade; uniform mat3 mtNormalToCastle;\n'+shader.vertexShader;}
  // Keep the affine corner field linear across unequal refinement counts.
  // Three normal_fragment_begin normalizes after raster interpolation.
  if(surface.pass===4)shader.vertexShader=shader.vertexShader.replace('#include <normal_vertex>',`#include <normal_vertex>
   #ifndef FLAT_SHADED
    vNormal = transformedNormal;
   #endif`);
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
   vec4 mtWorld=modelMatrix*vec4(transformed,1.0);
   vMt=(mtInverse*mtWorld).xyz; vMtWorld=mtWorld.xyz;${surface.pass?'vMtShade=mtNormalToCastle*objectNormal;':''}`);
  if(mossExplicit)shader.uniforms.mtMossGain={value:mossGain};
  if(detailOverride)shader.uniforms.mtDetailGain={value:detailGain};
  shader.fragmentShader=`${mossExplicit?'uniform float mtMossGain;':''}${detailOverride?'uniform float mtDetailGain;':''}varying vec3 vMt; varying vec3 vMtWorld; uniform float mtRadius;
   uniform sampler2D mtMap; uniform vec3 mtBase; uniform vec3 mtShade; uniform vec3 mtChalk; uniform vec3 mtVerdure; uniform mat4 mtInverse;
   vec3 mtSample(vec3 p,vec3 w){return texture2D(mtMap,p.yz).rgb*w.x+texture2D(mtMap,p.xz).rgb*w.y+texture2D(mtMap,p.xy).rgb*w.z;}
   float mtRelief;\n`+shader.fragmentShader;
  if(surface.pass)shader.fragmentShader='varying vec3 vMtShade;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec3 mtN=normalize(cross(dFdx(vMt),dFdy(vMt)));
   vec3 mtW=pow(abs(${surface.pass?'normalize(vMtShade)':'mtN'}),vec3(4.0));mtW/=max(.001,mtW.x+mtW.y+mtW.z);
   vec3 mtMacro=mtSample(vMt*.027,mtW),mtGrain=mtSample(vMt*.21,mtW);
   float mtAltitude=length(vMtWorld)-mtRadius;
   float mtWet=1.0-smoothstep(.0,3.5,mtAltitude);
   float mtWash=smoothstep(.25,.78,mtMacro.r);
   vec3 mtColor=mix(mtShade,mtBase,.65+.35*mtWash);
   mtColor=mix(mtColor,mtChalk,smoothstep(.57,.86,mtMacro.g)*${round>=4?'.13':'.35'});
   float mtBand=sin((mtAltitude+vMt.x*.11+mtMacro.r*${round>=4?'5.8':'2.1'})*${round>=4?'1.9':'3.1'});
   float mtAA=max(.025,fwidth(mtBand)*1.2);
   float mtSeam=1.0-smoothstep(-.98-mtAA,-.83+mtAA,mtBand);
   float mtJointPhase=vMt.x*${round>=4?'.13':'.45'}+vMt.z*.34+mtMacro.g*${round>=4?'4.5':'1.8'};
   float mtJoint=1.0-smoothstep(.012,.055+fwidth(mtJointPhase),abs(fract(mtJointPhase)-.5));
   float mtDetail=${round>=2?'1.0':'0.0'}${detailOverride?'*mtDetailGain':''};
   mtJoint*=${round>=4?'smoothstep(.38,.57,mtMacro.b)*smoothstep(.28,.56,mtGrain.g)':'1.0'};
   mtColor*=1.0-mtDetail*(mtSeam*.16+mtJoint*.19);
   mtColor*=1.0+mtDetail*(mtGrain.b-.5)*.16;
   mtColor=mix(mtColor,mtColor*vec3(.48,.59,.61),mtWet*.65);
   vec3 mtUp=normalize((mtInverse*vec4(normalize(vMtWorld),0.0)).xyz);
   float mtLedge=smoothstep(.64,.91,abs(dot(mtN,mtUp)));
   float mtMoss=mtLedge*smoothstep(.32,.64,mtMacro.r)*smoothstep(2.5,8.0,mtAltitude);
   mtColor=mix(mtColor,mtVerdure,mtMoss*${mossExplicit?'mtMossGain':round>=12?'.60':'0.0'});
   diffuseColor.rgb=mtColor;
   mtRelief=mtDetail*(mtGrain.r*.13-mtSeam*.035-mtJoint*.055);`);
  if(round>=3)shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
   vec3 mtDx=dFdx(-vViewPosition),mtDy=dFdy(-vViewPosition);
   vec3 mtR1=cross(mtDy,normal),mtR2=cross(normal,mtDx);
   float mtDet=dot(mtDx,mtR1);
   vec3 mtGrad=sign(mtDet)*(dFdx(mtRelief)*mtR1+dFdy(mtRelief)*mtR2);
   normal=normalize(abs(mtDet)*normal-mtGrad*${surface.pass?surface.bump.toFixed(4):'.38'});`);
 };
 m.customProgramCacheKey=()=>`citadel-mountain-study-${round}-v1${surface.pass?`-surface${surface.pass}-bump${surface.bump}`:''}${mossExplicit?'-moss-uniform-v1':''}${detailOverride?'-detail-uniform-v1':''}`;
 if(surface.pass)m.userData.rockSurface={...surface,positionChanged:false,geometricSlopePreserved:true};
 return m;
}
export function applyCitadelMountainStudy(castle,radius=160,curves={}){
 const round=mountainStudyRound();if(!round||!castle||castle.userData.mountainStudy)return null;
 // Bay relocation moves the backdrop after its original clearance pass.
 // Reproject its authored surface against the final live railway, not the
 // previous city transform. WeakMap source positions prevent double bending.
 if(round>=7)conformNewCityBackdropToOcean(castle.getObjectByName('highland-west-city'),radius,curves.red||Object.values(curves)[0]);
 const railCoast=round>=8?openFinalMountainRailCoast(castle,radius,curves):null;
 castle.updateWorldMatrix(true,true);const inverse=castle.matrixWorld.clone().invert(),surfaces=[];
 castle.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&ROCK_NAMES.test(o.name)&&!Array.isArray(o.material))surfaces.push(o);});
 const rail=[];for(const curve of Object.values(curves))for(let i=0;i<1000;i++)rail.push(curve.getPointAt(i/1000));
 const protectedBoxes=[];castle.traverse(o=>{if(o.isMesh&&(o.userData.westCityWalkable||/bridge-deck|stair|town-terrace-.*floor/.test(o.name)))protectedBoxes.push(new THREE.Box3().setFromObject(o));});
 const structured=resolveMountainParams(globalThis.location?.search||'').params.get('citadelRidges')!=='0';

 const summits=round>=11?(structured?shapeMountainLandform:shapeMountainSummits)(castle,{rail,protectedBoxes:structured?landformProtection(castle):protectedBoxes}):null;
 const rockSurface=rockSurfaceOptions();
 // Candidate 2 changes shading-normal protection only. The geometric relief
 // selection below retains the original world-AABB and rail constraints.
 const normalProtectedBoxes=rockSurface.pass===2?landformProtection(castle):protectedBoxes;
 const geometry=[],cragSources=surfaces.map(m=>({name:m.name,geometry:m.geometry,matrixWorld:m.matrixWorld.clone()}));
 for(const mesh of surfaces){
  if(round>=5){
   const normalMatrix=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
   const toCastle=inverse.clone().multiply(mesh.matrixWorld),ridgeGraph=summits?.ridgeGraph||[];
   const protectedFace=points=>/ravine-wall|cliff-seal|shore-blender/.test(mesh.name)||points.some(point=>{
    const world=point.clone().applyMatrix4(mesh.matrixWorld);
    if(world.length()<radius+4||normalProtectedBoxes.some(box=>box.distanceToPoint(world)<4)||rail.some(p=>p.distanceToSquared(world)<144))return true;
    const p=point.clone().applyMatrix4(toCastle);
    // Conservative crest corridor, not a complete authored edge graph.
    return ridgeGraph.some(({a,b})=>{const dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz;if(!l)return false;
     const t=THREE.MathUtils.clamp(((p.x-a[0])*dx+(p.z-a[1])*dz)/l,0,1);
     return Math.hypot(p.x-a[0]-t*dx,p.z-a[1]-t*dz)<3&&p.y>Math.min(a[2],b[2])-6;});
   });
   const refined=refineRockFaces(mesh.geometry,{trace:new URLSearchParams(globalThis.location?.search||'').get('citadelRockTrace')==='1',amplitude:rockSurface.relief,surfaceNormals:rockSurface.pass?{pass:rockSurface.pass,protectedFace,
    featureEdge:(points,a,b)=>rockCrestFold(points,a,b,{toCastle,normalMatrix,ridgeGraph}),
    protectionBounds:rockSurface.pass>=3?'shore-and-geometric-feature-edges-only':rockSurface.pass===2?'oriented-landform-bounds':'world-aabb'}:null,selectTriangle:(a,b,c,n)=>{
    const center=a.clone().add(b).add(c).multiplyScalar(1/3).applyMatrix4(mesh.matrixWorld),up=center.clone().normalize();
    if(center.length()<radius+4||Math.abs(n.clone().applyMatrix3(normalMatrix).normalize().dot(up))>.68)return false;
    if(protectedBoxes.some(box=>box.distanceToPoint(center)<4))return false;
    if(rail.some(p=>p.distanceToSquared(center)<144))return false;
    return true;
   }});
   Object.assign(refined.userData.rockRefinement,{reliefAmplitude:rockSurface.relief,reliefCandidate:rockSurface.relief!==.65});
   geometry.push({name:mesh.name,...refined.userData.rockRefinement});mesh.geometry=refined;
  }
  mesh.userData.mountainStudyOriginalMaterial=mesh.material.uuid;mesh.material=rockMaterial(mesh.material,inverse,radius,round,mesh.geometry.userData.rockSurfaceNormals?rockSurface:(rockSurface.moss!==undefined||rockSurface.detail!==undefined?{pass:0,bump:.38,moss:rockSurface.moss,detail:rockSurface.detail}:undefined),new THREE.Matrix3().getNormalMatrix(inverse.clone().multiply(mesh.matrixWorld)));
 }
 let crags=null;
 if(round>=6)crags=addMountainCrags(castle,round>=7?cragSources:surfaces,rockMaterial(surfaces[0].material,inverse,radius,round,rockSurface.moss!==undefined||rockSurface.detail!==undefined?{pass:0,bump:.38,moss:rockSurface.moss,detail:rockSurface.detail}:undefined),{radius,rail,protectedBoxes}).userData.placement;
 // One immutable snapshot after final geometry/material sides/transforms.
 // Optional until same-scene placement and cloud-field parity are verified.
 const useIndex=resolveMountainParams(globalThis.location?.search||'').params.get('citadelSurfaceIndex')==='1';
 castle.updateWorldMatrix(true,true);
 const indexStart=performance.now(),surfaceIndex=useIndex?buildMountainSurfaceIndex(surfaces):null;
 const sampling=surfaceIndex?{...surfaceIndex.stats,buildMs:performance.now()-indexStart}:null;
 const planting=round>=9?plantStudyMountains(castle,surfaces,{radius,rail,protectedBoxes,preservePalette:round>=10,spacing:round>=12?3.4:4.5,surfaceIndex}).userData.planting:null;
 const cloudField=refreshRidgeFlowClouds(castle,{surfaces,rail,protectedBoxes,radius,surfaceIndex});
 const lightField=applyMountainLightCandidate(castle,surfaces,{plantingRoot:castle.getObjectByName('citadel-study-mountain-planting'),cragRoot:castle.getObjectByName('citadel-study-fractured-buttresses')});
 const {params:resolvedSearch,...release}=resolveMountainParams(globalThis.location?.search||'');
 return castle.userData.mountainStudy={release,cloudField,sampling,lightField,round,version:1,target:'citadel-mountain-two-hour/approved-target.png',surfaces:surfaces.map(m=>m.name),geometryChanged:round>=5,geometry,crags,railCoast,planting,summits,shader:'world-anchored blue-grey rock, mineral wash, strata and joint relief'};
}
