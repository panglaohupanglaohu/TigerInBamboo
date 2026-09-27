import {wornMetal,armorPolygon,stencil,hose,curvedPlate,castLegGuard} from './robotSurfaceDetail.js';
import * as THREE from 'three';
import {mergeStaticGroup} from '../world/geometryMerge.js';

// Three reference-specific robot silhouettes. All source parts are built before
// material batching; factory output stays independently placeable/exportable.
const colors={olive:0x77796b,oliveLight:0x939985,sage:0x879881,rust:0x754f40,rustLight:0x906651,ink:0x293638,steel:0x536267,copper:0xad8052,cream:0xeee1bc,yellow:0xe3b955,eye:0x90d6d2};
const mats=Object.fromEntries(Object.entries(colors).map(([k,color])=>[k,new THREE.MeshStandardMaterial({name:'robot-'+k,color,roughness:k==='eye'?.19:.72,metalness:k==='eye'?.35:.23,emissive:k==='eye'?color:0,emissiveIntensity:k==='eye'?.3:0})]));
for(const key of ['olive','oliveLight','sage','rust','rustLight','steel','copper']){mats[key]=wornMetal(colors[key],key.startsWith('rust')?'rust':'paint');mats[key].name='robot-'+key;}
function part(root,g,key,p=[0,0,0],scale){const m=new THREE.Mesh(g,mats[key]);m.position.set(...p);if(scale)m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;}
function plate(root,size,p,key='olive',bevel=.06){
 const [w,h,d]=size,b=Math.min(bevel,w/6,h/6,d/3),s=new THREE.Shape();
 s.moveTo(-w/2+b,-h/2);s.lineTo(w/2-b,-h/2);s.lineTo(w/2,-h/2+b);s.lineTo(w/2,h/2-b);s.lineTo(w/2-b,h/2);s.lineTo(-w/2+b,h/2);s.lineTo(-w/2,h/2-b);s.lineTo(-w/2,-h/2+b);s.closePath();
 const g=new THREE.ExtrudeGeometry(s,{depth:d-2*b,bevelEnabled:true,bevelThickness:b,bevelSize:b*.5,bevelSegments:1,steps:1});g.translate(0,0,-(d-2*b)/2);const m=part(root,g,key,p);m.userData.panel=true;return m;
}
function ball(r,p,s,key){const small=Math.max(...s)<.07;return part(r,new THREE.SphereGeometry(1,small?8:32,small?6:20),key,p,s);}
function rod(r,a,b,radius,key='steel',r2=radius){const x=new THREE.Vector3(...a),y=new THREE.Vector3(...b),d=y.clone().sub(x);const m=part(r,new THREE.CylinderGeometry(r2,radius,d.length(),10),key,x.add(y).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;}
function ring(r,p,radius,tube,key='copper',rot){const m=part(r,new THREE.TorusGeometry(radius,tube,6,24),key,p);if(rot)m.rotation.set(...rot);return m;}
function bolts(r,p,w,h,key='copper'){for(const x of [-1,1])for(const y of [-1,1])ball(r,[p[0]+x*w/2,p[1]+y*h/2,p[2]],[.032,.032,.024],key);}
function vent(r,p,w,h,n=5){const group=new THREE.Group();group.position.set(...p);r.add(group);plate(group,[w+.07,h+.07,.055],[0,0,0],'ink',.02);for(let i=0;i<n;i++)plate(group,[w,.025,.035],[0,-h/2+h*i/(n-1),.03],'steel',.008);return group;}
function sensor(r,p,rad=.12){
 if(rad<.06){ring(r,p,rad,rad*.22,'rust');part(r,new THREE.CircleGeometry(rad*.70,12),'ink',[p[0],p[1],p[2]+.012]);return;}
 ring(r,p,rad,rad*.19);ball(r,[p[0],p[1],p[2]+.008],[rad*.86,rad*.86,rad*.25],'ink');ball(r,[p[0]-rad*.2,p[1]+rad*.23,p[2]+rad*.25],[rad*.23,rad*.23,.009],'eye');
}
function finish(root,id,name){
 root.name='bookshop-robot-'+id;root.userData.kind='bookshop-robot';root.userData.robotName=name;root.userData.modelVersion=4;
 root.updateMatrixWorld(true);const linePositions=[],wearPositions=[];
 root.traverse(o=>{if(!o.isMesh||!o.userData.panel)return;const e=new THREE.EdgesGeometry(o.geometry,35),p=e.attributes.position;for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);linePositions.push(...v.toArray());}for(let i=0;i<p.count-1;i+=14){const a=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld),b=new THREE.Vector3().fromBufferAttribute(p,i+1).applyMatrix4(o.matrixWorld);if(a.distanceTo(b)>.13){wearPositions.push(...a.clone().lerp(b,.17).toArray(),...a.clone().lerp(b,.34).toArray());}}e.dispose();});
 const before=[];root.traverse(o=>{if(o.isMesh)before.push(o)});mergeStaticGroup(root);
 if(linePositions.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(linePositions,3));root.add(new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0x34403d,transparent:true,opacity:.68})));}
 if(wearPositions.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(wearPositions,3));root.add(new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0xc3bba4,transparent:true,opacity:.42})));}
 let meshes=0,triangles=0;root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});root.userData.stats={sourceParts:before.length,meshes,triangles};return root;
}
export function createLocustRobot(){
 const r=new THREE.Group();
 // Deep knee hinges, separate shin shields, segmented broad feet.
 for(const s of [-1,1]){
  plate(r,[.83,.27,1.18],[s*.58,.16,.25],'ink');
  for(let i=0;i<3;i++)plate(r,[.235,.22,.62],[s*.58+(i-1)*.265,.28,.58],'olive');
  ball(r,[s*.58,.6,.04],[.26,.29,.28],'steel');
  rod(r,[s*.58,.5,0],[s*.68,1.53,-.15],.18);
  const shin=armorPolygon(r,[[-.36,.44],[-.21,.56],[.17,.55],[.35,.26],[.31,-.39],[.19,-.52],[-.34,-.46]],.52,[s*.66,1.02,.12],mats.olive);shin.rotation.x=-.17;
  plate(r,[.57,.035,.03],[s*.66,.58,.39],'yellow',.008);
  ball(r,[s*.67,1.65,-.12],[.26,.25,.29],'ink');sensor(r,[s*.67,1.65,.15],.095);
  rod(r,[s*.67,1.65,-.12],[s*.44,2.49,0],.23);
  const thigh=armorPolygon(r,[[-.34,.35],[-.25,.46],[.23,.46],[.36,.23],[.30,-.33],[.13,-.46],[-.29,-.37]],.60,[s*.57,2.09,.19],mats.oliveLight);thigh.rotation.z=s*.11;
  bolts(r,[s*.57,2.1,.52],.51,.64);
  rod(r,[s*.9,.64,-.15],[s*.95,1.47,-.19],.065,'copper');
  rod(r,[s*.95,1.4,-.19],[s*.88,1.7,-.19],.036,'cream');
 }
 plate(r,[1.25,.55,.74],[0,2.62,0],'ink');plate(r,[.64,.57,.82],[0,2.57,.16]);
 const chest=armorPolygon(r,[[-.95,.60],[-.62,.8],[.65,.8],[.98,.55],[.83,-.36],[.43,-.67],[-.52,-.57],[-.94,-.19]],.93,[0,3.43,0],mats.olive);chest.rotation.x=-.22;
 const hood=plate(r,[1.42,.52,.8],[0,4.0,-.13],'oliveLight');hood.rotation.x=-.17;
 plate(r,[.16,.022,.035],[-.82,3.72,.58],'rust',.01);
 armorPolygon(r,[[-.72,.44],[.55,.51],[.68,.28],[.46,-.43],[-.15,-.56],[-.62,-.28]],.16,[0,3.36,.65],mats.oliveLight).rotation.x=-.42;
 stencil(r,'△',[.19,3.54,.82],.17,.17,'#f2cc62');
 vent(r,[0,2.91,.59],.59,.21,4);
 for(const s of [-1,1]){
  armorPolygon(r,[[-.43,.26],[-.24,.48],[.32,.40],[.46,.16],[.38,-.37],[-.29,-.40],[-.43,-.15]],.82,[s*1.19,3.64,-.04],mats.olive);armorPolygon(r,[[-.3,.18],[-.19,.31],[.27,.25],[.31,-.20],[-.22,-.25]],.075,[s*1.19,3.65,.43],mats.oliveLight);
  bolts(r,[s*1.19,3.65,.55],.43,.35);
  rod(r,[s*1.15,3.36,0],[s*1.35,2.91,.02],.19,'ink');
  ring(r,[s*1.35,2.86,.21],.19,.045,'steel');
  const arm=armorPolygon(r,[[-.29,.36],[-.20,.43],[.25,.42],[.32,.25],[.25,-.38],[.15,-.46],[-.22,-.40]],.58,[s*1.4,2.43,.06],mats.olive);arm.rotation.z=s*.1;
  plate(r,[.035,.48,.035],[s*1.55,2.45,.4],'yellow',.008);
  plate(r,[.4,.28,.44],[s*1.43,1.94,.14],'ink');
  for(let i=0;i<3;i++)plate(r,[.105,.28,.19],[s*1.43+(i-1)*.12,1.94,.38]);
  rod(r,[s*.82,3.87,-.67],[s*.82,3.06,-.67],.19,'steel');
  ring(r,[s*.82,3.10,-.67],.20,.04,'copper',[Math.PI/2,0,0]);
 }
 rod(r,[-1.36,3.97,-.11],[-1.36,4.77,-.11],.025,'ink');
 // Shoulder recesses, service panels and hydraulic infrastructure.
 for(const s of [-1,1]){
  vent(r,[s*1.18,3.49,.56],.40,.14,4);stencil(r,'06',[s*1.2,3.78,.556],.24,.14);
  const shield=armorPolygon(r,[[-.29,.39],[.22,.39],[.34,.24],[.27,-.42],[-.2,-.45],[-.34,-.23]],.10,[s*.58,2.08,.57],mats.olive);shield.rotation.z=s*.12;
  stencil(r,s<0?'IA505':'SEDH',[s*.58,2.25,.66],.35,.12);
  sensor(r,[s*.59,1.83,.65],.039);
  for(let j=0;j<3;j++)rod(r,[s*.83,2.56,-.09-j*.13],[s*.98,3.0,-.1-j*.13],.045,'steel');
  hose(r,[[s*.78,3.3,-.5],[s*1.18,3.19,-.57],[s*1.3,2.58,-.19]],.075,mats.ink);
  for(let j=0;j<4;j++){const tab=plate(r,[.16,.1,.22],[s*1.14+(j-1.5)*.15,4.06,-.12],'oliveLight');}
  const front=armorPolygon(r,[[-.29,.40],[.17,.45],[.32,.17],[.24,-.42],[-.31,-.38]],.10,[s*.66,1.02,.43],mats.oliveLight);front.rotation.x=-.17;
  vent(r,[s*.64,.64,.54],.38,.13,4);stencil(r,'△',[s*.67,1.23,.48],.10,.10,'#e3c563');
  rod(r,[s*.95,2.26,-.3],[s*.92,2.7,-.2],.065,'copper');
  plate(r,[.5,.75,.13],[s*.5,3.41,-.61],'olive');vent(r,[s*.5,3.41,-.70],.32,.45,7).rotation.y=Math.PI;
 }
 stencil(r,'LOCUST',[0,3.08,.79],.39,.1);
 for(const sign of [-1,1]){
  const cheek=armorPolygon(r,[[-.23,.37],[.21,.42],[.34,.17],[.21,-.4],[-.3,-.27]],.19,[sign*.67,3.48,.6],mats.olive);cheek.rotation.y=sign*.27;cheek.rotation.x=-.37;
  plate(r,[.45,.12,.4],[sign*.85,3.03,.23],'steel');
  for(const z of[-.15,.03,.21])rod(r,[sign*1.22,3.31,z],[sign*1.38,2.91,z],.064,'steel');
  armorPolygon(r,[[-.24,.36],[.14,.41],[.27,.20],[.20,-.36],[-.22,-.29]],.40,[sign*1.43,2.43,.09],mats.oliveLight);
  for(const yy of[2.24,2.67])sensor(r,[sign*1.44,yy,.42],.03);
  plate(r,[.54,.075,.33],[sign*.59,2.59,.32],'steel');
  for(let j=0;j<3;j++){const a=plate(r,[.2,.06,.13],[sign*.73,3.1+j*.14,.73],'oliveLight');a.rotation.z=sign*.32;}
  stencil(r,'△',[sign*.57,2.34,.67],.13,.13,'#f1cf72');
  stencil(r,'CAUTION',[sign*1.44,2.52,.43],.26,.08,'#d4cba8');
  plate(r,[.05,.57,.035],[sign*.82,1.12,.49],'yellow',.008);
 }
 
 hose(r,[[-.31,2.69,.12],[-.4,2.39,.22],[-.12,2.28,.37]],.047,mats.steel);
 plate(r,[1.07,.33,.5],[0,4.14,-.18],'olive');vent(r,[0,4.13,-.47],.8,.19,4).rotation.y=Math.PI;

 for(const side of[-1,1]){
  armorPolygon(r,[[-.23,.20],[.19,.22],[.27,-.05],[.12,-.21],[-.24,-.13]],.16,[side*.67,1.61,.40],mats.olive);
  for(const y of[1.62,2.85]){const hinge=part(r,new THREE.CylinderGeometry(.20,.20,.13,24),'steel',[side*(y>2?1.38:.82),y,-.03]);hinge.rotation.z=Math.PI/2;}
  rod(r,[side*.32,2.62,-.38],[side*.62,1.91,-.41],.055,'copper');rod(r,[side*.57,2.01,-.40],[side*.63,1.78,-.4],.034,'cream');
  const pack=armorPolygon(r,[[-.32,.53],[.23,.53],[.35,.28],[.26,-.43],[-.31,-.47]],.39,[side*.45,3.47,-.77],mats.olive);vent(r,[side*.45,3.48,-1.0],.37,.57,9).rotation.y=Math.PI;
  plate(r,[.38,.12,.18],[side*.46,4.05,-.73],'steel');
 }
 for(const side of[-1,1]){
  const flap=armorPolygon(r,[[-.29,.12],[.29,.10],[.23,-.13],[-.28,-.13]],.055,[side*.42,3.1,.79],mats.olive);flap.rotation.x=-.22;
  const rib=plate(r,[.055,.52,.07],[side*.32,3.54,.78],'steel',.012);rib.rotation.z=-side*.25;
  plate(r,[.34,.10,.07],[side*1.17,3.88,.47],'olive');
  for(const xx of[-.17,.17]){const pin=part(r,new THREE.CylinderGeometry(.025,.025,.05,6),'steel',[side*1.19+xx,3.88,.51]);pin.rotation.x=Math.PI/2;}
  stencil(r,'CAUTION',[side*.7,1.0,.535],.23,.07,'#b2b19a');
  for(const y of[.8,1.19])plate(r,[.09,.065,.15],[side*.98,y,.23],'steel',.01);
  armorPolygon(r,[[-.29,.22],[.28,.2],[.23,-.2],[-.22,-.27]],.09,[side*1.20,3.21,.35],mats.olive);
 }
 // Long maintenance lance echoes the reference silhouette without blocking the doorway.
 const tool=new THREE.Group();tool.position.set(-1.56,1.0,.66);tool.rotation.z=-.1;r.add(tool);
 rod(tool,[0,-.77,0],[0,1.30,0],.055,'steel');armorPolygon(tool,[[-.09,.64],[.13,.64],[.15,-.10],[.05,-.39],[-.12,-.31]],.22,[0,.05,0],mats.olive);
 plate(tool,[.19,.12,.3],[0,.49,0],'steel');plate(tool,[.13,.12,.29],[0,-.20,0],'steel');rod(tool,[0,-.85,0],[0,-.56,0],.073,'ink');

 // Load-bearing shoulder trunnions, recessed ankle pistons and service seams.
 // The joints remain visibly separate from the larger sloping armor shields.
 for(const side of[-1,1]){
  for(const [x,y,z,rad] of [[.92,3.62,.0,.29],[.49,2.50,0,.24],[.64,.47,-.06,.19]]){
   const cap=part(r,new THREE.CylinderGeometry(rad,rad,.16,20),'steel',[side*x,y,z]);cap.rotation.z=Math.PI/2;
   const axle=part(r,new THREE.CylinderGeometry(rad*.56,rad*.56,.20,16),'ink',[side*x,y,z]);axle.rotation.z=Math.PI/2;
  }
  for(const z of[-.31,-.13]){rod(r,[side*.40,.33,z],[side*.48,.87,z],.07,'steel');rod(r,[side*.48,.78,z],[side*.51,1.03,z],.036,'cream');}
  const hip=armorPolygon(r,[[-.18,.30],[.24,.23],[.31,-.22],[-.21,-.26]],.16,[side*.83,2.43,-.01],mats.olive);hip.rotation.z=side*.18;
  for(const y of[.61,1.43])for(const dx of[-.21,.21]){const fastener=part(r,new THREE.CylinderGeometry(.025,.025,.025,6),'steel',[side*.66+dx,y,.47]);fastener.rotation.x=Math.PI/2;}
  // The reference has fine yellow edge stripes, not large gold fittings.
  plate(r,[.43,.027,.024],[side*.64,.48,.56],'yellow',.005);
  stencil(r,'SERVICE  /  06',[side*.45,3.49,-1.01],.35,.07,'#c2c0ac',Math.PI);
 }

 return finish(r,'locust','蝗虫');
}
export function createAntRobot(){
 const r=new THREE.Group();
 const joint=(p,rad,depth=.14)=>{const m=part(r,new THREE.CylinderGeometry(rad,rad,depth,32),'steel',p);m.rotation.z=Math.PI/2;return m;};
 // Seated weight rests on substantial articulated thighs, not a stack of cubes.
 for(const side of [-1,1]){
  ball(r,[side*.64,.69,-.13],[.5,.49,.62],'ink');
  curvedPlate(r,[side*.64,.69,-.13],[.55,.54,.67],0,Math.PI*2,.15,1.6,mats.rust);
  const boot=new THREE.Group();boot.position.set(side*.65,.17,.71);boot.rotation.x=-.08;r.add(boot);
  plate(boot,[.85,.29,1.02],[0,0,0],'ink');
  for(let j=0;j<3;j++){
   const cap=armorPolygon(boot,[[-.42,.12],[.42,.12],[.4,-.08],[-.4,-.08]],.86,[0,.1+j*.16,-j*.06],mats[j===1?'rustLight':'rust']);
   plate(boot,[.71,.035,.02],[0,.115+j*.16,.465-j*.06],'steel',.006);
  }
  ring(r,[side*.64,.73,.62],.27,.045,'steel');
  ball(r,[side*.64,.73,.64],[.24,.24,.085],'rustLight');
 }
 ball(r,[0,1.48,-.17],[.96,.91,.68],'ink');
 // Six thick boiler sectors, a raised equatorial belt and an actual bolted access lid.
 for(let k=0;k<6;k++)curvedPlate(r,[0,1.48,-.17],[1.0,.95,.73],k*Math.PI/3+.015,Math.PI/3-.03,.22,2.50,mats[k%3===0?'rustLight':'rust']);
 const belt=ring(r,[0,1.08,-.17],.87,.075,'steel',[Math.PI/2,0,0]);belt.scale.z=.73;
 const lid=part(r,new THREE.CylinderGeometry(.53,.53,.17,40),'rustLight',[0,1.53,.55]);lid.rotation.x=Math.PI/2;
 ring(r,[0,1.53,.64],.54,.05,'steel');ring(r,[0,1.53,.657],.44,.018,'copper');
 for(let k=0;k<12;k++){const a=k*Math.PI/6;const bolt=part(r,new THREE.CylinderGeometry(.028,.028,.035,6),'steel',[Math.cos(a)*.49,1.53+Math.sin(a)*.49,.664]);bolt.rotation.x=Math.PI/2;}
 for(const x of [-.13,.13]){part(r,new THREE.CircleGeometry(.045,16),'ink',[x,1.37,.656]);ring(r,[x,1.37,.66],.045,.009,'rust');}
 plate(r,[.12,.23,.12],[-.52,1.6,.63],'steel');plate(r,[.12,.23,.12],[.52,1.6,.63],'steel');
 // Small flattened head, perforations are dark inset discs with metal rims.
 ball(r,[0,2.36,-.15],[.42,.27,.35],'rust');
 ring(r,[0,2.17,-.15],.33,.035,'steel',[Math.PI/2,0,0]);
 for(const [x,y]of [[-.19,2.35],[0,2.44],[.19,2.35]]){
 const z=Math.sqrt(1-x*x/(.42*.42)-(y-2.36)*(y-2.36)/(.27*.27))*.35-.15;
 const g=new THREE.Group();g.position.set(x,y,z+.008);g.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(x/(.42*.42),(y-2.36)/(.27*.27),(z+.15)/(.35*.35)).normalize());r.add(g);ring(g,[0,0,0],.051,.010,'steel');part(g,new THREE.CircleGeometry(.043,20),'ink',[0,0,.002]);}

 for(const side of [-1,1]){
  joint([side*1.0,1.85,-.17],.3);
  // Closed armor bands follow shoulder sphere without intersecting duplicate shells.
  for(let j=0;j<3;j++){
   const shoulder=curvedPlate(r,[side*.94,1.85,-.15],[.5+j*.009,.51+j*.009,.5+j*.009],0,Math.PI*2,j===0?0:.12+j*.43,j===0?.553:.425,mats[j%2?'rust':'rustLight']);shoulder.rotation.z=-side*.55;
  }
  const elbow=[side*1.13,1.27,.22],wrist=[side*.72,1.10,.68];
  rod(r,[side*1.02,1.70,-.08],elbow,.245,'rust');joint(elbow,.25,.28);ball(r,elbow,[.263,.263,.263],'steel');
  const fore=new THREE.Group();fore.position.set(...elbow);fore.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...wrist).sub(new THREE.Vector3(...elbow)).normalize());r.add(fore);
  const len=new THREE.Vector3(...elbow).distanceTo(new THREE.Vector3(...wrist));
  for(let j=0;j<3;j++){const y=.10+j*(len-.12)/3;part(fore,new THREE.CylinderGeometry(.29-j*.018,.30-j*.018,.21,28),'rust',[0,y,0]);ring(fore,[0,y+.1,0],.29-j*.018,.025,'steel',[Math.PI/2,0,0]);}
  const hand=new THREE.Group();hand.position.set(side*.68,1.10,.79);r.add(hand);plate(hand,[.44,.23,.36],[0,0,0],'rust');
  for(let j=0;j<3;j++){plate(hand,[.115,.21,.18],[(j-1)*.13,0,.22],'rustLight');plate(hand,[.115,.12,.15],[(j-1)*.13,-.1,.15],'rust');}
  hose(r,[[side*.76,1.17,-.53],[side*1.02,.91,-.53],[side*.64,.73,-.19]],.055,mats.ink);
  stencil(r,side<0?'B-02':'07',[side*.64,.36,1.24],.26,.11,'#c6b699');
  plate(r,[.22,.41,.13],[side*.48,1.64,-.82],'rustLight');
  for(let j=0;j<3;j++)rod(r,[side*.48,1.46+j*.1,-.91],[side*.65,1.46+j*.1,-.85],.029,'copper');
 }
 for(const side of[-1,1]){
  const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),-side*.55);
  for(const th of[.51,.94,1.37])for(let j=0;j<10;j++){
   const a=j*Math.PI/5,p=new THREE.Vector3(-Math.cos(a)*Math.sin(th)*.511,Math.cos(th)*.521,Math.sin(a)*Math.sin(th)*.511).applyQuaternion(q).add(new THREE.Vector3(side*.94,1.85,-.15));
   ball(r,p.toArray(),[.014,.014,.014],'steel');
  }
  // Upper arm cover has flanged seams following the bent limb, rather than a cut cylinder tip.
  rod(r,[side*1.04,1.68,-.03],[side*1.1,1.42,.14],.266,'rustLight');
  plate(r,[.13,.25,.1],[side*.42,1.49,.65],'rust');
  stencil(r,'07',[side*.92,.89,.20],.14,.08,'#bfae91');
 }
 const rearValve=ring(r,[.48,1.31,-.86],.105,.021,'steel');
 for(let j=0;j<4;j++){const a=j*Math.PI/2;rod(r,[.48,1.31,-.87],[.48+Math.sin(a)*.097,1.31+Math.cos(a)*.097,-.87],.014,'copper');}
 // Rear service hatches, protected valves and a curved exhaust neck.
 vent(r,[0,1.61,-.91],.48,.4,7).rotation.y=Math.PI;
 hose(r,[[-.56,1.78,-.52],[-.77,2.10,-.51],[-.87,2.48,-.48]],.18,mats.rustLight);
 const chimney=rod(r,[-.87,2.45,-.48],[-1.01,2.98,-.49],.185,'rustLight',.23);
 const end=ring(r,[-1.01,2.98,-.49],.23,.045,'steel');end.quaternion.copy(chimney.quaternion);end.rotateX(Math.PI/2);
 const mouth=part(r,new THREE.CircleGeometry(.196,28),'ink',[-1.014,2.993,-.49]);mouth.quaternion.copy(end.quaternion);
 for(const y of[2.49,2.80])ring(r,[-.87-(y-2.45)*.26,y,-.49],.2,.025,'steel',[Math.PI/2,0,.25]);
 // Cup rests naturally in the right palm; tea surface is visible inside the rim.
 part(r,new THREE.CylinderGeometry(.12,.087,.16,28),'cream',[.62,1.30,.81]);ring(r,[.62,1.385,.81],.12,.015,'cream',[Math.PI/2,0,0]);part(r,new THREE.CircleGeometry(.103,28),'rust',[.62,1.383,.81]).rotation.x=-Math.PI/2;ring(r,[.77,1.30,.81],.062,.019,'cream');
 // Cast ankle end caps, hand knuckles and the pressure-vessel service fittings.
 for(const side of[-1,1]){
  for(const j of[0,1,2]){
   const pin=part(r,new THREE.CylinderGeometry(.043,.043,.032,12),'steel',[side*.68+(j-1)*.13,1.10,1.0]);pin.rotation.x=Math.PI/2;
   for(const x of[-.33,.33]){const rivet=part(r,new THREE.CylinderGeometry(.024,.024,.028,6),'steel',[side*.65+x,.28+j*.16,1.17-j*.06]);rivet.rotation.x=Math.PI/2;}
  }
  ball(r,[side*.91,1.80,-.17],[.42,.40,.39],'rust');
  const hinge=part(r,new THREE.CylinderGeometry(.135,.135,.13,24),'rustLight',[side*1.34,1.41,.13]);hinge.rotation.z=Math.PI/2;
  hose(r,[[side*.56,1.12,-.56],[side*.78,1.07,-.68],[side*.79,1.52,-.63]],.035,mats.copper);
 }
 const gauge=new THREE.Group();gauge.position.set(.63,1.94,.41);gauge.rotation.y=.5;r.add(gauge);
 ring(gauge,[0,0,0],.12,.022,'steel');part(gauge,new THREE.CircleGeometry(.103,24),'cream',[0,0,.005]);rod(gauge,[0,0,.016],[.05,.065,.016],.008,'ink');
 plate(r,[.17,.32,.07],[.52,1.56,.71],'rustLight');
 for(const yy of[1.48,1.64])rod(r,[.47,yy,.76],[.60,yy,.76],.023,'steel');
 return finish(r,'ant','蚂蚁');
}
export function createBeetleRobot(){
 const r=new THREE.Group();
 plate(r,[1.48,.34,1.42],[0,.83,0],'ink');
 // Four independent wheel forks with tapered plate guards and visible tires.
 for(const x of[-1,1])for(const z of[-1,1]){
  const xx=x*1.05,zz=z*.81;
  const tire=part(r,new THREE.CylinderGeometry(.34,.34,.23,32),'ink',[xx,.35,zz]);tire.rotation.z=Math.PI/2;
  for(let j=0;j<20;j++){const a=j*Math.PI/10,m=plate(r,[.245,.065,.115],[xx,.35+Math.cos(a)*.337,zz+Math.sin(a)*.337],'ink',.008);m.rotation.x=-a;}
  for(const side of[-1,1]){const hub=part(r,new THREE.CylinderGeometry(.18,.18,.03,24),'steel',[xx+side*.127,.35,zz]);hub.rotation.z=Math.PI/2;const bearing=part(r,new THREE.CylinderGeometry(.07,.07,.04,12),'copper',[xx+side*.15,.35,zz]);bearing.rotation.z=Math.PI/2;}
  rod(r,[x*.53,.91,z*.44],[xx,.63,zz],.115,'steel');
  rod(r,[x*.57,1.09,z*.42],[xx,1.06,zz],.13,'copper');rod(r,[x*.62,1.09,z*.45],[x*.93,1.065,z*.73],.061,'cream');
  const leg=new THREE.Group();leg.position.set(xx,.93,zz);leg.rotation.z=-x*.19;leg.rotation.x=z*.15;leg.rotation.y=z<0?Math.PI:0;r.add(leg);
  castLegGuard(leg,[0,0,0],mats.sage);
  plate(leg,[.18,.28,.025],[-.18,-.11,.22],'oliveLight',.025);
  plate(leg,[.2,.12,.06],[0,-.42,.24],'steel');
  for(const yy of[-.22,.27])for(const px of[-.18,.18]){const bolt=part(leg,new THREE.CylinderGeometry(.023,.023,.024,6),'steel',[px,yy,.26]);bolt.rotation.x=Math.PI/2;}
  stencil(leg,'01',[-.03,.20,.265],.22,.15);stencil(leg,'△',[.09,-.13,.267],.08,.08,'#d4b253');
  vent(leg,[.16,-.22,.255],.12,.16,4);
  plate(leg,[.12,.07,.012],[-.13,.03,.259],'rust',.006);stencil(leg,'09',[-.13,.03,.272],.09,.05);
  hose(r,[[x*.53,1.04,z*.53],[x*.86,.75,z*.63],[xx,.58,zz]],.035,mats.ink);
 }
 // Low broad pressure hull, separated armor panels above a dark recessed waist.
 ball(r,[0,1.40,0],[1.01,.50,.86],'ink');
 const ctr=[0,1.41,0],sc=[1.10,.76,.95];
 for(let k=0;k<8;k++){
  const phi=k*Math.PI/4+.012;
  curvedPlate(r,ctr,sc,phi,Math.PI/4-.024,.055,1.40,mats.sage);
  const a=phi+.04;
  for(const th of[.48,1.13,1.4])ball(r,[-Math.cos(a)*Math.sin(th)*1.112,1.41+Math.cos(th)*.77,Math.sin(a)*Math.sin(th)*.96],[.017,.017,.017],'steel');
 }
 // Access hatches and armored rim follow the hull, rather than overlapping domes.
 const rim=ring(r,[0,1.50,0],1.09,.016,'steel',[Math.PI/2,0,0]);rim.scale.y=.868;
 curvedPlate(r,ctr,[1.125,.785,.975],.83,.41,.73,.46,mats.oliveLight);
 curvedPlate(r,ctr,[1.125,.785,.975],2.08,.40,.77,.45,mats.sage);
 for(const side of[-1,1]){
  rod(r,[side*.19,.89,.67],[side*.71,.89,.67],.145,'copper');
  for(const px of[.25,.62])ring(r,[side*px,.89,.67],.15,.026,'steel',[0,Math.PI/2,0]);
  vent(r,[side*.55,1.56,-.85],.33,.16,5).rotation.y=Math.PI;
  rod(r,[side*.74,1.87,-.31],[side*.74,2.66,-.31],.012,'steel');rod(r,[side*.74,1.87,-.31],[side*.74,2.10,-.31],.039,'olive');
 }
 const optic=new THREE.Group();optic.position.set(-.27,1.86,.74);optic.rotation.x=-.3;r.add(optic);
 part(optic,new THREE.CylinderGeometry(.28,.31,.14,40),'steel',[0,0,0]).rotation.x=Math.PI/2;
 ring(optic,[0,0,.085],.254,.020,'copper');ring(optic,[0,0,.073],.283,.018,'steel');ball(optic,[0,0,.097],[.222,.222,.052],'ink');ball(optic,[-.045,.065,.143],[.058,.026,.009],'eye');
 for(const side of[-1,1]){sensor(r,[side*.68,1.57,.73],.085);ring(r,[side*.40,1.39,.9],.047,.015,'steel');}
 armorPolygon(r,[[-.44,.14],[.43,.14],[.35,-.22],[-.30,-.22]],.18,[0,.9,.84],mats.sage);plate(r,[.24,.074,.045],[0,.92,.96],'ink');
 vent(r,[0,1.30,.90],.29,.12,4);
 for(const side of[-1,1]){
  const x=side*.58;
  const exhaust=part(r,new THREE.CylinderGeometry(.10,.1,.24,20),'steel',[x,1.28,-.87]);exhaust.rotation.x=Math.PI/2;ring(r,[x,1.28,-1.0],.10,.02,'copper');
  part(r,new THREE.CircleGeometry(.077,20),'ink',[x,1.28,-1.025]).rotation.y=Math.PI;
  const rear=plate(r,[.30,.25,.09],[side*.35,.82,-.78],'olive');vent(r,[side*.35,.82,-.84],.22,.16,4).rotation.y=Math.PI;
  hose(r,[[side*.6,1.22,-.63],[side*.81,1.15,-.70],[side*1.0,1.0,-.82]],.035,mats.ink);
  for(const zz of[-.8,.8]){
   const h=part(r,new THREE.CylinderGeometry(.12,.12,.11,20),'steel',[side*.84,1.02,zz]);h.rotation.z=Math.PI/2;
   const hub=part(r,new THREE.CylinderGeometry(.068,.068,.14,16),'copper',[side*.84,1.02,zz]);hub.rotation.z=Math.PI/2;
  }
 }
 const turret=new THREE.Group();turret.position.set(0,2.15,-.22);r.add(turret);
 armorPolygon(turret,[[-.28,.1],[.15,.12],[.29,-.04],[.24,-.14],[-.25,-.14]],.39,[0,.06,0],mats.olive);
 for(const x of[-.10,.1]){rod(turret,[x,.09,.15],[x,.09,.69],.029,'steel');ring(turret,[x,.09,.64],.034,.008,'ink');}
 stencil(r,'09',[.54,1.70,.828],.11,.10,'#bc6956');
 // Layered lower shell lip and mechanical wheel forks make the hull sit on a
 // working chassis. Four independent fairings retain the broad wheel stance.
 const lower=ring(r,[0,1.38,0],.98,.05,'steel',[Math.PI/2,0,0]);lower.scale.y=.87;
 for(const side of[-1,1]){
  for(const z of[-.81,.81]){
   for(const d of[-.15,.15])rod(r,[side*1.05+d,.36,z],[side*1.05+d,.71,z-.08],.045,'steel');
   const lamp=new THREE.Group();lamp.position.set(side*1.05,1.38,z+.1);lamp.rotation.x=-.15;r.add(lamp);sensor(lamp,[0,0,0],.053);
   for(let k=0;k<4;k++)ring(r,[side*.79,.85+k*.044,z],.085,.014,'steel',[Math.PI/2,0,0]);
  }
  const hatch=new THREE.Group();hatch.position.set(side*.92,1.68,.16);hatch.rotation.y=side*Math.PI/2;r.add(hatch);
  ring(hatch,[0,0,0],.14,.021,'steel');part(hatch,new THREE.CircleGeometry(.117,20),'olive',[0,0,.009]);
  for(const a of[0,Math.PI/2,Math.PI,Math.PI*1.5]){const bolt=part(hatch,new THREE.CylinderGeometry(.015,.015,.02,6),'steel',[Math.cos(a)*.105,Math.sin(a)*.105,.025]);bolt.rotation.x=Math.PI/2;}
  plate(r,[.23,.22,.28],[side*.44,2.03,-.45],'steel');
 }
 for(const x of[-.47,.24]){plate(r,[.17,.035,.10],[x,2.07,-.04],'oliveLight');rod(r,[x-.065,2.12,-.02],[x+.065,2.12,-.02],.015,'steel');}
 return finish(r,'beetle','甲壳虫');
}
export const BOOKSHOP_ROBOT_FACTORIES=[createLocustRobot,createAntRobot,createBeetleRobot];
