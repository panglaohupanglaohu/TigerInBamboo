import * as THREE from 'three';
const shared=new Map();
const material=color=>{if(!shared.has(color))shared.set(color,new THREE.MeshStandardMaterial({color,roughness:.95}));return shared.get(color);};
// Human-scale base staff, shared by the shopfront, wharf and public promenade.
export function createBookshopWorker({coat=0x47545a,apron=false,carrying=false}={}){
 const g=new THREE.Group();g.name='bookshop-worker';g.userData.townWorker=true;g.userData.carrying=carrying;const m={coat:material(coat),skin:material(0xb39779),dark:material(0x293338),apron:material(0x82705a)};
 const mesh=(geo,mat,x,y,z)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=true;o.userData.dynamicTownWorker=true;g.add(o);return o;};
 const limb=(a,b,r,mat)=>{const aa=new THREE.Vector3(...a),bb=new THREE.Vector3(...b),v=bb.clone().sub(aa),o=mesh(new THREE.CylinderGeometry(r,r*.9,v.length(),8),mat,...aa.addScaledVector(v,.5).toArray());o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return o;};
 for(const s of[-1,1]){const leg=new THREE.Group();leg.name='worker-leg-'+s;leg.position.set(s*.11,.70,0);g.add(leg);g.updateWorldMatrix(true,true);const shin=limb([s*.11,.70,0],[s*.12,.12,s*.025],.068,m.dark),foot=mesh(new THREE.BoxGeometry(.15,.12,.29),m.dark,s*.12,.065,.08);leg.attach(shin);leg.attach(foot);}
 mesh(new THREE.CylinderGeometry(.20,.26,.64,10),m.coat,0,1.02,0);
 mesh(new THREE.SphereGeometry(.135,12,8),m.skin,0,1.46,0).scale.set(.86,1.12,.90);
 mesh(new THREE.CylinderGeometry(.16,.16,.06,12),m.dark,0,1.60,0);mesh(new THREE.CylinderGeometry(.195,.195,.025,12),m.dark,0,1.565,.025);
 for(const s of[-1,1]){const elbow=[s*.28,.98,.025],hand=carrying?[s*.22,1.01,.32]:[s*.31,.79,.04];limb([s*.18,1.27,0],elbow,.066,m.coat);limb(elbow,hand,.054,m.coat);mesh(new THREE.SphereGeometry(.06,8,6),m.skin,...hand);}
 if(apron)mesh(new THREE.BoxGeometry(.33,.59,.045),m.apron,0,.98,.21);
 if(carrying)mesh(new THREE.BoxGeometry(.40,.23,.28),m.apron,0,1.08,.32);
 return g;
}
