import {addFactoryTargetDetail} from './factoryTargetDetail.js';
import * as THREE from 'three';
import {addBookshopFacadeDetails} from './bookshopFacadeDetails.js';
import {addFactoryWorkcell} from './factoryWorkcells.js';
import {createBookshopWorker} from './bookshopWorker.js';
import {factoryKit} from './factoryArchitecture.js';
import {mergeStaticGroup} from '../world/geometryMerge.js';
export const FACTORY_REVISION=20;
export const FACTORY_PASSES=[
 'Separate storefront and industrial court footprints',
 'Pale stone storefront piers and open arched bays',
 'Distinctive three glass domes / tall clock tower',
 'Readable Chinese shop sign and framed entablature',
 'Book-filled windows, glazed doors and warm reading interior',
 'Quoins, cornices and variant clock / gable / dome ornament',
 'Large open industrial hall with structural columns',
 'Glazed industrial roof and readable production portal',
 'Actual lathes / boiler assembly benches / foundry furnace',
 'Robot service gantry and suspended variant-specific spare part',
 'User-directed expansion: two-storey book wing and three large rear production halls',
 'Variant industrial skyline: pressure vessels / high-bay monitors / instrument domes',
 'Connected steam pipework, catwalks, valve wheels and service ladders',
 'Separate freight railway, loaded wagons and steam tractor',
 'Multiple internal assembly lines and spare-part storage',
 'Industrial glazing, roof skylights and slate seam detail',
 'Animated steam emitters and working parts elevator',
 'Public paving, warm street lamps and workers for scale',
 'Freight gate, signs, book displays and structural tank supports',
 'Review corrections: reading gallery, machining racks / ladles / mech walkways',
];
export function createBookshopFactoryCompound(kind,revision=FACTORY_REVISION){
 const root=new THREE.Group();root.name=kind+'-bookshop-factory-compound';const fixed=new THREE.Group();root.add(fixed);const K=factoryKit(fixed),{M,mesh,box,cyl,beam,pipe,torus,sign,arch,dome,roof,gear,crate,wheel}=K;const ant=kind==='ant',locust=kind==='locust',name=ant?'蚂蚁':locust?'蝗虫':'甲壳虫';const anim=[];
 // Local +Z fronts the public plaza. Freight moves down the right-side lane.
 const sx=-3.1,front=2.4;
 if(revision>=1){box(7.8,.18,6.2,sx,.09,-.6,M.stone);box(9,.15,10,4,.075,-6.6,M.stone);box(.22,4,5.8,sx-3.8,2,-.6);box(.22,4,5.8,sx+3.8,2,-.6);box(7.8,4,.22,sx,2,-3.5);}
 if(revision>=2){for(const x of[-6.6,-4.3,-2,.3]){box(.36,4.5,.42,x,2.25,front,M.trim);box(.64,.22,.63,x,.16,front,M.trim);box(.62,.2,.6,x,4.3,front,M.trim);}for(const x of[-5.45,-3.15,-.85])arch(x,.18,front,1.93,3.5,fixed,x!==-3.15);box(8.1,.28,6.5,sx,4.35,-.6,M.trim);box(8,1,.35,sx,3.87,front-.05);}
 if(revision>=3){if(locust){roof(sx,4.4,-.6,8.3,6.6,3,fixed,false);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([sx-4,4.4,front,sx+4,4.4,front,sx,7.4,front],3));g.computeVertexNormals();mesh(g,M.stone);arch(sx,4.65,front+.03,1.6,1.9);beam([sx-4.1,4.45,front+.05],[sx,7.5,front+.05],.08,M.trim);beam([sx,7.5,front+.05],[sx+4.1,4.45,front+.05],.08,M.trim);}else if(!ant){dome(sx,4.58,-1,2.05,2.4);dome(sx-2.8,4.5,.1,1.07,1.45);dome(sx+2.8,4.5,.1,1.07,1.45);}else{roof(sx,4.4,-.6,8.3,6.6,1.5);box(1.8,5,1.55,sx,6.8,-.2,M.stone);box(2.05,.23,1.9,sx,9.25,-.2,M.trim);dome(sx,9.38,-.2,1.0,1.45);}}
 if(revision>=4){sign(ant?'螞蟻書店':locust?'LOCUST BOOKSHOP':'BEETLE BOOKSHOP',6.65,.78,sx,4.04,front+.24);for(const x of[-6.9,.65]){cyl(.08,1,x,4.7,front,M.brass);mesh(new THREE.SphereGeometry(.16,12,8),M.brass,x,5.25,front);}}
 if(revision>=5){const colors=[0x866a4e,0x586f73,0xa1814e,0x7c4034,0xa2a087].map(c=>new THREE.MeshStandardMaterial({color:c,roughness:.95}));for(const x of[-5.45,-.85]){for(let row=0;row<5;row++){box(1.76,.06,.32,x,.42+row*.5,front+.06,M.wood);for(let b=0;b<10;b++)box(.12,.29+(b%3)*.04,.13,x-.78+b*.17,.61+row*.5,front+.04,colors[(b+row)%5]);}box(.07,2.8,.1,x,1.7,front+.19,M.brass);box(1.85,.06,.1,x,2.72,front+.18,M.brass);for(let a=0;a<5;a++){const angle=Math.PI*a/4;beam([x,2.72,front+.17],[x+Math.cos(angle)*.84,2.72+Math.sin(angle)*.84,front+.17],.02,M.brass);}}
 for(const side of[-1,1]){const door=new THREE.Group();door.position.set(sx+side*.87,.18,front);door.rotation.y=side*1.15;fixed.add(door);box(.77,2.75,.07,-side*.38,1.38,0,M.wood,door);box(.59,1.9,.08,-side*.38,1.7,.02,M.glass,door);for(const y of[.36,1.2,2.67])box(.72,.07,.09,-side*.38,y,.04,M.brass,door);box(.045,.29,.12,-side*.66,1.2,.08,M.brass,door);}
 // A real central opening leads to a reading room, with shelves behind the shopfront.
 for(const x of[-5.8,-.5])for(let row=0;row<6;row++){box(1.6,.075,.36,x,.3+row*.5,-2.95,M.wood);for(let j=0;j<9;j++)box(.12,.32,.22,x-.68+j*.17,.5+row*.5,-2.93,colors[(row+j)%5]);}
 for(const x of[-5.4,-.8]){box(1.35,.10,.9,x,.98,-.9,M.wood);for(const dx of[-.5,.5])box(.09,.95,.65,x+dx,.48,-.9,M.iron);for(let j=0;j<4;j++)box(.21,.08,.29,x-.44+j*.28,1.07,-.9,colors[j]);}
 box(7.4,.07,5.5,sx,.20,-.55,M.wood);}
 if(revision>=6){
  for(const x of[-6.8,.6])for(let y=.4;y<4;y+=.42)box(.5,.3,.56,x,y,front,M.trim);
  for(const y of[.18,3.58,4.47])box(8.25,.09,6.55,sx,y,-.6,M.trim);
  for(let y=.5;y<3.5;y+=.55)for(const side of[-1,1])box(.025,.014,5.75,sx+side*3.92,y,-.6,M.iron);
  if(ant){mesh(new THREE.CircleGeometry(.66,40),M.trim,sx,8.05,.60);torus(.7,.06,sx,8.05,.63);for(let i=0;i<12;i++){const a=i*Math.PI/6,o=box(.035,.10,.05,sx+Math.sin(a)*.54,8.05+Math.cos(a)*.54,.65,M.iron);o.rotation.z=-a;}beam([sx,8.05,.68],[sx+.34,8.32,.68],.025);beam([sx,8.05,.68],[sx-.18,8.53,.68],.025);for(let j=0;j<3;j++)gear(sx+(j%2?.2:-.2),7.0-j*.52,.64,.27);for(const side of[-1,1]){box(.15,4.9,.15,sx+side*.9,6.8,.61,M.trim);cyl(.05,.85,sx+side*.92,9.7,.63,M.brass);}}
  else if(locust){box(.06,2.8,.07,sx,5.8,front+.06,M.trim);box(1.5,1.2,.02,sx,5.35,front+.06,M.amber);for(const x of[sx-.45,sx,sx+.45])beam([x,4.75,front+.13],[x,5.9,front+.13],.03,M.brass);for(let j=0;j<12;j++){const x=sx-3.8+j*.69;box(.2,.13,.3,x,4.3,front+.15,M.trim);}}
  else{for(const x of[-6.9,-4.7,-1.5,.65]){cyl(.09,.8,x,4.9,front,M.brass);torus(.18,.035,x,4.8,front+.06);}gear(sx,5.0,1.1,.27);}
 }
 const hallX=3.4,hallZ=-7.8,hallH=locust?8.6:6.6;
 if(revision>=7){
  box(9.4,hallH,.26,hallX,hallH/2,-13,M.stone);box(.24,hallH,10.4,-1.3,hallH/2,hallZ,M.stone);box(.24,hallH,10.4,8.1,hallH/2,hallZ,M.stone);
  for(const x of[-1.3,8.1])for(let z=-12.7;z<=-2.5;z+=2.5){box(.25,hallH+.2,.3,x,hallH/2,z,M.iron);box(.5,.2,.55,x,.15,z,M.trim);}
  box(9.6,.45,.45,hallX,hallH-.2,-2.5,M.iron);
  // Wide genuinely open facade: machinery remains visible through the portal.
  for(const x of[-1.3,8.1]){box(.65,hallH,.75,x,hallH/2,-2.5,M.trim);for(let j=0;j<7;j++)box(.74,.14,.8,x,j*.83+.3,-2.5,M.stone);}
 }
 if(revision>=8){
  roof(hallX,hallH,-7.8,10.1,11.2,2.4);
  for(let z=-13;z<-2.3;z+=1.3){beam([-1.6,hallH,z],[hallX,hallH+2.45,z],.065,M.brass);beam([hallX,hallH+2.45,z],[8.5,hallH,z],.065,M.brass);}
  for(const side of[-1,1]){const o=box(2.55,.05,8.7,hallX+side*2.0,hallH+1.48,-7.8,M.glass);o.rotation.z=-side*Math.atan2(2.4,5.05);for(let z=-11.7;z<-3.5;z+=1.15)beam([hallX+side*.8,hallH+2.06,z],[hallX+side*3.25,hallH+.9,z],.035,M.brass);}
  sign(ant?'BOILERS · POWER · FOUNDRY':locust?'ASSEMBLY · REPAIR · PARTS':'PRECISION · ASSEMBLY WORKS',7.7,.74,hallX,hallH-.3,-2.23);
 }
 if(revision>=9){
  for(let row=0;row<2;row++)for(let j=0;j<3;j++){if(revision>=20&&row===1&&j===1)continue;const x=.3+row*4.7,z=-4.5-j*2.9;box(2.4,.18,1.2,x,1.1,z,M.wood);for(const dx of[-.9,.9])box(.12,1,.9,x+dx,.55,z,M.iron);
   if(!ant){box(1.6,.4,.55,x,1.39,z,M.iron);const spindle=cyl(.25,1.35,x,1.8,z,M.brass);spindle.rotation.z=Math.PI/2;wheel(x-.7,1.8,z+.2,.29);box(.35,.85,.65,x+.85,1.58,z,M.slate);}
   else{cyl(.65,1.4,x,1.85,z,M.copper);for(const y of[1.3,2.35]){const t=torus(.67,.055,x,y,z,M.iron);t.rotation.x=Math.PI/2;}torus(.28,.045,x,1.9,z+.64);}}
  if(ant){box(3,3.2,1.7,4.2,1.6,-11.7,M.iron);box(2.15,1.7,.12,4.2,1.55,-10.8,M.amber);for(let k=0;k<6;k++)box(.05,1.65,.06,3.3+k*.36,1.55,-10.68,M.iron);}
 }
 if(revision>=10){
  const gh=locust?9.2:7.7;for(const x of[2.2,9.1]){for(const z of[2.3,-1.2])box(.2,gh,.2,x,gh/2,z,M.iron);for(let y=.3;y<gh-1;y+=1.5){beam([x,y,2.3],[x,y+1.5,-1.2],.055,M.brass);beam([x,y,-1.2],[x,y+1.5,2.3],.055,M.brass);}box(.6,.18,4,x,gh, .55,M.iron);}
  for(const z of[-1.2,2.3]){box(7.5,.2,.2,5.65,gh,z,M.iron);box(7.5,.17,.2,5.65,gh+.8,z,M.iron);for(let x=2.2;x<9;x+=.85)beam([x,gh,z],[x+.85,gh+.8,z],.04,M.brass);}
  const hook=new THREE.Group();hook.name=kind+'-working-parts-hoist';hook.position.set(5.5,gh, .6);root.add(hook);box(1,.28,.8,0,0,0,M.iron,hook);for(const x of[-.3,.3])beam([x,0,0],[x,-1.55,0],.025,M.iron,hook);
  if(ant){cyl(.65,1.7,0,-2.3,0,M.copper,hook).rotation.z=Math.PI/2;for(const x of[-.75,.75])torus(.66,.055,x,-2.3,0,M.iron,hook).rotation.y=Math.PI/2;}
  else if(locust){const panel=box(1.25,1.6,.25,0,-2.3,0,M.slate,hook);panel.rotation.z=.16;for(const x of[-.5,.5])beam([x,-1.1,0],[x,-1.7,0],.025,M.brass,hook);}
  else wheel(0,-2.2,0,.73,hook);
  anim.push(t=>{hook.position.y=gh+Math.sin(t*.35)*.2;});
 }

 if(revision>=11){
  // Expansion: a two-storey reading/archive wing and THREE production bays,
  // replacing the small-shop scale with a complete industrial compound.
  box(8,7.7,8,-4,3.85,-8,M.stone);roof(-4,7.7,-8,8.6,8.7,2);
  for(const side of[-1,1])for(let z=-11;z<-4;z+=2.1)for(const y of[2.1,5.5]){box(.06,1.75,1.25,-4+side*4.04,y,z,M.amber);box(.08,1.85,.065,-4+side*4.1,y,z,M.brass);box(.08,.065,1.4,-4+side*4.1,y,z,M.brass);}
  for(const y of[.25,3.75,7.65])box(8.4,.18,8.3,-4,y,-8,M.trim);
  for(let bay=0;bay<3;bay++){const x=-5+bay*8;box(7.8,8,.22,x,4,-28,M.stone);for(const xx of[x-3.9,x+3.9])box(.25,8,14,xx,4,-21,M.stone);roof(x,8,-21,8.3,14.7,2.5);for(let z=-27.8;z<-14;z+=2){beam([x-4.1,8,z],[x,10.52,z],.055,M.brass);beam([x,10.52,z],[x+4.1,8,z],.055,M.brass);}box(7.8,.5,.4,x,7.8,-14,M.iron);for(const xx of[x-3.7,x+3.7])box(.22,8,.32,xx,4,-14,M.iron);}
  box(26,.12,29,2.5,.065,-13.5,M.stone);
 }
 if(revision>=12){
  // Different industrial silhouettes for each factory, not recolored copies.
  if(ant){for(let j=0;j<6;j++){const x=-6+(j%3)*2.6,z=-16-Math.floor(j/3)*6,h=6+(j%3)*1.2;cyl(1.05,h,x,8+h/2,z,M.copper);mesh(new THREE.SphereGeometry(1.05,20,12,0,Math.PI*2,0,Math.PI/2),M.copper,x,8+h,z);for(const y of[8.3,9.9,8+h-.3]){const ring=torus(1.07,.055,x,y,z,M.iron);ring.rotation.x=Math.PI/2;}cyl(.16,2.2,x,9.5+h,z,M.brass);}}
  else if(locust){for(let k=0;k<3;k++){const x=-5+8*k;box(3.5,.45,10,x,10.7,-21,M.iron);for(const s of[-1,1])box(.12,.7,10,x+s*1.7,11.15,-21,M.glass);roof(x,11.5,-21,3.8,10.4,.8);}for(const x of[-8,14]){cyl(.65,14,x,7,-25,M.copper);cyl(.83,.25,x,14.1,-25,M.iron);}}
  else{for(let k=0;k<3;k++){const x=-5+8*k;dome(x,10.4,-23,1.65,1.8);for(let j=0;j<5;j++){box(1.3,.55,.7,x-2.5+j*1.2,8.6,-16,M.iron);pipe([[x-2.5+j*1.2,8.9,-16],[x-2.5+j*1.2,9.6,-16],[x-2.5+j*1.2,9.6,-18]],.06);}}}
 }
 if(revision>=13){
  for(let i=0;i<3;i++){const x=-9.5+i*1.1,h=ant?10+i*2:7+i*1.5;cyl(.3,h,x,h/2,-8,M.copper);cyl(.43,.2,x,h,-8,M.iron);pipe([[x,1.3,-8],[x,1.3,-11.5],[x,5+i,-12],[0,5+i,-12],[1,3,-12]],.10);}
  for(let i=0;i<5;i++){const x=-7+i*4.8;pipe([[x,8.6,-26],[x,11.4,-26],[x+2,11.7,-25],[x+2,7.3,-23]],.12);torus(.27,.04,x+2,7.8,-22.82);for(let k=0;k<4;k++){const a=k*Math.PI/2;beam([x+2,7.8,-22.82],[x+2+Math.cos(a)*.27,7.8+Math.sin(a)*.27,-22.82],.025,M.brass);}}
  for(const z of[-12.5,-26.3]){box(25,.16,1.05,2.5,8.5,z,M.iron);for(let x=-10;x<15;x+=1.1){beam([x,8.5,z-.45],[x,9.35,z-.45],.025,M.brass);beam([x,8.5,z+.45],[x,9.35,z+.45],.025,M.brass);}for(const s of[-1,1])beam([-10,9.35,z+s*.45],[15,9.35,z+s*.45],.035,M.brass);}
  for(const x of[-9,13.8]){for(const dx of[-.25,.25])beam([x+dx,.2,-12.3],[x+dx,8.6,-12.3],.035);for(let y=.4;y<8.6;y+=.35)beam([x-.25,y,-12.3],[x+.25,y,-12.3],.025,M.brass);}
 }
 if(revision>=14){
  for(const x of[11.44,12.56])beam([x,.17,6],[x,.17,-28],.045,M.iron);
  for(let z=-28;z<6;z+=.6)box(1.7,.08,.14,12,.10,z,M.wood);
  for(let car=0;car<4;car++){const z=-4-car*5.3;box(2.2,.22,3.2,12,.58,z,M.iron);for(const x of[11.44,12.56])for(const zz of[z-1,z+1]){const wh=new THREE.Group();wh.position.set(x,.38,zz);wh.rotation.y=Math.PI/2;fixed.add(wh);wheel(0,0,0,.3,wh);}for(let k=0;k<3;k++)crate(11.65,.7,z-.9+k*.9,.75);beam([12,.5,z+1.6],[12,.5,z+2.2],.05);}
  const loco=new THREE.Group();loco.name=kind+'-steam-tractor';loco.position.set(12,0,2);root.add(loco);box(1.9,.4,3.4,0,.55,0,M.iron,loco);cyl(.52,1.9,0,1.2,.3,M.copper,loco).rotation.x=Math.PI/2;cyl(.15,1.5,0,2,.9,M.iron,loco);box(1.65,1.6,1.1,0,1.35,-1,M.slate,loco);box(1.95,.15,1.45,0,2.25,-1,M.iron,loco);for(const s of[-1,1])for(const z of[-1,.8]){const axle=new THREE.Group();axle.position.set(s*.56,.5,z);axle.rotation.y=Math.PI/2;loco.add(axle);wheel(0,0,0,.43,axle);}anim.push(t=>loco.position.z=2+Math.sin(t*.13)*.55);
 }
 if(revision>=15){
  for(let bay=0;bay<3;bay++){const x=-5+bay*8;for(let j=0;j<3;j++){const z=-17-j*3.6;box(3,.3,1.5,x,1.2,z,M.iron);for(const dx of[-1.2,1.2])box(.18,1,.8,x+dx,.55,z,M.iron);
   if(ant){cyl(.8,2.8,x,2.8,z,M.copper).rotation.z=Math.PI/2;for(const dx of[-1.2,0,1.2])torus(.82,.05,x+dx,2.8,z,M.iron).rotation.y=Math.PI/2;}
   else if(locust){box(1.7,.9,1.1,x,1.8,z,M.slate);const arm=cyl(.22,2,x,2.6,z,M.iron);arm.rotation.z=.5;box(1.1,1.2,.8,x+.35,3.2,z,M.slate);}
   else{box(2.8,.4,.65,x,1.6,z,M.slate);for(const xx of[x-1,x+1])wheel(xx,2,z,.48);gear(x,2.2,z+.1,.4);}}
  }
  for(let i=0;i<8;i++){const x=9.2+(i%2)*1.1,z=-6-Math.floor(i/2)*1.8;crate(x,0,z,.85);}
  if(locust){box(5.5,.2,1.7,-.6,3.4,-1.4,M.iron);roof(-.6,5.2,-1.4,5.7,2,.45);for(let x=-3;x<2;x+=.6){beam([x,3.4,-.55],[x,5.2,-.55],.035,M.brass);box(.46,1.6,.025,x+.23,4.3,-.57,M.glass);}}
 }

 if(revision>=16){
  // Break up blank factory walls with large industrial windows and masonry piers.
  for(const x of[-9,14.9])for(let z=-26;z<-14;z+=2.2){box(.08,3.1,1.55,x,4.8,z,M.amber);for(const y of[3.65,4.8,5.95])box(.12,.07,1.65,x, y,z,M.iron);box(.13,3.2,.065,x,4.8,z,M.iron);}
  for(let z=-12;z<-3;z+=2){box(.06,3.1,1.45,8.26,4.2,z,M.amber);box(.12,3.2,.07,8.3,4.2,z,M.iron);for(const y of[3,4.3,5.6])box(.11,.065,1.55,8.3,y,z,M.iron);}
  for(let bay=0;bay<3;bay++){const x=-5+8*bay;for(const s of[-1,1])for(let j=0;j<7;j++){const z=-26.5+j*1.8,glass=box(2.25,.06,1.45,x+s*2.2,9.22,z,M.glass);glass.rotation.z=-s*Math.atan2(2.5,4.15);for(const zz of[z-.72,z+.72])beam([x+s*1.2,9.85,zz],[x+s*3.2,8.65,zz],.035,M.brass);}for(let z=-27.7;z<-14;z+=.55)for(const s of[-1,1])beam([x+s*.08,10.55,z],[x+s*4.15,8.08,z],.013,M.iron);}
 }
 if(revision>=17){
  function steam(x,y,z){const g=new THREE.Group();g.name=kind+'-steam-emitter';g.position.set(x,y,z);root.add(g);for(let i=0;i<5;i++){const m=new THREE.MeshBasicMaterial({color:0xe3e5db,transparent:true,opacity:.3,depthWrite:false}),o=new THREE.Mesh(new THREE.IcosahedronGeometry(.3,1),m);g.add(o);anim.push(t=>{const f=(t*.24+i*.2)%1;o.position.set(f*.6,f*3,Math.sin(i+f)*f*.3);o.scale.setScalar(.5+f*2.5);m.opacity=(1-f)*.28;});}}
  for(let i=0;i<3;i++)steam(-9.5+i*1.1,ant?10+i*2:7+i*1.5,-8);
  if(locust){steam(-8,14.3,-25);steam(14,14.3,-25);}else if(ant)steam(-6,16.3,-16);
  // Moving service lift remains independent of the merged architectural meshes.
  const lift=new THREE.Group();lift.name=kind+'-parts-elevator';root.add(lift);box(2,.16,1.4,-9.8,0,-3,M.iron,lift);crate(-9.8,.1,-3,.8,lift);for(const x of[-10.8,-8.8])beam([x,0,-3.7],[x,8.4,-3.7],.05);anim.push(t=>lift.position.y=1.6+Math.sin(t*.2)*1.4);
 }
 if(revision>=18){
  // Public forecourt remains distinct from the rail delivery yard.
  box(24,.08,4,1.5,.04,4.5,M.trim);
  for(let x=-10;x<14;x+=1.2)for(let z=3;z<6;z+=.9){box(1.08,.026,.78,x,.095,z,(Math.round(x*10+z*10)%3)?M.stone:M.trim);}
  for(const x of[-8.5,.8,9.8]){cyl(.065,3.3,x,1.65,4.6,M.iron);cyl(.2,.1,x,2.7,4.6,M.brass);box(.3,.48,.3,x,2.94,4.6,M.amber);mesh(new THREE.ConeGeometry(.3,.25,4),M.iron,x,3.3,4.6);}
  for(let i=0;i<9;i++){const x=i<4?-6+i*1.4:9+(i%2)*1.1,z=i<4?4.7:-3-(i-4)*3.8;const worker=createBookshopWorker({coat:i%2?0x716858:0x414c51,apron:i>=4,carrying:i===5});worker.scale.setScalar(.8);worker.position.set(x,.1,z);worker.rotation.y=(i%3-1)*.4;fixed.add(worker);}
 }
 if(revision>=19){
  sign(ant?'螞蟻・蒸汽動力廠':locust?'LOCUST · HEAVY ASSEMBLY':'BEETLE · PRECISION WORKS',7.4,.7,3,8.05,-13.72);
  for(const x of[10.4,14.7]){box(.62,2.7,.65,x,1.35,5.8,M.stone);box(.78,.2,.8,x,2.7,5.8,M.trim);mesh(new THREE.SphereGeometry(.16,12,8),M.brass,x,2.97,5.8);}sign('FREIGHT ENTRANCE',2.8,.55,12.5,2.5,5.85);
  for(const side of[-1,1])for(let z=-26.5;z<-14.5;z+=.55)box(.025,.013,1.9,side<0?-9.14:15.04,.45+(Math.round(z*10)%7+7)*.48,z,M.iron);
  for(let i=0;i<4;i++){const x=-6.8+i*1.9;crate(x,.1,4.0,.5);box(.7,.07,.65,x,.77,4.0,M.wood);for(let j=0;j<5;j++)box(.10,.18,.18,x-.25+j*.12,.9,4,M.slate);}
  for(const x of[-6.6,.3]){box(.6,2.1,.035,x,2.55,front+.36,M.slate);sign('BOOKS',.36,.45,x,2.8,front+.4);}
  // Braced tank supports and collars make the boiler loads structurally legible.
  if(ant)for(let j=0;j<6;j++){const x=-6+j%3*2.6,z=-16-Math.floor(j/3)*6;for(const dx of[-.8,.8])beam([x+dx,7.8,z],[x+dx,9,z],.10);box(2.4,.18,2.4,x,8,z,M.iron);for(let a=0;a<10;a++){const t=a*Math.PI/5;mesh(new THREE.SphereGeometry(.045,6,4),M.brass,x+Math.sin(t)*1.075,9.9,z+Math.cos(t)*1.075);}}
 }
 if(revision>=20){
  // Final visual corrections: stronger storefront depth, an upper reading gallery,
  // side service access, and variant equipment beyond the common structural frame.
  for(const y of[1.25,2.75,5.0,6.3])for(const x of[-6.4,-4,-1.6]){arch(x,y,-3.84,1.25,1.25);box(1.05,.8,.04,x,y+.48,-3.79,M.amber);box(.045,1.05,.08,x,y+.55,-3.73,M.brass);}
  for(let x=-6.4;x<.4;x+=.75){box(.15,.26,.4,x,3.6,front+.24,M.trim);}
  if(!ant&&!locust){for(let j=0;j<5;j++){const x=1.2+j*1.4;wheel(x,1.2,-4,.48);box(.85,.9,.6,x,.5,-4,M.iron);}gear(-3.1,4.75,1.2,.38);}
  if(ant){const glow=new THREE.MeshStandardMaterial({color:0xe99938,emissive:0xff731d,emissiveIntensity:.85});box(2.2,.25,1.4,4.2,.4,-9.9,glow);for(let k=0;k<3;k++){const ladle=cyl(.35,.5,5.8+k*.8,1.1,-10.1,M.copper);torus(.38,.03,ladle.position.x,1.6,-10.1,M.iron);}}
  if(locust){for(const s of[-1,1]){box(.9,.13,3.4,5.5+s*1.8,3,-.3,M.iron);for(let z=-1.5;z<1.4;z+=.6)beam([5.5+s*2.2,3,z],[5.5+s*2.2,3.8,z],.025,M.brass);beam([5.5+s*2.2,3.8,-1.5],[5.5+s*2.2,3.8,1.5],.025,M.brass);}for(const x of[3.5,7.6]){for(let y=.3;y<3;y+=.3)beam([x-.2,y,1.7],[x+.2,y,1.7],.025,M.brass);}}
 }

 if(revision>=20){anim.push(addFactoryWorkcell(root,kind));addBookshopFacadeDetails(fixed,kind);addFactoryTargetDetail(fixed,kind);}
 mergeStaticGroup(fixed,{skip:o=>o.userData.dynamicTownWorker});root.userData.factoryKind=kind;root.userData.revision=revision;root.userData.passes=FACTORY_PASSES.slice(0,revision);root.userData.update=(dt,t)=>{for(const a of anim)a(t);};return root;
}
