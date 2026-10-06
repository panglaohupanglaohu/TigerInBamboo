import * as T from 'three';

export const GLOBAL_APPROACH_SUPPORT_VERSION='global-approach-support-candidate-1';
const LANES=['center','red','blue'];
const validCurve=c=>c&&['getPointAt','getTangentAt','getLength'].every(k=>typeof c[k]==='function');
const lerp=T.MathUtils.lerp;
const smooth=t=>(t=T.MathUtils.clamp(t,0,1),t*t*(3-2*t));
const frame=(curve,u)=>{const p=curve.getPointAt(u),t=curve.getTangentAt(u).normalize(),right=p.clone().normalize().cross(t).normalize(),up=t.clone().cross(right).normalize();return{p,t,right,up};};
const at=(f,x,y,z=0)=>f.p.clone().addScaledVector(f.right,x).addScaledVector(f.up,y).addScaledVector(f.t,z);

/** Independent world-coordinate support candidate. Does not create rails,
 * vehicles, upper city walkways, terrain or alter any route. sampleGround(p)
 * must return the actual first world-radial surface hit {point,objectName};
 * sampleSea(p) returns {radius,upperRadius,officialUpperRadius}. The measured
 * vehicleBox is in the production track frame INCLUDING +.12 body lift and
 * all physical wheels/rods/cargo. It is never silently replaced by -.5.
 * External obstacles remain unknown unless explicitly audited separately. */
