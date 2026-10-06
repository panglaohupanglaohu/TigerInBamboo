import * as THREE from 'three';
import {buildMountainSurfaceIndex} from './mountainSurfaceIndex.js';

export function createTargetStairSurfaceSampler(castle,meshes){castle.updateWorldMatrix(true,true);const index=buildMountainSurfaceIndex(meshes),frame=castle.matrixWorld.clone(),inverse=frame.clone().invert(),down=new THREE.Vector3(0,-1,0).transformDirection(frame),ray=new THREE.Ray();return(x,z)=>{ray.set(new THREE.Vector3(x,220,z).applyMatrix4(frame),down);const h=index.sample(ray,0,1000);return h?{height:h.point.clone().applyMatrix4(inverse).y,faceIndex:h.faceIndex,mesh:h.object.name}:null;};}

const cross2=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function hull(points){const sorted=points.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]),unique=sorted.filter((p,i)=>!i||Math.hypot(p[0]-sorted[i-1][0],p[1]-sorted[i-1][1])>1e-8);if(unique.length<3)return unique;const a=[],b=[];for(const p of unique){while(a.length>1&&cross2(a.at(-2),a.at(-1),p)<=1e-9)a.pop();a.push(p);}for(const p of [...unique].reverse()){while(b.length>1&&cross2(b.at(-2),b.at(-1),p)<=1e-9)b.pop();b.push(p);}return [...a.slice(0,-1),...b.slice(0,-1)];}
const mix2=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
/** Actual polygon stairs with full-width, shared corner landings. No terrain
 * mutation or overlapping rotated tread boxes. Approved upper run retains its
 * original station spacing; downstream candidates may gain descent length. */
