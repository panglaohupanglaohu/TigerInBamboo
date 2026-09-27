import * as THREE from 'three';
export const HOLY_STYLE_ROUND=4;
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
 if(holyStyleRound()>=4){
  const terracotta=new THREE.MeshStandardMaterial({color:0xc28b65,roughness:.93});
  const drum=add(new THREE.CylinderGeometry(7.1,7.1,1.0,32),stone,'holy-main-dome-drum',60,42.65,-4.4);
  const dome=add(new THREE.SphereGeometry(7.2,48,24,0,Math.PI*2,0,Math.PI/2),terracotta,'holy-main-cathedral-dome',60,43.15,-4.4);dome.scale.y=.86;
  for(let i=0;i<12;i++){
   const a=i*Math.PI/6,points=[];
   for(let j=0;j<=20;j++){const t=j/20*Math.PI/2;points.push(new THREE.Vector3(60+Math.cos(a)*7.25*Math.cos(t),43.15+6.23*Math.sin(t),-4.4+Math.sin(a)*7.25*Math.cos(t)));}
   add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,.055,6,false),stone,'holy-dome-stone-rib',0,0,0);
  }
  add(new THREE.CylinderGeometry(.55,.75,1.1,12),stone,'holy-dome-lantern',60,49.9,-4.4);
  add(new THREE.ConeGeometry(.68,.75,12),terracotta,'holy-dome-lantern-cap',60,50.8,-4.4);
 }
}
export function addOldPalaceCrown(tower){
 if(holyStyleRound()<3)return;
 const roof=tower.getObjectByName('highland-central-tower-roof');
 const finial=tower.getObjectByName('highland-central-tower-finial');
 if(roof)roof.visible=false;if(finial)finial.visible=false;
 const stone=new THREE.MeshStandardMaterial({color:0xefe6cf,roughness:.94});
 const domeMat=new THREE.MeshStandardMaterial({color:0xd9c197,roughness:.91});
 const root=new THREE.Group();root.name='holy-old-palace-open-crown';tower.add(root);
 const add=(g,m,n,x,y,z)=>{const o=new THREE.Mesh(g,m);o.name=n;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;root.add(o);return o;};
 for(const y of [32.65,35.1])add(new THREE.CylinderGeometry(2.05,2.05,.25,24),stone,'old-palace-cornice',0,y,0);
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4,x=Math.cos(a)*1.7,z=Math.sin(a)*1.7;
  add(new THREE.CylinderGeometry(.13,.17,2.3,10),stone,'old-palace-arcade-column',x,33.86,z);
  const capital=add(new THREE.BoxGeometry(.38,.2,.38),stone,'old-palace-capital',x,34.93,z);
 }
 const dome=add(new THREE.SphereGeometry(2.1,32,16,0,Math.PI*2,0,Math.PI/2),domeMat,'old-palace-ivory-dome',0,35.23,0);dome.scale.y=.83;
 add(new THREE.ConeGeometry(.10,.75,10),domeMat,'old-palace-finial',0,37.34,0);
 tower.userData.holyPalaceCrown=true;
}
