import * as THREE from 'three';

const EPS=1e-7;
const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
const area=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2;
const ccw=p=>area(p)<0?[...p].reverse():p;
function half(poly,a,b,inside=true){const out=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],dp=cross(a,b,p)*(inside?1:-1),dq=cross(a,b,q)*(inside?1:-1);if(dp>=-EPS)out.push(p);if((dp>=-EPS)!==(dq>=-EPS)){const t=dp/(dp-dq);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}}return out.length>=3&&Math.abs(area(out))>EPS?out:[];}
function intersection(a,b){let p=a;for(let i=0;i<b.length&&p.length;i++)p=half(p,b[i],b[(i+1)%b.length]);return p;}
// A convex polygon minus a convex clip yields disjoint convex fragments.
function subtract(a,b){if(!intersection(a,b).length)return[a];const out=[];let rest=a;for(let i=0;i<b.length&&rest.length;i++){const fragment=half(rest,b[i],b[(i+1)%b.length],false);if(fragment.length)out.push(fragment);rest=half(rest,b[i],b[(i+1)%b.length]);}return out;}
function rectangle(t,width){if(t.polygon) return ccw(t.polygon.map(p=>[...p]));const dx=Math.sin(t.yaw)*(t.ds+.012)/2,dz=Math.cos(t.yaw)*(t.ds+.012)/2,nx=Math.cos(t.yaw)*width/2,nz=-Math.sin(t.yaw)*width/2;return ccw([[t.x-dx-nx,t.z-dz-nz],[t.x+dx-nx,t.z+dz-nz],[t.x+dx+nx,t.z+dz+nz],[t.x-dx+nx,t.z-dz+nz]]);}
function segmentDistance(p,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],q=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(p[0]-a[0]-q*dx,p[1]-a[1]-q*dz);}

/** Castle-local XYZ. stairReport is the actual solveTargetNewCityStairRoute report.
 * Existing tread meshes remain authoritative: connector cells are cut OUTSIDE
 * their actual ds+.012 footprint and the join boundary snaps to their top.
 * groundHeightAt(x,z) is read-only and returns castle-local Y or null. */
