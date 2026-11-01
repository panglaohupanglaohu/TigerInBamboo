import * as T from 'three';
import {applyHighlandStoneWeathering,wornGateCopingBox} from './highlandGateStoneFinish.js';

// Approved 2026-10-06: pale stepped stone pylons and a deep central arch.
// All vertices are subsequently seated on the actual retained rail curve.
export function buildHighlandGateMonument(root){
 const colours={stone:0xe2d2b2,trim:0xeee1c6,yellow:0xe4bd66,teal:0x64a9a0,roof:0xe77942,roofEdge:0xcd643b,glass:0x354e57,cloth:0x365d7c,gold:0xbcaa7b,leaf:0x49795e,grass:0x8caa64,rail:0x355863,lantern:0xffd289};
 const materials=Object.fromEntries(Object.entries(colours).map(([role,color])=>{
  const m=new T.MeshStandardMaterial({color,roughness:.94,side:role==='cloth'?T.DoubleSide:T.FrontSide});m.name='highland-twin-gate-'+role;m.userData.preserveCitadelMaterial=true;
  if(role==='lantern'){m.emissive.setHex(0xffb953);m.emissiveIntensity=1.7;}
  if(['stone','trim','yellow','teal'].includes(role))applyHighlandStoneWeathering(m);
  return[role,m];
 }));
 const parts=[];
 function add(name,g,role,x=0,y=0,z=0,solid=true,walk=false){g.translate(x,y,z);const m=new T.Mesh(g,materials[role]);m.name='highland-monument-'+name;m.castShadow=m.receiveShadow=true;m.userData={preserveCitadelMaterials:true,citadelSolidExterior:solid,highlandGateWalkable:walk,approvedGateMonument:true};root.add(m);parts.push(m);return m;}
 function box(name,w,h,d,x,y,z,role='stone',solid=true,walk=false){const wear=!walk&&role==='trim'&&!name.startsWith('approach-')&&/coping|cap/.test(name);return add(name,wear?wornGateCopingBox(w,h,d):new T.BoxGeometry(w,h,d),role,x,y,z,solid,walk);}
 function batteredPylon(side){
  // Hold the rail-facing wall at x=±7.2 while the outer wall and both
  // facades spread at the foot. This adds stone outside the train throat.
  const vertices=[];
  for(const[y,outer,depth]of[[3,19,14],[15.5,16.2,10.4]])for(const[x,z]of[[7.2,-depth/2],[outer,-depth/2],[outer,depth/2],[7.2,depth/2]])vertices.push(side*x,y,z);
  const faces=[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7];
  if(side>0)for(let i=0;i<faces.length;i+=3)[faces[i+1],faces[i+2]]=[faces[i+2],faces[i+1]];
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(faces.flatMap(i=>vertices.slice(i*3,i*3+3)),3));geo.computeVertexNormals();add('broad-battered-pylon',geo,'stone');
 }
 const facadeDepth=y=>7-T.MathUtils.clamp((y-3)/12.5,0,1)*1.8;
 function arch(name,w,h,r,spring,depth,x=0,y=0,z=0){const s=new T.Shape();s.moveTo(-w/2,-1);s.lineTo(-w/2,h);s.lineTo(w/2,h);s.lineTo(w/2,-1);s.lineTo(r,-1);s.lineTo(r,spring);for(let i=1;i<=32;i++){const a=i*Math.PI/32;s.lineTo(r*Math.cos(a),spring+r*Math.sin(a));}s.lineTo(-r,-1);s.closePath();return add(name,new T.ExtrudeGeometry(s,{depth,bevelEnabled:false}),'stone',x,y,z-depth/2);}
 // 14.4 m actual void accommodates both freight tracks and existing side walk.
 arch('main-arch',17,16.1,7.2,7.0,6.6);
 box('arch-top-deck',17.8,.4,7.1,0,16.3,0,'trim',true,true);
 for(const face of[-1,1]){
  for(let i=0;i<19;i++){const a=i*Math.PI/19+.004,b=(i+1)*Math.PI/19-.004,p=new T.Shape();p.moveTo(7.2*Math.cos(a),7+7.2*Math.sin(a));p.lineTo(8.1*Math.cos(a),7+8.1*Math.sin(a));p.absarc(0,7,8.1,a,b,false);p.lineTo(7.2*Math.cos(b),7+7.2*Math.sin(b));p.absarc(0,7,7.2,b,a,true);p.closePath();add('arch-voussoir',new T.ExtrudeGeometry(p,{depth:.12,bevelEnabled:false}),'trim',0,0,face>0?3.30:-3.42);}
  box('bridge-handrail',17.6,.11,.11,0,17.7,face*3.35,'rail');for(let x=-8.2;x<=8.2;x+=1.15)box('bridge-rail-post',.12,1.17,.12,x,17.08,face*3.35,'rail');
 }
 function roof(x,y,z,w,d){const v=[[-w/2,0,-d/2],[w/2,0,-d/2],[w/2,0,d/2],[-w/2,0,d/2],[-w*.13,2.5,0],[w*.13,2.5,0]],ids=[0,4,5,0,5,1,1,5,2,2,5,4,2,4,3,3,4,0,0,1,2,0,2,3];const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(ids.flatMap(i=>v[i]),3));g.computeVertexNormals();add('orange-hip-roof',g,'roof',x,y,z);box('roof-eave',w,.23,d,x,y,z,'roofEdge');box('roof-ridge',w*.30,.14,.25,x,y+2.45,z,'roofEdge');}
 for(const side of[-1,1]){
  const x=side*11.5,top=side<0?27.8:26.3;
  box('tower-foundation',11.8,8,14,side*13.1,0,0);
  batteredPylon(side);
  box('pylon-course-coping',9.28,.28,10.68,side*11.7,15.5,0,'trim');
  const levels=[[15.5,22.1,7.8,8.8],[22.1,top,6.9,7.6]];
  for(const[lo,hi,w,d]of levels){box('stepped-stone-pylon',w,hi-lo,d,x,(lo+hi)/2,0);box('pylon-course-coping',w+.28,.28,d+.28,x,hi,0,'trim');}
  box('pylon-flat-crown',7.1,.4,7.8,x,top+.24,0,'trim',true,true);
  box('crown-recess',5.2,.05,5.6,x,top+.46,0,'glass',false);
  for(const face of[-1,1]){
   box('upper-tall-recess',1.0,5.5,.055,x,19.1,face*4.43,'glass',false);
   for(const dx of[-.65,.65])box('slit-stone-jamb',.22,5.9,.28,x+dx,19.1,face*4.52,'trim');
   box('copper-aged-inset',.85,1.2,.07,x,23.8,face*3.83,'teal',false);
   for(const dx of[-1.9,1.9]){arch('upper-small-arcade',1.6,3.5,.48,2.2,.15,x+dx,17,face*4.48);box('arcade-shadow',.87,2.7,.04,x+dx,18.35,face*4.40,'glass',false);}
   const flag=new T.Shape();flag.moveTo(-1.16,0);flag.lineTo(1.16,0);flag.lineTo(1.16,-10.4);flag.lineTo(0,-11.3);flag.lineTo(-1.16,-10.4);flag.closePath();const flagGeo=new T.ShapeGeometry(flag),fp=flagGeo.attributes.position;
   for(let i=0;i<fp.count;i++)fp.setZ(i,face*(facadeDepth(fp.getY(i)+15)+.12));flagGeo.computeVertexNormals();add('blue-banner',flagGeo,'cloth',x,15,0,false);box('banner-rod',2.8,.11,.11,x,15.1,face*(facadeDepth(15.1)+.18),'gold');
   const emblem=new T.TorusGeometry(.46,.034,5,28);emblem.rotateX(-face*Math.atan(1.8/12.5));add('banner-emblem',emblem,'gold',x,10.7,face*(facadeDepth(10.7)+.21),false);
   for(const dx of[-1.04,1.04,0]){const lo=dx?4.65:9.775,hi=dx?14.95:11.625;add('banner-edge',new T.TubeGeometry(new T.LineCurve3(new T.Vector3(x+dx,lo,face*(facadeDepth(lo)+.2)),new T.Vector3(x+dx,hi,face*(facadeDepth(hi)+.2))),1,dx?.018:.035,5,false),'gold');}
   box('banner-emblem-bar',1.1,.07,.05,x,10.7,face*(facadeDepth(10.7)+.24),'gold');
   box('arch-lantern-glow',.3,.65,.3,side*6.85,6.5,face*3.75,'lantern',false);
   box('arch-lantern-cap',.5,.13,.5,side*6.85,6.9,face*3.75,'rail');
   for(const dx of[-.19,.19])box('lantern-frame',.045,.8,.045,side*6.85+dx,6.5,face*3.75,'rail',false);
  }
  // Continuous perimeter wall wraps the foot of each tower, as in the
  // approved close-up. Rail throat and the front/rear tower doors remain open.
  box('perimeter-platform',15.3,.5,19.6,side*15.85,2.15,0,'stone',true,true);
  box('outer-protective-wall',.75,3.15,19.6,side*23.1,3.98,0,'stone');
  box('outer-protective-coping',.96,.24,19.8,side*23.1,5.67,0,'trim');
  for(const face of[-1,1]){
   // Return walls enclose each flank; a 2.6m gap aligns with its door.
   box('perimeter-return',7.1,3.15,.75,side*16.05,3.98,face*9.45,'stone');
   box('perimeter-return-cap',7.3,.24,.96,side*16.05,5.67,face*9.45,'trim');
   box('door-inner-return',1.9,1.05,.55,side*8.15,2.97,face*9.45,'stone');
   box('door-inner-coping',2.05,.18,.72,side*8.15,3.58,face*9.45,'trim');
  }
  // Low flanks form inhabited-looking planted terraces, subordinate to roofs.
  box('low-side-plinth',6.7,5.2,12.8,side*20.2,-.4,0);
  box('low-side-cap',6.9,.3,13.1,side*20.2,2.35,0,'trim',true,true);
  for(const z of[-5.3,5.3]){
   add('terracotta-planter',new T.CylinderGeometry(.72,.55,.85,8),'roof',side*21.1,2.92,z);
   for(let i=0;i<3;i++){const g=new T.IcosahedronGeometry(.7,1);g.scale(1,.9,1);add('planter-leaves',g,'leaf',side*21.1+(i-1)*.4,3.6+Math.sin(i)*.3,z,false);}
  }
 }
 // A single modest orange-roof side pavilion contrasts with the stone pylons.
 box('side-pavilion-landing',4.5,3.2,5.0,-21.2,4.0,0,'stone',true,true);
 for(const x of[-22.8,-19.6])for(const z of[-1.6,1.6])box('side-pavilion-column',.36,3.7,.36,x,7.45,z,'trim');
 roof(-21.2,9.4,0,5.3,5.0);
 for(let i=0;i<18;i++){const z=9.15-i*.38,y=2.4+(i+1)*3.2/18;box('side-pavilion-access-step',2.5,y-2.15,.40,-21.2,(y+2.15)/2,z,'stone',true,true);}
 for(const x of[-22.65,-19.75]){const points=[new T.Vector3(x,3.5,9.35),new T.Vector3(x,6.7,2.50)];add('pavilion-stair-handrail',new T.TubeGeometry(new T.LineCurve3(...points),1,.06,6,false),'rail');for(let i=0;i<7;i++){const t=i/6;box('pavilion-stair-post',.1,1.05,.1,x,2.97+t*3.2,9.35-t*6.85,'rail');}}
 // Stone viaduct beneath the retained rail replaces the visually bare approach.
 // Its deck stays below the sleepers; the real rail curve warps all spans later.
 for(const side of[-1,1])for(let bay=0;bay<3;bay++){
  const centre=side*(10+bay*10),half=5.1,r=4.15,spring=-8.1,top=-1.1,bottom=-20;
  const sh=new T.Shape();sh.moveTo(-half,bottom);sh.lineTo(-half,top);sh.lineTo(half,top);sh.lineTo(half,bottom);sh.lineTo(r,bottom);sh.lineTo(r,spring);
  for(let i=1;i<=24;i++){const a=i*Math.PI/24;sh.lineTo(r*Math.cos(a),spring+r*Math.sin(a));}
  sh.lineTo(-r,bottom);sh.closePath();
  const g=new T.ExtrudeGeometry(sh,{depth:9.0,bevelEnabled:false});g.translate(0,0,-4.5);g.rotateY(Math.PI/2);add('approach-stone-arch',g,'stone',0,0,centre);
  box('approach-deck-coping',9.35,.32,10.15,0,-.94,centre,'trim');
  for(const edge of[-1,1]){
   box('approach-railing',.11,.11,10.1,edge*4.60,1.05,centre,'rail');
   for(let z=-4.5;z<=4.5;z+=1.5)box('approach-railing-post',.14,1.6,.14,edge*4.60,.25,centre+z,'rail');
  }
 }
 const batches=new Map();for(const m of parts){const key=m.material.name+':'+m.userData.citadelSolidExterior+':'+m.userData.highlandGateWalkable;if(!batches.has(key))batches.set(key,[]);batches.get(key).push(m);}
 const merged=[];for(const [key,meshes]of batches){const positions=[],normals=[];for(const mesh of meshes){const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry;for(const v of g.attributes.position.array)positions.push(v);for(const v of g.attributes.normal.array)normals.push(v);if(g!==mesh.geometry)g.dispose();mesh.geometry.dispose();root.remove(mesh);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));const m=new T.Mesh(g,meshes[0].material);m.name='highland-monument-'+key;m.userData={...meshes[0].userData};m.castShadow=m.receiveShadow=true;root.add(m);merged.push(m);}
 root.userData.approvedMonument={version:'old-city-rear-stepped-stone-gate-4',reference:'codex-clipboard-8b2a6564-7a71-4c5c-8cc9-e757130feb07.png',archWidth:14.4,springHeight:7,crownHeight:14.2,towerHeights:[27.8,26.3],towerFootprint:[11.8,14],towerBaseDirection:'outward-and-forward-battered-stone',railCurveUnchanged:true,weatheringVersion:2,copingWearMax:.045,draws:merged.length};return merged;
}
