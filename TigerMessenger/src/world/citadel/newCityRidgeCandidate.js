import {targetCityParams} from './targetCityRelease.js';
import * as THREE from 'three';
import {officialOceanLevelAt} from '../waterV8/officialOcean.js';

// An additive macro-landform experiment, not a WFC solver or a change to the
// accepted old massif. Anchors are in the FINAL castle frame after bay layout.
export const NEW_CITY_RIDGE_REVISION='new-city-continuous-ridge-candidate-v2';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const clamp=THREE.MathUtils.clamp;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const mix=THREE.MathUtils.lerp;
const serialBox=b=>b.isEmpty()?null:{min:b.min.toArray(),max:b.max.toArray()};

export function newCityRidgeCandidateOptions(search=globalThis.location?.search||''){
 return {enabled:targetCityParams(search).get('citadelNewCityRidge')==='1'};
}

function boundsInCastle(object,inverse,accept=()=>true){
 const b=new THREE.Box3(),q=V(),instance=new THREE.Matrix4();
 object?.traverse(m=>{if(!m.isMesh||!m.geometry?.attributes.position||!accept(m))return;
  const a=m.geometry.attributes.position,n=m.isInstancedMesh?m.count:1;
  for(let k=0;k<n;k++){
   if(m.isInstancedMesh)m.getMatrixAt(k,instance);else instance.identity();
   const matrix=inverse.clone().multiply(m.matrixWorld).multiply(instance);
   for(let j=0;j<a.count;j++)b.expandByPoint(q.fromBufferAttribute(a,j).applyMatrix4(matrix));
  }
 });return b;
}

/** Read-only survey. The proposed anchors are a first composition, NOT a
 * measured seamless join or a camera-space silhouette certificate. */
export function surveyNewCityRidgeAnchors(castle){
 castle.updateWorldMatrix(true,true);
 const inverse=castle.matrixWorld.clone().invert(),city=castle.getObjectByName('highland-west-city');
 const source=castle.getObjectByName('citadel-oskar-grid-mountain-surface');
 const blue=m=>(Array.isArray(m.material)?m.material:[m.material]).some(v=>v?.name==='citadel-target-blue-dome');
 const dome=boundsInCastle(city,inverse,blue);
 const cityBounds=boundsInCastle(city,inverse,m=>!m.userData.isOutline&&!/backdrop|tree|cloud|plant|water|light|terrain|rock/i.test(m.name));
 const old=boundsInCastle(source,inverse);
 if(dome.isEmpty())return {revision:NEW_CITY_RIDGE_REVISION,status:'missing-blue-dome',castleMatrix:castle.matrixWorld.toArray(),oldMassif:serialBox(old),city:serialBox(cityBounds),anchors:null};
 const center=dome.getCenter(V()),top=dome.max.y;
 // The existing old right shoulder is around castle x=0, z=-30. Its actual
 // contact height is subsequently sampled from the final old mesh. The other
 // controls are explicitly relative to the measured dome, never the old
 // pre-bay authoring coordinates of WEST_CITY.
 const start=Math.min(0,center.x-38),end=center.x+30;
 const anchors=[
  {x:start,z:Math.min(-31,center.z-12),crestY:top-11,frontWidth:18,backWidth:22},
  {x:mix(start,end,.28),z:Math.min(-36,center.z-17),crestY:top-8,frontWidth:21,backWidth:24},
  {x:mix(start,end,.55),z:Math.min(-34,dome.min.z-38),crestY:top-3,frontWidth:17,backWidth:19},
  {x:mix(start,end,.76),z:Math.min(-32,dome.min.z-37),crestY:top+2.5,frontWidth:17,backWidth:18},
  {x:end,z:Math.min(-19,dome.min.z-30),crestY:top-9,frontWidth:17,backWidth:14},
 ];
 return {revision:NEW_CITY_RIDGE_REVISION,status:'proposal-needs-real-scene-review',castleMatrix:castle.matrixWorld.toArray(),oldMassif:serialBox(old),city:serialBox(cityBounds),blueDome:serialBox(dome),peakCeilingY:top+3,anchors};
}

