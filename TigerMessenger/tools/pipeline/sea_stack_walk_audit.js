// Review-only measurement of authored pedestrian surfaces. This does not
// change collision data or infer global route connectivity.
export function auditWalkableProtection(game,rocks){
 const T=game.THREE,point=new T.Vector3(),local=new T.Vector3();
 const obstacles=rocks.map(rock=>{rock.geometry.computeBoundingBox();return {seed:rock.geometry.userData.terraces.seed,inverse:rock.matrixWorld.clone().invert(),box:rock.geometry.boundingBox,radius:rock.geometry.userData.terraces.footprintRadius+1};});
 const meshes=[];game.scene.traverse(o=>{if(o.isMesh&&o.geometry?.attributes.position&&(o.userData.gateWalkable===true||o.userData.walkSurface===true||o.userData.westCityWalkable===true))meshes.push(o);});
 let hash=2166136261,vertices=0,probes=0,minimumMargin=Infinity;const conflicts=[];
 const feed=text=>{for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);};
 function sample(world,name){probes++;for(const o of obstacles){local.copy(world).applyMatrix4(o.inverse);if(local.y<o.box.min.y-1||local.y>o.box.max.y+4)continue;const margin=Math.hypot(local.x,local.z)-o.radius;minimumMargin=Math.min(minimumMargin,margin);if(margin<0&&conflicts.length<30)conflicts.push({name,seed:o.seed,margin,world:world.toArray()});}}
 for(const mesh of meshes){
  const p=mesh.geometry.attributes.position,idx=mesh.geometry.index;feed(mesh.name+':'+p.count+':'+(idx?.count??0));
  for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);vertices++;feed(point.toArray().map(v=>Math.round(v*1e5)).join(','));sample(point,mesh.name);}
  for(let i=0;i<(idx?.count??p.count);i+=3){const center=new T.Vector3();for(let j=0;j<3;j++)center.add(point.fromBufferAttribute(p,idx?idx.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld));sample(center.multiplyScalar(1/3),mesh.name);}
 }
 return {meshCount:meshes.length,vertices,worldVertexHash:(hash>>>0).toString(16),probes,minimumEnvelopeMargin:Number.isFinite(minimumMargin)?minimumMargin:null,potentialConflicts:conflicts,clear:meshes.length>0&&conflicts.length===0,method:'Tagged pedestrian-mesh vertices and triangle centroids against conservative fixed-axis rock cylinders with 1 m lateral margin and 4 m headroom. Not continuous collision or path-connectivity proof; compare vertex hash with legacy for fixed-boundary evidence.'};
}
