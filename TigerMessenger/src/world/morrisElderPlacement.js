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
 if(!ensemble)return null;const {root,heightAt,landscape}=island,destination={x:landscape.musicCourt?.x??landscape.castle.position.x+9,z:landscape.musicCourt?.z??landscape.castle.position.z+6};const moved=[];
 for(const row of ensemble.rows){let x=destination.x+row.relative.x*.6,z=destination.z+row.relative.z*.6,roadNudge=0;const colliderRadius=Math.max(0,...row.colliders.map(c=>c.radius??.4));if(row.object.name==='giantTreeGroup'&&island.route){const dx=destination.x-x,dz=destination.z-z,length=Math.hypot(dx,dz)||1;while(roadNudge<2&&island.route.nearest(x,z).distance<colliderRadius+2.05){x+=dx/length*.2;z+=dz/length*.2;roadNudge+=.2;}}if(island.radialHeight(x,z)==null)continue;root.add(row.object);row.object.position.set(x,heightAt(x,z)+row.clearance+.025,z);row.object.quaternion.copy(row.relativeQ);row.object.scale.copy(row.scale);row.object.updateWorldMatrix(true,true);const p=row.object.getWorldPosition(V());row.colliders.forEach(c=>c.position.copy(p));moved.push({uuid:row.object.uuid,name:row.object.name||row.object.geometry?.type||'original-prop',originalWorld:row.world.toArray(),newWorld:p.toArray(),newLocal:row.object.position.toArray(),originalParent:row.parent,sameModel:true,roadNudge,collisionRadius:Math.max(0,...row.colliders.map(c=>c.radius??.4)),roadEdgeClearance:island.route?island.route.nearest(x,z).distance-Math.max(0,...row.colliders.map(c=>c.radius??.4))-1.6:null});}
 const report={anchor:ensemble.anchor.toArray(),elderOriginalUuid:ensemble.rows[0].object.uuid,movedCount:moved.length,moved,nearbyPropsSpacingRatio:.6,originalInstrumentAndMusicKeysPreserved:!!ensemble.rows[0].object.userData.musicKeys,interactionUsesOriginalWorldPosition:true,musicCourt:landscape.report.musicCourt??null};island.elderEnsemble=ensemble;island.report.elderPlacement=report;island.report.oldSceneMoved=true;island.report.movedScope="original elderly musician and captured nearby props only";return report;
}
/** New authored island owns its overlap, including visible/depth/distance/support. */
export function installMorrisGroundOwnership({island,hills,platforms=[]}){
 const root=island.root;root.updateWorldMatrix(true,true);const inv=root.matrixWorld.clone().invert(),radius=island.report.radius;
 const owns=p=>{const q=p.clone().applyMatrix4(inv);return q.y> -45&&q.y<80&&Math.hypot(q.x,q.z)<radius*(1+.055*Math.sin(Math.atan2(q.z,q.x)*3+.7)+.028*Math.cos(Math.atan2(q.z,q.x)*7));};
 const compile=base=>shader=>{base?.(shader);shader.uniforms.morrisGroundFrame={value:inv};shader.uniforms.morrisGroundRadius={value:radius};shader.vertexShader='varying vec3 morrisOriginalWorld;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\n morrisOriginalWorld=(modelMatrix*vec4(transformed,1.)).xyz;');shader.fragmentShader='uniform mat4 morrisGroundFrame;uniform float morrisGroundRadius;varying vec3 morrisOriginalWorld;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
 {vec3 morrisOwnedPoint=(morrisGroundFrame*vec4(morrisOriginalWorld,1.)).xyz;
 float morrisOwnedAngle=atan(morrisOwnedPoint.z,morrisOwnedPoint.x);float morrisOwnedEdge=morrisGroundRadius*(1.+.055*sin(morrisOwnedAngle*3.+.7)+.028*cos(morrisOwnedAngle*7.));
 if(morrisOwnedPoint.y> -45.&&morrisOwnedPoint.y<80.&&length(morrisOwnedPoint.xz)<morrisOwnedEdge*.998)discard;}`);};
 const targets=[hills.mesh,hills.skirt,...platforms.filter(p=>p.mesh?.userData.authoredMainIslandShell).map(p=>p.mesh)].filter(Boolean);
 for(const mesh of targets){const wrap=base=>{const m=base.clone();m.onBeforeCompile=compile(base.onBeforeCompile?.bind(base));m.customProgramCacheKey=()=>`morris-user-elder-overlap-r1:${base.customProgramCacheKey?.()??''}`;return m;};mesh.material=Array.isArray(mesh.material)?mesh.material.map(wrap):wrap(mesh.material);mesh.customDepthMaterial=wrap(mesh.customDepthMaterial??new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide}));mesh.customDistanceMaterial=wrap(mesh.customDistanceMaterial??new T.MeshDistanceMaterial({side:T.DoubleSide}));}
 const prior=hills.sampleRadius;hills.sampleRadius=p=>owns(p)?-Infinity:prior?.(p);for(const p of platforms){if(!p.mesh?.userData.authoredMainIslandShell)continue;const old=p.topHeightAt;p.topHeightAt=function(position){return owns(position)?-Infinity:old?.call(this,position);};p.mat=p.mesh.material;}
 island.report.originalGroundOwnership={mode:'user-selected elder overlap only; old source geometry retained',meshes:targets.length,shadowMasks:true,supportMasks:true};return{owns};
}
export function applyMorrisSeaPalette(ocean,root,radius,curves=[]){
 const m=ocean?.material;if(!m?.isShaderMaterial||m.userData.morrisSeaPalette)return null;root.updateWorldMatrix(true,true);m.uniforms.uMorrisSeaFrame={value:root.matrixWorld.clone().invert()};
 const extent=radius*1.1,size=256,data=new Uint8Array(size*size),points=curves.filter(c=>c?.getSpacedPoints).flatMap(c=>c.getSpacedPoints(1200)).map(p=>p.clone().applyMatrix4(m.uniforms.uMorrisSeaFrame.value)).filter(p=>Math.hypot(p.x,p.z)<extent+4);
 for(let j=0;j<size;j++)for(let i=0;i<size;i++){const x=((i+.5)/size*2-1)*extent,z=((j+.5)/size*2-1)*extent,a=Math.atan2(z,x),edge=radius*(1+.055*Math.sin(a*3+.7)+.028*Math.cos(a*7));if(Math.hypot(x,z)>edge*.98)continue;if(points.some(p=>(p.x-x)**2+(p.z-z)**2<2.5**2))data[j*size+i]=255;}
 const texture=new T.DataTexture(data,size,size,T.RedFormat,T.UnsignedByteType);texture.minFilter=texture.magFilter=T.NearestFilter;texture.generateMipmaps=false;texture.needsUpdate=true;m.uniforms.uMorrisDryRail={value:texture};
 m.fragmentShader='uniform mat4 uMorrisSeaFrame;uniform sampler2D uMorrisDryRail;\n'+m.fragmentShader;m.fragmentShader=m.fragmentShader.replace('float alpha = uOpacity',`
 {vec3 mp=(uMorrisSeaFrame*vec4(vRadial*160.72,1.)).xyz;
 vec2 railUV=mp.xz/${(extent*2).toFixed(3)}+.5;if(all(greaterThanEqual(railUV,vec2(0.)))&&all(lessThan(railUV,vec2(1.)))&&mp.y> -45.&&texture2D(uMorrisDryRail,railUV).r>.5)discard;
 float mr=(1.-smoothstep(${(radius+22).toFixed(2)},${(radius+100).toFixed(2)},length(mp.xz)))*step(-60.,mp.y);
 vec3 mw=mix(vec3(.23,.52,.60),vec3(.56,.78,.79),1.-depth*.6);
 mw*=mix(.32,1.,uNight);mw+=vec3(.02,.028,.028)*sin(ripplePhase)*.16;
 mw=mix(mw,vec3(.90,.96,.94)*mix(.4,1.,uNight),clamp(shorelineFoam*.45,0.,.55));color=mix(color,mw,mr);}
 float alpha = uOpacity`);m.needsUpdate=true;return m.userData.morrisSeaPalette={revision:1,scope:'bounded Morris coastal sea, matching citadel cyan direction',geometryChanged:false,legacyRailDryCorridor:true};
}
