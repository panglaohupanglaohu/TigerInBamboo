// Scoped two-storey experiment: existing cells only, no occupancy generation.
import {TOWN_MODULE_PROTOTYPES,townBanPolicy} from './townModulePrototypes.js';
import {solveTownSelection} from './wfcTownSelection.js';
import {face,SOCKET} from './socketVocabulary.js';
export const PASSAGE_PAIR_VERSION='junction-pair-v1';
export const PASSAGE_PAIR_CELLS=Object.freeze([0,1,2].flatMap(x=>[`${x},0,1`,`${x},1,1`]));
const pairSet=new Set(PASSAGE_PAIR_CELLS);
const prototypes=[];
for(const axis of ['x','z'])for(const half of ['lower','upper']){
 const sides={};for(const d of ['N','E','S','W'])sides[d]=face((axis==='x'?['E','W']:['N','S']).includes(d)?`passage2.${half}`:SOCKET.WALL);
 sides.U=face(half==='lower'?`archpair.${axis}`:SOCKET.STACK);sides.D=face(half==='upper'?`archpair.${axis}`:SOCKET.STACK);
 prototypes.push(Object.freeze({id:`body.passage2.${half}.${axis}`,family:'body',builderKey:`passage2.${half}.${axis}`,orientationGroup:'NONE',weight:1,faces:sides,tags:['body','passage2'],rules:{}}));
}
export const PASSAGE_PAIR_PROTOTYPES=Object.freeze([...TOWN_MODULE_PROTOTYPES,...prototypes]);
export function solveTownPassagePairs(grid,{seed=1,pins=[]}={}){
 const baseline=solveTownSelection({grid,seed});if(!baseline.ok)return baseline;
 const complete=PASSAGE_PAIR_CELLS.every(k=>grid.has(k))&&[0,1,2].every(x=>grid.has(`${x},2,1`));
 // Missing an upper half retires the entire chain. An unsupported upper cell
 // after lower deletion is rejected by the editable transaction before build.
 if(!complete)return {...baseline,pairCandidate:{version:PASSAGE_PAIR_VERSION,active:false,reason:'incomplete supported six-cell chain'}};
 const fixed=Object.entries(baseline.byCell).filter(([k])=>!pairSet.has(k)).map(([cell,v])=>({cell,variant:v.key}));
 const banPolicy=c=>{
  const isPair=c.variant.tags.includes('passage2');if(!pairSet.has(c.cellId))return !isPair&&townBanPolicy(c);
  if(!isPair)return false;
  return c.variant.builderKey.startsWith(`passage2.${c.iy===0?'lower':'upper'}.`);
 };
 const out=solveTownSelection({grid,seed,prototypes:PASSAGE_PAIR_PROTOTYPES,banPolicy,pins:[...fixed,...pins]});
 return {...out,pairCandidate:{version:PASSAGE_PAIR_VERSION,active:out.ok,fixedOutsideCells:fixed.length,cells:[...PASSAGE_PAIR_CELLS]}};
}
