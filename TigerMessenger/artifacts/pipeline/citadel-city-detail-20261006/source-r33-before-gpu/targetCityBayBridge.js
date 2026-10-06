import * as THREE from 'three';

// Castle-local endpoints. The old-town bay-facing exit is +X, not its historic
// report.exits.bridge (-X). Callers should pass surveyed endpoints explicitly.
export const TARGET_CITY_BAY_BRIDGE_PATH = Object.freeze([
  Object.freeze([-32.230,17.3,3.767]),Object.freeze([68.51,13.2,36.84]),
]);
const finite3=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);

/** Real arch bridge, identity root in castle-local coordinates. Height callbacks
 * are read-only (x,z)->castle-local Y|null. No fallback claims ground support.
 * curve='catmull-rom' turns control points into a smooth arc; default preserves
 * all supplied polyline corners. Navigation/colliders are caller-owned. */
export function createTargetCityBayBridge({path=TARGET_CITY_BAY_BRIDGE_PATH,width=4.4,maxSpan=12,pierWidth=1.35,
  curve='polyline',groundHeightAt=null,oceanHeightAt=null,palette={},requiredBoatWidth=4,
  requiredBoatHeight=3,requiredWaterDepth=.8,maximumWalkingSlope=.12,sideOpeningFootprints=[]}={}) {
  if(!Array.isArray(path)||path.length<2||!path.every(finite3))throw new TypeError('path requires finite castle-local triples');
  for(const [name,value]of Object.entries({width,maxSpan,pierWidth,requiredBoatWidth,requiredBoatHeight,requiredWaterDepth,maximumWalkingSlope}))if(!Number.isFinite(value)||value<=0)throw new RangeError(`${name} must be positive and finite`);
  if(width<2||maxSpan<5||pierWidth>=maxSpan*.45)throw new RangeError('bridge dimensions leave insufficient walking/arch width');
  if(!['polyline','catmull-rom'].includes(curve))throw new RangeError('unknown path curve');
  for(const f of[groundHeightAt,oceanHeightAt])if(f!==null&&typeof f!=='function')throw new TypeError('height samplers must be functions or null');
  for(let i=1;i<path.length;i++)if(Math.hypot(path[i][0]-path[i-1][0],path[i][2]-path[i-1][2])<.01)throw new RangeError('zero horizontal path segment');
  if(!Array.isArray(sideOpeningFootprints)||sideOpeningFootprints.some(p=>!Array.isArray(p)||p.length<3||p.some(v=>!Array.isArray(v)||v.length!==2||!v.every(Number.isFinite))))throw new TypeError('sideOpeningFootprints require finite convex XZ polygons');
  let control=path.map(p=>[...p]);
  if(curve==='catmull-rom'){
    const c=new THREE.CatmullRomCurve3(path.map(p=>new THREE.Vector3(...p)),false,'centripetal');
    const count=Math.max(2,Math.ceil(c.getLength()/maxSpan));control=c.getSpacedPoints(count).map(p=>p.toArray());
  }
  const nodes=[[...control[0]]];
  for(let i=1;i<control.length;i++){
    const a=control[i-1],b=control[i],count=Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/maxSpan);
    for(let j=1;j<=count;j++)nodes.push(mix(a,b,j/count));
  }
  const cols={stone:'#e3d2ae',trim:'#f0e3c4',paving:'#ded4bc',rail:'#6d725d',cap:'#c69354',...palette};
  const group=new THREE.Group();group.name='citadel-target-city-bay-bridge';group.userData.preserveCitadelMaterials=true;
  const gs=new Set(),ms=new Set(),mats={};
  for(const[k,color]of Object.entries(cols)){const m=new THREE.MeshStandardMaterial({color,roughness:k==='rail'?.72:.92});m.name=`target-bay-bridge-${k}`;m.userData={preserveCitadelMaterial:true,preserveCitadelMaterials:true};ms.add(m);mats[k]=m;}
  const unitBox=new THREE.BoxGeometry(1,1,1);gs.add(unitBox);
  function mesh(name,g,mat){gs.add(g);const o=new THREE.Mesh(g,mats[mat]);o.name=name;o.castShadow=true;o.receiveShadow=true;o.userData.preserveCitadelMaterials=true;group.add(o);return o;}
  function box(name,size,pos,yaw=0,mat='stone'){const o=mesh(name,unitBox,mat);o.position.fromArray(pos);o.scale.fromArray(size);o.rotation.y=yaw;return o;}
  const samples={ground:0,ocean:0},sampleCache={ground:new Map(),ocean:new Map()};
  function sample(kind,x,z){
    const fn=kind==='ground'?groundHeightAt:oceanHeightAt;if(!fn)return null;const key=`${x.toFixed(7)},${z.toFixed(7)}`,cache=sampleCache[kind];if(cache.has(key))return cache.get(key);
    const y=fn(x,z);samples[kind]++;if(y!==null&&!Number.isFinite(y))throw new TypeError(`${kind} sampler must return finite castle-local Y or null`);cache.set(key,y);return y;
  }
  const sections=nodes.map((p,i)=>{
    const tangents=[];for(const j of[i-1,i])if(j>=0&&j<nodes.length-1){const a=nodes[j],b=nodes[j+1],l=Math.hypot(b[0]-a[0],b[2]-a[2]);tangents.push([(b[0]-a[0])/l,(b[2]-a[2])/l]);}
    const ns=tangents.map(t=>[-t[1],t[0]]),sx=ns.reduce((a,n)=>a+n[0],0),sz=ns.reduce((a,n)=>a+n[1],0),l=Math.hypot(sx,sz);
    if(l<.1)throw new RangeError('hairpin bridge needs separate junction');const normal=[sx/l,sz/l],denom=normal[0]*ns[0][0]+normal[1]*ns[0][1];
    if(denom<.65)throw new RangeError('bridge corner too acute for shared miter');
    const half=width/(2*denom);return{point:p,normal,half,left:[p[0]+normal[0]*half,p[1],p[2]+normal[1]*half],right:[p[0]-normal[0]*half,p[1],p[2]-normal[1]*half]};
  });
  const deckThickness=.42,archBand=.56,spans=[],walkSurfaces=[],piers=[];let maximumGrade=0;
  function topSlab(name,vertices){
    const v=[...vertices,...vertices.map(p=>[p[0],p[1]-deckThickness,p[2]]),mix(vertices[0],vertices[3],.5),mix(vertices[1],vertices[2],.5)],idx=[0,9,8,0,1,9,8,2,3,8,9,2,4,6,5,4,7,6,0,4,1,1,4,5,1,5,2,2,5,6,2,6,3,3,6,7,3,7,0,0,7,4];
    for(let k=0;k<idx.length;k+=3)[idx[k+1],idx[k+2]]=[idx[k+2],idx[k+1]];
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(idx.flatMap(i=>v[i]),3));g.computeVertexNormals();return mesh(name,g,'paving');
  }
  for(let i=0;i<nodes.length-1;i++){
    const a=nodes[i],b=nodes[i+1],dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz),slope=(b[1]-a[1])/length,halfPier=Math.min(pierWidth/2,length*.15),clear=length-2*halfPier;
    if(clear<2)throw new RangeError('path corner leaves arch span below 2m; simplify path');
    const rise=Math.min(4.3,clear*.37),crown=-deckThickness-archBand,spring=crown-rise;
    const arc=x=>crown-rise*(1-Math.sqrt(Math.max(0,1-((x-length/2)/(clear/2))**2)));
    const intrados=x=>{const u=THREE.MathUtils.clamp((x-halfPier)/clear*24,0,24),j=Math.min(23,Math.floor(u)),t=u-j;return arc(halfPier+clear*j/24)*(1-t)+arc(halfPier+clear*(j+1)/24)*t;};
    const soffit=x=>intrados(x)+slope*x+a[1];
    maximumGrade=Math.max(maximumGrade,Math.abs(slope));
    // Outer solid is only ABOVE the intrados. Its concave lower boundary is
    // the true opening, and extrusion creates the full-width vault surface.
    const shape=new THREE.Shape();shape.moveTo(0,spring-.5);shape.lineTo(0,-deckThickness);shape.lineTo(length,-deckThickness);shape.lineTo(length,spring-.5);shape.lineTo(length-halfPier,spring-.5);shape.lineTo(length-halfPier,spring);
    const steps=24;
    for(let j=1;j<=steps;j++){const x=length-halfPier-clear*j/steps;shape.lineTo(x,crown-rise*(1-Math.sqrt(Math.max(0,1-((x-length/2)/(clear/2))**2))));}
    shape.lineTo(halfPier,spring-.5);shape.closePath();
    const g=new THREE.ExtrudeGeometry(shape,{depth:width-.2,bevelEnabled:false,curveSegments:24,steps:1});
    const p=g.attributes.position;for(let j=0;j<p.count;j++)p.setXYZ(j,p.getX(j),p.getY(j)+slope*p.getX(j),p.getZ(j)-(width-.2)/2);p.needsUpdate=true;g.computeVertexNormals();
    const arch=mesh(`bay-bridge-true-arch-${i}`,g,'stone');arch.position.fromArray(a);arch.rotation.y=-Math.atan2(dz,dx);
    const sa=sections[i],sb=sections[i+1],poly=[sa.right,sb.right,sb.left,sa.left];
    const deck=topSlab(`bay-bridge-walking-deck-${i}`,poly);deck.userData.targetWalkable=true;
    walkSurfaces.push({id:deck.name,polygon:poly.map(p=>[p[0],p[2]]),corners:poly,from:[...a],to:[...b],clearWidth:width,slope});
    // The face ring follows the intrados as masonry wedges, not a decal arch.
    for(const side of[-1,1])for(let j=0;j<24;j++){
      const t0=(j+.03)/24,t1=(j+.97)/24,x0=halfPier+clear*t0,x1=halfPier+clear*t1;
      const y0=soffit(x0)-a[1]-slope*x0,y1=soffit(x1)-a[1]-slope*x1;
      const sh=new THREE.Shape();sh.moveTo(x0,y0);sh.lineTo(x1,y1);sh.lineTo(x1,y1+.24);sh.lineTo(x0,y0+.24);sh.closePath();
      const geo=new THREE.ExtrudeGeometry(sh,{depth:.1,bevelEnabled:false,steps:1});const pa=geo.attributes.position;
      for(let k=0;k<pa.count;k++)pa.setXYZ(k,pa.getX(k),pa.getY(k)+slope*pa.getX(k),pa.getZ(k)+side*(width/2-.06));geo.computeVertexNormals();
      const stone=mesh(`bay-bridge-arch-trim-${i}-${side}-${j}`,geo,'trim');stone.position.fromArray(a);stone.rotation.copy(arch.rotation);
    }
    const navigationSamples=[];
    for(const x of[length/2-requiredBoatWidth/2,length/2,length/2+requiredBoatWidth/2])for(const across of[-width/2,0,width/2]){
      const px=a[0]+dx*x/length-dz*across/length,pz=a[2]+dz*x/length+dx*across/length,sea=sample('ocean',px,pz),ground=sample('ground',px,pz),ceiling=x<halfPier||x>length-halfPier?null:soffit(x);
      navigationSamples.push({x:px,z:pz,oceanY:sea,groundY:ground,soffitY:ceiling,headroom:sea===null||ceiling===null?null:ceiling-sea,depth:sea===null||ground===null?null:sea-ground});
    }
    const missing=navigationSamples.some(p=>p.headroom===null||p.depth===null),navPass=!missing&&clear>=requiredBoatWidth&&navigationSamples.every(p=>p.headroom>=requiredBoatHeight&&p.depth>=requiredWaterDepth);
    spans.push({id:arch.name,from:[...a],to:[...b],length,clearOpeningWidth:clear,archRise:rise,crownY:soffit(length/2),springAtEnds:[soffit(halfPier),soffit(length-halfPier)],navigationSamples,navigationSampledPass:missing?null:navPass});
  }
  // Ground may embed the pier or underside at an abutment. Only intrusion into
  // the actual triangulated walking TOP is a passage obstruction. Test interior
  // deck probes separately from footing corners (which can lie outside the deck).
  group.updateMatrixWorld(true);
  const deckMeshes=group.children.filter(m=>m.name.startsWith('bay-bridge-walking-deck-'));
  const deckRay=new THREE.Raycaster(),deckRayY=Math.max(...nodes.map(p=>p[1]))+2;
  function walkingTopAt(x,z){deckRay.set(new THREE.Vector3(x,deckRayY,z),new THREE.Vector3(0,-1,0));return deckRay.intersectObjects(deckMeshes,false)[0]?.point.y??null;}
  // Piers extend only to actual sampled ground when all footing samples exist.
  // Missing support renders the upper masonry head and is explicitly unseated.
  for(let i=0;i<sections.length;i++){
    const s=sections[i],p=s.point,n=s.normal,t=[n[1],-n[0]],pw=pierWidth,pd=2*s.half+.16;
    const footprint=[[-pw/2,-pd/2],[pw/2,-pd/2],[pw/2,pd/2],[-pw/2,pd/2]].map(([x,z])=>[p[0]+t[0]*x+n[0]*z,p[2]+t[1]*x+n[1]*z]);
    const feet=[...footprint,[p[0],p[2]]].map(q=>({x:q[0],z:q[1],groundY:sample('ground',...q),oceanY:sample('ocean',...q)}));
    const complete=feet.every(f=>f.groundY!==null),top=p[1]-deckThickness-.02;
    const nominalHeadBottom=p[1]-deckThickness-archBand-Math.max(spans[Math.max(0,i-1)]?.archRise??0,spans[Math.min(i,spans.length-1)]?.archRise??0)-.5;
    const bottom=complete?Math.min(...feet.map(f=>f.groundY))-.15:nominalHeadBottom;
    const deckClearanceSamples=[];
    for(const along of[-pw/2,0,pw/2])for(const across of[-width*.45,0,width*.45]){
      const offset=Math.abs(along)<1e-9?(i===0?.001:i===sections.length-1?-.001:along):along;
      const x=p[0]+t[0]*offset+n[0]*across,z=p[2]+t[1]*offset+n[1]*across,walkingTopY=walkingTopAt(x,z);
      if(walkingTopY===null)continue; // beyond an endpoint, not part of the walk
      const groundY=sample('ground',x,z);deckClearanceSamples.push({x,z,groundY,walkingTopY,intrusion:groundY===null?null:Math.max(0,groundY-walkingTopY)});
    }
    const deckKnown=deckClearanceSamples.length>0&&deckClearanceSamples.every(f=>f.groundY!==null);
    const obstructed=deckClearanceSamples.some(f=>f.intrusion!==null&&f.intrusion>1e-5),depth=top-bottom;
    if(depth>0){box(`bay-bridge-pier-${i}`,[pw,depth,pd],[p[0],(top+bottom)/2,p[2]],-Math.atan2(t[1],t[0]));box(`bay-bridge-pier-cap-${i}`,[pw+.28,.23,pd+.12],[p[0],top-.1,p[2]],-Math.atan2(t[1],t[0]),'trim');}
    piers.push({id:`bay-bridge-pier-${i}`,footprint,topY:top,modelBottomY:bottom,footingY:complete?bottom:null,groundSamples:feet,groundKnown:complete,walkingTopY:p[1],deckClearanceSamples,deckClearanceKnown:deckKnown,supportSampledPass:complete&&deckKnown&&!obstructed,groundObstructsDeck:obstructed,continuousSupportVerified:false});
  }
  // Clip openings before batching. Expand each footprint by .35 m so the
  // outer curb, cap and post radii cannot narrow the caller's clear corridor.
  const sideOpenings=[];
  function insideInterval(a,b,polygon){
    const signed=polygon.reduce((sum,p,i)=>{const q=polygon[(i+1)%polygon.length];return sum+p[0]*q[1]-q[0]*p[1];},0),poly=signed<0?[...polygon].reverse():polygon;let lo=0,hi=1;
    for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],ex=q[0]-p[0],ez=q[1]-p[1],f=ex*(a[2]-p[1])-ez*(a[0]-p[0])+.35*Math.hypot(ex,ez),d=ex*(b[2]-a[2])-ez*(b[0]-a[0]);if(Math.abs(d)<1e-10){if(f<0)return null;continue;}const t=-f/d;if(d>0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>=hi)return null;}return[Math.max(0,lo),Math.min(1,hi)];
  }
  for(let i=0;i<sections.length-1;i++)for(const side of['left','right']){
    const A=sections[i][side],B=sections[i+1][side];let ranges=[[0,1]];
    for(const polygon of sideOpeningFootprints){const hole=insideInterval(A,B,polygon);if(!hole)continue;sideOpenings.push({spanIndex:i,side,from:mix(A,B,hole[0]),to:mix(A,B,hole[1])});ranges=ranges.flatMap(([lo,hi])=>hole[1]<=lo||hole[0]>=hi?[[lo,hi]]:[[lo,Math.max(lo,hole[0])],[Math.min(hi,hole[1]),hi]].filter(([a,b])=>b-a>1e-7));}
    for(const [part,[lo,hi]]of ranges.entries()){
     const a=mix(A,B,lo),b=mix(A,B,hi),v=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),horizontal=Math.hypot(v.x,v.z);if(horizontal<.03)continue;const yaw=-Math.atan2(v.z,v.x),count=Math.ceil(horizontal/2.5),outward=side==='left'?1:-1,centre=mix(a,b,.5),nx=-v.z/horizontal*outward,nz=v.x/horizontal*outward,suffix=`${i}-${side}-${part}`;
     const curb=box(`bay-bridge-curb-${suffix}`,[horizontal,.2,.2],[centre[0]+nx*.12,centre[1]+.10,centre[2]+nz*.12],yaw,'trim');curb.rotation.z=Math.atan2(v.y,horizontal);
     const rail=box(`bay-bridge-handrail-${suffix}`,[v.length(),.085,.075],[centre[0]+nx*.14,centre[1]+1.03,centre[2]+nz*.14],yaw,'rail');rail.rotation.z=Math.atan2(v.y,horizontal);
     for(let j=0;j<count;j++){const p=mix(a,b,j/count);box(`bay-bridge-rail-post-${suffix}-${j}`,[.105,.91,.105],[p[0]+nx*.14,p[1]+.62,p[2]+nz*.14],0,'rail');box(`bay-bridge-post-cap-${suffix}-${j}`,[.17,.09,.17],[p[0]+nx*.14,p[1]+1.08,p[2]+nz*.14],0,'cap');}
    }
  }
  // Bake repeated static ornament by material; arches/decks/piers retain their
  // identities for ray tests and the caller's structural audit.
  function bake(prefix,material,label){
    const parts=group.children.filter(m=>m.isMesh&&m.name.startsWith(prefix)),positions=[],normals=[],retire=new Set();
    if(!parts.length)return;
    for(const part of parts){part.updateMatrix();const g=part.geometry.index?part.geometry.toNonIndexed():part.geometry.clone();g.applyMatrix4(part.matrix);positions.push(...g.attributes.position.array);normals.push(...g.attributes.normal.array);g.dispose();retire.add(part.geometry);group.remove(part);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));const o=mesh(label,g,material);o.userData.bakedParts=parts.map(m=>m.name);
    for(const old of retire)if(old!==unitBox&&!group.children.some(m=>m.geometry===old)){old.dispose();gs.delete(old);}
  }
  bake('bay-bridge-arch-trim-','trim','bay-bridge-batched-arch-stones');
  bake('bay-bridge-curb-','trim','bay-bridge-batched-curbs');
  bake('bay-bridge-handrail-','rail','bay-bridge-batched-handrails');
  bake('bay-bridge-rail-post-','rail','bay-bridge-batched-rail-posts');
  bake('bay-bridge-post-cap-','cap','bay-bridge-batched-post-caps');
  group.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(group);let meshes=0,triangles=0;
  group.traverse(m=>{if(m.isMesh){meshes++;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;}});
  const report={revision:'target-city-bay-bridge-1',coordinateFrame:'castle-local; identity group transform',path:path.map(p=>[...p]),curve,nodes,width,
    endpoints:{oldCity:[...nodes[0]],newCity:[...nodes.at(-1)],oldExitCorrection:'bay-facing old-city local +X exit; historic report -X exit is exterior'},
    walkSurfaces,piers,spans,sideOpenings,sideOpeningFootprints:sideOpeningFootprints.map(p=>p.map(v=>[...v])),maximumWalkingSlope:maximumGrade,walkingGradePass:maximumGrade<=maximumWalkingSlope,
    boatRequirements:{width:requiredBoatWidth,height:requiredBoatHeight,waterDepth:requiredWaterDepth},
    supportSampledPass:piers.every(p=>p.supportSampledPass),navigationSampledPass:spans.some(s=>s.navigationSampledPass===true),
    knownNavigableOpenings:spans.filter(s=>s.navigationSampledPass===true).map(s=>s.id),sampling:{...samples,method:'construction-time read-only callbacks; footing corners+centre, interior actual-deck clearance probes and nine under-arch probes'},
    bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},performance:{meshes,triangles,materials:ms.size},
    validation:{gpuVerified:false,continuousSupportVerified:false,navigationIntegrated:false,terrainChanged:false},
    limitations:['Finite footing and opening samples are not a continuous collision or navigation certificate.','Missing ground draws only pier heads and never claims a terrain footing.','A sampled navigable arch does not establish an approach channel to it.','Caller must check collisions with existing cities, terrain, ships and railways before attachment.']};
  group.userData.bridgeCandidateReport=report;let disposed=false;
  return{group,report,dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const g of gs)g.dispose();for(const m of ms)m.dispose();group.clear();}};
}
