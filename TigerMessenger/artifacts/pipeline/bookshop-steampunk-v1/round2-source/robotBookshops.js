import * as THREE from 'three';
import {mergeStaticGroup} from '../world/geometryMerge.js';

export function createRobotBookshop(name,variant){
 const root=new THREE.Group();root.name=name+'书店';root.userData.kind='robot-bookshop';
 const colors=variant==='ant'?[0x936446,0xbe805b,0x664936]:[0xddd7b9,0x90a08b,0x5c7467];
 const mats=colors.map(color=>new THREE.MeshStandardMaterial({color,roughness:.85}));
 const cream=new THREE.MeshStandardMaterial({color:0xe9dab3,roughness:.8}),dark=new THREE.MeshStandardMaterial({color:0x384d50,roughness:.5}),gold=new THREE.MeshStandardMaterial({color:0xc2975c,metalness:.35,roughness:.5});
 function box(w,h,d,x,y,z,mat=mats[0]){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;}
 box(6,4.7,4.8,0,2.35,0);box(6.4,.23,5.2,0,4.75,0,mats[2]);
 if(variant==='ant'){
  for(const sign of [-1,1]){const roof=box(3.6,.15,5.6,sign*1.58,5.32,0,mats[2]);roof.rotation.z=-sign*.36;}
 }else{box(2.1,1.1,.5,0,5.2,2.15,mats[1]);box(6.3,.25,.35,0,4.95,2.5,cream);}
 // Central glazed door flanked by visible book displays.
 box(1.05,2.5,.15,0,1.3,2.47,dark);box(.12,2.55,.25,-.62,1.3,2.52,cream);box(.12,2.55,.25,.62,1.3,2.52,cream);box(1.36,.12,.25,0,2.57,2.52,cream);
 for(const s of [-1,1]){
  box(1.75,2.0,.16,s*1.94,1.47,2.48,dark);
  for(const y of [.55,1.22,1.89,2.52])box(1.88,.08,.26,s*1.94,y,2.63,cream);
  for(const x of [s*1.94-.91,s*1.94+.91])box(.08,2.05,.23,x,1.5,2.61,cream);
  const bookColors=[0xbc7256,0x8eaa98,0xd5b46f,0x778898,0xc5ae9a].map(color=>new THREE.MeshStandardMaterial({color,roughness:.9}));
  for(let row=0;row<3;row++)for(let j=0;j<9;j++)box(.13,.36+(j%3)*.045,.1,s*1.94-.72+j*.18,.79+row*.67,2.62,bookColors[(j+row)%5]);
  box(1.1,.95,.1,s*1.83,3.78,2.45,dark);box(.07,.97,.15,s*1.83,3.78,2.53,cream);
  const awning=box(2.12,.10,.85,s*1.92,2.88,2.86,mats[1]);awning.rotation.x=.18;
  for(let i=0;i<5;i++){const stripe=box(.16,.015,.86,s*1.92-.86+i*.43,2.94,2.86,cream);stripe.rotation.x=.18;}
  box(.12,4.6,.14,s*2.88,2.3,2.48,mats[2]);
 }
 for(const s of [-1,1]){
  const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,5.5,10),gold);pipe.position.set(s*2.85,2.75,-2.1);root.add(pipe);
  const cap=new THREE.Mesh(new THREE.TorusGeometry(.18,.04,5,16),gold);cap.rotation.x=Math.PI/2;cap.position.set(s*2.85,5.49,-2.1);root.add(cap);
 }
 box(6.6,.2,1.5,0,-.1,2.6,cream);
 mergeStaticGroup(root);
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=160;const ctx=canvas.getContext('2d');ctx.fillStyle='#ebdfbf';ctx.fillRect(0,0,768,160);ctx.strokeStyle='#694f39';ctx.lineWidth=9;ctx.strokeRect(6,6,756,148);ctx.fillStyle='#403d33';ctx.font='bold 74px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(name+'书店',384,83);
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(5.0,1.02),new THREE.MeshBasicMaterial({map:tex}));sign.position.set(0,3.08,2.68);root.add(sign);
 return root;
}
