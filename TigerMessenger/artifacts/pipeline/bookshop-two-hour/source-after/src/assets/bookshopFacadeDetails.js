import * as THREE from 'three';
import {factoryKit} from './factoryArchitecture.js';
// Deliberate shopfront craft: ironwork and books remain distinct from the works.
export function addBookshopFacadeDetails(parent,kind){
 const g=new THREE.Group();g.name=kind+'-shopfront-ironwork';parent.add(g);
 const {M,box,cyl,beam,torus,mesh}=factoryKit(g),sx=-3.1,z=2.76;
 for(const x of[-6.6,-4.3,-2,.3]){
  for(const side of[-1,1])cyl(.048,2.9,x+side*.105,1.98,z,M.brass);
  for(const y of[.62,3.24,3.48])box(.48,.07,.52,x,y,z-.14,M.trim);
  for(const yy of[.77,3.32]){const bead=torus(.14,.022,x,yy,z+.11,M.brass);}
 }
 // Curved iron fanlights; small loops echo the riveted workshop vocabulary.
 for(const x of[-5.45,-3.15,-.85]){
  for(const side of[-1,1]){const curve=new THREE.EllipseCurve(x+side*.23,3.0,.19,.24,0,Math.PI*2,false,0);const pts=curve.getPoints(24).map(p=>new THREE.Vector3(p.x,p.y,z+.04));mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),24,.012,5,true),M.brass);}
  torus(.065,.018,x,3.16,z+.07,M.brass);
 }
 // Four genuine warm wall lanterns, with a bracket and protective frame.
 for(const x of[-6.94,.64]){
  beam([x,2.4,z-.07],[x,2.65,z+.32],.035,M.iron);
  box(.22,.37,.19,x,2.32,z+.33,M.amber);
  for(const dx of[-.12,.12])beam([x+dx,2.1,z+.45],[x+dx,2.54,z+.45],.016,M.brass);
  mesh(new THREE.ConeGeometry(.22,.18,4),M.iron,x,2.60,z+.33);
 }
 // Open-book emblem above the shop name, deliberately sized as an architectural crest.
 const crestY=kind==='ant'?5.22:kind==='locust'?6.47:4.91;
 for(const side of[-1,1]){const page=box(.34,.42,.055,sx+side*.17,crestY,z+.1,M.trim);page.rotation.z=side*.12;for(let row=0;row<4;row++)box(.22,.011,.012,sx+side*.17,crestY-.12+row*.075,z+.14,M.brass);}
 beam([sx,crestY-.23,z+.15],[sx,crestY+.20,z+.15],.024,M.brass);
 // Wall-side benches keep the middle entrance clear.
 for(const x of[-7.3,1.2]){for(const yy of[.7,.93])box(.70,.10,.065,x,yy,3.25,M.wood);box(.75,.08,.40,x,.47,3.04,M.wood);for(const dx of[-.28,.28])beam([x+dx,.04,3.04],[x+dx,.94,3.22],.035,M.iron);}
 return g;
}
