import * as THREE from 'three';

// Exact Mesh.raycast on a small triangle index, never an approximate height map.
// Supports the authored vertical probes; unfamiliar or tilted cases use Three.
export function createSwampGroundRayIndex({cellSize=2,enabled=true}={}) {
  const cache=new WeakMap(),inverse=new THREE.Matrix4(),localRay=new THREE.Ray();
  const report={queries:0,indexedMeshes:0,fallbackMeshes:0,rebuilds:0,candidateTriangles:0};
  const key=(x,z)=>`${x}:${z}`;
  function record(mesh){
    const g=mesh.geometry,p=g?.attributes?.position,ix=g?.index;
    if(!enabled||!mesh.isMesh||mesh.isSkinnedMesh||mesh.isInstancedMesh||!p||p.itemSize!==3||p.isInterleavedBufferAttribute||Array.isArray(mesh.material)||mesh.morphTargetInfluences?.length||mesh.raycast!==THREE.Mesh.prototype.raycast||g.groups.length||g.drawRange.start!==0||g.drawRange.count!==Infinity)return null;
    let r=cache.get(g);
    if(r&&r.p===p&&r.ix===ix&&r.pVersion===p.version&&r.iVersion===(ix?.version||0))return r;
    r={p,ix,pVersion:p.version,iVersion:ix?.version||0,cells:new Map(),proxy:new THREE.Mesh(new THREE.BufferGeometry(),mesh.material)};
    const count=ix?.count||p.count;if(count%3)return null;
    for(let j=0;j<count;j+=3){
      const ids=[0,1,2].map(k=>ix?ix.getX(j+k):j+k);
      const xs=ids.map(i=>p.getX(i)),zs=ids.map(i=>p.getZ(i));
      // Expand cell boundaries for edge hits, including negative coordinates.
      const x0=Math.floor((Math.min(...xs)-1e-7)/cellSize),x1=Math.floor((Math.max(...xs)+1e-7)/cellSize),z0=Math.floor((Math.min(...zs)-1e-7)/cellSize),z1=Math.floor((Math.max(...zs)+1e-7)/cellSize);
      if((x1-x0+1)*(z1-z0+1)>16384)return null;
      for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){
        const k=key(x,z);let c=r.cells.get(k);if(!c)r.cells.set(k,c={ids:[],faces:[]});c.ids.push(...ids);c.faces.push(j/3);
      }
    }
    for(const c of r.cells.values())c.index=new THREE.Uint32BufferAttribute(c.ids,1);
    const pg=r.proxy.geometry;for(const [name,attr]of Object.entries(g.attributes))pg.setAttribute(name,attr);
    // The original broad bounds are conservative for every subset.
    if(!g.boundingBox)g.computeBoundingBox();if(!g.boundingSphere)g.computeBoundingSphere();
    pg.boundingBox=g.boundingBox;pg.boundingSphere=g.boundingSphere;
    cache.set(g,r);report.rebuilds++;return r;
  }
  function intersectObjects(raycaster,meshes){
    report.queries++;const hits=[];
    for(const mesh of meshes){
      if(!mesh.layers.test(raycaster.layers))continue;
      const r=record(mesh);
      if(!r){report.fallbackMeshes++;mesh.raycast(raycaster,hits);continue;}
      inverse.copy(mesh.matrixWorld).invert();localRay.copy(raycaster.ray).applyMatrix4(inverse);
      if(Math.abs(localRay.direction.x)>1e-12||Math.abs(localRay.direction.z)>1e-12){report.fallbackMeshes++;mesh.raycast(raycaster,hits);continue;}
      const c=r.cells.get(key(Math.floor(localRay.origin.x/cellSize),Math.floor(localRay.origin.z/cellSize)));
      report.indexedMeshes++;if(!c)continue;
      report.candidateTriangles+=c.faces.length;
      const proxy=r.proxy;proxy.material=mesh.material;proxy.matrixWorld.copy(mesh.matrixWorld);proxy.geometry.index=c.index;
      const start=hits.length;THREE.Mesh.prototype.raycast.call(proxy,raycaster,hits);
      for(let i=start;i<hits.length;i++){hits[i].object=mesh;hits[i].faceIndex=c.faces[hits[i].faceIndex];}
    }
    hits.sort((a,b)=>a.distance-b.distance);return hits;
  }
  return {intersectObjects,report};
}
