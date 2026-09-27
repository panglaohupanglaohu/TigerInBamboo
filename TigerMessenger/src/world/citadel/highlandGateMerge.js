import * as THREE from 'three';
// Only decorative meshes with baked local vertices. Walk surfaces/walls stay separate.
export function mergeHighlandGateDecor(root){
 const groups=new Map();let before=0;
 for(const mesh of [...root.children]){
  if(!mesh.isMesh||mesh.userData.citadelSolidExterior||mesh.userData.highlandGateWalkable||!/^highland-(side-ashlar|wall-ivy|rock-shrub|cypress|vine-stem|foot-rock)/.test(mesh.name))continue;
  const m=mesh.material,key=[m.color.getHex(),m.emissive.getHex(),m.emissiveIntensity,m.roughness,m.side,m.map?.uuid||'',Object.keys(mesh.geometry.attributes).sort().join(',')].join('|');
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(mesh);before++;
 }
 let after=0;
 for(const members of groups.values()){
  if(members.length<2){after++;continue;}
  const geometries=members.map(m=>m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone()),g=new THREE.BufferGeometry();
  for(const key of Object.keys(geometries[0].attributes)){const attrs=geometries.map(a=>a.attributes[key]),array=new Float32Array(attrs.reduce((s,a)=>s+a.array.length,0));let offset=0;for(const a of attrs){array.set(a.array,offset);offset+=a.array.length;}g.setAttribute(key,new THREE.Float32BufferAttribute(array,attrs[0].itemSize));}
  const combined=new THREE.Mesh(g,members[0].material);combined.name='highland-merged-decoration';combined.userData.sources=members.map(m=>m.name);root.add(combined);for(const member of members){root.remove(member);member.geometry.dispose();}for(const geo of geometries)geo.dispose();g.computeBoundingSphere();after++;
 }
 root.userData.decorMerge={before,after};
}
