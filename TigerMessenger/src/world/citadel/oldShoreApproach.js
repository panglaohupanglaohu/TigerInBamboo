import * as THREE from 'three';
import {mergeStaticGroup} from '../geometryMerge.js';
import rockData from '../../../assets/models/optimized/citadel-old-shore/oldShoreRockR03.js';
export function buildOldShoreApproach(castle,harbor,radius=160){
 if(!harbor?.userData.oldHarborOceanGrade||castle.getObjectByName('citadel-old-shore-approach'))return null;
 castle.updateWorldMatrix(true,true);harbor.updateWorldMatrix(true,true);
 // highlandAssaultAnchors is already transformed into castle-local space by
 // compositionFrame. Applying the old-city matrix again would miss the entrance.
 const end=new THREE.Vector3(...castle.userData.highlandAssaultAnchors.stairRoute[1]);
 const start=castle.worldToLocal(harbor.localToWorld(new THREE.Vector3(-3.6,.51,0))),rise=end.y-start.y;
 const gateStart=new THREE.Vector3(start.x+3,start.y,start.z-3);
 // Three flights follow the same hillside contour. Tight reversed landings
 // overhung the preceding flight and struck an equipped soldier's shield.
 const along=(t,y)=>{const p=gateStart.clone().lerp(end,t);p.y=y;return p;};
 const control=[start.clone(),gateStart,along(.28,start.y+rise/3),along(.35,start.y+rise/3),along(.63,start.y+2*rise/3),along(.70,start.y+2*rise/3),end];
 if(control.some((p,i)=>p.distanceTo(new THREE.Vector3(...rockData.control[i]))>1e-4))throw new Error('Old shore Blender supports require re-export for changed route');
 const root=new THREE.Group();root.name='citadel-old-shore-approach';castle.add(root);
 const walking=new THREE.Group(),walls=new THREE.Group();root.add(walking,walls);
 const rockGeometry=new THREE.BufferGeometry();
 for(const [name,key] of [['position','positions'],['normal','normals'],['color','colors']])rockGeometry.setAttribute(name,new THREE.Float32BufferAttribute(rockData[key],3));
 const rock=new THREE.Mesh(rockGeometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.98}));rock.name='old-shore-blender-rock-support';rock.userData.citadelSolidExterior=true;rock.castShadow=true;rock.receiveShadow=true;root.add(rock);
 const stone=new THREE.MeshStandardMaterial({color:0xc5bfae,roughness:.97}),paving=new THREE.MeshStandardMaterial({color:0xd5cdb8,roughness:.94});
 const box=(parent,name,point,width,height,depth,yaw=0,mat=paving)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),mat);mesh.name=name;mesh.position.copy(point);mesh.position.y-=height/2;mesh.rotation.y=yaw;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
 const route=[start.toArray()],flights=[];
 for(let k=1;k<control.length;k++){
  const a=control[k-1],b=control[k],run=Math.hypot(b.x-a.x,b.z-a.z),dy=b.y-a.y,n=Math.max(1,Math.ceil(Math.abs(dy)/.16)),yaw=Math.atan2(b.x-a.x,b.z-a.z),normal=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  if(Math.abs(dy)>.01)flights.push({steps:n,riser:dy/n,tread:run/n});
  for(let i=0;i<n;i++){
   const point=a.clone().lerp(b,(i+.5)/n);point.y=a.y+dy*(i+1)/n;
   const bottom=point.y-.7;
   box(walking,'old-shore-step',point,3.6,point.y-bottom,run/n+.08,yaw);
   if(n>1&&i>2&&i<n-3)for(const side of [-1,1]){const guard=point.clone().addScaledVector(normal,side*2);guard.y+=.85;box(walls,'old-shore-parapet',guard,.3,.85,run/n+.04,yaw,stone);}
   route.push(point.toArray());
  }
  // Flat connecting runs provide turn landings. A square pad centred on the
  // high end would overhang the last ascending treads and block headroom.
  route.push(b.toArray());
 }
 // A genuine arch opening at the shore-side landing, no solid doorway panel.
 const gatePoint=control[1],axis=control[2].clone().sub(gatePoint),shape=new THREE.Shape();
 shape.moveTo(-2.6,0);shape.lineTo(-1.65,0);shape.lineTo(-1.65,2.7);shape.quadraticCurveTo(-1.65,3.9,0,4.3);shape.quadraticCurveTo(1.65,3.9,1.65,2.7);shape.lineTo(1.65,0);shape.lineTo(2.6,0);shape.lineTo(2.6,5.2);shape.lineTo(-2.6,5.2);shape.closePath();
 const gate=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.7,bevelEnabled:false,curveSegments:6}),stone);gate.name='old-shore-defensive-arch';gate.position.copy(gatePoint);gate.rotation.y=Math.atan2(axis.x,axis.z);walls.add(gate);
 box(walking,'old-shore-gate-pad',gatePoint,5.8,.55,5.8);
 // Open a bounded hillside corridor below the actual stair tread elevations.
 const floorAt=(x,z)=>{let floor=null;for(let j=1;j<control.length;j++){const a=control[j-1],b=control[j],dx=b.x-a.x,dz=b.z-a.z,t=THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1),distance=Math.hypot(x-a.x-t*dx,z-a.z-t*dz);if(distance<4.5){const y=a.y+(b.y-a.y)*t-.65;floor=floor===null?y:Math.min(floor,y);}}return floor;};
 const cuts=[];
 for(const name of ['citadel-oskar-grid-mountain-surface','backlit-highlight-citadel-oskar-grid-mountain-surface']){
  const mesh=castle.getObjectByName(name);if(!mesh)continue;const g=mesh.geometry,p=g.attributes.position,toCastle=castle.matrixWorld.clone().invert().multiply(mesh.matrixWorld),inverse=toCastle.clone().invert();let changed=0;
  for(let i=0;i<p.count;i++){if(g.attributes.shoreBoundaryBottom?.getX(i)>.5)continue;const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(toCastle),floor=floorAt(v.x,v.z);if(floor!==null&&v.y>floor){v.y=floor;v.applyMatrix4(inverse);p.setXYZ(i,v.x,v.y,v.z);changed++;}}
  p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();cuts.push({name,changed});
 }
 mergeStaticGroup(walking,{mergedTag:'old-shore-walk',onSurface:mesh=>{mesh.name='old-shore-walkable';Object.assign(mesh.userData,{westCityWalkable:true,isCitadelTerrain:true,walkSurface:true});}});
 mergeStaticGroup(walls,{mergedTag:'old-shore-guards',onSurface:mesh=>{mesh.name='old-shore-defenses';mesh.userData.citadelSolidExterior=true;}});
 const report={start:start.toArray(),end:end.toArray(),control:control.map(p=>p.toArray()),flights,cuts,route,status:'candidate; full-width and native traversal pending'};
 root.userData.oldShoreApproach=report;castle.userData.oldShoreApproach=report;return root;
}
