import * as THREE from 'three';
const bark=new THREE.MeshStandardMaterial({color:0x5b5140,roughness:1});
// Small, separated leaves and woody stems replace the rock-like solid lobes.
// Same footprint/placement contract as buildSlopeShrub; the existing ray tests
// still decide whether a plant is allowed on each terrace.
export function buildCitadelLeafyShrub(materials,index,x,z,size,placement={}){
 const root=new THREE.Group();root.name='citadel-leafy-shrub-'+index;root.position.set(x,placement.surfaceY??0,z);root.rotation.y=index*1.913;root.scale.setScalar(.7+size*.7);root.userData.role='slope-shrub';
 let seed=index+101;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const colors=[materials.shrubDeep,materials.shrubMid,materials.shrubLight||materials.shrubMid],verts=[[],[],[]],leaf=new THREE.Vector3(),q=new THREE.Quaternion(),n=new THREE.Vector3();
 const centers=[[0,.43,0,.48],[.34,.28,.18,.31],[-.3,.29,-.14,.30],[.04,.65,-.03,.25]];
 for(let c=0;c<centers.length;c++){const[cx,cy,cz,r]=centers[c];for(let i=0;i<36;i++){
  const a=i*2.399963+rand()*.4,y=-.6+rand()*1.6,rad=Math.sqrt(Math.max(0,1-y*y));n.set(Math.cos(a)*rad,y,Math.sin(a)*rad).normalize();q.setFromUnitVectors(new THREE.Vector3(0,1,0),n);
  const origin=new THREE.Vector3(cx+n.x*r,cy+n.y*r*.62,cz+n.z*r*.85),len=.075+rand()*.105,w=len*.50;
  const points=[[-w,0,0],[0,.018,len],[w,0,0],[0,0,-len*.55],[0,.035,0]].map(p=>new THREE.Vector3(...p).applyQuaternion(q).add(origin));
  const tone=(i+c)%3;for(const tri of[[0,1,4],[1,2,4],[2,3,4],[3,0,4]])for(const j of tri)verts[tone].push(...points[j].toArray());
 }}
 for(let i=0;i<3;i++){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts[i],3));g.computeVertexNormals();colors[i].side=THREE.DoubleSide;const m=new THREE.Mesh(g,colors[i]);m.name='leaf-clusters';m.receiveShadow=true;root.add(m);}
 for(const[cx,cy,cz]of centers){const start=new THREE.Vector3(0,.03,0),end=new THREE.Vector3(cx,cy,cz),v=end.clone().sub(start);const stem=new THREE.Mesh(new THREE.CylinderGeometry(.012,.022,v.length(),5),bark);stem.position.copy(start).addScaledVector(v,.5);stem.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());root.add(stem);}
 return root;
}
