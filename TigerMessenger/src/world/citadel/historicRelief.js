import * as THREE from 'three';
import {mergeStaticGroup} from '../geometryMerge.js';
// Shallow masonry relief is attached to existing structural faces. Door axes,
// stair treads and the curved rail tunnel remain untouched.
export function buildHistoricRelief(root){
 const groups=[],stone=new THREE.MeshStandardMaterial({color:0xc6bba5,roughness:.95}),shade=new THREE.MeshStandardMaterial({color:0x756c5d,roughness:1});
 const group=(parent,name,round)=>{const g=new THREE.Group();g.name=name;g.userData.historyRound=round;parent.add(g);groups.push(g);return g;};
 const box=(g,name,x,y,z,w,h,d,m=stone)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.name=name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;};
 const tower=root.getObjectByName('highland-central-sacred-tower');
 if(tower){
  const g=group(tower,'historic-old-stone-cornices',31);
  for(const [width,depth,ys]of [[5.7,5.25,[8.0,11.8,14.3]],[4.35,4.15,[16.8,20.8]],[3.35,3.2,[24.6,28.0]]]){
   for(const y of ys)for(const side of[-1,1]){
    box(g,'historic-stone-cornice',0,y,side*(depth/2+.055),width+.18,.15,.25);
    box(g,'historic-stone-cornice',side*(width/2+.055),y,0,.25,.15,depth+.18);
    box(g,'historic-cornice-recess',0,y-.10,side*(depth/2+.016),width,.055,.06,shade);
   }
   const lo=ys[0]-.8,hi=ys.at(-1)+.2;
   for(const x of[-width/2+.15,width/2-.15])for(const z of[-depth/2-.045,depth/2+.045])
    for(let y=lo;y<hi;y+=.72)box(g,'historic-dressed-quoin',x,y,z,.40,.48,.19);
  }
 }
 const castle=root.getObjectByName('citadel-target-castle-silhouette');
 if(castle){
  const g=group(castle,'historic-new-stone-cornices',32);
  for(const f of castle.userData.facadeWfc?.towers||[]){
   const fac=new THREE.Group();fac.position.set(f.anchor[0],0,f.anchor[1]);fac.rotation.y=f.yaw;g.add(fac);
   const height=f.top-f.bottom,ch=height/f.rows;
   for(let row=0;row<=f.rows;row++){
    const y=f.bottom+row*ch+(row===0?.28:-.22);
    box(fac,'historic-stone-cornice',0,y,.30,f.width+.18,.22,.36);
    box(fac,'historic-cornice-recess',0,y-.15,.245,f.width,.08,.06,shade);
   }
   for(const x of[-f.width/2+.22,-f.width/6,f.width/6,f.width/2-.22]){
    box(fac,'historic-facade-pilaster',x,(f.bottom+f.top)/2,.26,.34,height-.6,.25);
    for(const y of[f.bottom+.65,f.top-.62])box(fac,'historic-pilaster-capital',x,y,.34,.63,.27,.42);
   }
  }
 }
 if(root.name==='highland-gate'&&root.userData.toRailWorld){
  const g=group(root,'historic-gate-stone-cornices',33);
  const inv=root.matrixWorld.clone().invert();
  for(const x of[-12.7,12.7])for(const y of[29.9,30.35]){
   // High on the masonry crown, well above the freight swept volume.
   const o=box(g,'historic-crown-coping',0,0,0,3.4,.23,3.4);
   const p=o.geometry.attributes.position;
   for(let i=0;i<p.count;i++){const v=root.userData.toRailWorld(x+p.getX(i),y+p.getY(i),p.getZ(i)).applyMatrix4(inv);p.setXYZ(i,...v.toArray());}
   o.geometry.computeVertexNormals();o.geometry.computeBoundingSphere();
  }
 }
 for(const g of groups){const count=[];g.traverse(o=>{if(o.isMesh)count.push(o);});g.userData.parts=count.length;mergeStaticGroup(g);g.traverse(o=>{if(o.isMesh){o.userData.ashleyPalette=1;o.userData.holyOldTownDone=true;}});}
 return groups;
}
