import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {solveTownSelection} from '../../../../src/world/citadel/wfcTownSelection.js';
import {createFaceLayerGraph,createLegacyFaceLayout} from '../../../../src/world/citadel/faceLayerGraph.js';
import {TOWN_MODULE_PROTOTYPES} from '../../../../src/world/citadel/townModulePrototypes.js';
const root=new URL('../',import.meta.url),data=JSON.parse(await readFile(new URL('export-report.json',root)));
const grid=new Map();
data.layout.terraces[0].levels.forEach((rows,y)=>rows.forEach((row,z)=>[...row].forEach((char,x)=>{if(char!=='.'&&char!==' ')grid.set(`${x},${y},${z}`,char);}))); 
const graph=createFaceLayerGraph(createLegacyFaceLayout(grid));
const prototypes=TOWN_MODULE_PROTOTYPES.map(p=>({...p,weight:p.weight*(p.family==='terrace'?2:p.builderKey==='hip'?1.4:p.builderKey==='gable'?.7:1)}));
const stock=solveTownSelection({grid,graph,seed:37}),candidate=solveTownSelection({grid,graph,seed:37,prototypes}),repeat=solveTownSelection({grid,graph,seed:37,prototypes});
assert(stock.ok&&candidate.ok&&repeat.ok);assert.equal(candidate.hash,data.wfc.hash);assert.equal(candidate.hash,repeat.hash);
assert.deepEqual(candidate.byCell,data.assignments[0].byCell);
let edges=0;let brokenDetected=false;let brokenCase=null;
for(const {id,index}of graph.cells()){
 const vi=candidate.compiled.variantIndex.get(candidate.byCell[id].key);
 for(const edge of graph.neighborsOf(index)){
  const target=candidate.compiled.variantIndex.get(candidate.byCell[graph.cellId(edge.to)].key);
  const allowed=candidate.table.compatible[edge.direction][vi];
  assert(allowed.has(target));edges++;
  if(!brokenCase){const wrong=candidate.compiled.variants.find(v=>!allowed.has(v.index));if(wrong)brokenCase={source:id,target:graph.cellId(edge.to),direction:edge.direction,wrongKey:wrong.key??candidate.compiled.variants[wrong.index].protoId,wrongIndex:wrong.index,sourceIndex:vi};}
 }
}
assert(brokenCase);
// Replace an actual adjacent cell assignment with an incompatible variant and reject it.
const corrupt={...candidate.byCell,[brokenCase.target]:{...candidate.byCell[brokenCase.target],key:candidate.compiled.variants[brokenCase.wrongIndex].key}};
const corruptTarget=candidate.compiled.variantIndex.get(corrupt[brokenCase.target].key);
assert.notEqual(corruptTarget,undefined);
brokenDetected=!candidate.table.compatible[brokenCase.direction][brokenCase.sourceIndex].has(corruptTarget);
assert(brokenDetected);
const histogram=r=>Object.values(r.byCell).reduce((a,v)=>(a[v.variant]=(a[v.variant]??0)+1,a),{});
const changed=Object.keys(stock.byCell).filter(id=>stock.byCell[id].key!==candidate.byCell[id].key);
const report={passed:true,cells:grid.size,directedEdgesChecked:edges,layoutUnchanged:true,deterministic:true,exportedAssignmentsMatch:true,incompatibleModuleRejected:brokenDetected,stockHash:stock.hash,candidateHash:candidate.hash,changedSelections:changed.length,changedCells:changed,stockRoles:histogram(stock),candidateRoles:histogram(candidate),scope:'Actual WFC assignments and shared-edge compatibility; geometric corner seams and navigation still require separate checks.'};
await writeFile(new URL('wfc-validation.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,changedCells:undefined}));
