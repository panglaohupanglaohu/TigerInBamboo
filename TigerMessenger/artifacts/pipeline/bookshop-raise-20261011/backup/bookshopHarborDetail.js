import * as THREE from 'three';
import {factoryKit} from '../assets/factoryArchitecture.js';
import {townSurfacePoint} from './bookshopTownSite.js';
import {mergeStaticGroup} from './geometryMerge.js';

export function detailBookshopHarbor({ship,dock,R=160}){
 const detail=new THREE.Group();detail.name='freighter-deck-equipment';ship.add(detail);
 const {M,box,cyl,beam,torus,gear,wheel,sign,crate}=factoryKit(detail);
 // Bow mooring gear, rub rails, riveted hull belt and cabin joinery.
 for(const s of[-1,1]){
  // Extruded hull bevel expands beyond the source profile's 2.7 half-width.
  // Mount fittings on the finished shell, not buried inside the bevel.
  for(const y of[-.25,-1.1])beam([s*3.02,y,-6.8],[s*3.02,y,5.5],.065,M.copper);
  for(let z=-6.4;z<5.5;z+=1.35){const p=new THREE.Group();p.position.set(s*3.03,-.42,z);p.rotation.y=s*Math.PI/2;detail.add(p);torus(.18,.035,0,0,0,M.brass,p);box(.28,.28,.018,0,0,-.02,M.dark,p);}
  for(let z=-6.9;z<5.5;z+=.48)for(const y of[-.83,-1.45]){const rivet=cyl(.028,.025,s*3.01,y,z,M.brass);rivet.rotation.z=Math.PI/2;}
  beam([s*2.2,.33,-6.8],[s*2.2,1.14,-6.8],.06,M.iron);
  for(let z=-6.1;z<-3.1;z+=.8){box(.055,.70,.48,s*2.03,1.83,z,M.amber);box(.08,.04,.53,s*2.06,1.83,z,M.brass);}
  for(const z of[-6.1,-3.8]){cyl(.13,.38,s*1.85,2.95,z,M.iron);cyl(.22,.07,s*1.85,3.16,z,M.brass);}
  for(const z of[5.4,6.4]){cyl(.13,.36,s*1.9,.5,z,M.iron);box(.54,.10,.13,s*1.9,.69,z,M.iron);}
 }
 sign('NORTHWARD',2.0,.32,0,1.23,-2.99);
 // Exposed propeller shaft modules and wheel hubs among the incoming crates.
 for(const z of[1.9,4.7]){
  box(1.8,.12,1.05,0,.38,z,M.wood);
  const axle=cyl(.16,1.7,0,.83,z,M.steel||M.iron);axle.rotation.z=Math.PI/2;
  for(const x of[-.65,.65]){const hub=new THREE.Group();hub.position.set(x,.83,z);hub.rotation.y=Math.PI/2;detail.add(hub);wheel(0,0,0,.42,hub);}
 }
 cyl(.24,.44,0,.47,7.6,M.iron);cyl(.38,.10,0,.74,7.6,M.brass);gear(0,.74,7.6,.28);
 // Continuous rigging: mast stays, boom topping lift, winch reeving, and
 // a secured hook. Every visible cable ends at a named physical fitting.
 {const rig=new THREE.Group();rig.name='freighter-complete-rigging';ship.add(rig);
 const K= factoryKit(rig), anchors={}, connections=[];
 const anchor=(name,p)=>{const g=new THREE.Group();g.name='rig-anchor-'+name;g.position.fromArray(p);rig.add(g);K.torus(.065,.022,0,0,0,K.M.brass,g);anchors[name]=p;return p;};
 const cable=(a,b,r=.018)=>{K.beam(anchors[a],anchors[b],r,K.M.iron);connections.push({from:a,to:b});};
 anchor('mast-head',[0,6.5,6.1]);anchor('mast-foot',[0,.3,6.1]);
 K.cyl(.105,6.2,0,3.4,6.1,K.M.iron);K.cyl(.25,.25,0,.4,6.1,K.M.brass);
 for(const [name,p] of Object.entries({port:[-2.25,.4,3.8],starboard:[2.25,.4,3.8],bow:[0,.4,8.5]})){anchor(name,p);cable('mast-head',name);K.box(.28,.12,.30,...p,K.M.iron);K.cyl(.09,p[1]-.1,p[0],(p[1]+.1)/2,p[2],K.M.iron);}
 anchor('boom-heel',[0,1.4,6.1]);anchor('boom-tip',[0,3.4,1.8]);
 K.beam(anchors['boom-heel'],anchors['boom-tip'],.09,K.M.brass);
 cable('mast-head','boom-tip');
 anchor('winch',[.45,.7,5.5]);anchor('mast-sheave',[.12,6.35,6.1]);anchor('tip-sheave',[.12,3.4,1.8]);anchor('hook',[.12,1.58,1.8]);
 cable('winch','mast-sheave');cable('mast-sheave','tip-sheave');cable('tip-sheave','hook');
 for(const name of ['mast-sheave','tip-sheave']){const p=anchors[name];K.torus(.13,.035,...p,K.M.iron);}
 K.box(.70,.17,.70,.45,.39,5.5,K.M.iron);
 const drum=K.cyl(.22,.48,.45,.65,5.5,K.M.copper);drum.rotation.z=Math.PI/2;
 for(const x of[.18,.72])K.torus(.26,.04,x,.65,5.5,K.M.brass).rotation.y=Math.PI/2;
 K.box(.18,.24,.13,.12,1.60,1.8,K.M.iron);
 const hook=new THREE.Mesh(new THREE.TorusGeometry(.13,.035,8,18,Math.PI*1.65),K.M.iron);hook.position.set(.12,1.39,1.8);rig.add(hook);
 // Hook is stowed to a deck eye when the ship is alongside.
 anchor('deck-eye',[.12,.40,1.8]);anchor('hook-bottom',[.12,1.27,1.8]);cable('hook-bottom','deck-eye',.025);
 rig.userData.rigging={anchors,connections};mergeStaticGroup(rig);}
 // Close the bow deck and rail loop; the old rectangular deck stopped early.
 const bowShape=new THREE.Shape();bowShape.moveTo(-2.45,5.5);bowShape.quadraticCurveTo(-2.25,8.3,0,9.6);bowShape.quadraticCurveTo(2.25,8.3,2.45,5.5);bowShape.closePath();
 const bowDeck=new THREE.Mesh(new THREE.ShapeGeometry(bowShape,24),M.wood);bowDeck.rotation.x=Math.PI/2;bowDeck.position.y=.28;bowDeck.material=M.wood.clone();bowDeck.material.side=THREE.DoubleSide;detail.add(bowDeck);
 const railPoints=[];for(let i=0;i<=16;i++){const t=i<=8?i/8:(16-i)/8,sign=i<=8?1:-1,x=sign*(2.45*(1-t)*(1-t)+4.5*(1-t)*t),z=5.5*(1-t)*(1-t)+16.6*(1-t)*t+9.6*t*t;railPoints.push([x,1.1,z]);if(i%2===0)beam([x,.28,z],[x,1.1,z],.035,M.brass);if(i)beam(railPoints[i-1],railPoints[i],.035,M.brass);}
 beam([-2.5,1.1,-7],[2.5,1.1,-7],.035,M.brass);for(const x of[-1.25,0,1.25])beam([x,.3,-7],[x,1.1,-7],.035,M.brass);
 for(const side of[-1,1]){const label=new THREE.Group();label.position.set(side*2.99,-.34,-5.0);label.rotation.y=side*Math.PI/2;detail.add(label);sign('NORTHWARD',1.45,.25,0,0,0,label);}
 // Cabin frames, door, roof rim and navigation lights.
 for(const side of[-1,1]){
  for(const z of[-6.1,-5.3,-4.5,-3.7]){for(const y of[1.46,2.20])box(.08,.045,.55,side*2.06,y,z,M.brass);for(const dz of[-.25,.25])box(.08,.78,.045,side*2.06,1.83,z+dz,M.brass);}
  box(.06,1.55,.65,side*2.04,1.1,-6.32,M.wood);box(.10,.08,.07,side*2.09,1.1,-6.08,M.brass);
  box(.11,.27,4.0,side*2.22,2.72,-4.8,M.iron);
  const lamp=new THREE.MeshStandardMaterial({color:side<0?0x9c392f:0x568b70,emissive:side<0?0x9c392f:0x568b70,emissiveIntensity:.7});cyl(.11,.22,side*2.15,2.96,-3.1,lamp);
  // Deck planking outside the cargo lane.
  for(let x=.35;x<2.2;x+=.24)beam([side*x,.315,-6.8],[side*x,.315,6.8],.012,M.dark);
  // Low hatch coamings and securing dogs beneath the existing crates.
  for(const z of[2.2,4.8]){box(.10,.27,2.25,side*1.56,.43,z,M.iron);for(const dz of[-1.12,1.12])box(3.12,.27,.10,0,.43,z+dz,M.iron);for(const dz of[-.8,0,.8])box(.18,.08,.12,side*1.6,.59,z+dz,M.brass);}
  // Funnel bands and angled stays terminate at roof bolted plates.
  if(side===1)for(const y of[1.65,3.4,5.05])torus(.67,.035,0,y,-1.8,M.iron).rotation.x=Math.PI/2;
  beam([side*.5,4.9,-1.8],[side*1.5,1.57,-2.7],.017,M.iron);box(.18,.10,.18,side*1.5,1.57,-2.7,M.brass);
  const vent=new THREE.Group();vent.position.set(side*1.25,1.58,-.45);detail.add(vent);cyl(.13,.65,0,.32,0,M.copper,vent);const mouth=cyl(.20,.30,0,.65,.1,M.copper,vent);mouth.rotation.x=Math.PI/2;box(.27,.27,.025,0,.65,.26,M.dark,vent);
  const life=torus(.25,.07,side*2.06,1.13,-4.7,M.copper);life.rotation.y=Math.PI/2;
 }
 for(const x of[-1.4,1.4]){for(let y=.4;y<2.8;y+=.28)beam([x-.17,y,-6.7],[x+.17,y,-6.7],.025,M.brass);for(const dx of[-.17,.17])beam([x+dx,.3,-6.7],[x+dx,2.9,-6.7],.03,M.iron);}
 mergeStaticGroup(detail);

 const yard=new THREE.Group();yard.name='quayside-parts-loading-yard';dock.add(yard);
 const K=factoryKit(yard),Q=K.M;
 // Open-sided receiving bay with visible sorting shelves instead of a sealed box.
 for(const x of[-3.8,3.8])for(const z of[-13.5,-7.5])K.box(.18,4.1,.18,x,2.05,z,Q.iron);
 K.roof(0,4.1,-10.5,8.4,7,.9);
 for(const x of[-3.3,3.3])for(let level=0;level<3;level++){K.box(1.15,.08,5,x,.45+level,-10.5,Q.iron);for(let j=0;j<4;j++)K.crate(x,.5+level,-12.3+j*1.2,.65);}
 K.sign('PARTS RECEIVING · CARGO HANDLING',6,.6,0,3.6,-6.9);
 for(const x of[-3.2,3.2]){K.cyl(.10,.65,x,.33,4.5,Q.iron);K.box(.52,.11,.15,x,.69,4.5,Q.brass);}
 for(let j=0;j<3;j++){const z=-1+j*1.9;K.box(1.5,.17,1.3,2,.35,z,Q.wood);K.gear(2,.9,z+.2,.45);}
 mergeStaticGroup(yard);
 // Mooring ropes follow the small ship bob instead of leaving loose ends.
 const mooring=new THREE.Group();mooring.name='freighter-mooring-cables';dock.add(mooring);
 const mk=factoryKit(mooring),lines=[];
 for(const [i,z] of [-5.8,5.8].entries()){
  const shipEnd=new THREE.Object3D();shipEnd.name='freighter-mooring-eye-'+i;shipEnd.position.set(2.45,.52,z);ship.add(shipEnd);
  const eye=torus(.10,.035,2.45,.52,z,M.brass,ship);eye.rotation.y=Math.PI/2;
  const shore=new THREE.Group();shore.name='quay-mooring-bollard-'+i;shore.position.copy(townSurfacePoint(dock,-8.2,i?-15:15,R,.96));dock.add(shore);
  mk.box(.65,.16,.65,0,.08,0,M.iron,shore);for(const x of[-.18,.18]){mk.cyl(.09,.52,x,.35,0,M.iron,shore);mk.cyl(.15,.08,x,.62,0,M.brass,shore);}
  const shoreEnd=new THREE.Object3D();shoreEnd.position.set(0,.48,0);shore.add(shoreEnd);
  const segments=Array.from({length:20},()=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,1,6),M.wood);mooring.add(o);return o;});lines.push({shipEnd,shoreEnd,segments});
 }
 const update=()=>{ship.updateWorldMatrix(true,false);dock.updateWorldMatrix(true,true);let maxGap=0;
  for(const line of lines){const a=mooring.worldToLocal(line.shipEnd.getWorldPosition(new THREE.Vector3())),b=mooring.worldToLocal(line.shoreEnd.getWorldPosition(new THREE.Vector3()));let previous=a.clone();
   for(let i=0;i<line.segments.length;i++){const u=(i+1)/line.segments.length,next=a.clone().lerp(b,u);next.y-=Math.sin(Math.PI*u)*.65;const delta=next.clone().sub(previous),o=line.segments[i];o.position.copy(previous).add(next).multiplyScalar(.5);o.scale.y=delta.length();o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());previous=next;}
   maxGap=Math.max(maxGap,previous.distanceTo(b));
  }mooring.userData.endpointGap=maxGap;
 };update();
 return {deck:detail,receivingBay:yard,update};
}
