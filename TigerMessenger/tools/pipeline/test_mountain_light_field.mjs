import assert from 'node:assert/strict';
import {register} from 'node:module';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const threeUrl=new URL('../../vendor/three.module.js',import.meta.url).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,next){if(s==='three')return {url:${JSON.stringify(threeUrl)},shortCircuit:true};return next(s,c);}`),import.meta.url);
const THREE=await import('three');
const {mountainLightOptions,prepareMountainLightField,updateMountainLightDirection,sampleMountainHeight,sampleMountainOcclusion,bindMountainLightReceiver,disposeMountainLightField,applyMountainLightCandidate}=await import('../../src/world/citadel/mountainLightField.js');
const hash=a=>createHash('sha256').update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const scene=new THREE.Scene(),castle=new THREE.Group();castle.position.set(30,160,-17);castle.rotation.set(.2,.4,-.3);scene.add(castle);
const shared=new THREE.MeshStandardMaterial({color:0x88937c});let oldCompileCount=0,oldRenderCount=0;
shared.onBeforeCompile=s=>{oldCompileCount++;s.uniforms.originalMarker={value:17};};shared.customProgramCacheKey=()=> 'test-original-program';
const ground=new THREE.Mesh(new THREE.PlaneGeometry(40,40),shared);ground.geometry.rotateX(-Math.PI/2);castle.add(ground);
const ridge=new THREE.Mesh(new THREE.BoxGeometry(4,12,24),shared);ridge.position.set(6,6,0);castle.add(ridge);
const city=new THREE.Mesh(new THREE.BoxGeometry(),shared);scene.add(city);
const plants=new THREE.Group();castle.add(plants);const instanced=new THREE.InstancedMesh(new THREE.BoxGeometry(.4,2,.4),shared,2);
instanced.setMatrixAt(0,new THREE.Matrix4().makeTranslation(1,1,0));instanced.setMatrixAt(1,new THREE.Matrix4().makeTranslation(-12,1,0));plants.add(instanced);instanced.onBeforeRender=()=>{oldRenderCount++;};
scene.updateMatrixWorld(true);const sources=[ground,ridge],sourceHashes=sources.map(m=>hash(m.geometry.attributes.position.array)),instanceHash=hash(instanced.instanceMatrix.array);
const options={light:true,occlusion:true,palette:0,resolution:128};
assert.deepEqual(mountainLightOptions('?citadelMountainRelease=0'),{light:false,occlusion:true,palette:0,resolution:128});assert.equal(applyMountainLightCandidate(castle,sources,{plantingRoot:plants,options:mountainLightOptions('?citadelMountainRelease=0')}),null);assert.equal(ground.material,shared);
const field=prepareMountainLightField(castle,sources,options);assert.equal(prepareMountainLightField(castle,sources,options),field,'field should be reused');assert(Math.abs(sampleMountainHeight(field,-8,0))<1e-4);assert(Math.abs(sampleMountainHeight(field,6,0)-12)<1e-4);assert.equal(sampleMountainHeight(field,99,99),-Infinity);
const receiver=new THREE.Vector3(1,0,0),sunward=new THREE.Vector3(1,.18,0).normalize(),away=new THREE.Vector3(-1,.18,0).normalize(),blocked=sampleMountainOcclusion(field,receiver,sunward),clear=sampleMountainOcclusion(field,receiver,away);
assert(blocked.direct<.9&&clear.direct>.99,JSON.stringify({blocked,clear}));const closeAO=sampleMountainOcclusion(field,new THREE.Vector3(3.8,0,0),away).ao;assert(closeAO<.99&&closeAO>=.74);
const audit=applyMountainLightCandidate(castle,sources,{plantingRoot:plants,options});assert.equal(audit.accepted,3);assert.equal(city.material,shared);assert.notEqual(ground.material,shared);assert.notEqual(instanced.material,shared);
const firstMaterial=instanced.material;assert(bindMountainLightReceiver(instanced,castle,options));assert.equal(instanced.material,firstMaterial,'rebind cloned material again');assert.equal(instanceHash,hash(instanced.instanceMatrix.array));sources.forEach((m,i)=>assert.equal(sourceHashes[i],hash(m.geometry.attributes.position.array)));
const compile=material=>{const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader);return shader;};
const shader=compile(instanced.material);assert.equal(oldCompileCount,1);assert.equal(shader.uniforms.originalMarker.value,17);assert(instanced.material.customProgramCacheKey().startsWith('test-original-program|'));assert(shader.vertexShader.includes('mlfPosition=instanceMatrix*mlfPosition'));assert(shader.fragmentShader.includes('reflectedLight.indirectDiffuse*='));assert(shader.fragmentShader.includes('reflectedLight.directDiffuse*='));assert(!shader.fragmentShader.includes('diffuseColor.rgb*=mlf'));
const sun=new THREE.DirectionalLight(0xffffff,2);sun.name='synthetic-scene-sun';sun.castShadow=true;scene.add(sun,sun.target);
const toWorldDirection=d=>d.clone().transformDirection(castle.matrixWorld);sun.position.copy(toWorldDirection(sunward).multiplyScalar(100));sun.target.position.set(0,0,0);scene.updateMatrixWorld(true);
const camera=new THREE.PerspectiveCamera(),renderer={info:{render:{frame:1}}};instanced.onBeforeRender(renderer,scene,camera);assert.equal(oldRenderCount,1);assert(field.sun.distanceTo(sunward)<1e-12);assert(shader.uniforms.mlfSun.value.distanceTo(sunward)<1e-12);assert.equal(shader.uniforms.mlfMap.value,field.texture);
sun.position.copy(toWorldDirection(away).multiplyScalar(100));renderer.info.render.frame++;instanced.onBeforeRender(renderer,scene,camera);assert(field.sun.distanceTo(away)<1e-12);assert.equal(oldRenderCount,2);assert(sampleMountainOcclusion(field,receiver,field.sun).direct>.99);
sun.visible=false;updateMountainLightDirection(field,scene,3);assert.equal(field.sunPower,0);sun.visible=true;
// Rebuild on changed source position, releasing only the superseded texture.
let textureDisposals=0,materialDisposals=0;field.texture.addEventListener('dispose',()=>textureDisposals++);for(const m of [ground,ridge,instanced])m.material.addEventListener('dispose',()=>materialDisposals++);
ground.geometry.attributes.position.setY(0,.2);const rebuilt=prepareMountainLightField(castle,sources,options);assert.notEqual(rebuilt.revision,field.revision);assert.equal(textureDisposals,1);rebuilt.texture.addEventListener('dispose',()=>textureDisposals++);renderer.info.render.frame++;instanced.onBeforeRender(renderer,scene,camera);assert.equal(shader.uniforms.mlfMap.value,rebuilt.texture);assert.equal(instanced.material.userData.mountainLight.sourceRevision,rebuilt.revision);
disposeMountainLightField(castle);assert.equal(textureDisposals,2);assert.equal(materialDisposals,3);assert.equal(ground.material,shared);assert.equal(instanced.material,shared);assert.equal(city.material,shared);assert.equal(castle.userData.mountainLightField,undefined);disposeMountainLightField(castle);assert.equal(textureDisposals,2);
// Independent palette-only mode needs no texture or light traversal, and
// removal must still restore materials and original render callbacks.
applyMountainLightCandidate(castle,sources,{plantingRoot:plants,options:{light:false,palette:1,occlusion:false,resolution:128}});const paletteShader=compile(instanced.material);assert(!paletteShader.uniforms.mlfMap);assert(paletteShader.fragmentShader.includes('mlfLuma'));
const rockPaletteShader=compile(ground.material);assert.notEqual(rockPaletteShader.fragmentShader,paletteShader.fragmentShader,'same source material must exercise distinct palette code');assert.notEqual(ground.material.customProgramCacheKey(),instanced.material.customProgramCacheKey(),'rock and vegetation palette programs must not collide');assert(ground.material.customProgramCacheKey().endsWith('-R1'));assert(instanced.material.customProgramCacheKey().endsWith('-R0'));
instanced.onBeforeRender(renderer,scene,camera);scene.remove(castle);assert.equal(instanced.material,shared);assert.equal(castle.userData.mountainLightField,undefined);
// Rock palette changes newly compiled uniform values, not original albedo or
// a shared city's material; occlusion=0 is an independent uniform control.
scene.add(castle);const originalBase=new THREE.Color('#68838c'),paletteSource=shared.clone();paletteSource.onBeforeCompile=s=>{s.uniforms.mtBase={value:originalBase};s.uniforms.mtShade={value:new THREE.Color()};s.uniforms.mtChalk={value:new THREE.Color()};s.uniforms.mtVerdure={value:new THREE.Color()};};ground.material=paletteSource;
applyMountainLightCandidate(castle,sources,{options:{light:true,palette:1,occlusion:false,resolution:128}});const rockShader=compile(ground.material);assert.equal(rockShader.uniforms.mtBase.value.getHexString(),'929082');assert.equal(originalBase.getHexString(),'68838c');assert.equal(rockShader.uniforms.mlfActive.value,0);assert.equal(city.material,shared);disposeMountainLightField(castle);assert.equal(ground.material,paletteSource);
// Compile the actual mountain rock hook, so the palette-2 moss regression is
// checked against production shader text, not a fabricated mtMoss fixture.
const study=readFileSync(new URL('../../src/world/citadel/mountainStudy.js',import.meta.url),'utf8'),start=study.indexOf('function rockMaterial('),end=study.indexOf('export function applyCitadelMountainStudy(',start);
const rockFactory=new Function('THREE','rockMask',`${study.slice(start,end)}\nreturn rockMaterial;`)(THREE,()=>new THREE.Texture());
const realRock=rockFactory(shared,new THREE.Matrix4(),160,13);ground.material=realRock;const baselineRock=compile(realRock),paletteCases=[];assert(baselineRock.fragmentShader.includes('mtMoss*.60'));
const palettePositionHash=hash(ground.geometry.attributes.position.array);
const paletteSnapshots=new Map();
for(const palette of [1,2,3]){
 const parsed=mountainLightOptions(`?citadelMountainRelease=0&citadelMountainPalette=${palette}`);assert.equal(parsed.palette,palette);assert.equal(parsed.light,false);
 applyMountainLightCandidate(castle,sources,{plantingRoot:plants,options:parsed});const rock=compile(ground.material),grass=compile(instanced.material),key=ground.material.customProgramCacheKey();
 assert(key.includes(`-P${palette}-R1`));assert(!grass.fragmentShader.includes('mtMoss'),'real groundcover must not acquire rock moss control');
 assert(rock.fragmentShader.includes(`mtMoss*${palette>=2?'0.24':'.60'}`));assert.equal(rock.uniforms.mtBase.value.getHexString(),palette===3?'b4b3ae':palette===2?'a7a9aa':'929082');
 if(palette>=2)assert(grass.fragmentShader.includes('vec3(mlfLuma),.12)*vec3(.985,1.01,.985)'));
 assert.equal(palettePositionHash,hash(ground.geometry.attributes.position.array));assert.equal(instanceHash,hash(instanced.instanceMatrix.array));
 paletteSnapshots.set(palette,{rock,grass,key});
 paletteCases.push({palette,key,rockBase:rock.uniforms.mtBase.value.getHexString(),proceduralMossMaximum:palette>=2?.24:.60});disposeMountainLightField(castle);assert.equal(ground.material,realRock);
}
// Palette 3 is strictly an albedo-uniform experiment. Plants and all shader
// operations (including detail, normal transport and moss cap) remain palette 2.
const p2=paletteSnapshots.get(2),p3=paletteSnapshots.get(3);
assert.equal(p3.grass.vertexShader,p2.grass.vertexShader);assert.equal(p3.grass.fragmentShader,p2.grass.fragmentShader);
assert.equal(p3.rock.vertexShader,p2.rock.vertexShader);assert.equal(p3.rock.fragmentShader,p2.rock.fragmentShader);
assert.equal(p3.rock.uniforms.mtVerdure.value.getHexString(),p2.rock.uniforms.mtVerdure.value.getHexString());
assert.deepEqual(['mtBase','mtShade','mtChalk'].map(k=>p3.rock.uniforms[k].value.getHexString()),['b4b3ae','858b90','d3cfc4']);
assert.deepEqual(['mtBase','mtShade','mtChalk','mtVerdure'].map(k=>p2.rock.uniforms[k].value.getHexString()),['a7a9aa','747d83','cec8bb','647363']);
assert.notEqual(p3.key,p2.key);
assert.notEqual(paletteCases[0].key,paletteCases[1].key);assert.equal(compile(realRock).fragmentShader,baselineRock.fragmentShader,'original palette 0 changed');
const {rockSurfaceOptions}=await import('../../src/world/citadel/mountainRockNormals.js');
assert.equal(rockSurfaceOptions('?citadelMountainRelease=0').moss,undefined);assert.equal(rockSurfaceOptions('?citadelRockMoss=').moss,undefined);assert.equal(rockSurfaceOptions('?citadelRockMoss=bad').moss,undefined);
for(const [query,expected] of [['0',0],['.1',.1],['1',1],['2',1],['-1',0]])assert.equal(rockSurfaceOptions(`?citadelRockMoss=${query}`).moss,expected);
assert.equal(baselineRock.uniforms.mtMossGain,undefined,'omitted query must preserve default shader');
assert.equal(realRock.userData.effectiveMossGain,.60);
assert(compile(rockFactory(shared,new THREE.Matrix4(),160,8)).fragmentShader.includes('mtMoss*0.0'));
const mossCases=[];
for(const moss of [0,.1,1])for(const palette of [0,1,2,3]){
 const original=rockFactory(shared,new THREE.Matrix4(),160,13,{pass:0,bump:.38,moss});ground.material=original;
 const before=compile(original);assert.equal(before.uniforms.mtMossGain.value,moss);assert(before.fragmentShader.includes('mtMoss*mtMossGain'));assert(original.customProgramCacheKey().includes('moss-uniform-v1'));
 applyMountainLightCandidate(castle,sources,{plantingRoot:plants,options:{light:false,palette,occlusion:false,resolution:128}});
 const compiled=compile(ground.material),expected=palette>=2?Math.min(.24,moss):moss;
 assert.equal(compiled.uniforms.mtMossGain.value,expected);assert.equal(ground.material.userData.effectiveMossGain,expected);assert.equal(compile(original).uniforms.mtMossGain.value,moss,'clone must not mutate original moss gain');
 if(palette)assert(ground.material.customProgramCacheKey().includes('mountain-field-v2'));
 assert(!compile(instanced.material).uniforms.mtMossGain,'grass must not acquire moss uniform');
 mossCases.push({moss,palette,effectiveMossGain:expected});disposeMountainLightField(castle);assert.equal(ground.material,original);
}
// Detail is a separate material diagnostic, not geometry relief or moss.
for(const [query,expected] of [['0',0],['.35',.35],['1',1],['5',1],['-2',0]])assert.equal(rockSurfaceOptions(`?citadelRockDetail=${query}`).detail,expected);
for(const query of ['', '?citadelRockDetail=', '?citadelRockDetail=bad'])assert.equal(rockSurfaceOptions('?citadelMountainRelease=0&'+query.replace(/^\?/, '')).detail,undefined);
const detailDefault=rockFactory(shared,new THREE.Matrix4(),160,13,{pass:0,bump:.38,detail:1});
assert.equal(compile(detailDefault).fragmentShader,baselineRock.fragmentShader,'explicit detail=1 must retain exact original shader');assert.equal(detailDefault.customProgramCacheKey(),realRock.customProgramCacheKey());
const detailCases=[];
for(const detail of [0,.35]){
 const original=rockFactory(shared,new THREE.Matrix4(),160,13,{pass:4,bump:.12,detail});ground.material=original;
 const raw=compile(original),reference=compile(rockFactory(shared,new THREE.Matrix4(),160,13,{pass:4,bump:.12}));
 assert.equal(raw.uniforms.mtDetailGain.value,detail);assert.equal(raw.vertexShader,reference.vertexShader,'detail must not affect positions or normal transport');
 assert.equal(raw.fragmentShader.replace('uniform float mtDetailGain;','').replace('float mtDetail=1.0*mtDetailGain;','float mtDetail=1.0;'),reference.fragmentShader,'only existing detail multiplier may change');
 assert(raw.fragmentShader.includes('mtRelief=mtDetail*'));assert(original.customProgramCacheKey().includes('detail-uniform-v1'));assert.equal(original.userData.effectiveRockDetailGain,detail);
 for(const palette of [0,2,3]){
  applyMountainLightCandidate(castle,sources,{plantingRoot:plants,options:{light:true,palette,occlusion:true,resolution:128}});
  const rock=compile(ground.material),grass=compile(instanced.material);
  assert.equal(rock.uniforms.mtDetailGain.value,detail);assert(rock.uniforms.mlfMap);assert.equal(ground.material.userData.effectiveRockDetailGain,detail);assert(!grass.uniforms.mtDetailGain);
  assert.equal(compile(original).fragmentShader,raw.fragmentShader);assert(ground.material.customProgramCacheKey().includes('detail-uniform-v1'));
  detailCases.push({detail,palette,defaultGeometryAndNormalShaderUnchanged:true});disposeMountainLightField(castle);assert.equal(ground.material,original);
 }
}
console.log(JSON.stringify({passed:true,field:{revision:field.revision,resolution:field.resolution,validCells:field.audit.validCells},occlusion:{blocked,clear,closeAO},directionUpdated:true,instancesUnchanged:true,originalHooksPreserved:true,repeatedBindingStable:true,textureDisposals,materialDisposals,paletteOnlyReleased:true,paletteCases,mossCases,detailCases,gpuCompileTested:false},null,2));
