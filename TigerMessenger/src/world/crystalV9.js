import {V9_CLIFFS} from '../assets/crystalV9CliffsData.js';
import {finishCrystalV10Scene} from './crystalV10.js';
import {getCityFrame} from './crystalCityLayout.js';
import {crystalV7SwampDir} from './crystalV7Layout.js';
import * as THREE from 'three';
export const V9_RELEASE_ROUND=5;
export function crystalV9Round(){const q=new URLSearchParams(globalThis.location?.search||'');if(q.get('crystalV7')==='0')return 0;return q.has('crystalV9')?THREE.MathUtils.clamp(Number(q.get('crystalV9'))||0,0,10):V9_RELEASE_ROUND;}
const ink=new THREE.LineBasicMaterial({color:0x435b80,transparent:true,opacity:.62});
const colors=[0x89d9ec,0xa4dde6,0xc6bae3,0xeec2d6,0xf3d6a7];
function matte(color){return new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide});}
function outlined(g,material,name,parent){const m=new THREE.Mesh(g,material);m.name=name;parent.add(m);const line=new THREE.LineSegments(new THREE.EdgesGeometry(g,24),ink);line.name='v9-ink';m.add(line);return m;}
function prism(radius,height,color,parent,x,z){
 const vs=[],faces=[],N=6;
 for(const [y,r] of [[0,radius],[height*.84,radius],[height,0]])for(let i=0;i<N;i++){const a=i*Math.PI/3;vs.push(Math.cos(a)*r,y,Math.sin(a)*r);}
 for(let k=0;k<2;k++)for(let i=0;i<N;i++){const a=k*N+i,b=k*N+(i+1)%N,c=(k+1)*N+(i+1)%N,d=(k+1)*N+i;faces.push(a,b,d,b,c,d);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vs,3));g.setIndex(faces);g.computeVertexNormals();
 const palette=[color,0xd5eef2,0xb3a4d9,0xf7e8d8].map(matte);g.clearGroups();for(let i=0;i<12;i++)g.addGroup(i*6,6,i%4);
 const mesh=outlined(g,palette,'v9-crystal-prism',parent);mesh.position.set(x,0,z);return mesh;
}
export function installCrystalV9Towers(city){
 const round=crystalV9Round();if(!round)return;
 for(const [index,record]of city.crystals.entries()){
  const root=record.group;
  root.userData.v9OriginalChildren=root.children.map(o=>[o,o.visible]);
  for(const child of root.children)if(child.name!=='bio-dome-layer')child.visible=false;
  const g=new THREE.Group();g.name='crystal-v9-tower';g.scale.set(1/root.scale.x,1/root.scale.y,1/root.scale.z);root.add(g);
  if(round>=4){const facing=crystalV7SwampDir().addScaledVector(record.dir,-crystalV7SwampDir().dot(record.dir)).normalize().applyQuaternion(root.quaternion.clone().invert());g.rotation.y=Math.atan2(facing.x,facing.z);}
  const s=index===0?1:.55;
  for(const [x,z,r,h,c]of [[0,0,3.2,69,0],[-5,1,2.0,53,2],[4,2,2.2,59,0],[2,-4,1.4,43,3],[-2,-4,1.15,38,4]])prism(r*s,h*s,colors[c],g,x*s,z*s);
  if(round>=2)towerFlowers(root,g,s);
  if(round>=3)towerRooms(g,s);
  if(round>=4)towerSupports(g,s);
  record.h=69*s;root.userData.v9Round=round;root.userData.v9Root=g;
 }
}
export function finishCrystalV9Scene({scene,city,swamp,gate}){if(crystalV9Round()>=5)installCliffs(city,gate);finishCrystalV10Scene({scene,city,swamp,gate}); }
function rod(parent,a,b,r,color,name='v9-organic-stem'){
 const delta=b.clone().sub(a),m=outlined(new THREE.CylinderGeometry(r*.75,r,delta.length(),6),matte(color),name,parent);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;
}
function flower(parent,x,y,z,r){
 const vs=[],idx=[],segments=48,rings=6;
 for(let k=0;k<=rings;k++)for(let j=0;j<=segments;j++){
  const a=j/segments*Math.PI*2,t=k/rings,rr=r*t*(1+.07*Math.cos(a*8));
  vs.push(x+Math.cos(a)*rr,y+r*(.10+.32*t*t-.06*Math.cos(a*8)*t),z+Math.sin(a)*rr*.82);
 }
 for(let k=0;k<rings;k++)for(let j=0;j<segments;j++){const a=k*(segments+1)+j,b=a+segments+1;idx.push(a,b,a+1,a+1,b,b+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vs,3));g.setIndex(idx);g.computeVertexNormals();
 const petals=[0xe77783,0xeb9aab,0xd26482,0xf1b0ad].map(matte);g.clearGroups();for(let i=0;i<idx.length;i+=6)g.addGroup(i,6,Math.floor((i/6)%segments/6)%4);
 const m=new THREE.Mesh(g,petals);m.name='v9-coral-flower-canopy';parent.add(m);
 for(let j=0;j<8;j++){
  const a=j*Math.PI/4,pts=[];for(let k=0;k<=rings;k++){const t=k/rings,rr=r*t*1.07;pts.push(new THREE.Vector3(x+Math.cos(a)*rr,y+r*(.10+.32*t*t-.06*t)+.02,z+Math.sin(a)*rr*.82));}
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),ink);line.name='v9-petal-vein';parent.add(line);
 }
 rod(parent,new THREE.Vector3(x*.45,0,z*.45),new THREE.Vector3(x,y+r*.1,z),.18,0xafadd2);
}
function towerFlowers(root,g,s){
 for(const layer of root.children.filter(o=>o.name==='bio-dome-layer'))layer.visible=false;
 for(const [x,y,z,r] of [[-6,17,1,5.6],[5,31,3,4.8],[-4,48,-1,4.2],[5,10,-5,4.3]])flower(g,x*s,y*s,z*s,r*s);
}
function room(parent,x,y,z,s){
 const g=new THREE.Group();g.name='v9-transparent-habitat';g.position.set(x*s,y*s,z*s);g.scale.setScalar(s);parent.add(g);
 const glass=new THREE.MeshBasicMaterial({color:0x69c9e9,transparent:true,opacity:.23,depthWrite:false,side:THREE.DoubleSide});
 outlined(new THREE.BoxGeometry(7,4.2,4.5),glass,'v9-habitat-glass',g).position.y=2.1;
 const floor=outlined(new THREE.BoxGeometry(7.3,.18,4.8),matte(0xd1bfd9),'v9-room-floor',g);floor.position.y=-.09;
 for(const xx of [-3.5,3.5])for(const zz of [-2.25,2.25])rod(g,new THREE.Vector3(xx,0,zz),new THREE.Vector3(xx,4.2,zz),.055,0xaa907f,'v9-bronze-frame');
 for(const yy of [0,4.2])for(const zz of [-2.25,2.25])rod(g,new THREE.Vector3(-3.5,yy,zz),new THREE.Vector3(3.5,yy,zz),.055,0xaa907f,'v9-bronze-frame');
 // Tiny occupants and a table provide the human scale in the user's close-up.
 const table=outlined(new THREE.CylinderGeometry(.7,.7,.09,12),matte(0xe6d6bb),'v9-table',g);table.position.set(.4,1.1,.2);
 rod(g,new THREE.Vector3(.4,0,.2),new THREE.Vector3(.4,1.1,.2),.07,0x9f91b7);
 for(const [xx,zz]of [[-1.5,.6],[1.8,-.4]]){
  const body=outlined(new THREE.CylinderGeometry(.20,.30,1.1,6),matte(0xe8ddd6),'v9-resident',g);body.position.set(xx,.75,zz);
  const head=outlined(new THREE.SphereGeometry(.18,8,6),matte(0xa18184),'v9-resident-head',g);head.position.set(xx,1.5,zz);
 }
 return g;
}
function towerRooms(g,s){for(const [x,y,z]of [[-5,12,3],[5,25,3],[-3,42,2]])room(g,x,y,z,s);}
function towerSupports(g,s){
 for(const [x,y,z]of [[-5,12,3],[5,25,3],[-3,42,2]]){
  for(const side of [-1,1]){
   const curve=new THREE.CubicBezierCurve3(new THREE.Vector3(x*s*.3,(y-8)*s,z*s*.3),new THREE.Vector3(x*s*.35,(y-3)*s,z*s*.35),new THREE.Vector3((x+side*3)*s,(y-1)*s,z*s),new THREE.Vector3((x+side*3)*s,y*s,z*s));
   outlined(new THREE.TubeGeometry(curve,12,.15*s,5,false),matte(0xb7afd6),'v9-curved-room-bracket',g);
  }
  const beam=outlined(new THREE.BoxGeometry(8*s,.15*s,1.3*s),matte(0xc8bfdb),'v9-habitat-bridge',g);beam.position.set(x*s*.45,y*s,z*s);
 }
}
function installCliffs(city,gate){
 const frame=getCityFrame();
 for(const part of V9_CLIFFS){
  const r=city.crystals[part.owner],x=frame.east.clone().addScaledVector(r.dir,-frame.east.dot(r.dir)).normalize(),z=x.clone().cross(r.dir).normalize(),p=[];
  for(let i=0;i<part.positions.length;i+=3){const v=r.dir.clone().multiplyScalar(r.root).addScaledVector(x,part.positions[i]).addScaledVector(z,part.positions[i+2]).normalize().multiplyScalar(r.root+part.positions[i+1]);p.push(...v.toArray());}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(part.colors,3));g.computeVertexNormals();
  const mesh=city.v7Shores.getObjectByName('v7-bank-rock-'+part.owner);mesh.geometry=g;mesh.material=new THREE.MeshBasicMaterial({vertexColors:true});
 }
 const site=gate.getObjectByName('gate-canyon-site-blender');
 site.children.filter(o=>o.name.startsWith('canyon-shoulder')).forEach(o=>{
  const g=o.geometry,n=g.attributes.normal,c=[];
  for(let i=0;i<n.count;i++){const color=new THREE.Color(n.getX(i)>.25?0xefe0c7:n.getX(i)<-.25?0xbeb6cf:0xd5c4c5);c.push(color.r,color.g,color.b);}
  g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));o.material=new THREE.MeshBasicMaterial({vertexColors:true});
 });
}