export function createTargetBridgeStairConnector({stairReport,dock=[51,12,39],treadIndex=14,width=2.4,groundHeightAt=null,dockTangent=[28,6],palette={}}={}){
 const treads=stairReport?.selected?.treads;if(!treads?.[treadIndex])throw new TypeError('sampled stair report and valid treadIndex required');
 if(!Array.isArray(dock)||dock.length!==3||![...dock,width,stairReport.width].every(Number.isFinite)||width<=0||stairReport.width<=0)throw new RangeError('invalid connector dimensions');
 if(groundHeightAt!==null&&typeof groundHeightAt!=='function')throw new TypeError('groundHeightAt must be a function');
 const target=treads[treadIndex],end=[target.x,target.top,target.z],dx=end[0]-dock[0],dz=end[2]-dock[2],length=Math.hypot(dx,dz);if(length<.1)throw new RangeError('connector too short');
 const nx=-dz/length,nz=dx/length,raw=ccw([[dock[0]+nx*width/2,dock[2]+nz*width/2],[dock[0]-nx*width/2,dock[2]-nz*width/2],[end[0]-nx*width/2,end[2]-nz*width/2],[end[0]+nx*width/2,end[2]+nz*width/2]]);
 const stairPolys=treads.map((t,i)=>({i,top:t.top,polygon:rectangle(t,stairReport.width)})),joins=stairPolys.filter(s=>intersection(raw,s.polygon).length);
 let cells=[raw];for(const s of joins)cells=cells.flatMap(p=>subtract(p,s.polygon));
 const nominal=([x,z])=>dock[1]+(end[1]-dock[1])*Math.max(0,Math.min(1,((x-dock[0])*dx+(z-dock[2])*dz)/(length*length)));
 const seamPoints=[];function topAt(p){const near=joins.filter(s=>s.polygon.some((a,i)=>segmentDistance(p,a,s.polygon[(i+1)%s.polygon.length])<1e-5)&&s.polygon.every((a,i)=>cross(a,s.polygon[(i+1)%s.polygon.length],p)>=-1e-5));if(!near.length){
  // Interpolate toward the actual side-entry seam along each connector ray.
  // A nominal endpoint ramp would create steep skinny triangles at tread 17.
  const normal=[Math.cos(target.yaw),-Math.sin(target.yaw)],side=(dock[0]-target.x)*normal[0]+(dock[2]-target.z)*normal[1]<0?-1:1,edge=target.x*normal[0]+target.z*normal[1]+side*stairReport.width/2,rate=(dx*normal[0]+dz*normal[1])/length;
  if(Math.abs(rate)<1e-6)return nominal(p);
  const remaining=(edge-p[0]*normal[0]-p[1]*normal[1])/rate,q=[p[0]+remaining*dx/length,p[1]+remaining*dz/length],along=((p[0]-dock[0])*dx+(p[1]-dock[2])*dz)/length;
  const entry=joins.filter(s=>s.polygon.every((a,i)=>cross(a,s.polygon[(i+1)%s.polygon.length],q)>=-1e-5));
  const nearest=entry.length?Math.max(...entry.map(s=>s.top)):joins.reduce((best,s)=>Math.hypot(treads[s.i].x-q[0],treads[s.i].z-q[1])<Math.hypot(treads[best.i].x-q[0],treads[best.i].z-q[1])?s:best,joins[0])?.top;
  return nearest===undefined?nominal(p):dock[1]+(nearest-dock[1])*Math.max(0,Math.min(1,along/(along+Math.max(0,remaining))));
 }const top=Math.max(...near.map(s=>s.top));seamPoints.push({point:[p[0],top,p[1]],treadIndices:near.map(s=>s.i)});return top;}
 const group=new THREE.Group();group.name='target-bridge-stair-side-connector';group.userData.preserveCitadelMaterials=true;
 const material=new THREE.MeshStandardMaterial({color:palette.stone||'#eee0bd',roughness:.94});material.userData.preserveCitadelMaterial=true;
 const geometry=[],surfaceSamples=[],walkSurfaces=[];const cache=new Map();
 const sample=(p)=>{const key=p.map(n=>n.toFixed(7)).join(',');if(!cache.has(key)){const y=groundHeightAt?groundHeightAt(...p):null;if(y!==null&&!Number.isFinite(y))throw new TypeError('groundHeightAt must return finite Y or null');cache.set(key,y);}return cache.get(key);};
 try{for(const [i,poly]of cells.entries()){
  const top=poly.map(p=>[p[0],topAt(p),p[1]]),ys=top.map(p=>p[1]),center=[poly.reduce((a,p)=>a+p[0],0)/poly.length,poly.reduce((a,p)=>a+p[1],0)/poly.length];
  const probes=[...poly,center,...poly.map((p,i)=>[(p[0]+poly[(i+1)%poly.length][0])/2,(p[1]+poly[(i+1)%poly.length][1])/2])];
  const hits=probes.map(p=>{const y=sample(p);surfaceSamples.push({x:p[0],z:p[1],groundY:y});return y;}).filter(y=>y!==null);
  const bottom=Math.min(...ys)-.22;const footing=hits.length?Math.min(bottom,...hits.map(y=>y-.12)):bottom;
  const positions=[];const tri=(a,b,c)=>positions.push(...a,...b,...c);
  // XZ CCW has -Y cross product; reverse top winding for +Y.
  for(let j=1;j<top.length-1;j++){tri(top[0],top[j+1],top[j]);tri([top[0][0],footing,top[0][2]],[top[j][0],footing,top[j][2]],[top[j+1][0],footing,top[j+1][2]]);}
  for(let j=0;j<top.length;j++){const a=top[j],b=top[(j+1)%top.length],A=[a[0],footing,a[2]],B=[b[0],footing,b[2]];tri(a,b,B);tri(a,B,A);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();g.computeBoundingBox();geometry.push(g);const mesh=new THREE.Mesh(g,material);mesh.name=`bridge-stair-connector-cell-${i}`;mesh.castShadow=mesh.receiveShadow=true;mesh.userData.targetWalkable=true;group.add(mesh);
  walkSurfaces.push({id:mesh.name,polygon:poly,vertices:top,triangles:top.slice(2).map((p,j)=>[top[0],p,top[j+1]]),footingY:footing,groundSampleCount:hits.length});
 }}catch(error){geometry.forEach(g=>g.dispose());material.dispose();throw error;}
 // Top evaluation follows actual fan triangles, not the nominal straight ramp.
 function surfaceY(p,w){for(const tri of w.triangles){const q=tri.map(v=>[v[0],v[2]]),D=cross(q[0],q[1],q[2]),u=cross(q[1],q[2],p)/D,v=cross(q[2],q[0],p)/D,z=1-u-v;if(Math.min(u,v,z)>=-1e-6)return u*tri[0][1]+v*tri[1][1]+z*tri[2][1];}return null;}
 const penetrationSamples=surfaceSamples.flatMap(s=>{if(s.groundY===null)return[];const y=walkSurfaces.map(w=>surfaceY([s.x,s.z],w)).find(y=>y!==null);return y!==undefined&&s.groundY>y+.025?[{...s,walkY:y,penetration:s.groundY-y}]:[];});
 const railMaterial=new THREE.MeshStandardMaterial({color:palette.rail||'#6d725d',roughness:.76});railMaterial.userData.preserveCitadelMaterial=true;
 const railSegments=[],railUnit=new THREE.CylinderGeometry(.042,.042,1,8);geometry.push(railUnit);
 function bar(name,a,b){const delta=new THREE.Vector3(...b).sub(new THREE.Vector3(...a));if(delta.length()<.025)return;const m=new THREE.Mesh(railUnit,railMaterial);m.name=name;m.position.fromArray(a).addScaledVector(delta,.5);m.scale.y=delta.length();m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());m.castShadow=m.receiveShadow=true;group.add(m);}
 const dl=Math.hypot(...dockTangent);if(!Number.isFinite(dl)||dl<.01){geometry.forEach(g=>g.dispose());material.dispose();railMaterial.dispose();throw new RangeError('invalid dock tangent');}
 for(const w of walkSurfaces)for(let i=0;i<w.vertices.length;i++){
  let a=w.vertices[i],b=w.vertices[(i+1)%w.vertices.length];const across=p=>(p[0]-dock[0])*nx+(p[2]-dock[2])*nz,aa=across(a),bb=across(b);if(Math.abs(Math.abs(aa)-width/2)>1e-5||Math.abs(aa-bb)>1e-5)continue;
  const side=Math.sign(aa),insideDock=p=>((p[0]-dock[0])*dockTangent[0]+(p[2]-dock[2])*dockTangent[1])/dl-.18;let da=insideDock(a),db=insideDock(b);if(da<=0&&db<=0)continue;
  if(da<0){const f=-da/(db-da);a=a.map((v,k)=>v+(b[k]-v)*f);}else if(db<0){const f=-db/(da-db);b=b.map((v,k)=>v+(a[k]-v)*f);}
  // Keep rail axes .10 outside the walk edge; full radius stays within .15.
  const A=[a[0]+nx*side*.10,a[1]+.98,a[2]+nz*side*.10],B=[b[0]+nx*side*.10,b[1]+.98,b[2]+nz*side*.10];bar('connector-side-handrail',A,B);const l=Math.hypot(b[0]-a[0],b[2]-a[2]),count=Math.max(1,Math.ceil(l/1.8));for(let j=0;j<=count;j++){const f=j/count,p=A.map((v,k)=>v+(B[k]-v)*f);bar('connector-side-post',[p[0],p[1]-.96,p[2]],p);}railSegments.push({from:A,to:B,clearWidth:width,outwardExtent:.142});
 }
 const slopes=walkSurfaces.flatMap(w=>w.triangles.map(([a,b,c])=>{const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];return Math.hypot(n[0],n[2])/Math.abs(n[1]);}));
 const report={version:'target-bridge-stair-connector-1',dock:[...dock],endpoint:end,width,length,nominalSlope:Math.abs(end[1]-dock[1])/length,maximumTriangleSlope:Math.max(...slopes),railSegments,treadIndex,joinTreadIndices:joins.map(s=>s.i),walkSurfaces,seamPoints,sideOpeningFootprints:[raw],terrainMutation:false,existingTreadsMutated:false,stairOverlapAreaRemaining:cells.reduce((sum,p)=>sum+stairPolys.reduce((n,s)=>n+Math.abs(area(intersection(p,s.polygon))),0),0),support:{sampled:!!groundHeightAt,uniqueSamples:cache.size,missingCount:surfaceSamples.filter(s=>s.groundY===null).length,penetrationSamples,validated:!!groundHeightAt&&surfaceSamples.every(s=>s.groundY!==null)&&penetrationSamples.length===0},validation:{gpuReviewed:false,buildingClearance:false,controllerNavigation:false},limitations:['Trimmed to actual surveyed tread footprints; close seam heights follow existing stair tops, without raising any tread.','Ground probes are finite vertices/midpoints/centroids, not continuous terrain certification.','Thin side rails keep 2.4 m clear width; no transverse rail is placed across dock or stair entry. Rail joints still need GPU review.','Bridge dock union, building ornaments, runtime navigation and GPU views require integration checks.']};
 group.userData.connectorReport=report;let disposed=false;return{group,report,sideOpeningFootprints:report.sideOpeningFootprints,dispose(){if(disposed)return;disposed=true;group.removeFromParent();geometry.forEach(g=>g.dispose());material.dispose();railMaterial.dispose();group.clear();}};
}
