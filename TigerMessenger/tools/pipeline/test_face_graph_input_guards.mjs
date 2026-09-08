import assert from 'node:assert/strict';
import {createFaceLayerGraph,createLegacyFaceLayout} from '../../src/world/citadel/faceLayerGraph.js';
import {solveTownSelection} from '../../src/world/citadel/wfcTownSelection.js';
import {resolveTownSelection} from '../../src/world/citadel/wfcTownWiring.js';
import {resolveIncremental} from '../../src/world/citadel/wfcIncremental.js';

const grid=new Map([['0,0,0','0']]);
const graph=createFaceLayerGraph(createLegacyFaceLayout(grid));
const cache={};
const initial=resolveTownSelection(grid,{graph,cache,seed:11});
assert.equal(resolveTownSelection(grid,{graph,cache,seed:11}).fromCache,true);
const recolored=new Map([['0,0,0','1']]);
assert.throws(()=>resolveTownSelection(recolored,{graph,cache,seed:11}),/graph\/grid cell mismatch/);
assert.throws(()=>solveTownSelection({grid:recolored,graph,seed:11}),/graph\/grid cell mismatch/);
assert.throws(()=>resolveIncremental({grid:recolored,graph,previous:initial.byCell,dirtyKeys:['0,0,0'],seed:11}),/graph\/grid cell mismatch/);
assert.throws(()=>solveTownSelection({grid:new Map(),graph,seed:11}),/occupancy mismatch/);
const elevated=createLegacyFaceLayout(grid);elevated.cells[0].level=2;
assert.throws(()=>resolveIncremental({grid,graph:createFaceLayerGraph(elevated),seed:11}),/graph\/grid level mismatch/);

// Both nodes have the same IDs and color, but the second face has a rotated frame.
// This is valid for a face-native full solve, not the Cartesian incremental region.
const rotated=createFaceLayerGraph({positions:{a:[0,0],b:[1,0],c:[1,1],d:[0,1],e:[2,0],f:[2,1]},faces:[{id:'a',vertices:['a','b','c','d']},{id:'b',vertices:['f','c','b','e']}],cells:[{faceId:'a',level:0,char:'0',legacyId:'0,0,0'},{faceId:'b',level:0,char:'0',legacyId:'1,0,0'}]});
assert.throws(()=>resolveIncremental({grid:new Map([['0,0,0','0'],['1,0,0','0']]),graph:rotated,seed:11}),/legacy-preserving adjacency/);
assert.doesNotThrow(()=>solveTownSelection({graph:rotated,seed:11}));
console.log('FACE_GRAPH_INPUT_GUARDS_OK: stale occupancy rejected before cache, direct/incremental mismatch rejected, level and endpoint orientation guarded, face-native graph-only solve retained');
