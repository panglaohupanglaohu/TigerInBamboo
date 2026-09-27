import * as THREE from 'three';
export const HOLY_STYLE_ROUND=2;
export function holyStyleRound(){const q=new URLSearchParams(globalThis.location?.search||'');return q.has('holyStyle')?THREE.MathUtils.clamp(Number(q.get('holyStyle'))||0,0,10):HOLY_STYLE_ROUND;}
export function applyHolyCityRoofPalette(city){
 if(holyStyleRound()<1)return;
 const clones=new Map();
 city.traverse(o=>{
  if(!o.isMesh)return;
  const recolor=m=>{
   if(!/^claude-house-roof/.test(m.name)&&m.name!=='citadel-target-blue-dome')return m;
   if(!clones.has(m)){const c=m.clone();c.color.setHex(0xbc825e);c.roughness=.94;clones.set(m,c);}return clones.get(m);
  };
  o.material=Array.isArray(o.material)?o.material.map(recolor):recolor(o.material);
 });
 city.userData.holyStyleRound=holyStyleRound();
}
export function addCathedralFacade(root){
 if(holyStyleRound()<2)return;
 const stone=new THREE.MeshStandardMaterial({color:0xeee6d4,roughness:.94});
 const shade=new THREE.MeshStandardMaterial({color:0xc4bdaa,roughness:.95});
 const add=(g,m,n,x,y,z)=>{const o=new THREE.Mesh(g,m);o.name=n;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;root.add(o);return o;};
 const pediment=new THREE.Shape();pediment.moveTo(-12,0);pediment.lineTo(12,0);pediment.lineTo(0,6);pediment.closePath();
 add(new THREE.ExtrudeGeometry(pediment,{depth:.7,bevelEnabled:false}),stone,'holy-cathedral-pediment',60,31,11.4);
 const inset=new THREE.Shape();inset.moveTo(-8.7,.55);inset.lineTo(8.7,.55);inset.lineTo(0,4.85);inset.closePath();
 add(new THREE.ShapeGeometry(inset),shade,'holy-pediment-inset',60,31,12.12);
 add(new THREE.BoxGeometry(25,.55,1.35),stone,'holy-cathedral-entablature',60,30.8,11.7);
 for(const x of [50.3,52.0,68.0,69.7]){
  add(new THREE.CylinderGeometry(.33,.44,13.5,16),stone,'holy-facade-column',x,23.25,11.9);
  for(const y of [16.45,29.95])add(new THREE.BoxGeometry(1,.4,.95),stone,'holy-column-capital',x,y,11.9);
 }
 const medallion=add(new THREE.TorusGeometry(.8,.14,8,32),stone,'holy-pediment-medallion',60,33.2,12.2);
 root.userData.holyArchivedMerlons=root.children.filter(o=>o.name.includes('merlon'));
 for(const child of root.userData.holyArchivedMerlons)root.remove(child);
}
