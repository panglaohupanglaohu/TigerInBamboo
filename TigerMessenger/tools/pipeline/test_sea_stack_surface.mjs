import assert from 'node:assert/strict';
import {register} from 'node:module';
import {createHash} from 'node:crypto';
const threeUrl=new URL('../../vendor/three.module.js',import.meta.url).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,next){if(s==='three')return {url:${JSON.stringify(threeUrl)},shortCircuit:true};return next(s,c);}`),import.meta.url);
const {coastalStackGeometry}=await import('../../src/world/seaStackCoastalGeometry.js');
const {smoothSeaStackSurface}=await import('../../src/world/seaStackSurfaceSmoothing.js');
const sub=(a,b)=>a.map((v,k)=>v-b[k]),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const normal=(p,a,b,c)=>cross(sub(p[b],p[a]),sub(p[c],p[a]));
const positions=g=>Array.from({length:g.attributes.position.count},(_,i)=>Array.from(g.attributes.position.array.slice(i*3,i*3+3)));
const hash=g=>{const h=createHash('sha256');for(const a of [g.attributes.position.array,g.index.array])h.update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));return h.digest('hex');};
// Generated from the actual pre-study source snapshot, not from this finisher.
const legacyHashes={1:'15c7b3d06f41ba1264527ba976a144c01adc41261ea22420f608ce515781f6f0',7:'149449798faead25944c346f63e3ff3e5dbb3cfa64e2f592cf5b76e25ce40d9c',41:'3b694636e437259b74ee207b88d38df5e91580442e27bf546e753ded2a0c7ae9'};
const results=[];
const approvedEight=Array.from({length:8},(_,index)=>{const i=index%7;return [(12+(i%3)*4)*.68,28+(i*13%28),index<7?i:10];});
for(const [radius,height,seed]of [...approvedEight,[12,48,1],[12,48,2],[12,48,3],[12,48,7],[12,48,11],[12,48,23],[12,48,41],[12,48,97],[6,26,19],[17,82,53]]){
 globalThis.location={search:'?seaStackStudy=0'};const legacy=coastalStackGeometry(radius,height,seed);
 if(legacyHashes[seed]&&radius===12)assert.equal(hash(legacy),legacyHashes[seed],'fallback must preserve pre-study geometry');
 globalThis.location={search:'?seaStackSmooth=0'};const before=coastalStackGeometry(radius,height,seed);
 globalThis.location={search:''};const after=coastalStackGeometry(radius,height,seed);
 const a=positions(before),b=positions(after),indices=Array.from(after.index.array),s=after.userData.surfaceSmoothing.smoothStats;
 // Study may refine the sampling grid, so bottom vertex identity is not a
 // layout contract. Its support-plane height and conservative radius are.
 assert(Math.abs(before.boundingBox.min.y+height/2)<2e-5,'support-plane height changed');
 assert.deepEqual(legacy.userData.terraces.grid,[18,32,18],'legacy sampling changed');
 assert.deepEqual(before.userData.terraces.grid,[26,44,26],'study refinement missing');
 assert.deepEqual(Array.from(before.index.array),indices,'topology must not change');
 assert.equal(after.userData.terraces.footprintRadius,before.userData.terraces.footprintRadius,'layout envelope changed');
 assert.equal(after.userData.terraces.footprintRadius,legacy.userData.terraces.footprintRadius,'new shape changed old layout envelope');
 assert.notEqual(hash(before),hash(legacy),'study needs real geometric massing, not only surface polish');
 assert.equal(s.skippedReason,undefined);assert.equal(s.boundaryEdges,0);assert.equal(s.nonManifoldEdges,0);assert.equal(s.orientationErrors,0);
 assert(s.movedVertices>a.length*.15,'finish must actually move geometry');
 const edges=new Map(),oldNormals=[],newNormals=[],terraceAreas=before.userData.terraces.levels.map(()=>0);let volumeBefore=0,volumeAfter=0,minAreaRatio=Infinity,minNormalAgreement=1;
 for(let j=0;j<indices.length;j+=3){
  const [x,y,z]=indices.slice(j,j+3),n0=normal(a,x,y,z),n1=normal(b,x,y,z),l0=Math.hypot(...n0),l1=Math.hypot(...n1);
  assert(l0>0&&l1>0,'degenerate face');const agreement=dot(n0,n1)/l0/l1;
  assert(agreement>.19,'flipped or nearly perpendicular face');assert(l1/l0>.19,'collapsed triangle');
  minAreaRatio=Math.min(minAreaRatio,l1/l0);minNormalAgreement=Math.min(minNormalAgreement,agreement);
  oldNormals.push(n0.map(v=>v/l0));newNormals.push(n1.map(v=>v/l1));
  before.userData.terraces.levels.forEach((level,k)=>{const levelY=-height/2+level*height;if([x,y,z].every(id=>Math.abs(a[id][1]-levelY)<2e-5))terraceAreas[k]+=l0*.5;});
  volumeBefore+=dot(a[x],cross(a[y],a[z]))/6;volumeAfter+=dot(b[x],cross(b[y],b[z]))/6;
  for(const [u,v]of [[x,y],[y,z],[z,x]]){const key=u<v?u+':'+v:v+':'+u;const edge=edges.get(key)||{count:0,direction:0,faces:[]};edge.count++;edge.direction+=u<v?1:-1;edge.faces.push(j/3);edges.set(key,edge);}
 }
 let roughBefore=0,roughAfter=0,roughEdges=0;
 for(const e of edges.values()){
  assert.equal(e.count,2,'open or nonmanifold edge');assert.equal(e.direction,0,'inconsistent winding');
  const [u,v]=e.faces,agreement=dot(oldNormals[u],oldNormals[v]);
  if(agreement>.85){roughBefore+=1-agreement;roughAfter+=1-dot(newNormals[u],newNormals[v]);roughEdges++;}
 }
 assert(volumeBefore>0&&volumeAfter>0,'inside-out solid');assert(Math.abs(volumeAfter/volumeBefore-1)<.04,'excessive volume loss');
 // Wide main stacks have two major shelves; side-ridge roles retain three.
 assert.equal(before.userData.terraces.levels.length,seed%2===0?2:3);assert.equal(before.userData.landform.terraceCount,before.userData.terraces.levels.length);assert(terraceAreas.every(area=>area>radius*radius*.008),`missing useful geometric terrace seed=${seed} areas=${terraceAreas}`);
 let maximumDisplacement=0,footprint=0,baseCount=0,shelfCount=0;
 const levels=before.userData.terraces.levels.map(t=>-height/2+t*height);
 for(let i=0;i<a.length;i++){
  assert(b[i].every(Number.isFinite));const d=Math.hypot(...sub(b[i],a[i]));maximumDisplacement=Math.max(maximumDisplacement,d);footprint=Math.max(footprint,Math.hypot(b[i][0],b[i][2]));
  if(Math.abs(a[i][1]+height/2)<2e-5){baseCount++;assert.deepEqual(b[i],a[i],'support base moved');}
  if(levels.some(y=>Math.abs(a[i][1]-y)<Math.max(2e-5,height*1e-6))){shelfCount++;assert.equal(b[i][1],a[i][1],'terrace height changed');}
 }
 assert(baseCount>0&&shelfCount>0);assert(maximumDisplacement<=radius*.035+1e-5);assert(footprint<=before.userData.terraces.footprintRadius+1e-5);
 // Strong creases are intentionally preserved, so compare only originally
 // smooth adjacencies to ensure the finish reduces, rather than adds, microfacets.
 assert(roughAfter<roughBefore,'microfacet roughness did not improve');
 const repeat=coastalStackGeometry(radius,height,seed);assert.equal(hash(after),hash(repeat),'nondeterministic finish');
 results.push({seed,radius,height,vertices:a.length,triangles:indices.length/3,baseCount,shelfCount,terraceAreas,maximumDisplacement,minAreaRatio,minNormalAgreement,volumeRatio:volumeAfter/volumeBefore,roughnessRatio:roughAfter/roughBefore,roughEdges});
 before.dispose();after.dispose();repeat.dispose();legacy.dispose();
}
// Fixed authored shape, three actually solved WFC paths. This measures the
// resulting mesh, rather than merely checking copied semantic parameters.
const {solveCoastalStackWfc}=await import('../../src/world/seaStackWfc.js');
const paths=new Map();for(let wfcSeed=0;wfcSeed<256&&paths.size<3;wfcSeed++){
 const solution=solveCoastalStackWfc(wfcSeed),role=solution.modules.find(m=>m.role==='terrace').id;if(!paths.has(role))paths.set(role,wfcSeed);
}
assert.equal(paths.size,3,'expected three legal coastal role paths');
const semanticMeasurements=[];
for(const [terraceRole,wfcSeed]of paths){
 const radius=13.6,height=54,modelSeed=2,g=coastalStackGeometry(radius,height,modelSeed,{wfcSeed}),repeat=coastalStackGeometry(radius,height,modelSeed,{wfcSeed}),p=positions(g),idx=Array.from(g.index.array);
 assert.equal(hash(g),hash(repeat),'WFC semantic geometry must be deterministic');
 assert.equal(g.userData.semanticWfc.terraceRole,terraceRole);assert.equal(g.userData.wfc.socketMismatches,0);
 assert.equal(g.userData.terraces.footprintRadius,semanticMeasurements[0]?.footprint??g.userData.terraces.footprintRadius,'WFC role changed layout envelope');
 assert(Math.abs(g.boundingBox.min.y+height/2)<2e-5);
 let terraceArea=0,crownArea=0,crownMoment=0,shelfMinX=Infinity,shelfMaxX=-Infinity,shelfMinZ=Infinity,shelfMaxZ=-Infinity;
 const shelfY=-height/2+g.userData.terraces.levels[1]*height;
 for(let i=0;i<idx.length;i+=3){const ids=idx.slice(i,i+3),area=Math.hypot(...normal(p,...ids))*.5;
  if(ids.every(id=>Math.abs(p[id][1]-shelfY)<2e-5)){terraceArea+=area;for(const id of ids){shelfMinX=Math.min(shelfMinX,p[id][0]);shelfMaxX=Math.max(shelfMaxX,p[id][0]);shelfMinZ=Math.min(shelfMinZ,p[id][2]);shelfMaxZ=Math.max(shelfMaxZ,p[id][2]);}}
  if(ids.every(id=>p[id][1]>height*.29)){crownArea+=area;crownMoment+=area*ids.reduce((sum,id)=>sum+p[id][1],0)/3;}
 }
 assert(terraceArea>radius*radius*.008);assert(crownArea>0);
 semanticMeasurements.push({terraceRole,wfcSeed,capRole:g.userData.semanticWfc.capRole,terraceArea,terraceWidthX:shelfMaxX-shelfMinX,terraceWidthZ:shelfMaxZ-shelfMinZ,crownArea,crownMeanHeight:crownMoment/crownArea,footprint:g.userData.terraces.footprintRadius,hash:hash(g)});
 g.dispose();repeat.dispose();
}
assert.equal(new Set(semanticMeasurements.map(m=>m.hash)).size,3,'role paths must change real mesh geometry');
for(let i=0;i<semanticMeasurements.length;i++)for(let j=i+1;j<semanticMeasurements.length;j++){const a=semanticMeasurements[i],b=semanticMeasurements[j];assert(Math.abs(a.terraceArea-b.terraceArea)>.05,'terrace roles must change measured shelf area');assert(Math.hypot(a.terraceWidthX-b.terraceWidthX,a.terraceWidthZ-b.terraceWidthZ)>.001,'terrace roles must change measured shelf spans');}
const blunt=semanticMeasurements.find(m=>m.capRole==='blunt-broken-cap'),fractured=semanticMeasurements.filter(m=>m.capRole==='fractured-cap-ledge');
for(const m of fractured){assert(Math.abs(blunt.crownArea-m.crownArea)>.1,'cap role must change measured crown');assert(Math.abs(blunt.crownMeanHeight-m.crownMeanHeight)>.01,'cap role must change crown height distribution');}
// Damaged input is returned unchanged; a safety filter must never silently
// smooth through a hole merely because the visible side looks acceptable.
const tetra=[[0,0,0],[1,0,0],[0,1,0],[0,0,1]],open=[0,2,1,0,1,3,0,3,2];
const rejected=smoothSeaStackSurface(tetra,open,{radius:1,height:2});
assert.equal(rejected.stats.skippedReason,'invalid-input-topology');assert.deepEqual(rejected.positions,tetra);
delete globalThis.location;
console.log(JSON.stringify({passed:true,cases:results.length,results,semanticMeasurements},null,2));
