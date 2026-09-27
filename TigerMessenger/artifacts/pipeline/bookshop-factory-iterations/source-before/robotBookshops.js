import * as THREE from 'three';
import {mergeStaticGroup} from '../world/geometryMerge.js';

// The approved reference's pale masonry, tall warm book windows and working ironwork.
export function createRobotBookshop(name,variant){
 const root=new THREE.Group();root.name=name+'书店';root.userData.kind='robot-bookshop';
 const mat=(color,metalness=0,roughness=.8)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
 const stone=mat(0xc5c2af),trim=mat(0xe0d8bd),roof=mat(0x526874,.2),iron=mat(0x354b50,.5),bronze=mat(0x9c8050,.55),dark=mat(0x202d30),glow=new THREE.MeshStandardMaterial({color:0xbc7d37,emissive:0xd89134,emissiveIntensity:.42,roughness:.6});
 const books=[0x79533e,0x718677,0xb79355,0x556b80,0xbaad8f].map(x=>mat(x));
 const height=variant==='locust'?8.0:variant==='ant'?6.5:5.8;
 function box(w,h,d,x,y,z,m=stone){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;root.add(o);return o;}
 function rod(a,b,r=.045,m=iron){const v=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,v.length(),12),m);o.position.set(...a).addScaledVector(v,.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());root.add(o);return o;}
 function arch(x,y,z,w,h){
  const radius=w/2,straight=h-radius,shape=new THREE.Shape();shape.moveTo(-radius,0);shape.lineTo(radius,0);shape.lineTo(radius,straight);shape.absarc(0,straight,radius,0,Math.PI,false);shape.closePath();
  const m=new THREE.Mesh(new THREE.ShapeGeometry(shape,20),glow);m.position.set(x,y,z);root.add(m);
  const points=[new THREE.Vector3(x-radius,y,z+.045),new THREE.Vector3(x-radius,y+straight,z+.045)];for(let i=0;i<=20;i++){const a=Math.PI-i*Math.PI/20;points.push(new THREE.Vector3(x+Math.cos(a)*radius,y+straight+Math.sin(a)*radius,z+.045));}points.push(new THREE.Vector3(x+radius,y,z+.045));for(let i=1;i<points.length;i++)rod(points[i-1].toArray(),points[i].toArray(),.065,trim);
  box(.055,h-.1,.10,x,y+h/2,z+.1,iron);
  for(let row=0;row<3;row++){const yy=y+.26+row*.45;box(w-.08,.06,.18,x,yy,z+.11,bronze);for(let j=0;j<8;j++)box((w-.2)/9,.22+(j%3)*.035,.07,x-w*.42+j*w*.12,yy+.15,z+.09,books[(row+j)%5]);}
 }
 box(6.4,height,5.0,0,height/2,0);box(6.8,.22,5.35,0,height+.05,0,trim);
 for(const y of[.18,3.5,height-.15])box(6.7,.15,5.25,0,y,0,trim);
 // Quoin stones and horizontal mortar seams restrained to their architectural role.
 for(const x of[-3.12,3.12])for(let y=.25;y<height;y+=.46)box(.32,.34,.14,x,y,2.57,trim);
 for(let y=.7;y<height;y+=.56)box(5.85,.014,.016,0,y,2.508,iron);
 arch(-2.1,.38,2.53,1.65,2.54);arch(2.1,.38,2.53,1.65,2.54);arch(0,.12,2.54,1.35,2.8);
 box(.09,2.2,.18,-.64,1.2,2.62,bronze);box(.09,2.2,.18,.64,1.2,2.62,bronze);
 for(let y=4.05;y<height-1.1;y+=2.4)for(const x of[-2.07,0,2.07])arch(x,y,2.52,1.22,1.95);
 if(variant!=='beetle'){
  // Steep slate roof with real tile-course lines.
  for(const sign of[-1,1]){const m=box(4.2,.16,5.65,sign*1.56,height+1.33,0,roof);m.rotation.z=-sign*.66;
   for(let j=0;j<9;j++){const x=sign*(.12+j*.37),yy=height+2.55-Math.abs(x)*.78;box(.025,.025,5.68,x,yy,0,iron);}}
  box(.2,.24,5.7,0,height+2.57,0,iron);
 }else{
  const dome=new THREE.Mesh(new THREE.SphereGeometry(2,32,16,0,Math.PI*2,0,Math.PI/2),roof);dome.position.set(0,height+.32,-.15);dome.scale.y=.70;root.add(dome);
  for(let k=0;k<12;k++){const a=k*Math.PI/6,pts=[];for(let j=0;j<=16;j++){const t=j*Math.PI/32;pts.push(new THREE.Vector3(Math.cos(a)*Math.sin(t)*2,height+.32+Math.cos(t)*1.4,-.15+Math.sin(a)*Math.sin(t)*2));}const tube=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),16,.025,5,false),bronze);root.add(tube);}
  box(6.7,.25,.15,0,height+.34,2.6,trim);
 }
 if(variant==='ant'){
  // Clock tower is the central visual anchor of the three-shop composition.
  box(1.9,4,1.7,0,height+2,0,stone);box(2.2,.18,2.0,0,height+4,0,trim);
  const dial=new THREE.Mesh(new THREE.CircleGeometry(.69,40),trim);dial.position.set(0,height+2.95,.88);root.add(dial);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.72,.07,8,40),bronze);ring.position.copy(dial.position);root.add(ring);
  for(let k=0;k<12;k++){const a=k*Math.PI/6,o=box(.045,.12,.04,Math.sin(a)*.56,height+2.95+Math.cos(a)*.56,.9,iron);o.rotation.z=-a;}
  rod([0,height+2.95,.93],[.30,height+3.22,.93],.025);rod([0,height+2.95,.93],[-.10,height+3.39,.93],.026);
  for(let k=0;k<3;k++){const m=new THREE.Mesh(new THREE.TorusGeometry(.29,.04,6,16),bronze);m.position.set((k%2?-.26:.26),height+1.8-k*.44,.9);root.add(m);for(let j=0;j<8;j++){const a=j*Math.PI/4;box(.07,.08,.06,m.position.x+Math.sin(a)*.33,m.position.y+Math.cos(a)*.33,.9,bronze);}}
  const cap=new THREE.Mesh(new THREE.ConeGeometry(1.43,1.9,4),roof);cap.rotation.y=Math.PI/4;cap.position.set(0,height+5.03,0);root.add(cap);rod([0,height+5.98,0],[0,height+6.75,0],.06,bronze);
 }
 // Warm reading interior details, book crates and iron loading gantry alongside each shop.
 for(const x of[-3.0,3.0]){rod([x,.0,2.9],[x,3.2,2.9],.055);box(.22,.45,.23,x,2.78,2.92,glow);}
 const courtSide=variant==='beetle'?1:-1;
 for(const z of[-1.2,1.5])rod([courtSide*5.5,0,z],[courtSide*5.5,6.8,z],.12);
 rod([courtSide*5.5,6.8,-1.2],[courtSide*5.5,6.8,1.5],.14);rod([courtSide*5.5,6.8,-1.2],[courtSide*3.1,6.8,-1.2],.14);
 for(let y=.3;y<6.8;y+=.4)rod([courtSide*5.65,y,-1.25],[courtSide*5.35,y,-1.25],.025,bronze);
 rod([courtSide*4.4,6.8,-1.2],[courtSide*4.4,4.8,-1.2],.027,bronze);box(.52,.44,.50,courtSide*4.4,4.58,-1.2,dark);
 for(const x of[-2.9,2.9]){rod([x,.1,-2.6],[x,height+.8,-2.6],.10,bronze);rod([x,height+.8,-2.6],[x-.4,height+.8,-2.6],.1,bronze);}
 mergeStaticGroup(root);
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=160;const ctx=canvas.getContext('2d');ctx.fillStyle='#dbd4bc';ctx.fillRect(0,0,768,160);ctx.strokeStyle='#514c3e';ctx.lineWidth=8;ctx.strokeRect(5,5,758,150);ctx.fillStyle='#292e2b';ctx.font='bold 76px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(name+'书店',384,84);const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;const sign=new THREE.Mesh(new THREE.PlaneGeometry(5.5,.86),new THREE.MeshBasicMaterial({map:tex}));sign.position.set(0,3.14,2.68);root.add(sign);
 return root;
}