// Intersect an actual castle-local vertical line with the authoritative curved
// ocean. Unlike projecting (x,0,z) radially, this leaves final XZ anchors fixed.
export function createCastleOceanSampler(matrix,radius=160,oceanLevelAt=officialOceanLevelAt){
 const up=V(0,1,0).transformDirection(matrix),scale=V(0,1,0).applyMatrix4(matrix).distanceTo(V().applyMatrix4(matrix));
 return (x,z)=>{
  const origin=V(x,0,z).applyMatrix4(matrix);let sea=0,t=0;
  for(let n=0;n<12;n++){
   const r=radius+sea,b=origin.dot(up),d=b*b-origin.lengthSq()+r*r;
   if(d<0)return null;
   t=-b+Math.sqrt(d);const p=origin.clone().addScaledVector(up,t);
   const next=oceanLevelAt(p.clone().normalize());
   if(Math.abs(next-sea)<1e-8)break;sea=next;
  }
  return t/scale;
 };
}

// Build a small XZ triangle index from the final old mesh. This reads its actual
// triangles; it does not use the obsolete baked ridge field or move old vertices.
function oldSurfaceSampler(mesh,inverse){
 if(!mesh?.geometry?.attributes.position)return ()=>null;
 const p=mesh.geometry.attributes.position,idx=mesh.geometry.index,toCastle=inverse.clone().multiply(mesh.matrixWorld),bins=new Map(),size=8;
 const q=(x,z)=>`${x},${z}`;
 for(let f=0;f<(idx?.count??p.count);f+=3){
  const a=[0,1,2].map(j=>V().fromBufferAttribute(p,idx?idx.getX(f+j):f+j).applyMatrix4(toCastle));
  const det=(a[1].z-a[2].z)*(a[0].x-a[2].x)+(a[2].x-a[1].x)*(a[0].z-a[2].z);
  if(Math.abs(det)<1e-9)continue;
  const tri={a,det};
  for(let x=Math.floor(Math.min(...a.map(v=>v.x))/size);x<=Math.floor(Math.max(...a.map(v=>v.x))/size);x++)
   for(let z=Math.floor(Math.min(...a.map(v=>v.z))/size);z<=Math.floor(Math.max(...a.map(v=>v.z))/size);z++){
    const k=q(x,z);if(!bins.has(k))bins.set(k,[]);bins.get(k).push(tri);
   }
 }
 return (x,z)=>{let height=null;for(const{a:[a,b,c],det}of bins.get(q(Math.floor(x/size),Math.floor(z/size)))||[]){
  const u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/det,v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/det;
  if(u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7){const y=u*a.y+v*b.y+(1-u-v)*c.y;height=height===null?y:Math.max(height,y);}
 }return height;};
}

const DEFAULT_PROFILE=Object.freeze([[0,1],[.17,.94],[.32,.71],[.49,.66],[.59,.42],[.76,.36],[1,0]]);
function profile(t){for(let i=1;i<DEFAULT_PROFILE.length;i++)if(t<=DEFAULT_PROFILE[i][0]){const a=DEFAULT_PROFILE[i-1],b=DEFAULT_PROFILE[i];return mix(a[1],b[1],(t-a[0])/(b[0]-a[0]));}return 0;}
function interpolate(anchors,x){let i=1;while(i<anchors.length-1&&x>anchors[i].x)i++;const a=anchors[i-1],b=anchors[i],t=smooth((x-a.x)/(b.x-a.x));const out={x};for(const k of ['z','crestY','frontWidth','backWidth'])out[k]=mix(a[k],b[k],t);return out;}

