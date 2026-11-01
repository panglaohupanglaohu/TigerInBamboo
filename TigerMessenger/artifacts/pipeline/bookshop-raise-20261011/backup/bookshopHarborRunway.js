import * as THREE from 'three';
import {townSurfacePoint} from './bookshopTownSite.js';
import {factoryKit} from '../assets/factoryArchitecture.js';
import {mergeStaticGroup} from './geometryMerge.js';

// A continuous two-chord transfer truss connects a real factory runway end
// to the harbour crane's inland beam. Both ends share existing support frames.
export function buildBookshopHarborRunway({root,districts,R}){
 if(new URLSearchParams(globalThis.location?.search||'').get('grandFreighter')==='0')return;
 const dock=root.getObjectByName('bookshop-parts-quayside');
 root.updateWorldMatrix(true,true);
 const end=dock.localToWorld(new THREE.Vector3(8,10.1,0));let start,distance=Infinity;
 for(const d of districts)for(const x of[-38,38])for(const z of[-31,-53]){
  const at=d.localToWorld(townSurfacePoint(d,x,z,R,15.92)),gap=at.distanceTo(end);
  if(gap<distance){distance=gap;start=at;}
 }
 const g=new THREE.Group();g.name='bookshop-harbor-transfer-runway';root.add(g);
 const {M,beam}=factoryKit(g),steps=Math.ceil(distance/2.8),rows=[];
 const local=v=>root.worldToLocal(v.clone()).toArray();
 for(let i=0;i<=steps;i++){
  const t=i/steps,q=start.clone().lerp(end,t),up=q.clone().normalize();
  q.setLength(THREE.MathUtils.lerp(start.length(),end.length(),t)+Math.sin(Math.PI*t)*2);
  const along=end.clone().sub(start).normalize(),side=new THREE.Vector3().crossVectors(up,along).normalize();
  rows.push([-1,1].map(s=>[q.clone().addScaledVector(side,s*1.1),q.clone().addScaledVector(side,s*1.1).addScaledVector(up,1.1)]));
 }
 for(let i=0;i<=steps;i++){
  beam(local(rows[i][0][0]),local(rows[i][1][0]),.10,M.iron);
  for(let s=0;s<2;s++){
   beam(local(rows[i][s][0]),local(rows[i][s][1]),.09,M.iron);
   if(i){for(let h=0;h<2;h++)beam(local(rows[i-1][s][h]),local(rows[i][s][h]),h?.11:.16,M.iron);beam(local(rows[i-1][s][i%2]),local(rows[i][s][1-i%2]),.075,M.brass);}
  }
 }
 // The connector's side chords do not share the terminal beam direction.
 // Fan both chords into the actual end beam with a solid saddle joint.
 for(const [row,center] of [[rows[0],start],[rows[steps],end]]){
  const up=center.clone().normalize(),top=center.clone().addScaledVector(up,1.1);
  beam(local(center),local(top),.18,M.iron);
  for(const side of row){beam(local(side[0]),local(center),.16,M.iron);beam(local(side[1]),local(top),.12,M.iron);beam(local(side[0]),local(top),.09,M.brass);}
 }
 // Harbor saddle joins both real crane rails, including their upper chords.
 for(const z of[-1.1,1.1])for(const y of[10.1,11.2]){
  const anchor=dock.localToWorld(new THREE.Vector3(8,y,z));
  beam(local(anchor),local(end.clone().addScaledVector(end.clone().normalize(),y-10.1)),.16,M.iron);
 }
 g.userData.connection={factoryEnd:local(start),harborEnd:local(end),segments:steps,length:distance};
 mergeStaticGroup(g);return g;
}
