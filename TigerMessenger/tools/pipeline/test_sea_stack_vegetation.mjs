// Independent final-geometry measurements. No browser, renderer, or trust in
// vegetationAudit metadata. Every error below is measured from final triangles.
import assert from 'node:assert/strict';
import {register} from 'node:module';
import {createHash} from 'node:crypto';
const threeUrl=new URL('../../vendor/three.module.js',import.meta.url).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(threeUrl)},shortCircuit:true};return n(s,c);}`),import.meta.url);
const T=await import('three');
const {coastalStackGeometry}=await import('../../src/world/seaStackCoastalGeometry.js');
const {prepareSeaStackSurface}=await import('../../src/world/seaStackLighting.js');
const {plantSeaStackTerraces}=await import('../../src/world/seaStackVegetation.js');
globalThis.location={search:''};
const EPS=6e-5,issues=[],results=[];
const digest=rock=>{const h=createHash('sha256');for(const obj of [rock,...rock.children]){h.update(obj.name);for(const a of [obj.geometry?.attributes.position?.array,obj.instanceMatrix?.array,obj.instanceColor?.array])if(a)h.update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));h.update(JSON.stringify(obj.userData.roots||[]));}return h.digest('hex');};
function build(seed,radius,height){const scene=new T.Scene(),rock=new T.Mesh(coastalStackGeometry(radius,height,seed),new T.MeshBasicMaterial());rock.userData.seaStack={height,radius};scene.add(rock);prepareSeaStackSurface(rock,scene);plantSeaStackTerraces(rock);rock.updateMatrixWorld(true);return {scene,rock};}
function makeFaces(g){const p=g.attributes.position,idx=g.index,faces=[],bins=new Map(),step=1.2;
 for(let i=0;i<idx.count;i+=3){const ids=[0,1,2].map(j=>idx.getX(i+j)),tri=new T.Triangle(...ids.map(j=>new T.Vector3().fromBufferAttribute(p,j))),n=tri.getNormal(new T.Vector3()),face={id:i/3,ids,tri,n};faces.push(face);
  const minX=Math.min(tri.a.x,tri.b.x,tri.c.x),maxX=Math.max(tri.a.x,tri.b.x,tri.c.x),minZ=Math.min(tri.a.z,tri.b.z,tri.c.z),maxZ=Math.max(tri.a.z,tri.b.z,tri.c.z);
  for(let x=Math.floor((minX-.08)/step);x<=Math.floor((maxX+.08)/step);x++)for(let z=Math.floor((minZ-.08)/step);z<=Math.floor((maxZ+.08)/step);z++){const k=x+':'+z;if(!bins.has(k))bins.set(k,[]);bins.get(k).push(face);}
 }return {faces,at:p=>bins.get(Math.floor(p.x/step)+':'+Math.floor(p.z/step))||[]};}
// Independent indexed-edge flood fill and explicit boundary segments. It does
// not import or call the production habitat helper or its spatial hash.
function independentHabitat(grid){
 const accepted=grid.faces.filter(f=>f.n.y>=.70&&f.tri.getArea()>=1e-10),edgeFaces=new Map(),components=new Int32Array(grid.faces.length).fill(-1),adj=new Map();
 for(const f of accepted){adj.set(f.id,[]);for(let j=0;j<3;j++){const a=f.ids[j],b=f.ids[(j+1)%3],key=a<b?a+':'+b:b+':'+a;if(!edgeFaces.has(key))edgeFaces.set(key,[]);edgeFaces.get(key).push({face:f.id,a:[f.tri.a,f.tri.b,f.tri.c][j],b:[f.tri.a,f.tri.b,f.tri.c][(j+1)%3]});}}
 for(const list of edgeFaces.values())for(const a of list)for(const b of list)if(a.face!==b.face)adj.get(a.face).push(b.face);
 const boundaries=[];for(const f of accepted)if(components[f.id]<0){const id=boundaries.length,queue=[f.id];boundaries.push([]);components[f.id]=id;for(let k=0;k<queue.length;k++)for(const next of adj.get(queue[k]))if(components[next]<0){components[next]=id;queue.push(next);}}
 for(const list of edgeFaces.values())if(list.length===1){const e=list[0];boundaries[components[e.face]].push(e);}
 function distance(p,face){const id=components[face];if(id<0)return 0;let best=Infinity;for(const {a,b}of boundaries[id]){const x=b.x-a.x,y=b.y-a.y,z=b.z-a.z,den=x*x+y*y+z*z,t=Math.max(0,Math.min(1,((p.x-a.x)*x+(p.y-a.y)*y+(p.z-a.z)*z)/den));best=Math.min(best,(p.x-a.x-x*t)**2+(p.y-a.y-y*t)**2+(p.z-a.z-z*t)**2);}return Math.sqrt(best);}
 return {components,boundaries,distance};
}
const bary=new T.Vector3(),intersection=new T.Vector3(),ray=new T.Ray();
function abovePlaneArea(tri,y){
 const vs=[tri.a,tri.b,tri.c],out=[];
 for(let i=0;i<3;i++){const a=vs[i],b=vs[(i+1)%3];if(a.y>=y)out.push(a);if((a.y>=y)!==(b.y>=y))out.push(a.clone().lerp(b,(y-a.y)/(b.y-a.y)));}
 let area=0;for(let i=1;i+1<out.length;i++)area+=new T.Triangle(out[0],out[i],out[i+1]).getArea();return area;
}
function cast(grid,p,direction,distance=.12){ray.origin.copy(p).addScaledVector(direction,-distance);ray.direction.copy(direction);let best=null;
 for(const f of grid.at(p)){const hit=ray.intersectTriangle(f.tri.a,f.tri.b,f.tri.c,false,intersection);if(!hit)continue;const error=hit.distanceTo(p);if(error<distance*1.1&&(!best||error<best.error))best={face:f,error,point:hit.clone()};}return best;}
function inside(f,p){
 f.tri.getBarycoord(p,bary);if(Math.min(bary.x,bary.y,bary.z)>=0)return true;
 // EPS is a world-space distance. On a skinny triangle, a tiny Float32
 // displacement can have a large dimensionless negative barycentric weight.
 return f.tri.closestPointToPoint(p,new T.Vector3()).distanceTo(p)<=EPS;
}
const approved=Array.from({length:8},(_,index)=>{const i=index%7;return {seed:index<7?i:10,radius:(12+(i%3)*4)*.68,height:28+(i*13%28)};});
for(const {seed,radius,height}of approved){
 const {rock}=build(seed,radius,height),{rock:repeat}=build(seed,radius,height),grid=makeFaces(rock.geometry),turf=rock.getObjectByName('sea-stack-terrace-turf'),grass=rock.getObjectByName('sea-stack-coastal-grass'),shrubs=rock.getObjectByName('sea-stack-terrace-shrubs');
 const habitat=independentHabitat(grid),habitatCut=turf.userData.planting.habitatCut,INSET=.40;
 const field=v=>Math.sin(v.x*.47+seed*1.7)+.72*Math.cos(v.z*.54-seed)+.38*Math.sin((v.x+v.z)*.72)+.16*Math.sin(v.x*1.1+Math.cos(v.z*.8))-habitatCut;
 const habitatSettings=turf.userData.planting.habitat,conservativeBand=2*habitatSettings.boundaryRefineRadius+habitatSettings.safetyMargin;assert(habitatSettings.boundaryRefineRadius<=.01);assert(conservativeBand<=.02001+EPS);
 const offsetVector=turf.userData.planting.turfOffset;assert.equal(offsetVector[0],0);assert.equal(offsetVector[2],0);const OFFSET=offsetVector[1];assert(OFFSET>0&&OFFSET<=.03);
 const report={seed,offsetVector,habitatInset:INSET,conservativeBoundaryBand:conservativeBand,habitatComponentsMeasured:habitat.boundaries.length,habitatBoundaryEdgesMeasured:habitat.boundaries.reduce((sum,b)=>sum+b.length,0),radius,height,geometryRevision:rock.userData.coastalSurface.revision,grassRoots:grass.count,shrubRoots:shrubs.count,turfTriangles:turf.geometry.attributes.position.count/3,turfArea:0,minSupportNormalY:1,areaWeightedSupportNormalY:0,supportSlopeAreas:{'0.4-0.6':0,'0.6-0.78':0,'0.78-0.9':0,'0.9-1':0},eligibleRockArea:grid.faces.filter(f=>f.n.y>=.40).reduce((a,f)=>a+abovePlaneArea(f.tri,-height*.24),0),rootRayMisses:0,rootMaxSurfaceError:grass.count+shrubs.count?0:null,grassInstanceOffsetMaxError:0,realGrassBaseSamples:grass.count*10,realGrassBaseMaxContactError:0,realGrassBaseMinBoundaryDistance:Infinity,realGrassBaseSignedDistanceRange:[Infinity,-Infinity],shrubInstanceOffsetMaxError:0,realScrubRootSamples:shrubs.count,realScrubRootMaxContactError:0,realScrubRootMinBoundaryDistance:Infinity,realScrubRootSignedDistanceRange:[Infinity,-Infinity],unsupportedTurfTriangles:0,unsupportedTurfVertices:0,turfOffsetMaxError:0,turfOverheadPenetrationSamples:0,turfOverheadExamples:[],smoothNormalExamples:[],turfNormalDistanceMax:0,turfSupportMaxPlaneError:0,turfSupportMaxDistance:0,sourceFaceNormalDisagreement:0,smoothNormalMaxError:0,minimumHabitatMargin:1,habitatUnsupportedVertices:0,rootHabitatViolations:0,rootMinBoundaryDistance:Infinity,turfMaxInsetDeficit:0,visibleMaxInsetDeficit:0,visibleInsetViolationSamples:0,insetExamples:[],crossFaceMatchedEdges:0,sharedEdgeMaxGap:0,degenerateTurfTriangles:0,rawTriangleBoundaryEdges:0,internalUncoveredBoundaryProbes:0,elevationThresholdBoundaryProbes:0,conservativeBandBoundaryProbes:0,faceNormalThresholdBoundaries:0,normalThresholdExamples:[],uncoveredExamples:[],revisionMatches:true,deterministic:digest(rock)===digest(repeat)};
 for(const obj of [turf,grass,shrubs])if(obj.userData.surfaceRevision!==report.geometryRevision||obj.userData.coastalSurfaceRevision!==report.geometryRevision)report.revisionMatches=false;
 const scrubRoot=new T.Vector3();for(let ring=0;ring<5;ring++)scrubRoot.add(new T.Vector3().fromBufferAttribute(shrubs.geometry.attributes.position,ring*6));scrubRoot.multiplyScalar(.2);
 const m=new T.Matrix4(),position=new T.Vector3(),quaternion=new T.Quaternion(),scale=new T.Vector3();
 for(const obj of [grass,shrubs]){
  assert.equal(obj.userData.roots.length,obj.count);
  for(let i=0;i<obj.count;i++){
   const root=new T.Vector3(...obj.userData.roots[i]),hit=cast(grid,root,new T.Vector3(0,-1,0));
   if(!hit){report.rootRayMisses++;continue;}report.rootMaxSurfaceError=Math.max(report.rootMaxSurfaceError,hit.error);
   const rootDistance=habitat.distance(root,hit.face.id);report.rootMinBoundaryDistance=Math.min(report.rootMinBoundaryDistance,rootDistance);if(rootDistance<INSET-EPS||field(root)<-EPS||hit.face.n.y<.70-EPS)report.rootHabitatViolations++;
   obj.getMatrixAt(i,m);m.decompose(position,quaternion,scale);
   const expected=obj===grass?-.003:scale.y*.88-.005,error=position.distanceTo(root.clone().addScaledVector(hit.face.n,expected));
   const key=obj===grass?'grassInstanceOffsetMaxError':'shrubInstanceOffsetMaxError';report[key]=Math.max(report[key],error);
   if(obj===grass)for(let blade=0;blade<5;blade++)for(let end=0;end<2;end++){
    const actualBase=new T.Vector3().fromBufferAttribute(grass.geometry.attributes.position,blade*3+end).applyMatrix4(m),baseHit=cast(grid,actualBase,new T.Vector3(0,-1,0));if(!baseHit){report.rootRayMisses++;continue;}const contact=actualBase.clone().addScaledVector(baseHit.face.n,.003),error=baseHit.face.tri.closestPointToPoint(contact,new T.Vector3()).distanceTo(contact),signed=actualBase.clone().sub(baseHit.face.tri.a).dot(baseHit.face.n);report.realGrassBaseMaxContactError=Math.max(report.realGrassBaseMaxContactError,error);report.realGrassBaseSignedDistanceRange[0]=Math.min(report.realGrassBaseSignedDistanceRange[0],signed);report.realGrassBaseSignedDistanceRange[1]=Math.max(report.realGrassBaseSignedDistanceRange[1],signed);report.realGrassBaseMinBoundaryDistance=Math.min(report.realGrassBaseMinBoundaryDistance,habitat.distance(contact,baseHit.face.id));
   }
   if(obj===shrubs){const actualRoot=scrubRoot.clone().applyMatrix4(m),contact=actualRoot.clone().addScaledVector(hit.face.n,.005),contactError=hit.face.tri.closestPointToPoint(contact,new T.Vector3()).distanceTo(contact),signed=actualRoot.clone().sub(hit.face.tri.a).dot(hit.face.n);report.realScrubRootMaxContactError=Math.max(report.realScrubRootMaxContactError,contactError);report.realScrubRootSignedDistanceRange[0]=Math.min(report.realScrubRootSignedDistanceRange[0],signed);report.realScrubRootSignedDistanceRange[1]=Math.max(report.realScrubRootSignedDistanceRange[1],signed);report.realScrubRootMinBoundaryDistance=Math.min(report.realScrubRootMinBoundaryDistance,habitat.distance(contact,hit.face.id));}

  }
 }
 const tp=turf.geometry.attributes.position,turfFaces=[],edges=new Map(),sourceEdges=new Map(),rootKey=v=>v.toArray().map(x=>Math.round(x*1e6)).join(',');
 for(let i=0;i<tp.count;i+=3){
  const verts=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(tp,i+j)),tri=new T.Triangle(...verts),n=tri.getNormal(new T.Vector3()),center=tri.getMidpoint(new T.Vector3());
  report.turfArea+=tri.getArea();if(tri.getArea()<1e-10){report.degenerateTurfTriangles++;continue;}
  // Identify substrate at the geometrically recovered point, not the nearest
  // surface to the raised turf: a nearby overhang can otherwise win that query.
  const hit=cast(grid,center.clone().add(new T.Vector3(0,-OFFSET,0)),new T.Vector3(0,-1,0));
  if(!hit){report.unsupportedTurfTriangles++;report.unsupportedTurfVertices+=3;continue;}
  const source=hit.face;report.turfOffsetMaxError=Math.max(report.turfOffsetMaxError,Math.abs(center.distanceTo(hit.point)-OFFSET));report.sourceFaceNormalDisagreement=Math.max(report.sourceFaceNormalDisagreement,1-n.dot(source.n));
  report.minSupportNormalY=Math.min(report.minSupportNormalY,source.n.y);report.areaWeightedSupportNormalY+=tri.getArea()*source.n.y;
  report.supportSlopeAreas[source.n.y<.6?'0.4-0.6':source.n.y<.78?'0.6-0.78':source.n.y<.9?'0.78-0.9':'0.9-1']+=tri.getArea();
  const recovered=verts.map(v=>v.clone().add(new T.Vector3(0,-OFFSET,0)));let bad=0;
  for(const v of [...recovered,center.clone().add(new T.Vector3(0,-OFFSET,0))]){const planeError=Math.abs(v.clone().sub(source.tri.a).dot(source.n));report.turfSupportMaxDistance=Math.max(report.turfSupportMaxDistance,source.tri.closestPointToPoint(v,new T.Vector3()).distanceTo(v));report.turfSupportMaxPlaneError=Math.max(report.turfSupportMaxPlaneError,planeError);if(planeError>EPS||!inside(source,v))bad++;}
  verts.forEach((v,j)=>{
   report.turfNormalDistanceMax=Math.max(report.turfNormalDistanceMax,Math.abs(v.clone().sub(source.tri.a).dot(source.n)));
   source.tri.getBarycoord(recovered[j],bary);if(source.n.y<.70-EPS||habitat.components[source.id]<0)report.habitatUnsupportedVertices++;
   const interpolated=new T.Vector3();source.ids.forEach((id,k)=>interpolated.addScaledVector(new T.Vector3().fromBufferAttribute(rock.geometry.attributes.normal,id),bary.getComponent(k)));interpolated.normalize();
   const shadingError=interpolated.distanceTo(new T.Vector3().fromBufferAttribute(turf.geometry.attributes.normal,i+j));
   report.smoothNormalMaxError=Math.max(report.smoothNormalMaxError,shadingError);
   if(shadingError>EPS&&report.smoothNormalExamples.length<4)report.smoothNormalExamples.push({turfTriangle:i/3,source:source.id,error:shadingError,sourceArea:source.tri.getArea(),barycentric:bary.toArray(),position:recovered[j].toArray(),sourceVertices:[source.tri.a,source.tri.b,source.tri.c].map(v=>v.toArray())});
  });
  const cover=[0,1,2].map(j=>turf.geometry.attributes.coastalCoverage.getX(i+j));
  const maskSamples=[...recovered.map((p,j)=>({p,coverage:cover[j]})),{p:center.clone().add(new T.Vector3(0,-OFFSET,0)),coverage:cover.reduce((a,b)=>a+b,0)/3},...recovered.map((p,j)=>({p:p.clone().lerp(recovered[(j+1)%3],.5),coverage:(cover[j]+cover[(j+1)%3])*.5}))];
  for(const {p,coverage}of maskSamples){const d=habitat.distance(p,source.id),deficit=Math.max(0,INSET-d);report.turfMaxInsetDeficit=Math.max(report.turfMaxInsetDeficit,deficit);report.minimumHabitatMargin=Math.min(report.minimumHabitatMargin,d-INSET);if(coverage>.015){report.visibleMaxInsetDeficit=Math.max(report.visibleMaxInsetDeficit,deficit);if(deficit>EPS){report.visibleInsetViolationSamples++;if(report.insetExamples.length<3)report.insetExamples.push({source:source.id,point:p.toArray(),distance:d,coverage});}}}
  for(const sample of [...recovered,center.clone().add(new T.Vector3(0,-OFFSET,0)),...recovered.map((v,j)=>v.clone().lerp(recovered[(j+1)%3],.5))]){
   ray.origin.copy(sample).y+=EPS;ray.direction.set(0,1,0);
   for(const f of grid.at(sample))if(f.id!==source.id){const h=ray.intersectTriangle(f.tri.a,f.tri.b,f.tri.c,false,intersection);if(h&&h.y-sample.y>EPS&&h.y-sample.y<OFFSET-EPS){report.turfOverheadPenetrationSamples++;if(report.turfOverheadExamples.length<4)report.turfOverheadExamples.push({turfTriangle:i/3,source:source.id,overhead:f.id,normalY:f.n.y,point:sample.toArray(),clearance:h.y-sample.y});break;}}
  }
  if(bad){report.unsupportedTurfTriangles++;report.unsupportedTurfVertices+=Math.min(3,bad);}
  const recoveredTri=new T.Triangle(...recovered);turfFaces.push({tri:recoveredTri,n:source.n,source:source.id});
  for(let j=0;j<3;j++){
   const a=recovered[j],b=recovered[(j+1)%3],ka=rootKey(a),kb=rootKey(b),key=ka<kb?ka+'|'+kb:kb+'|'+ka,entry={a,b,va:verts[j],vb:verts[(j+1)%3],source,center:recoveredTri.getMidpoint(new T.Vector3())};if(!edges.has(key))edges.set(key,[]);edges.get(key).push(entry);
   source.tri.getBarycoord(a,bary);const ba=bary.clone();source.tri.getBarycoord(b,bary);const bb=bary.clone();
   for(let opposite=0;opposite<3;opposite++)if(Math.abs(ba.getComponent(opposite))<.001&&Math.abs(bb.getComponent(opposite))<.001){
    const ids=source.ids.filter((_,k)=>k!==opposite).sort((x,y)=>x-y),sharedKey=ids.join(':'),origin=new T.Vector3().fromBufferAttribute(rock.geometry.attributes.position,ids[0]),axis=new T.Vector3().fromBufferAttribute(rock.geometry.attributes.position,ids[1]).sub(origin),length=axis.length();axis.divideScalar(length);
    const ta=a.clone().sub(origin).dot(axis),tb=b.clone().sub(origin).dot(axis);if(Math.abs(ta-tb)<1e-9)continue;
    // Barycentric tolerance alone mislabels an interior edge on a long, thin
    // triangle. A true source-edge point must be collinear within Float32 ULP.
    const storageBound=v=>Math.hypot(v.x,v.y,v.z)*2**-23+1e-7;
    if(a.distanceTo(origin.clone().addScaledVector(axis,ta))>storageBound(a)||b.distanceTo(origin.clone().addScaledVector(axis,tb))>storageBound(b))continue;
    if(!sourceEdges.has(sharedKey))sourceEdges.set(sharedKey,[]);sourceEdges.get(sharedKey).push({...entry,ta,tb});
   }
  }
 }
 // A triangle edge in the turf can be a legitimate clipped patch edge. Probe
 // just across it: only call it an internal break if the final rock there is
 // plantable and the continuous mask calls for coverage, yet no turf covers it.
 assert(Number.isFinite(habitatCut));
 const turfBins=new Map(),cell=1.2;
 for(const f of turfFaces){const v=[f.tri.a,f.tri.b,f.tri.c];for(let x=Math.floor(Math.min(...v.map(p=>p.x))/cell);x<=Math.floor(Math.max(...v.map(p=>p.x))/cell);x++)for(let z=Math.floor(Math.min(...v.map(p=>p.z))/cell);z<=Math.floor(Math.max(...v.map(p=>p.z))/cell);z++){const key=x+':'+z;if(!turfBins.has(key))turfBins.set(key,[]);turfBins.get(key).push(f);}}
 // Compare overlapping source-edge intervals, including one-to-two T junctions.
 // Quantized endpoint identity confuses a tiny full segment with its half.
 for(const list of sourceEdges.values())for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
  const a=list[i],b=list[j];if(a.source.id===b.source.id)continue;
  const lo=Math.max(Math.min(a.ta,a.tb),Math.min(b.ta,b.tb)),hi=Math.min(Math.max(a.ta,a.tb),Math.max(b.ta,b.tb));if(hi-lo<1e-9)continue;
  report.crossFaceMatchedEdges++;
  for(const t of [lo,hi]){const pa=a.va.clone().lerp(a.vb,(t-a.ta)/(a.tb-a.ta)),pb=b.va.clone().lerp(b.vb,(t-b.ta)/(b.tb-b.ta));report.sharedEdgeMaxGap=Math.max(report.sharedEdgeMaxGap,pa.distanceTo(pb));}
 }
 for(const boundary of edges.values())if(boundary.length===1){
  const e=boundary[0],mid=e.a.clone().add(e.b).multiplyScalar(.5);e.source.tri.getBarycoord(e.a,bary);const ba=bary.clone();e.source.tri.getBarycoord(e.b,bary);const bb=bary.clone();
  if(!['x','y','z'].some(k=>Math.abs(ba[k])<.001&&Math.abs(bb[k])<.001))continue;report.rawTriangleBoundaryEdges++;
  const probe=mid.clone().addScaledVector(mid.clone().sub(e.center).normalize(),.012),surface=cast(grid,probe,new T.Vector3(0,-1,0),.2);
  if(!surface||surface.face.id===e.source.id||surface.point.y< -height*.24||field(surface.point)<.03)continue;
  if(surface.point.y<=-height*.24+EPS){report.elevationThresholdBoundaryProbes++;continue;}
  const boundaryDistance=habitat.distance(surface.point,surface.face.id);if(surface.face.n.y<.70||boundaryDistance<INSET)continue;
  if(boundaryDistance<INSET+conservativeBand+EPS){report.conservativeBandBoundaryProbes++;continue;}
  const bin=turfBins.get(Math.floor(surface.point.x/cell)+':'+Math.floor(surface.point.z/cell))||[];
  if(bin.some(f=>Math.abs(surface.point.clone().sub(f.tri.a).dot(f.n))<EPS&&inside(f,surface.point)))continue;
  if(surface.face.n.y<.40){report.faceNormalThresholdBoundaries++;if(report.normalThresholdExamples.length<3)report.normalThresholdExamples.push({position:surface.point.toArray(),fromFace:e.source.id,toFace:surface.face.id,faceNormalY:surface.face.n.y,boundaryDistance});continue;}
  report.internalUncoveredBoundaryProbes++;if(report.uncoveredExamples.length<4)report.uncoveredExamples.push({position:surface.point.toArray(),fromFace:e.source.id,toFace:surface.face.id,field:field(surface.point),boundaryDistance,faceNormalY:surface.face.n.y,sourceTriangle:surface.face.tri.a.toArray().concat(surface.face.tri.b.toArray(),surface.face.tri.c.toArray())});
 }
 report.turfCoverageOfEligibleArea=report.turfArea/report.eligibleRockArea;
 report.areaWeightedSupportNormalY/=report.turfArea;
 report.supportSlopeAreaFractions=Object.fromEntries(Object.entries(report.supportSlopeAreas).map(([k,v])=>[k,v/report.turfArea]));
 if(!report.revisionMatches||!report.deterministic||report.rootRayMisses||report.rootMaxSurfaceError>EPS||report.grassInstanceOffsetMaxError>EPS||report.realGrassBaseMaxContactError>EPS||report.realGrassBaseMinBoundaryDistance<INSET-EPS||report.shrubInstanceOffsetMaxError>EPS||report.realScrubRootMaxContactError>EPS||report.realScrubRootMinBoundaryDistance<INSET-EPS||report.unsupportedTurfTriangles||report.rootHabitatViolations||report.visibleInsetViolationSamples||report.habitatUnsupportedVertices||report.turfOverheadPenetrationSamples||report.turfOffsetMaxError>EPS||report.turfNormalDistanceMax>OFFSET+EPS||report.smoothNormalMaxError>EPS||report.sharedEdgeMaxGap>EPS||!report.crossFaceMatchedEdges||report.degenerateTurfTriangles||report.internalUncoveredBoundaryProbes||report.minSupportNormalY<.70-EPS||!report.turfTriangles)issues.push({seed,report});
 report.sparseInterpretation=grass.count+shrubs.count===0?'no discrete roots; supported turf remains the vegetation cover':grass.count+shrubs.count<10?'sparse, measure turf separately; do not fill cliffs to meet a count':'surface-constrained roots';
 if(!grass.count){report.realGrassBaseMaxContactError=null;report.realGrassBaseSignedDistanceRange=null;report.realGrassBaseMinBoundaryDistance=null;}
 if(!shrubs.count){report.realScrubRootMaxContactError=null;report.realScrubRootSignedDistanceRange=null;report.realScrubRootMinBoundaryDistance=null;}
 results.push(report);
 for(const r of [rock,repeat])r.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
}
delete globalThis.location;
console.log(JSON.stringify({passed:issues.length===0,measured:true,scope:'final generated surfaces, approved eight dimensions/seeds; rays and per-face turf support, not declared audit zero',results,issues:issues.map(i=>i.seed)},null,2));
process.exitCode=issues.length?1:0;
