import * as THREE from 'three';
import {factoryKit} from './factoryArchitecture.js';
// Approved individual targets: inhabited book front, industrial silhouette behind.
// Everything is inside the authored factory footprint; public exits stay clear.
export function addFactoryTargetDetail(parent,kind){
 const root=new THREE.Group();root.name=kind+'-target-architectural-detail';parent.add(root);
 const{M,mesh,box,cyl,beam,pipe,torus,gear}=factoryKit(root);
 const warm=new THREE.MeshStandardMaterial({color:0x9a5828,emissive:0xffab43,emissiveIntensity:.65,roughness:.8});
 // Books stand in front of lit shelving, rather than dark opaque window holes.
 for(const x of[-5.45,-.85]){box(1.72,2.72,.025,x,1.61,2.365,warm);for(let row=0;row<5;row++)box(1.72,.022,.028,x,.76+row*.5,2.41,M.amber);}
 // Structural entablature, carved tooth courses and twin pilasters.
 for(const x of[-6.7,.5]){for(const side of[-1,1])cyl(.062,3.7,x+side*.17,2.1,2.69,M.trim);for(const y of[.3,3.7,4.37])box(.67,.10,.62,x,y,2.55,M.trim);}
 for(let i=0;i<24;i++)box(.15,.15,.23,-7.08+i*.347,4.22,2.76,M.trim);
 // Navy factory banners echo the accepted concept, with book and craft symbols.
 for(const [i,x]of[-7.4,8.6].entries()){
  const h=i?4.2:3.25,y=i?5.9:3.6,z=i?-2.18:2.7;
  beam([x-.65,y+h/2+.15,z],[x+.65,y+h/2+.15,z],.045,M.brass);
  box(1.02,h,.025,x,y,z,M.slate);for(const side of[-1,1])box(.026,h-.12,.012,x+side*.46,y,z+.021,M.brass);
  for(const side of[-1,1]){const page=box(.26,.35,.025,x+side*.13,y+h*.24,z+.029,M.trim);page.rotation.z=side*.10;}
  for(let line=0;line<3;line++)box(.49-line*.06,.025,.017,x,y-.15-line*.14,z+.033,M.brass);
  gear(x,y-h*.29,z+.08,.20);
 }
 // Repeated roof trusses and open lit aisle make the three rear halls legible.
 for(let bay=0;bay<3;bay++){const x=-5+bay*8;for(const z of[-14.1,-20,-27.8]){
  beam([x-3.8,7.75,z],[x+3.8,7.75,z],.09,M.iron);beam([x-3.8,7.75,z],[x,10.28,z],.07,M.iron);beam([x,10.28,z],[x+3.8,7.75,z],.07,M.iron);
  for(const side of[-1,1])beam([x,7.75,z],[x+side*1.8,9.1,z],.045,M.brass);
  box(.7,.12,.36,x,7.5,z,M.amber);
 }for(const xx of[x-3.6,x+3.6])for(let y=1.4;y<7.4;y+=1.25)cyl(.07,.04,xx,y,-13.71,M.brass).rotation.x=Math.PI/2;}
 if(kind==='ant'){
  // Horizontal riveted pressure vessel above the foundry, connected to boilers.
  const tank=new THREE.Group();tank.position.set(4.5,12.1,-19);root.add(tank);
  cyl(1.5,7.8,0,0,0,M.copper,tank).rotation.z=Math.PI/2;
  for(const x of[-3.9,3.9]){const cap=mesh(new THREE.SphereGeometry(1.5,24,16),M.copper,x,0,0,tank);cap.scale.x=.35;}
  for(const x of[-3.75,-1.8,0,1.8,3.75]){torus(1.52,.075,x,0,0,M.iron,tank).rotation.y=Math.PI/2;for(let i=0;i<16;i++){const a=i*Math.PI/8;mesh(new THREE.SphereGeometry(.055,6,4),M.brass,x,Math.cos(a)*1.56,Math.sin(a)*1.56,tank);}}
  for(const x of[-2.8,2.8])box(.3,3,1.9,x,-2.3,0,M.iron,tank);
  pipe([[.5,12,-19],[.5,14,-19],[-5,14,-19],[-5,12,-16]],.18);
  mesh(new THREE.CircleGeometry(.55,32),M.trim,4.5,13.2,-17.42);torus(.57,.055,4.5,13.2,-17.38);beam([4.5,13.2,-17.32],[4.74,13.55,-17.32],.035,M.iron);
 }else if(kind==='locust'){
  // Full-depth lattice upper beams over the existing robot service bay.
  for(const z of[-1.2,2.3])for(let x=2.2;x<8.9;x+=.85){beam([x,9.25,z],[x+.85,10.0,z],.06,M.iron);beam([x,10,z],[x+.85,9.25,z],.045,M.brass);}
  for(const x of[2.2,9.1])for(let y=.5;y<9;y+=.9)box(.42,.07,.42,x,y,2.3,M.brass);
 }else{
  // Glass drum supporting the central reading dome; interior brass shelves.
  for(let i=0;i<16;i++){const a=i*Math.PI/8,x=-3.1+Math.cos(a)*1.82,z=-1+Math.sin(a)*1.82;cyl(.025,.72,x,4.88,z,M.brass);}
  const floor=cyl(1.75,.04,-3.1,4.6,-1,warm);
  for(const x of[-5,3,11]){pipe([[x,10.5,-23],[x,11.3,-20],[x+2,11.3,-20]],.09,M.brass);gear(x+2,10.6,-19.92,.38);}
 }
 return root;
}
