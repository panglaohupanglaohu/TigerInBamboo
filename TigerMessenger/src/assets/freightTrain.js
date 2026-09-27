import {ROBOT_CARGO_SLOTS} from '../gameplay/robotOps/logistics.js';
import * as THREE from 'three';
import {mergeStaticGroup} from '../world/geometryMerge.js';

export const FREIGHT_PITCH=7.0;
export const FREIGHT_WAGONS=ROBOT_CARGO_SLOTS+2;
// +X is the direction of travel; width remains inside the existing twin tracks.
export function createFreightVehicle({variant='red',wagon=-1}={}){
 if(wagon>=0&&wagon<ROBOT_CARGO_SLOTS)return createHeavyFlatcar(variant,wagon);
 const root=new THREE.Group();root.name=`${variant}-freight-${wagon<0?'locomotive':wagon+1}`;
 root.userData.variant=variant;root.userData.vehicleType='freight';
 const mats={};for(const [k,c]of Object.entries({body:variant==='red'?0x792f32:0x32657c,iron:0x263339,brass:0xc19a59,wood:0x967450,cream:0xe4d5b0,glass:0x183340,copper:0xa56840}))mats[k]=new THREE.MeshStandardMaterial({color:c,roughness:.65,metalness:k==='brass'||k==='iron'?.55:.15});
 const part=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mats[mat]);m.position.set(x,y,z);root.add(m);return m;};
 const box=(w,h,d,mat,x,y,z)=>part(new THREE.BoxGeometry(w,h,d),mat,x,y,z);
 const cyl=(r,h,mat,x,y,z,axis='y')=>{const m=part(new THREE.CylinderGeometry(r,r,h,16),mat,x,y,z);if(axis==='x')m.rotation.z=Math.PI/2;if(axis==='z')m.rotation.x=Math.PI/2;return m;};
 box(3.8,.15,.92,'iron',0,.36,0);box(3.65,.12,.94,'wood',0,.48,0);
 for(const x of [-1.27,1.27]){box(.72,.16,.63,'iron',x,.22,0);for(const dx of[-.23,.23])for(const z of[-.35,.35]){cyl(.19,.1,'iron',x+dx,.07,z,'z');cyl(.10,.11,'brass',x+dx,.07,z,'z');}}
 for(const x of[-1.98,1.98])box(.25,.10,.12,'iron',x,.36,0);
 if(wagon<0){
  // Forward cab keeps existing passenger, companion and driver camera anchors usable.
  box(1.68,.1,1.04,'body',.98,1.68,0);
  for(const x of [.18,1.78])for(const z of[-.46,.46])box(.065,1.12,.065,'brass',x,1.10,z);
  for(const z of[-.46,.46]){box(1.7,.24,.06,'body',.98,.62,z);box(.08,.7,.06,'brass',.93,1.32,z);}
  box(.10,.52,.85,'body',1.82,.79,0);box(.10,.10,.84,'brass',1.82,1.15,0);
  cyl(.4,1.85,'body',-.93,.98,0,'x');for(const x of[-1.72,-1.15,-.55])cyl(.417,.06,'brass',x,.98,0,'x');
  cyl(.14,.64,'iron',-1.45,1.60,0);cyl(.20,.08,'brass',-1.45,1.90,0);cyl(.19,.24,'copper',-.65,1.45,0);
  for(const z of[-.44,.44]){box(1.7,.055,.055,'brass',-.95,1.20,z);box(.65,.055,.11,'iron',1.1,.29,z*1.22);}
  cyl(.13,.12,'brass',1.96,.99,0,'x');cyl(.10,.13,'cream',1.97,.99,0,'x');
  for(const z of[-.3,.3])box(.38,.1,.28,'wood',.5,.67,z);
 }else{
  const kind=wagon%4;
  if(kind===0||kind===3){
   for(const z of[-.44,.44]){box(3.65,.30,.07,'body',0,.68,z);for(const x of[-1.7,-.85,0,.85,1.7])box(.06,.44,.08,'brass',x,.76,z);}
   for(const x of[-1.15,0,1.15]){box(.92,.65,.70,kind===3?'iron':'wood',x,.87,0);for(const dx of[-.31,.31])box(.05,.68,.73,'brass',x+dx,.88,0);if(kind===3)cyl(.23,.74,'copper',x,1.39,0,'z');}
  }else if(kind===1){
   cyl(.40,2.8,'copper',0,1,0,'x');for(const x of[-1.35,-.85,.85,1.35])cyl(.415,.07,'iron',x,1,0,'x');cyl(.14,.2,'brass',0,1.45,0);
   for(const x of[-.9,.9])box(.22,.35,.82,'iron',x,.61,0);
  }else{
   box(3.35,1.05,.88,'body',0,1.03,0);box(3.55,.10,1,'iron',0,1.61,0);
   for(const z of[-.452,.452]){box(.95,.90,.04,'wood',0,1.01,z);for(const x of[-1.5,-.5,.5,1.5])box(.06,1.0,.05,'brass',x,1.03,z);box(.35,.15,.05,'cream',.95,1.29,z);}
  }
 }
 mergeStaticGroup(root);root.traverse(o=>{if(o.isMesh)o.geometry.scale(1.45,1.3,2.5);});root.userData.couplingHalfLength=2.87;root.userData.couplingHeight=.468;return root;
}

function createHeavyFlatcar(variant,wagon){
 const root=new THREE.Group();root.name=`${variant}-heavy-flatcar-${wagon+1}`;root.userData.variant=variant;root.userData.cargoSlot=wagon;root.userData.deckHeight=.65;root.userData.couplingHalfLength=3.34;root.userData.couplingHeight=.44;
 const iron=new THREE.MeshStandardMaterial({color:0x293c43,metalness:.55,roughness:.65}),timber=new THREE.MeshStandardMaterial({color:0x87785c,roughness:.85}),brass=new THREE.MeshStandardMaterial({color:0xb69a5d,metalness:.55,roughness:.5}),body=new THREE.MeshStandardMaterial({color:variant==='red'?0x793b3b:0x3e6b7a,roughness:.7});
 const mesh=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);root.add(m);return m;};
 const box=(w,h,d,mat,x,y,z)=>mesh(new THREE.BoxGeometry(w,h,d),mat,x,y,z);
 box(6.4,.18,3.3,iron,0,.38,0);box(6.15,.16,3.10,timber,0,.56,0);
 for(const z of[-1.60,1.60]){box(6.4,.25,.1,body,0,.49,z);for(const x of[-2.7,-1.3,0,1.3,2.7]){const ring=mesh(new THREE.TorusGeometry(.095,.025,6,12),brass,x,.71,z);ring.rotation.x=Math.PI/2;}}
 for(const x of[-2.15,2.15]){box(1.0,.20,1.95,iron,x,.24,0);for(const dx of[-.34,.34])for(const z of[-.875,.875]){const w=mesh(new THREE.CylinderGeometry(.24,.24,.16,16),iron,x+dx,.11,z);w.rotation.x=Math.PI/2;const hub=mesh(new THREE.CylinderGeometry(.12,.12,.18,12),brass,x+dx,.11,z);hub.rotation.x=Math.PI/2;}}
 for(const side of[-1,1])box(.3,.12,.18,iron,side*3.34,.44,0);
 mergeStaticGroup(root);return root;
}
