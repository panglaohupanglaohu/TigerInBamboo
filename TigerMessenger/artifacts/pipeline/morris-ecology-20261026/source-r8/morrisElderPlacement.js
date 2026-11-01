import * as T from 'three';
import {quatYToDir} from './sphereMath.js';
import {worldToFlatXZ,groundLiftAt,ISLAND_FLAT_R} from './hills.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
/** Keep actual model identities and collider references, not replacement props. */
export function prepareMorrisElderEnsemble({elder,camp,playZone,corridorForest,colliders,hills,R=160}){
 if(!elder)return null;elder.updateWorldMatrix(true,true);const originalSampler=hills.sampleRadius?.bind(hills);const anchor=elder.getWorldPosition(V()),frame=quatYToDir(anchor.clone().normalize()),inverse=frame.clone().invert(),candidates=new Set([elder]);
 const near=o=>o?.getWorldPosition&&o.getWorldPosition(V()).distanceTo(anchor)<16;
 for(const o of camp?.group?.children??[])if(o!==elder&&o.isMesh&&near(o)&&o.name!=='camp-flat-patch'&&!o.userData.shallowWaterDecoration&&new T.Box3().setFromObject(o).getSize(V()).length()<12)candidates.add(o);
 for(const o of corridorForest?.meshes??[])if(near(o))candidates.add(o);
 for(const o of playZone?.meshes??[])if(o.userData?.settle&&near(o))candidates.add(o);
 const rows=[];for(const object of candidates){const world=object.getWorldPosition(V()),q=object.getWorldQuaternion(new T.Quaternion()),floor=originalSampler?.(world);const matching=colliders.filter(c=>c.position?.distanceTo(world)<.12);rows.push({object,world,relative:world.clone().sub(anchor).applyQuaternion(inverse),relativeQ:inverse.clone().multiply(q),scale:object.getWorldScale(V()),clearance:object===elder?0:Math.max(-.12,world.length()-(Number.isFinite(floor)?floor:R+.6)),colliders:matching,parent:object.parent?.uuid});}
 const moved=new Set(rows.flatMap(r=>r.colliders)),fixed=colliders.filter(c=>!moved.has(c)&&c.position);
 const sourceSample=position=>{const f=worldToFlatXZ(position,R);if(!f||(Math.hypot(f.x,f.z)>ISLAND_FLAT_R+.35&&groundLiftAt(f.x,f.z)<=.61))return null;const r=originalSampler?.(position);return Number.isFinite(r)&&r>R+.05?r:null;};
 return{anchor,rows,fixed,sourceSample};
}
export function moveMorrisElderEnsemble({ensemble,island}){
 if(!ensemble)return null;const {root,heightAt,landscape}=island,destination={x:landscape.castle.position.x+11,z:landscape.castle.position.z};const moved=[];
 for(const row of ensemble.rows){const x=destination.x+row.relative.x,z=destination.z+row.relative.z;if(island.radialHeight(x,z)==null)continue;root.add(row.object);row.object.position.set(x,heightAt(x,z)+row.clearance+.025,z);row.object.quaternion.copy(row.relativeQ);row.object.scale.copy(row.scale);row.object.updateWorldMatrix(true,true);const p=row.object.getWorldPosition(V());row.colliders.forEach(c=>c.position.copy(p));moved.push({uuid:row.object.uuid,name:row.object.name||row.object.geometry?.type||'original-prop',originalWorld:row.world.toArray(),newWorld:p.toArray(),newLocal:row.object.position.toArray(),originalParent:row.parent,sameModel:true});}
 const report={anchor:ensemble.anchor.toArray(),elderOriginalUuid:ensemble.rows[0].object.uuid,movedCount:moved.length,moved,originalInstrumentAndMusicKeysPreserved:!!ensemble.rows[0].object.userData.musicKeys,interactionUsesOriginalWorldPosition:true};island.elderEnsemble=ensemble;island.report.elderPlacement=report;return report;
}
/** New authored island owns its overlap, including visible/depth/distance/support. */
export function installMorrisGroundOwnership({island,hills,platforms=[]}){
 const root=island.root;root.updateWorldMatrix(true,true);const inv=root.matrixWorld.clone().invert(),radius=island.report.radius;
 const owns=p=>{const q=p.clone().applyMatrix4(inv);return q.y> -45&&q.y<80&&Math.hypot(q.x,q.z)<radius*(1+.055*Math.sin(Math.atan2(q.z,q.x)*3+.7)+.028*Math.cos(Math.atan2(q.z,q.x)*7));};
 const compile=base=>shader=>{base?.(shader);shader.uniforms.morrisGroundFrame={value:inv};shader.uniforms.morrisGroundRadius={value:radius};shader.vertexShader='varying vec3 morrisOriginalWorld;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\n morrisOriginalWorld=(modelMatrix*vec4(transformed,1.)).xyz;');shader.fragmentShader='uniform mat4 morrisGroundFrame;uniform float morrisGroundRadius;varying vec3 morrisOriginalWorld;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
 vec3 mi=(morrisGroundFrame*vec4(morrisOriginalWorld,1.)).xyz;
 float ma=atan(mi.z,mi.x);float me=morrisGroundRadius*(1.+.055*sin(ma*3.+.7)+.028*cos(ma*7.));
 if(mi.y> -45.&&mi.y<80.&&length(mi.xz)<me*.998)discard;`);};
 const targets=[hills.mesh,hills.skirt,...platforms.filter(p=>p.mesh?.userData.authoredMainIslandShell).map(p=>p.mesh)].filter(Boolean);
 for(const mesh of targets){const wrap=base=>{const m=base.clone();m.onBeforeCompile=compile(base.onBeforeCompile?.bind(base));m.customProgramCacheKey=()=>`morris-user-elder-overlap-r1:${base.customProgramCacheKey?.()??''}`;return m;};mesh.material=Array.isArray(mesh.material)?mesh.material.map(wrap):wrap(mesh.material);mesh.customDepthMaterial=wrap(mesh.customDepthMaterial??new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide}));mesh.customDistanceMaterial=wrap(mesh.customDistanceMaterial??new T.MeshDistanceMaterial({side:T.DoubleSide}));}
 const prior=hills.sampleRadius;hills.sampleRadius=p=>owns(p)?-Infinity:prior?.(p);for(const p of platforms){if(!p.mesh?.userData.authoredMainIslandShell)continue;const old=p.topHeightAt;p.topHeightAt=function(position){return owns(position)?-Infinity:old?.call(this,position);};p.mat=p.mesh.material;}
 island.report.originalGroundOwnership={mode:'user-selected elder overlap only; old source geometry retained',meshes:targets.length,shadowMasks:true,supportMasks:true};return{owns};
}
export function applyMorrisSeaPalette(ocean,root,radius){
 const m=ocean?.material;if(!m?.isShaderMaterial||m.userData.morrisSeaPalette)return null;root.updateWorldMatrix(true,true);m.uniforms.uMorrisSeaFrame={value:root.matrixWorld.clone().invert()};
 m.fragmentShader='uniform mat4 uMorrisSeaFrame;\n'+m.fragmentShader;m.fragmentShader=m.fragmentShader.replace('float alpha = uOpacity',`
 {vec3 mp=(uMorrisSeaFrame*vec4(vRadial*160.72,1.)).xyz;
 float mr=(1.-smoothstep(${(radius+22).toFixed(2)},${(radius+100).toFixed(2)},length(mp.xz)))*step(-60.,mp.y);
 vec3 mw=mix(vec3(.23,.52,.60),vec3(.56,.78,.79),1.-depth*.6);
 mw*=mix(.32,1.,uNight);mw+=vec3(.02,.028,.028)*sin(ripplePhase)*.16;
 mw=mix(mw,vec3(.90,.96,.94)*mix(.4,1.,uNight),clamp(shorelineFoam*.45,0.,.55));color=mix(color,mw,mr);}
 float alpha = uOpacity`);m.needsUpdate=true;return m.userData.morrisSeaPalette={revision:1,scope:'bounded Morris coastal sea, matching citadel cyan direction',geometryChanged:false};
}
