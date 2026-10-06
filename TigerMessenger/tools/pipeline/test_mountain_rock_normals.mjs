import assert from 'node:assert/strict';
import {register} from 'node:module';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const threeUrl=new URL('../../vendor/three.module.js',import.meta.url).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,next){if(s==='three')return {url:${JSON.stringify(threeUrl)},shortCircuit:true};return next(s,c);}`),import.meta.url);
const THREE=await import('three');
const {refineRockFaces}=await import('../../src/world/citadel/mountainRockGeometry.js');
const {rockSurfaceOptions,rockCrestFold}=await import('../../src/world/citadel/mountainRockNormals.js');
// These cases verify legacy per-pass parser semantics; published defaults are
// checked separately in check_mountain_release.mjs.
const legacySurfaceOptions=(query='')=>rockSurfaceOptions('?citadelMountainRelease=0&'+new URLSearchParams(query));
const {landformProtection}=await import('../../src/world/citadel/mountainLandform.js');
const hash=a=>a?createHash('sha256').update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).digest('hex'):null;
const g=(p,index)=>{const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.Float32BufferAttribute(p,3));if(index)out.setIndex(index);out.computeVertexNormals();return out;};
const vector=(a,i)=>new THREE.Vector3().fromBufferAttribute(a,i);
const sameShape=(a,b)=>{assert.equal(hash(a.attributes.position.array),hash(b.attributes.position.array));assert.equal(hash(a.index?.array),hash(b.index?.array));for(const name of Object.keys(a.attributes).filter(n=>n!=='normal'))assert.equal(hash(a.attributes[name].array),hash(b.attributes[name].array),`${name} changed`);};
const report=[];
assert.deepEqual(legacySurfaceOptions(''),{pass:0,bump:.38,relief:.65});assert.deepEqual(legacySurfaceOptions('?citadelRockSurfacePass=0&citadelRockBump=0'),{pass:0,bump:.38,relief:.65});
assert.deepEqual(legacySurfaceOptions('?citadelRockSurfacePass=1'),{pass:1,bump:.12,relief:.65});assert.equal(legacySurfaceOptions('?citadelRockSurfacePass=1&citadelRockBump=0').bump,0);assert.equal(legacySurfaceOptions('?citadelRockSurfacePass=1&citadelRockBump=.38').bump,.38);
assert.deepEqual(legacySurfaceOptions('?citadelRockSurfacePass=2'),{pass:2,bump:.12,relief:.65});
assert.deepEqual(legacySurfaceOptions('?citadelRockSurfacePass=3'),{pass:3,bump:.12,relief:.65});

// Real curved source patch: source-face interiors contain nonzero relief;
// candidate changes normals, never those displacements or attribute values.
const pos=[],idx=[],uv=[];for(let z=0;z<=6;z++)for(let x=0;x<=6;x++){pos.push(x*5,Math.sin(x*.4)*2+Math.cos(z*.3),z*5);uv.push(x/6,z/6);}
for(let z=0;z<6;z++)for(let x=0;x<6;x++){const a=z*7+x;idx.push(a,a+7,a+1,a+1,a+7,a+8);}
const source=g(pos,idx);source.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));const sourceHash=hash(source.attributes.position.array);
const before=refineRockFaces(source),after=refineRockFaces(source,{surfaceNormals:{}}),repeat=refineRockFaces(source,{surfaceNormals:{}});
sameShape(before,after);sameShape(after,repeat);assert.equal(sourceHash,hash(source.attributes.position.array),'mutated source');assert.equal(hash(after.attributes.normal.array),hash(repeat.attributes.normal.array),'nondeterministic normals');assert(after.userData.rockSurfaceNormals.smoothedCorners>0);assert(before.userData.rockRefinement.maxOffset>.05);
let maximumNormalDifference=0,sharedMax=0,sharedSamples=0;const byPosition=new Map();
for(let i=0;i<after.attributes.position.count;i++){
 const n=vector(after.attributes.normal,i),p=vector(after.attributes.position,i);assert(Number.isFinite(n.length()));assert(Math.abs(n.length()-1)<2e-6);maximumNormalDifference=Math.max(maximumNormalDifference,n.distanceTo(vector(before.attributes.normal,i)));
 // Ordinary internal duplicates (not boundary edges/uncertain normal domains).
 if(p.x>5.1&&p.x<24.9&&p.z>5.1&&p.z<24.9){const key=p.toArray().map(v=>Math.round(v*1e5)).join(',');if(byPosition.has(key)){sharedMax=Math.max(sharedMax,n.distanceTo(byPosition.get(key)));sharedSamples++;}else byPosition.set(key,n);}
}
assert(maximumNormalDifference>.05,'candidate failed to reduce actual generated facets');assert(sharedSamples>100);assert(sharedMax<2e-6,`ordinary shared normals discontinuous ${sharedMax}`);
report.push({case:'curved relief surface',positionHash:hash(after.attributes.position.array),maximumNormalDifference,sharedMax,sharedSamples,audit:after.userData.rockSurfaceNormals});

const pair=()=>g([0,0,0,8,0,0,0,0,8,8,2,8],[0,2,1,1,2,3]);
// Exact source edge with different subdivision counts must be recorded and
// remain a hard fallback, not silently presented as a repaired T-junction.
const tSource=pair(),selectTriangle=(a,b,c)=>c.y===0;
const tBefore=refineRockFaces(tSource,{selectTriangle}),tAfter=refineRockFaces(tSource,{selectTriangle,surfaceNormals:{}});sameShape(tBefore,tAfter);assert.equal(tAfter.userData.rockSurfaceNormals.subdivisionMismatchEdges,1);assert.equal(tAfter.userData.rockSurfaceNormals.softEdges,0);report.push({case:'mismatched subdivision hard fallback',audit:tAfter.userData.rockSurfaceNormals});

for(const mode of ['shore','explicit-protection']){
 const s=pair();if(mode==='shore')s.setAttribute('shoreBoundaryBottom',new THREE.Float32BufferAttribute([1,1,1,1],1));
 const a=refineRockFaces(s),b=refineRockFaces(s,{surfaceNormals:{protectedFace:()=>mode==='explicit-protection'}});sameShape(a,b);assert.equal(hash(a.attributes.normal.array),hash(b.attributes.normal.array),'protected normals changed');assert.equal(b.userData.rockSurfaceNormals.protectedFaces,2);report.push({case:mode,normalHash:hash(b.attributes.normal.array)});
}

for(const mode of ['material','semantic']){
 const s=pair();if(mode==='material'){s.addGroup(0,3,0);s.addGroup(3,3,1);}else s.setAttribute('procgenSemantic',new THREE.Float32BufferAttribute([1,1,2,2],1));
 const a=refineRockFaces(s),b=refineRockFaces(s,{surfaceNormals:{}});sameShape(a,b);assert.equal(b.userData.rockSurfaceNormals.semanticEdges,1);assert.equal(b.userData.rockSurfaceNormals.softEdges,0);report.push({case:mode,audit:b.userData.rockSurfaceNormals});
}
// Ninety-degree cliff: the source edge is a hard edge even without labels.
const cliff=g([0,0,0,8,0,0,0,0,8,0,8,0],[0,2,1,0,1,3]);const ca=refineRockFaces(cliff),cb=refineRockFaces(cliff,{surfaceNormals:{}});sameShape(ca,cb);assert.equal(cb.userData.rockSurfaceNormals.sharpEdges,1);assert.equal(cb.userData.rockSurfaceNormals.softEdges,0);report.push({case:'sharp cliff',audit:cb.userData.rockSurfaceNormals});

// The shader's mesh-to-castle normal transform is inverse-transpose. Test a
// nonuniformly scaled, rotated local frame against two transformed tangents.
const world=new THREE.Matrix4().compose(new THREE.Vector3(70,11,-23),new THREE.Quaternion().setFromEuler(new THREE.Euler(.4,.8,-.7)),new THREE.Vector3(2,.5,3));
const castle=new THREE.Matrix4().makeRotationX(.63),toCastle=castle.clone().invert().multiply(world),normalMatrix=new THREE.Matrix3().getNormalMatrix(toCastle),tangentMatrix=new THREE.Matrix3().setFromMatrix4(toCastle);
const u=new THREE.Vector3(1,.2,0),v=new THREE.Vector3(0,.3,1),n=u.clone().cross(v).normalize().applyMatrix3(normalMatrix).normalize();
const errors=[Math.abs(n.dot(u.clone().applyMatrix3(tangentMatrix).normalize())),Math.abs(n.dot(v.clone().applyMatrix3(tangentMatrix).normalize()))];assert(Math.max(...errors)<1e-12);report.push({case:'nonuniform spherical transform',orthogonalityErrors:errors});
// Exercise the actual material factory against the batch's pre-change source,
// without importing the game's scene builders. GPU compilation is separate.
const materialFactory=path=>{const code=readFileSync(new URL(path,import.meta.url),'utf8'),start=code.indexOf('function rockMaterial('),end=code.indexOf('export function applyCitadelMountainStudy(',start);assert(start>=0&&end>start);return new Function('THREE','rockMask',`${code.slice(start,end)}\nreturn rockMaterial;`)(THREE,()=>new THREE.Texture());};
const oldFactory=materialFactory('../../artifacts/pipeline/citadel-five-hour-20261005/source-before/mountainStudy.js'),newFactory=materialFactory('../../src/world/citadel/mountainStudy.js');
const compile=material=>{const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader);return shader;};
const args=[new THREE.MeshStandardMaterial(),new THREE.Matrix4(),160,13],oldMat=oldFactory(...args),offMat=newFactory(...args),oldShader=compile(oldMat),offShader=compile(offMat);
assert.equal(offMat.flatShading,oldMat.flatShading);assert.equal(offMat.customProgramCacheKey(),oldMat.customProgramCacheKey());assert.equal(offShader.vertexShader,oldShader.vertexShader,'default vertex shader changed');assert.equal(offShader.fragmentShader,oldShader.fragmentShader,'default fragment shader changed');
const onMat=newFactory(...args,{pass:1,bump:.12},normalMatrix),onShader=compile(onMat);assert.equal(onMat.flatShading,false);assert.notEqual(onMat.customProgramCacheKey(),offMat.customProgramCacheKey());assert(onShader.vertexShader.includes('vMtShade=mtNormalToCastle*objectNormal'));assert(onShader.fragmentShader.includes('abs(normalize(vMtShade))'));assert(onShader.fragmentShader.includes('abs(dot(mtN,mtUp))'),'geometric slope must remain geometric');assert(onShader.fragmentShader.includes('mtGrad*0.1200'));assert.equal(onShader.uniforms.mtNormalToCastle.value,normalMatrix);
report.push({case:'actual material source and default shader regression',defaultShaderUnchanged:true,defaultKey:offMat.customProgramCacheKey(),candidateKey:onMat.customProgramCacheKey(),gpuCompileTested:false});
const pass2Mat=newFactory(...args,{pass:2,bump:.12},normalMatrix);assert.notEqual(pass2Mat.customProgramCacheKey(),onMat.customProgramCacheKey());assert(pass2Mat.customProgramCacheKey().includes('surface2'));
// Real landformProtection oriented bounds. A long rotated walkway's world
// AABB includes this unrelated rock patch, but its actual oriented box does
// not. This proves the mechanism, not the cause of every protected real face.
const boundsCastle=new THREE.Group();boundsCastle.rotation.y=Math.PI/4;
const walkway=new THREE.Mesh(new THREE.BoxGeometry(40,2,2));walkway.userData.westCityWalkable=true;boundsCastle.add(walkway);boundsCastle.updateWorldMatrix(true,true);
const aabb=[new THREE.Box3().setFromObject(walkway)],oriented=landformProtection(boundsCastle),patchPos=[],patchIdx=[];
for(let z=0;z<=4;z++)for(let x=0;x<=4;x++)patchPos.push(6+x*2,.35*Math.sin(x*.8)*Math.cos(z*.7),6+z*2);
for(let z=0;z<4;z++)for(let x=0;x<4;x++){const a=z*5+x;patchIdx.push(a,a+5,a+1,a+1,a+5,a+6);}
const patch=g(patchPos,patchIdx),protect=boxes=>points=>points.some(p=>boxes.some(b=>b.distanceToPoint(p)<4));
const normal1=refineRockFaces(patch,{selectTriangle:()=>false,surfaceNormals:{protectedFace:protect(aabb),protectionBounds:'world-aabb'}}),normal2=refineRockFaces(patch,{selectTriangle:()=>false,surfaceNormals:{protectedFace:protect(oriented),protectionBounds:'oriented-landform-bounds'}});
sameShape(normal1,normal2);assert.equal(normal1.userData.rockSurfaceNormals.protectedFaces,32);assert.equal(normal2.userData.rockSurfaceNormals.protectedFaces,0);assert.notEqual(hash(normal1.attributes.normal.array),hash(normal2.attributes.normal.array));assert.equal(normal2.userData.rockSurfaceNormals.creaseAngleDeg,42);assert.equal(normal2.userData.rockRefinement.refined,0,'normal pass must not override geometric face selection');
report.push({case:'rotated walkway normal-only protection',pass1Protected:32,pass2Protected:0,positionsUnchanged:true,geometricRefinementUnchanged:true,pass2Key:pass2Mat.customProgramCacheKey(),actualSceneCauseProven:false});
// Candidate 3 ignores geographic proximity locks, but only for shading.
// Even an always-protected callback cannot change the original geometric
// refinement selection, source attributes, or vertex positions.
let skippedCallbackCalls=0;
const conservative=refineRockFaces(source,{selectTriangle:()=>false,surfaceNormals:{pass:2,protectedFace:()=>true}});
const edgeOnly=refineRockFaces(source,{selectTriangle:()=>false,surfaceNormals:{pass:3,protectedFace:()=>{skippedCallbackCalls++;return true;}}});
sameShape(conservative,edgeOnly);assert.equal(skippedCallbackCalls,0);assert.equal(edgeOnly.userData.rockRefinement.refined,0);assert.equal(conservative.userData.rockSurfaceNormals.protectedFaces,72);assert.equal(edgeOnly.userData.rockSurfaceNormals.protectedFaces,0);assert(edgeOnly.userData.rockSurfaceNormals.smoothedCorners>100);assert.notEqual(hash(conservative.attributes.normal.array),hash(edgeOnly.attributes.normal.array));
const pass3Mat=newFactory(...args,{pass:3,bump:.12},normalMatrix);assert(pass3Mat.customProgramCacheKey().includes('surface3'));assert.notEqual(pass3Mat.customProgramCacheKey(),pass2Mat.customProgramCacheKey());
report.push({case:'pass3 proximity-unlocked shading only',positionHash:hash(edgeOnly.attributes.position.array),callbackCalls:skippedCallbackCalls,geometryRefined:edgeOnly.userData.rockRefinement.refined,audit:edgeOnly.userData.rockSurfaceNormals});

const shore3=pair();shore3.setAttribute('shoreBoundaryBottom',new THREE.Float32BufferAttribute([1,1,1,1],1));const shoreOriginal=refineRockFaces(shore3),shoreEdgeOnly=refineRockFaces(shore3,{surfaceNormals:{pass:3}});sameShape(shoreOriginal,shoreEdgeOnly);assert.equal(hash(shoreOriginal.attributes.normal.array),hash(shoreEdgeOnly.attributes.normal.array));assert.equal(shoreEdgeOnly.userData.rockSurfaceNormals.reasonCounts.shoreAttributeFaces,2);
const cliff3=refineRockFaces(cliff,{surfaceNormals:{pass:3}});sameShape(ca,cliff3);assert.equal(cliff3.userData.rockSurfaceNormals.reasonCounts.sharpAngleEdges,1);assert.equal(cliff3.userData.rockSurfaceNormals.reasonCounts.openEdges,4);
// Compare normals from each side at actual source-edge corners, not merely a
// declared hard-edge count. A 90-degree crease must stay 90 degrees.
const creaseNormals=[];for(let i=0;i<cliff3.attributes.position.count;i++)if(vector(cliff3.attributes.position,i).length()<1e-7)creaseNormals.push(vector(cliff3.attributes.normal,i));assert(creaseNormals.some(a=>creaseNormals.some(b=>Math.abs(a.dot(b))<1e-6)));
const seam=pair();seam.addGroup(0,3,0);seam.addGroup(3,3,1);const seam3=refineRockFaces(seam,{surfaceNormals:{pass:3}});assert.equal(seam3.userData.rockSurfaceNormals.reasonCounts.semanticBoundaryEdges,1);
const junction=g([0,0,0,8,0,0,0,0,8,0,8,0,0,0,-8],[0,2,1,0,1,3,0,4,1]);const junction3=refineRockFaces(junction,{surfaceNormals:{pass:3}});assert.equal(junction3.userData.rockSurfaceNormals.reasonCounts.nonManifoldEdges,1);sameShape(refineRockFaces(junction),junction3);
report.push({case:'pass3 shoreline and real hard boundaries',shoreProtected:2,measuredCreaseAngle:90,openEdges:4,semanticBoundaryEdges:1,nonManifoldEdges:1});

const crestPoints=[new THREE.Vector3(0,10,0),new THREE.Vector3(1,10,0)],crestOptions={toCastle:new THREE.Matrix4(),normalMatrix:new THREE.Matrix3(),ridgeGraph:[{a:[-5,0,10],b:[5,0,10]}]},upNormal=new THREE.Vector3(0,1,0),foldNormal=angle=>new THREE.Vector3(Math.sin(angle*Math.PI/180),Math.cos(angle*Math.PI/180),0);
assert(rockCrestFold(crestPoints,upNormal,foldNormal(25),crestOptions));assert(!rockCrestFold(crestPoints,upNormal,foldNormal(10),crestOptions),'gentle crest face should not become hard');assert(!rockCrestFold(crestPoints.map(p=>p.clone().add(new THREE.Vector3(0,0,5))),upNormal,foldNormal(25),crestOptions),'distant fold must not become a crest proxy');
const feature3=refineRockFaces(pair(),{surfaceNormals:{pass:3,featureEdge:()=>true}});assert.equal(feature3.userData.rockSurfaceNormals.reasonCounts.crestFoldEdges,1);sameShape(refineRockFaces(pair()),feature3);
report.push({case:'pass3 narrow measured crest-fold rule',foldDegrees:25,gentle10DegreesUnblocked:true,distantFoldUnblocked:true,crestFoldEdges:1});
// Pass 4: open boundaries do not globally lock the same-side fan.
assert.deepEqual(legacySurfaceOptions('?citadelRockSurfacePass=4'),{pass:4,bump:.12,relief:.65});
const open4=refineRockFaces(pair(),{surfaceNormals:{pass:4}});
sameShape(refineRockFaces(pair()),open4);assert.equal(open4.userData.rockSurfaceNormals.unmatchedEdges,4);
assert(open4.userData.rockSurfaceNormals.smoothedCorners>=4);
assert.equal(hash(open4.attributes.normal.array),hash(refineRockFaces(pair(),{surfaceNormals:{pass:4}}).attributes.normal.array));
report.push({case:'pass4 open-boundary same-side fans',audit:open4.userData.rockSurfaceNormals});

// A radial hard edge has an alternate all-soft route around the central
// vertex. The constrained union must refuse that route, not erase the seam.
const fanPositions=[0,.15,0];for(let i=0;i<6;i++)fanPositions.push(6*Math.cos(i*Math.PI/3),[.4,-.6,.2,.7,-.3,.1][i],6*Math.sin(i*Math.PI/3));
const fanIndices=[];for(let i=0;i<6;i++)fanIndices.push(0,(i+1)%6+1,i+1);
const fan=g(fanPositions,fanIndices),radialHard=points=>points.some(p=>p.distanceTo(new THREE.Vector3(6,.4,0))<1e-5)&&points.some(p=>Math.abs(p.x)+Math.abs(p.z)<1e-6);
const fan4=refineRockFaces(fan,{selectTriangle:()=>false,surfaceNormals:{pass:4,featureEdge:radialHard}});
sameShape(refineRockFaces(fan,{selectTriangle:()=>false}),fan4);
assert.equal(fan4.userData.rockSurfaceNormals.reasonCounts.crestFoldEdges,1);
assert(fan4.userData.rockSurfaceNormals.constraintRejectedSoftJoins>=1,'hard sides reconnected via alternate soft path');
assert(vector(fan4.attributes.normal,0).distanceTo(vector(fan4.attributes.normal,15))>1e-4,'forbidden corner sides merged');
report.push({case:'pass4 cannot-link survives alternate soft path',audit:fan4.userData.rockSurfaceNormals});

// Unequal refinement n=3 versus n=1 shares an affine edge-normal field.
// Test interpolated edge segments, not only coincident emitted vertices.
const varyingEdge=g([0,0,0,8,0,0,0,0,8,8,2,8,-5,1.5,8],[0,2,1,1,2,3,0,4,2]);
const unequal=refineRockFaces(varyingEdge,{selectTriangle,surfaceNormals:{pass:4}});
sameShape(refineRockFaces(varyingEdge,{selectTriangle}),unequal);assert(unequal.userData.rockSurfaceNormals.mixedSubdivisionSoftEdges>=1);assert.equal(unequal.userData.rockSurfaceNormals.subdivisionMismatchEdges,0);
const firstFaceCount=refineRockFaces(g([0,0,0,8,0,0,0,0,8],[0,2,1]),{selectTriangle}).attributes.position.count;
const edgeSamples=(start,end)=>{
 const result=new Map();for(let i=start;i<end;i++){
  const p=vector(unequal.attributes.position,i);
  if(Math.abs(p.y)<1e-6&&Math.abs(p.x+p.z-8)<2e-6)result.set(Math.round(p.x/8*1e6)/1e6,{t:p.x/8,n:vector(unequal.attributes.normal,i)});
 }return [...result.values()].sort((a,b)=>a.t-b.t);
};
const sides=[edgeSamples(0,firstFaceCount),edgeSamples(firstFaceCount,firstFaceCount+3)];assert(sides[0].length>sides[1].length);assert.equal(sides[1].length,2);assert(sides[1][0].n.distanceTo(sides[1][1].n)>.01,'fixture must have nonconstant normal field');
const lerpEdge=(samples,t)=>{for(let i=1;i<samples.length;i++)if(t<=samples[i].t+1e-7)return samples[i-1].n.clone().lerp(samples[i].n,(t-samples[i-1].t)/(samples[i].t-samples[i-1].t));throw Error('missing edge interval');};
let affineError=0,transformedError=0;
for(let i=0;i<=40;i++){
 const t=i/40,a=lerpEdge(sides[0],t),b=lerpEdge(sides[1],t);
 affineError=Math.max(affineError,a.distanceTo(b));
 transformedError=Math.max(transformedError,a.applyMatrix3(normalMatrix).normalize().distanceTo(b.applyMatrix3(normalMatrix).normalize()));
}assert(affineError<2e-7);assert(transformedError<2e-7);
const pass4Mat=newFactory(...args,{pass:4,bump:.12},normalMatrix),pass4Shader=compile(pass4Mat);
assert(pass4Mat.customProgramCacheKey().includes('surface4'));assert(pass4Shader.vertexShader.includes('vNormal = transformedNormal;'));
assert(THREE.ShaderChunk.normal_fragment_begin.includes('normalize( vNormal )'),'fragment must normalize affine varying');
assert(!compile(pass3Mat).vertexShader.includes('vNormal = transformedNormal;'));
report.push({case:'pass4 unequal refinement affine shader transport',edgeSamples:sides.map(s=>s.length),affineError,transformedError,gpuCompileTested:false});

const shore4=refineRockFaces(shore3,{surfaceNormals:{pass:4}});sameShape(shoreOriginal,shore4);assert.equal(hash(shoreOriginal.attributes.normal.array),hash(shore4.attributes.normal.array));
const hard4=refineRockFaces(cliff,{surfaceNormals:{pass:4}});sameShape(ca,hard4);assert.equal(hard4.userData.rockSurfaceNormals.reasonCounts.sharpAngleEdges,1);
const hardNormals=[];for(let i=0;i<hard4.attributes.position.count;i++)if(vector(hard4.attributes.position,i).length()<1e-7)hardNormals.push(vector(hard4.attributes.normal,i).normalize());assert(hardNormals.some(a=>hardNormals.some(b=>Math.abs(a.dot(b))<1e-6)));
const material4=refineRockFaces(seam,{surfaceNormals:{pass:4}}),nonmanifold4=refineRockFaces(junction,{surfaceNormals:{pass:4}});
assert.equal(material4.userData.rockSurfaceNormals.reasonCounts.semanticBoundaryEdges,1);assert.equal(nonmanifold4.userData.rockSurfaceNormals.reasonCounts.nonManifoldEdges,1);assert(nonmanifold4.userData.rockSurfaceNormals.cannotLinkPairs>=6);
sameShape(refineRockFaces(junction),nonmanifold4);
report.push({case:'pass4 preserves shore, 90-degree edge, semantics and nonmanifold constraints',shoreProtected:2,creaseAngle:90,cannotLinkPairs:nonmanifold4.userData.rockSurfaceNormals.cannotLinkPairs});
console.log(JSON.stringify({passed:true,cases:report.length,report},null,2));
