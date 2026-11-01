import fs from 'node:fs';import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),getImageData:()=>({data:new Uint8ClampedArray(16)}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});function element(){const listeners={};return{width:2,height:2,style:{},addEventListener(k,f){listeners[k]=f;},removeEventListener(){},set src(v){queueMicrotask(()=>listeners.load?.call(this));},getContext:()=>context};}globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../../src/world/moebiusSwamp.js');
const run=process.argv[2]||'after',output=name=>new URL(`tiger-600s-${run}-${name}.json`,import.meta.url);
const started=performance.now(),root=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=root.userData.inner,tiger=inner.userData.tiger;await tiger.userData.swampTigerV2Ready;root.position.set(17,21,-11);root.rotation.set(.31,.6,-.2);root.updateMatrixWorld(true);
const nodes=new Map();tiger.traverse(n=>{if(n.userData.blenderSourceNode)nodes.set(n.userData.blenderSourceNode,n);});const paws=['n55','n62','n69','n76'].map(id=>nodes.get(id));const soles=paws.map(p=>{p.geometry.computeBoundingBox();const a=p.geometry.attributes.position,out=[];for(let i=0;i<a.count;i++)if(Math.abs(a.getY(i)-p.geometry.boundingBox.min.y)<1e-4)out.push(new T.Vector3().fromBufferAttribute(a,i));return out;});
const ray=new T.Raycaster(),surfaces=[...inner.userData.tigerWalkSurfaces,...inner.userData.gregCoralRim.walkMeshes];const ground=point=>{ray.set(inner.localToWorld(new T.Vector3(point.x,60,point.z)),new T.Vector3(0,-1,0).transformDirection(inner.matrixWorld));const hit=ray.intersectObjects(surfaces,false)[0];return hit?inner.worldToLocal(hit.point).y:null;};const local=(mesh,p)=>inner.worldToLocal(mesh.localToWorld(p.clone()));
const report={scope:'600s/30Hz actual root.update seed7711 factory scale.5 tiger38; image loading CPU shim, not GPU',frames:0,events:[{time:0,action:'forceDrink'},{time:180,action:'player appears at inner [0,25,0]'},{time:200,action:'player leaves scene'},{time:420,action:'forceDrink again'}],states:[],stateFrames:{},issues:{},samples:[],maxima:{rootStep:0,phaseStepError:0,stationaryPhaseAdvance:0,footPenetration:0,stanceGap:0,swingGap:0,torsoPenetration:0,absPitch:0,legLocalLength:0},raySamples:0,stoppedFrames:0,drinkSamples:0,finiteChecks:0};
report.deformationBounds={};report.waterReturnFrames=0;report.maxima.waterReturnFootBelow=0;
const issue=(type,value)=>{const o=report.issues[type]??={count:0,examples:[]};o.count++;if(o.examples.length<10)o.examples.push(value);};let previous=tiger.position.clone(),phase=0,mode='',previousDistance=0;const player={position:inner.localToWorld(new T.Vector3(0,25,0)),facing:new T.Vector3(0,0,1).transformDirection(inner.matrixWorld),velocity:new T.Vector3(),onGround:true};const oldRandom=Math.random;Math.random=()=>.5;tiger.userData.forceDrink=true;
try{for(let i=0;i<=18000;i++){
 const t=i/30;if(i===12600)tiger.userData.forceDrink=true;const runtime=t>=180&&t<200?{player}:{};
 root.userData.update(1/30,t,runtime);root.updateMatrixWorld(true);report.frames++;
 const u=tiger.userData,g=u.targetGait,s=u.tigerTargetSupport,d=Math.hypot(tiger.position.x-previous.x,tiger.position.z-previous.z);previous.copy(tiger.position);
 report.maxima.rootStep=Math.max(report.maxima.rootStep,d);report.maxima.absPitch=Math.max(report.maxima.absPitch,Math.abs(s.pitch||0));
 if(s.mode!==mode){mode=s.mode;report.states.push({mode,t,position:tiger.position.toArray()});}report.stateFrames[mode]=(report.stateFrames[mode]||0)+1;
 if(Math.abs(g.distance-d)>1e-8)issue('gaitDistanceMismatch',{t,mode,gait:g.distance,measured:d});
 const dp=((g.phase-phase)%1+1)%1,expected=u._walking&&d<1?d/g.strideLength:0;
 report.maxima.phaseStepError=Math.max(report.maxima.phaseStepError,Math.abs(dp-expected));
 if(d<1e-7){report.stoppedFrames++;report.maxima.stationaryPhaseAdvance=Math.max(report.maxima.stationaryPhaseAdvance,Math.min(dp,1-dp));if(dp>1e-7&&dp<1-1e-7)issue('stationaryPhaseAdvance',{t,mode,dp});}
 phase=g.phase;
 if(s.supportKind==='unsupported')issue('unsupportedMode',{t,mode,position:tiger.position.toArray()});
 if(u._waterReturning){report.waterReturnFrames++;if(s.supportKind!=='water-supported'||s.grounded)issue('waterMisclassified',{t,mode});if(i%10===0)for(const paw of paws){const p=paw.geometry.attributes.position;let low=Infinity;for(let j=0;j<p.count;j++)low=Math.min(low,local(paw,new T.Vector3().fromBufferAttribute(p,j)).y);report.maxima.waterReturnFootBelow=Math.max(report.maxima.waterReturnFootBelow,25.15-low);if(low<25.14)issue('waterReturnFootSubmerged',{t,mode,low});}}
 if(s.grounded)for(let j=0;j<4;j++)if(s.feet[j]?.height==null)issue('missingGroundSupport',{t,mode,paw:j,position:tiger.position.toArray()});
 if(s.grounded&&i%10===0)for(let j=0;j<4;j++){
  let gap=Infinity,min=Infinity,hits=0;for(const point of soles[j]){const p=local(paws[j],point),h=ground(p);if(h===null)continue;hits++;min=Math.min(min,p.y-h);gap=Math.min(gap,Math.abs(p.y-h));}report.raySamples++;
  if(!hits){issue('pawNoActualSurface',{t,mode,paw:j});continue;}
  report.maxima.footPenetration=Math.max(report.maxima.footPenetration,-min);report.maxima[g.swing[j]<.001?'stanceGap':'swingGap']=Math.max(report.maxima[g.swing[j]<.001?'stanceGap':'swingGap'],gap);
  if(min<-.012)issue('pawPenetration',{t,mode,paw:j,min});if(gap>.023+.145*g.swing[j])issue('pawFloats',{t,mode,paw:j,gap,swing:g.swing[j]});
 }
 if(i%30===0){
  for(const [id,mesh]of nodes){if(mesh.geometry?.attributes.position){report.finiteChecks++;if(!mesh.geometry.attributes.position.array.every(Number.isFinite))issue('nonFiniteGeometry',{t,node:mesh.name});if(['n53','n60','n67','n74'].includes(id)){const bounds=report.deformationBounds[id]??={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]},a=mesh.geometry.attributes.position.array;for(let i=0;i<a.length;i++) {bounds.min[i%3]=Math.min(bounds.min[i%3],a[i]);bounds.max[i%3]=Math.max(bounds.max[i%3],a[i]);}}}}
  for(const id of ['n52','n59','n66','n73'])report.maxima.legLocalLength=Math.max(report.maxima.legLocalLength,nodes.get(id).position.length());
  if(s.grounded){const torso=nodes.get('n2'),p=torso.geometry.attributes.position;for(let j=0;j<p.count;j+=17){const v=local(torso,new T.Vector3().fromBufferAttribute(p,j)),h=ground(v);if(h!==null){report.maxima.torsoPenetration=Math.max(report.maxima.torsoPenetration,h-v.y);if(h-v.y>.02)issue('torsoPenetration',{t,mode,depth:h-v.y});}}}
  if(u._drinking&&u.drinkDetail.blend>.98){report.drinkSamples++;const nose=nodes.get('n25'),p=nose.geometry.attributes.position;let low=Infinity;for(let j=0;j<p.count;j++)low=Math.min(low,local(nose,new T.Vector3().fromBufferAttribute(p,j)).y);if(Math.abs(low-25.12)>.002)issue('noseMissesWater',{t,low});}
  report.samples.push({t,mode,position:tiger.position.toArray(),distance:d,phase:g.phase,speed:g.speed,walking:u._walking,drinking:u._drinking,swing:g.swing,grounded:s.grounded,supportKind:s.supportKind,waterReturning:u._waterReturning||false,feet:s.feet.map(f=>({height:f.height,foot:f.foot})),pitch:s.pitch});
 }
 if(i>0&&i%1800===0){fs.writeFileSync(output('checkpoint'),JSON.stringify(report));console.log(JSON.stringify({progress:t,issues:Object.fromEntries(Object.entries(report.issues).map(([k,v])=>[k,v.count]))}));}
}}finally{Math.random=oldRandom;}
report.elapsedMs=performance.now()-started;fs.writeFileSync(output('audit'),JSON.stringify(report,null,2)+'\n');const {samples,...summary}=report;fs.writeFileSync(output('summary'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
