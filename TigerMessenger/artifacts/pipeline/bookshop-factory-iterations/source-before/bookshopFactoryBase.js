import * as THREE from 'three';
import {seatTownObject,townSurfaceMesh} from './bookshopTownSite.js';
import {mergeStaticGroup} from './geometryMerge.js';

// Shop fronts and their working yards share the same spherical site.
export function buildBookshopFactoryBase({root,districts,R,colliders}){
 const mat=(c,m=0)=>new THREE.MeshStandardMaterial({color:c,roughness:.76,metalness:m});
 const stone=mat(0xa5a89b),iron=mat(0x35464c,.55),brass=mat(0xa58450,.55),copper=mat(0x95664b,.45),roof=mat(0x536979,.3),wood=mat(0x85715a),glass=new THREE.MeshStandardMaterial({color:0xd8b579,emissive:0xd69b39,emissiveIntensity:.55,roughness:.4});
 const moving=[],steam=[];
 function box(p,w,h,d,x,y,z,m){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);p.add(o);return o;}
 function cyl(p,r,h,x,y,z,m,r2=r){const o=new THREE.Mesh(new THREE.CylinderGeometry(r2,r,h,16),m);o.position.set(x,y,z);p.add(o);return o;}
 function beam(p,a,b,r,m){const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),o=cyl(p,r,A.distanceTo(B),...(A.add(B).multiplyScalar(.5).toArray()),m);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),B.sub(new THREE.Vector3(...a)).normalize());return o;}
 function crate(p,x,y,z,s=1){box(p,s,s,s,x,y+s/2,z,wood);for(const k of[-.38,.38])box(p,s+.04,.075,.07,x,y+s*(k+.5),z+s/2+.025,iron);}
 function plume(p,x,y,z){const g=new THREE.Group();g.position.set(x,y,z);p.add(g);for(let i=0;i<6;i++){const o=new THREE.Mesh(new THREE.IcosahedronGeometry(.45,1),new THREE.MeshBasicMaterial({color:0xe1e1ce,transparent:true,opacity:.22,depthWrite:false}));g.add(o);steam.push({o,i});}return g;}
 function crane(p,x,z,height=8,span=8){const g=new THREE.Group();g.position.set(x,0,z);p.add(g);for(const side of[-1,1]){box(g,.24,height,.35,side*span/2,height/2,0,iron);for(let j=0;j<height-1;j+=1.5){beam(g,[side*span/2-.55,j,0],[side*span/2+.55,j+1.5,0],.065,brass);}}box(g,span+2,.45,.65,0,height,0,iron);box(g,span+2,.09,.8,0,height+.3,0,brass);const lift=new THREE.Group();g.add(lift);beam(lift,[0,0,0],[0,-2.3,0],.035,iron);crate(lift,0,-3.2,0,1.2);moving.push({o:lift,type:'hoist',y:height});}
 districts.forEach((d,i)=>{
  const g=new THREE.Group();g.name=['locust-assembly-works','ant-boiler-works','beetle-machine-works'][i];d.add(g);
  // A hall behind each retained retail front, with clear side access lanes.
  box(g,10,5.5,12,0,2.75,-9,stone);
  for(const side of[-1,1]){const r=box(g,5.7,.22,13,side*2.5,6,-9,roof);r.rotation.z=side*-.34;}
  for(let z=-14;z<=-4;z+=2.5){for(const side of[-1,1]){box(g,.15,5.9,.19,side*5.1,2.9,z,iron);box(g,.18,2,1.6,side*5.12,3.4,z,glass);}beam(g,[-5.2,5.3,z],[0,7.05,z],.09,brass);beam(g,[0,7.05,z],[5.2,5.3,z],.09,brass);}
  box(g,4,3.6,.18,0,1.8,-15.1,iron);
  for(let k=0;k<4;k++){const x=6.4+k%2*1.6,z=-5-Math.floor(k/2)*3;cyl(g,.65,3+k*.3,x,1.7,z,i===1?copper:iron);cyl(g,.22,5.5,x,5,z,brass);plume(d,x,7.8,z);beam(g,[x,2,z],[4.9,2,z],.12,copper);}
  crane(d,-6,-5,8.5,5);
  for(let k=0;k<8;k++)crate(g,-6.4-(k%2)*1.15,0,-10-Math.floor(k/2)*1.2,.9);
  townSurfaceMesh(d,-9,9,-17,4,stone,R,.92,16);
  for(const z of [-5,-9,-13])colliders.push({position:d.localToWorld(new THREE.Vector3(0,0,z)),radius:4.7});
  mergeStaticGroup(g);
 });
 const dock=new THREE.Group();dock.name='bookshop-parts-quayside';root.add(dock);seatTownObject(root,dock,-31,12,0,R);
 townSurfaceMesh(root,-35,-25,-3,29,stone,R,.93,20);
 crane(dock,0,0,10,8);
 const shed=new THREE.Group();dock.add(shed);box(shed,6,3.7,8,0,1.85,-9,wood);for(const s of[-1,1]){const r=box(shed,3.4,.2,9,s*1.5,4,-9,roof);r.rotation.z=-s*.3;}for(let x=-2;x<=2;x+=2)box(shed,1.4,2.8,.2,x,1.4,-4.9,iron);for(let i=0;i<18;i++)crate(shed,(i%3)*1.1-1,0,4+Math.floor(i/3)*1.15,.85);mergeStaticGroup(shed);
 // Cargo ship sits in the water, independently of the land surface.
 const ship=new THREE.Group();ship.name='bookshop-steam-parts-freighter';root.add(ship);seatTownObject(root,ship,-41,12,0,R);ship.position.addScaledVector(ship.position.clone().add(new THREE.Vector3(0,R+.9,0)).normalize(),-.65);
 const hull=new THREE.Shape();hull.moveTo(-2.7,-7);hull.lineTo(-2.7,5.5);hull.quadraticCurveTo(-2.4,8.5,0,10);hull.quadraticCurveTo(2.4,8.5,2.7,5.5);hull.lineTo(2.7,-7);hull.quadraticCurveTo(0,-9,-2.7,-7);
 const hg=new THREE.ExtrudeGeometry(hull,{depth:1.9,bevelEnabled:true,bevelThickness:.18,bevelSize:.25,bevelSegments:2,steps:1});hg.rotateX(Math.PI/2);const hm=new THREE.Mesh(hg,iron);ship.add(hm);box(ship,4.8,.2,14,0,.2,0,wood);box(ship,4,2.2,3.5,0,1.4,-4.8,stone);box(ship,4.5,.16,4,0,2.6,-4.8,roof);for(let x=-1.3;x<=1.4;x+=1.3)box(ship,.8,.75,.1,x,1.8,-3,glass);cyl(ship,.65,4,0,3.2,-1.8,copper);cyl(ship,.8,.25,0,5.25,-1.8,iron);plume(ship,0,5.5,-1.8);
 for(let i=0;i<10;i++)crate(ship,(i%2)*2-1,.3,1+Math.floor(i/2)*1.3,.95);
 for(const s of[-1,1]){for(let z=-7;z<=7;z+=2)beam(ship,[s*2.5,.3,z],[s*2.5,1.1,z],.035,brass);beam(ship,[s*2.5,1.1,-7],[s*2.5,1.1,7],.035,brass);}
 moving.push({o:ship,type:'ship',y:ship.position.y});
 // Narrow-gauge supply loop leaves the compass center free.
 for(const rr of[12.4,13]){const pts=[];for(let i=0;i<=120;i++){const a=i*Math.PI*2/120;const v=new THREE.Vector3(Math.sin(a)*rr,0,18+Math.cos(a)*rr);const w=root.localToWorld(v).setLength(R+.98);pts.push(root.worldToLocal(w));}root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),120,.045,4,false),iron));}
 const tractor=new THREE.Group();tractor.name='bookshop-moving-steam-freight';root.add(tractor);box(tractor,1.2,.7,2,0,.8,0,iron);cyl(tractor,.35,1.3,0,1.3,.5,copper);cyl(tractor,.12,1.1,0,2.1,.5,iron);for(const x of[-.65,.65])for(const z of[-.65,.65]){const w=cyl(tractor,.36,.2,x,.4,z,iron);w.rotation.z=Math.PI/2;}for(let i=0;i<2;i++){box(tractor,1.4,.22,1.7,0,.45,-2.3-i*2,iron);crate(tractor,0,.6,-2.3-i*2,1);}plume(tractor,0,2.7,.5);
 root.userData.factoryBase={version:1,workshops:3,workingHoists:moving.filter(x=>x.type==='hoist').length,cargoShip:ship.name,ground:'spherical'};
 root.userData.update=(dt,t)=>{for(const m of moving){if(m.type==='hoist'){m.o.position.set(Math.sin(t*.18)*1.7,m.y-1-Math.sin(t*.3)*.7,0);}else m.o.position.y=m.y+Math.sin(t*.65)*.055;}for(const {o,i}of steam){const a=(t*.4+i/6)%1;o.position.set(Math.sin(i*2+a)*a*.8,a*3.5,Math.cos(i+a)*a*.4);o.scale.setScalar(.6+a*1.8);o.material.opacity=(1-a)*.23;}const a=t*.035;seatTownObject(root,tractor,Math.sin(a)*12.7,18+Math.cos(a)*12.7,a+Math.PI/2,R);};
 return root.userData.factoryBase;
}
