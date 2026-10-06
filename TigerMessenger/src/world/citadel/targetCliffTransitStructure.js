import * as T from 'three';
import {createTargetCliffRailGallery} from './targetCliffRailGallery.js?revision=1';
import {createTargetCityBayBridge} from './targetCityBayBridge.js?revision=3';
import {createTargetNewCityTransitLinks} from './targetNewCityTransitLinks.js';
import {TARGET_ARCHITECTURE_PALETTE} from './targetArchitecturePalette.js';

export const TARGET_CLIFF_TRANSIT_STRUCTURE_VERSION='target-cliff-transit-structure-4';
const finite3=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
const V=p=>new T.Vector3(...p);
const faces=[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7];
const read=(fn,x,z)=>{const v=fn?.(x,z),h=typeof v==='number'?v:v?.height;if(h==null)return null;if(!Number.isFinite(h))throw new TypeError('Surface callback returned nonfinite castle-local Y');return h;};
function trianglesFrom(root,matrix){
 root.updateMatrixWorld(true);const records=[];
 root.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.geometry?.attributes.position)return;for(let a=mesh;a;a=a.parent)if(!a.visible)return;
  const geometry=mesh.geometry,p=geometry.attributes.position,index=geometry.index;
  for(let instance=0;instance<(mesh.isInstancedMesh?mesh.count:1);instance++){
   const world=matrix.clone().multiply(mesh.matrixWorld);if(mesh.isInstancedMesh){const im=new T.Matrix4();mesh.getMatrixAt(instance,im);world.multiply(im);}if(Math.abs(world.determinant())<1e-12)continue;
   const triangles=[],bounds=new T.Box3();for(let i=0;i<(index?.count??p.count);i+=3){const points=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,index?index.getX(i+k):i+k).applyMatrix4(world)),triangle=new T.Triangle(...points),box=new T.Box3().setFromPoints(points);triangles.push({triangle,box,face:i/3});bounds.union(box);}
   records.push({name:mesh.name,instanceId:mesh.isInstancedMesh?instance:null,triangles,bounds});
  }
 });return records;
}
function bodyContacts(records,body,pose){const bounds=body.clone().applyMatrix4(pose),inverse=pose.clone().invert(),center=body.getCenter(new T.Vector3()).applyMatrix4(pose),contacts=[];for(const mesh of records){if(!bounds.intersectsBox(mesh.bounds))continue;let contact=null;for(const item of mesh.triangles){if(!bounds.intersectsBox(item.box))continue;const t=item.triangle.clone();t.a.applyMatrix4(inverse);t.b.applyMatrix4(inverse);t.c.applyMatrix4(inverse);if(body.intersectsTriangle(t)){contact={mesh:mesh.name,instanceId:mesh.instanceId,type:'triangle-obb',face:item.face};break;}}
 if(!contact&&mesh.bounds.containsPoint(center)){const ray=new T.Ray(center,new T.Vector3(.731,.419,.539).normalize()),crossings=[];for(const item of mesh.triangles){const hit=ray.intersectTriangle(item.triangle.a,item.triangle.b,item.triangle.c,false,new T.Vector3());if(hit&&hit.distanceTo(center)>1e-7)crossings.push({distance:hit.distanceTo(center),sign:Math.sign(item.triangle.getNormal(new T.Vector3()).dot(ray.direction))});}crossings.sort((a,b)=>a.distance-b.distance);let winding=0;for(let i=0;i<crossings.length;){const d=crossings[i].distance;let signs=0;while(i<crossings.length&&Math.abs(crossings[i].distance-d)<1e-6)signs+=crossings[i++].sign;winding+=Math.sign(signs);}if(winding)contact={mesh:mesh.name,instanceId:mesh.instanceId,type:'closed-solid-containment'};}
 if(contact)contacts.push(contact);}return contacts;}
