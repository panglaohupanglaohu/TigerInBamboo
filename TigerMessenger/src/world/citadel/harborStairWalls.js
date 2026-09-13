import * as THREE from 'three';
import {harborStairHeight} from './harborStairProfile.js';

// Two retaining walls carry the exposed stair down into the actual shoreline.
// Construct only after final ocean alignment, using the tread height profile.
export function buildHarborStairWalls(dockY,surface){
  const root=new THREE.Group();root.name='citadel-harbor-stair-walls';
  const stone=new THREE.MeshStandardMaterial({color:0xb5b8b2,roughness:.98});
  const coping=new THREE.MeshStandardMaterial({color:0xd9d1be,roughness:.92});
  const start=61.25,end=77.6,segments=44;
  for(const side of [-1,1]){
    const x=42+side*2.32,points=[];
    for(let i=0;i<=segments;i++){
      const z=start+(end-start)*i/segments;
      points.push({z,top:harborStairHeight(dockY,z)+1.0,bottom:Math.min(surface(x,z)-1.8,harborStairHeight(dockY,z)-1.5)});
    }
    function strip(name,width,mat,isCoping){
      const s=new THREE.Shape();s.moveTo(-points[0].z,points[0].top);
      for(const p of points.slice(1))s.lineTo(-p.z,p.top);
      for(const p of [...points].reverse())s.lineTo(-p.z,isCoping?p.top-.16:p.bottom);
      s.closePath();
      const g=new THREE.ExtrudeGeometry(s,{depth:width,bevelEnabled:false});
      g.rotateY(Math.PI/2);g.translate(x-width/2,0,0);
      const m=new THREE.Mesh(g,mat);m.name=name+'-'+side;
      m.castShadow=true;m.receiveShadow=true;
      m.userData.citadelSolidExterior=true;m.userData.sourceId=m.name;root.add(m);
    }
    strip('harbor-stair-retaining-wall',.42,stone,false);
    strip('harbor-stair-coping',.52,coping,true);
  }
  root.userData.sourceId='citadel-stair-retaining-walls-v1';
  root.userData.clearWidth=4.12;
  return root;
}
