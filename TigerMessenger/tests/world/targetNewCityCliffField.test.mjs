import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {createTargetNewCityCliffField} from '../../src/world/citadel/targetNewCityCliffField.js';
const matrix=new T.Matrix4().fromArray([-.577126509,.124630624,.807088719,0,.635485584,.689249750,.347983987,0,-.512916236,.713724029,-.476985267,0,124.43456408,72.61606956,90.15650672,1]);
test('new construction shelf normal matches radial up, keeps fixed plaza and old city',()=>{
 const field=createTargetNewCityCliffField({castleMatrix:matrix});
 const points=[[72,31],[76,31],[72,35]].map(([x,z])=>new T.Vector3(x,field.shelfHeight(x,z,12),z).applyMatrix4(matrix));
 const normal=points[2].clone().sub(points[0]).cross(points[1].clone().sub(points[0])).normalize();
 assert.ok(normal.dot(new T.Vector3(...field.report.placement.upWorld))>1-1e-7);
 for(const[x,z,h]of[[-55,9,17],[56,78,3],[72,78,3],[51,39,12]])assert.equal(field.shelfHeight(x,z,h),h);
});
test('new shore drops steeply outside preserved plaza, never raises outer rock into tracks',()=>{
 const field=createTargetNewCityCliffField({castleMatrix:matrix}),sea=-40;
 for(const[x,z]of[[56,78],[72,78],[48,65],[88,76]])assert.equal(field.cliffHeight(x,z,3,sea),3);
 let start=null,end=null;
 for(let x=88;x<102;x+=.05){const y=field.cliffHeight(x,76,3,sea);if(y<2.5&&start===null)start=x;if(y<sea-2.5){end=x;break;}}
 assert.ok(start!==null&&end!==null);assert.ok(end-start<1.6,'cliff break remains narrow');
 assert.ok((43/(end-start))>20,'face is a cliff, not a long apron');
 for(let x=34;x<125;x+=2)for(let z=16;z<104;z+=2)assert.ok(field.cliffHeight(x,z,10,sea)<=10);
 for(const[x,z]of[[-55,9],[20,70],[90,0]])assert.equal(field.cliffHeight(x,z,17,sea),17);
});
