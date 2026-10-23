import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');
const {installSwampWaterMarks}=await import('../../src/world/swampWaterMarks.js');
const {installSwampAirHaze}=await import('../../src/world/swampAirHaze.js');
const {installSwampPaintWater,SWAMP_PAINT_WATER:P}=await import('../../src/world/swampPaintWater.js');
const basic=()=>({uniforms:{},vertexShader:T.ShaderLib.basic.vertexShader,fragmentShader:T.ShaderLib.basic.fragmentShader});
const build=()=>{const scene=createMoebiusSwampPlacement({seed:7711,scale:.5});scene.updateMatrixWorld(true);return scene;};
const hsl=c=>c.getHSL({},T.SRGBColorSpace);

test('turquoise, see-through water keeps the ripple injection and gets pale ripple strokes',()=>{
  const scene=build(),inner=scene.userData.inner,water=inner.getObjectByName('swamp-underground-waterline');
  const marks=installSwampWaterMarks({swamp:scene,enabled:true});const hook=water.material.onBeforeCompile;
  const paint=installSwampPaintWater({swamp:scene,enabled:true});
  assert.equal(water.material.onBeforeCompile,hook,'swampWaterMarks onBeforeCompile untouched');
  assert.equal(water.material.customProgramCacheKey(),'swamp-water-marks-1');
  const sh=basic();water.material.onBeforeCompile(sh);assert.match(sh.fragmentShader,/uEm\[12\]/);assert.equal(sh.uniforms.uEm,marks.uniforms.uEm,'same real boat/whale/feeder emitters');
  assert.equal(water.material.color.getHexString(),P.surface.slice(1));
  assert.ok(water.material.transparent&&water.material.opacity<.5,'under .5: bed visible and swampAirHaze skips it');
  const h=hsl(water.material.color);assert.ok(h.h>.44&&h.h<.53&&h.s>.55&&h.s<.85,'user-requested vivid turquoise retains blue-green hue');
  assert.equal(marks.uniforms.uMark.value.getHexString(),P.ripple.slice(1));
  // Haze installed afterwards must not grey the water surface.
  installSwampAirHaze({swamp:scene,enabled:true});assert.doesNotMatch(water.material.customProgramCacheKey(),/sw-haze/);
  assert.equal(paint.report.water&&paint.report.volume&&paint.report.floor&&paint.report.ripple,true);
  assert.ok(paint.report.surfaceDepth.max-paint.report.surfaceDepth.min>8,'actual shallow/deep basin');
  const colors=water.geometry.attributes.color;assert.ok(colors&&colors.count===water.geometry.attributes.position.count);
  assert.equal(paint.report.surfaceDepth.shaderHookPreserved,true);
  paint.dispose();assert.equal(water.geometry.attributes.color,undefined);assert.equal(water.material.onBeforeCompile,hook);
});

test('water body deepens with inner depth and bed is turquoise',()=>{
  const scene=build(),inner=scene.userData.inner;installSwampPaintWater({swamp:scene,enabled:true});
  const volume=inner.getObjectByName('swamp-water-volume'),pos=volume.geometry.attributes.position,col=volume.geometry.attributes.color;
  const toInner=inner.matrixWorld.clone().invert().multiply(volume.matrixWorld),v=new T.Vector3(),c=new T.Color();let lo=null,hi=null;
  for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(toInner);c.fromBufferAttribute(col,i);
    assert.ok(c.g>c.r&&c.b>c.r,'every volume vertex is blue-green');
    if(!lo||v.y<lo.y)lo={y:v.y,l:c.g+c.b};if(!hi||v.y>hi.y)hi={y:v.y,l:c.g+c.b};}
  assert.ok(hi.y-lo.y>5&&hi.l>lo.l,'deep water darker than the surface layer');
  assert.ok(volume.material.opacity<=.25,'thin enough for roots to read (round 2: .22, lead asked for deeper water)');
  const floor=inner.getObjectByName('swamp-lake-floor');assert.equal(floor.material.color.getHexString(),P.floor.slice(1));
});

