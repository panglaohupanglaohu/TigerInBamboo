import * as THREE from 'three';
export const V9_RELEASE_ROUND=2;
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
  const s=index===0?1:.55;
  for(const [x,z,r,h,c]of [[0,0,3.2,69,0],[-5,1,2.0,53,2],[4,2,2.2,59,0],[2,-4,1.4,43,3],[-2,-4,1.15,38,4]])prism(r*s,h*s,colors[c],g,x*s,z*s);
  if(round>=2)towerFlowers(root,g,s);
  record.h=69*s;root.userData.v9Round=round;root.userData.v9Root=g;
 }
}
export function finishCrystalV9Scene({scene,city,swamp,gate}){}
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
