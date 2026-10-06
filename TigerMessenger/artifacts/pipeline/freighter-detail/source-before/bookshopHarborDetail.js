import * as THREE from 'three';
import {factoryKit} from '../assets/factoryArchitecture.js';
import {mergeStaticGroup} from './geometryMerge.js';

export function detailBookshopHarbor({ship,dock}){
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
 // Mast and stays are actual geometry, secured to deck-level attachment points.
 cyl(.085,6.3,0,3.4,6.1,M.iron);
 beam([0,6.5,6.1],[-2.3,.5,3.8],.015,M.iron);beam([0,6.5,6.1],[2.3,.5,3.8],.015,M.iron);
 beam([0,5.8,6.1],[0,3.4,1.8],.06,M.brass);beam([0,6.5,6.1],[0,3.4,1.8],.014,M.iron);
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
 return {deck:detail,receivingBay:yard};
}
