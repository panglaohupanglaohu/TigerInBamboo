import * as THREE from 'three';
import baked from '../../../assets/models/optimized/citadel-harbor-curtain/harborCurtainR01.js';
import {mergeStaticGroup} from '../geometryMerge.js';
// Front-harbor local frame. The curtain sits outside the four-metre stair width.
export function buildHarborCurtain(sea,midY){
 const root=new THREE.Group();root.name='citadel-front-harbor-curtain';
 const stone=new THREE.MeshStandardMaterial({color:0xc6c5bb,roughness:.94});
 const trim=new THREE.MeshStandardMaterial({color:0xe0d6bd,roughness:.91});
 function box(name,x,y,z,w,h,d,mat=stone){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;root.add(m);}
 const segments=[[37.9,40.1,midY+2.15],[40.1,42.2,midY+1.55],[42.2,44.5,midY+1.0]];
 for(const [a,b,top]of segments){
  const x=(a+b)/2,bottom=Math.min(sea(a,92.45),sea(b,92.45))-1.5;
  box('curtain-continuous-core',x,(bottom+top)/2,92.45,b-a,top-bottom,.75);
  box('curtain-coping',x,top+.09,92.45,b-a+.08,.18,.98,trim);
  for(let y=bottom+.28,row=0;y<top-.18;y+=.56,row++){
   for(let left=a+(row%2?-.6:0);left<b;left+=1.2){const l=Math.max(a,left),r=Math.min(b,left+1.2);if(r-l<.12)continue;
    for(const face of [-1,1])box('curtain-ashlar', (l+r)/2,y,92.45+face*.395,r-l-.03,Math.min(.52,2*(top-y)),.07);
   }
  }
 }
 // End pier joins the existing turn guard, rather than leaving a floating wall end.
 const x=44.35,z=92.4,top=midY+1.28,bottom=sea(x,z)-1.6;
 box('curtain-return-pier',x,(bottom+top)/2,z,.88,top-bottom,1.0);
 box('curtain-return-cap',x,top+.1,z,1.06,.2,1.16,trim);
 root.userData.layout={segments,wallZ:92.45,depth:.75,stairEdge:92,minimumStairGap:.075,gateJoinX:37.9,returnX:44.35};
 mergeStaticGroup(root,{mergedTag:'harbor-curtain',onSurface:m=>{m.name='front-harbor-curtain-solid';m.userData.citadelSolidExterior=true;}});
 if(baked){root.children.forEach((m,i)=>{const part=baked.parts[i];if(!part)throw new Error('Missing Blender harbor curtain');const input=m.geometry.index?m.geometry.toNonIndexed():m.geometry;let digest=2166136261;for(const v of input.attributes.position.array)digest=Math.imul(digest^Math.round(v*1e4),16777619)>>>0;if(digest!==part.sourceDigest)throw new Error('Harbor curtain changed: regenerate Blender asset');if(input!==m.geometry)input.dispose();const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(part.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(part.normals,3));m.geometry.dispose();m.geometry=g;});root.userData.sourceBlender=baked.source;}
 return root;
}
