import assert from 'node:assert/strict';
import * as T from '../../vendor/three.module.js';
import {buildMountainSurfaceIndex} from '../../src/world/citadel/mountainSurfaceIndex.js';
import {plantStudyMountains} from '../../src/world/citadel/mountainPlanting.js';
import {refreshRidgeFlowClouds} from '../../src/world/citadel/ridgeFlowClouds.js';

globalThis.location={search:'?citadelWoodlandPass=2&citadelTurfPass=1'};
const quantize=v=>JSON.parse(JSON.stringify(v,(_,x)=>typeof x==='number'?Math.round(x*1e6)/1e6:x));
function run(fast){
 const castle=new T.Group();castle.position.y=175;castle.rotation.set(.1,.15,-.05);
 const geometry=new T.PlaneGeometry(60,60,16,16);geometry.rotateX(-Math.PI/2);
 const a=geometry.attributes.position;for(let i=0;i<a.count;i++)a.setY(i,Math.sin(a.getX(i)*.07)*2+Math.cos(a.getZ(i)*.1));
 geometry.computeVertexNormals();
 const surface=new T.Mesh(geometry,new T.MeshBasicMaterial({side:T.DoubleSide}));surface.name='citadel-oskar-grid-mountain-surface';castle.add(surface);castle.updateMatrixWorld(true);
 const source=Array.from(a.array),surfaceIndex=fast?buildMountainSurfaceIndex([surface]):null;
 const planted=plantStudyMountains(castle,[surface],{radius:160,surfaceIndex}).userData.planting;
 let field;castle.userData.ridgeFlowClouds={userData:{refresh:f=>field=f}};
 const cloudStats=refreshRidgeFlowClouds(castle,{surfaces:[surface],radius:160,surfaceIndex});
 assert.deepEqual(Array.from(a.array),source);
 const cloudSamples=[];for(let x=-28;x<28;x+=3.5)for(let z=-28;z<28;z+=3.5)cloudSamples.push({height:field.height(x,z),kind:field.kind(x,z),gradient:field.grad(x,z)});
 return {trees:planted.trees,shrubs:planted.shrubs,groundcover:planted.groundcover,cloudStats,cloudSamples};
}
const reference=run(false),indexed=run(true);
const diffs=[];function compare(a,b,path=''){if(typeof a!==typeof b||a===null||b===null){if(a!==b)diffs.push({path,a,b});return;}if(typeof a==='object'){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))compare(a[k],b[k],path+'.'+k);}else if(a!==b)diffs.push({path,a,b});}compare(quantize(indexed),quantize(reference));console.log(JSON.stringify({differences:diffs.length,bySection:Object.fromEntries(Object.keys(reference).map(k=>[k,diffs.filter(d=>d.path.startsWith('.'+k+'.')).length])),first:diffs.slice(0,8)},null,2));assert.equal(diffs.length,0,'Indexed integration mismatch; compact differences above');
console.log(JSON.stringify({pass:true,trees:indexed.trees.length,shrubs:indexed.shrubs.length,cloudSamples:indexed.cloudSamples.length,quantizationMetres:1e-6,scope:'same curved rotated synthetic surface: complete placement rows, groundcover metadata and sampled cloud field match old Raycaster; actual full game remains separate'}));
