import * as T from 'three';
/** Read-only, non-installing lower-deck diagnostic. Samples are castle-local;
 * bridgeRoot matrixWorld must already be genuinely world-space. */
export function createTargetCliffTransitPlan({castleMatrix,bridgeReport,bridgeRoot,sampleTerrain,sampleSea,drop=6,step=1,laneSpacing=4.1,bodyHalfWidth=1.72,bodyHeight=3.022,bodyLength=6.98,margin=.6,maxGrade=.04,minCurveRadius=25,bankControls=null,mode='local-drop',waterClearance=5.2,lowerRadius=null}={}){
 if(!castleMatrix||!bridgeReport?.path||!bridgeRoot||typeof sampleTerrain!=='function'||typeof sampleSea!=='function')throw new TypeError('actual bridge report/root, castle matrix and final samplers required');
 if(![drop,step,laneSpacing,bodyHalfWidth,bodyHeight,bodyLength,margin,maxGrade,minCurveRadius,waterClearance].every(v=>Number.isFinite(v)&&v>0))throw new RangeError('positive finite dimensions required');
 if(!Array.isArray(bridgeReport.path)||bridgeReport.path.length<2||bridgeReport.path.some(p=>!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite)))throw new TypeError('at least two finite bridge triples required');
 const entries=castleMatrix.isMatrix4?castleMatrix.elements:castleMatrix;if(!entries||entries.length!==16||!Array.from(entries).every(Number.isFinite))throw new TypeError('finite 4x4 matrix required');
 const matrix=castleMatrix.isMatrix4?castleMatrix.clone():new T.Matrix4().fromArray(castleMatrix),inverse=matrix.clone().invert();
 if(Math.abs(matrix.determinant())<1e-12)throw new RangeError('invertible castle matrix required');
 const top=bridgeReport.path.map(p=>new T.Vector3(...p)),controls=top.map(p=>p.clone().add(new T.Vector3(0,-drop,0)));let curve=new T.CurvePath(),radialSolve=null;
 if(controls.some(p=>!p.toArray().every(Number.isFinite)))throw new TypeError('finite bridge coordinates required');
 if(top.some((p,i)=>i&&p.distanceTo(top[i-1])<1e-6))throw new RangeError('duplicate bridge path node');
 for(let i=1;i<controls.length;i++)curve.add(new T.LineCurve3(controls[i-1].clone().applyMatrix4(matrix),controls[i].clone().applyMatrix4(matrix)));
 if(mode==='radial'){
  const planar=new T.CatmullRomCurve3(top.map(p=>p.clone()),false,'centripetal'),upperCurve=new T.CurvePath();for(let i=1;i<top.length;i++)upperCurve.add(new T.LineCurve3(top[i-1],top[i]));
  let maxAllowed=Infinity,minRequired=0;const bounds=[];
  for(let i=0;i<=160;i++){const q=upperCurve.getPoint(i/160),world=q.clone().applyMatrix4(matrix),v=sampleSea(q.x,q.z),y=typeof v==='number'?v:v?.height;if(!Number.isFinite(y))continue;const seaRadius=new T.Vector3(q.x,y,q.z).applyMatrix4(matrix).length();const upper=world.length()-(bodyHeight+margin+1.1);maxAllowed=Math.min(maxAllowed,upper);minRequired=Math.max(minRequired,seaRadius+waterClearance);bounds.push({u:i/160,upper,lower:seaRadius+waterClearance});}
  if(!bounds.length)throw new Error('radial solve requires real sea samples');
  if(lowerRadius!==null&&(!Number.isFinite(lowerRadius)||lowerRadius<=0))throw new RangeError('positive finite lowerRadius required');
  const radius=lowerRadius??maxAllowed;
  class RadialCurve extends T.Curve{getPoint(t,target=new T.Vector3()){const p=planar.getPoint(t);return target.copy(p).applyMatrix4(matrix).normalize().multiplyScalar(radius);}}
  curve=new RadialCurve();const deviations=[];for(let i=0;i<=160;i++){const q=curve.getPoint(i/160).applyMatrix4(inverse);let nearest=Infinity;for(let j=1;j<top.length;j++){const a=top[j-1],b=top[j],dx=b.x-a.x,dz=b.z-a.z,t=T.MathUtils.clamp(((q.x-a.x)*dx+(q.z-a.z)*dz)/(dx*dx+dz*dz),0,1);nearest=Math.min(nearest,Math.hypot(q.x-a.x-t*dx,q.z-a.z-t*dz));}deviations.push(nearest);}
  radialSolve={radius,maxAllowed,minRequired,verticalFeasible:radius>=minRequired&&radius<=maxAllowed,waterClearance,upperThicknessAllowance:1.1,maximumPlanDeviation:Math.max(...deviations),upperHalfWidth:bridgeReport.width/2,centerWithinUpperProjection:Math.max(...deviations)<=bridgeReport.width/2,bounds,method:'Centripetal chart XZ curve projected to constant world radius; fixed upper bridge unchanged.'};
 }else if(mode!=='local-drop')throw new Error('unknown plan mode');
 const triangles=[];bridgeRoot.updateWorldMatrix(true,true);bridgeRoot.traverse(o=>{if(!o.isMesh||!o.geometry?.attributes.position)return;const p=o.geometry.attributes.position,idx=o.geometry.index,n=idx?.count??p.count;for(let i=0;i<n;i+=3){const v=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,idx?idx.getX(i+j):i+j).applyMatrix4(o.matrixWorld));triangles.push({name:o.name,points:v,box:new T.Box3().setFromPoints(v)});}});
 const issues=[],sections=[],count=Math.ceil(curve.getLength()/step),body=new T.Box3(new T.Vector3(-bodyHalfWidth-margin,-.5,-bodyLength/2),new T.Vector3(bodyHalfWidth+margin,bodyHeight+margin,bodyLength/2));let maximumGrade=0;
 const read=(fn,x,z)=>{const s=fn(x,z),y=typeof s==='number'?s:s?.height;return Number.isFinite(y)?y:null;};
 for(let i=0;i<=count;i++){
  const u=i/count,p=curve.getPoint(u),tangent=curve.getTangent(u).normalize(),radial=p.clone().normalize(),right=new T.Vector3().crossVectors(radial,tangent).normalize(),up=new T.Vector3().crossVectors(tangent,right).normalize();
  const vertical=Math.abs(tangent.dot(radial)),grade=vertical/Math.sqrt(Math.max(1e-12,1-vertical*vertical));maximumGrade=Math.max(maximumGrade,grade);
  const section={i,u,local:p.clone().applyMatrix4(inverse).toArray(),world:p.toArray(),up:up.toArray(),grade,lanes:[]};
  for(const side of[-1,1]){const center=p.clone().addScaledVector(right,side*laneSpacing/2),m=new T.Matrix4().makeBasis(right,up,tangent).setPosition(center),inv=m.clone().invert(),box=body.clone().applyMatrix4(m),local=center.clone().applyMatrix4(inverse),hits=[];
   for(const tri of triangles)if(box.intersectsBox(tri.box)&&body.intersectsTriangle(new T.Triangle(...tri.points.map(v=>v.clone().applyMatrix4(inv))))){hits.push(tri.name);if(hits.length>=4)break;}
   let missing=0,soil=0,wet=0;const probes=[];
   for(const along of[-bodyLength/2,0,bodyLength/2])for(const across of[-bodyHalfWidth-margin,0,bodyHalfWidth+margin]){const w=center.clone().addScaledVector(tangent,along).addScaledVector(right,across).addScaledVector(up,-.5),q=w.clone().applyMatrix4(inverse),land=read(sampleTerrain,q.x,q.z),sea=read(sampleSea,q.x,q.z);if(sea===null)missing++;if(land!==null&&land>q.y+.02)soil++;if(sea!==null&&sea>q.y)wet++;probes.push({local:q.toArray(),terrain:land,sea});}
   const lane={side,local:local.toArray(),world:center.toArray(),bridgeHits:[...new Set(hits)],soil,wet,missing,probes};section.lanes.push(lane);if(hits.length||soil||wet||missing)issues.push({i,side,bridgeHits:lane.bridgeHits,soil,wet,missing});
  }sections.push(section);
 }
 let minimumRadius=Infinity;for(let i=1;i<sections.length-1;i++){const a=new T.Vector3(...sections[i-1].world),b=new T.Vector3(...sections[i].world),c=new T.Vector3(...sections[i+1].world),ab=a.distanceTo(b),bc=b.distanceTo(c),ca=c.distanceTo(a),cross=b.clone().sub(a).cross(c.clone().sub(a)).length();if(cross>1e-10)minimumRadius=Math.min(minimumRadius,ab*bc*ca/(2*cross));}
 const turns=[];for(let i=1;i<controls.length-1;i++){const a=controls[i].clone().sub(controls[i-1]).normalize(),b=controls[i+1].clone().sub(controls[i]).normalize(),angle=a.angleTo(b);if(mode==='local-drop'&&angle>.01)turns.push({index:i,radians:angle,minimumRadius:0,reason:'Unrounded authored bridge corner; track fillet not solved.'});}
 const endpoints=mode==='radial'?Array.from({length:9},(_,i)=>curve.getPoint(i/8).applyMatrix4(inverse).toArray()):controls.map(p=>p.toArray());const bankCandidates=bankControls??{old:[endpoints[0]],new:[endpoints.at(-1)]};
 return{worldCurve:curve,report:{version:'target-cliff-transit-plan-1',accepted:false,installed:false,mode,radialSolve,status:issues.length||turns.length||maximumGrade>maxGrade||minimumRadius<minCurveRadius||radialSolve?.verticalFeasible===false||radialSolve?.centerWithinUpperProjection===false?'failed-diagnostic':'sampled-central-only',frame:'controls castle-local; curve/OBB world; final surface callbacks castle-local',controls:endpoints,upperPath:bridgeReport.path,bankCandidates,bankConnectionsSolved:false,dimensions:{drop,laneSpacing,bodyHalfWidth,bodyHeight,bodyLength,margin,requiredWidth:laneSpacing+2*(bodyHalfWidth+margin),upperDeckWidth:bridgeReport.width},minimumSampledCurveRadius:Number.isFinite(minimumRadius)?minimumRadius:null,minCurveRadius,curveRadiusPass:minimumRadius>=minCurveRadius,bodyProjectionCovered:radialSolve?radialSolve.maximumPlanDeviation+laneSpacing/2+bodyHalfWidth+margin<=bridgeReport.width/2:false,maximumGrade,maxGrade,gradePass:maximumGrade<=maxGrade,turns,issues,sections,triangleCount:triangles.length,limits:['Discrete 9 underbody points detect solid-heightfield terrain; no full terrain triangle sweep.','Bridge triangle/vehicle oriented-box checks use static actual bridge meshes. Instanced bridge obstacles unsupported.','Endpoints alone do not establish shore routes, global splice, foundations or navigation.','Existing 4.4m walkway does not imply support for wider lower double-track deck. No bridge geometry changed.']}};
}

