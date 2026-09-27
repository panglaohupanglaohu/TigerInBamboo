import {refineGateMoebiusTerrain} from './gateMoebiusTerrain.js';
import * as THREE from 'three';
import {installGateMoebiusV10} from './gateMoebiusV10.js';

// V10 is a separate civilization-specific pass; never changes global lighting or holy-city materials.
export const V10_RELEASE_ROUND=14;
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
 if(round>=8)mechanicalSupports(city);
 if(round>=9)serviceSpines(city);
 if(round>=11)tieredHabitatCrowns(city);
 if(round>=12)crystalBasalRock(city);
 if(round>=10)swamp.traverse(o=>{
  if(!o.name.startsWith('swamp-towering-tree'))return;
  // Target is an open marsh between cities, with low planted islands rather than a canopy wall.
  o.scale.multiply(new THREE.Vector3(.72,.42,.72));
  o.userData.v10MarshCanopy=true;
 });
}
function serviceSpines(city){
 const metal=new THREE.MeshBasicMaterial({color:0x8e8065}),dark=new THREE.MeshBasicMaterial({color:0x3d516c});
 for(const [index,r]of city.crystals.entries()){
  const root=r.group.userData.v9Root,s=index===0?1:.55;
  for(let i=0;i<5;i++){
   const x=(-2.2+i*1.1)*s,z=-4*s,h=(27+i%3*7)*s;
   const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.055*s,.08*s,h,7),metal);pipe.name='v10-service-spine';pipe.position.set(x,h/2,z);root.add(pipe);
   for(let y=3*s;y<h;y+=4*s){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.16*s,.035*s,5,12),metal);ring.name='v10-service-collar';ring.rotation.x=Math.PI/2;ring.position.set(x,y,z);root.add(ring);
   }
   const tip=new THREE.Mesh(new THREE.ConeGeometry(.1*s,1.2*s,7),metal);tip.name='v10-spine-finial';tip.position.set(x,h+.6*s,z);root.add(tip);
  }
  for(const [x,y,z]of [[-5,12,3],[5,25,3],[-3,42,2]]){
   const pts=[new THREE.Vector3(x*s,y*s,z*s),new THREE.Vector3(x*.6*s,(y-.5)*s,0),new THREE.Vector3(x*.3*s,(y-2)*s,-3*s)];
   const duct=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),20,.13*s,8,false),dark);duct.name='v10-habitat-service-duct';root.add(duct);
  }
 }
}
function mechanicalSupports(city){
 const bronze=new THREE.MeshBasicMaterial({color:0x8d8066}),dark=new THREE.MeshBasicMaterial({color:0x384958});
 for(const [index,r] of city.crystals.entries()){
  const root=r.group.userData.v9Root,s=index===0?1:.55;
  for(const [x,y,z]of [[-5,12,3],[5,25,3],[-3,42,2]])for(const side of [-1,1]){
   const curve=new THREE.CubicBezierCurve3(new THREE.Vector3(x*.4*s,(y-9)*s,z*.4*s),new THREE.Vector3(x*.4*s,(y-2)*s,z*.4*s),new THREE.Vector3((x+side*4)*s,(y-1)*s,z*s),new THREE.Vector3((x+side*4)*s,y*s,z*s));
   for(const offset of [-.13,.13]){
    const g=new THREE.TubeGeometry(curve,20,.075*s,6,false),o=new THREE.Mesh(g,bronze);o.position.z=offset*s;o.name='v10-bronze-buttress-conduit';root.add(o);
   }
   for(const t of [.3,.6,.85]){
    const p=curve.getPoint(t),m=new THREE.Mesh(new THREE.TorusGeometry(.27*s,.065*s,6,16),bronze);m.position.copy(p);m.name='v10-bracket-joint';root.add(m);
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.15*s,.15*s,.2*s,10),dark);hub.position.copy(p);hub.rotation.x=Math.PI/2;hub.name='v10-bracket-hub';root.add(hub);
   }
  }
 }
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
 refineGateMoebiusTerrain(gate.getObjectByName('gate-canyon-site-blender')); 
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

