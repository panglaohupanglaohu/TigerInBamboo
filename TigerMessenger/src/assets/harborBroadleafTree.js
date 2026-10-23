import * as THREE from 'three';
import {mergeStaticGroup} from '../world/geometryMerge.js';

/** Project interpretation of soft grouped foliage, not Oskar's impostor implementation. */
export function createHarborBroadleafTree({seed=9901,groupName='harbor-broadleaf-tree'}={}){
  const root=new THREE.Group();root.name=groupName;
  let state=seed>>>0;const rand=()=>((state=Math.imul(state,1664525)+1013904223>>>0)/4294967296);
  const bark=new THREE.MeshStandardMaterial({color:0x786957,roughness:1});
  const leaves=[0x527565,0x688972,0x82a083].map(color=>new THREE.MeshStandardMaterial({color,roughness:1}));
  const up=new THREE.Vector3(0,1,0);let branches=0,clusters=0;
  function limb(a,b,r0,r1){
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
    const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r0,delta.length(),9),bark);
    m.name='harbor-tree-branch-'+branches++;m.position.copy(start).addScaledVector(delta,.5);
    m.quaternion.setFromUnitVectors(up,delta.normalize());root.add(m);
  }
  const fork=[.10,3.15,.03];
  limb([0,0,0],[.20,1.8,.02],.36,.29);limb([.20,1.8,.02],fork,.29,.23);
  limb(fork,[-.22,5.65,-.14],.22,.11);
  // Negative spaces under and between lobes expose a connected, readable branch structure.
  const tips=[[-2.05,4.55,.50],[1.90,4.9,.66],[-1.40,5.6,-1.5],[1.45,6,-1.14],[-.75,6.75,.6],[.55,7.25,-.15],[.10,5.9,1.55]];
  for(let i=0;i<tips.length;i++){
    const tip=tips[i],base=[fork[0],3.0+i*.3,fork[2]],elbow=[tip[0]*.53,tip[1]-.9,tip[2]*.53];
    limb(base,elbow,.18-i*.012,.11);limb(elbow,tip,.11,.045);
    for(let k=0;k<3;k++){
      const a=k*Math.PI*2/3+i*.6,r=k===0?.1:.57;
      const m=new THREE.Mesh(new THREE.SphereGeometry(1,12,9),leaves[(i+k)%3]);
      m.name='harbor-tree-leaf-cluster-'+clusters++;
      m.position.set(tip[0]+Math.cos(a)*r,tip[1]+.37+(k===0?.4:0),tip[2]+Math.sin(a)*r);
      m.scale.set(.90+rand()*.25,.90+rand()*.32,.88+rand()*.20);
      // Broad, closed leaves retain volume from low rail-side and high inspection angles.
      const p=m.geometry.attributes.position;
      for(let v=0;v<p.count;v++){const x=p.getX(v),y=p.getY(v),z=p.getZ(v),s=1+.045*Math.sin(x*7+y*3+z*5+i);p.setXYZ(v,x*s,y*s,z*s);}
      m.geometry.computeVertexNormals();root.add(m);
    }
  }
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.userData.skipInk=true;}});
  mergeStaticGroup(root);root.traverse(o=>{if(o.isMesh)o.userData.skipInk=true;});
  Object.assign(root.userData,{kind:'harborBroadleafTree',assetType:'harborBroadleafTree',style:'soft-volume-branched-broadleaf',version:'harbor-broadleaf-1',seed,branchCount:branches,crownCount:clusters,height:8.9,collideRadius:.42,skipInk:true});
  return root;
}