function collectProtection(castle,inverse,options){
 const result=[],use=new Set(options.protectedObjects||[]);
 castle.traverse(m=>{if(m.isMesh&&!m.userData.isOutline&&(m.userData.westCityWalkable||/bridge-deck|stair|town-terrace-.*floor|foundation|harbor-deck|plaza-paving-ring/.test(m.name)))use.add(m);});
 let root=options.sceneRoot||castle;while(!options.sceneRoot&&root.parent)root=root.parent;
 // The horse and tie-down squad live at scene level, outside castle traversal.
 for(const name of ['citadel-trojan-horse','citadel-plaza-hero-statue']){const object=root.getObjectByName(name);if(object){object.updateWorldMatrix(true,true);use.add(object);}}
 for(const m of use){const b=boundsInCastle(m,inverse);if(!b.isEmpty())result.push({name:m.name,box:b,kind:'actual-object-footprint'});}
 const city=castle.getObjectByName('highland-west-city');
 // These two anchors have already been transformed into the final castle
 // frame by compositionFrame + bayLayout. Do NOT transform by city again.
 for(const [key,half]of [['horseReservation',10],['statueAnchor',12]]){
  const anchor=city?.userData[key];if(Array.isArray(anchor)&&anchor.length===3&&anchor.every(Number.isFinite)){
   const a=new THREE.Vector3(...anchor);result.push({name:key,box:new THREE.Box3(a.clone().add(V(-half,-3,-half)),a.clone().add(V(half,15,half))),kind:'reserved-activity-footprint'});
  }
 }
 for(const r of options.reservedFootprints||[]){
  if(!r?.min||!r?.max)throw new Error('reservedFootprints require final castle-local min/max triples');
  result.push({name:r.name||'explicit-reservation',box:new THREE.Box3(V(...r.min),V(...r.max)),kind:'explicit-footprint'});
 }
 return result;
}

/** Explicitly default off. Integrate AFTER old landform shaping and BEFORE
 * material/refinement/surface-index/planting. Push returned surfaces into that
 * pipeline; never run them through shapeMountainLandform or bay layout again.
 * Existing backdrop visibility is not changed by this experiment. */
