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
 function taperedTier(name,x,lo,hi,wb,wt,db,dt){
  const points=[],faces=[],cut=.18;
  for(const[y,w,d]of[[lo,wb,db],[hi,wt,dt]])for(const[a,b]of[[-w/2+cut,-d/2],[w/2-cut,-d/2],[w/2,-d/2+cut],[w/2,d/2-cut],[w/2-cut,d/2],[-w/2+cut,d/2],[-w/2,d/2-cut],[-w/2,-d/2+cut]])points.push([x+a,y,b]);
  for(let i=0;i<8;i++){const j=(i+1)%8;faces.push(i,j,i+8,j,j+8,i+8);}for(let i=1;i<7;i++){faces.push(0,i+1,i,8,8+i,9+i);}
  for(let i=0;i<faces.length;i+=3)[faces[i+1],faces[i+2]]=[faces[i+2],faces[i+1]];
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(faces.flatMap(i=>points[i]),3));g.computeVertexNormals();return add(name,g,'stone');
 }
 const facadeDepth=y=>7-T.MathUtils.clamp((y-3)/12.5,0,1)*1.8;
 function arch(name,w,h,r,spring,depth,x=0,y=0,z=0){const s=new T.Shape();s.moveTo(-w/2,-1);s.lineTo(-w/2,h);s.lineTo(w/2,h);s.lineTo(w/2,-1);s.lineTo(r,-1);s.lineTo(r,spring);for(let i=1;i<=32;i++){const a=i*Math.PI/32;s.lineTo(r*Math.cos(a),spring+r*Math.sin(a));}s.lineTo(-r,-1);s.closePath();return add(name,new T.ExtrudeGeometry(s,{depth,bevelEnabled:false}),'stone',x,y,z-depth/2);}
 // 14.4 m actual void accommodates both freight tracks and existing side walk.
 arch('main-arch',17,16.1,7.2,7.0,6.6);
 box('arch-top-deck',17.8,.4,7.1,0,16.3,0,'trim',true,true);
 for(const face of[-1,1]){
  for(let i=0;i<19;i++){const a=i*Math.PI/19+.004,b=(i+1)*Math.PI/19-.004,p=new T.Shape();p.moveTo(7.2*Math.cos(a),7+7.2*Math.sin(a));p.lineTo(8.1*Math.cos(a),7+8.1*Math.sin(a));p.absarc(0,7,8.1,a,b,false);p.lineTo(7.2*Math.cos(b),7+7.2*Math.sin(b));p.absarc(0,7,7.2,b,a,true);p.closePath();add('arch-voussoir',new T.ExtrudeGeometry(p,{depth:.12,bevelEnabled:false}),'trim',0,0,face>0?3.30:-3.42);}
  box('bridge-stone-parapet',17.6,2.45,.72,0,17.725,face*3.24,'stone');
  box('bridge-stone-coping',17.9,.28,.91,0,19.08,face*3.24,'trim');
  // A broad carved stone seal reads at the gate scale, with no iron fence.
  const seal=new T.TorusGeometry(.95,.14,8,40);add('bridge-carved-seal',seal,'trim',0,17.72,face*3.68);
  box('bridge-seal-cross',2.25,.15,.13,0,17.72,face*3.69,'trim');box('bridge-seal-axis',.15,2.3,.13,0,17.72,face*3.69,'trim');
 }
 function roof(x,y,z,w,d){const v=[[-w/2,0,-d/2],[w/2,0,-d/2],[w/2,0,d/2],[-w/2,0,d/2],[-w*.13,2.5,0],[w*.13,2.5,0]],ids=[0,4,5,0,5,1,1,5,2,2,5,4,2,4,3,3,4,0,0,1,2,0,2,3];const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(ids.flatMap(i=>v[i]),3));g.computeVertexNormals();add('orange-hip-roof',g,'roof',x,y,z);box('roof-eave',w,.23,d,x,y,z,'roofEdge');box('roof-ridge',w*.30,.14,.25,x,y+2.45,z,'roofEdge');}
 for(const side of[-1,1]){
  const x=side*11.7,top=side<0?24.2:23.6;
  box('tower-foundation',11.8,8,14,side*13.1,0,0);
  batteredPylon(side);
  box('pylon-course-coping',9.28,.28,10.68,side*11.7,15.5,0,'trim');
  const levels=[[15.5,20.2,9.0,7.8,10.4,8.9],[20.2,top,7.8,6.6,8.9,7.4]];
  for(const[lo,hi,wb,wt,db,dt]of levels){taperedTier('stepped-stone-pylon',x,lo,hi,wb,wt,db,dt);box('pylon-course-coping',wt+.28,.28,dt+.28,x,hi,0,'trim');}
  box('pylon-flat-crown',6.85,.4,7.65,x,top+.24,0,'trim',true,true);
  box('crown-recess',5.2,.05,5.6,x,top+.46,0,'glass',false);
  const tierDepth=y=>y<20.2?5.2-(y-15.5)/4.7*.75:4.45-(y-20.2)/(top-20.2)*.75;
  const facade=(fn)=>{const begin=parts.length;fn();for(const piece of parts.slice(begin)){const a=piece.geometry.attributes.position;for(let i=0;i<a.count;i++){const sign=Math.sign(a.getZ(i));a.setZ(i,sign*(tierDepth(a.getY(i))+(Math.abs(a.getZ(i))-4.43)+.035));}piece.geometry.computeVertexNormals();}};
  for(const face of[-1,1]){
   facade(()=>{
    box('upper-tall-recess',.95,3.45,.055,x,17.9,face*4.43,'glass',false);
    for(const dx of[-.65,.65])box('slit-stone-jamb',.22,3.7,.28,x+dx,17.9,face*4.52,'trim');
    box('copper-aged-inset',.72,1.05,.07,x,top-1.65,face*4.43,'teal',false);
    for(const dx of[-2,2]){arch('upper-small-arcade',1.45,2.6,.43,1.6,.15,x+dx,16.2,face*4.48);box('arcade-shadow',.78,1.95,.04,x+dx,17.25,face*4.40,'glass',false);}
   });
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
 root.userData.approvedMonument={version:'aged-tapered-stone-gate-5',reference:'codex-clipboard-2d36da6b-4ff6-44ff-99e6-82fd130bbd5e.png',archWidth:14.4,springHeight:7,crownHeight:14.2,towerHeights:[24.2,23.6],upperTierProfiles:[[15.5,20.2,9,7.8,10.4,8.9],[20.2,24.2,7.8,6.6,8.9,7.4]],parapetThickness:.72,towerFootprint:[11.8,14],towerBaseDirection:'outward-and-forward-battered-stone',railCurveUnchanged:true,weatheringVersion:3,copingWearMax:.045,draws:merged.length};return merged;
}
