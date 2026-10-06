import * as T from 'three';
export const FRONT_BAY_RAIL_CONTROL=[[-59,68],[-40,108],[47,106],[83,101]];
const height=v=>typeof v==='number'?v:v?.height;
/** Static, independently owned study mesh. No tram or navigation registration. */
export function createTargetFrontBayRailCandidate({castle,sampleTerrain,sampleSea,controls=FRONT_BAY_RAIL_CONTROL,arches=5,deckClearance=6}={}){
 if(!castle?.isObject3D||typeof sampleSea!=='function'||typeof sampleTerrain!=='function')throw new TypeError('castle and actual surface callbacks required');
 if(!Number.isInteger(arches)||arches<3||arches>5||!Number.isFinite(deckClearance)||deckClearance<4||deckClearance>10)throw new RangeError('3–5 arches and bounded clearance required');
 const report={version:'target-front-bay-rail-3-promenade',accepted:false,tramConnected:false,controls,attempts:[],supports:[],failures:[],limitations:['Static visual candidate only; no boarding, production track splice or navigation.','Piers follow sampled terrain/seabed; finite footprint samples are not continuous load-bearing proof.','Finite surface/grade/curvature samples; separate city/ship swept clearance required.']},group=new T.Group();group.name='target-front-bay-rail-candidate';group.userData.preserveCitadelMaterials=true;
 const ownedG=[],ownedM=[],ownedI=[];let disposed=false;const dispose=()=>{if(disposed)return;disposed=true;group.removeFromParent();for(const i of ownedI)i.dispose();for(const g of ownedG)g.dispose();for(const m of ownedM)m.dispose();group.clear();};
 const fail=reason=>{report.status='rejected';report.failures.push(reason);return{group,report,worldCurve:null,dispose};};
 castle.updateWorldMatrix(true,false);const frame=castle.matrixWorld.clone(),inverse=frame.clone().invert();const scale=castle.getWorldScale(new T.Vector3());if(Math.max(scale.x,scale.y,scale.z)-Math.min(scale.x,scale.y,scale.z)>1e-6||Math.abs(scale.x-1)>1e-5)return fail('non-unit-rigid-castle');
 let rows=null;
 for(const contraction of[1,.9,.8]){
  const c=controls.map((p,i)=>[p[0],i===1||i===2?68+(p[1]-68)*contraction:p[1]]),curve=new T.CubicBezierCurve3(...c.map(p=>new T.Vector3(p[0],0,p[1]))),trial=[];let misses=0,buried=0;const blockedSamples=[];
  const n=Math.ceil(curve.getLength()/.5);
  for(let i=0;i<=n;i++){const p=curve.getPoint(i/n),sea=height(sampleSea(p.x,p.z)),terrain=height(sampleTerrain(p.x,p.z));if(!Number.isFinite(sea)){misses++;continue;}const seaWorld=new T.Vector3(p.x,sea,p.z).applyMatrix4(frame),chartUp=new T.Vector3(0,1,0).transformDirection(frame),d=seaWorld.dot(chartUp),lift=-d+Math.sqrt(d*d+2*seaWorld.length()*deckClearance+deckClearance*deckClearance),y=sea+lift;if(Number.isFinite(terrain)&&terrain>y-.8){buried++;if(blockedSamples.length<4)blockedSamples.push({x:p.x,z:p.z,terrain,y});}trial.push({x:p.x,z:p.z,y,sea,terrain:Number.isFinite(terrain)?terrain:null,t:i/n});}
  report.attempts.push({contraction,controls:c,samples:n+1,seaMisses:misses,buried,blockedSamples});if(!misses&&!buried){rows=trial;report.actualControls=c;report.contraction=contraction;break;}
 }
 if(!rows)return fail('surface-miss-or-terrain-intersection');
 // A railway must not inherit the tessellated ocean's face-to-face kinks.
 // Fit one radial shell from the highest ACTUALLY sampled sea radius, keeping
 // all sampled water clearances >= deckClearance. No nominal ocean fallback.
 const chartUp=new T.Vector3(0,1,0).transformDirection(frame);
 const measuredSeaRadii=rows.map(r=>new T.Vector3(r.x,r.sea,r.z).applyMatrix4(frame).length()),railRadius=Math.max(...measuredSeaRadii)+deckClearance;
 for(const r of rows){const seaWorld=new T.Vector3(r.x,r.sea,r.z).applyMatrix4(frame),d=seaWorld.dot(chartUp),lift=-d+Math.sqrt(d*d+railRadius*railRadius-seaWorld.lengthSq());r.y=r.sea+lift;}
 report.heightFit={method:'constant radial shell fitted above maximum actual sampled sea radius',measuredSeaRadius:[Math.min(...measuredSeaRadii),Math.max(...measuredSeaRadii)],railRadius,minimumSampledRadialClearance:deckClearance};
 const worldPoints=rows.map(r=>new T.Vector3(r.x,r.y,r.z).applyMatrix4(frame));let maxGrade=0,minRadius=Infinity,worstCurvature=null;const railLeft=[],railRight=[];
 for(let i=0;i<rows.length;i++){const p=worldPoints[i],delta=worldPoints[Math.min(i+1,rows.length-1)].clone().sub(worldPoints[Math.max(0,i-1)]),up=p.clone().normalize(),tangent=delta.clone().normalize(),right=new T.Vector3().crossVectors(up,tangent).normalize();maxGrade=Math.max(maxGrade,Math.abs(tangent.dot(up))/Math.sqrt(Math.max(1e-10,1-tangent.dot(up)**2)));railLeft.push(p.clone().addScaledVector(right,-.875));railRight.push(p.clone().addScaledVector(right,.875));rows[i].right=right.clone().transformDirection(inverse);rows[i].up=up.clone().transformDirection(inverse);if(i&&i<rows.length-1){const a=p.distanceTo(worldPoints[i-1]),b=p.distanceTo(worldPoints[i+1]),c=worldPoints[i-1].distanceTo(worldPoints[i+1]),twiceArea=new T.Vector3().subVectors(p,worldPoints[i-1]).cross(new T.Vector3().subVectors(worldPoints[i+1],worldPoints[i-1])).length();if(twiceArea>1e-8){const radius=a*b*c/(2*twiceArea);if(radius<minRadius){minRadius=radius;worstCurvature={index:i,t:rows[i].t,x:rows[i].x,z:rows[i].z,radius};}}}}
 report.audit={samples:rows.length,worstCurvature,maxWorldGrade:maxGrade,minWorldCurvatureRadius:Number.isFinite(minRadius)?minRadius:null,maxGaugeError:Math.max(...railLeft.map((p,i)=>Math.abs(p.distanceTo(railRight[i])-1.75))),gauge:1.75,gradeLimit:.04,radiusLimit:25};
 if(maxGrade>.04||minRadius<25)return fail('world-grade-or-curvature');
 const colours={stone:0xe1dac5,rail:0x66584c,sleeper:0xa5653e,paving:0xeee2c8,railing:0x788477,blue:0x397eab,blueEdge:0x71a8c4,lamp:0xffd488};const mats={};for(const[k,color]of Object.entries(colours)){mats[k]=new T.MeshStandardMaterial({color,roughness:.92});mats[k].userData.preserveCitadelMaterial=true;if(k==='lamp'){mats[k].emissive.setHex(0xffbc62);mats[k].emissiveIntensity=.65;}ownedM.push(mats[k]);}
 function mesh(name,g,mat){ownedG.push(g);const m=new T.Mesh(g,mats[mat]);m.name=name;m.receiveShadow=true;m.castShadow=true;group.add(m);return m;}
 function strip(name,lo,hi,width,mat){const positions=[],tri=(a,b,c)=>positions.push(...a.toArray(),...b.toArray(),...c.toArray()),rings=lo.map((p,i)=>{const r=rows[Math.round(i/(lo.length-1)*(rows.length-1))].right;return[p.clone().addScaledVector(r,-width/2),p.clone().addScaledVector(r,width/2),hi[i].clone().addScaledVector(r,width/2),hi[i].clone().addScaledVector(r,-width/2)];});for(let i=1;i<rings.length;i++)for(let k=0;k<4;k++){const j=(k+1)%4;tri(rings[i-1][k],rings[i][j],rings[i][k]);tri(rings[i-1][k],rings[i-1][j],rings[i][j]);}for(const [i,flip]of[[0,false],[rings.length-1,true]]){const q=rings[i];if(flip){tri(q[0],q[1],q[2]);tri(q[0],q[2],q[3]);}else{tri(q[0],q[2],q[1]);tri(q[0],q[3],q[2]);}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.computeVertexNormals();mesh(name,g,mat);}
 const lower=rows.map(r=>new T.Vector3(r.x,r.y,r.z).addScaledVector(r.up,-.6)),upper=rows.map(r=>new T.Vector3(r.x,r.y,r.z).addScaledVector(r.up,-.105));strip('front-bay-deck',lower,upper,4.6,'stone');
 for(let arch=0;arch<arches;arch++){
  const a=Math.round(arch/arches*(rows.length-1)),b=Math.round((arch+1)/arches*(rows.length-1)),lo=[],hi=[];
  for(let i=a;i<=b;i++){const r=rows[i],u=(i-a)/(b-a),foot=r.sea,opening=(r.y-r.sea-1.4)*Math.sqrt(Math.max(0,1-(u*2-1)**2));lo.push(new T.Vector3(r.x,foot+opening,r.z));hi.push(new T.Vector3(r.x,r.y,r.z).addScaledVector(r.up,-.6));}
  // Pass local side vectors for this subsection rather than remapping full arc.
  const pos=[],tri=(a,b,c)=>pos.push(...a.toArray(),...b.toArray(),...c.toArray());const rings=lo.map((p,i)=>{const right=rows[a+i].right;const bottom=[-2.1,2.1].map(side=>{const q=p.clone().addScaledVector(right,side),sea=height(sampleSea(q.x,q.z));if(!Number.isFinite(sea))report.failures.push('arch-side-surface-miss');else{q.y=sea+(p.y-rows[a+i].sea);const ground=height(sampleTerrain(q.x,q.z));if(Number.isFinite(ground)){if(ground>hi[i].y-.15){report.failures.push('arch-side-terrain-above-soffit');report.sideObstructions??=[];if(report.sideObstructions.length<4)report.sideObstructions.push({x:q.x,z:q.z,ground,soffit:hi[i].y});}else q.y=Math.max(q.y,ground-.10);}}return q;});return[...bottom,hi[i].clone().addScaledVector(right,2.1),hi[i].clone().addScaledVector(right,-2.1)];});for(let i=1;i<rings.length;i++)for(let k=0;k<4;k++){const j=(k+1)%4;tri(rings[i-1][k],rings[i][j],rings[i][k]);tri(rings[i-1][k],rings[i-1][j],rings[i][j]);}for(const[i,f]of[[0,false],[rings.length-1,true]]){const q=rings[i];tri(q[0],q[f?1:2],q[f?2:1]);tri(q[0],q[f?2:3],q[f?3:2]);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.computeVertexNormals();mesh('front-bay-open-arch-'+arch,g,'stone');
 }
 if(report.failures.length){dispose();return fail('arch-side-support-rejected');}
 // Add full-depth owned piers below every shared arch spring. The actual
 // seabed/land callback is mandatory; water alone cannot support a railway.
 for(let j=0;j<=arches;j++){
  const i=Math.round(j/arches*(rows.length-1)),r=rows[i],center=new T.Vector3(r.x,r.sea,r.z),right=r.right;
  const planRight=new T.Vector3(right.x,0,right.z).normalize(),tangent=new T.Vector3(-planRight.z,0,planRight.x),halfDepth=.85,probes=[];
  for(const side of[-2.1,0,2.1])for(const along of[-halfDepth,0,halfDepth]){
   const p=center.clone().addScaledVector(planRight,side).addScaledVector(tangent,along),sea=height(sampleSea(p.x,p.z)),ground=height(sampleTerrain(p.x,p.z));
   if(!Number.isFinite(sea)||!Number.isFinite(ground)){report.footMiss={index:j,x:p.x,z:p.z,sea:Number.isFinite(sea)?sea:null,ground:Number.isFinite(ground)?ground:null};dispose();return fail('foot-width-terrain-or-sea-miss');}
   if(ground>r.y-.8){dispose();return fail('footing-terrain-above-deck');}probes.push({x:p.x,z:p.z,sea,ground});
  }
  const bottom=Math.min(...probes.map(p=>p.ground))-.12,top=Math.max(r.sea+.2,...probes.map(p=>p.ground+.2));
  const g=new T.BoxGeometry(4.2,top-bottom,halfDepth*2),pier=mesh('front-bay-seabed-pier-'+j,g,'stone');
  // The deck itself follows radial up. Small pier sections are chart-vertical
  // so all sampled seabed heights are covered without altering the seabed.
  pier.position.set(r.x,(top+bottom)/2,r.z);pier.rotation.y=Math.atan2(-right.z,right.x);
  report.supports.push({index:j,bottom,top,footprint:probes,source:'actual-terrain-and-sea',maximumSampledGap:0,continuousProof:false});
 }
 // Thin world-space rails retain exact 3D gauge; convert only for owned mesh.
 for(const[side,pts]of[['left',railLeft],['right',railRight]]){const curve=new T.CatmullRomCurve3(pts.map(p=>p.clone().applyMatrix4(inverse)));mesh('front-bay-'+side+'-rail',new T.TubeGeometry(curve,rows.length-1,.045,6,false),'rail');}
 const sleeperGeo=new T.BoxGeometry(2.18,.06,.24);ownedG.push(sleeperGeo);let distance=0;const indices=[];for(let i=1;i<rows.length;i++){distance+=worldPoints[i].distanceTo(worldPoints[i-1]);if(distance>=1.35){indices.push(i);distance=0;}}const sleepers=new T.InstancedMesh(sleeperGeo,mats.sleeper,indices.length);sleepers.name='front-bay-sleepers';const m=new T.Matrix4();for(const[k,i]of indices.entries()){const tangent=worldPoints[Math.min(i+1,rows.length-1)].clone().sub(worldPoints[i-1]).normalize(),right=railRight[i].clone().sub(railLeft[i]).normalize(),up=new T.Vector3().crossVectors(tangent,right).normalize();m.makeBasis(right,up,tangent).setPosition(worldPoints[i].clone().addScaledVector(up,-.075));sleepers.setMatrixAt(k,inverse.clone().multiply(m));}group.add(sleepers);ownedI.push(sleepers);
 // The rail alignment, original deck/arches and ALL sampled piers above are
 // retained verbatim. A one-sided promenade overlaps the old deck by .75 m.
 const walk={inner:1.55,outer:5.15,centre:3.4,top:.02,bottom:-.6,clearWidth:2.4};
 let walkSign=1;
 const at=(i,offset,y=0)=>new T.Vector3(rows[i].x,rows[i].y,rows[i].z).addScaledVector(rows[i].right,offset*walkSign).addScaledVector(rows[i].up,y);
 const sideTrials=[];
 for(const sign of[1,-1]){walkSign=sign;const samples=[],failures=[];let groundMisses=0;
  for(let i=0;i<rows.length;i++)for(const side of[walk.inner,walk.centre,walk.outer]){
   const bottom=at(i,side,walk.bottom),sea=height(sampleSea(bottom.x,bottom.z)),ground=height(sampleTerrain(bottom.x,bottom.z)),clearance=Number.isFinite(ground)?bottom.y-ground:null;
   samples.push({index:i,side,x:bottom.x,z:bottom.z,bottomY:bottom.y,ground:Number.isFinite(ground)?ground:null,sea:Number.isFinite(sea)?sea:null,clearance});if(clearance===null)groundMisses++;
   // No ground hit is not a new seabed support. This extension is carried by
   // the original sampled piers through its deck overlap and stone brackets.
   if(!Number.isFinite(sea)||clearance!==null&&clearance<.08)failures.push({index:i,side,reason:!Number.isFinite(sea)?'missing-extension-sea':'extension-terrain-intersection',clearance});
  }sideTrials.push({sign,samples,failures,groundMisses});
 }
 const chosen=sideTrials.filter(t=>!t.failures.length).sort((a,b)=>a.groundMisses-b.groundMisses)[0]??sideTrials[0];walkSign=chosen.sign;const walkSamples=chosen.samples,extensionFailures=chosen.failures;
 report.promenade={side:walkSign>0?'positive frame right':'negative frame right',sideSign:walkSign,...walk,sideTrials:sideTrials.map(t=>({sideSign:t.sign,knownObstructions:t.failures.length,groundMisses:t.groundMisses})),terrainSamplesComplete:chosen.groundMisses===0,missingTerrainSamples:chosen.groundMisses,surfaceSampleCount:walkSamples.length,minimumSampledGroundClearance:Math.min(...walkSamples.filter(p=>p.clearance!==null).map(p=>p.clearance)),failures:extensionFailures,supportMethod:'continuous stone cantilever overlaps original deck, transverse stone ribs connect into original arch band; unchanged original piers',continuousStructuralProof:false,publicNavigation:false,endpointConnectionsVerified:false};
 if(extensionFailures.length){dispose();return fail('promenade-surface-rejected');}
 const additions=[];
 function band(name,loSide,hiSide,low,high,mat){const start=group.children.length,centre=(loSide+hiSide)/2;const bottoms=rows.map((_,i)=>at(i,centre,low)),tops=rows.map((_,i)=>at(i,centre,high));if(name==='front-bay-promenade-stone-deck')for(const i of[0,rows.length-1]){const j=i===0?1:i-1,extension=at(i,0).sub(at(j,0)).normalize().multiplyScalar(.08);bottoms[i].add(extension);tops[i].add(extension);}strip(name,bottoms,tops,hiSide-loSide,mat);const m=group.children[start];additions.push(m);return m;}
 const paving=band('front-bay-promenade-stone-deck',walk.inner,walk.outer,walk.bottom,walk.top,'paving');paving.userData.targetWalkable=true;
 const path=rows.map((_,i)=>at(i,walk.centre,walk.top));
 report.walkSurfaces=[{id:paving.name,clearWidth:walk.clearWidth,centres:path.map(p=>p.toArray()),up:rows.map(r=>r.up.toArray()),localFrame:'castle'}];
 report.promenade.endpoints=[path[0].toArray(),path.at(-1).toArray()];
 function instanced(name,geometry,mat,transforms){ownedG.push(geometry);const mesh=new T.InstancedMesh(geometry,mats[mat],transforms.length);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;mesh.userData.preserveCitadelMaterials=true;transforms.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;group.add(mesh);ownedI.push(mesh);additions.push(mesh);return mesh;}
 function basis(i,side,y){const r=rows[i],right=r.right.clone().multiplyScalar(walkSign),tangent=new T.Vector3().crossVectors(right,r.up).normalize();return new T.Matrix4().makeBasis(right,r.up,tangent).setPosition(at(i,side,y));}
 const cumulative=[0];for(let i=1;i<rows.length;i++)cumulative.push(cumulative[i-1]+worldPoints[i].distanceTo(worldPoints[i-1]));const length=cumulative.at(-1);
 const every=spacing=>{const ids=[];let last=-spacing;for(let i=0;i<rows.length;i++)if(cumulative[i]-last>=spacing&&i>0&&i<rows.length-1){ids.push(i);last=cumulative[i];}return ids;};
 // Short triangular brackets bear into the existing arch band; they do not
 // invent new seabed contacts or close the central ship openings.
 const ribs=every(3.8),ribMatrices=[],ribSamples=[];
 for(const i of ribs){for(const side of[1.55,3.3,5.05]){const y=-1.7+(side-1.55)/3.5*1.1,p=at(i,side,y),ground=height(sampleTerrain(p.x,p.z));ribSamples.push({index:i,side,bottomY:p.y,ground:Number.isFinite(ground)?ground:null});if(Number.isFinite(ground)&&ground>p.y-.08)report.failures.push('promenade-bracket-terrain-intersection');}ribMatrices.push(basis(i,0,0));}
 if(report.failures.length){dispose();return fail('promenade-bracket-support-rejected');}
 const shape=new T.Shape();shape.moveTo(1.55,-.6);shape.lineTo(5.05,-.6);shape.lineTo(1.55,-1.7);shape.closePath();const ribGeo=new T.ExtrudeGeometry(shape,{depth:.24,bevelEnabled:false,steps:1});ribGeo.translate(0,0,-.12);instanced('front-bay-promenade-stone-brackets',ribGeo,'stone',ribMatrices);
 report.promenade.brackets={count:ribs.length,samples:ribSamples,minimumSampledClearance:Math.min(...ribSamples.filter(s=>s.ground!==null).map(s=>s.bottomY-s.ground)),missingTerrainSamples:ribSamples.filter(s=>s.ground===null).length,originalPierBoundaryChanged:false,innerBearingOverlap:.55};
 const railSides=[-2.22,1.78,5.02],postIds=every(1.8),postMatrices=[];
 const guardSamples=[],guardFailures=[];
 for(let i=0;i<rows.length;i++)for(const side of railSides)for(const edge of[-.075,.075]){const p=at(i,side+edge,side<0?-.105:walk.top),ground=height(sampleTerrain(p.x,p.z)),clearance=Number.isFinite(ground)?p.y-ground:null;guardSamples.push({index:i,side,clearance});if(clearance!==null&&clearance<.08)guardFailures.push({index:i,side,clearance});}
 report.promenade.guardrailTerrain={samples:guardSamples.length,knownObstructions:guardFailures,missingTerrainSamples:guardSamples.filter(s=>s.clearance===null).length};
 if(guardFailures.length){dispose();return fail('promenade-guardrail-terrain-intersection');}

 for(const side of railSides){const base=side<0?-.105:walk.top;band('front-bay-railing-curb-'+side,side-.075,side+.075,base,base+.16,'stone');for(const y of[base+.56,base+1.02]){const curve=new T.CatmullRomCurve3(rows.map((_,i)=>at(i,side,y)));const bar=mesh('front-bay-longitudinal-guardrail-'+side+'-'+y,new T.TubeGeometry(curve,rows.length-1,.035,5,false),'railing');additions.push(bar);}for(const i of postIds)postMatrices.push(basis(i,side,base+.53));}
 instanced('front-bay-guardrail-posts',new T.BoxGeometry(.075,1.06,.075),'railing',postMatrices);
 const canopyIds=[.18,.34,.50,.66,.82].map(t=>Math.round(t*(rows.length-1))),roofMatrices=[],edgeMatrices=[],canopyPosts=[],canopies=[];
 for(const i of canopyIds){const roofMatrix=basis(i,walk.centre,walk.top+2.86);roofMatrices.push(roofMatrix);edgeMatrices.push(roofMatrix);for(const side of[1.95,4.85])for(const along of[-1.85,1.85]){const m=basis(i,side,walk.top+1.39);m.setPosition(at(i,side,walk.top+1.39).addScaledVector(new T.Vector3().crossVectors(rows[i].right,rows[i].up).normalize(),along));canopyPosts.push(m);}canopies.push({index:i,centre:at(i,walk.centre,walk.top).toArray(),clearWidth:2.4,clearHeight:2.78,width:3.35,length:4.5});}
 const rv=[[-1.675,0,-2.25],[1.675,0,-2.25],[1.675,0,2.25],[-1.675,0,2.25],[-1.675,.65,0],[1.675,.65,0]],ri=[0,4,5,0,5,1,3,2,5,3,5,4,0,3,4,1,5,2,0,1,2,0,2,3],rg=new T.BufferGeometry();rg.setAttribute('position',new T.Float32BufferAttribute(ri.flatMap(j=>rv[j]),3));rg.computeVertexNormals();instanced('front-bay-blue-station-canopies',rg,'blue',roofMatrices);instanced('front-bay-canopy-thin-eaves',new T.BoxGeometry(3.35,.12,4.5),'blueEdge',edgeMatrices);instanced('front-bay-canopy-posts',new T.BoxGeometry(.11,2.78,.11),'railing',canopyPosts);
 const lampIds=every(7.5).filter(i=>canopyIds.every(j=>Math.abs(cumulative[j]-cumulative[i])>3.5)),poles=[],bulbs=[],caps=[];
 for(const i of lampIds){poles.push(basis(i,5.02,walk.top+1.15));bulbs.push(basis(i,5.02,walk.top+2.35));caps.push(basis(i,5.02,walk.top+2.60));}
 instanced('front-bay-warm-lamp-poles',new T.CylinderGeometry(.045,.055,2.3,6),'railing',poles);instanced('front-bay-warm-lamp-glass',new T.BoxGeometry(.22,.35,.22),'lamp',bulbs);instanced('front-bay-warm-lamp-caps',new T.ConeGeometry(.20,.22,4),'railing',caps);
 report.furniture={canopies,warmLamps:lampIds.length,lampLighting:'emissive surfaces, no scene lights',guardrailSides:railSides,posts:postMatrices.length,transverseEndRails:0};
 // Actual finite mesh checks use a private double-sided proxy material. Never
 // mutate source materials to make the audit pass.
 group.updateMatrixWorld(true);const auditMaterial=new T.MeshBasicMaterial({side:T.DoubleSide}),proxies=[];
 for(const source of additions){const n=source.isInstancedMesh?source.count:1;for(let j=0;j<n;j++){const proxy=new T.Mesh(source.geometry,auditMaterial);proxy.matrixAutoUpdate=false;proxy.matrixWorld.copy(source.matrixWorld);if(source.isInstancedMesh){const im=new T.Matrix4();source.getMatrixAt(j,im);proxy.matrixWorld.multiply(im);}source.geometry.computeBoundingBox();proxies.push({mesh:proxy,box:source.geometry.boundingBox.clone().applyMatrix4(proxy.matrixWorld),name:source.name});}}
 const ray=new T.Raycaster(),hitsAt=(origin,direction,distance)=>{ray.set(origin,direction);ray.near=.001;ray.far=distance;return proxies.filter(p=>p.box.distanceToPoint(origin)<=distance+.01).flatMap(p=>ray.intersectObject(p.mesh,false).map(h=>({name:p.name,distance:h.distance})));};let bodyRays=0,trackRays=0,supportRays=0;const bodyFailures=[],trackFailures=[],supportFailures=[];
 for(let i=1;i<rows.length;i++){
  for(const side of[-1.2,0,1.2])for(const h of[.55,1.2,1.8]){const a=at(i-1,walk.centre+side,walk.top+h),b=at(i,walk.centre+side,walk.top+h),d=b.clone().sub(a);bodyRays++;const hits=hitsAt(a,d.clone().normalize(),d.length());if(hits.length&&bodyFailures.length<8)bodyFailures.push({index:i,side,h,hits});}
  for(const side of[-1.45,0,1.45])for(const h of[.35,1.5,3.0]){const a=at(i-1,side,h),b=at(i,side,h),d=b.clone().sub(a);trackRays++;const hits=hitsAt(a,d.clone().normalize(),d.length());if(hits.length&&trackFailures.length<8)trackFailures.push({index:i,side,h,hits});}
 }
 for(let i=0;i<rows.length;i++)for(const side of[-1.2,0,1.2]){const floor=at(i,walk.centre+side,walk.top),origin=floor.clone().addScaledVector(rows[i].up,.15);ray.set(origin,rows[i].up.clone().negate());ray.near=0;ray.far=.25;const deckProxy=proxies.find(p=>p.name===paving.name),hit=ray.intersectObject(deckProxy.mesh,false)[0];supportRays++;if(!hit||Math.abs(hit.distance-.15)>.035)supportFailures.push({index:i,side,distance:hit?.distance??null});}
 auditMaterial.dispose();report.clearance={body:{rays:bodyRays,clearWidth:2.4,heights:[.55,1.2,1.8],failures:bodyFailures},track:{rays:trackRays,halfWidth:1.45,heights:[.35,1.5,3],failures:trackFailures,tramVehicleValidated:false},support:{rays:supportRays,failures:supportFailures},finiteSamplesOnly:true,externalSceneCollisionVerified:false};
 if(bodyFailures.length||trackFailures.length||supportFailures.length){dispose();return fail('promenade-finite-geometry-clearance-rejected');}
 report.limitations.push('Extension terrain misses are reported as incomplete collision evidence, not invented seabed or new terrain support; candidate remains unaccepted.','One-sided cantilever brackets provide geometric bearing into the unchanged deck/arch band; no engineering load calculation.','Body/track clearance is finite own-mesh sampling; station end access, city/ship geometry and tram swept envelopes remain unverified.');
 group.userData.frontBayRailReport=report;
 const worldCurve=new T.CatmullRomCurve3(worldPoints,false,'centripetal');report.status='built-unaccepted-visual-candidate';report.arches=arches;report.rails={left:railLeft.map(p=>p.toArray()),right:railRight.map(p=>p.toArray())};report.endpoints=[worldPoints[0].toArray(),worldPoints.at(-1).toArray()];report.drawCalls=group.children.length;return{group,report,worldCurve,dispose};
}
