import {createRectGrid2D} from '../../procgen/graph/rectGrid2d.js';
import {createSimpleTiledModel, solveSimpleTiled, pin2D, assignmentGrid} from '../../procgen/wfc/simpleTiledModel.js';

// Authored tower volumes; WFC assembles their front wall modules only.
// Solid edge columns and vertically aligned openings are hard constraints.
export function solveCastleFacade({rows, seed, extraPins=[]}) {
 const solid=['stone','stone-alt'], openings=['arch','slit'];
 const ids=[...solid,...openings], adjacency=[];
 for(const a of ids) for(const b of ids) {
  if(solid.includes(a)||solid.includes(b)) adjacency.push({a,direction:'E',b});
  if(solid.includes(a)===solid.includes(b)) adjacency.push({a,direction:'S',b});
 }
 const model=createSimpleTiledModel({graph:createRectGrid2D({width:3,height:rows}),
  tiles:ids.map(id=>({id,weight:id==='arch'?5:1})),adjacency,
  boundary:{E:solid,W:solid}});
 const result=solveSimpleTiled({model,seed,pins:[pin2D(model,1,0,'arch@r0'),...extraPins]});
 if(!result.ok) throw new Error('Castle facade WFC contradiction: '+JSON.stringify(result.failure??result));
 return {grid:assignmentGrid(model,result).map(row=>row.map(key=>key.split('@')[0])),
  solutionHash:result.solutionHash, stats:result.stats};
}
