import {wornMetal,armorPolygon,stencil,hose,curvedPlate} from './robotSurfaceDetail.js';
import * as THREE from 'three';
import {mergeStaticGroup} from '../world/geometryMerge.js';

// Three reference-specific robot silhouettes. All source parts are built before
// material batching; factory output stays independently placeable/exportable.
const colors={olive:0x77796b,oliveLight:0x939985,sage:0x96aa82,rust:0xaa6650,rustLight:0xc58c67,ink:0x293638,steel:0x536267,copper:0xc79052,cream:0xeee1bc,yellow:0xe3b955,eye:0x90d6d2};
const mats=Object.fromEntries(Object.entries(colors).map(([k,color])=>[k,new THREE.MeshStandardMaterial({name:'robot-'+k,color,roughness:k==='eye'?.19:.72,metalness:k==='eye'?.35:.23,emissive:k==='eye'?color:0,emissiveIntensity:k==='eye'?.3:0})]));
for(const key of ['olive','oliveLight','sage','rust','rustLight','steel','copper']){mats[key]=wornMetal(colors[key],key.startsWith('rust')?'rust':'paint');mats[key].name='robot-'+key;}
function part(root,g,key,p=[0,0,0],scale){const m=new THREE.Mesh(g,mats[key]);m.position.set(...p);if(scale)m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;}
function plate(root,size,p,key='olive',bevel=.06){
 const [w,h,d]=size,b=Math.min(bevel,w/6,h/6,d/3),s=new THREE.Shape();
 s.moveTo(-w/2+b,-h/2);s.lineTo(w/2-b,-h/2);s.lineTo(w/2,-h/2+b);s.lineTo(w/2,h/2-b);s.lineTo(w/2-b,h/2);s.lineTo(-w/2+b,h/2);s.lineTo(-w/2,h/2-b);s.lineTo(-w/2,-h/2+b);s.closePath();
 const g=new THREE.ExtrudeGeometry(s,{depth:d-2*b,bevelEnabled:true,bevelThickness:b,bevelSize:b*.5,bevelSegments:1,steps:1});g.translate(0,0,-(d-2*b)/2);const m=part(root,g,key,p);m.userData.panel=true;return m;
}
function ball(r,p,s,key){return part(r,new THREE.SphereGeometry(1,16,10),key,p,s);}
function rod(r,a,b,radius,key='steel',r2=radius){const x=new THREE.Vector3(...a),y=new THREE.Vector3(...b),d=y.clone().sub(x);const m=part(r,new THREE.CylinderGeometry(r2,radius,d.length(),10),key,x.add(y).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;}
function ring(r,p,radius,tube,key='copper',rot){const m=part(r,new THREE.TorusGeometry(radius,tube,6,24),key,p);if(rot)m.rotation.set(...rot);return m;}
function bolts(r,p,w,h,key='copper'){for(const x of [-1,1])for(const y of [-1,1])ball(r,[p[0]+x*w/2,p[1]+y*h/2,p[2]],[.032,.032,.024],key);}
function vent(r,p,w,h,n=5){const back=plate(r,[w+.07,h+.07,.055],p,'ink',.02);for(let i=0;i<n;i++)plate(r,[w,.025,.035],[p[0],p[1]-h/2+h*i/(n-1),p[2]+.03],'steel',.008);return back;}
function sensor(r,p,rad=.12){ring(r,p,rad,.035);ball(r,[p[0],p[1],p[2]+.008],[rad*.86,rad*.86,.05],'ink');ball(r,[p[0]-.025,p[1]+.03,p[2]+.053],[rad*.36,rad*.36,.015],'eye');}
function finish(root,id,name){
 root.name='bookshop-robot-'+id;root.userData.kind='bookshop-robot';root.userData.robotName=name;root.userData.modelVersion=2;
 root.updateMatrixWorld(true);const linePositions=[];
 root.traverse(o=>{if(!o.isMesh||!o.userData.panel)return;const e=new THREE.EdgesGeometry(o.geometry,35),p=e.attributes.position;for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);linePositions.push(...v.toArray());}e.dispose();});
 const before=[];root.traverse(o=>{if(o.isMesh)before.push(o)});mergeStaticGroup(root);
 if(linePositions.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(linePositions,3));root.add(new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0x34403d,transparent:true,opacity:.68})));}
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
  const shin=plate(r,[.71,1.03,.52],[s*.66,1.02,.12]);shin.rotation.x=-.17;
  plate(r,[.57,.035,.03],[s*.66,.58,.39],'yellow',.008);
  ball(r,[s*.67,1.65,-.12],[.26,.25,.29],'ink');sensor(r,[s*.67,1.65,.15],.095);
  rod(r,[s*.67,1.65,-.12],[s*.44,2.49,0],.23);
  const thigh=plate(r,[.69,.89,.6],[s*.57,2.09,.19],'oliveLight');thigh.rotation.z=s*.11;
  bolts(r,[s*.57,2.1,.52],.51,.64);
  rod(r,[s*.9,.64,-.15],[s*.95,1.47,-.19],.065,'copper');
  rod(r,[s*.95,1.4,-.19],[s*.88,1.7,-.19],.036,'cream');
 }
 plate(r,[1.25,.55,.74],[0,2.62,0],'ink');plate(r,[.64,.57,.82],[0,2.57,.16]);
 const chest=armorPolygon(r,[[-.95,.60],[-.62,.8],[.65,.8],[.98,.55],[.83,-.36],[.43,-.67],[-.52,-.57],[-.94,-.19]],.93,[0,3.43,0],mats.olive);chest.rotation.x=-.22;
 const hood=plate(r,[1.42,.52,.8],[0,4.0,-.13],'oliveLight');hood.rotation.x=-.17;
 plate(r,[.67,.27,.3],[0,3.88,.52],'ink');plate(r,[.37,.045,.035],[0,3.89,.69],'rust',.01);
 armorPolygon(r,[[-.72,.44],[.55,.51],[.68,.28],[.46,-.43],[-.15,-.56],[-.62,-.28]],.16,[0,3.36,.65],mats.oliveLight).rotation.x=-.2;
 stencil(r,'△',[.19,3.54,.82],.17,.17,'#f2cc62');
 vent(r,[0,2.91,.59],.59,.21,4);
 for(const s of [-1,1]){
  plate(r,[.84,.78,.94],[s*1.19,3.64,-.04]);plate(r,[.62,.51,.1],[s*1.19,3.65,.49],'oliveLight');
  bolts(r,[s*1.19,3.65,.55],.43,.35);
  rod(r,[s*1.15,3.36,0],[s*1.35,2.91,.02],.19,'ink');
  ring(r,[s*1.35,2.86,.21],.19,.045,'steel');
  const arm=plate(r,[.52,.8,.61],[s*1.4,2.43,.06]);arm.rotation.z=s*.1;
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
  hose(r,[[s*.78,3.3,-.5],[s*1.18,3.19,-.57],[s*1.27,2.72,-.4]],.075,mats.ink);
  for(let j=0;j<4;j++){const tab=plate(r,[.16,.1,.22],[s*1.14+(j-1.5)*.15,4.06,-.12],'oliveLight');}
  const front=armorPolygon(r,[[-.29,.40],[.17,.45],[.32,.17],[.24,-.42],[-.31,-.38]],.10,[s*.66,1.02,.43],mats.oliveLight);front.rotation.x=-.17;
  vent(r,[s*.64,.64,.54],.38,.13,4);stencil(r,'△',[s*.67,1.23,.48],.10,.10,'#e3c563');
  rod(r,[s*.95,2.26,-.3],[s*.92,2.7,-.2],.065,'copper');
  plate(r,[.5,.75,.13],[s*.5,3.41,-.61],'olive');vent(r,[s*.5,3.41,-.70],.32,.45,7).rotation.y=Math.PI;
 }
 stencil(r,'LOCUST',[0,3.08,.79],.39,.1);
 for(const sign of [-1,1]){
  const cheek=armorPolygon(r,[[-.23,.37],[.21,.42],[.34,.17],[.21,-.4],[-.3,-.27]],.12,[sign*.67,3.48,.6],mats.olive);cheek.rotation.y=sign*.27;cheek.rotation.x=-.15;
  plate(r,[.45,.12,.4],[sign*.85,3.03,.23],'steel');
  for(const z of[-.15,.03,.21])rod(r,[sign*1.22,3.31,z],[sign*1.38,2.91,z],.064,'steel');
  plate(r,[.17,.65,.48],[sign*1.68,2.47,.0],'oliveLight');
  for(const yy of[2.24,2.67])sensor(r,[sign*1.44,yy,.42],.03);
  plate(r,[.54,.075,.33],[sign*.59,2.59,.32],'steel');
  for(let j=0;j<3;j++){const a=plate(r,[.2,.06,.13],[sign*.73,3.1+j*.14,.73],'oliveLight');a.rotation.z=sign*.32;}
  stencil(r,'△',[sign*.57,2.34,.67],.13,.13,'#f1cf72');
  stencil(r,'CAUTION',[sign*1.44,2.52,.43],.26,.08,'#d4cba8');
  plate(r,[.05,.57,.035],[sign*.82,1.12,.49],'yellow',.008);
 }
 const hatch=plate(r,[.46,.25,.055],[-.12,3.83,.82],'oliveLight');hatch.rotation.x=-.2;
 bolts(r,[-.12,3.83,.86],.35,.14,'ink');
 hose(r,[[-.31,2.69,.12],[-.4,2.39,.22],[-.12,2.28,.37]],.047,mats.steel);
 plate(r,[1.07,.33,.5],[0,4.14,-.18],'olive');vent(r,[0,4.13,-.47],.8,.19,4).rotation.y=Math.PI;

 // Long maintenance lance echoes the reference silhouette without blocking the doorway.
 rod(r,[-1.54,.24,.65],[-1.54,2.25,.65],.065,'steel');plate(r,[.18,.7,.22],[-1.54,1.35,.65],'ink');
 return finish(r,'locust','蝗虫');
}
export function createAntRobot(){
 const r=new THREE.Group();
 for(const s of [-1,1]){
  plate(r,[.9,.34,1.18],[s*.66,.18,.58],'ink');
  for(let i=0;i<3;i++)plate(r,[.87,.13,1.14],[s*.66,.29+i*.17,.59],'rust');
  ball(r,[s*.64,.79,.12],[.53,.52,.57],'rust');
  plate(r,[.67,.42,.15],[s*.64,.76,.71],'rust');
 }
 ball(r,[0,1.56,-.03],[1.0,.91,.66],'rust');
 ring(r,[0,1.6,.58],.6,.07,'ink');ball(r,[0,1.6,.63],[.55,.55,.14],'rustLight');
 ring(r,[0,1.6,.72],.45,.025,'copper');
 for(let i=0;i<10;i++){const a=i/10*Math.PI*2;ball(r,[Math.cos(a)*.51,1.6+Math.sin(a)*.51,.72],[.035,.035,.03],'steel');}
 for(const s of [-1,1])sensor(r,[s*.14,1.48,.77],.04);
 ball(r,[0,2.47,-.07],[.46,.36,.39],'rust');ring(r,[0,2.24,-.07],.39,.055,'steel',[Math.PI/2,0,0]);
 for(const [x,y]of [[-.19,2.49],[0,2.56],[.19,2.49]])ball(r,[x,y,.288],[.065,.065,.03],'ink');
 for(const s of [-1,1]){
  ball(r,[s*1.0,1.95,-.05],[.43,.5,.5],'rustLight');
  rod(r,[s*.95,2.02,-.05],[s*1.22,1.48,.25],.30,'rust');
  rod(r,[s*1.22,1.48,.25],[s*.8,1.22,.75],.29,'rustLight');
  
  plate(r,[.49,.28,.4],[s*.67,1.19,.87],'rust');
  for(let i=0;i<3;i++)plate(r,[.13,.26,.22],[s*.67+(i-1)*.15,1.19,1.04],'rustLight');
 }
 rod(r,[-.67,2.03,-.32],[-.89,3.08,-.4],.18,'copper',.22);ring(r,[-.89,3.08,-.4],.23,.055,'steel',[Math.PI/2,0,0]);
 part(r,new THREE.CircleGeometry(.19,20),'ink',[-.89,3.1,-.4]).rotation.x=-Math.PI/2;
 // Overlapping boiler armor, shoulder bands and exposed joint collars.
 for(const s of [-1,1]){
  for(let j=0;j<3;j++)curvedPlate(r,[s*.97,1.93,-.04],[.49+j*.045,.53,.55],s<0?Math.PI*.45:Math.PI*1.45,Math.PI*.55,.26+j*.37,.31,mats[j%2?'rust':'rustLight']);
  for(let j=0;j<3;j++){
   const a=new THREE.Vector3(s*1.22,1.48,.25).lerp(new THREE.Vector3(s*.8,1.22,.75),j/2);
   const band=ring(r,a.toArray(),.31,.055,'steel');band.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(-s*.42,-.26,.5).normalize());
  }
  hose(r,[[s*.85,1.16,-.2],[s*1.13,.9,-.25],[s*.7,.61,-.15]],.06,mats.ink);
  for(let j=0;j<6;j++){const a=-.9+j*.36;ball(r,[s*(.67+Math.cos(a)*.32),1.76+Math.sin(a)*.61,.50],[.035,.035,.028],'steel');}
  stencil(r,s<0?'B-02':'07',[s*.73,.53,1.20],.32,.13,'#dfc6a0');
 }
 for(const x of [-.58,.58]){const strap=plate(r,[.16,1.13,.06],[x,1.68,.48],'rustLight');strap.rotation.z=-x*.38;bolts(r,[x,1.7,.53],.05,.8,'steel');}
 ring(r,[0,1.0,-.03],.75,.065,'steel',[Math.PI/2,0,0]);
 for(const y of [2.2,2.6,2.98])ring(r,[-.67-(y-2.03)*.21,y,-.32-(y-2.03)*.075],.21,.025,'steel',[Math.PI/2,0,.20]);
 plate(r,[.47,.57,.2],[0,1.7,-.69],'rust');vent(r,[0,1.7,-.81],.32,.39,6).rotation.y=Math.PI;
 for(const sign of[-1,1]){
  for(let j=0;j<3;j++){
   const dome=curvedPlate(r,[sign*.98,1.94,-.04],[.48+j*.018,.51,.52+j*.02],0,Math.PI*2,.32+j*.30,.27,mats[j%2?'rust':'rustLight']);
   dome.rotation.z=-sign*.31;
  }
  const shoe=armorPolygon(r,[[-.39,.37],[.28,.43],[.43,.14],[.35,-.28],[-.39,-.25]],.10,[sign*.66,.75,.95],mats.rustLight);shoe.rotation.x=-.15;
  for(const x of[-.28,.28])ball(r,[sign*.66+x,.89,1.04],[.04,.04,.025],'steel');
  for(const y of[.39,.56])plate(r,[.8,.045,.025],[sign*.66,y,1.20],'steel',.006);
 }
 for(const a of [0,.5,1,1.5,2,2.5,3,3.5,4,4.5,5,5.5]){
  const x=Math.cos(a)*.37,y=1.6+Math.sin(a)*.37;ball(r,[x,y,.785],[.018,.018,.009],'copper');
 }
 const gauge=ring(r,[.28,1.9,.782],.11,.024,'steel');part(r,new THREE.CircleGeometry(.09,20),'cream',[.28,1.9,.79]);rod(r,[.28,1.9,.81],[.32,1.96,.81],.008,'ink');
 hose(r,[[-.39,1.22,.72],[-.46,1.0,.78],[-.24,.89,.7]],.037,mats.copper);
 // Porcelain teacup and open handle, a defining detail of reference two.
 part(r,new THREE.CylinderGeometry(.135,.095,.18,20),'cream',[.62,1.45,1.0]);
 ring(r,[.62,1.55,1.0],.126,.018,'cream',[Math.PI/2,0,0]);ring(r,[.79,1.46,1.0],.07,.021,'cream');
 return finish(r,'ant','蚂蚁');
}
export function createBeetleRobot(){
 const r=new THREE.Group();
 plate(r,[1.25,.35,1.35],[0,.94,0],'steel');
 for(const x of [-1,1])for(const z of [-1,1]){
  const xx=x*1.1,zz=z*.86;
  const tire=part(r,new THREE.CylinderGeometry(.4,.4,.28,16),'ink',[xx,.43,zz]);tire.rotation.z=Math.PI/2;
  const hub=part(r,new THREE.CylinderGeometry(.22,.22,.31,12),'copper',[xx,.43,zz]);hub.rotation.z=Math.PI/2;
  for(let j=0;j<12;j++){const a=j/12*Math.PI*2,m=plate(r,[.33,.12,.13],[xx,.43+Math.cos(a)*.38,zz+Math.sin(a)*.38],'steel',.015);m.rotation.x=-a;}
  rod(r,[x*.65,.99,z*.58],[xx,.65,zz],.17,'copper');rod(r,[x*.48,1.15,z*.45],[xx,1.08,zz],.09,'cream');
  const shield=ball(r,[xx,1.0,zz+.055],[.36,.66,.43],'sage');
  plate(r,[.37,.43,.1],[xx,.98,zz+.43],'oliveLight');bolts(r,[xx,.98,zz+.49],.26,.3);
 }
 ball(r,[0,1.65,0],[.99,.64,.92],'ink');
 for(const s of [-1,1]){
  const shell=part(r,new THREE.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI*.51),'sage',[s*.05,1.49,0],[1.04,.89,.99]);shell.rotation.z=s*.03;
  plate(r,[.33,.12,.27],[s*.61,2.21,-.12],'oliveLight');
  rod(r,[s*.72,2.07,-.35],[s*.72,2.86,-.35],.018,'steel');rod(r,[s*.72,2.07,-.35],[s*.72,2.33,-.35],.045,'olive');
  sensor(r,[s*.65,1.60,.78],.14);
 }
 // Panel seams are genuine raised armor boundaries around the curved carapace.
 for(let k=0;k<6;k++){
  const phi=k*Math.PI/3+.045;
  curvedPlate(r,[0,1.49,0],[1.065,.91,1.015],phi,Math.PI/3-.09,.34,1.17,mats[k%2?'sage':'oliveLight']);
  const a=phi+Math.PI/6;
  for(const th of [.58,1.25])ball(r,[-Math.cos(a)*Math.sin(th)*1.078,1.49+Math.cos(th)*.92,Math.sin(a)*Math.sin(th)*1.025],[.022,.022,.022],'steel');
 }
 for(const s of [-1,1]){
  rod(r,[s*.15,.98,.70],[s*.75,.98,.70],.18,'copper');
  for(const x of [.22,.67]){const collar=ring(r,[s*x,.98,.70],.185,.035,'steel');collar.rotation.y=Math.PI/2;}
  curvedPlate(r,[s*1.10,1.0,.92],[.385,.695,.49],Math.PI*.17,Math.PI*.66,.32,2.12,mats.sage);
  stencil(r,'01',[s*1.1,1.12,1.48],.23,.16);
  hose(r,[[s*.72,1.29,-.57],[s*.94,1.0,-.71],[s*1.05,.67,-.84]],.05,mats.ink);
  vent(r,[s*.58,1.60,-.91],.38,.15,4).rotation.y=Math.PI;
 }
 armorPolygon(r,[[-.4,.19],[.4,.19],[.31,-.22],[-.28,-.22]],.17,[0,.94,.96],mats.oliveLight);
 plate(r,[.28,.09,.04],[0,.94,1.07],'ink');
 stencil(r,'09',[.55,1.79,.874],.14,.12,'#c8715b');
 // Longitudinal carapace seam and big cyclopean camera.
 const seam=new THREE.CatmullRomCurve3([new THREE.Vector3(0,1.62,.98),new THREE.Vector3(0,2.21,.58),new THREE.Vector3(0,2.39,0),new THREE.Vector3(0,2.21,-.57)]);
 part(r,new THREE.TubeGeometry(seam,20,.022,5,false),'ink');
 ring(r,[-.25,1.99,.82],.3,.055,'copper');ball(r,[-.25,1.99,.85],[.25,.25,.12],'ink');ball(r,[-.30,2.07,.958],[.075,.075,.02],'eye');
 vent(r,[0,1.45,.99],.46,.19,4);
 plate(r,[.61,.26,.51],[0,2.49,-.28],'olive');
 for(const x of [-.12,.12])rod(r,[x,2.54,-.03],[x,2.54,.68],.039,'steel');
 for(const s of [-1,1])for(let i=0;i<4;i++)ball(r,[s*(.41+i*.12),1.71,.87-i*.11],[.026,.026,.026],'copper');
 return finish(r,'beetle','甲壳虫');
}
export const BOOKSHOP_ROBOT_FACTORIES=[createLocustRobot,createAntRobot,createBeetleRobot];
