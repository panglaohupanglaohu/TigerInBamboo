import * as THREE from 'three';
import {createCitadelPlayerWalls} from './playerWalls.js';
import data from '../../../assets/models/optimized/gate-of-sighs/gateTargetData.js';
import {citadelCoastalFrame,citadelCoastalTramEnabled} from './coastalTramRoute.js';

export const HIGHLAND_GATE_ROUND=11;
export function installHighlandGate({scene,tramSystem}){
 if(!citadelCoastalTramEnabled())return null;
 const round=Number(new URLSearchParams(location.search).get('highlandGate')??HIGHLAND_GATE_ROUND);if(round<=0)return null;
 const cv=tramSystem.curve,target=new THREE.Vector3(-94,0,80).applyMatrix4(citadelCoastalFrame()).normalize();
 let u=0,best=Infinity;for(let i=0;i<12000;i++){const d=cv.getPointAt(i/12000).normalize().distanceToSquared(target);if(d<best){best=d;u=i/12000;}}
 const origin=cv.getPointAt(u),up=origin.clone().normalize(),z=cv.getTangentAt(u).normalize(),x=new THREE.Vector3().crossVectors(up,z).normalize();z.crossVectors(x,up).normalize();
 const root=new THREE.Group();root.name='highland-gate';root.position.copy(origin);root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,up,z));root.userData={round,railU:u,source:data.source,displayName:'高山之门'};
 for(const p of data.parts){
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(p.normals,3));if(round>=4)g.scale(.82,.74,.84);g.computeBoundingBox();g.computeBoundingSphere();
 const m=new THREE.MeshStandardMaterial({color:new THREE.Color(...p.color),roughness:.96,side:p.name.includes('cloth')?THREE.DoubleSide:THREE.FrontSide});
 if(round>=3){const palette={stone:0xe4d7b9,brick:0xd5c6a7,edge:0xf1e5ca,cloth:0x245783,gold:0xaf8e4e,dark:0x5c6466,rock:0x7d898c,wood:0x806843,leaf:0x426040};const key=p.name.split('_')[1].split('.')[0];m.color.setHex(palette[key]??0xd5c6a7);m.emissive.copy(m.color).multiplyScalar(.16);}
 const mesh=new THREE.Mesh(g,m);mesh.name='highland-'+p.name;mesh.userData.citadelSolidExterior=p.solid;mesh.userData.highlandGateWalkable=p.walkable;root.add(mesh);
 }
 const add=(name,geometry,color,position=[0,0,0])=>{geometry.translate(...position);const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.95,flatShading:true,emissive:color,emissiveIntensity:.12}));mesh.name=name;root.add(mesh);return mesh;};
 if(round>=5){for(const side of[-1,1]){
 const pos=[],indices=[],N=24,levels=[[-19,17],[-11,15],[-4,12],[1.1,9],[2.1,7]];
 levels.forEach(([y,r],j)=>{for(let i=0;i<N;i++){const a=i/N*Math.PI*2,rr=r*(1+.09*Math.sin(i*2.7+side)+.06*Math.cos(i*1.9+j));pos.push(side*15.5+Math.cos(a)*rr,y+.35*Math.sin(i*2+j),Math.sin(a)*rr*1.3);}});
 for(let j=0;j<levels.length-1;j++)for(let i=0;i<N;i++){const a=j*N+i,b=j*N+(i+1)%N,c=a+N,d=b+N;indices.push(a,c,b,b,c,d);}for(let i=1;i<N-1;i++)indices.push(4*N,4*N+i+1,4*N+i);
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(indices);geo.computeVertexNormals();add('highland-gate-rock-foundation-'+side,geo,0x849393);
 }}
 if(round>=6){for(const side of[-1,1])for(let i=0;i<17;i++){
 const a=i*2.399,x=side*16+Math.cos(a)*(10+i%3),z=Math.sin(a)*(12+i%4),y=-5-(i%4)*2.2;
 if(Math.abs(x)<7)continue;
 const geo=new THREE.IcosahedronGeometry(1,1);geo.scale(2+i%3,3.5+i%4,2.8+i%3);geo.rotateY(i*.73);add('highland-foot-rock-'+side+'-'+i,geo,i%3===0?0xa4aaa0:0x788a90,[x,y,z]);
 }}
 if(round>=8){const originals=root.children.filter(o=>o.name.includes('Gate_stone'));const ray=new THREE.Raycaster();
 for(const side of[-1,1])for(const facing of[-1,1]){
 const shape=new THREE.Shape();shape.moveTo(-.78,0);shape.lineTo(.78,0);shape.lineTo(.78,3.8);shape.absarc(0,3.8,.78,0,Math.PI,false);shape.lineTo(-.78,0);
 const geo=new THREE.ShapeGeometry(shape,12),p=geo.attributes.position;
 for(let i=0;i<p.count;i++){const x=side*12.7+p.getX(i),y=20+p.getY(i);ray.set(new THREE.Vector3(x,y,facing*45),new THREE.Vector3(0,0,-facing));const hit=ray.intersectObjects(originals,false)[0];p.setXYZ(i,x,y,hit?hit.point.z+facing*.035:facing*8.5);}
 geo.computeVertexNormals();const niche=add('highland-arched-niche-'+side+'-'+facing,geo,0x56666e);niche.material.side=THREE.DoubleSide;
 }}
 if(round>=9){const rock=root.children.filter(o=>/rock-foundation|foot-rock/.test(o.name)),ray=new THREE.Raycaster();
 for(const side of[-1,1])for(let i=0;i<6;i++){const x=side*(22.5+(i%2)*2.2),z=-12+i*4.8;ray.set(new THREE.Vector3(x,30,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObjects(rock,false)[0];if(!hit)continue;const y=hit.point.y,h=5.5+(i%3)*1.1;
 add('highland-cypress-trunk-'+side+'-'+i,new THREE.CylinderGeometry(.12,.22,h*.65,6),0x75664c,[x,y+h*.325,z]);
 const profile=[[0,0],[.4,.12],[.8,.32],[.75,.6],[.48,.85],[0,1]].map(([r,t])=>new THREE.Vector2(r,h*t));add('highland-cypress-'+side+'-'+i,new THREE.LatheGeometry(profile,9),i%2?0x344b40:0x3e5944,[x,y+.6,z]);
 }}
 if(round>=10){for(let z=-36;z<36;z+=1.5){const m=add('highland-pedestrian-deck',new THREE.BoxGeometry(1.8,.4,1.52),0xdccfb4,[-3.15,-.25,z+.75]);m.userData.highlandGateWalkable=true;}}
 if(round>=11){for(let z=-35;z<=35;z+=2){if(Math.abs(z)<14)continue;for(const x of[-4.12,-2.2]){add('highland-walk-parapet-cap',new THREE.BoxGeometry(.18,.14,2.03),0xe9dcc0,[x,.94,z]);add('highland-walk-baluster',new THREE.BoxGeometry(.22,.85,.22),0xcabfa6,[x,.45,z]);}}}
 scene.add(root);root.updateMatrixWorld(true);
 if(round>=2){
 const inverse=root.matrixWorld.clone().invert(),len=cv.getLength();
 for(const mesh of root.children){const pos=mesh.geometry.attributes.position;for(let i=0;i<pos.count;i++){
 const a=pos.getX(i),h=pos.getY(i),d=pos.getZ(i),t=(u+d/len+1)%1,w=cv.getPointAt(t),normal=w.clone().normalize(),tangent=cv.getTangentAt(t),side=new THREE.Vector3().crossVectors(normal,tangent).normalize();
 w.addScaledVector(side,a).addScaledVector(normal,h).applyMatrix4(inverse);pos.setXYZ(i,w.x,w.y,w.z);
 }pos.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();mesh.geometry.computeBoundingBox();}
 }
 if(round>=7){for(const mesh of [...root.children]){if(!/Gate_(stone|edge|brick)|rock-foundation|foot-rock/.test(mesh.name))continue;const edge=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry,28),new THREE.LineBasicMaterial({color:0x5e635b,transparent:true,opacity:.24}));edge.name='highland-ink-'+mesh.name;edge.userData.isOutline=true;root.add(edge);}}
 root.updateMatrixWorld(true);
 const surfaces=root.children.filter(o=>o.isMesh&&o.userData.highlandGateWalkable),groundRay=new THREE.Raycaster(),local=new THREE.Vector3();
 root.userData.sampleGroundRadius=position=>{local.copy(position);root.worldToLocal(local);if(Math.abs(local.x)>42||Math.abs(local.z)>48||local.y>8)return null;const up=position.clone().normalize();groundRay.set(position.clone().addScaledVector(up,.6),up.clone().negate());groundRay.far=3;for(const hit of groundRay.intersectObjects(surfaces,false)){if(hit.face.normal.clone().transformDirection(hit.object.matrixWorld).dot(up)>.5)return hit.point.length();}return null;};
 root.userData.resolveWalls=createCitadelPlayerWalls(root);
 return root;
}