export function solveTargetNewCityStairRoute({sampleSurface,start=[63.3838,12,40.4336],end=[62,3,64],width=4.4,maxSlope=.25,step=.65,waypointRoutes=null,entryLanding=null}={}){
 if(typeof sampleSurface!=='function')throw new TypeError('actual surface sampler required');
 if(![...start,...end,width,maxSlope,step].every(Number.isFinite)||width<=0||step<=0||maxSlope<=0||maxSlope>.28)throw new RangeError('invalid route dimensions');
 const targetEntry=Math.hypot(start[0]-63.3838,start[2]-40.4336)<.02;
 const entry=entryLanding===false?null:entryLanding||(targetEntry?{height:12.3,outward:[-Math.sin(55*Math.PI/180),Math.cos(55*Math.PI/180)],backLength:.5}:null);
 const actualStart=[start[0],entry?.height??start[1],start[2]];
 const routes=waypointRoutes||[[],...(targetEntry?[48]:[43,48,53,68,73,78,83,88]).flatMap(x=>[53,59,65,71,77].map(z=>[[x,start[2]+5],[x,z],[end[0],z]]))];
 const cache=new Map(),failures={};const sample=(x,z)=>{const key=x.toFixed(6)+','+z.toFixed(6);if(!cache.has(key)){const v=sampleSurface(x,z);cache.set(key,typeof v==='number'?{height:v}:v);}return cache.get(key);};let best=null;
 for(const waypoints of routes){const points=[[start[0],start[2]],...waypoints,[end[0],end[2]]],treads=[],segments=[],corners=new Map();let reason=null,length=0;
  for(let j=1;j<points.length;j++){const a=points[j-1],b=points[j],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<1e-7){reason='zero-segment';break;}const u=[(b[0]-a[0])/len,(b[1]-a[1])/len],n=[-u[1],u[0]];segments.push({a,b,len,u,n,start:length});length+=len;}
  for(let j=1;j<points.length-1&&!reason;j++){
   const incoming=segments[j-1],outgoing=segments[j],dot=incoming.u[0]*outgoing.u[0]+incoming.u[1]*outgoing.u[1];if(dot<-.95){reason='hairpin';break;}if(dot>.99999)continue;
   const trim=width/2*Math.sqrt((1-dot)/(1+dot))+.04;
   if(trim>=incoming.len-.05||trim>=outgoing.len-.05){reason='short-corner-run';break;}
   const point=points[j],from=point.map((v,k)=>v-incoming.u[k]*trim),to=point.map((v,k)=>v+outgoing.u[k]*trim),sum=incoming.n.map((v,k)=>v+outgoing.n[k]),norm=Math.hypot(...sum),m=sum.map(v=>v/norm),denom=m[0]*incoming.n[0]+m[1]*incoming.n[1];
   const section=(p,n,h=width/2)=>[p.map((v,k)=>v+n[k]*h),p.map((v,k)=>v-n[k]*h)],A=section(from,incoming.n),B=section(point,m,width/2/denom),C=section(to,outgoing.n);
   corners.set(j,{trim,point,from,to,polygon:hull([...A,...B,...C]),sideEdges:[[A[0],B[0],C[0]],[C[1],B[1],A[1]]]});
  }
  function record(data){const poly=data.polygon,center=poly.reduce((a,p)=>[a[0]+p[0]/poly.length,a[1]+p[1]/poly.length],[0,0]),probes=[center,...poly,...poly.flatMap((p,i)=>[mix2(p,poly[(i+1)%poly.length],.25),mix2(p,poly[(i+1)%poly.length],.5),mix2(p,poly[(i+1)%poly.length],.75)])];
   // For regular upper treads use exactly the historical 3 x 5 grid.
   if(data.quad){probes.length=0;for(const a of[0,.5,1])for(const b of[0,.25,.5,.75,1])probes.push(mix2(mix2(data.quad[0],data.quad[1],a),mix2(data.quad[3],data.quad[2],a),b));}
   const samples=probes.map(([x,z])=>{const h=sample(x,z);return{x,z,...h};});if(samples.some(h=>!Number.isFinite(h.height))){reason='surface-miss';return;}
   const groundMax=Math.max(...samples.map(h=>h.height));if(groundMax>actualStart[1]+.025){reason='terrain-above-entry';return;}
   treads.push({...data,groundMax,bottom:Math.min(...samples.map(h=>h.height))-.2,samples});
  }
  for(let j=0;j<segments.length&&!reason;j++){
   const seg=segments[j],lo=corners.get(j)?.trim||0,hi=seg.len-(corners.get(j+1)?.trim||0),count=Math.ceil(seg.len/step),ds=seg.len/count;if(hi<=lo){reason='overlapping-landings';break;}
   for(let k=0;k<count;k++){
    const from=Math.max(lo,k*ds),to=Math.min(hi,(k+1)*ds);if(to-from<1e-6)continue;const A=seg.a.map((v,i)=>v+seg.u[i]*from),B=seg.a.map((v,i)=>v+seg.u[i]*to),left=p=>p.map((v,i)=>v+seg.n[i]*width/2),right=p=>p.map((v,i)=>v-seg.n[i]*width/2),quad=[left(A),left(B),right(B),right(A)],mid=mix2(A,B,.5);
    const data={kind:'tread',x:mid[0],z:mid[1],ds:to-from,yaw:Math.atan2(...seg.u),distance:seg.start+(from+to)/2,polygon:hull(quad),quad,sideEdges:[[quad[0],quad[1]],[quad[2],quad[3]]]};
    if(j===0&&k===0&&entry){const out=entry.outward,n=[-out[1],out[0]],back=seg.a.map((v,i)=>v-out[i]*(entry.backLength??.5)),backL=back.map((v,i)=>v+n[i]*width/2),backR=back.map((v,i)=>v-n[i]*width/2);data.kind='entry-landing';data.polygon=hull([backL,backR,...quad]);delete data.quad;data.sideEdges=[[backL,quad[1]],[quad[2],backR]];}
    record(data);if(reason)break;
   }
   const corner=corners.get(j+1);if(corner&&!reason)record({kind:'corner-landing',cornerIndex:j+1,x:corner.point[0],z:corner.point[1],ds:2*corner.trim,yaw:Math.atan2(...segments[j+1].u),distance:seg.start+seg.len,polygon:corner.polygon,sideEdges:corner.sideEdges});
  }
  if(!reason&&!treads.length)reason='empty-route';
  if(!reason){let future=end[1];for(let i=treads.length-1;i>=0;i--){future=Math.max(future,treads[i].groundMax);treads[i].required=future;}
   let y=actualStart[1];for(const t of treads){y=Math.max(t.required,y-(t.kind==='tread'?maxSlope*t.ds:0));t.top=y;}
   if(y>end[1]+.025)reason='insufficient-descent-length';else if(treads.some(t=>t.top-t.bottom>30))reason='foundation-too-tall';
  }
  if(reason){failures[reason]=(failures[reason]||0)+1;continue;}
  const score=length;if(!best||score<best.length)best={points,treads,length,walkPath:[actualStart,...treads.map(t=>[t.x,t.top,t.z]),end],landings:treads.filter(t=>t.kind!=='tread')};
 }
 return{version:'target-stair-route-2-shared-corner-platforms',status:best?'solved-sampled':'no-route',start:actualStart,authoredStart:[...start],end,width,maxSlope,step,selected:best,failures,surfaceSamples:cache.size,terrainMutation:false,validation:{continuousCollision:false,gpuReviewed:false},limitations:['Full-width polygon landings replace intersecting rotated tread boxes.','Finite polygon surface probes; narrow unsampled features remain possible.','Building and landmark collision must be checked after changed downstream routing.']};
}
function stairPrism(poly,top,bottom){const positions=[],tri=(a,b,c)=>positions.push(...a,...b,...c),up=poly.map(p=>[p[0],top,p[1]]),down=poly.map(p=>[p[0],bottom,p[1]]);for(let i=1;i<poly.length-1;i++){tri(up[0],up[i+1],up[i]);tri(down[0],down[i],down[i+1]);}for(let i=0;i<poly.length;i++){const j=(i+1)%poly.length;tri(up[i],up[j],down[j]);tri(up[i],down[j],down[i]);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;}
export function createTargetNewCityStairRoute(options={}){
 const access=options.terminalAccess;let terminalOpenings=[];
 if(access){if(!Array.isArray(access.from)||access.from.length!==2||!access.from.every(Number.isFinite)||!Number.isFinite(access.width)||access.width<1.2)throw new TypeError('terminalAccess requires finite castle XZ from and width >= 1.2');const end=options.end||[62,3,64],a=[end[0],end[2]],b=access.from,dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<.1)throw new RangeError('terminalAccess needs a distinct approach');const nx=-dz/len*access.width/2,nz=dx/len*access.width/2;terminalOpenings=[[[a[0]+nx,a[1]+nz],[a[0]-nx,a[1]-nz],[b[0]-nx,b[1]-nz],[b[0]+nx,b[1]+nz]]];}
 const report=solveTargetNewCityStairRoute(options),group=new THREE.Group();report.parapetVersion='target-stair-parapets-3-terminal-access';report.terminalAccess=access?{from:[...access.from],width:access.width,openingFootprints:terminalOpenings,groundSupportVerified:false}:null;group.name='target-new-city-surveyed-stair-route';group.userData.preserveCitadelMaterials=true;const material=new THREE.MeshStandardMaterial({color:options.color||'#eee0bd',roughness:.94});material.userData.preserveCitadelMaterial=true;const geometry=[];
 for(const [i,t]of(report.selected?.treads||[]).entries()){const g=stairPrism(t.polygon,t.top,t.bottom);geometry.push(g);const m=new THREE.Mesh(g,material);m.name='surveyed-route-tread-'+i;m.receiveShadow=true;m.castShadow=true;group.add(m);}
 const treads=report.selected?.treads||[];
 const unit=new THREE.BoxGeometry(1,1,1);geometry.push(unit);let wall=null,cap=null;
 // Convex footprints in castle-local XZ; ignore a boundary-only touch.
 function intersects(a,b){for(const p of[a,b])for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length],nx=-(q[1]-p[i][1]),nz=q[0]-p[i][0],aa=a.map(v=>v[0]*nx+v[1]*nz),bb=b.map(v=>v[0]*nx+v[1]*nz);if(Math.max(...aa)<=Math.min(...bb)+1e-8||Math.max(...bb)<=Math.min(...aa)+1e-8)return false;}return true;}
 let disposed=false;
 function setSideOpeningFootprints(footprints=[]){
  if(disposed)throw new Error('stair route disposed');
  if(!Array.isArray(footprints)||footprints.some(p=>!Array.isArray(p)||p.length<3||p.some(v=>!Array.isArray(v)||v.length!==2||!v.every(Number.isFinite))))throw new TypeError('opening footprints must be finite convex XZ polygons');
  // Bridge refreshes replace caller openings, while this separately authored
  // terminal access remains open. Only intersecting edge segments are omitted.
  footprints=[...terminalOpenings,...footprints];
  wall?.removeFromParent();cap?.removeFromParent();wall?.dispose();cap?.dispose();
  const kept=[],omitted=[];
  for(const[i,t]of treads.entries())for(const [side,path]of(t.sideEdges||[]).entries())for(let e=1;e<path.length;e++){
   const a=path[e-1],b=path[e],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<1e-5)continue;const nx=-dz/length,nz=dx/length,x=(a[0]+b[0])/2+nx*.14,z=(a[1]+b[1])/2+nz*.14,ax=dx/2,az=dz/2;
   const polygon=[[x-ax-nx*.19,z-az-nz*.19],[x+ax-nx*.19,z+az-nz*.19],[x+ax+nx*.19,z+az+nz*.19],[x-ax+nx*.19,z-az+nz*.19]];
   if(footprints.some(p=>intersects(polygon,p)))omitted.push({treadIndex:i,side:side===0?-1:1,polygon});else kept.push({t:{...t,yaw:Math.atan2(dx,dz),ds:length},x,z});
  }
  wall=new THREE.InstancedMesh(unit,material,Math.max(1,kept.length));cap=new THREE.InstancedMesh(unit,material,Math.max(1,kept.length));wall.count=cap.count=kept.length;
  wall.name='surveyed-route-side-parapets';cap.name='surveyed-route-side-copings';wall.castShadow=cap.castShadow=wall.receiveShadow=cap.receiveShadow=true;
  const dummy=new THREE.Object3D();let k=0;for(const{t,x,z}of kept){dummy.position.set(x,t.top+.36,z);dummy.rotation.y=t.yaw;dummy.scale.set(.24,.72,t.ds+.025);dummy.updateMatrix();wall.setMatrixAt(k,dummy.matrix);dummy.position.y=t.top+.76;dummy.scale.set(.38,.12,t.ds+.04);dummy.updateMatrix();cap.setMatrixAt(k,dummy.matrix);k++;}
  wall.instanceMatrix.needsUpdate=cap.instanceMatrix.needsUpdate=true;group.add(wall,cap);
  report.parapets={instances:k*2,draws:2,insideClearWidth:report.width+.04,omittedSegments:omitted,openingFootprints:footprints.map(p=>p.map(v=>[...v]))};return report.parapets;
 }
 setSideOpeningFootprints(options.sideOpeningFootprints||[]);
 group.userData.routeReport=report;return{group,report,setSideOpeningFootprints,dispose(){if(disposed)return;disposed=true;group.removeFromParent();wall?.dispose();cap?.dispose();geometry.forEach(g=>g.dispose());material.dispose();group.clear();}};
}
