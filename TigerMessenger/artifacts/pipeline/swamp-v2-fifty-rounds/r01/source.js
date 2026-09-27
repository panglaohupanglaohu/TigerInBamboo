import * as THREE from 'three';
export const SWAMP_V2_ROUND=1;
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
}