function curveFrame(curve,u){const point=curve.getPointAt(u),tangent=curve.getTangentAt(u).normalize(),right=point.clone().normalize().cross(tangent).normalize(),up=tangent.clone().cross(right).normalize();return{point,tangent,right,up};}
function pointInOpening(p,opening){const d=p.clone().sub(opening.origin),along=d.dot(opening.forward),across=d.dot(opening.right);return along>=-opening.back&&along<=opening.length&&Math.abs(across)<=opening.width/2&&Math.abs(d.y)<=2;}

/** A detachable structure for an explicitly supplied three-line release.
 * It never lays rails, moves vehicles or excavates terrain. Output is castle-local.
 * obstacleGroups are detached/castle-local groups (their matrixWorld is relative
 * to the castle chart), not already world-parented meshes. Samplers return local Y.
 * A built candidate can retain honest rejection/unknown findings for inspection;
 * report.finitePass alone is not release approval or a continuous navigation proof.
 */
export function createTargetCliffTransitStructure({release,castleMatrix=release?.castleMatrix,sampleTerrain,sampleSea,sampleRailTerrain=sampleTerrain,
 connectionTargets,walkingConnection=release?.walkingConnection??null,obstacleGroups=[],walkwayHeight=6.9,walkwayWidth=4.4,connectionWidth=2.4,
 laneSpacing=4.1,vehicleEnvelope={},sampleStep=.75,seaSide=1,palette={},galleryMaxSpans={},galleryPierWidths={},newCityTransitLinks=false}={}){
 const explicitlyStacked=walkingConnection?.kind==='stacked-connected';if(explicitlyStacked)walkingConnection=null;
 if(!release?.segments?.center||!release?.curves?.red||!release?.curves?.blue||!['newShore','central','oldShore'].every(k=>release.segments.center[k]?.getPointAt))throw new TypeError('Explicit three-line cliff transit release required');
 if(typeof sampleTerrain!=='function'||typeof sampleSea!=='function'||typeof sampleRailTerrain!=='function')throw new TypeError('Actual terrain and sea callbacks required');
 if(!connectionTargets||!['old','new'].every(k=>finite3(connectionTargets[k])))throw new TypeError('Actual old/new public connection targets required');
 if(!Array.isArray(obstacleGroups)||obstacleGroups.some(g=>!g?.isObject3D))throw new TypeError('Read-only castle-local obstacle groups required');
 for(const [key,value]of Object.entries({walkwayHeight,walkwayWidth,connectionWidth,sampleStep}))if(!Number.isFinite(value)||value<=0)throw new RangeError(`${key} must be positive`);
 if(connectionWidth<2.4||walkwayWidth<2.4||sampleStep>2)throw new RangeError('Insufficient public width or excessive sampling step');
 const matrix=castleMatrix?.isMatrix4?castleMatrix.clone():new T.Matrix4().fromArray(castleMatrix??[]),inverse=matrix.clone().invert();
 if(!matrix.elements.every(Number.isFinite)||Math.abs(matrix.determinant())<1e-12)throw new TypeError('Finite castle matrix required');
 const releaseMatrix=release.castleMatrix?.elements??release.castleMatrix;if(releaseMatrix&&Array.from(releaseMatrix).some((n,i)=>Math.abs(n-matrix.elements[i])>1e-5))throw new RangeError('Release world curves belong to a different castle frame');
 if(walkingConnection){if(walkingConnection.width!==undefined&&(!Number.isFinite(walkingConnection.width)||walkingConnection.width<2.4))throw new RangeError('Independent bridge clear width must be at least 2.4m');if(walkingConnection.kind!=='independent-short-bridge'||!Array.isArray(walkingConnection.path)||walkingConnection.path.length<2||!walkingConnection.path.every(finite3))throw new TypeError('Independent walkingConnection requires resolved finite castle-local path and kind');for(const[key,i]of [['old',0],['new',walkingConnection.path.length-1]])if(V(walkingConnection.path[i]).distanceTo(V(connectionTargets[key]))>.02)throw new RangeError('Independent walking bridge must meet actual '+key+' public port');}
 const group=new T.Group();group.name='citadel-target-cliff-transit-structure';group.userData.preserveCitadelMaterials=true;
 const assets=[],geometries=new Set(),materials=new Set(),connections=[],galleries={},walkPaths=[];
 let independentBridge=null,plazaLinks=null;let disposed=false;const dispose=()=>{if(disposed)return;disposed=true;group.removeFromParent();for(const a of assets)a.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();group.clear();};
 vehicleEnvelope={halfWidth:1.75,top:5.36,topMargin:.35,...vehicleEnvelope};
 const colors={stone:TARGET_ARCHITECTURE_PALETTE.stone,trim:TARGET_ARCHITECTURE_PALETTE.trim,rail:'#8b7e69',...palette},mats={};
 for(const[k,color]of Object.entries(colors)){const material=new T.MeshStandardMaterial({color,roughness:.92});material.userData.preserveCitadelMaterial=true;mats[k]=material;materials.add(material);}
 const positionsToMesh=(name,positions,material,walkable=false,parent=group)=>{if(!positions.length)return null;const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometries.add(geometry);const mesh=new T.Mesh(geometry,material);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;if(walkable)mesh.userData.targetWalkable=true;parent.add(mesh);return mesh;};
 const prism=(points,out)=>{for(const i of faces)out.push(...points[i].toArray());};
 const localBox=(center,dx,dy,dz,out)=>{const[x,y,z]=center;prism([[x-dx/2,y-dy/2,z-dz/2],[x-dx/2,y-dy/2,z+dz/2],[x+dx/2,y-dy/2,z+dz/2],[x+dx/2,y-dy/2,z-dz/2],[x-dx/2,y+dy/2,z-dz/2],[x-dx/2,y+dy/2,z+dz/2],[x+dx/2,y+dy/2,z+dz/2],[x+dx/2,y+dy/2,z-dz/2]].map(V),out);};
 const issues=[];
 try{
  for(const key of ['newShore','central','oldShore']){
   const asset=createTargetCliffRailGallery({worldCurve:release.segments.center[key],castleMatrix:matrix,sampleTerrain:sampleRailTerrain,sampleSea,walkwayHeight,walkwayWidth,laneSpacing,vehicleEnvelope,maxSpan:galleryMaxSpans[key]??(key==='central'?28:18),pierWidth:galleryPierWidths[key]??(key==='central'?1.6:1.2),sideRibThickness:key==='central'?.7:.6,sampleStep,seaSide,palette});assets.push(asset);asset.report.structuralParameters={maxSpan:galleryMaxSpans[key]??(key==='central'?28:18),pierWidth:galleryPierWidths[key]??(key==='central'?1.6:1.2),sideRibThickness:key==='central'?.7:.6};galleries[key]=asset;asset.group.name='cliff-transit-'+key;group.add(asset.group);
   asset.group.traverse(o=>{if(o.isMesh)o.name=key+'-'+o.name;});
   for(const row of asset.report.walkSurfaces)row.id=key+'-'+row.id;
   walkPaths.push({id:key,points:asset.report.upperPath,kind:'radial-continuous-deck',mainCityConnection:!walkingConnection});
   if(!asset.report.vehicleClearance.pass)issues.push({type:'gallery-vehicle-collision',section:key,count:asset.report.vehicleClearance.collisions.length});
   if(asset.report.terrainClearance.pass!==true)issues.push({type:'gallery-terrain-rejected-or-unknown',section:key,known:asset.report.terrainClearance.issues.length,unknown:asset.report.terrainClearance.unknown});
   if(!asset.report.foundationSampledPass)issues.push({type:'gallery-foundation-unresolved',section:key});
   if(!asset.report.supportSamples.pass)issues.push({type:'gallery-public-support-failure',section:key});
  }
  function buildConnection(key,source,upLocal,target){
   const start=V(source),end=V(target),delta=end.clone().sub(start),horizontal=Math.hypot(delta.x,delta.z),forward=new T.Vector3(delta.x,0,delta.z).normalize(),right=new T.Vector3(forward.z,0,-forward.x);
   if(horizontal<8)throw new RangeError('Connection must have sufficient room for a real stair and landing');
   const opening={origin:start,forward,right,width:connectionWidth+.6,back:2.8,length:7};
   const landingLength=3,landingEnd=start.clone().addScaledVector(forward,landingLength),planeY=(p)=>start.y-(upLocal.x*(p.x-start.x)+upLocal.z*(p.z-start.z))/upLocal.y;
   landingEnd.y=planeY(landingEnd);const usable=horizontal-landingLength,rise=end.y-landingEnd.y;
   const count=Math.max(1,Math.ceil(Math.abs(rise)/.15),Math.floor(usable/.46)),run=usable/count;
   // Sample the full clear width first, then move necessary rises earlier along
   // this same route. Endpoints stay exact and each real riser remains <= .15m.
   const levels=Array.from({length:count},(_,i)=>landingEnd.y+rise*(i+1)/count);
   if(rise>=0){for(let i=0;i<count;i++){let required=usable-(i+1)*run<3.2?end.y:levels[i];for(const fraction of[.02,.5,.98])for(const lateral of[-connectionWidth/2,0,connectionWidth/2]){const q=landingEnd.clone().addScaledVector(forward,(i+fraction)*run).addScaledVector(right,lateral),ground=read(sampleTerrain,q.x,q.z);if(ground!==null)required=Math.max(required,ground+.06);}levels[i]=Math.min(end.y,landingEnd.y+Math.ceil(Math.max(0,required-landingEnd.y)/.15)*.15);}levels[count-1]=end.y;for(let i=count-2;i>=0;i--)levels[i]=Math.max(levels[i],levels[i+1]-.15);for(let i=1;i<count;i++)levels[i]=Math.max(levels[i],levels[i-1]);}
   const rises=levels.map((h,i)=>h-(i?levels[i-1]:landingEnd.y)),maximumRiser=Math.max(...rises.map(Math.abs));
   const top=[],rails=[],supports=[],under=[],walkSurfaces=[],path=[start.toArray()],groundSamples=[],supportRows=[];
   const at=(p,side,y=p.y)=>p.clone().addScaledVector(right,side).setY(y);
   const landingCorners=[at(start,-connectionWidth/2),at(landingEnd,-connectionWidth/2),at(landingEnd,connectionWidth/2),at(start,connectionWidth/2)];landingCorners[0].y=planeY(landingCorners[0]);landingCorners[3].y=planeY(landingCorners[3]);
   prism([...landingCorners.map(p=>p.clone().add(new T.Vector3(0,-.24,0))),...landingCorners],top);
   walkSurfaces.push({id:key+'-city-link-treads',kind:'twisted-end-landing',corners:landingCorners.map(p=>p.toArray())});
   const segments=[{a:start,b:landingEnd,topA:start.y,topB:landingEnd.y,landing:true}];
   for(let i=0;i<count;i++){
    const a=landingEnd.clone().addScaledVector(forward,i*run),b=landingEnd.clone().addScaledVector(forward,(i+1)*run),height=levels[i];
    a.y=b.y=height;if(i===count-1)b.addScaledVector(forward,.6);const corners=[at(a,-connectionWidth/2),at(b,-connectionWidth/2),at(b,connectionWidth/2),at(a,connectionWidth/2)];
    prism([...corners.map(p=>p.clone().add(new T.Vector3(0,-.28-Math.abs(rises[i]),0))),...corners],top);walkSurfaces.push({id:key+'-city-link-treads',kind:'tread',i,top:height,corners:corners.map(p=>p.toArray())});segments.push({a,b,topA:height,topB:height});path.push(a.clone().lerp(b,.5).toArray());
   }
   path.push(end.toArray());
   // Continuous side stringers carry the treads. Their first 7 metres bear on
   // the double-deck roof, leaving both lower railway lanes free of new piers.
   for(const seg of segments){for(const side of[-1,1]){const x=side*(connectionWidth/2-.16),a0=at(seg.a,x-.10,seg.topA-.60),a1=at(seg.a,x+.10,seg.topA-.60),b0=at(seg.b,x-.10,seg.topB-.60),b1=at(seg.b,x+.10,seg.topB-.60);prism([a0,b0,b1,a1,a0.clone().setY(seg.topA-.20),b0.clone().setY(seg.topB-.20),b1.clone().setY(seg.topB-.20),a1.clone().setY(seg.topA-.20)],under);}}
   const heightAt=d=>d<landingLength?start.y+(landingEnd.y-start.y)*d/landingLength:levels[Math.min(count-1,Math.max(0,Math.ceil(Math.max(1e-8,d-landingLength)/run)-1))];
   const supportDistances=[];for(let d=8;d<horizontal-2;d+=10)supportDistances.push(d);
   for(const d of supportDistances){const p=start.clone().addScaledVector(forward,d),topY=heightAt(d)-.55;for(const side of[-1,1]){const q=p.clone().addScaledVector(right,side*(connectionWidth/2-.24)),samples=[[-.32,-.32],[-.32,.32],[.32,-.32],[.32,.32]].map(([x,z])=>read(sampleTerrain,q.x+x,q.z+z));const missing=samples.some(y=>y===null),bottom=missing?null:Math.min(...samples)-.1;supportRows.push({at:q.toArray(),distance:d,topY,bottomY:bottom,sampled:!missing});if(bottom!==null&&bottom<topY)localBox([q.x,(bottom+topY)/2,q.z],.64,topY-bottom,.64,supports);}}
   // True open stone arches between the narrow paired piers, below the stair.
   for(let k=1;k<supportDistances.length;k++){const d0=supportDistances[k-1],d1=supportDistances[k],span=d1-d0;for(const side of[-1,1])for(let i=0;i<16;i++){const a=d0+span*i/16,b=d0+span*(i+1)/16,pa=start.clone().addScaledVector(forward,a),pb=start.clone().addScaledVector(forward,b),ha=heightAt(a)-.48,hb=heightAt(b)-.48,depth=t=>.55+2.8*(1-Math.sqrt(Math.max(0,1-(2*t-1)**2))),da=depth(i/16),db=depth((i+1)/16),x=side*(connectionWidth/2-.24);prism([at(pa,x-.17,ha-da),at(pb,x-.17,hb-db),at(pb,x+.17,hb-db),at(pa,x+.17,ha-da),at(pa,x-.17,ha),at(pb,x-.17,hb),at(pb,x+.17,hb),at(pa,x+.17,ha)],supports);}}
   // Open ends, side rails only. The initial junction is the only rail opening.
   const railStart=Math.min(horizontal,3.2),railEnd=key==='new'?horizontal-2.5:horizontal,railCount=Math.ceil((railEnd-railStart)/1.6);
   for(const side of[-1,1])for(let i=0;i<railCount;i++){const da=railStart+(railEnd-railStart)*i/railCount,db=railStart+(railEnd-railStart)*(i+1)/railCount,a=start.clone().addScaledVector(forward,da),b=start.clone().addScaledVector(forward,db),ya=heightAt(da),yb=heightAt(db),x=side*(connectionWidth/2+.10);prism([at(a,x-.04,ya+.97),at(b,x-.04,yb+.97),at(b,x+.04,yb+.97),at(a,x+.04,ya+.97),at(a,x-.04,ya+1.05),at(b,x-.04,yb+1.05),at(b,x+.04,yb+1.05),at(a,x+.04,ya+1.05)],rails);const q=at(a,x,ya+.5);localBox(q.toArray(),.08,1,.08,rails);}
   const link=new T.Group();link.name=key+'-city-cliff-link';group.add(link);positionsToMesh(key+'-city-link-treads',top,mats.stone,true,link);positionsToMesh(key+'-city-link-stringers',under,mats.trim,false,link);positionsToMesh(key+'-city-link-open-support-arches',supports,mats.stone,false,link);positionsToMesh(key+'-city-link-side-handrails',rails,mats.rail,false,link);
   const n=Math.ceil(horizontal/.5);for(let i=0;i<=n;i++){const d=horizontal*i/n,p=start.clone().addScaledVector(forward,d),topY=heightAt(d);for(const lateral of[-connectionWidth/2+.15,0,connectionWidth/2-.15]){const q=p.clone().addScaledVector(right,lateral),ground=read(sampleTerrain,q.x,q.z);groundSamples.push({distance:d,x:q.x,z:q.z,topY,groundY:ground,penetration:ground===null?null:ground-topY});}}
   const failed=groundSamples.filter(p=>p.penetration>.025),unknown=groundSamples.filter(p=>p.groundY===null);
   const report={id:key,width:connectionWidth,start:source,end:target,length:horizontal,stepCount:rises.filter(r=>Math.abs(r)>1e-7).length,treadCount:count,terrainAdjustedLevels:levels,maximumRiser,minimumRun:run,nominalGrade:Math.abs(rise)/usable,walkSurfaces,walkPath:path,opening:{polygon:[start.clone().addScaledVector(forward,-2.8).addScaledVector(right,-opening.width/2),start.clone().addScaledVector(forward,7).addScaledVector(right,-opening.width/2),start.clone().addScaledVector(forward,7).addScaledVector(right,opening.width/2),start.clone().addScaledVector(forward,-2.8).addScaledVector(right,opening.width/2)].map(p=>[p.x,p.z])},supportRows,groundSamples,terrainFailures:failed,missingTerrain:unknown.length,continuousRamp:false,endLandingLength:3.2,endApronLength:.6,endJunctionOpenLength:key==='new'?2.5:0,stairPass:maximumRiser<=.22+1e-9&&run>=.28&&maximumRiser/run<=.65,groundPass:unknown.length?null:failed.length===0,foundationPass:supportRows.every(p=>p.sampled),bodyClearanceVerified:false};
   if(!report.stairPass)issues.push({type:'connection-stair-geometry-failed',connection:key});if(report.groundPass!==true)issues.push({type:'connection-terrain-rejected-or-unknown',connection:key,count:failed.length,unknown:unknown.length});if(!report.foundationPass)issues.push({type:'connection-foundation-unresolved',connection:key});
   connections.push(report);walkPaths.push({id:key+'-city-link',points:path,kind:'discrete-stairs'});return opening;
  }
  const central=galleries.central.report;
  const endpoints=walkingConnection?[]:[['new','start'],['old','end']].map(([key,end])=>{const p=central.endpoints[end],f=curveFrame(release.segments.center.central,end==='start'?0:1);return buildConnection(key,p.walkLocal,f.up.transformDirection(inverse),connectionTargets[key]);});
  if(newCityTransitLinks){
   if(newCityTransitLinks!==true&&(typeof newCityTransitLinks!=='object'||Array.isArray(newCityTransitLinks)))throw new TypeError('newCityTransitLinks must be false, true or options');
   plazaLinks=createTargetNewCityTransitLinks({...newCityTransitLinks,release,castleMatrix:matrix,sampleTerrain,sampleSea,walkwayHeight,palette});assets.push(plazaLinks);group.add(plazaLinks.group);endpoints.push(...plazaLinks.openings);walkPaths.push(...plazaLinks.walkPaths);
   if(!plazaLinks.report.finitePass)throw Object.assign(new Error('New city transit links rejected: '+JSON.stringify(plazaLinks.report.issues)),{transitLinkReport:plazaLinks.report});
  }
  // Trim only newly owned rail/curb triangles at the actual city-link openings.
  // Gallery construction audits occur before this conservative removal; removing
  // rails cannot create a rail-body collision, and the full scene is re-audited.
  const railOpeningChanges=[];
  for(const asset of Object.values(galleries))asset.group.traverse(mesh=>{if(!mesh.isMesh||!/handrails|rail-posts|edge-curbs/.test(mesh.name))return;const p=mesh.geometry.attributes.position,index=mesh.geometry.index,out=[];let removed=0;for(let i=0;i<(index?.count??p.count);i+=3){const tri=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,index?index.getX(i+k):i+k));const samples=[...tri,tri[0].clone().add(tri[1]).add(tri[2]).multiplyScalar(1/3)];if(endpoints.some(opening=>samples.some(p=>pointInOpening(p,opening)))){removed++;continue;}for(const v of tri)out.push(...v.toArray());}if(removed){const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(out,3));geometry.computeVertexNormals();geometries.add(geometry);mesh.geometry=geometry;railOpeningChanges.push({mesh:mesh.name,removedTriangles:removed});}});
  if(walkingConnection){
   independentBridge=createTargetCityBayBridge({path:walkingConnection.path,width:walkingConnection.width??4.4,maxSpan:36,pierWidth:1.8,sideOpeningFootprints:walkingConnection.sideOpeningFootprints??[],groundHeightAt:(x,z)=>read(sampleRailTerrain,x,z),oceanHeightAt:(x,z)=>read(sampleSea,x,z),palette:{stone:colors.stone,trim:colors.trim}});
   assets.push(independentBridge);independentBridge.group.name='citadel-independent-short-walk-bridge';group.add(independentBridge.group);
   const b=independentBridge.report;
   // A real narrow endpoint overlap catches radial ground rays on Float32
   // boundaries; it does not mask a gap by widening the support query.
   const last=b.walkSurfaces.at(-1),forward=V(last.to).sub(V(last.from)),run=Math.hypot(forward.x,forward.z);forward.multiplyScalar(1/run);
   const endRight=V(last.corners[1]),endLeft=V(last.corners[2]),apronTop=[endLeft.clone().addScaledVector(forward,-.04),endLeft.clone().addScaledVector(forward,.35),endRight.clone().addScaledVector(forward,.35),endRight.clone().addScaledVector(forward,-.04)],apron=[];
   prism([...apronTop.map(p=>p.clone().add(new T.Vector3(0,-.42,0))),...apronTop],apron);positionsToMesh('independent-bridge-end-apron',apron,mats.stone,true,independentBridge.group);
   b.walkSurfaces.push({id:'independent-bridge-end-apron',corners:apronTop.map(p=>p.toArray()),polygon:apronTop.map(p=>[p.x,p.z]),clearWidth:b.width,kind:'real-end-overlap'});b.endApronExtension=.35;b.performance.meshes+=1;b.performance.triangles+=12;independentBridge.group.updateMatrixWorld(true);const bridgeBounds=new T.Box3().setFromObject(independentBridge.group);b.bounds={min:bridgeBounds.min.toArray(),max:bridgeBounds.max.toArray()};
   walkPaths.push({id:'independent-short-bridge',points:b.path,kind:'independent-stone-bridge',mainCityConnection:true});
   const samples=[],step=.5;for(const surface of b.walkSurfaces.filter(s=>s.from&&s.to)){const A=V(surface.from),B=V(surface.to),d=B.clone().sub(A),length=Math.hypot(d.x,d.z),right=new T.Vector3(-d.z,0,d.x).normalize(),n=Math.ceil(length/step);for(let i=0;i<=n;i++)for(const lateral of[-b.width/2+.15,0,b.width/2-.15]){const p=A.clone().lerp(B,i/n).addScaledVector(right,lateral),ground=read(sampleTerrain,p.x,p.z);samples.push({point:p.toArray(),groundY:ground,penetration:ground===null?null:ground-p.y});}}
   b.terrainClearance={samples,unknown:samples.filter(p=>p.groundY===null).length,failures:samples.filter(p=>p.penetration>.025)};b.terrainClearance.pass=b.terrainClearance.unknown===0&&b.terrainClearance.failures.length===0;
   b.mainCityConnection=true;b.removedLongCityLinks=true;b.dockAdjustment=walkingConnection.dockAdjustment??null;b.oldApproachLength=walkingConnection.oldApproachLength??null;b.requestedPathXZ=walkingConnection.requestedPathXZ??walkingConnection.path.map(p=>[p[0],p[2]]);
   if(!b.supportSampledPass)issues.push({type:'short-walking-bridge-foundation-unresolved'});if(!b.walkingGradePass)issues.push({type:'short-walking-bridge-grade-rejected'});if(!b.terrainClearance.pass)issues.push({type:'short-walking-bridge-terrain-rejected-or-unknown',count:b.terrainClearance.failures.length,unknown:b.terrainClearance.unknown});
  }
  group.updateMatrixWorld(true);
  const ownedRecords=trianglesFrom(group,matrix),records=[...ownedRecords,...obstacleGroups.flatMap(g=>trianglesFrom(g,matrix))];
  const body={halfWidth:1.72,halfLength:3.49,bottom:-.38,top:2.642,lateralMargin:.30,topMargin:.35,bottomMargin:.1,...vehicleEnvelope};
  const box=new T.Box3(new T.Vector3(-body.halfWidth-body.lateralMargin,body.bottom-body.bottomMargin,-body.halfLength),new T.Vector3(body.halfWidth+body.lateralMargin,body.top+body.topMargin,body.halfLength)),collisions=[];
  let checked=0;
  for(const lane of['red','blue']){const curve=release.curves[lane],n=Math.ceil(curve.getLength()/sampleStep);for(let i=0;i<=n;i++){const f=curveFrame(curve,i/n),pose=new T.Matrix4().makeBasis(f.right,f.up,f.tangent).setPosition(f.point),hits=bodyContacts(records,box,pose);checked++;if(hits.length)collisions.push({lane,u:i/n,hits});}}
  if(independentBridge){const hits=collisions.map(row=>({...row,hits:row.hits.filter(hit=>hit.mesh.startsWith('bay-bridge-')||hit.mesh.startsWith('independent-bridge-'))})).filter(row=>row.hits.length);independentBridge.report.vehicleClearance={pass:hits.length===0,poses:checked,collisions:hits,envelope:body,source:'actual red/blue OBB versus independent short bridge triangles',continuous:false};}
  if(collisions.length)issues.push({type:'actual-three-line-vehicle-structure-collision',count:collisions.length});
  const report={version:TARGET_CLIFF_TRANSIT_STRUCTURE_VERSION,releaseVersion:release.version,walkwayHeight,walkwayWidth,connectionWidth,built:true,installed:false,accepted:false,finitePass:issues.length===0,status:issues.length?'built-candidate-rejected-or-unresolved':'finite-checked-candidate',galleries:Object.fromEntries(Object.entries(galleries).map(([k,v])=>[k,v.report])),connections,newCityTransitLinks:plazaLinks?.report??null,independentWalkingBridge:independentBridge?.report??null,walkingMode:walkingConnection?'independent-short-bridge':explicitlyStacked?'stacked-connected':'via-central-rail-gallery',railOpeningChanges,walkPaths,issues,vehicleClearance:{envelope:body,pass:!collisions.length,poses:checked,collisions,source:'actual release red/blue curves, actual structure/city triangles and oriented vehicle envelope',continuous:false},performance:{meshes:ownedRecords.length,triangles:ownedRecords.reduce((sum,r)=>sum+r.triangles.length,0)},navigation:{explicitTargetWalkable:true,providerRefreshRequired:true,fullRouteVerified:false},railsCreated:false,terrainChanged:false,legacyReplacement:{required:['citadel-target-city-bay-bridge'],appliedByCaller:false},limitations:['No rail/vehicle installation, terrain excavation or existing scene mutation.','Source-relative old retained track outside the replacement interval is not rebuilt by this structure.','Finite samples and closed-solid tests do not replace continuous swept-train, engineering, wave or moving-ship acceptance.','Connection terrain probes and stair dimensions are finite evidence; actual player body route still requires integration checks.','City mesh checks snapshot the supplied assets, including instance transforms; later edits require a new audit.']};
  group.userData.cliffTransitStructureReport=report;return{group,report,dispose,galleries,connections,walkPaths,independentBridge,plazaLinks};
 }catch(error){dispose();throw error;}
}
