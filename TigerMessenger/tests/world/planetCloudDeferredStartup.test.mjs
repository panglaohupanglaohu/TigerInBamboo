import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createPlanetV8Runtime,disposePlanetV8Runtime} from '../../src/world/planetV8/runtime.js';
const features={planetTerrainV1:false,curvedWaterV1:false,cloudImpostorV1:true,planetPresentationVersion:'v8',planetSubdivision:0};
test('deferred cloud startup reads final terrain and creates buffers only once',()=>{
 const scene=new T.Scene(),state=createPlanetV8Runtime({scene,features,deferCloudTerrain:true});
 assert.equal(state.compiled,true);assert.equal(state.clouds,null);assert.equal(state.cloudTerrainPending,true);
 const mountain=new T.Mesh(new T.SphereGeometry(170,24,16),new T.MeshBasicMaterial({side:T.DoubleSide}));scene.add(mountain);scene.updateMatrixWorld(true);
 const clouds=state.completeCloudTerrain([mountain]);assert.ok(clouds.renderer);assert.equal(state.cloudTerrainPending,false);assert.equal(state.root.userData.cloudImpostor,clouds);
 assert.equal(state.completeCloudTerrain([mountain]),clouds);assert.ok(clouds.clusters.instances.length>0);
 disposePlanetV8Runtime(state);mountain.geometry.dispose();mountain.material.dispose();
});
test('normal startup remains immediate, disposed pending startup cannot create cloud resources',()=>{
 const a=createPlanetV8Runtime({scene:new T.Scene(),features});assert.ok(a.clouds?.renderer);disposePlanetV8Runtime(a);
 const b=createPlanetV8Runtime({scene:new T.Scene(),features,deferCloudTerrain:true});disposePlanetV8Runtime(b);assert.throws(()=>b.completeCloudTerrain([]),/disposed/);assert.equal(b.clouds,null);
});
