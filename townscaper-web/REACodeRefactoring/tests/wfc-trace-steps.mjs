// 865200072685912064 真实候选域过程回看 · 逐步轨迹导出：
// 决策帧记录决定格/选定块，矛盾帧记录被掏空的格与（explain 时）红链；
// wfcTraceSteps 把相邻候选快照差分成 shrunk/restored —— 候选只在矛盾帧之后重新放大（回溯重开）。
import assert from 'node:assert/strict';
import {solveWFC,wfcTraceSteps} from '../src/core/wfc.js';
import {buildSquareGrid} from '../src/core/grid.js';

// 1) 默认解与之前一致；逐步差分字段成立
const grid=buildSquareGrid({radius:2}),tiles=Array.from({length:16},(_,i)=>({id:String(i),edges:Array.from({length:4},(_,e)=>(i>>e)&1)}));
const plain=solveWFC(grid,{tiles,seed:7}),r=solveWFC(grid,{tiles,seed:7,traceLimit:256,explain:true});
assert.deepEqual(r.tiles,plain.tiles);assert.ok(r.trace.length>0);assert.equal(plain.trace,undefined);
const steps=wfcTraceSteps(r);assert.equal(steps.length,r.trace.length);assert.ok(Object.isFrozen(steps));
assert.equal(steps[0].stage,'initial');assert.equal(steps.at(-1).stage,r.reason);
assert.deepEqual(wfcTraceSteps(plain),[]);assert.ok(Object.isFrozen(wfcTraceSteps(plain)));
const init=r.trace[0].domains;
for(let i=0;i<steps.length;i++){
 const s=steps[i],f=r.trace[i];assert.equal(s.index,i);assert.ok(Object.isFrozen(s));
 if(i){assert.ok(s.steps>=steps[i-1].steps);assert.ok(s.decisions>=steps[i-1].decisions);
  // 候选只在矛盾帧之后放大（回溯重开域）；其余帧相对上一帧只能收缩或不变
  if(s.restored.length)assert.equal(r.trace[i-1].stage,'contradiction');}
 for(const[id,dom]of Object.entries(f.domains))assert.ok(dom.every(t=>init[id].includes(t)),'domain escapes the initial propagated domain');
 if(s.decided){assert.deepEqual(f.domains[s.decided.cell],[s.decided.tile]);
  const sh=s.shrunk.find(x=>x.cell===s.decided.cell);assert.ok(sh);assert.equal(sh.left,1);assert.ok(sh.removed.length>=1);}
 if(s.stage==='contradiction'&&s.empty!==undefined)assert.equal(f.domains[s.empty].length,0);
}
// 差分本身：removed/added 与相邻帧实际差一致
for(let i=1;i<steps.length;i++){const p=r.trace[i-1].domains,f=r.trace[i].domains;
 for(const sh of steps[i].shrunk)assert.deepEqual(sh.removed,p[sh.cell].filter(t=>!f[sh.cell].includes(t)));
 for(const re of steps[i].restored)assert.deepEqual(re.added,f[re.cell].filter(t=>!p[re.cell].includes(t)));}

// 2) 可解但首次选择走错：矛盾帧点明掏空格 + 红链终于 decision；下一帧 restored 非空
const bt={cells:buildSquareGrid({radius:1}).cells};
const btTiles=[[3,0,2,3],[3,3,1,0],[0,0,0,3],[3,2,1,0],[3,1,0,0],[0,3,3,2],[1,0,1,0],[3,0,1,1],[1,3,2,2],[0,2,2,2],[2,3,1,2]].map((edges,i)=>({id:'t'+i,edges}));
const back=solveWFC(bt,{tiles:btTiles,seed:1,traceLimit:64,explain:true});
assert.ok(back.ok);assert.equal(back.contradictions,2);assert.equal(back.backtracks,2);
const bsteps=wfcTraceSteps(back),byCell=new Map(bt.cells.map(c=>[c.id,c]));
const contraIdx=bsteps.map((s,i)=>s.stage==='contradiction'?i:-1).filter(i=>i>=0);
assert.deepEqual(contraIdx,[1,2]);
for(const i of contraIdx){const s=bsteps[i];
 assert.equal(typeof s.empty,'number');assert.equal(back.trace[i].domains[s.empty].length,0);
 assert.ok(s.chain.length>=2);assert.equal(s.chain.at(-1).kind,'decision');
 for(let k=0;k+1<s.chain.length;k++)assert.ok(byCell.get(s.chain[k].cell).edgeNeighbors.includes(s.chain[k+1].cell));
 assert.ok(bsteps[i+1].restored.length>0,'backtrack re-opens domains on the frame after a contradiction');}

// 3) 不可解奇环：每次尝试都矛盾，链终于 decision
const ring={cells:[{id:0,n:3,edgeNeighbors:[1,2,-1]},{id:1,n:3,edgeNeighbors:[0,2,-1]},{id:2,n:3,edgeNeighbors:[0,1,-1]}]};
const two=[{id:'a',edges:[0,0,0]},{id:'b',edges:[1,1,1]}];
const unsat=solveWFC(ring,{tiles:two,compatible:(a,b)=>a!==b,traceLimit:64,explain:true});
assert.equal(unsat.ok,false);assert.equal(unsat.reason,'contradiction');
const usteps=wfcTraceSteps(unsat);assert.equal(usteps.at(-1).stage,'contradiction');
for(const s of usteps.filter(x=>x.stage==='contradiction')){assert.equal(typeof s.empty,'number');assert.ok(s.chain);assert.equal(s.chain.at(-1).kind,'decision');}

// 4) 初始传播即矛盾（互斥 pins）：链终于 pin
const g9=buildSquareGrid({radius:1}),nb=g9.cells[0].edgeNeighbors.find(id=>id>=0);
const bad=solveWFC(g9,{tiles,pins:{0:'0',[nb]:'15'},traceLimit:8,explain:true});
assert.equal(bad.ok,false);assert.equal(bad.trace[0].stage,'contradiction');
const bs=wfcTraceSteps(bad)[0];assert.equal(typeof bs.empty,'number');assert.equal(bs.chain.at(-1).kind,'pin');

// 5) 不开 explain：仍有点名，但无红链
const noex=solveWFC(bt,{tiles:btTiles,seed:1,traceLimit:64});
const ne=wfcTraceSteps(noex).find(s=>s.stage==='contradiction');
assert.equal(typeof ne.empty,'number');assert.equal(ne.chain,undefined);
console.log('PASS wfcTraceSteps: decision/contradiction cells named, red chains, shrink-only frames except post-contradiction restore',{frames:r.trace.length+back.trace.length});