/** Finite external-shore approach search. Does not connect global rail or solve
 * existing bridge pillars; every returned route remains an uninstalled candidate. */
export function findTargetCliffBankCandidates({plan,castleMatrix,sampleTerrain,sampleSea,maxCandidates=3}={}){
 const r=plan?.report;if(!r?.radialSolve)throw new TypeError('radial plan required');
 const m=castleMatrix.isMatrix4?castleMatrix:new T.Matrix4().fromArray(castleMatrix),inv=m.clone().invert(),radius=r.radialSolve.radius;
 const read=(fn,p)=>{const v=fn(p.x,p.z),h=typeof v==='number'?v:v?.height;return Number.isFinite(h)?h:null;};
 const clean=r.sections.filter(s=>s.lanes.every(l=>!l.soil&&!l.wet&&!l.missing));
 if(!clean.length)return{accepted:false,candidates:[],reason:'no terrain-clear central attachment'};
 const result={accepted:false,installed:false,method:'finite constant-radius shore approach search, 1m centre arc samples and 9 underbody width/length probes',banks:{},limits:['No global splice or foundation installed.','Actual old bridge pillar/arch collisions remain separately unresolved.','Terrain sampler semantics inherited; no tunnel excavated, every returned probe stays above sampled solid terrain.']};
 for(const side of['old','new']){const attach=side==='old'?clean[Math.min(5,clean.length-1)]:clean[Math.max(0,clean.length-6)],origin=r.controls[side==='old'?0:r.controls.length-1],candidates=[],failures={soil:0,sea:0};let examined=0;
  for(const lateral of[0,4,8,12,16,20,24])for(const front of[4,8,12,16,20,24,28]){
   const p=new T.Vector3(origin[0]+-lateral,origin[1],origin[2]+front),a=p.applyMatrix4(m).normalize().multiplyScalar(radius),b=new T.Vector3(...attach.world),length=a.distanceTo(b);if(length<4)continue;examined++;
   const arc=t=>a.clone().lerp(b,t).normalize().multiplyScalar(radius),n=Math.ceil(length);let soil=0,seaMiss=0,minimumTerrainGap=Infinity;
   for(let i=0;i<=n&&!soil&&!seaMiss;i++){const w=arc(i/n),forward=arc(Math.min(1,(i+.1)/n)).sub(arc(Math.max(0,(i-.1)/n))).normalize(),right=w.clone().normalize().cross(forward).normalize(),up=forward.clone().cross(right).normalize();for(const dx of[-r.dimensions.requiredWidth/2,0,r.dimensions.requiredWidth/2])for(const dz of[-3.49,0,3.49]){const q=w.clone().addScaledVector(right,dx).addScaledVector(forward,dz).addScaledVector(up,-.5).applyMatrix4(inv),h=read(sampleTerrain,q),s=read(sampleSea,q);if(s===null||s>q.y)seaMiss++;if(h!==null){minimumTerrainGap=Math.min(minimumTerrainGap,q.y-h);if(h>q.y-.05)soil++;}}}
   if(soil||seaMiss){if(soil)failures.soil++;if(seaMiss)failures.sea++;continue;}
   candidates.push({shore:side,anchorLocal:a.clone().applyMatrix4(inv).toArray(),attachLocal:attach.local,attachIndex:attach.i,worldControls:[a.toArray(),b.toArray()],length,minimumTerrainGap,globalConnected:false,bridgeStructureChecked:false});
  }
  candidates.sort((a,b)=>a.length-b.length);result.banks[side]={examined,failures,candidates:candidates.slice(0,maxCandidates)};
 }
 return result;
}