export function applyNewCityRidgeCandidate(castle,options={}){
 if(!castle||options.enabled!==true)return null;
 const prior=castle.getObjectByName('citadel-new-city-ridge-candidate');
 if(prior)return prior.userData.candidateHandle;
 castle.updateWorldMatrix(true,true);
 const radius=options.radius??160,survey=surveyNewCityRidgeAnchors(castle),anchors=(options.anchors||survey.anchors)?.map(a=>({...a}));
 if(!anchors||anchors.length<2)throw new Error('New city ridge needs explicit final-frame anchors or a measurable blue dome');
 for(let i=0;i<anchors.length;i++){
  const a=anchors[i];if(!['x','z','crestY','frontWidth','backWidth'].every(k=>Number.isFinite(a[k]))||a.frontWidth<=0||a.backWidth<=0||i&&a.x<=anchors[i-1].x)throw new Error('Ridge anchors must be finite, positive-width and strictly increasing in final castle X');
 }
 const inverse=castle.matrixWorld.clone().invert(),ocean=createCastleOceanSampler(castle.matrixWorld,radius,options.oceanLevelAt),sampleOld=oldSurfaceSampler(castle.getObjectByName('citadel-oskar-grid-mountain-surface'),inverse);
 const protection=options.terrainFirst?[]:collectProtection(castle,inverse,options),rails=[];
 for(const curve of Object.values(options.curves||{}))for(let i=0;i<1200;i++)rails.push(curve.getPointAt(i/1200).clone().applyMatrix4(inverse));
 const nx=options.longitudinalSegments??96,nz=options.crossSegments??32;
 if(!Number.isInteger(nx)||!Number.isInteger(nz)||nx<8||nz<8||nx>320||nz>128)throw new Error('Ridge sampling exceeds candidate limits');
 const x0=anchors[0].x,x1=anchors.at(-1).x,peakCeiling=options.peakCeilingY??survey.peakCeilingY??Infinity;
 const chart=[];
 for(let i=0;i<=nx;i++){
  const x=mix(x0,x1,i/nx),a=interpolate(anchors,x);
  for(let j=0;j<=nz;j++){
   const t=j/nz*2-1,width=t>=0?a.frontWidth:a.backWidth;
   chart.push([x,a.z+t*width*(1+.055*Math.sin(x*.07+.6)*(1-Math.abs(t)))]);
  }
 }
 let maximumCellDiameter=0;
 for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
  const q=[chart[i*(nz+1)+j],chart[(i+1)*(nz+1)+j],chart[i*(nz+1)+j+1],chart[(i+1)*(nz+1)+j+1]];
  for(let a=0;a<4;a++)for(let b=a+1;b<4;b++)maximumCellDiameter=Math.max(maximumCellDiameter,Math.hypot(q[a][0]-q[b][0],q[a][1]-q[b][1]));
 }
 // Conservative expansion includes a full cell diagonal so triangles between
 // protected vertices cannot cross a protected footprint unnoticed.
 const footprintPadding=maximumCellDiameter+2;
 const n=(nx+1)*(nz+1),positions=[],uv=[],semantic=[],shore=[],meta=[];
 const stats={oceanSamples:0,oldOverlapSamples:0,protectedSamples:0,railSamples:0,minOldOverlapBurial:Infinity,maxCrestY:-Infinity,peakCeilingY:peakCeiling,geometryClosed:false};
 for(let i=0;i<=nx;i++){
  const x=mix(x0,x1,i/nx),a=interpolate(anchors,x),ends=smooth((x-x0)/9)*smooth((x1-x)/12);
  for(let j=0;j<=nz;j++){
   const t=j/nz*2-1,front=t>=0;
   // Low-frequency unequal shoulder width; all cross rows share the same
   // mapping. No disconnected cones or sub-metre noise.
   const z=chart[i*(nz+1)+j][1],sea=ocean(x,z);
   if(sea===null)throw new Error(`Ridge anchor footprint misses ocean hemisphere at ${x},${z}`);
   stats.oceanSamples++;
   const cross=front?profile(t):Math.pow(Math.max(0,Math.cos(-t*Math.PI/2)),1.5);
   const crest=Math.min(a.crestY,peakCeiling),weather=.35*Math.sin(x*.13+t*3.1)*Math.sin(Math.abs(t)*Math.PI);
   let y=sea-3+Math.max(0,crest-(sea-3))*cross*ends+weather*ends;
   y=Math.min(y,peakCeiling);
   const old=sampleOld(x,z),join=smooth((x-x0-3)/13);
   if(old!==null&&x<x0+16&&old>sea){y=mix(Math.min(y,old-.15),y,join);stats.oldOverlapSamples++;if(join===0)stats.minOldOverlapBurial=Math.min(stats.minOldOverlapBurial,old-y);}
   if(protection.some(({box:b})=>x>=b.min.x-footprintPadding&&x<=b.max.x+footprintPadding&&z>=b.min.z-footprintPadding&&z<=b.max.z+footprintPadding)){y=sea-3;stats.protectedSamples++;}
   if(rails.some(p=>p.y>=sea-12-(12+footprintPadding)&&p.y<=y+(12+footprintPadding)&&(p.x-x)**2+(p.z-z)**2<(12+footprintPadding)**2)){y=sea-3;stats.railSamples++;}
   const perimeter=i===0||i===nx||j===0||j===nz;if(perimeter)y=sea-3;
   if(y<=sea-11)throw new Error('Ridge peak ceiling is below the local sea shell; revise final-frame anchors instead of folding the mesh');
   positions.push(x,y,z);uv.push(i/nx,j/nz);semantic.push(1);shore.push(perimeter?1:0);meta.push({sea,old,x,z});stats.maxCrestY=Math.max(stats.maxCrestY,y);
  }
 }
 // One watertight slab: shared top indices, a submerged bottom and continuous
 // side skirt. The former old terrain is untouched and remains a separate mesh.
 for(let k=0;k<n;k++){const{x,z,sea}=meta[k];positions.push(x,sea-12,z);uv.push(uv[k*2],uv[k*2+1]);semantic.push(2);shore.push(1);}
 const indices=[],cell=(i,j)=>i*(nz+1)+j;
 for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
  const a=cell(i,j),b=cell(i+1,j),c=cell(i+1,j+1),d=cell(i,j+1);
  indices.push(a,d,b,b,d,c,a+n,b+n,d+n,b+n,c+n,d+n);
 }
 const rim=[];for(let i=0;i<=nx;i++)rim.push(cell(i,0));for(let j=1;j<=nz;j++)rim.push(cell(nx,j));for(let i=nx-1;i>=0;i--)rim.push(cell(i,nz));for(let j=nz-1;j>0;j--)rim.push(cell(0,j));
 for(let k=0;k<rim.length;k++){const a=rim[k],b=rim[(k+1)%rim.length];indices.push(a,b,a+n,b,b+n,a+n);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('procgenSemantic',new THREE.Float32BufferAttribute(semantic,1));geometry.setAttribute('shoreBoundaryBottom',new THREE.Float32BufferAttribute(shore,1));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 stats.geometryClosed=true;
 const anchorRailAudit=anchors.map(a=>{let planar=Infinity,spatial=Infinity,closest=null;for(const p of rails){const d=Math.hypot(p.x-a.x,p.z-a.z);if(d<planar){planar=d;closest=p.toArray();}spatial=Math.min(spatial,Math.hypot(p.x-a.x,p.y-a.crestY,p.z-a.z));}return {...a,nearestPlanarRail:planar,nearestSpatialRail:spatial,closestPlanarRail:closest};});
 const audit={terrainFirst:!!options.terrainFirst,layoutStatus:options.terrainFirst?'terrain candidate; city and railway pending':'legacy layout protected',anchorRailAudit,revision:NEW_CITY_RIDGE_REVISION,coordinateSpace:'final castle local',mode:'authored-continuous-heightfield-not-WFC',anchors,grid:[nx,nz],vertices:2*n,triangles:indices.length/3,protectionFootprints:protection.length,protectedReservations:protection.filter(p=>p.kind!=='actual-object-footprint').map(p=>({name:p.name,...serialBox(p.box),kind:p.kind})),externalHorseMeasured:protection.some(p=>p.name==='citadel-trojan-horse'),railProbes:rails.length,footprintPadding,maximumCellDiameter,...stats,oldMassifMutated:false,oldJoin:'submerged overlap; not topologically welded; actual visual seam acceptance pending',survey,defaultEnabled:false};
 geometry.userData.newCityRidgeCandidate=audit;
 const material=new THREE.MeshStandardMaterial({color:0xb4b3ae,roughness:.97,metalness:0,flatShading:false});material.name='citadel-new-city-ridge-placeholder-rock';
 const mesh=new THREE.Mesh(geometry,material);mesh.name='citadel-new-city-continuous-ridge-surface';mesh.receiveShadow=true;mesh.castShadow=true;mesh.userData.isCitadelTerrain=true;mesh.userData.newCityRidgeCandidate={revision:NEW_CITY_RIDGE_REVISION};
 const group=new THREE.Group();group.name='citadel-new-city-ridge-candidate';group.add(mesh);castle.add(group);group.updateWorldMatrix(true,true);
 let disposed=false;const handle={group,surfaces:[mesh],audit,dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const g of new Set([geometry,mesh.geometry]))g.dispose();for(const m of new Set([material,...(Array.isArray(mesh.material)?mesh.material:[mesh.material])]))m.dispose();delete group.userData.candidateHandle;}};
 Object.defineProperty(group.userData,'candidateHandle',{value:handle,configurable:true,enumerable:false});group.userData.newCityRidgeCandidate=audit;
 return handle;
}
