import {MOEBIUS_PALETTE as P} from './moebiusPalette.js';
import {batchGateOrnaments} from './crystalRenderBatch.js';
import * as THREE from 'three';

/** V10 gate: connected three-bay side arcades and preserved rail opening. */
export function installGateMoebiusV10(gate){
 const seat=gate.userData.seatRoot;if(seat.userData.moebiusV10)return;
 const root=new THREE.Group();root.name='gate-moebius-v10';seat.add(root);
 const stone=new THREE.MeshBasicMaterial({color:0x8eb3cf});
 stone.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 gateStoneP;varying vec3 gateStoneN;').replace('#include <begin_vertex>','#include <begin_vertex>\ngateStoneP=position;gateStoneN=normal;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 gateStoneP;varying vec3 gateStoneN;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float fissure=abs(sin(gateStoneP.y*2.1+sin(gateStoneP.z*3.+gateStoneP.x*2.)*.22));
   float edge=1.-smoothstep(.015,.015+max(fwidth(fissure),.012),fissure);
   float broken=smoothstep(.0,.7,sin(gateStoneP.x*5.+gateStoneP.z*2.+gateStoneP.y));
   diffuseColor.rgb=mix(diffuseColor.rgb*vec3(.65,.73,.95),diffuseColor.rgb, .35+.65*abs(normalize(gateStoneN).y));
   diffuseColor.rgb*=1.-edge*broken*.21;`);
 };stone.customProgramCacheKey=()=> 'gate-stone-blue-ink';
 const coral=stone.clone();coral.color.set(P.coral);coral.onBeforeCompile=stone.onBeforeCompile;coral.customProgramCacheKey=()=> 'gate-coral-ink-v2';
 const bronze=new THREE.MeshStandardMaterial({color:P.brass,roughness:.65,metalness:.25,emissive:0x403726,emissiveIntensity:.25});
 const dark=new THREE.LineBasicMaterial({color:P.ink});
 const glass=new THREE.MeshBasicMaterial({color:P.glass,transparent:true,opacity:.23,depthWrite:false,side:THREE.DoubleSide});
 function mesh(g,m,name,x,y,z,solid=false){const o=new THREE.Mesh(g,m);o.name=name;o.position.set(x,y,z);o.userData.citadelSolidExterior=solid;root.add(o);return o;}
 function tube(points,r,m,name){return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),32,r,6,false),m,name,0,0,0);}
 for(const old of seat.children.filter(o=>/^(gate-arch-|leftTowerGroup$|rightTowerGroup$|channel-pier-)/.test(o.name))){
  old.visible=false;old.traverse(o=>o.userData.citadelSolidExterior=false);
 }
 for(const z of [-19.8,-6.6,6.6,19.8]){
  const inner=4.2,outer=5.0,spring=11;
  const shape=new THREE.Shape();shape.moveTo(-outer,-1.6);shape.lineTo(-outer,spring);shape.absarc(0,spring,outer,Math.PI,0,true);shape.lineTo(outer,-1.6);shape.lineTo(inner,-1.6);shape.lineTo(inner,spring);shape.absarc(0,spring,inner,0,Math.PI,false);shape.lineTo(-inner,-1.6);shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:1.15,bevelEnabled:false,curveSegments:32});
  const arch=mesh(g,coral,'v10-gate-open-arch',0,0,z-.575,true);
  arch.add(new THREE.LineSegments(new THREE.EdgesGeometry(g,25),dark));
  for(const radius of [4.25,4.94])for(const zz of [z-.59,z+.59]){
   const pts=[new THREE.Vector3(-radius,-1.5,zz),new THREE.Vector3(-radius,spring,zz)];
   for(let j=0;j<=32;j++){const a=Math.PI-j/32*Math.PI;pts.push(new THREE.Vector3(Math.cos(a)*radius,spring+Math.sin(a)*radius,zz));}
   pts.push(new THREE.Vector3(radius,-1.5,zz));
   // Polyline follows the arch without Catmull-Rom overshoot into the passage.
   root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:P.cream})));
  }
  // Engraved joints and solid bronze mouldings, on both faces of each arch.
  for(const face of [-1,1]){
   for(let i=1;i<24;i++){const a=i/24*Math.PI;const points=[4.22,4.98].map(r=>new THREE.Vector3(Math.cos(a)*r,11+Math.sin(a)*r,z+face*.582));const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),dark);line.name='v11-arch-stone-joint';root.add(line);}
   for(const radius of[4.23,4.97])mesh(new THREE.TorusGeometry(radius,.035,5,64,Math.PI),bronze,'v11-bronze-arch-moulding',0,11,z+face*.63);
  }
  for(const side of [-1,1]){
   const x=side*5.55;
   for(const face of[-1,1])for(const y of[8.5,11]){
    const cx=side*4.85,cz=z+face*.76,r=y===11?.68:.43;
    mesh(new THREE.CircleGeometry(r*.86,28),new THREE.MeshBasicMaterial({color:P.shadow,side:THREE.DoubleSide}),'v11-bearing-recess',cx,y,cz);
    for(const f of[1,.74,.33])mesh(new THREE.TorusGeometry(r*f,.045,6,28),bronze,'v11-bearing-ring',cx,y,cz+face*.05);
    for(let b=0;b<8;b++){const a=b/8*Math.PI*2;mesh(new THREE.SphereGeometry(.055,6,4),bronze,'v11-bearing-rivet',cx+Math.cos(a)*r*.88,y+Math.sin(a)*r*.88,cz+face*.1);}
   }

   mesh(new THREE.CylinderGeometry(.5,.5,7,20,1,true),glass,'v10-botanical-glass',x,4,z);
   for(const y of [.5,7.5])mesh(new THREE.CylinderGeometry(.61,.61,.15,20),bronze,'v10-pod-collar',x,y,z);
   for(const dx of [-.48,.48])mesh(new THREE.CylinderGeometry(.045,.045,7,6),bronze,'v10-pod-rib',x+dx,4,z);
   const greens=[0x52795f,0x73976b,0x9db587];
   // Three slender climbing stems, with paired leaves and visible branch veins.
   for(let stem=0;stem<3;stem++){
    const sx=x+(stem-1)*.19,sz=z+(stem===1?.13:-.10);
    const plantMat=new THREE.MeshBasicMaterial({color:greens[stem]});
    tube([new THREE.Vector3(sx,.65,sz),new THREE.Vector3(sx+.08,3.8,sz+.06),new THREE.Vector3(sx-.04,7.25,sz)],.018,plantMat,'v12-botanical-stem');
    for(let k=0;k<13;k++){
     const y=.95+k*.47,angle=k*2.4+stem*2.1;
     const base=new THREE.Vector3(sx,y,sz),tip=new THREE.Vector3(x+Math.cos(angle)*.40,y+.32,z+Math.sin(angle)*.40);
     tube([base,base.clone().lerp(tip,.55).add(new THREE.Vector3(0,.07,0)),tip],.009,plantMat,'v12-leaf-branch');
     const leaf=mesh(new THREE.SphereGeometry(1,6,4),plantMat,'v12-botanical-leaf',...base.clone().lerp(tip,.72).toArray());
     leaf.scale.set(.065,.25,.023);leaf.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),tip.clone().sub(base).normalize());
    }
   }
   for(const y of[.5,7.5]){
    for(const dy of[-.16,.16])mesh(new THREE.TorusGeometry(.56,.035,6,24),bronze,'v12-pod-seal',x,y+dy,z).rotation.x=Math.PI/2;
    for(let k=0;k<8;k++){const a=k*Math.PI/4;mesh(new THREE.SphereGeometry(.045,6,4),bronze,'v12-collar-fastener',x+Math.cos(a)*.61,y,z+Math.sin(a)*.61);}
   }
   for(const dz of[-.48,.48])mesh(new THREE.CylinderGeometry(.022,.022,6.85,6),bronze,'v12-pod-back-rib',x,4,z+dz);
   for(const y of[.8,7.2])for(const face of[-1,1])tube([
    new THREE.Vector3(x,y,z+face*.48),new THREE.Vector3(x+side*.24,y,z+face*.75),
    new THREE.Vector3(x+side*.30,y+.28,z+face*.76),new THREE.Vector3(x+side*.30,y+.65,z+face*.76)
   ],.035,bronze,'v12-pod-return-pipe');
   for(const y of [8.5,11]){
    const ring=mesh(new THREE.TorusGeometry(y===11?.54:.34,.08,6,24),bronze,'v10-mechanical-ring',side*4.8,y,z+.65);
    mesh(new THREE.CylinderGeometry(.15,.15,.15,12),bronze,'v10-mechanical-hub',side*4.8,y,z+.65).rotation.x=Math.PI/2;
   }
   for(let k=0;k<3;k++)tube([new THREE.Vector3(side*(5.1+k*.18),0,z),new THREE.Vector3(side*(5.1+k*.18),8,z),new THREE.Vector3(side*(5+k*.18),12+k*.8,z)],.035,bronze,'v10-service-conduit');
   mesh(new THREE.ConeGeometry(.075,1.3,8),bronze,'v10-finial',side*5.2,15,z);
  }
 }

 // V8: three longitudinal bays on BOTH sides, sharing four transverse stations.
 for(const side of[-1,1])for(const center of[-13.2,0,13.2]){
  const outer=6.6,inner=6.18,spring=8.8;
  const shape=new THREE.Shape();shape.moveTo(-outer,-1.6);shape.lineTo(-outer,16.05);shape.lineTo(outer,16.05);shape.lineTo(outer,-1.6);shape.lineTo(inner,-1.6);shape.lineTo(inner,spring);shape.absarc(0,spring,inner,0,Math.PI,false);shape.lineTo(-inner,-1.6);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.7,bevelEnabled:false,curveSegments:40});geometry.translate(0,0,-.35);geometry.rotateY(Math.PI/2);
  const wall=mesh(geometry,coral,'v8-longitudinal-arcade',side*4.85,0,center,true);wall.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry,25),dark));
  for(const face of[-1,1]){
   for(const radius of[6.23,6.96]){const trim=mesh(new THREE.TorusGeometry(radius,.045,6,48,Math.PI),bronze,'v8-side-arch-moulding',side*4.85+face*.38,spring,center);trim.rotation.y=Math.PI/2;}
   for(let k=1;k<24;k++){const a=k/24*Math.PI;const pts=[6.2,7.0].map(r=>new THREE.Vector3(side*4.85+face*.356,spring+Math.sin(a)*r,center-Math.cos(a)*r));root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),dark));}
  }
 }
 for(const side of[-1,1]){
  mesh(new THREE.BoxGeometry(.75,.42,40.5),coral,'v8-side-cornice',side*4.85,16.05,0,true);
  mesh(new THREE.BoxGeometry(.83,.08,40.7),bronze,'v8-cornice-brass-cap',side*4.85,16.30,0);
 }
 // Shared corner piers and outward-facing joints connect side walls to transverse portals.
 for(const side of[-1,1])for(const z of[-19.8,-6.6,6.6,19.8]){
  const x=side*4.85;
  mesh(new THREE.BoxGeometry(.94,16.35,.95),stone,'v8-shared-corner-pier',x,6.575,z,true);
  for(const dz of[-.38,.38])mesh(new THREE.CylinderGeometry(.055,.055,16.7,8),bronze,'v8-corner-service-rib',x+side*.5,6.75,z+dz);
  for(const y of[8.8,15.75]){
   const ring=mesh(new THREE.TorusGeometry(.57,.065,8,32),bronze,'v8-side-bearing',x+side*.55,y,z);ring.rotation.y=Math.PI/2;
   const inner=mesh(new THREE.TorusGeometry(.37,.045,6,24),bronze,'v8-side-bearing-inner',x+side*.57,y,z);inner.rotation.y=Math.PI/2;
   const hub=mesh(new THREE.CylinderGeometry(.16,.16,.18,16),bronze,'v8-side-bearing-hub',x+side*.61,y,z);hub.rotation.z=Math.PI/2;
  }
  mesh(new THREE.ConeGeometry(.085,1.15,8),bronze,'v8-side-pier-finial',x,17.1,z);
 }
 // Enlarge the connected architecture about the rail datum, leaving tracks and meeting deck fixed.
 const breadth=1.35,height=1.30,length=1.20;
 for(const child of root.children){child.position.multiply(new THREE.Vector3(breadth,height,length));child.scale.multiply(new THREE.Vector3(breadth,height,length));}
 root.userData.expansion={breadth,height,length};
 // Load-bearing lower arcades continue the same three bays down to the water.
 for(const side of[-1,1])for(const center of[-13.2,0,13.2]){
  const outer=6.6*length,inner=6.0*length,spring=-12.5,top=-1.6*height,bottom=-25.3;
  const shape=new THREE.Shape();shape.moveTo(-outer,bottom);shape.lineTo(-outer,top);shape.lineTo(outer,top);shape.lineTo(outer,bottom);shape.lineTo(inner,bottom);shape.lineTo(inner,spring);shape.absarc(0,spring,inner,0,Math.PI,false);shape.lineTo(-inner,bottom);shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:.82,bevelEnabled:false,curveSegments:36});g.translate(0,0,-.41);g.rotateY(Math.PI/2);
  const wall=mesh(g,stone,'v13-underbridge-arcade',side*4.85*breadth,0,center*length,true);wall.add(new THREE.LineSegments(new THREE.EdgesGeometry(g,28),dark));
 }
 // The widened side galleries need actual decks and guarding, not open air beside the rails.
 for(const side of[-1,1]){
  const deck=mesh(new THREE.BoxGeometry(2.8,.30,47.9),stone,'v14-side-gallery-deck',side*5.025,-.15,0);deck.userData.gateWalkable=true;
  for(const y of[.45,1.05])mesh(new THREE.BoxGeometry(.07,.07,47.4),bronze,'v14-side-gallery-rail',side*6.35,y,0,true);
  for(let z=-23.4;z<=23.4;z+=1.8)mesh(new THREE.CylinderGeometry(.045,.065,1.15,8),bronze,'v14-side-gallery-post',side*6.35,.53,z,true);
 }
 // Ground each arcade pier on the actual authored canyon shoulder, without warping the gate.
 const site=seat.userData.siteRoot;
 site.updateWorldMatrix(true,true);root.updateWorldMatrix(true,true);
 const terrain=site.children.filter(o=>o.isMesh&&o.name.startsWith('canyon-shoulder'));
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0).transformDirection(root.matrixWorld);
 const feet=[];
 for(const side of[-1,1])for(let z of[-19.8,-6.6,6.6,19.8]){
  z*=length;
  const footX=side*4.85*breadth,origin=root.localToWorld(new THREE.Vector3(footX,25,z));ray.set(origin,down);ray.far=90;
  const hit=ray.intersectObjects(terrain,false)[0];if(!hit){feet.push({side,z,supported:false});continue;}
  const ground=root.worldToLocal(hit.point.clone()),bottom=Math.min(-2,ground.y-.25),top=-1.55*height;
  const positions=[];for(const [x,y,w,d]of [[footX,bottom,2.2,2.5],[side*4.85*breadth,top,1.05*breadth,1.1*length]])for(const [sx,sz]of[[-1,-1],[-1,1],[1,1],[1,-1]])positions.push(x+sx*w/2,y,z+sz*d/2);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex([0,1,2,0,2,3,4,6,5,4,7,6,0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0].reverse());g.computeVertexNormals();
  const foundation=mesh(g,stone,'v8-sampled-pier-foundation',0,0,0,true);foundation.add(new THREE.LineSegments(new THREE.EdgesGeometry(g,25),dark));feet.push({side,z,supported:true,ground:ground.toArray()});
 }
 const terraceFeet=[];
 for(const x of[-28,-18])for(const z of[-23,-17]){
  ray.set(root.localToWorld(new THREE.Vector3(x,2.9,z)),down);ray.far=90;
  const hit=ray.intersectObjects(terrain,false)[0];if(!hit){terraceFeet.push({x,z,supported:false});continue;}
  const ground=root.worldToLocal(hit.point.clone()),bottom=ground.y-.3,top=3.15;
  if(bottom>=top){terraceFeet.push({x,z,supported:false});continue;}
  mesh(new THREE.CylinderGeometry(.65,1.05,top-bottom,8),stone,'v8-meeting-terrace-pier',x,(top+bottom)/2,z,true);
  mesh(new THREE.CylinderGeometry(1.05,1.05,.35,8),bronze,'v8-meeting-pier-cap',x,2.94,z);
  terraceFeet.push({x,z,supported:true,ground:ground.toArray()});
 }
 // Three guarded sides; the complete southern stair approach stays open.
 const terraceEdges=[[-29.55,-24.4,-29.55,-15.45],[-29.55,-15.45,-16.45,-15.45],[-16.45,-15.45,-16.45,-24.4]];
 for(const [ax,az,bx,bz]of terraceEdges){
  const length=Math.hypot(bx-ax,bz-az),count=Math.ceil(length/1.65);
  for(let i=0;i<=count;i++){
   const x=THREE.MathUtils.lerp(ax,bx,i/count),z=THREE.MathUtils.lerp(az,bz,i/count);
   mesh(new THREE.CylinderGeometry(.055,.075,1.1,8),bronze,'v8-meeting-baluster',x,3.79,z,true);
   mesh(new THREE.SphereGeometry(.095,8,6),bronze,'v8-meeting-finial',x,4.36,z);
  }
  for(const y of[3.65,4.3]){
   const rail=mesh(new THREE.BoxGeometry(length,.065,.075),bronze,'v8-meeting-handrail',(ax+bx)/2,y,(az+bz)/2,true);rail.rotation.y=-Math.atan2(bz-az,bx-ax);
  }
 }
 const terraceModel=seat.getObjectByName('gate-target-blender-v1');
 for(const name of['Gate_stone.016_walk','Gate_edge.016_walk']){
  const deck=terraceModel?.getObjectByName(name);if(deck){deck.material=stone.clone();deck.material.color.setHex(name.includes('edge')?0x8199b4:0x607ea8);}
 }
 // Botanical-glass shelter over the existing heroes, with an open approach from the stairs.
 const canopy=mesh(new THREE.SphereGeometry(1,40,12,0,Math.PI*2,0,Math.PI/2),glass,'v8-meeting-glass-canopy',-24.5,6.6,-19.3);
 canopy.scale.set(4.5,1.15,3.25);
 for(let i=0;i<12;i++){
  const a=i*Math.PI/6,points=[];
  for(let j=0;j<=16;j++){const t=j/16*Math.PI/2;points.push(new THREE.Vector3(-24.5+4.5*Math.cos(a)*Math.sin(t),6.6+1.15*Math.cos(t),-19.3+3.25*Math.sin(a)*Math.sin(t)));}
  tube(points,.045,bronze,'v8-meeting-canopy-rib');
 }
 const rim=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;rim.push(new THREE.Vector3(-24.5+4.5*Math.cos(a),6.6,-19.3+3.25*Math.sin(a)));}
 tube(rim,.07,bronze,'v8-meeting-canopy-rim');
 for(const a of[Math.PI*.2,Math.PI*.8,Math.PI*1.2,Math.PI*1.8]){
  const x=-24.5+4.5*Math.cos(a),z=-19.3+3.25*Math.sin(a);
  mesh(new THREE.CylinderGeometry(.065,.09,3.35,8),bronze,'v8-meeting-canopy-column',x,4.925,z,true);
 }
 root.userData.terraceFoundationSamples=terraceFeet;
 root.userData.foundationSamples=feet;
 root.userData.v8Arcade={longitudinalBaysPerSide:3,transverseStations:4,stations:[-19.8,-6.6,6.6,19.8].map(z=>z*length)};
 batchGateOrnaments(root);
 root.userData.refinement=9;
 seat.userData.moebiusV10=root;
 gate.userData.targetMetrics={...gate.userData.targetMetrics,passageWidth:8.4*breadth,passageApex:15.2*height,towerHeight:17.675*height,wallWidth:12.4*breadth};
}
