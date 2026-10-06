import * as T from 'three';
import {CITADEL_TARGET_PALETTE} from './targetLandscapePalette.js';
import {buildMountainSurfaceIndex} from './mountainSurfaceIndex.js';
import {clipTurfTriangle,refineTurfTriangle,turfEdgeKey,turfVertexKey} from './mountainTurfGeometry.js';
const active=new WeakMap();
/** Two bounded Jacobi rounds on a shared scalar graph; never moves vertices. */
export function smoothBenchSlope(values,neighbours,{passes=2,strength=.4,maxChange=.12}={}){
 if(!Array.isArray(values)||values.some(v=>!Number.isFinite(v))||neighbours.length!==values.length||!Number.isInteger(passes)||passes<0||passes>2)throw new TypeError('finite slope graph and zero to two passes required');
 let current=[...values];for(let p=0;p<passes;p++){const next=current.map((v,i)=>{const ns=[...neighbours[i]];if(!ns.length)return v;const mean=ns.reduce((sum,j)=>sum+current[j],0)/ns.length;return Math.max(values[i]-maxChange,Math.min(values[i]+maxChange,v+(mean-v)*strength));});current=next;}return current;
}
/** Final-face overlay only. Shared scalar clipping is project code, not a claim
 * to reconstruct Oskar's private shaders. All points remain on source triangles. */
