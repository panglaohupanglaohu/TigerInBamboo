import * as THREE from 'three';
import data from '../../../assets/models/optimized/gate-of-sighs/gateTargetData.js';
import {citadelCoastalFrame,citadelCoastalTramEnabled} from './coastalTramRoute.js';

export const HIGHLAND_GATE_ROUND=1;
export function installHighlandGate({scene,tramSystem}){
 if(!citadelCoastalTramEnabled())return null;
 const round=Number(new URLSearchParams(location.search).get('highlandGate')??HIGHLAND_GATE_ROUND);if(round<=0)return null;
 const cv=tramSystem.curve,target=new THREE.Vector3(-94,0,80).applyMatrix4(citadelCoastalFrame()).normalize();
 let u=0,best=Infinity;for(let i=0;i<12000;i++){const d=cv.getPointAt(i/12000).normalize().distanceToSquared(target);if(d<best){best=d;u=i/12000;}}
 const origin=cv.getPointAt(u),up=origin.clone().normalize(),z=cv.getTangentAt(u).normalize(),x=new THREE.Vector3().crossVectors(up,z).normalize();z.crossVectors(x,up).normalize();
 const root=new THREE.Group();root.name='highland-gate';root.position.copy(origin);root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,up,z));root.userData={round,railU:u,source:data.source,displayName:'高山之门'};
 for(const p of data.parts){
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(p.normals,3));g.computeBoundingBox();g.computeBoundingSphere();
 const m=new THREE.MeshStandardMaterial({color:new THREE.Color(...p.color),roughness:.96,side:p.name.includes('cloth')?THREE.DoubleSide:THREE.FrontSide});
 const mesh=new THREE.Mesh(g,m);mesh.name='highland-'+p.name;mesh.userData.citadelSolidExterior=p.solid;mesh.userData.highlandGateWalkable=p.walkable;root.add(mesh);
 }
 scene.add(root);root.updateMatrixWorld(true);return root;
}
