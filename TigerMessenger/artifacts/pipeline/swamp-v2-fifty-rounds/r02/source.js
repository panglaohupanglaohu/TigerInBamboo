import * as THREE from 'three';
export const SWAMP_V2_ROUND=2;
export function applySwampV2Art(swamp){
 if(new URLSearchParams(globalThis.location?.search||'').get('swampV2')==='0')return;
 swamp.userData.swampV2Round=SWAMP_V2_ROUND;
 // Keep objects and random sequence intact; only suspend visible lianas for the approved build scope.
 swamp.traverse(o=>{if(o.name.startsWith('swamp-vine-')||o.name==='swamp-cross-tree-vine')o.visible=false;});
 const tree=swamp.getObjectByName('swamp-ancient-world-tree'),trunk=tree?.getObjectByName('world-tree-trunk');
 if(!trunk)return;
 // Replace the six-sided pole with a continuous tapered, gently curved trunk at the same anchor.
 const g=new THREE.CylinderGeometry(1.5,4.2,58,20,16),a=g.attributes.position;
 for(let i=0;i<a.count;i++){
  const y=a.getY(i),t=(y+29)/58,angle=Math.atan2(a.getZ(i),a.getX(i));
  const ridge=1+.08*Math.sin(angle*7+t*2);
  a.setXYZ(i,a.getX(i)*ridge+Math.sin(t*3.3)*.9,y,a.getZ(i)*ridge+Math.sin(t*4)*.45);
 }
 g.computeVertexNormals();trunk.geometry=g;
 trunk.material=new THREE.MeshBasicMaterial({color:0x52767a});
 for(const child of trunk.children)if(child.isMesh)child.visible=false;
 const bark=new THREE.LineBasicMaterial({color:0x294855,transparent:true,opacity:.65});
 for(let k=0;k<14;k++){
  const angle=k/14*Math.PI*2,pts=[];
  for(let j=0;j<=28;j++){const t=j/28,r=THREE.MathUtils.lerp(4.2,1.5,t)*(1+.08*Math.sin(angle*7+t*2));pts.push(new THREE.Vector3(Math.cos(angle)*r+Math.sin(t*3.3)*.9,-29+t*58,Math.sin(angle)*r+Math.sin(t*4)*.45));}
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),bark);line.name='v2-bark-line';trunk.add(line);
 }
 // Branch forks support the former floating crown volumes without changing tree anchoring.
 const branchMat=new THREE.MeshBasicMaterial({color:0x52767a});
 const crowns=tree.children.filter(o=>o.isMesh&&o.geometry?.type==='IcosahedronGeometry');
 for(const [i,crown]of crowns.entries()){
  const tip=crown.position.clone(),start=new THREE.Vector3(-8,49+i*.9,-7),mid=start.clone().lerp(tip,.55);mid.x+=Math.sin(i*2.4)*2.5;
  const curve=new THREE.CatmullRomCurve3([start,mid,tip]);
  const branch=new THREE.Mesh(new THREE.TubeGeometry(curve,18,.55,8,false),branchMat);branch.name='v2-world-tree-branch';tree.add(branch);
  crown.geometry=new THREE.IcosahedronGeometry(1,2);crown.scale.set(5.2+(i%3),2.5,4.5+(i%2));
  crown.material=new THREE.MeshBasicMaterial({color:[0x638780,0x769487,0x527a76][i%3]});
  for(const child of crown.children)child.visible=false;
  crown.visible=false;
  for(let k=0;k<18;k++){
   const a=k*2.399,rad=1.5+Math.sqrt(k/18)*4.5;
   const leaf=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshBasicMaterial({color:[0x537b73,0x729589,0x8b9f88,0x406a67][k%4]}));
   leaf.name='v2-crown-cluster';leaf.position.copy(tip).add(new THREE.Vector3(Math.cos(a)*rad,Math.sin(k*1.7)*1.2,Math.sin(a)*rad*.8));leaf.scale.set(2.1,1.3,1.7);tree.add(leaf);
  }
 }

}