test('wall stone stays grey-violet after weathering; authored coral rim colours and ripple hook survive; dispose restores',()=>{
  const scene=build(),inner=scene.userData.inner,wall=inner.getObjectByName('swamp-sinkhole-wall'),rim=inner.getObjectByName('greg-coral-rim-rock-batch');
  const before={key:wall.material.customProgramCacheKey(),rim:rim.geometry.attributes.color};
  const paint=installSwampPaintWater({swamp:scene,enabled:true});
  assert.ok(paint.report.wallMaterials>=2,'sinkhole wall + natural/outer cliff rock');
  assert.equal(installSwampPaintWater({swamp:scene,enabled:true}),paint,'idempotent');
  const sh=basic();wall.material.onBeforeCompile(sh);const f=sh.fragmentShader;
  assert.equal((f.match(/float pwJoint=/g)||[]).length,1);
  assert.ok(f.indexOf('cwCrackPhase')<f.indexOf('pwJoint'),'appended after weathering');
  assert.match(f,/fwidth\(pwYc\)/);assert.match(f,/pwUnder/,'underwater wall tinted by the water');
  assert.equal((f.match(/#include <opaque_fragment>/g)||[]).length,1);
  assert.equal(f.split('{').length,f.split('}').length,'balanced braces');
  assert.notEqual(wall.material.customProgramCacheKey(),before.key);
  const outerRock=inner.getObjectByName('greg-natural-cliff-rock');if(outerRock){const s=basic();outerRock.material.onBeforeCompile(s);assert.doesNotMatch(s.fragmentShader,/pwUnder/);assert.match(s.fragmentShader,/pwJoint/);}
  assert.ok(paint.report.rimTopVertices>100);
  const c=new T.Color(),col=rim.geometry.attributes.color,pos=rim.geometry.attributes.position;rim.geometry.computeBoundingBox();const top=rim.geometry.boundingBox.max.y;let n=0;
  // Round 2 (lead's 8x5 Lab grid: rim was a full orange field): top body is moss green; ochre is a narrow pit-side lip + rare stones.
  const lip=rim.geometry.attributes.swampLipDist;assert.ok(lip,'distance-to-pit-edge attribute');let maxLip=0;
  for(let i=0;i<pos.count;i++)if(pos.getY(i)>top-.08&&Math.abs(rim.geometry.attributes.normal.getY(i))>.7){c.fromBufferAttribute(col,i);const h=hsl(c);
    const original=new T.Color().fromBufferAttribute(before.rim,i);assert.ok(c.distanceTo?c.distanceTo(original)<1e-7:Math.abs(c.r-original.r)+Math.abs(c.g-original.g)+Math.abs(c.b-original.b)<1e-7,'authored top palette preserved');n++;if(lip.getX(i)<50)maxLip=Math.max(maxLip,lip.getX(i));}
  assert.ok(n>100);assert.ok(maxLip>P.rimLipWidth+1,'rim is wider than the ochre lip, so most of the top stays green');
  const rs=basic();rim.material.onBeforeCompile(rs);assert.match(rs.vertexShader,/attribute float swampLipDist/);
  assert.match(rs.fragmentShader,/swEdge=1\.-smoothstep\(swW-swAa,swW\+swAa,swLip\)/);assert.equal(rs.fragmentShader.split('{').length,rs.fragmentShader.split('}').length);
  assert.equal(paint.report.soilPreserved,true,'outer soil factory palette preserved');
  paint.dispose();assert.equal(rim.geometry.attributes.color,before.rim);assert.equal(rim.geometry.attributes.swampLipDist,undefined);assert.equal(wall.material.customProgramCacheKey(),before.key);
});

test('disabled is a no-op',()=>{
  const scene=build(),water=scene.userData.inner.getObjectByName('swamp-underground-waterline'),hex=water.material.color.getHexString();
  const p=installSwampPaintWater({swamp:scene,enabled:false});assert.equal(p.report.enabled,false);assert.equal(water.material.color.getHexString(),hex);p.update(1);
});
