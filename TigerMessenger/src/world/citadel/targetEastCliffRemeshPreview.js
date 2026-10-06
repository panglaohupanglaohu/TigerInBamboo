import * as T from 'three';

const hashArray = a => { if (!a) return null; let h=2166136261; for(const b of new Uint8Array(a.buffer,a.byteOffset,a.byteLength)) h=Math.imul(h^b,16777619)>>>0; return h; };
/** Pure measurement of the current geometry epoch; does not recompute bounds or mutate attributes. */
export function inspectEastCliffSourceEpoch({castle,sourceMesh}) {
 castle.updateWorldMatrix(true,false); sourceMesh.updateWorldMatrix(true,false);
 const geometry=sourceMesh.geometry,p=geometry.attributes.position,index=geometry.index;
 const basis=castle.matrixWorld.clone().invert().multiply(sourceMesh.matrixWorld);
 const local=new T.Box3(),chart=new T.Box3(),point=new T.Vector3();
 for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i);local.expandByPoint(point);chart.expandByPoint(point.applyMatrix4(basis));}
 const bounds=box=>({min:box.min.toArray(),max:box.max.toArray()});
 return {position:hashArray(p.array),index:hashArray(index?.array),vertices:p.count,indexCount:index?.count??0,
  triangles:(index?.count??p.count)/3,indexed:!!index,positionType:p.array.constructor.name,indexType:index?.array.constructor.name??null,
  localBounds:bounds(local),castleBounds:bounds(chart),sourceToCastle:basis.toArray(),
  refinement:geometry.userData?.rockRefinement??null,surfaceNormals:geometry.userData?.rockSurfaceNormals??null};
}

/** Read-only preparation: caller attaches returned mesh and explicitly hides
 * the old source. This helper never installs, hides, rebuilds indices or saves. */
export function createEastCliffRemeshPreview({enabled=false,castle,sourceMesh,artifact}={}){
 if(!enabled)return{mesh:null,report:{enabled:false,installed:false},dispose(){}};
 if(!castle?.isObject3D||sourceMesh?.name!=='citadel-oskar-grid-mountain-surface'||!artifact?.geometry||!artifact.origin?.every(Number.isFinite))throw new TypeError('actual castle/source terrain and audited geometry artifact required');
 castle.updateWorldMatrix(true,true);sourceMesh.updateWorldMatrix(true,false);
 const error=Math.max(...castle.matrixWorld.elements.map((n,i)=>Math.abs(n-artifact.castleMatrix[i])));if(!Number.isFinite(error)||error>1e-6)throw new Error('artifact castle frame differs; rebuild candidate before preview');
 const basis=castle.matrixWorld.clone().invert().multiply(sourceMesh.matrixWorld),linear=new T.Matrix3().setFromMatrix4(basis),identity=new T.Matrix3();if(linear.elements.some((v,i)=>Math.abs(v-identity.elements[i])>1e-6))throw new Error('nonaligned source normals/material chart requires explicit transform adaptation');
 if(artifact.sourceHash){
  const measured=inspectEastCliffSourceEpoch({castle,sourceMesh}),expected=artifact.sourceHash;
  if(measured.position!==expected.position||measured.index!==expected.index||measured.vertices!==expected.vertices){
   const diagnostics={expected,measured};
   const mismatch=new Error('source terrain geometry epoch differs; do not apply stale candidate; '+JSON.stringify(diagnostics));
   mismatch.code='EAST_CLIFF_SOURCE_EPOCH_MISMATCH';mismatch.diagnostics=diagnostics;throw mismatch;
  }
 }

 const geometry=new T.BufferGeometryLoader().parse(artifact.geometry);geometry.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count*3).fill(1),3));
 const mesh=new T.Mesh(geometry,sourceMesh.material);mesh.name='citadel-east-cliff-remesh-preview';mesh.position.fromArray(artifact.origin);mesh.castShadow=sourceMesh.castShadow;mesh.receiveShadow=sourceMesh.receiveShadow;mesh.renderOrder=sourceMesh.renderOrder;mesh.onBeforeRender=sourceMesh.onBeforeRender;mesh.userData={...sourceMesh.userData,eastCliffCandidate:true,accepted:false,installed:false};
 let disposed=false;return{mesh,report:{enabled:true,installed:false,sourceName:sourceMesh.name,geometryOrigin:artifact.origin,coordinateSpace:'geometry + origin = castle-local',sharedMaterial:true,rayIndexRebuildRequired:true,vegetationRefreshRequired:true,actorVerified:false,upperStructureVerified:false},dispose(){if(disposed)return;disposed=true;mesh.removeFromParent();geometry.dispose();}};
}
