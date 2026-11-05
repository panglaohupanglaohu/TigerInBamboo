import assert from 'node:assert/strict';
import {buildLeafAtlas,sphereLeafUV} from '../src/core/leaf-atlas.js';
const a=buildLeafAtlas(),b=buildLeafAtlas();assert.deepEqual(a.data,b.data);let used=0;
for(let y=0;y<128;y++)for(let x=0;x<128;x++){const k=(y*128+x)*4,inside=x>=96&&y>=96;assert.equal(a.data[k+3],inside?255:0);if(inside)used++}
assert.equal(used,1024);for(const d of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[1e-9,1,1e-9]])assert.ok(sphereLeafUV(...d).every(v=>Number.isFinite(v)&&v>=0&&v<=1));assert.throws(()=>sphereLeafUV(0,0,0),RangeError);console.log('PASS deterministic 128² atlas/32² reserved corner, finite spherical UV and poles');
