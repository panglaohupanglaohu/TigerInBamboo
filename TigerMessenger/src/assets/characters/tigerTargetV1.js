import {createSwampGroundRayIndex} from '../../world/swampGroundRayIndex.js';
import * as THREE from 'three';
import { createTigerFaceLoft, TIGER_MUZZLE_SECTIONS, TIGER_BRIDGE_SECTIONS } from './tigerFaceAnatomy.js';
import { TIGER_CORAL_PALETTE, TIGER_WALK, tigerStrideLength, sampleTigerWalk } from './tigerCoralGait.js';
export const TIGER_TARGET_ROUND=40;
export function applyTigerTargetV1(tiger){
 const nodes=new Map();tiger.traverse(n=>{if(n.userData.blenderSourceNode)nodes.set(n.userData.blenderSourceNode,n);});
 const head=nodes.get('n8'),body=nodes.get('n1'),neck=nodes.get('n6');if(!head||!body||!neck)return;
 const edit=(id,fn)=>{const n=nodes.get(id);if(!n?.geometry)return;n.geometry=n.geometry.clone();const p=n.geometry.attributes.position;for(let i=0;i<p.count;i++)fn(p,i);p.needsUpdate=true;n.geometry.computeVertexNormals();n.geometry.computeBoundingSphere();return n;};
 edit('n2',(p,i)=>{const z=p.getZ(i);if(z>1.25){const k=(z-1.25)/1.335;p.setZ(i,1.25+(z-1.25)*.40);p.setX(i,p.getX(i)*(1-.30*k));}});
 // The nape and throat form one continuous, bending loft, from scapula to skull.
 const rings=24,sides=28,positions=new Float32Array((rings+1)*(sides+1)*3),uvs=[],indices=[];
 for(let i=0;i<=rings;i++)for(let j=0;j<=sides;j++){uvs.push(j/sides,i/rings);if(i<rings&&j<sides){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,a+1,b,b,a+1,b+1);}}
 for(let j=1;j<sides-1;j++){indices.push(0,j+1,j);const end=rings*(sides+1);indices.push(end,end+j,end+j+1);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);neck.geometry=geo;
 // Preserve the approved coat shader; remove stale pre-loft vertex shading.
 neck.material=nodes.get('n2').material.clone();neck.material.vertexColors=false;
 neck.material.onBeforeCompile=nodes.get('n2').material.onBeforeCompile;neck.material.customProgramCacheKey=()=> 'tiger-target-neck-1';
 const p0=new THREE.Vector3(0,.48,.40),p1=new THREE.Vector3(0,.60,1.30),p2=new THREE.Vector3(),p3=new THREE.Vector3(),point=new THREE.Vector3(),tangent=new THREE.Vector3(),up=new THREE.Vector3(),endDir=new THREE.Vector3();
 const curve=new THREE.CubicBezierCurve3(p0,p1,p2,p3);
 const updateNeck=()=>{head.updateMatrix();p3.set(0,-.1,-.43).applyMatrix4(head.matrix);endDir.set(0,0,1).transformDirection(head.matrix);p2.copy(p3).addScaledVector(endDir,-.42);
  for(let i=0;i<=rings;i++){const u=i/rings,s=u*u*(3-2*u);curve.getPoint(u,point);curve.getTangent(u,tangent);up.set(0,tangent.z,-tangent.y).normalize();const rx=THREE.MathUtils.lerp(.77,.60,s),ry=THREE.MathUtils.lerp(.62,.54,s);
   for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2,k=(i*(sides+1)+j)*3;positions[k]=Math.cos(a)*rx;positions[k+1]=point.y+Math.sin(a)*ry*up.y;positions[k+2]=point.z+Math.sin(a)*ry*up.z;}}
  geo.attributes.position.needsUpdate=true;geo.computeVertexNormals();geo.computeBoundingSphere();
 };
 tiger.userData.updateTargetNeck=updateNeck;updateNeck();
 // Throat fur follows the neck's underside even when it bends down, rather than a world-Y bib.
 const neckShader=neck.material.onBeforeCompile;
 neck.material.onBeforeCompile=shader=>{neckShader(shader);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vNeckUv; varying vec3 vNeckNormal;').replace('#include <begin_vertex>','#include <begin_vertex>\nvNeckUv=uv;vNeckNormal=normal;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vNeckUv; varying vec3 vNeckNormal;').replace('float belly=1.-smoothstep(-.82,-.35,vTigerSkin.y);','float belly=0.;').replace('float throat=smoothstep(1.7,2.3,vTigerSkin.z)*(1.-smoothstep(-.3,.35,vTigerSkin.y));','float throat=(1.-smoothstep(-.65,-.15,sin(vNeckUv.x*6.2831853)+.045*sin(vNeckUv.y*180.)))*smoothstep(.1,.7,vNeckUv.y);');
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight*=.91+.09*step(.05,dot(normalize(vNeckNormal),normalize(vec3(-.3,.7,.5))));\n#include <opaque_fragment>');
 };
 neck.material.customProgramCacheKey=()=> 'tiger-target-throat-2';

 // Ease the lower drinking steps: the previous rise exceeded a tiger foreleg.
 const swamp=tiger.parent;
 const grade=y=>y<=30?25.3+(y-25)*.30:26.8+(y-30)*1.32;
 if(swamp?.userData.tigerWalkSurfaces&&!swamp.userData.tigerLandingGraded){
  for(const [stepIndex,step] of swamp.userData.tigerWalkSurfaces.entries()){
   step.geometry=step.geometry.clone();const p=step.geometry.attributes.position;
   for(let i=0;i<p.count;i++){
    // The 9-unit rim opening was wider than the 8.5-unit top stair. Fill only
    // this short landing's two joints; a paw must never cross an invisible
    // quarter-unit crack when turning from the radial climb into rim patrol.
    if(stepIndex===0){
     p.setX(i,p.getX(i)*(4.75/4.25));
     // The outermost tread is also the turning landing. Extend its rear lip
     // locally, so the hind paw has ground while the body turns lakeward.
     // Positive local Z follows the outward entrance axis; lower treads stay.
     if(p.getZ(i)>.30)p.setZ(i,.30+(p.getZ(i)-.30)*(1.65-.30)/(.89142857-.30));
    }
    p.setY(i,grade(step.position.y+p.getY(i))-step.position.y);
   }
   p.needsUpdate=true;step.geometry.computeVertexNormals();step.geometry.computeBoundingBox();step.geometry.computeBoundingSphere();
  }
  const cheeks=swamp.getObjectByName('v2-entry-stone-cheeks');
  for(const block of cheeks?.children||[]){const old=block.position.y;block.position.y=grade(old);block.scale.y=(grade(old+1.825)-grade(old-1.825))/3.65;}
  for(const lamp of swamp.getObjectByName('v2-entry-lamps')?.children||[])if(lamp.userData.entryPatrolClearance!=='outer-rim-lamp')lamp.position.y=grade(lamp.position.y-1.05)+1.05;
  const fronds=swamp.getObjectByName('v2-entry-fronds');if(fronds){const m=new THREE.Matrix4();for(let i=0;i<fronds.count;i++){fronds.getMatrixAt(i,m);m.elements[13]=grade(m.elements[13]-1)+1;fronds.setMatrixAt(i,m);}fronds.instanceMatrix.needsUpdate=true;fronds.computeBoundingSphere();}
  swamp.userData.tigerLandingGraded=true;
 }
 const route=tiger.userData.tigerRoam;
 if(route?.steps?.length){const last=route.steps[route.steps.length-1],r=Math.hypot(last.x,last.z);if(r>0){last.x*=1-.25/r;last.z*=1-.25/r;}}
 // Use actual step support for the drinking stance, not a horizontal body buried in the risers.
 tiger.rotation.order='YXZ';
 const oldUpdate=tiger.userData.update,ray=new THREE.Raycaster(),local=new THREE.Vector3(),world=new THREE.Vector3(),down=new THREE.Vector3(),nosePoint=new THREE.Vector3();let drinkBlend=0;
 const bodyRestXZ=[body.position.x,body.position.z];
 let stridePhase=0;const previousRoot=tiger.position.clone();
 const legIds=['n52','n59','n66','n73'],legRest=legIds.map(id=>nodes.get(id).position.clone());
 const paws=['n55','n62','n69','n76'].map(id=>nodes.get(id));
 const stanceAnchors=[null,null,null,null],lastFootPhases=[null,null,null,null];let anchorMode=null;
 // Retain actual sole X/Z in the lake frame during stance. Moving only the
 // leg's parent-local translation preserves torso travel and the original rig.
 const lockStanceXZ=(swamp,stances)=>{
  tiger.updateWorldMatrix(true,true);
  paws.forEach((paw,i)=>{if(!stances[i])return;
   const center=solePoints(paw)[0].clone(),actual=swamp.worldToLocal(paw.localToWorld(center));
   if(!stanceAnchors[i])stanceAnchors[i]=actual.clone();
   const desired=actual.clone();desired.x=stanceAnchors[i].x;desired.z=stanceAnchors[i].z;
   const leg=nodes.get(legIds[i]),parent=leg.parent;
   const from=parent.worldToLocal(swamp.localToWorld(actual.clone())),to=parent.worldToLocal(swamp.localToWorld(desired));
   leg.position.add(to.sub(from));leg.updateWorldMatrix(false,true);
  });
 };
 const soleCache=new WeakMap(),bellyCache=new WeakMap(),inverseFrame=new THREE.Matrix4();
 const groundIndex=createSwampGroundRayIndex({enabled:new URLSearchParams(globalThis.location?.search||'').get('tigerGroundIndex')!=='0'});tiger.userData.tigerGroundIndex=groundIndex.report;
 let groundSurfaces=[];
 const solePoints=paw=>{
  if(soleCache.has(paw.geometry))return soleCache.get(paw.geometry);
  paw.geometry.computeBoundingBox();const minY=paw.geometry.boundingBox.min.y,a=paw.geometry.attributes.position,flat=[];
  for(let i=0;i<a.count;i++)if(Math.abs(a.getY(i)-minY)<1e-4)flat.push(new THREE.Vector3().fromBufferAttribute(a,i));
  const center=flat.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).multiplyScalar(1/Math.max(1,flat.length)),points=[center];
  for(let i=0;i<16;i++){const dx=Math.cos(i*Math.PI/8),dz=Math.sin(i*Math.PI/8);let best=flat[0],score=-Infinity;for(const p of flat){const dot=p.x*dx+p.z*dz;if(dot>score){score=dot;best=p;}}if(best)points.push(best);}
  soleCache.set(paw.geometry,points);return points;
 };
 const support=(swamp,paw)=>{
  paw.updateWorldMatrix(true,false);
  const samples=[];
  for(const point of solePoints(paw)){
   local.copy(point).applyMatrix4(paw.matrixWorld).applyMatrix4(inverseFrame);const foot=local.clone();
   world.copy(local);world.y=55;world.applyMatrix4(swamp.matrixWorld);down.set(0,-1,0).transformDirection(swamp.matrixWorld);ray.set(world,down);
   const hits=groundIndex.intersectObjects(ray,groundSurfaces);const hit=tiger.userData._bankWalking?hits.find(h=>h.point.clone().applyMatrix4(inverseFrame).y<=(tiger.userData._baseY??55)+1.25):hits[0];samples.push({foot,height:hit?hit.point.clone().applyMatrix4(inverseFrame).y:null});
  }
  const supported=samples.filter(s=>s.height!==null);const best=supported.sort((a,b)=>(b.height-b.foot.y)-(a.height-a.foot.y))[0]||samples[0];
  return {...best,samplesSupported:supported.length};
 };

 const clearTorso=swamp=>{
  const torso=nodes.get('n2'),geo=torso.geometry;
  if(!bellyCache.has(geo)){
   geo.computeBoundingBox();const box=geo.boundingBox,a=geo.attributes.position,bins=new Map();
   for(let i=0;i<a.count;i++){const p=new THREE.Vector3().fromBufferAttribute(a,i);if(p.y>0)continue;const x=Math.min(6,Math.floor((p.x-box.min.x)/(box.max.x-box.min.x)*7)),z=Math.min(17,Math.floor((p.z-box.min.z)/(box.max.z-box.min.z)*18)),key=x+':'+z;if(!bins.has(key)||p.y<bins.get(key).y)bins.set(key,p);}
   bellyCache.set(geo,[...bins.values()]);
  }
  torso.updateWorldMatrix(true,false);let lift=0;
  for(const p of bellyCache.get(geo)){local.copy(p).applyMatrix4(torso.matrixWorld).applyMatrix4(inverseFrame);world.copy(local);world.y=55;world.applyMatrix4(swamp.matrixWorld);down.set(0,-1,0).transformDirection(swamp.matrixWorld);ray.set(world,down);
   const hit=groundIndex.intersectObjects(ray,groundSurfaces)[0];if(hit)lift=Math.max(lift,hit.point.clone().applyMatrix4(inverseFrame).y+.06-local.y);
  }
  if(lift>0){const from=tiger.worldToLocal(swamp.localToWorld(new THREE.Vector3())),to=tiger.worldToLocal(swamp.localToWorld(new THREE.Vector3(0,lift,0)));body.position.add(to.sub(from));}
  return lift;
 };

 tiger.userData.update=function(dt,t,runtime){body.position.x=bodyRestXZ[0];body.position.z=bodyRestXZ[1];legIds.forEach((id,i)=>nodes.get(id).position.copy(legRest[i]));oldUpdate.call(this,dt,t,runtime);const swamp=tiger.parent;
  drinkBlend+=(Number(!!tiger.userData._drinking)-drinkBlend)*Math.min(1,dt*4);tiger.rotation.x=0;
  const distance=Math.hypot(tiger.position.x-previousRoot.x,tiger.position.z-previousRoot.z);previousRoot.copy(tiger.position);
  if(tiger.userData._walking&&distance<1)stridePhase+=distance/tigerStrideLength(tiger.scale.z);
  const swingPhases=[],walking=!!tiger.userData._walking&&!tiger.userData._drinking,footPhases=[],footStances=[];
  for(let i=0;i<4;i++){
   const step=sampleTigerWalk(stridePhase,i,walking),travel=step.travel*(tiger.userData._backwalking?-1:1);footPhases.push(step.phase);footStances.push(step.stance);
   const leg=nodes.get(legIds[i]);leg.rotation.x=0;
   if(walking){leg.position.z=legRest[i].z+travel;leg.position.y=legRest[i].y+TIGER_WALK.clearance*step.swing;}
   if(i<2)leg.position.z-=.95*drinkBlend;
   swingPhases.push(step.swing);
  }
  tiger.userData.targetGait={phase:stridePhase%1,footPhases,swing:swingPhases,stance:footStances,distance,speed:dt>0?distance/dt:0,strideLength:tigerStrideLength(tiger.scale.z)};
  // Small weight transfer follows footfalls; the ground solver below retains sole contact.
  body.rotation.z=walking?.022*Math.sin(stridePhase*Math.PI*2):0;
  body.position.y+=walking?.025*Math.cos(stridePhase*Math.PI*4):0;
  const mode=tiger.userData._mode,groundMode=!tiger.userData._companion&&['patrol','to-steps','descend','drink','ascend','encounter-eye-contact','encounter-opposite-drink','encounter-meeting','encounter-carrier-home','encounter-meet-climb','encounter-meet-return'].includes(mode);
  const waterReturning=mode==='ascend'&&!!tiger.userData._waterReturning;
  const lockFeet=groundMode&&!waterReturning&&!tiger.userData._drinking&&drinkBlend<.01;
  for(let i=0;i<4;i++){
   if(!lockFeet||anchorMode!==mode||distance>=1||!footStances[i]||(lastFootPhases[i]!==null&&footPhases[i]<lastFootPhases[i]-.5))stanceAnchors[i]=null;
   lastFootPhases[i]=footPhases[i];
  }
  anchorMode=mode;
  if(lockFeet)lockStanceXZ(swamp,footStances);
  let initialFeet=[];
  if(groundMode&&!waterReturning&&swamp?.userData.tigerWalkSurfaces){
   swamp.updateWorldMatrix(true,false);inverseFrame.copy(swamp.matrixWorld).invert();groundSurfaces=[...swamp.userData.tigerWalkSurfaces,...(swamp.userData.gregCoralRim?.walkMeshes||[]),...(tiger.userData._bankWalking?(swamp.userData.gregSpatialPlan?.walkMeshes||[]):[])];for(const step of groundSurfaces)step.updateWorldMatrix(true,false);
   initialFeet=paws.map(p=>support(swamp,p));
  }
  const grounded=groundMode&&!waterReturning&&initialFeet.length===4&&initialFeet.every(f=>f.height!==null);
  if(!grounded||!swamp?.userData.tigerWalkSurfaces){
   const supportKind=tiger.userData._swimming?'swimming':tiger.userData._transporting?'carrier-supported':waterReturning||['greet-meet','greet-stay'].includes(mode)?'water-supported':mode==='greet-jump'?'airborne':tiger.userData._companion?'external':'unsupported';
   tiger.userData.tigerTargetSupport={time:t,mode,grounded:false,supportKind,waterHeight:supportKind==='water-supported'?25.15:null,pitch:0,feet:initialFeet.map(p=>({height:p.height,foot:p.foot.toArray(),samplesSupported:p.samplesSupported}))};
   tiger.userData.updateTargetForelimbs?.(drinkBlend,swingPhases);tiger.userData.updateTargetHindlimbs?.(drinkBlend,swingPhases);
   tiger.userData.updateTargetDrinkDetails?.(dt,t,0);return;
  }
  const fore=initialFeet[0],rear=initialFeet[2];
  const span=Math.hypot(fore.foot.x-rear.foot.x,fore.foot.z-rear.foot.z);
  const slope=fore.height!==null&&rear.height!==null?Math.atan2(rear.height-fore.height,Math.max(.1,span)):0;
  const pitch=THREE.MathUtils.lerp(THREE.MathUtils.clamp(slope,-1.1,1.1),THREE.MathUtils.clamp(slope,0,.22),drinkBlend);tiger.rotation.x=pitch;
  // Front limbs remain substantially upright as the back inclines down the steps.
  for(const id of ['n52','n59','n66','n73']){const leg=nodes.get(id);if(leg)leg.rotation.x-=pitch*.8;}
  const feet=paws.map(p=>support(swamp,p)).filter(p=>p.height!=null);if(feet.length)tiger.position.y+=Math.max(...feet.map(p=>p.height+.015-p.foot.y));
  // Each limb settles independently on its sampled tread; avoid dangling forefeet.
  tiger.updateWorldMatrix(true,true);
  paws.forEach((paw,i)=>{const f=support(swamp,paw);if(f.height==null)return;const from=tiger.worldToLocal(swamp.localToWorld(f.foot.clone())),to=f.foot.clone();to.y=f.height+.015+TIGER_WALK.clearance*tiger.scale.y*swingPhases[i];const delta=tiger.worldToLocal(swamp.localToWorld(to)).sub(from);nodes.get(legIds[i]).position.add(delta);});
  // Reach beyond the forefeet rather than folding the face between them.
  body.position.y-=.25*drinkBlend;body.rotation.x+=.16*drinkBlend;
  head.position.z+=.40*drinkBlend;
  head.rotation.x=THREE.MathUtils.lerp(head.rotation.x,.98-pitch-body.rotation.x,drinkBlend);
  tiger.updateWorldMatrix(true,true);const nose=nodes.get('n25'),a=nose.geometry.attributes.position;let min=Infinity,best=new THREE.Vector3();
  for(let i=0;i<a.count;i++){nosePoint.fromBufferAttribute(a,i);nose.localToWorld(nosePoint);swamp.worldToLocal(nosePoint);if(nosePoint.y<min){min=nosePoint.y;best.copy(nosePoint);}}
  const torsoLift=drinkBlend<.01?clearTorso(swamp):0;
  if(drinkBlend>.8){const from=tiger.worldToLocal(swamp.localToWorld(best.clone())),to=best.clone();to.y=25.12;tiger.worldToLocal(swamp.localToWorld(to));body.position.add(to.sub(from));}
  if(lockFeet){
   lockStanceXZ(swamp,footStances);
   // Re-sample the tread at the locked position, not the pre-lock moving foot.
   paws.forEach((paw,i)=>{if(!footStances[i])return;const f=support(swamp,paw);if(f.height===null)return;
    const leg=nodes.get(legIds[i]),parent=leg.parent,from=parent.worldToLocal(swamp.localToWorld(f.foot.clone())),to=f.foot.clone();to.y=f.height+.015;
    parent.worldToLocal(swamp.localToWorld(to));leg.position.add(to.sub(from));leg.updateWorldMatrix(false,true);
   });
   tiger.userData.targetGait.stanceAnchors=stanceAnchors.map(p=>p?.toArray()||null);
  }
  tiger.updateWorldMatrix(true,true);tiger.userData.updateTargetForelimbs?.(drinkBlend,swingPhases);tiger.userData.updateTargetHindlimbs?.(drinkBlend,swingPhases);
  updateNeck();tiger.userData.updateTargetDrinkDetails?.(dt,t,drinkBlend);tiger.userData.tigerTargetSupport={time:t,mode,grounded:true,supportKind:'real-ground',pitch,drinkBlend,torsoLift,feet:paws.map(p=>support(swamp,p)).map(p=>({height:p.height,foot:p.foot.toArray(),samplesSupported:p.samplesSupported})),noseBefore:min};
 };

 // Broad adult head mass stays attached to the original neck pivot and drink probe.
 head.scale.set(1.10,1.02,1.04);
 // Continuous adult cranium: broad temples, narrowed lower jaw and softened forehead.
 const skull=nodes.get('n9'),skullGeo=new THREE.SphereGeometry(1,48,32),skullP=skullGeo.attributes.position;
 for(let i=0;i<skullP.count;i++){
  const y=skullP.getY(i),jaw=1-.15*(1-THREE.MathUtils.smoothstep(y,-.7,-.05));
  skullP.setXYZ(i,skullP.getX(i)*.98*jaw,y*.67-.005-.14*Math.pow(Math.max(0,y),3),skullP.getZ(i)*1.05+.10);
 }
 skullGeo.computeVertexNormals();skullGeo.computeBoundingSphere();skull.geometry=skullGeo;

 // Anatomical face markings use skull-local projection, independent of remeshing UV seams.
 const faceCanvas=document.createElement('canvas');faceCanvas.width=1024;faceCanvas.height=1024;
 const faceCtx=faceCanvas.getContext('2d');faceCtx.fillStyle=TIGER_CORAL_PALETTE.coat;faceCtx.fillRect(0,0,1024,1024);
 const fx=x=>(x+1)*512,fy=y=>(.8-y)/1.6*1024;
 const stroke=(points,w,color)=>{faceCtx.strokeStyle=color;faceCtx.lineWidth=w;faceCtx.lineCap='round';faceCtx.beginPath();points.forEach(([x,y],i)=>i?faceCtx.lineTo(fx(x),fy(y)):faceCtx.moveTo(fx(x),fy(y)));faceCtx.stroke();};
 for(const side of[-1,1]){
  faceCtx.fillStyle=TIGER_CORAL_PALETTE.ivory;faceCtx.beginPath();faceCtx.ellipse(fx(side*.69),fy(.065),58,38,side*.1,0,Math.PI*2);faceCtx.fill();
  faceCtx.beginPath();faceCtx.ellipse(fx(side*.77),fy(-.42),120,145,side*-.35,0,Math.PI*2);faceCtx.fill();
  for(let k=0;k<4;k++){
   const y=.60-k*.11;
   stroke([[side*.035,y],[side*.16,y+.02],[side*(.24+k*.07),y+.10]],13-k,TIGER_CORAL_PALETTE.stripe);
   stroke([[side*(.97-k*.025),-.05-k*.16],[side*.74,-.08-k*.14],[side*(.49+k*.025),-.14-k*.14]],17-k*2,TIGER_CORAL_PALETTE.stripe);
  }
 }
 // Large flat colour fields; no stochastic fur/grain fill.
 const faceMap=new THREE.CanvasTexture(faceCanvas);faceMap.colorSpace=THREE.SRGBColorSpace;
 const sp=skull.geometry.attributes.position,suv=skull.geometry.attributes.uv;
 for(let i=0;i<sp.count;i++)suv.setXY(i,(sp.getX(i)+1)/2,(sp.getY(i)+.8)/1.6);suv.needsUpdate=true;
 skull.material=skull.material.clone();skull.material.map=faceMap;skull.material.vertexColors=false;skull.material.needsUpdate=true;

 // Joined muzzle with a modest nasal pad; remove the two ball-like whisker pads.
 for(const o of head.children)if(o.name==='v2-tiger-whisker-pad')o.visible=false;
 const muzzle=nodes.get('n23'),mg=createTigerFaceLoft(TIGER_MUZZLE_SECTIONS);muzzle.geometry=mg;muzzle.material=new THREE.MeshBasicMaterial({color:TIGER_CORAL_PALETTE.ivory,fog:false});
 const nose=nodes.get('n25'),ns=new THREE.Shape();ns.moveTo(-.265,-.255);ns.quadraticCurveTo(0,-.225,.265,-.255);ns.lineTo(.195,-.355);ns.quadraticCurveTo(0,-.435,-.195,-.355);ns.closePath();
 const ng=new THREE.ExtrudeGeometry(ns,{depth:.035,bevelEnabled:true,bevelSize:.012,bevelThickness:.009,bevelSegments:2,curveSegments:12});ng.translate(0,0,1.545);nose.geometry=ng;nose.material=new THREE.MeshBasicMaterial({color:TIGER_CORAL_PALETTE.nose,fog:false});
 for(const side of[-1,1]){const nostril=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),new THREE.MeshBasicMaterial({color:TIGER_CORAL_PALETTE.ink,fog:false}));nostril.scale.set(.045,.022,.009);nostril.position.set(side*.195,-.285,1.590);nostril.name='target-tiger-nostril';head.add(nostril);}

 // Old V3 brows/whiskers/lips belong to the previous short spherical face.
 for(const id of ['add:Tiger_Heavy_Brow_n19','add:Tiger_Heavy_Brow_n21','add:Tiger_Fine_Whiskers','add:Tiger_Whisker_Follicles','add:Tiger_Ivory_Chin'])if(nodes.get(id))nodes.get(id).visible=false;
 for(const o of head.children)if(o.name==='v2-tiger-lip')o.visible=false;
 // A low nasal bridge extends horizontally from the forehead to a separate nasal pad.
 const bridge=nodes.get('add:Tiger_Broad_Nasal_Bridge');
 if(bridge){
  bridge.geometry=createTigerFaceLoft(TIGER_BRIDGE_SECTIONS);bridge.material=new THREE.MeshBasicMaterial({color:TIGER_CORAL_PALETTE.coat,fog:false});bridge.visible=true;bridge.name='adult-tiger-nasal-bridge';
 }
 const faceLines=[],segment=(a,b)=>faceLines.push(new THREE.Vector3(...a),new THREE.Vector3(...b));
 // Neutral lip corners descend slightly, rather than turning upwards into a smile.
 segment([0,-.375,1.592],[0,-.465,1.593]);
 for(const side of [-1,1]){
  segment([0,-.465,1.593],[side*.28,-.475,1.565]);segment([side*.28,-.475,1.565],[side*.46,-.49,1.48]);
  for(let j=0;j<3;j++)segment([side*.50,-.34-j*.055,1.45],[side*(.76+j*.04),-.30-j*.09,1.38-j*.04]);
 }
 const facialInk=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(faceLines),new THREE.LineBasicMaterial({color:TIGER_CORAL_PALETTE.ink,transparent:true,opacity:.78,fog:false}));facialInk.name='adult-tiger-neutral-lips-and-whiskers';head.add(facialInk);

 // A continuous tapered cheek mantle replaces the stacked spherical ruff.
 for(const o of head.children)if(o.name==='v2-tiger-cheek-ruff')o.visible=false;
 for(const side of[-1,1]){
  const fg=new THREE.SphereGeometry(1,32,24),p=fg.attributes.position,col=[];
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i),t=(y+1)/2,tuft=1+.035*Math.sin(Math.atan2(z,x)*19+y*21);
   p.setXYZ(i,side*(.66+(x*.32+.035*(1-t))*tuft),-.20+y*.43,.52+z*.58);
   const c=new THREE.Color(t>.76?TIGER_CORAL_PALETTE.coat:TIGER_CORAL_PALETTE.ivory);col.push(c.r,c.g,c.b);
  }
  fg.setAttribute('color',new THREE.Float32BufferAttribute(col,3));fg.computeVertexNormals();const fur=new THREE.Mesh(fg,new THREE.MeshBasicMaterial({vertexColors:true,fog:false}));fur.name='target-tiger-cheek-mantle';head.add(fur);
  const marks=[];for(let i=0;i<8;i++){const y=-.65+i*.09,x=side*(.91+.025*Math.sin(i*2.)),z=.51+.025*Math.sin(i);marks.push(new THREE.Vector3(x,y,z),new THREE.Vector3(x-side*.07,y+.055,z+.025));}
  const hatch=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(marks),new THREE.LineBasicMaterial({color:TIGER_CORAL_PALETTE.ink,transparent:true,opacity:.65,fog:false}));head.add(hatch);
 }

 // Smooth shoulder/ribcage/rump loft; retains original limb pivots and the deforming neck.
 const profile=[[-3.08,.04,.08,.15],[-2.70,.61,.61,.27],[-2.15,.86,.78,.28],[-1.3,.69,.59,.40],[-.5,.79,.75,.38],[.3,.96,1.09,.24],[1.03,.94,1.27,.43],[1.50,.71,1.06,.49],[1.80,.08,.14,.40]];
 // Distinct ribcage / tucked flank / scapular crest are a single watertight skin.
 tiger.userData.tigerAnatomy={version:40,torsoSections:profile.map(s=>[...s]),foreAnchor:[.62,.38,1.03],hindAnchor:[.55,.27,-2.05],soleY:-2.075};
 const bp=[],bi=[],bu=[],ringsB=72,sidesB=40;
 for(let k=0;k<=ringsB;k++){
  const z=-3.08+4.88*k/ringsB;let j=0;while(j<profile.length-2&&z>profile[j+1][0])j++;
  const a=profile[j],b=profile[j+1],prev=profile[Math.max(0,j-1)],next=profile[Math.min(profile.length-1,j+2)],u=(z-a[0])/(b[0]-a[0]);
  const smooth=c=>{const m0=(b[c]-prev[c])/(b[0]-prev[0])*(b[0]-a[0]),m1=(next[c]-a[c])/(next[0]-a[0])*(b[0]-a[0]);return (2*u*u*u-3*u*u+1)*a[c]+(u*u*u-2*u*u+u)*m0+(-2*u*u*u+3*u*u)*b[c]+(u*u*u-u*u)*m1;};
  const rx=Math.max(.035,smooth(1)),ry=Math.max(.06,smooth(2)),cy=smooth(3);
  for(let n=0;n<=sidesB;n++){const angle=n/sidesB*Math.PI*2;bp.push(Math.cos(angle)*rx,cy+Math.sin(angle)*ry,z);bu.push(k/ringsB,n/sidesB);if(k<ringsB&&n<sidesB){const v=k*(sidesB+1)+n,w=v+sidesB+1;bi.push(v,v+1,w,w,v+1,w+1);}}
 }
 for(let j=1;j<sidesB-1;j++){bi.push(0,j+1,j);const end=ringsB*(sidesB+1);bi.push(end,end+j,end+j+1);}
 const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.Float32BufferAttribute(bp,3));bg.setAttribute('uv',new THREE.Float32BufferAttribute(bu,2));bg.setIndex(bi);bg.computeVertexNormals();bg.computeBoundingSphere();nodes.get('n2').geometry=bg;nodes.get('n2').material.vertexColors=false;nodes.get('n2').material.needsUpdate=true;

 // Fine, broken and forked body stripes instead of evenly spaced rings.
 const coatCanvas=document.createElement('canvas');coatCanvas.width=1024;coatCanvas.height=512;const cc=coatCanvas.getContext('2d');cc.fillStyle=TIGER_CORAL_PALETTE.coat;cc.fillRect(0,0,1024,512);cc.fillStyle=TIGER_CORAL_PALETTE.stripe;
 for(let j=-1;j<19;j++){
  const base=j*57+9*Math.sin(j*2.8),phase=j*1.91,width=5+5*(.5+.5*Math.sin(j*3.3));
  const center=y=>base+13*Math.sin(y*.013+phase)+5*Math.sin(y*.035+phase);
  const w=y=>width*(.15+.85*Math.pow(Math.abs(Math.sin(y/512*Math.PI+phase*.08)),.6))*(1+.10*Math.sin(y*1.7+j));
  cc.beginPath();for(let y=0;y<=512;y+=2)cc.lineTo(center(y)-w(y),y);for(let y=512;y>=0;y-=2)cc.lineTo(center(y)+w(y),y);cc.closePath();cc.fill();
  if(j%3!==0){const y0=70+(j*47%240);cc.beginPath();cc.moveTo(center(y0),y0);cc.bezierCurveTo(center(y0)+20,y0+30,center(y0+90)+25,y0+55,center(y0+140)+20,y0+140);cc.bezierCurveTo(center(y0+90)+15,y0+75,center(y0)+5,y0+28,center(y0)-2,y0+9);cc.fill();}
 }
 const coatMap=new THREE.CanvasTexture(coatCanvas);coatMap.colorSpace=THREE.SRGBColorSpace;coatMap.wrapS=THREE.RepeatWrapping;coatMap.wrapT=THREE.RepeatWrapping;
 for(const id of ['n2','n6','n53','n60','n67','n74']){const m=nodes.get(id);if(m?.material){m.material.map=coatMap;m.material.needsUpdate=true;}}
 skull.material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 headP;varying vec3 headN;').replace('#include <begin_vertex>','#include <begin_vertex>\nheadP=position;headN=normal;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 headP;varying vec3 headN;').replace('#include <map_fragment>',`#include <map_fragment>
   float side=1.-smoothstep(.15,.65,headP.z);
   float stripe=smoothstep(.76,.94,sin(headP.z*18.+headP.y*7.+sin(headP.y*17.)*.24));
   vec3 sideCoat=mix(vec3(.610,.275,.065),vec3(.034,.033,.047),stripe);
   sideCoat=mix(sideCoat,vec3(.888,.807,.651),(1.-smoothstep(-.55,-.31,headP.y))*.85);
   diffuseColor.rgb=mix(diffuseColor.rgb,sideCoat,side);
   diffuseColor.rgb*=.91+.09*step(.05,dot(normalize(headN),normalize(vec3(-.3,.8,.5))));`);
 };skull.material.customProgramCacheKey=()=> 'target-tiger-golden-head-36';skull.material.needsUpdate=true;

 // Adult ears have a cupped rim and a recessed pale inner surface, rather than flat discs.
 for(const [id,side]of [['n15',-1],['n17',1]]){
  const ear=nodes.get(id);if(!ear)continue;
  const eg=new THREE.SphereGeometry(1,32,24);const ep=eg.attributes.position;
  for(let i=0;i<ep.count;i++){const x=ep.getX(i),y=ep.getY(i),z=ep.getZ(i);ep.setXYZ(i,side*.77+x*.185,.595+y*.20,-.43+z*.115);}
  eg.computeVertexNormals();eg.computeBoundingSphere();ear.geometry=eg;ear.material=new THREE.MeshBasicMaterial({color:TIGER_CORAL_PALETTE.stripe,fog:false});
  const old=head.getObjectByName('add:Tiger_Round_Ear_Inner_'+id);if(old)old.visible=false;
  const inner=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),new THREE.MeshBasicMaterial({color:TIGER_CORAL_PALETTE.ivory}));inner.name='v10-cupped-ear-inner';inner.position.set(side*.77,.61,-.326);inner.scale.set(.119,.137,.028);head.add(inner);
 }
 // Small side-set almond eyes. No white eyeball or raised cartoon eyebrows.
 for(const [id,side]of [['n19',-1],['n21',1]]){
  const eye=nodes.get(id);if(!eye)continue;
  const c=new THREE.Vector3(side*.69,.065,.866),rot=new THREE.Matrix4().makeRotationY(side*.65);
  const g=new THREE.SphereGeometry(1,28,16);g.scale(.108,.047,.025).applyMatrix4(rot).translate(c.x,c.y,c.z);g.computeVertexNormals();g.computeBoundingSphere();eye.geometry=g;eye.material=new THREE.MeshBasicMaterial({color:TIGER_CORAL_PALETTE.eye});
  const pupil=head.getObjectByName('add:Tiger_Round_Pupil_'+id);if(pupil)pupil.visible=false;
  const p=new THREE.Mesh(new THREE.SphereGeometry(1,16,10),new THREE.MeshBasicMaterial({color:TIGER_CORAL_PALETTE.ink}));p.name='adult-tiger-small-pupil';p.position.copy(c).add(new THREE.Vector3(side*.016,0,.021));p.scale.set(.027,.032,.008);p.rotation.y=side*.65;head.add(p);
  const eyelidPoints=[];
  for(let k=0;k<16;k++){const a=k/16*Math.PI,b=(k+1)/16*Math.PI;for(const angle of[a,b])eyelidPoints.push(new THREE.Vector3(Math.cos(angle)*.113,Math.sin(angle)*.05,.029).applyMatrix4(rot).add(c));}
  const lid=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(eyelidPoints),new THREE.LineBasicMaterial({color:TIGER_CORAL_PALETTE.ink,fog:false}));lid.name='adult-tiger-upper-eyelid';head.add(lid);
 }

 // Closed limb skins bury their small root ring inside the shoulder / pelvis.
 // Smooth muscle envelopes taper at wrist and hock, rather than capsule limbs.
 const muscleRadius=(u,rear)=>{
  const profile=rear?[[0,.28,.36],[.12,.46,.59],[.28,.43,.51],[.45,.28,.34],[.64,.19,.22],[.78,.16,.18],[.85,.19,.23],[1,.19,.22]]:[[0,.27,.35],[.12,.38,.53],[.28,.38,.45],[.43,.29,.34],[.62,.245,.29],[.82,.16,.20],[1,.21,.24]];
  let k=0;while(k<profile.length-2&&u>profile[k+1][0])k++;
  const a=profile[k],b=profile[k+1],v=THREE.MathUtils.smoothstep(u,a[0],b[0]);return[a[1]+(b[1]-a[1])*v,a[2]+(b[2]-a[2])*v];
 };
 // Forelimbs have a shoulder, a rearward elbow and a forward-reaching wrist.
 const foreMeshes=['n53','n60'].map(id=>nodes.get(id));
 const limbRings=36,limbSides=24,limbIndices=[],limbUV=[];
 for(let i=0;i<=limbRings;i++)for(let j=0;j<=limbSides;j++){limbUV.push(j/limbSides,i/limbRings);if(i<limbRings&&j<limbSides){const a=i*(limbSides+1)+j,b=a+limbSides+1;limbIndices.push(a,b,a+1,a+1,b,b+1);}}
 for(let j=1;j<limbSides-1;j++){limbIndices.push(0,j,j+1);const end=limbRings*(limbSides+1);limbIndices.push(end,end+j+1,end+j);}
 for(const m of foreMeshes){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array((limbRings+1)*(limbSides+1)*3),3));g.setAttribute('uv',new THREE.Float32BufferAttribute(limbUV,2));g.setIndex(limbIndices);m.geometry=g;}
 const forePose=(bend,swings=[])=>{
  const joints=[new THREE.Vector3(0,.60-.40*bend,0),new THREE.Vector3(0,-.58,-.16-.52*bend),new THREE.Vector3(0,-1.36,.03),new THREE.Vector3(0,-1.85,.22)];
  const centerline=new THREE.CatmullRomCurve3(joints);const q=new THREE.Vector3();
  for(const [index,m] of foreMeshes.entries()){
   const anchor=m.worldToLocal(body.localToWorld(new THREE.Vector3(index===0?-.62:.62,.38,1.03)));
   joints[0].copy(anchor);joints[1].lerpVectors(anchor,joints[3],.48);joints[1].z-=.28+.30*bend+.46*(swings[index]||0);
   joints[1].y+=.12*(swings[index]||0);
   joints[2].lerpVectors(joints[1],joints[3],.70);
   const p=m.geometry.attributes.position;
   for(let i=0;i<=limbRings;i++){const u=i/limbRings;centerline.getPoint(u,q);const tangent=centerline.getTangent(u),normal=new THREE.Vector3(0,-tangent.z,tangent.y).normalize();const [rx,rz]=muscleRadius(u,false);
    for(let j=0;j<=limbSides;j++){const a=j/limbSides*Math.PI*2;p.setXYZ(i*(limbSides+1)+j,q.x+Math.cos(a)*rx,q.y+Math.sin(a)*rz*normal.y,q.z+Math.sin(a)*rz*normal.z);}}
   p.needsUpdate=true;m.geometry.computeVertexNormals();m.geometry.computeBoundingSphere();
  }
  const upper=joints[0].clone().sub(joints[1]),lower=joints[3].clone().sub(joints[1]);tiger.userData.foreElbowFlexDegrees=180-THREE.MathUtils.radToDeg(upper.angleTo(lower));
 };
 tiger.userData.updateTargetForelimbs=forePose;forePose(0);

 // Rear knees point forward and hocks backward; the ankle narrows into the paw.
 const rearMeshes=['n67','n74'].map(id=>nodes.get(id));
 for(const m of rearMeshes){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array((limbRings+1)*(limbSides+1)*3),3));g.setAttribute('uv',new THREE.Float32BufferAttribute(limbUV,2));g.setIndex(limbIndices);m.geometry=g;}
 tiger.userData.updateTargetHindlimbs=(bend,swings=[])=>{
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,.68,-.08),new THREE.Vector3(0,-.27,.25+.13*bend),new THREE.Vector3(0,-1.26,-.21-.10*bend),new THREE.Vector3(0,-1.85,.22)]),q=new THREE.Vector3();
  for(const [index,m] of rearMeshes.entries()){
   const anchor=m.worldToLocal(body.localToWorld(new THREE.Vector3(index===0?-.55:.55,.27,-2.05)));
   curve.points[0].copy(anchor);curve.points[1].lerpVectors(anchor,curve.points[3],.43);curve.points[1].z+=.40+.30*(swings[index+2]||0);
   curve.points[2].lerpVectors(anchor,curve.points[3],.79);curve.points[2].z-=.30+.24*(swings[index+2]||0);
   const p=m.geometry.attributes.position;for(let i=0;i<=limbRings;i++){const u=i/limbRings;curve.getPoint(u,q);const tangent=curve.getTangent(u),normal=new THREE.Vector3(0,-tangent.z,tangent.y).normalize();const [rx,rz]=muscleRadius(u,true);for(let j=0;j<=limbSides;j++){const a=j/limbSides*Math.PI*2;p.setXYZ(i*(limbSides+1)+j,q.x+Math.cos(a)*rx,q.y+Math.sin(a)*rz*normal.y,q.z+Math.sin(a)*rz*normal.z);}}p.needsUpdate=true;m.geometry.computeVertexNormals();m.geometry.computeBoundingSphere();}
 };tiger.userData.updateTargetHindlimbs(0);

 // Broad load-bearing paws, with a flattened sole and subtle toe lobes.
 for(const [pawIndex,paw] of paws.entries()){
  const g=new THREE.SphereGeometry(1,40,24),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);p.setXYZ(i,x*(pawIndex<2?.43:.39),Math.max(-2.075,-1.925+y*.18),.18+z*.46+(z>0?.025*Math.cos(x*12.):0));}
  g.computeVertexNormals();g.computeBoundingSphere();paw.geometry=g;const colors=[],normal=g.attributes.normal,base=new THREE.Color(TIGER_CORAL_PALETTE.ivory);
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),groove=Math.min(Math.abs(x),Math.abs(x-.16),Math.abs(x+.16));const shade=(normal.getY(i)>.05?1:.92)*(1-.22*(1-THREE.MathUtils.smoothstep(groove,.008,.025))*THREE.MathUtils.smoothstep(z,.33,.53));colors.push(base.r*shade,base.g*shade,base.b*shade);}
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));paw.material=new THREE.MeshBasicMaterial({vertexColors:true});
 }
 for(const id of ['n57','n64','n71','n78'])if(nodes.get(id))nodes.get(id).visible=false;

 const jaw=new THREE.Group();jaw.name='tiger-drink-lower-jaw';jaw.position.set(0,-.38,.84);head.add(jaw);
 const chin=new THREE.Mesh(new THREE.SphereGeometry(1,28,16),new THREE.MeshBasicMaterial({color:TIGER_CORAL_PALETTE.ivory}));chin.scale.set(.30,.08,.34);chin.position.set(0,-.16,.34);jaw.add(chin);
 const mouth=new THREE.Mesh(new THREE.SphereGeometry(1,24,12),new THREE.MeshBasicMaterial({color:TIGER_CORAL_PALETTE.ink}));mouth.name='tiger-drink-mouth-opening';mouth.scale.set(.24,.025,.22);mouth.position.set(0,-.51,1.285);head.add(mouth);
 const tongueGeo=new THREE.BufferGeometry(),tonguePositions=new Float32Array(18*3),tongueIndices=[];
 for(let i=0;i<8;i++)tongueIndices.push(i*2,i*2+1,i*2+2,i*2+1,i*2+3,i*2+2);
 tongueGeo.setAttribute('position',new THREE.BufferAttribute(tonguePositions,3));tongueGeo.setIndex(tongueIndices);
 const column=new THREE.Mesh(new THREE.CylinderGeometry(.008,.017,1,8),new THREE.MeshBasicMaterial({color:0x94c5d0,transparent:true,opacity:.55,depthWrite:false}));column.name='tiger-lapping-water-column';swamp.add(column);
 const drinkRings=[0,.4].map(phase=>{const m=new THREE.Mesh(new THREE.RingGeometry(.92,1,40),new THREE.MeshBasicMaterial({color:0x91bdc7,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));m.name='tiger-drink-contact-ripple';m.rotation.x=-Math.PI/2;m.renderOrder=7;m.userData.phase=phase;swamp.add(m);return m;});
 const tongue=new THREE.Mesh(tongueGeo,new THREE.MeshBasicMaterial({color:0xb8797c,side:THREE.DoubleSide}));tongue.name='tiger-lapping-tongue';head.add(tongue);
 tiger.userData.updateTargetDrinkDetails=(dt,t,blend)=>{
  const burst=((t%4.8)+4.8)%4.8,active=burst<3.7;const lap=active?.5+.5*Math.sin(t*2.1*Math.PI*2):0;jaw.rotation.x=blend*(.035+.13*lap);mouth.visible=blend>.25;
  tongue.visible=blend>.8&&active;column.visible=false;drinkRings.forEach(r=>r.visible=tongue.visible);
  if(tongue.visible){
   head.updateWorldMatrix(true,false);const start=new THREE.Vector3(0,-.54,1.44),water=swamp.worldToLocal(head.localToWorld(start.clone()));water.y=25.003;
   for(const ring of drinkRings){const phase=((t*2.1-.25+ring.userData.phase)%1+1)%1;ring.position.set(water.x,25.012,water.z);ring.scale.setScalar(.035+.25*phase);ring.material.opacity=.28*(1-phase)*blend;}
   const end=head.worldToLocal(swamp.localToWorld(water)),extension=.08+.92*lap;
   for(let i=0;i<=8;i++){const u=i/8,p=start.clone().lerp(end,u*extension);p.z-=.075*Math.sin(u*Math.PI)*extension;const w=.075*Math.sqrt(Math.max(.05,1-u*u*.92));for(let j=0;j<2;j++){const k=(i*2+j)*3;tonguePositions[k]=p.x+(j?1:-1)*w;tonguePositions[k+1]=p.y;tonguePositions[k+2]=p.z;}}
   tongueGeo.attributes.position.needsUpdate=true;tongueGeo.computeBoundingSphere();
   const tip=swamp.worldToLocal(head.localToWorld(new THREE.Vector3((tonguePositions[48]+tonguePositions[51])*.5,tonguePositions[49],tonguePositions[50])));
   const height=Math.max(0,tip.y-25.003),retracting=Math.cos(t*2.1*Math.PI*2)<0;
   column.visible=retracting&&lap>.48&&height>.005;column.scale.y=height;column.position.set(tip.x,25.003+height*.5,tip.z);

  }
  tiger.userData.drinkDetail={lap,active,burst,blend,jawAngle:jaw.rotation.x,tongueVisible:tongue.visible};
 };
 // A narrow inverted shell shares each final skin geometry, including animated lofts.
 const ink=new THREE.MeshBasicMaterial({color:TIGER_CORAL_PALETTE.ink,side:THREE.BackSide,fog:false});
 ink.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed += normal * .008;');};
 ink.customProgramCacheKey=()=> 'lake-tiger-fine-ink-40';
 for(const id of ['n2','n6','n9','n23','add:Tiger_Broad_Nasal_Bridge','n53','n60','n67','n74','n55','n62','n69','n76']){
  const skin=nodes.get(id),line=new THREE.Mesh(skin.geometry,ink);line.name='coral-tiger-fine-outline';line.userData.isOutline=true;line.userData.tigerCoralOutline=true;skin.add(line);
 }
 tiger.userData.tigerCoralDesign={version:4,palette:{...TIGER_CORAL_PALETTE},outlineWidth:.008,extraOutlineDraws:13,style:'adult golden ochre coat / near-black grey violet tiger stripes / pale ivory underside',gait:'distance-driven four-beat walk with articulated shoulder-elbow and hip-knee-hock'};
 tiger.userData.tigerTargetRound=TIGER_TARGET_ROUND;
}
