import * as THREE from 'three';
import source from '../assets/warshipV6Data.js';

// Read exact saved Blender primitives: rendered static meshes are merged by
// material and dynamic ones instanced, so names on the render batches cannot
// distinguish a deck from a passenger, cargo or rail.
const supportId=id=>id==='add:bow-landing'||id==='add:bow-hinge-lip'||/^add:(?:deck|boarding)-plank-/.test(id||'');
let savedGeometry;
function geometry(){
 if(savedGeometry)return savedGeometry;
 const bytes=Uint8Array.from(atob(source.binary),c=>c.charCodeAt(0));
 const types={5121:Uint8Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
 function attr(id,size){const a=source.accessors[id],v=source.bufferViews[a.bufferView],C=types[a.componentType];if(a.sparse||v.byteStride&&v.byteStride!==size*C.BYTES_PER_ELEMENT)throw Error('Unsupported saved support accessor');return new THREE.BufferAttribute(new C(bytes.buffer,(v.byteOffset||0)+(a.byteOffset||0),a.count*size),size,!!a.normalized);}
 savedGeometry=source.nodes.filter(n=>n.mesh!==undefined).flatMap(n=>source.meshes[n.mesh].primitives.map(p=>{const g=new THREE.BufferGeometry();g.setAttribute('position',attr(p.attributes.POSITION,3));if(p.indices!==undefined)g.setIndex(attr(p.indices,1));g.computeBoundingBox();return {id:n.sourceId,g};}));return savedGeometry;
}
function visible(node){for(let n=node;n;n=n.parent)if(!n.visible)return false;return true;}

export function createWarshipBoardingSupport(boat){
 boat.updateWorldMatrix(true,true);
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),surfaces=[];
 for(const {id,g} of geometry()){if(!supportId(id))continue;const node=boat.userData.warshipV6?.nodes.get(id);if(!node||!visible(node))continue;const mesh=new THREE.Mesh(g,material);mesh.name=id;mesh.matrixAutoUpdate=false;mesh.matrixWorld.copy(node.matrixWorld);surfaces.push(mesh);}
 return {surfaces,dispose:()=>material.dispose()};
}

/** Conservative body/equipment OBB from the actual selected actor vertices.
 * Uses actual saved boat triangles, not material-batch AABBs. A rejection may
 * require a more detailed pose test; a pass covers this measured pose only.
 */
export function createWarshipBoardingBodyCheck(boat,actor){
 boat.updateWorldMatrix(true,true);actor.updateWorldMatrix(true,true);
 const inverse=actor.matrixWorld.clone().invert(),box=new THREE.Box3(),v=new THREE.Vector3();
 actor.traverse(o=>{if(!o.isMesh||!visible(o)||!o.geometry?.attributes.position||o.userData.isOutline)return;const p=o.geometry.attributes.position;for(let instance=0;instance<(o.isInstancedMesh?o.count:1);instance++){const m=inverse.clone().multiply(o.matrixWorld);if(o.isInstancedMesh){const im=new THREE.Matrix4();o.getMatrixAt(instance,im);if(Math.abs(im.determinant())<1e-12)continue;m.multiply(im);}for(let i=0;i<p.count;i++)box.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(m));}});
 const scale=new THREE.Vector3().setFromMatrixScale(actor.matrixWorld),footY=box.min.y;box.min.y+=.04/scale.y;
 const obstacles=geometry().filter(p=>!supportId(p.id)).map(p=>({...p,node:boat.userData.warshipV6.nodes.get(p.id)})).filter(p=>p.node&&visible(p.node)).map(p=>({...p,box:p.g.boundingBox.clone().applyMatrix4(p.node.matrixWorld)}));
 let failure=null;const tri=new THREE.Triangle();
 function clear(a,b){
  if(box.isEmpty()){failure={reason:'missing-actor-geometry'};return false;}
  const up=a.clone().add(b).normalize(),forward=b.clone().sub(a).projectOnPlane(up);if(forward.lengthSq()<1e-10)forward.set(0,0,1).transformDirection(boat.matrixWorld).projectOnPlane(up);forward.normalize();const right=forward.clone().cross(up).normalize();
  const m=new THREE.Matrix4().makeBasis(forward,up,right).scale(scale).setPosition(a.clone().add(b).multiplyScalar(.5).addScaledVector(up,-footY*scale.y+.015)),inv=m.clone().invert();
  const swept=box.clone();swept.min.x-=a.distanceTo(b)/(2*scale.x);swept.max.x+=a.distanceTo(b)/(2*scale.x);const worldBox=swept.clone().applyMatrix4(m);
  for(const o of obstacles){if(!worldBox.intersectsBox(o.box))continue;const transform=inv.clone().multiply(o.node.matrixWorld),p=o.g.attributes.position,index=o.g.index;for(let i=0;i<(index?index.count:p.count);i+=3){tri.a.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(transform);tri.b.fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(transform);tri.c.fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(transform);if(swept.intersectsTriangle(tri)){failure={reason:'actual-actor-box-intersects-boat-triangle',obstacle:o.id,actorUid:actor.userData.uid,from:a.toArray(),to:b.toArray()};return false;}}}
  return true;
 }
 return {clear,diagnostics:()=>({actorUid:actor.userData.uid,localBounds:{min:box.min.toArray(),max:box.max.toArray()},scale:scale.toArray(),failure,scope:'Conservative actual actor/equipment bounds versus actual saved boat triangles; this pose only. Does not validate assisted animation or full swing sweep.'})};
}

