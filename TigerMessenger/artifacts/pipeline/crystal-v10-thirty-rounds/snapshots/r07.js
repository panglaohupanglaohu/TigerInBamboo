import * as THREE from 'three';
import {installGateMoebiusV10} from './gateMoebiusV10.js';

// V10 is a separate civilization-specific pass; never changes global lighting or holy-city materials.
export const V10_RELEASE_ROUND=7;
export function crystalV10Round(){
 const q=new URLSearchParams(globalThis.location?.search||'');
 if(q.get('crystalV7')==='0'||q.has('crystalV9'))return 0;
 return q.has('crystalV10')?THREE.MathUtils.clamp(Number(q.get('crystalV10'))||0,0,30):V10_RELEASE_ROUND;
}
export function finishCrystalV10Scene({city,gate,scene,swamp}){
 const round=crystalV10Round();if(!round)return;
 city.crystals.forEach(r=>r.group.userData.v10Round=round);
 restoreOriginalGate(gate);
 if(round>=2)blueCivilization(city,gate);
 installGateMoebiusV10(gate);
 if(round>=3)for(const [index,r]of city.crystals.entries()){
  const group=r.group.userData.v9Root;
  // Broader clustered silhouettes while retaining root/harbour placement and habitat elevations.
  group.children.filter(o=>o.name==='v9-crystal-prism').forEach((o,i)=>{
   o.position.x*=1.38;o.position.z*=1.38;
   o.scale.set(1.35,i===0?.88:1.03,1.35);
  });
  r.h=60.72*(index===0?1:.55);
 }
 if(round>=4)crystalInteriors(city);
 if(round>=5)roundHabitats(city);
 if(round>=6)habitatGardens(city);
 if(round>=7)scene.userData.moebiusV10SkyUp=swamp.position.clone().normalize();
}
function habitatGardens(city){
 const leafMats=[0x416c62,0x769d75,0xa2b98a].map(color=>new THREE.MeshBasicMaterial({color}));
 const potMat=new THREE.MeshBasicMaterial({color:0x576478}),stemMat=new THREE.MeshBasicMaterial({color:0x6a7858});
 const leafGeo=new THREE.SphereGeometry(.32,8,6);
 for(const r of city.crystals)for(const room of r.group.userData.v9Root.children.filter(o=>o.name==='v9-transparent-habitat')){
  for(let i=0;i<7;i++){
   const a=i/7*Math.PI*2,x=Math.cos(a)*2.65,z=Math.sin(a)*2.65,h=1.9+(i%3)*.6;
   const pot=new THREE.Mesh(new THREE.CylinderGeometry(.43,.32,.46,10),potMat);pot.name='v10-habitat-planter';pot.position.set(x,.23,z);room.add(pot);
   const stem=new THREE.Mesh(new THREE.CylinderGeometry(.025,.045,h,5),stemMat);stem.position.set(x,.46+h/2,z);stem.name='v10-botanical-stem';room.add(stem);
   for(let j=0;j<7;j++){
    const angle=j*2.4+i,y=.7+j*h/8;
    const leaf=new THREE.Mesh(leafGeo,leafMats[(i+j)%3]);leaf.name='v10-botanical-leaf';leaf.scale.set(.45,1.9,.7);leaf.rotation.z=Math.sin(angle)*1.0;leaf.rotation.y=angle;leaf.position.set(x+Math.cos(angle)*.24,y,z+Math.sin(angle)*.24);room.add(leaf);
   }
  }
 }
}
function roundHabitats(city){
 const bronze=new THREE.MeshBasicMaterial({color:0x94876c}),floor=new THREE.MeshBasicMaterial({color:0x617489});
 for(const r of city.crystals)for(const room of r.group.userData.v9Root.children.filter(o=>o.name==='v9-transparent-habitat')){
  for(const child of room.children)if(/habitat-glass|room-floor|bronze-frame/.test(child.name))child.visible=false;
  const add=(g,m,name,y)=>{const o=new THREE.Mesh(g,m);o.name=name;o.position.y=y;room.add(o);return o;};
  add(new THREE.CylinderGeometry(4.4,4.4,.24,48),floor,'v10-circular-terrace',-.12);
  add(new THREE.CylinderGeometry(3.55,3.55,4.2,48,1,true),new THREE.MeshBasicMaterial({color:0xa3decf,transparent:true,opacity:.2,depthWrite:false,side:THREE.DoubleSide}),'v10-cylindrical-habitat',2.1);
  for(const y of [0,4.2]){const ring=add(new THREE.TorusGeometry(3.6,.085,6,48),bronze,'v10-habitat-ring',y);ring.rotation.x=Math.PI/2;}
  for(let i=0;i<12;i++){
   const a=i*Math.PI/6,x=Math.cos(a)*3.6,z=Math.sin(a)*3.6;
   const rib=add(new THREE.CylinderGeometry(.045,.045,4.2,6),bronze,'v10-habitat-rib',2.1);rib.position.x=x;rib.position.z=z;
   const post=add(new THREE.CylinderGeometry(.035,.035,.9,5),bronze,'v10-terrace-railing',.45);post.position.x=x/3.6*4.3;post.position.z=z/3.6*4.3;
  }
  const handrail=add(new THREE.TorusGeometry(4.3,.045,5,48),bronze,'v10-terrace-handrail',.9);handrail.rotation.x=Math.PI/2;
 }
}
function crystalInteriors(city){
 const lineMaterial=new THREE.LineBasicMaterial({color:0xd5f6ff,transparent:true,opacity:.72});
 for(const r of city.crystals)for(const prism of r.group.userData.v9Root.children.filter(o=>o.name==='v9-crystal-prism')){
  prism.material.forEach((m,i)=>{m.transparent=true;m.opacity=[.46,.6,.36,.5][i];m.depthWrite=false;});
  prism.geometry.computeBoundingBox();const b=prism.geometry.boundingBox,h=b.max.y,rad=b.max.x,points=[];
  for(let face=0;face<6;face++){
   const a=face*Math.PI/3;
   let last=new THREE.Vector3(Math.cos(a)*rad*.82,h*.025,Math.sin(a)*rad*.82);
   for(let k=1;k<=12;k++){
    const y=h*(.025+k*.067),aa=a+Math.sin(k*2.7+face)*.48,rr=rad*(.45+.36*Math.abs(Math.sin(k*1.7+face)));
    const next=new THREE.Vector3(Math.cos(aa)*rr,y,Math.sin(aa)*rr);points.push(last.clone(),next.clone());
    if(k%2===0)points.push(next.clone(),new THREE.Vector3(Math.cos(a+.65)*rad*.9,y-h*.035,Math.sin(a+.65)*rad*.9));
    last=next;
   }
  }
  const lines=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),lineMaterial);lines.name='v10-crystalline-inclusions';prism.add(lines);
 }
}
function blueCivilization(city,gate){
 const crystal=[0x9cdef5,0xd3f6fc,0x63a5d7,0x80c6e8];
 for(const r of city.crystals)r.group.userData.v9Root.traverse(o=>{
  if(!o.isMesh)return;
  if(o.name==='v9-crystal-prism')o.material=crystal.map(color=>new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));
  else if(/floor|bracket|bridge|frame|stem/.test(o.name))o.material=new THREE.MeshBasicMaterial({color:/frame|stem/.test(o.name)?0x8a7c60:0x425674});
 });
 const rockColor=(mesh)=>{
  const g=mesh.geometry,n=g.attributes.normal,c=[];
  for(let i=0;i<n.count;i++){
   const shade=.68+.3*Math.abs(n.getY(i))+.12*n.getX(i);
   const color=new THREE.Color(0x345989).multiplyScalar(shade);c.push(color.r,color.g,color.b);
  }
  g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));mesh.material=new THREE.MeshBasicMaterial({vertexColors:true});
 };
 city.v7Shores.children.filter(o=>o.name.startsWith('v7-bank-rock-')).forEach(rockColor);
 gate.getObjectByName('gate-canyon-site-blender').children.filter(o=>o.name.startsWith('canyon-shoulder')).forEach(rockColor);
 for(const child of gate.userData.seatRoot.children){
  if(!/^(gate-arch-|leftTowerGroup$|rightTowerGroup$|channel-pier-)/.test(child.name))continue;
  child.traverse(o=>{if(o.isMesh&&!o.userData.isOutline){o.material=o.material.clone();o.material.color.setHex(o.name==='mech-strip'?0x87785d:0x42648b);}});
 }
}
function restoreOriginalGate(gate){
 const seat=gate.userData.seatRoot;
 const target=seat.getObjectByName('gate-target-blender-v1');
 for(const child of target.children){
  if(!child.isMesh)continue;
  // Keep the existing walkable meeting platform/stairs, not an invisible fortress collider.
  child.visible=!!child.userData.gateWalkable;
  child.userData.citadelSolidExterior=child.visible&&!!child.userData.gateSolid;
 }
 for(const child of seat.children){
  if(!/^(gate-arch-|leftTowerGroup$|rightTowerGroup$|channel-pier-)/.test(child.name))continue;
  child.visible=true;
  child.traverse(o=>{if(o.isMesh&&!o.userData.isOutline&&o.name!=='mech-strip'&&o.name!=='rubble')o.userData.citadelSolidExterior=true;});
 }
 for(const mesh of seat.userData.gateDressing||[])if(mesh.parent===seat)mesh.visible=false;
 seat.userData.v10OriginalGateRestored=true;
}