// Layered botanical conservatory crowns, independent of existing walk floors.
function tieredHabitatCrowns(city){
 const frame=new THREE.MeshBasicMaterial({color:0x8e8065});
 const glass=new THREE.MeshBasicMaterial({color:0xa4dbc6,transparent:true,opacity:.25,depthWrite:false,side:THREE.DoubleSide});
 for(const r of city.crystals)for(const room of r.group.userData.v9Root.children.filter(o=>o.name==='v9-transparent-habitat')){
  const dome=new THREE.Mesh(new THREE.SphereGeometry(3.55,32,16,0,Math.PI*2,0,Math.PI/2),glass);dome.scale.y=.38;dome.position.y=4.2;dome.name='v11-botanical-dome';room.add(dome);
  for(let i=0;i<12;i++){
   const a=i*Math.PI/6,points=[];for(let j=0;j<=16;j++){const t=j/16*Math.PI/2;points.push(new THREE.Vector3(Math.cos(a)*3.55*Math.cos(t),4.2+1.349*Math.sin(t),Math.sin(a)*3.55*Math.cos(t)));}
   const rib=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),16,.032,5,false),frame);rib.name='v11-conservatory-roof-rib';room.add(rib);
  }
  for(const [y,radius]of [[4.28,3.75],[4.4,3.65]]){const collar=new THREE.Mesh(new THREE.TorusGeometry(radius,.06,6,40),frame);collar.rotation.x=Math.PI/2;collar.position.y=y;collar.name='v11-tiered-roof-collar';room.add(collar);}
 }
}

// Jagged blue bedrock shoulders follow existing prism footprints, preserving harbour approaches.
function crystalBasalRock(city){
 const ink=new THREE.LineBasicMaterial({color:0x213d61,transparent:true,opacity:.65});
 for(const [towerIndex,r]of city.crystals.entries()){
  const root=r.group.userData.v9Root,s=towerIndex===0?1:.55;
  for(const [index,prism]of root.children.filter(o=>o.name==='v9-crystal-prism').entries()){
   const source=prism.geometry.attributes.position,positions=[],indices=[],colors=[];
   const refined=crystalV10Round()>=13,n=refined?24:6,levels=refined?9:5;
   for(let ring=0;ring<levels;ring++)for(let i=0;i<n;i++){
    const t=ring/(levels-1),q=i/n*6,k=Math.floor(q),f=q-k;
    const bx=THREE.MathUtils.lerp(source.getX(k),source.getX((k+1)%6),f)*prism.scale.x,bz=THREE.MathUtils.lerp(source.getZ(k),source.getZ((k+1)%6),f)*prism.scale.z;
    const h=(index===0?15:9+index)*s*(.85+.15*Math.sin(q*2.7+index));
    const spread=1.6-.6*t+.065*Math.sin(t*8.4+q)*Math.sin(t*Math.PI);
    // Recess narrow vertical clefts into the existing envelope: no enlargement toward paths.
    const recess=refined?1-(.06+.13*Math.pow(.5+.5*Math.sin(i*2.3+index),4))*(.4+.6*Math.sin(t*Math.PI)):1;
    const lift=refined?.18*s*Math.sin(i*1.7+ring*.9)*Math.sin(t*Math.PI):0;
    positions.push(prism.position.x+bx*spread*recess,t*h-.15+lift,prism.position.z+bz*spread*recess);
    const c=new THREE.Color(refined?[0x29476c,0x365a82,0x43678e][i%3]:[0x2b4569,0x36567d,0x41638a][(i+ring)%3]);colors.push(c.r,c.g,c.b);
   }
   for(let j=0;j<levels-1;j++)for(let i=0;i<n;i++){const a=j*n+i,b=j*n+(i+1)%n;indices.push(a,a+n,b,b,a+n,b+n);}
   const cap=(levels-1)*n;for(let i=1;i<n-1;i++)indices.push(cap,cap+i+1,cap+i);
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();
   const rock=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));rock.name='v12-crystal-bedrock';root.add(rock);
   if(crystalV10Round()>=14)etchCrystalRock(rock.material);
   const edges=new THREE.LineSegments(new THREE.EdgesGeometry(g,22),ink);edges.name='v12-bedrock-creases';root.add(edges);
  }
 }
}

function etchCrystalRock(material){
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 vRockLocal;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRockLocal=position;');
  shader.fragmentShader='varying vec3 vRockLocal;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float angle=atan(vRockLocal.z,vRockLocal.x);
   float seam=abs(sin(angle*31.0+0.17*sin(vRockLocal.y*1.6)));
   float width=max(fwidth(seam)*1.15,0.018);
   float fissure=(1.0-smoothstep(0.012,width+0.012,seam))*smoothstep(-0.3,0.4,sin(vRockLocal.y*0.83+angle*17.0));
   float bed=1.0-smoothstep(0.018,0.055,abs(sin(vRockLocal.y*2.1+0.22*sin(angle*9.0))));
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.045,0.09,0.16),fissure*0.55+bed*0.10);
  `);
 };
 material.customProgramCacheKey=()=> 'crystal-rock-ink-v14';
}