/** Planning snapshot only, never hides/moves actors or grants boarding.
 * clearSegment must measure the real selected actor (including a carried
 * patient) against obstacles. Omitting it returns a blocked support candidate.
 * Caller must reject stale boat/shore transforms before executing this path.
 */
export function buildSaihojiBoardingRoute({boat,dock,shoreSurfaces=[],deckNodeId='add:bow-landing',footHalfWidth=.14,clearSegment=null,extraSupport=[]}={}){
 const blocked=(reason,detail={})=>({valid:false,reason,...detail});
 if(!boat||!dock?.valid)return blocked('missing-verified-dock');
 const api=boat.userData.warshipV6;
 if(!api||api.sha256!==source.sourceSHA256)return blocked('unsupported-boat-source');
 const hinge=api.nodes.get('add:boarding-hinge'),foot=api.nodes.get('add:boarding-foot'),deck=api.nodes.get(deckNodeId);
 if(!hinge||!foot||!deck||!supportId(deckNodeId))return blocked('missing-authored-support-anchor');
 boat.updateWorldMatrix(true,true);
 if(boat.position.distanceTo(dock.position)>.025||boat.quaternion.angleTo(dock.quaternion)>.005)return blocked('boat-not-at-verified-dock');
 const up=new THREE.Vector3(0,1,0).transformDirection(boat.matrixWorld),right=new THREE.Vector3(1,0,0).transformDirection(hinge.matrixWorld);
 const end=foot.getWorldPosition(new THREE.Vector3());
 if(end.distanceTo(dock.shorePoint)>.12)return blocked('board-not-deployed-to-shore',{distance:end.distanceTo(dock.shorePoint)});
 const width=api.boardingContract.width*new THREE.Vector3().setFromMatrixScale(hinge.matrixWorld).x;
 if(!Number.isFinite(footHalfWidth)||footHalfWidth<=0||footHalfWidth*2>width-.04)return blocked('single-file-footprint-too-wide',{availableWidth:width,requestedWidth:footHalfWidth*2});
 const {surfaces,dispose}=createWarshipBoardingSupport(boat);
 for(const mesh of extraSupport){let a=mesh;while(a&&a!==boat)a=a.parent;if(a===boat&&mesh.isMesh&&mesh.userData.walkableShipSupport===true&&visible(mesh)){mesh.updateWorldMatrix(true,false);surfaces.push(mesh);}}
 const ray=new THREE.Raycaster();ray.layers.enableAll();ray.far=.7;
 function sample(point,meshes){ray.set(point.clone().addScaledVector(up,.35),up.clone().negate());const h=ray.intersectObjects(meshes,false).find(h=>visible(h.object)&&h.face&&h.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(h.object.matrixWorld)).normalize().dot(up)>.7);return h?.point.clone()||null;}
 const shore=sample(dock.shorePoint,shoreSurfaces);
 if(!shore){dispose();return blocked('missing-real-shore-support');}
 // Reuse the authored citadel boarding aisle, verified again against the
 // current saved primitives. The bow landing centroid points into the prow.
 const head=hinge.getWorldPosition(new THREE.Vector3()),localHinge=boat.worldToLocal(head.clone());
 const aisleLocal=[new THREE.Vector3(localHinge.x,.664,localHinge.z-.08),new THREE.Vector3(localHinge.x,.664,.36),new THREE.Vector3(1,.664,.36)];
 const aisle=[];
 for(const local of aisleLocal){const measured=sample(boat.localToWorld(local.clone()),surfaces);if(!measured){dispose();return blocked('missing-authored-aisle-support',{local:local.toArray()});}aisle.push(measured);}
 const anchors=[end,head,...aisle],points=[shore],evidence=[];
 for(let leg=0;leg<anchors.length-1;leg++){
  const a=anchors[leg],b=anchors[leg+1],count=Math.max(1,Math.ceil(a.distanceTo(b)/.04));
  for(let i=0;i<=count;i++){
   const desired=a.clone().lerp(b,i/count),hit=sample(desired,surfaces);
   // Tiny authored plank seams may lie between two measured footfalls;
   // never synthesize a floor point inside the seam. Larger gaps fail closed.
   if(!hit&&desired.distanceTo(points[points.length-1])<=.055)continue;
   if(!hit){
    let nextSupport=null;for(let j=i+1;j<=count;j++){const probe=sample(a.clone().lerp(b,j/count),surfaces);if(probe){nextSupport=probe;break;}}
    const inverse=boat.matrixWorld.clone().invert(),bounds=surfaces.filter(m=>/bow-|boarding-plank-(0|8)$/.test(m.name)).map(m=>({id:m.name,bounds:m.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,m.matrixWorld))}));
    const previous=points[points.length-1];dispose();return blocked('missing-board-or-deck-support',{leg,sample:i,point:desired.toArray(),partialPoints:points.map(p=>p.toArray()),gap:nextSupport?{from:previous.toArray(),to:nextSupport.toArray(),boatLocalFrom:previous.clone().applyMatrix4(inverse).toArray(),boatLocalTo:nextSupport.clone().applyMatrix4(inverse).toArray(),distance:previous.distanceTo(nextSupport),height:nextSupport.clone().sub(previous).dot(up)}:null,supportBoundsBoatLocal:bounds});
   }
   const laneRight=leg===0?right:b.clone().sub(a).cross(up).normalize();
   for(const side of [-1,1])if(!sample(hit.clone().addScaledVector(laneRight,side*footHalfWidth),surfaces)){dispose();return blocked('unsupported-footprint-edge',{leg,sample:i,point:hit.toArray()});}
   const previous=points[points.length-1],step=Math.abs(hit.clone().sub(previous).dot(up));
   if(step>.18||hit.distanceTo(previous)>.22){dispose();return blocked('support-seam-gap',{leg,sample:i,step,distance:hit.distanceTo(previous)});}
   if(clearSegment&&!clearSegment(previous,hit)){dispose();return blocked('actor-body-or-equipment-obstructed',{leg,sample:i});}
   points.push(hit);evidence.push({leg,sample:i});
  }
 }
 dispose();
 const snapshot={boatMatrix:boat.matrixWorld.toArray(),hingeMatrix:hinge.matrixWorld.toArray(),shoreMatrices:shoreSurfaces.map(m=>m.matrixWorld.toArray()),sourceSHA256:api.sha256};
 return {valid:!!clearSegment,reason:clearSegment?null:'actor-clearance-unverified',supported:true,points,length:points.slice(1).reduce((s,p,i)=>s+p.distanceTo(points[i]),0),availableWidth:width,singleFile:true,snapshot,evidence,scope:'Measured shore-to-board-to-original-central-aisle support only; not a seat route, stationarity proof, assisted animation or boarding authorization.'};
}
