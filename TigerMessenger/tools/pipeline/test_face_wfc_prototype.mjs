import assert from 'node:assert/strict';
import {createFaceLayerGraph,compileSidePairTable} from './face_wfc_prototype.mjs';
import {compileVariants} from '../../src/procgen/wfc/socketCompiler.js';
import {solveWfc} from '../../src/procgen/wfc/solver.js';
import {cageMapUnit} from '../../src/world/citadel/cageDeform.js';
const positions={a:[0,0],b:[1,0],c:[1,1],d:[0,1],'0q':[2,1],r:[2,0],u:[4,0],v:[5,0],w:[5,1],x:[4,1]};
const faces=[{id:'A',vertices:['a','b','c','d']},{id:'B',vertices:['0q','c','b','r']},{id:'C',vertices:['u','v','w','x']}];
const cells=[{faceId:'A',level:0,char:'red'},{faceId:'B',level:0,char:'red'},{faceId:'C',level:0,char:'red'}];
const graph=createFaceLayerGraph({faces,positions,cells});
const ab=graph.neighborsOf(0)[0];assert.equal(ab.direction,'pair:E:E');assert.equal(graph.neighborsOf(1)[0].direction,'pair:E:E');
assert.equal(graph.neighborsOf(2).length,0); // A nearby/assigned column is not an edge.
assert.equal(graph.exposure(0).E,'edge-top');assert.equal(graph.boundaryOf(0).N,'domain-edge');
const changed=createFaceLayerGraph({faces,positions,cells:[cells[0],{...cells[1],char:'blue'},{faceId:'A',level:1,char:'blue'}]});
assert.equal(changed.exposure(0).E,'foreign');assert.equal(changed.neighborsOf(0).length,1);assert.equal(changed.neighborsOf(0)[0].direction,'pair:U:D');assert.equal(changed.columnHeight(0),2);
const reversed=createFaceLayerGraph({faces:faces.slice().reverse(),positions,cells:cells.slice().reverse()});
assert.deepEqual(reversed.cells(),graph.cells());assert.deepEqual(reversed.neighborsOf(0),graph.neighborsOf(0));
assert.deepEqual(graph.faceOf(1).cageCorners,[[2,1],[1,1],[2,0],[1,0]]);
for(const t of [0,.2,.5,1]){const a=cageMapUnit(1,.5,t,graph.faceOf(0).cageCorners,0,2),b=cageMapUnit(1,.5,1-t,graph.faceOf(1).cageCorners,0,2);assert.ok(a.every((v,i)=>Math.abs(v-b[i])<1e-12));}
assert.throws(()=>createFaceLayerGraph({faces:[{id:'bad',vertices:['a','d','c','b']}],positions,cells:[]}),/winding/);
assert.throws(()=>createFaceLayerGraph({faces:[...faces,{id:'duplicate-edge-owner',vertices:['0q','c','b','r']}],positions,cells}),/non-manifold/);
const face=connector=>({connector,parity:'symmetric',walkable:false});
const compiled=compileVariants([{id:'one-sided-dock',family:'test',builderKey:'test',weight:1,orientationGroup:'Y4',faces:{N:face('seal'),E:face('dock'),S:face('seal'),W:face('seal'),U:face('sky'),D:face('base')}}]);
const table=compileSidePairTable(graph,compiled),vi=compiled.variantIndex.get('one-sided-dock@r0');assert.notEqual(vi,undefined);
assert.equal(table.compatible['pair:E:E'][vi].has(vi),true);
const result=solveWfc({graph,compiled,table,seed:7,pins:[{cell:0,variant:vi},{cell:1,variant:vi}]});assert.equal(result.ok,true,JSON.stringify(result));
const tableWrong=compileSidePairTable(graph,compiled);tableWrong.compatible['pair:E:E']=compiled.variants.map(()=>table.compatible['pair:E:E'][0].clone().clearAll());
const rejected=solveWfc({graph,compiled,table:tableWrong,seed:7,pins:[{cell:0,variant:vi},{cell:1,variant:vi}]});assert.equal(rejected.ok,false);
console.log('FACE_WFC_PROTOTYPE_OK: actual reversed twins, E:E endpoint orientation, no nearest-face adjacency, color boundary, vertical mixed-color stack, stable ordering, cage winding, reject invalid topology, existing solveWfc pass/fail');

// The production migration can be ASCII-lossless yet fail to preserve adjacency.
const {citadelIrregularGrid,migrateAsciiToFaces,facesToAscii}=await import('../../src/world/citadel/gridMigration.js');
const quad=citadelIrregularGrid({gridSize:5,cellSize:2,radius:3});
const levels=[Array(5).fill('00000')],m=migrateAsciiToFaces(levels,quad);
assert.deepEqual(facesToAscii(m.byFace,quad,{floors:1,legacy:m.legacy}),levels);
const edgeSets=new Map(quad.faceIds.map((id,i)=>[id,new Set(quad.raw.faces[i].map((v,j)=>[String(v),String(quad.raw.faces[i][(j+1)%4])].sort().join('|')))]));
let retained=0,broken=0;
for(let z=0;z<5;z++)for(let x=0;x<5;x++)for(const[dx,dz]of[[1,0],[0,1]]){if(x+dx>=5||z+dz>=5)continue;const a=m.mapping.cellToFace.get(`${x},${z}`),b=m.mapping.cellToFace.get(`${x+dx},${z+dz}`);if([...edgeSets.get(a)].some(e=>edgeSets.get(b).has(e)))retained++;else broken++;}
assert.ok(broken>0);
console.log('ASCII_TOPOLOGY_COUNTEREXAMPLE',JSON.stringify({asciiRoundTrip:true,originalEdges:40,retained,broken,gridHash:quad.hash}));
