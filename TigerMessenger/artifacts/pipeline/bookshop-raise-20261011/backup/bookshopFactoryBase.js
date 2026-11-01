import * as THREE from 'three';
import {seatTownObject,townSurfaceMesh} from './bookshopTownSite.js';
import {mergeStaticGroup} from './geometryMerge.js';
import {detailBookshopHarbor} from './bookshopHarborDetail.js';

// Shop fronts and their working yards share the same spherical site.
export function buildBookshopFactoryBase({root,districts,R,colliders}){
 const mat=(c,m=0)=>new THREE.MeshStandardMaterial({color:c,roughness:.76,metalness:m});
 const stone=mat(0xa5a89b),iron=mat(0x35464c,.55),brass=mat(0xa58450,.55),copper=mat(0x95664b,.45),roof=mat(0x536979,.3),wood=mat(0x85715a),glass=new THREE.MeshStandardMaterial({color:0xd8b579,emissive:0xd69b39,emissiveIntensity:.55,roughness:.4});
 const moving=[],steam=[];
 const grandFreighter=new URLSearchParams(globalThis.location?.search||'').get('grandFreighter')!=='0';
 function box(p,w,h,d,x,y,z,m){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);p.add(o);return o;}
 function cyl(p,r,h,x,y,z,m,r2=r){const o=new THREE.Mesh(new THREE.CylinderGeometry(r2,r,h,16),m);o.position.set(x,y,z);p.add(o);return o;}
 function beam(p,a,b,r,m){const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),o=cyl(p,r,A.distanceTo(B),...(A.add(B).multiplyScalar(.5).toArray()),m);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),B.sub(new THREE.Vector3(...a)).normalize());return o;}
 function crate(p,x,y,z,s=1){box(p,s,s,s,x,y+s/2,z,wood);for(const k of[-.38,.38])box(p,s+.04,.075,.07,x,y+s*(k+.5),z+s/2+.025,iron);}
 function plume(p,x,y,z){const g=new THREE.Group();g.position.set(x,y,z);p.add(g);for(let i=0;i<6;i++){const o=new THREE.Mesh(new THREE.IcosahedronGeometry(.45,1),new THREE.MeshBasicMaterial({color:0xe1e1ce,transparent:true,opacity:.22,depthWrite:false}));g.add(o);steam.push({o,i});}return g;}
 function crane(p,x,z,height=8,span=8){const g=new THREE.Group();g.position.set(x,0,z);p.add(g);for(const side of[-1,1]){box(g,.24,height,.35,side*span/2,height/2,0,iron);for(let j=0;j<height-1;j+=1.5){beam(g,[side*span/2-.55,j,0],[side*span/2+.55,j+1.5,0],.065,brass);}}box(g,span+2,.45,.65,0,height,0,iron);box(g,span+2,.09,.8,0,height+.3,0,brass);const lift=new THREE.Group();g.add(lift);beam(lift,[0,0,0],[0,-2.3,0],.035,iron);crate(lift,0,-3.2,0,1.2);moving.push({o:lift,type:'hoist',y:height});}
 // One compact berth on the base flank; preserve the entire public seaward
 // plaza arc and the existing factory/rail layout.
 const dock=new THREE.Group();dock.name='bookshop-parts-quayside';root.add(dock);seatTownObject(root,dock,grandFreighter?-120.159400:-55,grandFreighter?-2.448781:43,grandFreighter?Math.PI/2-1.85:0,R);
 const quay=grandFreighter?townSurfaceMesh(dock,-10,27,-18,18,stone,R,.93,24):townSurfaceMesh(root,-60,-50,27,54,stone,R,.93,20);quay.name='bookshop-freighter-quay';
 // Waterside cantilever reaches the freighter, then traverses to the receiving yard.
 const boomMin=grandFreighter?-39:-26;
 const harborCrane=new THREE.Group();harborCrane.name='harbor-unloading-crane';dock.add(harborCrane);
 for(const x of[-3.6,-1.6])for(const z of[-1.2,1.2]){box(harborCrane,.22,10.6,.22,x,5.3,z,iron);for(let y=.4;y<9.8;y+=1.3)beam(harborCrane,[x,y,-1.2],[x,y+1.3,1.2],.05,brass);}
 for(const z of[-1.1,1.1]){for(const y of[10.1,11.2])beam(harborCrane,[boomMin,y,z],[1.5,y,z],.12,iron);for(let x=boomMin;x<1;x+=1.5)beam(harborCrane,[x,10.1,z],[x+1.5,11.2,z],.05,brass);}
 for(let x=boomMin;x<1.5;x+=1.5)beam(harborCrane,[x,10.1,-1.1],[x,10.1,1.1],.06,iron);
 // Stayed cantilever and an inland counterweight make the long ship reach
 // visually load-bearing instead of a floating horizontal ladder.
 for(const z of[-1.1,1.1]){
  beam(harborCrane,[-2.6,10.6,z],[-2.6,15.2,z],.14,iron);
  for(const x of[boomMin+2,7])beam(harborCrane,[-2.6,15.2,z],[x,11.2,z],.048,brass);
  for(const y of[10.1,11.2])beam(harborCrane,[1.5,y,z],[8,y,z],.12,iron);
  for(let x=1.5;x<8;x+=1.5)beam(harborCrane,[x,10.1,z],[Math.min(8,x+1.5),11.2,z],.05,brass);
 }
 beam(harborCrane,[-2.6,15.2,-1.1],[-2.6,15.2,1.1],.1,iron);
 for(const z of[-.65,.65])for(let j=0;j<3;j++)box(harborCrane,2.3,.52,.95,6.4,9.9-j*.56,z,stone);
 const harborTrolley=new THREE.Group();harborTrolley.name='harbor-cargo-trolley';harborCrane.add(harborTrolley);box(harborTrolley,1.1,.35,2.4,0,10.8,0,iron);
 for(const x of[-.4,.4])for(const z of[-1.15,1.15]){const wheel=cyl(harborTrolley,.18,.1,x,10.65,z,brass);wheel.rotation.x=Math.PI/2;}
 const cargo=new THREE.Group();cargo.name='harbor-suspended-cargo';harborTrolley.add(cargo);crate(cargo,0,0,0,1.2);for(const x of[-.45,.45])beam(cargo,[x,1.2,0],[0,1.9,0],.025,iron);
 const cables=[];for(const x of[-.38,.38]){const cable=cyl(harborTrolley,.025,1,x,5,0,iron);cables.push(cable);}
 moving.push({type:'unloading',o:harborTrolley,cargo,cables});
 const shed=new THREE.Group();dock.add(shed);for(let i=0;i<18;i++)crate(shed,(i%3)*1.1-1,0,4+Math.floor(i/3)*1.15,.85);mergeStaticGroup(shed);
 // Cargo ship sits in the water, independently of the land surface.
 const ship=new THREE.Group();ship.name='bookshop-steam-parts-freighter';dock.add(ship);seatTownObject(dock,ship,grandFreighter?-35:-24,0,0,R);ship.scale.setScalar(grandFreighter?5:1);ship.userData.scaleFromOriginal=grandFreighter?5:1;ship.position.addScaledVector(new THREE.Vector3(0,1,0).applyQuaternion(ship.quaternion),.5);
 const hull=new THREE.Shape();hull.moveTo(-2.7,-7);hull.lineTo(-2.7,5.5);hull.quadraticCurveTo(-2.4,8.5,0,10);hull.quadraticCurveTo(2.4,8.5,2.7,5.5);hull.lineTo(2.7,-7);hull.quadraticCurveTo(0,-9,-2.7,-7);
 const hg=new THREE.ExtrudeGeometry(hull,{depth:grandFreighter?3.4:1.9,bevelEnabled:true,bevelThickness:.18,bevelSize:.25,bevelSegments:2,steps:1});hg.rotateX(Math.PI/2);
 if(grandFreighter){const p=hg.attributes.position;for(let i=0;i<p.count;i++){const t=THREE.MathUtils.clamp(-p.getY(i)/3.4,0,1);p.setX(i,p.getX(i)*(1-.23*t*t));p.setZ(i,p.getZ(i)*(1-.055*t));}p.needsUpdate=true;hg.computeVertexNormals();}
 const hm=new THREE.Mesh(hg,iron);hm.name='freighter-solid-deep-hull';ship.add(hm);box(ship,4.8,.2,14,0,.2,0,wood);box(ship,4,2.2,3.5,0,1.4,-4.8,stone);box(ship,4.5,.16,4,0,2.6,-4.8,roof);for(let x=-1.3;x<=1.4;x+=1.3)box(ship,.8,.75,.1,x,1.8,-3,glass);cyl(ship,.65,4,0,3.2,-1.8,copper);cyl(ship,.8,.25,0,5.25,-1.8,iron);plume(ship,0,5.5,-1.8);
 if(grandFreighter){
  const engine=new THREE.Group();engine.name='freighter-boiler-engine-house';ship.add(engine);
  box(engine,3.2,1.3,3.4,0,.8,-1.5,iron);box(engine,3.45,.15,3.6,0,1.5,-1.5,roof);
  const boiler=cyl(engine,.62,2.8,0,.86,.6,copper);boiler.rotation.x=Math.PI/2;
  for(const x of[-1.63,1.63]){for(let z=-2.7;z<-.1;z+=.36)box(engine,.045,.40,.09,x,1.02,z,brass);beam(engine,[x,.5,-2.8],[x,.5,.3],.10,copper);}
  for(const z of[-.3,1.5]){const band=new THREE.Mesh(new THREE.TorusGeometry(.64,.045,6,24),brass);band.position.set(0,.86,z);engine.add(band);}
  for(const x of[-.9,.9])beam(engine,[x,.3,1.7],[x,.3,-3.1],.065,iron);
 }
 for(let i=0;i<10;i++)crate(ship,(i%2)*2-1,.3,1+Math.floor(i/2)*1.3,.95);
 for(const s of[-1,1]){for(let z=-7;z<=5.5;z+=2)beam(ship,[s*2.5,.3,z],[s*2.5,1.1,z],.035,brass);beam(ship,[s*2.5,1.1,-7],[s*2.5,1.1,5.5],.035,brass);}
 moving.push({o:ship,type:'ship',y:ship.position.y});const unloading=moving.find(m=>m.type==='unloading');if(grandFreighter){ship.updateWorldMatrix(true,true);const pickup=dock.worldToLocal(ship.localToWorld(new THREE.Vector3(1.1,.55,0)));unloading.pickupX=pickup.x;unloading.pickupY=pickup.y;}else{unloading.pickupX=ship.position.x;unloading.pickupY=ship.position.y+.25;}
 const harborDetails=detailBookshopHarbor({ship,dock,R});
 const tractor=new THREE.Group();tractor.name='bookshop-moving-steam-freight';root.add(tractor);box(tractor,1.2,.7,2,0,.8,0,iron);cyl(tractor,.35,1.3,0,1.3,.5,copper);cyl(tractor,.12,1.1,0,2.1,.5,iron);for(const x of[-.70,.70])for(const z of[-.65,.65]){const w=cyl(tractor,.36,.2,x,.4,z,iron);w.rotation.z=Math.PI/2;}for(let i=0;i<2;i++){box(tractor,1.4,.22,1.7,0,.45,-2.3-i*2,iron);crate(tractor,0,.6,-2.3-i*2,1);}plume(tractor,0,2.7,.5);
 root.userData.factoryBase={version:2,workshops:12,workingHoists:4,receivingBays:1,cargoShip:ship.name,ground:'spherical',freighterScale:grandFreighter?5:1,berth:grandFreighter?'single side berth; public waterfront arc preserved':'original factory quay'};
 root.userData.update=(dt,t)=>{for(const d of districts)for(const c of d.children)c.userData.update?.(dt,t);for(const m of moving){if(m.type==='unloading'){const phase=(t/28)%1,smooth=u=>u*u*(3-2*u);let x=m.pickupX,y=m.pickupY;if(phase<.2)y=m.pickupY+smooth(phase/.2)*(7-m.pickupY);else if(phase<.55){x=m.pickupX*(1-smooth((phase-.2)/.35));y=7;}else if(phase<.75){x=0;y=7-smooth((phase-.55)/.2)*6.8;}else{x=smooth((phase-.75)/.25)*m.pickupX;y=7;}m.cargo.visible=phase<.75;m.o.position.x=x;m.cargo.position.y=y;for(const cable of m.cables){const length=10.6-y-1.9;cable.scale.y=length;cable.position.y=y+1.9+length/2;}}else if(m.type==='hoist'){m.o.position.set(Math.sin(t*.18)*1.7,m.y-1-Math.sin(t*.3)*.7,0);}else m.o.position.y=m.y+Math.sin(t*.65)*.055;}for(const {o,i}of steam){const a=(t*.4+i/6)%1;o.position.set(Math.sin(i*2+a)*a*.8,a*3.5,Math.cos(i+a)*a*.4);o.scale.setScalar(.6+a*1.8);o.material.opacity=(1-a)*.23;}harborDetails.update();const a=t*.035;seatTownObject(root,tractor,Math.sin(a)*26.8,32+Math.cos(a)*26.8,a+Math.PI/2,R);};
 return root.userData.factoryBase;
}
