import * as T from 'three';
import {createMoonLakeGarden} from '../../../src/world/moonLakeGarden.js';
import assert from 'node:assert/strict';
const parent=new T.Group(),garden=createMoonLakeGarden(parent),ray=new T.Raycaster(),hits=[],up=new T.Vector3(0,-1,0);
parent.updateMatrixWorld(true);
for(let i=0;i<180;i++)for(const radius of [3.45,3.8,4.25,4.7,5.05]){
 const a=i*Math.PI/90,x=Math.cos(a)*radius,z=Math.sin(a)*radius;
 const ground=Math.sqrt(160.6**2-x*x-z*z)-160.78;
 ray.set(new T.Vector3(x,ground+2.4,z),up);ray.far=2.2;
 const hit=ray.intersectObjects(garden.trees,true)[0];if(hit)hits.push({angle:i*2,radius,height:hit.point.y-ground,object:hit.object.name});
}
const result={scope:'CPU rays against actual new tree triangles only; ring expanded by player radius .35, body height .2-2.4m; not player traversal or original forest test',rayCount:900,hits,rootGaps:garden.report.sites.map(s=>s.pathGap)};
console.log(JSON.stringify(result));garden.dispose();assert.equal(hits.length,0,'new tree branches obstruct ring player volume');
