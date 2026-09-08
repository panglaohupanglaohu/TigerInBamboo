import assert from 'node:assert/strict';
import {createFaceLayerGraph,createLegacyFaceLayout} from '../../src/world/citadel/faceLayerGraph.js';
import {createCitadelCellGraph,CITADEL_OPP} from '../../src/world/citadel/wfcGraphAdapter.js';

// Deliberately E:E: explicit ring starts must survive even when names sort differently.
const layout={positions:{a:[0,0],b:[1,0],c:[1,1],d:[0,1],e:[2,0],f:[2,1]},faces:[
 {id:'left',vertices:['a','b','c','d'],twins:[null,{faceId:'right',side:'E'},null,null]},
 {id:'right',vertices:['f','c','b','e'],twins:[null,{faceId:'left',side:'E'},null,null]},
],cells:[{faceId:'left',level:0,char:'0'},{faceId:'right',level:0,char:'0'}]};
const graph=createFaceLayerGraph(layout);
assert.equal(graph.validate().ok,true);
assert.equal(graph.neighborsOf(0)[0].direction,'pair:E:E');
assert.deepEqual(graph.faceOf(1).vertices,['f','c','b','e']);
assert.equal(graph.faceIdOf(1),'right');
assert.equal(graph.indexOfFaceLevel('right',0),1);
assert.equal(graph.indexOfFaceLevel('right',9),-1);
assert.equal(graph.levelOf(0),0);
assert.equal(graph.boundaryOf(0).N,'domain-edge');
assert.deepEqual(graph.sidePairs,[{direction:'pair:E:E',sourceSide:'E',targetSide:'E'}]);
assert.equal(graph.topologyHash,createFaceLayerGraph({...layout,faces:[...layout.faces].reverse(),cells:[...layout.cells].reverse(),positions:Object.fromEntries(Object.entries(layout.positions).reverse())}).topologyHash);
const moved=structuredClone(layout);moved.positions.f=[2.1,1];
assert.notEqual(graph.topologyHash,createFaceLayerGraph(moved).topologyHash);
const framed=structuredClone(layout);framed.faces[0].frame={version:2};
assert.notEqual(graph.topologyHash,createFaceLayerGraph(framed).topologyHash);
const occupancy=structuredClone(layout);occupancy.cells[0].char='1';
assert.notEqual(graph.topologyHash,createFaceLayerGraph(occupancy).topologyHash);
const split=createFaceLayerGraph(occupancy);assert.equal(split.exposure(0).E,'foreign');assert.equal(split.neighborsOf(0).length,0);assert.equal(split.boundaryOf(0).E,'color-boundary');
const wrongTwin=structuredClone(layout);wrongTwin.faces[0].twins[1].side='W';
assert.throws(()=>createFaceLayerGraph(wrongTwin),/explicit twin mismatch/);
const winding=structuredClone(layout);delete winding.faces[1].twins;winding.faces[1].vertices.reverse();
assert.throws(()=>createFaceLayerGraph(winding),/twin winding mismatch/);
const nonmanifold=structuredClone(layout);nonmanifold.faces.push({id:'third',vertices:['f','c','b','e']});
assert.throws(()=>createFaceLayerGraph(nonmanifold),/non-manifold/);
const crossed=structuredClone(layout);crossed.faces[0].vertices=['a','c','b','d'];
assert.throws(()=>createFaceLayerGraph(crossed),/non-convex|degenerate/);

// Production ASCII baseline: exact IDs, order, every original adjacency and policy input.
const grid=new Map();for(let z=-2;z<3;z++)for(let x=-2;x<3;x++)grid.set(`${x},0,${z}`,x<0?'0':'1');
grid.set('0,1,0','2');grid.set('0,2,0','2');grid.set('-2,3,-2','3');
const old=createCitadelCellGraph(grid),baseline=createFaceLayerGraph(createLegacyFaceLayout(grid));
assert.deepEqual(baseline.cells(),old.cells());
let edgeCount=0;
for(let i=0;i<old.cellCount;i++){
 assert.deepEqual(baseline.neighborsOf(i).map(e=>({to:e.to,direction:e.sourceSide})),old.neighborsOf(i));
 for(const edge of baseline.neighborsOf(i)){assert.equal(edge.targetSide,CITADEL_OPP[edge.sourceSide]);edgeCount++;}
 assert.deepEqual(baseline.exposure(i),old.exposure(i));
 assert.equal(baseline.charOf(i),old.charOf(i));assert.equal(baseline.columnHeight(i),old.columnHeight(i));assert.equal(baseline.columnIsolated(i),old.columnIsolated(i));
 assert.equal(baseline.cellId(baseline.indexOfFaceLevel(baseline.faceIdOf(i),baseline.levelOf(i))),old.cellId(i));
}
assert.equal(baseline.boundaryOf(baseline.indexOfId('-2,3,-2')).D,'empty-cell');
const reverseGrid=new Map([...grid].reverse());
assert.equal(baseline.topologyHash,createFaceLayerGraph(createLegacyFaceLayout(reverseGrid)).topologyHash);
let callbackCount=0;
const deform=(x,z)=>{callbackCount++;return [x+.12*Math.sin(z),.03*Math.sin(x),z+.08*Math.sin(x)];};
const deformedLayout=createLegacyFaceLayout(grid,{deformVertex:deform});
assert.equal(callbackCount,Object.keys(deformedLayout.positions).length);
const deformed=createFaceLayerGraph(deformedLayout);
for(let i=0;i<old.cellCount;i++)assert.deepEqual(deformed.neighborsOf(i),baseline.neighborsOf(i));
assert.notEqual(deformed.topologyHash,baseline.topologyHash);
assert.equal(deformed.validate().ok,true);
assert.equal(createFaceLayerGraph(createLegacyFaceLayout(new Map())).cellCount,0);
console.log(JSON.stringify({ok:true,baselineCells:old.cellCount,preservedDirectedEdges:edgeCount,topologyHash:baseline.topologyHash,tests:['explicit E:E ring frame','real reversed twins','declared twin validation','nonmanifold and winding rejection','input order stable','positions/frame/occupancy hash','legacy exact IDs and NESWUD order','all original neighbors and policy fields retained','shared vertex deformation preserves all neighbors','face-layer lookup','vertical gaps']}));
