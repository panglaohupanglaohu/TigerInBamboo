import * as THREE from 'three';

// The WFC occupancy and lower adjoining rooms stay fixed. Above the wing roof,
// map each tower's square section to a circular section, including window trim.
// A one-floor transition keeps the round upper tower attached to its square base.
export function applyCrownRoundProfiles(group,spec,baseY){
 const cs=spec.cellSize,ch=spec.cellHeight,mid=(spec.gridSize-1)/2;
 const profiles=[{ix:5,iz:1,from:9,top:12},{ix:2,iz:2,from:3,top:9},{ix:8,iz:2,from:3,top:9}];
 group.updateWorldMatrix(true,true);
 const inv=group.matrixWorld.clone().invert(),v=new THREE.Vector3();let changed=0;
 group.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.geometry?.attributes.position)return;
  for(let p=mesh;p&&p!==group;p=p.parent)if(p.name==='town-dome')return;
  const cell=mesh.userData.cell;
  if(!cell)return;
  const profile=profiles.find(p=>Math.abs(cell.ix-p.ix)<=1&&Math.abs(cell.iz-p.iz)<=1&&cell.iy>=p.from);
  if(!profile)return;
  const matrix=new THREE.Matrix4().multiplyMatrices(inv,mesh.matrixWorld),back=matrix.clone().invert();
  const g=mesh.geometry.clone(),pos=g.attributes.position;
  const cx=(profile.ix-mid)*cs,cz=(profile.iz-mid)*cs;
  for(let i=0;i<pos.count;i++){
   v.fromBufferAttribute(pos,i).applyMatrix4(matrix);
   const t=THREE.MathUtils.clamp((v.y-baseY-profile.from*ch)/ch,0,1);
   const dx=v.x-cx,dz=v.z-cz,r=Math.hypot(dx,dz);
   if(t>0&&r>1e-6){const factor=1-t+t*Math.max(Math.abs(dx),Math.abs(dz))/r;v.x=cx+dx*factor;v.z=cz+dz*factor;}
   v.applyMatrix4(back);pos.setXYZ(i,v.x,v.y,v.z);
  }
  g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();mesh.geometry=g;changed++;
 });
 group.userData.roundTowerProfiles={count:profiles.length,changedMeshes:changed,transitionFloors:1};
 return group.userData.roundTowerProfiles;
}

// Compensate the district X/Z enlargement so crowns keep their designed rise.
// Only the roof surface changes; WFC occupancy and tower rooms remain intact.
export function refineCitadelDomes(group,widthScale){
 let count=0;
 group.traverse(mesh=>{
  if(!mesh.isMesh||mesh.name!=='town-dome-cap')return;
  const radius=mesh.geometry.parameters?.radius;
  if(!Number.isFinite(radius))return;
  const profile=[new THREE.Vector2(0,radius)];
  for(let i=1;i<=5;i++){
   const angle=i*Math.PI/10;
   profile.push(new THREE.Vector2(radius*Math.sin(angle),radius*Math.cos(angle)));
  }
  const geometry=new THREE.LatheGeometry(profile.reverse(),12);
  geometry.computeVertexNormals();
  mesh.geometry=geometry;
  mesh.scale.y=.78*widthScale;
  mesh.material=mesh.material.clone();mesh.material.flatShading=true;
  mesh.userData.roofProfile={kind:'faceted-blue-crown',riseToRadius:.78};count++;
 });
 group.userData.refinedDomes=count;return count;
}
