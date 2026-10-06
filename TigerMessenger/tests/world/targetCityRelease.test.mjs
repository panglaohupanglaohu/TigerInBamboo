import test from 'node:test';import assert from 'node:assert/strict';
import {targetCityParams,targetCityRuntimeEnabled,targetCliffTransitEnabled} from '../../src/world/citadel/targetCityRelease.js';
test('bare standalone game enables the approved city without a special link',()=>{assert.equal(targetCityRuntimeEnabled('',true),true);const p=targetCityParams('',{standalone:true});assert.equal(p.get('citadelTargetRemesh'),'1');assert.equal(p.get('citadelTargetAtmosphere'),'1');});
test('rollback and iframe reviews retain their explicit choices',()=>{assert.equal(targetCityParams('?citadelRuntime=0',{standalone:true}).has('citadelTargetRemesh'),false);assert.equal(targetCityParams('',{standalone:false}).has('citadelTargetRemesh'),false);assert.equal(targetCityParams('?citadelCanopy=0',{standalone:true}).get('citadelCanopy'),'0');});
test('cliff transit shares the actual city rollout and cannot run over disabled terrain',()=>{
 assert.equal(targetCliffTransitEnabled('',true),true);
 for(const search of ['?citadelRuntime=0','?citadelCliffTransit=0','?citadelTargetRemesh=0','?citadelTargetArchitecture=0'])assert.equal(targetCliffTransitEnabled(search,true),false);
 assert.equal(targetCliffTransitEnabled('',false),false);
});