export function createTargetBenchTurf({castle,surfaces,sampleSea,exclusions=[],maxTriangles=120000}={}){
 if(!castle?.isObject3D||!Array.isArray(surfaces)||!surfaces.length||typeof sampleSea!=='function')throw new TypeError('final surfaces, castle and actual sea sampler required');
 if(!Number.isInteger(maxTriangles)||maxTriangles<1||maxTriangles>120000)throw new RangeError('triangle budget must be 1..120000');
 if(!Array.isArray(exclusions)||exclusions.some(e=>!Array.isArray(e.polygon)||e.polygon.length<3||e.polygon.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))||![e.minY,e.maxY].every(Number.isFinite)||e.minY>=e.maxY))throw new TypeError('finite convex exclusion regions required');
 if(active.has(castle))return active.get(castle);
 const started=performance.now(),report={version:'target-bench-turf-4-smoothed-shared-slope',accepted:false,visualReviewed:false,terrainChanged:false,drawCalls:0,triangles:0,sourceFaces:0,seaMissing:0,hiddenFaceRejects:0,verticalRejects:0,splitEdges:0,maxTriangles,method:'shared area-weighted castle-Y slope with bounded two-round scalar smoothing, face-interior clipping, source barycentric support; final first-hit filtering'};
 const group=new T.Group();group.name='target-continuous-bench-turf';group.userData.preserveCitadelMaterials=true;
 castle.updateWorldMatrix(true,true);const inverse=castle.matrixWorld.clone().invert(),frame=castle.matrixWorld.clone(),down=new T.Vector3(0,-1,0).transformDirection(frame),index=buildMountainSurfaceIndex(surfaces),ray=new T.Ray(),faces=[],vertices=new Map();
 for(const[meshIndex,m]of surfaces.entries()){m.updateWorldMatrix(true,false);const mat=inverse.clone().multiply(m.matrixWorld),p=m.geometry.attributes.position,ix=m.geometry.index;for(let f=0,n=ix?ix.count:p.count;f<n;f+=3){const pts=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,ix?ix.getX(f+k):f+k).applyMatrix4(mat)),tri=new T.Triangle(...pts),normal=tri.getNormal(new T.Vector3()),area=tri.getArea();if(area<1e-9)continue;const keys=pts.map(turfVertexKey);for(let k=0;k<3;k++){let v=vertices.get(keys[k]);if(!v){v={point:pts[k],weight:0,sum:0,neighbours:new Set()};vertices.set(keys[k],v);}v.weight+=area;v.sum+=Math.abs(normal.y)*area;v.neighbours.add(keys[(k+1)%3]);v.neighbours.add(keys[(k+2)%3]);}faces.push({tri,keys,slope:Math.abs(normal.y),meshIndex,face:f/3});}}
 const entries=[...vertices.values()],ids=new Map([...vertices.keys()].map((k,i)=>[k,i])),raw=entries.map(v=>v.sum/v.weight),adj=entries.map(v=>[...v.neighbours].map(k=>ids.get(k))),smoothed=smoothBenchSlope(raw,adj);
 const variation=values=>{let sum=0,n=0;adj.forEach((ns,i)=>ns.forEach(j=>{if(j>i){sum+=Math.abs(values[i]-values[j]);n++;}}));return{meanAbsoluteDifference:n?sum/n:0,edges:n};};
 entries.forEach((v,i)=>v.slope=smoothed[i]);report.slopeSmoothing={passes:2,strength:.4,maxChange:.12,before:variation(raw),after:variation(smoothed),maximumChange:raw.reduce((max,v,i)=>Math.max(max,Math.abs(v-smoothed[i])),0),positionsChanged:false};
 report.sourceFaces=faces.length;const scalarCache=new Map();
 function scalar(p,slope){const key=turfVertexKey(p);if(scalarCache.has(key))return scalarCache.get(key);const raw=sampleSea(p.x,p.z),sea=typeof raw==='number'?raw:raw?.height;if(!Number.isFinite(sea)){report.seaMissing++;scalarCache.set(key,null);return null;}
  const organic=.045*Math.sin(p.x*.31+Math.sin(p.z*.19))+.025*Math.cos(p.z*.37-p.x*.13),value=Math.min((slope-.64)+organic,(p.y-sea-1.6)*.15);scalarCache.set(key,value);return value;}
 for(const v of vertices.values())v.value=scalar(v.point,v.slope);
 function pointScore(f,p){const bary=f.tri.getBarycoord(p,new T.Vector3()),slope=bary.x*vertices.get(f.keys[0]).slope+bary.y*vertices.get(f.keys[1]).slope+bary.z*vertices.get(f.keys[2]).slope;return scalar(p,slope);}
 let work=faces.filter(f=>{if(f.slope<.2){report.verticalRejects++;return false;}return !f.keys.some(k=>vertices.get(k).value===null);}).map(f=>({f,tri:f.tri}));
 // Refine a narrow contour band in two shared-edge passes. Neighbouring source
 // faces consume the same midpoint registry, keeping the edge watertight.
 report.refinementPasses=[];
 for(let pass=0;pass<2;pass++){
  const splits=new Set();for(const {f,tri}of work){const vs=[tri.a,tri.b,tri.c],values=vs.map(p=>pointScore(f,p));const band=pass===0?.025:0;if(values.some(v=>v===null)||Math.min(...values)>band||Math.max(...values)<-band)continue;for(let k=0;k<3;k++)if((values[k]*values[(k+1)%3]<=0||pass===0&&Math.min(Math.abs(values[k]),Math.abs(values[(k+1)%3]))<.025)&&vs[k].distanceTo(vs[(k+1)%3])>.65)splits.add(turfEdgeKey(vs[k],vs[(k+1)%3]));}
  report.splitEdges+=splits.size;report.refinementPasses.push({pass,splitEdges:splits.size});if(!splits.size)break;work=work.flatMap(({f,tri})=>refineTurfTriangle(tri,splits).map(child=>({f,tri:child})));
 }
 const refined=new Map();for(const {f,tri}of work){if(!refined.has(f))refined.set(f,[]);refined.get(f).push(tri);}
 const positions=[],colors=[],sourceFaces=[],sourceMeshes=[],sourceIds=surfaces.map(m=>({uuid:m.uuid,name:m.name,geometry:m.geometry.uuid,positionVersion:m.geometry.attributes.position.version}));
 // This overlay replaces the legacy groundcover; use the same target palette
 // instead of silently restoring the former yellow-olive colours at runtime.
 const turfLow=new T.Color(CITADEL_TARGET_PALETTE.grassShade),turfHigh=new T.Color(CITADEL_TARGET_PALETTE.grass),turfColour=new T.Color();
 report.palette={low:CITADEL_TARGET_PALETTE.grassShade,high:CITADEL_TARGET_PALETTE.grass,reference:'exec-619c6b01-8d79-4ceb-833a-88da7eaf51c8.png'};
 function visibleTop(tri){const c=tri.getMidpoint(new T.Vector3()),origin=c.clone();origin.y+=300;ray.set(origin.applyMatrix4(frame),down);const hit=index.sample(ray,0,650);return hit&&Math.abs(hit.point.clone().applyMatrix4(inverse).y-c.y)<=.025;}
 // Subtract each actual paving prism from the already clipped grass polygon.
 // Plane clipping keeps all new points on the same source triangle, including
 // exclusions wholly contained inside a large triangle (no vertex-only mask).
 const planes=exclusions.map(e=>[p=>p.y-e.minY,p=>e.maxY-p.y,...e.polygon.map((a,i)=>{const b=e.polygon[(i+1)%e.polygon.length];return p=>(b[0]-a[0])*(p.z-a[1])-(b[1]-a[1])*(p.x-a[0]);})]);
 function side(poly,distance,positive){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],u=distance(a),v=distance(b),keep=positive?u>=0:u<=0;if(keep)out.push(a);if(u*v<0)out.push(a.clone().lerp(b,u/(u-v)));}return out;}
 function exclude(piece){let result=[[piece.a,piece.b,piece.c]];for(const region of planes){const next=[];for(const poly of result){let inside=poly;for(const plane of region){if(inside.length<3)break;const outside=side(inside,plane,false);if(outside.length>=3)next.push(outside);inside=side(inside,plane,true);}}result=next;}return result.flatMap(poly=>poly.slice(1,-1).map((p,i)=>new T.Triangle(poly[0],p,poly[i+2]))).filter(t=>t.getArea()>1e-10);}
 let exceeded=false;
 for(const f of faces){if(f.slope<.2||f.keys.some(k=>vertices.get(k).value===null))continue;const values=f.keys.map(k=>vertices.get(k).value);if(Math.max(...values)<-.12)continue;
  for(const tri of refined.get(f)||[]){
   const vs=[tri.a,tri.b,tri.c],scores=vs.map(p=>{const bary=f.tri.getBarycoord(p,new T.Vector3()),slope=bary.x*vertices.get(f.keys[0]).slope+bary.y*vertices.get(f.keys[1]).slope+bary.z*vertices.get(f.keys[2]).slope;return scalar(p,slope);});if(scores.some(v=>v===null))continue;
   for(const piece of clipTurfTriangle(tri,scores).flatMap(exclude)){if(!visibleTop(piece)){report.hiddenFaceRejects++;continue;}if(positions.length/9>=maxTriangles){exceeded=true;break;}const n=piece.getNormal(new T.Vector3()),pts=n.y<0?[piece.a,piece.c,piece.b]:[piece.a,piece.b,piece.c];for(const p of pts){positions.push(...p.toArray());const t=.5+.25*Math.sin(p.x*.035+p.z*.022)+.15*Math.cos(p.z*.047),colour=turfColour.copy(turfLow).lerp(turfHigh,Math.max(0,Math.min(1,t)));colors.push(colour.r,colour.g,colour.b);sourceFaces.push(f.face);sourceMeshes.push(f.meshIndex);}}if(exceeded)break;
  }if(exceeded)break;
 }
 if(exceeded){report.reason='triangle-budget-exceeded';report.buildMs=performance.now()-started;return{group,report,dispose(){group.removeFromParent();}};}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('sourceFace',new T.Uint32BufferAttribute(sourceFaces,1));g.setAttribute('sourceMesh',new T.Uint16BufferAttribute(sourceMeshes,1));g.computeVertexNormals();
 const material=new T.MeshStandardMaterial({vertexColors:true,roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2});material.userData.preserveCitadelMaterial=true;const mesh=new T.Mesh(g,material);mesh.name='target-bench-turf-surface';mesh.receiveShadow=true;Object.assign(mesh.userData,{skipColliders:true,skipInkOutline:true,preserveCitadelMaterials:true});group.add(mesh);
 const hidden=[];if(positions.length)castle.traverse(o=>{if(/^(citadel-study-groundcover|citadel-study-meadow-grass)$/.test(o.name)){hidden.push({object:o,visible:o.visible});o.visible=false;}});
 report.exclusions=exclusions;report.triangles=positions.length/9;report.built=positions.length>0;report.drawCalls=positions.length?1:0;report.sources=sourceIds;report.hiddenLegacy=hidden.map(v=>({uuid:v.object.uuid,name:v.object.name,wasVisible:v.visible}));report.buildMs=performance.now()-started;
 let disposed=false;const handle={group,report,dispose(){if(disposed)return;disposed=true;group.removeFromParent();g.dispose();material.dispose();for(const h of hidden)h.object.visible=h.visible;active.delete(castle);}};active.set(castle,handle);return handle;
}