export function createTargetGlobalRailApproachSupport(options={}){
 const group=new T.Group();group.name='target-global-approach-support';group.userData.preserveCitadelMaterials=true;
 const geometries=new Set(),materials=new Set();let disposed=false;
 const dispose=()=>{if(disposed)return;disposed=true;group.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();group.clear();};
 const report={version:GLOBAL_APPROACH_SUPPORT_VERSION,enabled:!!options.enabled,installed:false,accepted:false,built:false,finitePass:false,issues:[],externalConstraints:{globalRoads:'unknown',landmarks:'unknown',actors:'unknown'},limitations:['Independent default-off CPU candidate, not installed.','Finite triangle/OBB poses do not certify continuous motion.','No engineering load-capacity, navigation, external actors, global-road or GPU acceptance.']};
 if(!options.enabled)return{group,report,dispose};
 const {curves,sampleGround,sampleSea,vehicleBox,vehicleProvenance,vehicleSweepCurves=curves,sourceDeckInterface=null,supportGaps=[],sampleStep=.5,pierSpacing=8,maxPierHeight=12,deckWidth=8.8,cityDeckWidth=11.6,deckThickness=.55,startDeckTop=-.49,endDeckTop=-.75,transitionLength=30,waterReserve=.05}=options;
 if(!LANES.every(l=>validCurve(curves?.[l]))||typeof sampleGround!=='function'||typeof sampleSea!=='function'||!vehicleBox?.isBox3||vehicleBox.isEmpty()||!vehicleProvenance)throw new Error('GLOBAL_SUPPORT_INPUT');
 if(!['red','blue'].every(l=>validCurve(vehicleSweepCurves?.[l])))throw new Error('GLOBAL_SUPPORT_VEHICLE_SWEEP');
 if(![sampleStep,pierSpacing,maxPierHeight,deckWidth,cityDeckWidth,deckThickness,startDeckTop,endDeckTop,transitionLength,waterReserve,...vehicleBox.min.toArray(),...vehicleBox.max.toArray()].every(Number.isFinite)||sampleStep<=0||sampleStep>.5||pierSpacing<=0||pierSpacing>12||maxPierHeight<=0||deckWidth<=0||deckThickness<=0||transitionLength<=0||waterReserve<0)throw new Error('GLOBAL_SUPPORT_DIMENSIONS');
 const length=curves.center.getLength(),n=Math.ceil(length/sampleStep),samples=[],fail=code=>{if(!report.issues.includes(code))report.issues.push(code);};
 if(!Number.isFinite(length)||length<=transitionLength)throw new Error('GLOBAL_SUPPORT_LENGTH');
 if(!Array.isArray(supportGaps)||supportGaps.some(g=>![g.start,g.end,g.maxSpan].every(Number.isFinite)||g.start<=0||g.end<=g.start||g.end>=length||g.maxSpan>28||g.maxSpan<=0))throw new Error('GLOBAL_SUPPORT_OPENING');
 const topAt=s=>lerp(startDeckTop,endDeckTop,smooth(s/transitionLength));
 const widthAt=s=>lerp(deckWidth,cityDeckWidth,smooth((s-(length-18))/18));
 report.dimensions={length,sampleStep,pierSpacing,maxPierHeight,deckWidth,cityDeckWidth,deckThickness,startDeckTop,endDeckTop,transitionLength,waterReserve};
 report.vehicle={min:vehicleBox.min.toArray(),max:vehicleBox.max.toArray(),provenance:vehicleProvenance,margin:{lateral:.6,bottom:.1,top:.35,longitudinal:.1},wheelExceptions:[]};
 report.water={samples:0,minActualWaveGap:Infinity,minOfficialWaveGap:Infinity,wet:[],submergedBridgeBodySamples:0};
 report.terrain={samples:0,unknown:0,deckTopBuried:[]};
 const groundAt=p=>{const h=sampleGround(p.clone());return h?.point?.isVector3&&h.point.toArray().every(Number.isFinite)?h:null;};
 function testTop(p,s){const sea=sampleSea(p.clone()),g=groundAt(p);report.terrain.samples++;if(!g){report.terrain.unknown++;fail('GROUND_UNKNOWN');}else if(g.point.length()>p.length()+1e-5){report.terrain.deckTopBuried.push({s,world:p.toArray(),intrusion:g.point.length()-p.length()});fail('DECK_TOP_INSIDE_GROUND');}
  if(![sea?.upperRadius,sea?.officialUpperRadius,sea?.radius].every(Number.isFinite)){fail('SEA_UNKNOWN');return;}report.water.samples++;
  const gap=p.length()-sea.upperRadius,official=p.length()-sea.officialUpperRadius;
  report.water.minActualWaveGap=Math.min(report.water.minActualWaveGap,gap);report.water.minOfficialWaveGap=Math.min(report.water.minOfficialWaveGap,official);
  if(Math.min(gap,official)<waterReserve-1e-6){report.water.wet.push({s,world:p.toArray(),gap,official});fail('DECK_WATER_RESERVE');}
 }
 for(let i=0;i<=n;i++){const s=length*i/n,f=frame(curves.center,i/n),top=topAt(s),width=widthAt(s);samples.push({...f,s,top,width});for(const x of[-width/2,-width/4,0,width/4,width/2]){testTop(at(f,x,top),s);const p=at(f,x,top-deckThickness),sea=sampleSea(p);if(Number.isFinite(sea?.upperRadius)&&p.length()<sea.upperRadius)report.water.submergedBridgeBodySamples++;}}
 if(report.issues.length)return{group,report,dispose};
 // Spatial buckets merge every owned part using one warm-stone material.
 const sectorLength=Math.max(24,length/8+1e-6),buckets=new Map(),triangles=[],addTri=(a,b,c,s,part)=>{const key=Math.min(Math.floor(s/sectorLength),Math.floor((length-1e-6)/sectorLength));let bkt=buckets.get(key);if(!bkt){bkt={positions:[],parts:new Set()};buckets.set(key,bkt);}bkt.positions.push(...a.toArray(),...b.toArray(),...c.toArray());bkt.parts.add(part);triangles.push({a,b,c,s,box:new T.Box3().setFromPoints([a,b,c]),part});};
 const quad=(a,b,c,d,s,part)=>{addTri(a,b,c,s,part);addTri(a,c,d,s,part);};
 const box=(v,s,part)=>{for(const[a,b,c,d]of[[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]])quad(v[a],v[b],v[c],v[d],s,part);};
 const section=f=>[at(f,-f.width/2,f.top),at(f,f.width/2,f.top),at(f,-f.width/2,f.top-deckThickness),at(f,f.width/2,f.top-deckThickness)];
 for(let i=1;i<samples.length;i++){const a=section(samples[i-1]),b=section(samples[i]),s=(samples[i-1].s+samples[i].s)/2;quad(a[0],b[0],b[1],a[1],s,'deck-top');quad(a[2],a[3],b[3],b[2],s,'deck-bottom');quad(a[0],a[2],b[2],b[0],s,'deck-side');quad(a[1],b[1],b[3],a[3],s,'deck-side');}
 for(const i of[0,samples.length-1]){const v=section(samples[i]);quad(v[0],v[1],v[3],v[2],samples[i].s,'deck-end');}
 report.foundations=[];report.omittedStations=[];report.structuralOpenings=[];const spans=Math.ceil(length/pierSpacing);
 for(let i=0;i<=spans;i++){
  const s=length*i/spans,f=frame(curves.center,i/spans),top=topAt(s)-deckThickness,beamBottom=top-.28,width=widthAt(s),z0=i===0?0:-.35,z1=i===spans?0:.35;
  const opening=supportGaps.find(g=>s>g.start&&s<g.end);if(opening){report.omittedStations.push({s,reason:opening.id??'explicit-vehicle-underpass'});continue;}
  const beam=[];for(const y of[beamBottom,top])for(const z of[z0,z1])for(const x of[-width/2+.08,width/2-.08])beam.push(at(f,x,y,z));box(beam,s,'crossbeam');
  const feet=[],tops=[],station={s,seated:true,footingSamples:[],heightRange:[Infinity,-Infinity]};
  for(const z of[z0,z1])for(const x of[-.4,.4]){
   const topPoint=at(f,x,beamBottom,z),g=groundAt(topPoint);if(!g){station.seated=false;fail('FOOTING_UNKNOWN');continue;}
   const normal=topPoint.clone().normalize(),height=topPoint.clone().sub(g.point).dot(normal);station.heightRange[0]=Math.min(station.heightRange[0],height);station.heightRange[1]=Math.max(station.heightRange[1],height);
   if(height>maxPierHeight||height<-.12){station.seated=false;fail(height>maxPierHeight?'PIER_TOO_LONG':'GROUND_ABOVE_BEARING');}
   const foot=g.point.clone().addScaledVector(normal,-.08-Math.max(0,-height));feet.push(foot);tops.push(topPoint);station.footingSamples.push({top:topPoint.toArray(),foot:foot.toArray(),surface:g.point.toArray(),height,bearing:height<0?'embedded-ground-bearing':'pier',object:g.objectName??null});
  }
  if(station.seated&&feet.length===4)box([...feet,...tops],s,'radial-pier');report.foundations.push(station);
 }
 for(const gap of supportGaps){const before=[...report.foundations].reverse().find(f=>f.s<=gap.start),after=report.foundations.find(f=>f.s>=gap.end),span=after&&before?after.s-before.s:Infinity;if(!before?.seated||!after?.seated||span>gap.maxSpan){fail('UNDERPASS_BEARING_SPAN');continue;}
  const count=Math.ceil(span/sampleStep);for(let i=0;i<count;i++)for(const side of[-1,1]){const corners=[];for(const s of[before.s+span*i/count,before.s+span*(i+1)/count]){const f=frame(curves.center,s/length),x=side*(widthAt(s)/2-.32);for(const y of[topAt(s),topAt(s)+.5])for(const dx of[-.16,.16])corners.push(at(f,x+dx,y));}box(corners,before.s+span*(i+.5)/count,'underpass-longitudinal-girder');}
  report.structuralOpenings.push({id:gap.id??'explicit-vehicle-underpass',start:before.s,end:after.s,span,maxSpan:gap.maxSpan,bearings:[before.s,after.s],upperEdgeGirders:2,girderWidth:.32,girderDepth:.5,lowerDeckBottomUnchanged:true,engineeringCapacityVerified:false});
 }
 // A bearing collar connects to the underside of the last actual retained
 // global deck bay. Two borrowed corner sections are copied exactly; no
 // unrelated source curve point or invented equal-height joint is substituted.
 report.sourceConnection={provided:!!sourceDeckInterface,verified:false};
 if(sourceDeckInterface){
  const raw=sourceDeckInterface.bottomSections;
  if(!Array.isArray(raw)||raw.length!==2||raw.some(s=>!Array.isArray(s)||s.length!==2||s.some(p=>!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite))))throw new Error('GLOBAL_SUPPORT_SOURCE_INTERFACE');
  const sections=raw.map(s=>s.map(p=>new T.Vector3(...p))),end=section(samples[0]);
  const center=s=>s[0].clone().add(s[1]).multiplyScalar(.5),gap=center(sections[1]).distanceTo(center(end.slice(0,2)));
  if(gap>2||center(sections[0]).distanceTo(center(sections[1]))>1){fail('SOURCE_INTERFACE_TOO_FAR');}
  const topSections=[...sections,end.slice(0,2)],lower=topSections.map(s=>s.map(p=>p.clone().addScaledVector(p.clone().normalize(),-deckThickness)));
  lower[2]=end.slice(2,4);
  for(let i=1;i<topSections.length;i++){const a=topSections[i-1],b=topSections[i],c=lower[i-1],d=lower[i];quad(a[0],b[0],b[1],a[1],0,'source-bearing-collar-top');quad(c[0],c[1],d[1],d[0],0,'source-bearing-collar-bottom');quad(a[0],c[0],d[0],b[0],0,'source-bearing-collar-side');quad(a[1],b[1],d[1],c[1],0,'source-bearing-collar-side');}
  report.sourceConnection={provided:true,verified:gap<=2,mode:'bearing against exact underside of retained last global deck bay',gap,sourceGlobalInterval:sourceDeckInterface.globalInterval??null,bottomSections:raw,sourceTopOfRunningDeckUnchanged:true};
 }
 // Every top triangle midpoint/centroid is checked too: endpoint samples alone
 // cannot certify dry chord interiors on a sphere.
 for(const tri of triangles.filter(t=>t.part==='deck-top'||t.part==='source-bearing-collar-top'))for(const p of[tri.a.clone().add(tri.b).add(tri.c).multiplyScalar(1/3),tri.a.clone().lerp(tri.c,.5)])testTop(p,null);
 const bodyBox=vehicleBox.clone();bodyBox.min.add(new T.Vector3(-.6,-.1,-.1));bodyBox.max.add(new T.Vector3(.6,.35,.1));
 report.vehicleClearance={poses:0,triangleTests:0,collisions:[],pass:true,scope:vehicleSweepCurves===curves?'approach only':'caller full vehicle curves'};
 const unitBox=new T.Box3(),triangle=new T.Triangle();
 const structureBounds=new T.Box3();for(const t of triangles)structureBounds.union(t.box);
 for(const lane of['red','blue']){const count=Math.ceil(vehicleSweepCurves[lane].getLength()/sampleStep);for(let i=0;i<=count;i++){
  const f=frame(vehicleSweepCurves[lane],i/count),matrix=new T.Matrix4().makeBasis(f.right,f.up,f.t).setPosition(f.p),inverse=matrix.clone().invert(),worldBox=bodyBox.clone().applyMatrix4(matrix);report.vehicleClearance.poses++;if(!worldBox.intersectsBox(structureBounds))continue;
  for(const tri of triangles){if(!worldBox.intersectsBox(tri.box))continue;report.vehicleClearance.triangleTests++;triangle.set(tri.a.clone().applyMatrix4(inverse),tri.b.clone().applyMatrix4(inverse),tri.c.clone().applyMatrix4(inverse));unitBox.copy(bodyBox);if(unitBox.intersectsTriangle(triangle)){report.vehicleClearance.collisions.push({lane,u:i/count,part:tri.part,stationDistance:tri.s,world:f.p.toArray()});report.vehicleClearance.pass=false;fail('ACTUAL_VEHICLE_ENVELOPE_CONTACT');break;}}
 }}
 report.ends=samples.filter((_,i)=>i===0||i===samples.length-1).map(f=>({s:f.s,railWorld:f.p.toArray(),deckTop:f.top,width:f.width,section:section(f).map(v=>v.toArray())}));
 report.supportScope={center:[0,1],upperWalkway:false,cityEndSharedSection:true,sourceEndRequiresExistingDeckTransition:!report.sourceConnection.verified,globalApproachSupportBuilt:false};
 if(report.issues.length)return{group,report,dispose};
 const material=new T.MeshStandardMaterial({color:0xd8c7ab,roughness:.96});material.userData.preserveCitadelMaterial=true;materials.add(material);
 for(const[key,bkt]of buckets){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(bkt.positions,3));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();geometries.add(g);const mesh=new T.Mesh(g,material);mesh.name='global-approach-support-sector-'+key;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData={targetWalkable:false,targetGlobalApproachSupport:true,preserveCitadelMaterials:true,parts:[...bkt.parts]};group.add(mesh);}
 report.performance={meshes:group.children.length,materials:materials.size,triangles:triangles.length};report.built=true;report.finitePass=true;report.supportScope.globalApproachSupportBuilt=true;
 // Overall acceptance deliberately stays false: this factory does not own a
 // complete global actor/road/landmark snapshot nor a production installation.
 return{group,report,dispose};
}
