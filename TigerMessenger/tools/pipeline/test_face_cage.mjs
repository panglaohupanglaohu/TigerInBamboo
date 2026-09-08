import assert from 'node:assert/strict';
import {createFaceLayerGraph,createLegacyFaceLayout} from '../../src/world/citadel/faceLayerGraph.js';
import {faceCageCorners,faceCageFromGraph,validateFaceCages,squareCellCorners,cageMapUnit,cellCageCorners} from '../../src/world/citadel/cageDeform.js';
const layout={positions:{a:[0,0],b:[1,0],c:[1.2,1],d:[0,1],e:[2,0],f:[2.2,1]},faces:[{id:'left',vertices:['a','b','c','d']},{id:'right',vertices:['f','c','b','e']}],cells:[{faceId:'left',level:0,char:'0'},{faceId:'right',level:0,char:'1'}]};
const graph=createFaceLayerGraph(layout);
assert.equal(graph.neighborsOf(0).length,0); // Foreign boundary still needs a watertight seam.
const validation=validateFaceCages(graph);
assert.deepEqual(validation,{ok:true,errors:[],faceCount:2,sharedEdges:1,sampleCount:5});
const a=faceCageCorners(graph,0),b=faceCageCorners(graph,1);
assert.deepEqual(b,[[2.2,1],[1.2,1],[2,0],[1,0]]); // Authored frame, not nearest sorted frame.
for(const t of [0,.125,.5,.875,1])for(const y of [0,.5,1]){
 const p=cageMapUnit(1,y,t,a,-1,2),q=cageMapUnit(1,y,1-t,b,-1,2);
 assert.ok(p.every((v,i)=>Math.abs(v-q[i])<1e-12));
}
const grid=new Map([['12,0,12','0'],['13,0,12','0']]);
const baseline=createFaceLayerGraph(createLegacyFaceLayout(grid));
const cage=faceCageFromGraph(baseline,baseline.indexOfId('12,0,12'),{scale:2,offset:[-24,-24]});
assert.deepEqual(cage.corners,squareCellCorners(12,12,2,25));assert.equal(cage.cx,0);assert.equal(cage.cz,0);
assert.deepEqual(cellCageCorners(12,12),squareCellCorners(12,12,2,25));
const tilted=structuredClone(layout);tilted.positions.c=[1.2,.1,1];
assert.throws(()=>faceCageCorners(createFaceLayerGraph(tilted),0),/height-aware/);
const planar=structuredClone(layout);for(const k of Object.keys(planar.positions)){const [x,z]=planar.positions[k];planar.positions[k]=[x,0,z];}
assert.deepEqual(faceCageCorners(createFaceLayerGraph(planar),0),a);
assert.throws(()=>faceCageCorners(graph,0,{scale:0}),/coordinate transform/);
const collapsed=createFaceLayerGraph(layout);collapsed.faceOf(0).cageCorners[1]=collapsed.faceOf(0).cageCorners[0];
assert.throws(()=>faceCageCorners(collapsed,0),/degenerate/);
const reversed=createFaceLayerGraph({positions:layout.positions,faces:[{id:'reversed',vertices:['d','c','b','a']}],cells:[{faceId:'reversed',level:0,char:'0'}]});
assert.throws(()=>faceCageCorners(reversed,0),/reversed mapping/);
const broken=createFaceLayerGraph(layout);broken.faceOf(1).cageCorners[1][0]+=.1;
assert.equal(validateFaceCages(broken).ok,false);
const emptyNeighbor=createFaceLayerGraph({...layout,cells:[layout.cells[0]]});
assert.equal(validateFaceCages(emptyNeighbor).sharedEdges,1);
console.log('FACE_CAGE_OK '+JSON.stringify({validation,legacySquareIdentical:true,authoredFramePreserved:true,sharedVerticalSamples:15,foreignAndEmptyEdgesChecked:true,nonzero3DHeightRejected:true,degenerateAndReversedRejected:true}));
