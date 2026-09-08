import {writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {cornerMaskAt,createCornerGraph} from '../../src/world/citadel/cornerGraphAdapter.js';
import {cornerBit,cornerAllowedProtoIds,cornerGeometryParts,cornerFaceBits,CORNER_OPP} from '../../src/world/citadel/cornerPrototypes.js';
import {createIrregularQuadGrid} from '../../src/procgen/graph/irregularQuadGrid.js';
import {citadelIrregularGrid,buildFaceCellMapping} from '../../src/world/citadel/gridMigration.js';
import {cageMapUnit} from '../../src/world/citadel/cageDeform.js';
import {solveTownSelection} from '../../src/world/citadel/wfcTownSelection.js';
import {resolveIncremental} from '../../src/world/citadel/wfcIncremental.js';
const checks=[];const check=(name,pass,detail)=>checks.push({name,pass,detail});
let maskFailures=[],emptyGeometry=[];
for(let mask=0;mask<256;mask++){
 const grid=new Map();for(let dy=0;dy<2;dy++)for(let dz=0;dz<2;dz++)for(let dx=0;dx<2;dx++)if(mask&(1<<cornerBit(dx,dz,dy)))grid.set(`${dx},${dy},${dz}`,'W');
 if(cornerMaskAt(grid,1,1,0)!==mask)maskFailures.push(mask);
 const ids=cornerAllowedProtoIds(mask);if(!ids.length|| (mask&&ids.every(id=>!cornerGeometryParts(mask,id).length)))emptyGeometry.push(mask);
}
check('256 occupancy masks reproduce exact independent input bits',!maskFailures.length,{maskFailures});
check('256 masks have allowed prototypes and nonempty solid geometry',!emptyGeometry.length,{emptyGeometry});
const grid=new Map();for(let y=0;y<3;y++)for(let z=0;z<5;z++)for(let x=0;x<5;x++)if((x*13+y*7+z*11)%5!==0)grid.set(`${x},${y},${z}`,'W');
const cg=createCornerGraph(grid);let shared=0,bad=0;for(const {index:i} of cg.cells())for(const e of cg.neighborsOf(i)){shared++;if(cornerFaceBits(cg.maskOf(i),e.direction)!==cornerFaceBits(cg.maskOf(e.to),CORNER_OPP[e.direction]))bad++;}
check('Adjacent corner nodes agree on four shared occupancy bits',bad===0,{shared,bad,reverse:cg.validate()});
const single=createCornerGraph(new Map([['0,0,0','W']]));check('Corner graph itself includes all eight nodes around a ground voxel',single.cellCount===8,{actual:single.cellCount,expected:8,note:'Ground boundary must be present in graph itself; assembly consumes that same graph'});
let badFaces=0,nonManifold=0,deterministic=true;let faceCount=0;
for(let seed=1;seed<=10;seed++){
 const q=createIrregularQuadGrid({seed,radius:4});const q2=createIrregularQuadGrid({seed,radius:4});deterministic&&=q.hash===q2.hash;const edges=new Map();faceCount+=q.faces.length;
 for(const f of q.faces){let signs=[];for(let i=0;i<4;i++){const a=q.positions[f[i]],b=q.positions[f[(i+1)%4]],c=q.positions[f[(i+2)%4]];signs.push((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]));const key=[f[i],f[(i+1)%4]].sort().join('|');edges.set(key,(edges.get(key)||0)+1);}if(f.length!==4||signs.some(v=>v<=1e-10))badFaces++;}nonManifold+=[...edges.values()].filter(n=>n>2).length;
}
check('Finite irregular quad samples are deterministic convex and manifold',deterministic&&!badFaces&&!nonManifold,{seeds:10,faceCount,badFaces,nonManifold,deterministic});
const q=citadelIrregularGrid({gridSize:9,cellSize:2,radius:5});const mapping=buildFaceCellMapping(q);let checkedEdges=0,nonAdjacent=0;const faceById=new Map(q.raw.faces.map(f=>[f.id,f]));const examples=[];
for(let z=0;z<9;z++)for(let x=0;x<9;x++)for(const [dx,dz] of [[1,0],[0,1]]){if(x+dx>=9||z+dz>=9)continue;const a=mapping.cellToFace.get(`${x},${z}`),b=mapping.cellToFace.get(`${x+dx},${z+dz}`);if(!a||!b)continue;checkedEdges++;const common=faceById.get(a).filter(v=>faceById.get(b).includes(v));if(common.length!==2){nonAdjacent++;if(examples.length<4)examples.push({cells:[`${x},${z}`,`${x+dx},${z+dz}`],faces:[a,b],sharedVertices:common.length});}}
check('ASCII-neighbor mapping preserves actual irregular face adjacency',nonAdjacent===0,{checkedEdges,nonAdjacent,examples});
let cageError=0;const left=[[0,0],[2,.2],[-.1,2],[2.2,2.1]],right=[[2,.2],[4,-.2],[2.2,2.1],[4.3,2.4]];
for(let i=0;i<=20;i++){const v=i/20,a=cageMapUnit(1,.3,v,left,0,2),b=cageMapUnit(0,.3,v,right,0,2);cageError=Math.max(cageError,...a.map((x,j)=>Math.abs(x-b[j])));}
check('Bilinear cages preserve a genuinely shared boundary',cageError<1e-12,{cageError,note:'Does not establish that production cages use actual topological neighbors'});
const prototypes=['A','B'].map(id=>({id,family:id,orientationGroup:'NONE',weight:1,builderKey:id,faces:Object.fromEntries(['N','E','S','W','U','D'].map(d=>[d,{connector:id,parity:'symmetric'}]))}));
const chain=new Map(Array.from({length:12},(_,x)=>[`${x},0,0`,'W']));
const policy=letter=>({cellId,variant})=>cellId!=='0,0,0'||variant.protoId===letter;
const before=solveTownSelection({grid:chain,prototypes,seed:7,banPolicy:policy('A')});const full=solveTownSelection({grid:chain,prototypes,seed:7,banPolicy:policy('B')});const incremental=resolveIncremental({grid:chain,prototypes,seed:7,previous:before.byCell,dirtyKeys:['0,0,0'],ring:2,banPolicy:policy('B')});
check('Local edit can propagate a forced legal change across a 12-cell component',before.ok&&full.ok&&incremental.ok,{before:before.ok,fullAfter:full.ok,incremental:incremental.ok,ringUsed:incremental.ringUsed,failure:incremental.failure?.reason??incremental.failure?.type??incremental.failure?.conflict??null});
const separated=new Map([...chain,['0,0,2','W'],['1,0,2','W'],['50,0,0','W']]);
const prev=solveTownSelection({grid:separated,prototypes,seed:7,banPolicy:({variant})=>variant.protoId==='A'});
const prevSnapshot=JSON.stringify(prev.byCell);
const changed=resolveIncremental({grid:separated,prototypes,seed:99,previous:prev.byCell,dirtyKeys:['0,0,0'],ring:2,banPolicy:policy('B')});
const unrelated=['0,0,2','1,0,2','50,0,0'];
check('Incremental regression: unrelated near and far disconnected components stay pinned',changed.ok&&unrelated.every(k=>changed.byCell[k]?.key===prev.byCell[k]?.key&&!changed.region.includes(k))&&prevSnapshot===JSON.stringify(prev.byCell),{ok:changed.ok,scope:changed.scope,unrelatedPreserved:unrelated.map(k=>({cell:k,before:prev.byCell[k]?.key,after:changed.byCell[k]?.key,inRegion:changed.region.includes(k)})),previousNotMutated:prevSnapshot===JSON.stringify(prev.byCell)});
const deleted=new Map(separated);deleted.delete('5,0,0');
const deletion=resolveIncremental({grid:deleted,prototypes,seed:7,previous:prev.byCell,dirtyKeys:['5,0,0'],ring:1,banPolicy:({cellId,variant})=>!['4,0,0','6,0,0'].includes(cellId)||variant.protoId==='B'});
check('Incremental regression: deletion updates both surviving components',deletion.ok&&['0,0,0','11,0,0'].every(k=>deletion.byCell[k]?.family==='B')&&unrelated.every(k=>deletion.byCell[k]?.key===prev.byCell[k]?.key),{ok:deletion.ok,scope:deletion.scope,region:deletion.region});
const impossible=resolveIncremental({grid:chain,prototypes,seed:7,previous:before.byCell,dirtyKeys:['0,0,0'],banPolicy:({cellId,variant})=>cellId==='0,0,0'?variant.protoId==='B':cellId==='11,0,0'?variant.protoId==='A':true});
check('Incremental regression: truly contradictory component remains a reported failure',!impossible.ok,{ok:impossible.ok,scope:impossible.scope,unresolved:impossible.unresolved});
const disconnected=new Map([['0,0,0','W'],['10,0,0','W']]);const dis=solveTownSelection({grid:disconnected,prototypes,seed:7,banPolicy:()=>true});check('Solver success must certify a globally connected battle route',!dis.ok,{solverOk:dis.ok,components:2,note:'Intentional counterexample: local socket constraints do not encode global route reachability; separate gameplay validator required'});
const selectedChecks=process.argv.includes('--incremental')?checks.filter(c=>c.name.startsWith('Incremental regression:')||c.name.startsWith('Local edit')):checks;
const result={description:'Read-only mechanism contracts; failed checks identify gaps, not expected-good regressions',checks:selectedChecks,passed:selectedChecks.filter(c=>c.pass).length,failed:selectedChecks.filter(c=>!c.pass).length};const out=fileURLToPath(new URL('../../artifacts/pipeline/townscaper-contract/',import.meta.url));mkdirSync(out,{recursive:true});writeFileSync(out+(process.argv.includes('--incremental')?'incremental-report.json':'report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));process.exitCode=result.failed?1:0;
