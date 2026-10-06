import {buildMountainSurfaceIndex} from '../../src/world/citadel/mountainSurfaceIndex.js';

// Read-only geometric silhouette probe. Caller sets the review camera first.
// No render(), camera update, visibility switch or persistent setting writes.
export async function probeCitadelSilhouette(t,castle,{label='',columns=32,pixelStep=2,region=[-90,-55,-50,-25],height=[30,43],yieldWork=async()=>{},maxRays=12000}={}){
 const T=t.THREE,mesh=castle.getObjectByName('citadel-oskar-grid-mountain-surface');
 if(!mesh)throw new Error('Missing named final mountain surface');
 const camera=t.camera.clone(),canvas=t.renderer.domElement,rect=canvas.getBoundingClientRect(),width=rect.width,heightPx=rect.height;
 if(!width||!heightPx)throw new Error('Empty canvas viewport');
 const inverse=castle.matrixWorld.clone().invert(),index=buildMountainSurfaceIndex([mesh]),ray=new T.Raycaster(),ndc=new T.Vector2();
 ray.layers.mask=camera.layers.mask;ray.near=camera.near;ray.far=camera.far;
 const inside=p=>p.x>=region[0]&&p.x<=region[1]&&p.z>=region[2]&&p.z<=region[3]&&p.y>=height[0]&&p.y<=height[1];
 const projected=[];
 for(const x of region.slice(0,2))for(const z of region.slice(2,4))for(const y of height){const p=new T.Vector3(x,y,z).applyMatrix4(castle.matrixWorld).project(camera);if(p.z>=-1&&p.z<=1)projected.push([(p.x+1)*width/2,(1-p.y)*heightPx/2]);}
 if(!projected.length)return {label,status:'region-outside-camera',rows:[]};
 const clamp=T.MathUtils.clamp,x0=clamp(Math.min(...projected.map(p=>p[0]))-2,0,width),x1=clamp(Math.max(...projected.map(p=>p[0]))+2,0,width),y0=clamp(Math.min(...projected.map(p=>p[1]))-4,0,heightPx),y1=clamp(Math.max(...projected.map(p=>p[1]))+2,0,heightPx);
 const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
 const blockers=[];t.scene.traverse(o=>{if(o.isMesh&&o.geometry&&visible(o)&&o.layers.test(camera.layers))blockers.push({mesh:o,box:new T.Box3().setFromObject(o)});});
 let rays=0,rejectedOutside=0;const rows=[];
 function sample(x,y){if(++rays>maxRays)throw new Error('Silhouette ray budget exceeded');ndc.set(x/width*2-1,1-y/heightPx*2);ray.setFromCamera(ndc,camera);const hit=index.sample(ray.ray,ray.near,ray.far);if(!hit)return null;const local=hit.point.clone().applyMatrix4(inverse);if(!inside(local)){rejectedOutside++;return null;}return {hit,local};}
 columns=clamp(Math.floor(columns),2,64);pixelStep=clamp(pixelStep,1,8);
 for(let col=0;col<columns;col++){
  const x=x0+(x1-x0)*(col+.5)/columns,startReject=rejectedOutside;let found=null,y=y0;
  for(;y<=y1;y+=pixelStep){found=sample(x,y);if(found)break;if(rays%100===0)await yieldWork();}
  if(!found){rows.push({column:col,x,status:'no-main-cap-hit',outsideFirstHits:rejectedOutside-startReject});await yieldWork();continue;}
  let lo=Math.max(y0,y-pixelStep),hi=y;
  while(hi-lo>.25){const mid=(lo+hi)/2,h=sample(x,mid);if(h){hi=mid;found=h;}else lo=mid;}
  y=hi;sample(x,y);const hit=found.hit;
  const exact=ray.intersectObject(mesh,false)[0],validationError=exact?Math.abs(exact.distance-hit.distance):null;
  const candidates=blockers.filter(b=>ray.ray.intersectsBox(b.box)).map(b=>b.mesh),oldFar=ray.far;ray.far=hit.distance+.005;
  const hits=ray.intersectObjects(candidates,false);ray.far=oldFar;
  const foreground=hits.filter(h=>{const m=Array.isArray(h.object.material)?h.object.material[h.face?.materialIndex??0]:h.object.material;return m?.visible!==false&&h.distance<hit.distance-.005;}).map(h=>{
   const material=Array.isArray(h.object.material)?h.object.material[h.face?.materialIndex??0]:h.object.material;
   const ambiguous=h.object.isSkinnedMesh||h.object.geometry.morphAttributes?.position?.length||material?.transparent||material?.alphaTest>0||material?.isShaderMaterial||material?.displacementMap||material?.onBeforeCompile!==T.Material.prototype.onBeforeCompile;
   return {name:h.object.name,uuid:h.object.uuid,distance:h.distance,faceIndex:h.faceIndex,instanceId:h.instanceId,ambiguous:!!ambiguous};
  });
  rows.push({column:col,screen:{x,y,canvasClientX:rect.left+x,canvasClientY:rect.top+y,ndc:[x/width*2-1,1-y/heightPx*2]},world:hit.point.toArray(),castleLocal:found.local.toArray(),faceIndex:hit.faceIndex,distance:hit.distance,status:foreground.some(h=>!h.ambiguous)?'opaque-geometry-occluded':foreground.length?'potential-silhouette-ambiguous-foreground':'geometry-visible',foreground:foreground.slice(0,8),foregroundCount:foreground.length,originalRayValidationError:validationError,originalRayFace:exact?.faceIndex??null,outsideFirstHits:rejectedOutside-startReject});
  await yieldWork();
 }
 return {label,status:'completed',at:new Date().toISOString(),region,height,window:{x0,x1,y0,y1,width,height:heightPx},camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),projection:camera.projectionMatrix.toArray()},rays,rejectedOutside,rows,index:index.stats,limitations:'CPU geometric first-cap scan only; alpha maps, shader displacement, clipping and animated GPU geometry not reproduced. Transparent/custom shader foreground is ambiguous. Scene may animate while yielding; camera is snapshotted. Narrow features below scan step may be missed. Not a GPU pixel silhouette.'};
}
