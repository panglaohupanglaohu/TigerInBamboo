import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import * as THREE from '../../vendor/three.module.js';
import {createCornerGraph,cornerMaskAt} from '../../src/world/citadel/cornerGraphAdapter.js';
const assemblyUrl=new URL('../../src/world/citadel/cornerAssembly.js',import.meta.url);
// Node-only import resolution to the repo's exact vendored Three; no copied geometry code.
const source=readFileSync(assemblyUrl,'utf8').replace('from "three"',`from ${JSON.stringify(new URL('../../vendor/three.module.js',import.meta.url).href)}`).replace(/from "(\.\/[^"]+)"/g,(_,p)=>`from ${JSON.stringify(new URL(p,assemblyUrl).href)}`);
const {assembleCornerBody}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const layouts=[{name:'empty',grid:new Map(),cols:2,floors:1},{name:'single',grid:new Map([['0,0,0','W']]),cols:1,floors:1},{name:'three-floors',grid:new Map([['0,0,0','W'],['0,1,0','W'],['0,2,0','W']]),cols:1,floors:3},{name:'stepped',grid:new Map([['0,0,0','W'],['1,0,0','W'],['1,1,0','W'],['1,0,1','W']]),cols:2,floors:2}];
const results=[];
for(const sample of layouts){
 const groups=Array.from({length:sample.floors},()=>new THREE.Group());const stats={};let claims=0,releases=0;const records=[];
 const parts=assembleCornerBody({grid:sample.grid,cols:sample.cols,cs:2,ch:2,materials:{W:new THREE.MeshBasicMaterial()},mesh:(geo,mat,name)=>{const obj=new THREE.Mesh(geo,mat);obj.name=name;return obj;},ownSpanning:()=>{claims++;return true;},ownNone:()=>{releases++;},levelGroups:groups,stats});
 let minY=Infinity,maxY=-Infinity;
 groups.forEach((group,level)=>group.children.forEach(o=>{const positions=Array.from(o.geometry.attributes.position.array);for(let i=1;i<positions.length;i+=3){minY=Math.min(minY,positions[i]);maxY=Math.max(maxY,positions[i]);}records.push(JSON.stringify({level,name:o.name,positions}));o.geometry.dispose();}));
 records.sort();const hash=createHash('sha256').update(records.join('\n')).digest('hex');
 assert.equal(parts,records.length);assert.equal(stats.cornerPartCount,parts);assert.equal(claims,releases);
 const graph=createCornerGraph(sample.grid,{cols:sample.cols,rows:sample.cols,floors:sample.floors});assert.equal(graph.validate().ok,true);
 const expected=new Set();for(const key of sample.grid.keys()){const [x,y,z]=key.split(',').map(Number);for(let dx=0;dx<2;dx++)for(let dz=0;dz<2;dz++)for(let dy=0;dy<2;dy++)expected.add(`c:${x+dx}:${z+dz}:${y-dy}`);}
 const actual=new Set(graph.cells().map(c=>c.id));const missing=[...expected].filter(id=>!actual.has(id));const extra=[...actual].filter(id=>!expected.has(id));
 for(const {index} of graph.cells()){const {gx,gz,iy}=graph.coordOf(index);assert.equal(graph.maskOf(index),cornerMaskAt(sample.grid,gx,gz,iy));}
 results.push({name:sample.name,parts,hash,minY:Number.isFinite(minY)?minY:null,maxY:Number.isFinite(maxY)?maxY:null,graphNodes:graph.cellCount,expectedNodes:expected.size,missing,extra});
}
const dir=fileURLToPath(new URL('../../artifacts/pipeline/townscaper-contract/',import.meta.url));mkdirSync(dir,{recursive:true});
if(process.argv.includes('--write-baseline')){writeFileSync(dir+'corner-boundary-before.json',JSON.stringify(results,null,2));console.log(JSON.stringify({baseline:results},null,2));}
else{
 const before=JSON.parse(readFileSync(dir+'corner-boundary-before.json','utf8'));
 for(const result of results){const prior=before.find(r=>r.name===result.name);assert.equal(result.parts,prior.parts,result.name+' geometry count');assert.equal(result.hash,prior.hash,result.name+' exact unordered mesh positions');assert.equal(result.minY,prior.minY);assert.equal(result.maxY,prior.maxY);assert.deepEqual(result.missing,[]);assert.deepEqual(result.extra,[]);}
 writeFileSync(dir+'corner-boundary-after.json',JSON.stringify({ok:true,results},null,2));console.log(JSON.stringify({ok:true,results},null,2));
}
