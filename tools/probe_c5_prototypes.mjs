// C5 探针（Claude 2026-09-03）：模块原型编译 / 相容率 / S19 场景复现 / 200 seed 可解性。
// 运行：node tools/probe_c5_prototypes.mjs（非零退出 = 原型不合法或有 dead variant）。
// 内含一个最小图适配器（同色建边、edge-top 区分），G-05 的正式适配器应与之等价。
import { TOWN_MODULE_PROTOTYPES as protos, townBanPolicy } from "../TigerMessenger/src/world/citadel/townModulePrototypes.js";
import { validateModulePrototype } from "../TigerMessenger/src/procgen/wfc/moduleSchema.js";
import { compileVariants } from "../TigerMessenger/src/procgen/wfc/socketCompiler.js";
import { compileCompatibilityTable } from "../TigerMessenger/src/procgen/wfc/compatibilityTable.js";
import { solveWfc } from "../TigerMessenger/src/procgen/wfc/solver.js";
for (const p of protos) { const v = validateModulePrototype(p); if (!v.ok) throw new Error(p.id + " " + v.errors); }
const compiled = compileVariants(protos);
const table = compileCompatibilityTable(compiled, { onDeadVariant: "report" });
const n = compiled.variants.length;
let ok=0,tot=0,h=0,ht=0,v=0,vt=0;
for (const dir of ["N","E","S","W","U","D"]) for (let a=0;a<n;a++){ const c=table.compatible[dir][a].popcount(); ok+=c; tot+=n; if ("UD".includes(dir)) {v+=c;vt+=n;} else {h+=c;ht+=n;} }
console.log(`prototypes=${protos.length} variants=${n} deduped=${compiled.stats.deduped} dead=${table.deadVariants.map(d=>d.key).join(",")||"none"}`);
console.log(`compat all=${(100*ok/tot).toFixed(1)}% horiz=${(100*h/ht).toFixed(1)}% vert=${(100*v/vt).toFixed(1)}%`);
const DELTA = { N:[0,0,-1], E:[1,0,0], S:[0,0,1], W:[-1,0,0], U:[0,1,0], D:[0,-1,0] };
function graphOf(grid) {
  const ids=[...grid.keys()].map(k=>k.split(",").map(Number)).sort((a,b)=>a[1]-b[1]||a[2]-b[2]||a[0]-b[0]).map(([x,y,z])=>`${x},${y},${z}`);
  const index=new Map(ids.map((id,i)=>[id,i]));
  const hasAbove=(id)=>{const [x,y,z]=id.split(",").map(Number); return grid.has(`${x},${y+1},${z}`);};
  const adjacency=ids.map(id=>{const [x,y,z]=id.split(",").map(Number); const list=[];
    for (const dir of ["N","E","S","W","U","D"]) { const [dx,dy,dz]=DELTA[dir]; const nid=`${x+dx},${y+dy},${z+dz}`;
      if (!index.has(nid)) continue; if (dy===0 && grid.get(nid)!==grid.get(id)) continue; list.push({to:index.get(nid),direction:dir}); }
    return list;});
  const exposure=ids.map((id)=>{const [x,y,z]=id.split(",").map(Number); const e={};
    for (const dir of ["N","E","S","W","U","D"]) { const [dx,dy,dz]=DELTA[dir]; const nid=`${x+dx},${y+dy},${z+dz}`;
      e[dir]= !grid.has(nid) ? "air" : (dy===0 && grid.get(nid)!==grid.get(id)) ? "foreign" : (dy===0 && !hasAbove(nid)) ? "edge-top" : "edge"; }
    return e;});
  return { cells:()=>ids.map((id,index)=>({id,index})), cellId:i=>ids[i], indexOfId:id=>index.get(id)??-1, neighborsOf:i=>adjacency[i], exposure:i=>exposure[i], get cellCount(){return ids.length;} };
}
function solve(grid, seed=1) {
  const graph=graphOf(grid); const bans=[];
  for (const {id,index} of graph.cells()) { const [cx,iy,cz]=id.split(",").map(Number); let up=0,dn=0; while(grid.has(`${cx},${iy+up+1},${cz}`)) up++; while(grid.has(`${cx},${iy-dn-1},${cz}`)) dn++; const columnHeight=up+dn+1;
    for (const vr of compiled.variants) if (!townBanPolicy({iy, exposure:graph.exposure(index), columnHeight, variant:vr})) bans.push({cell:index, variant:vr.index, reason:"policy"}); }
  const r=solveWfc({graph,compiled,table,seed,bans,maxBacktrack:64});
  return { ok:r.ok, reason:r.reason, cell:r.cell!==undefined&&r.cell>=0?graph.cellId(r.cell):null, by:r.assignmentByCellId, stats:r.stats };
}
const mk=(arr)=>new Map(arr.map(([x,y,z,c="0"])=>[`${x},${y},${z}`,c]));
const show=(name,r)=>console.log(name, r.ok?JSON.stringify(r.by):`FAIL ${r.reason} @${r.cell}`);
show("t0.35 单格落地      ", solve(mk([[0,0,0]])));
show("t0.70 叠一格        ", solve(mk([[0,0,0],[0,1,0]])));
for (const s of [1,2,3]) show(`t1.40 两柱并排 seed${s}  `, solve(mk([[0,0,0],[0,1,0],[1,0,0],[1,1,0]]), s));
show("三格一排顶层        ", solve(mk([[0,0,0],[1,0,0],[2,0,0],[0,1,0],[1,1,0],[2,1,0]])));
for (const s of [1,2,3]) show(`t3.50 异色高柱贴房 s${s} `, solve(mk([[0,0,0],[0,1,0],[1,0,0],[1,1,0],[2,0,0,"3"],[2,1,0,"3"],[2,2,0,"3"]]), s));
show("2x2 顶面            ", solve(mk([[0,0,0],[1,0,0],[0,0,1],[1,0,1],[0,1,0],[1,1,0],[0,1,1],[1,1,1]])));
show("L 形顶面            ", solve(mk([[0,0,0],[1,0,0],[2,0,0],[2,0,1],[2,0,2],[0,1,0],[1,1,0],[2,1,0],[2,1,1],[2,1,2]])));
const ring=[]; for (let x=0;x<3;x++) for (let z=0;z<3;z++) { if (x===1&&z===1) { ring.push([x,0,z]); continue; } ring.push([x,0,z]); ring.push([x,1,z]); }
show("庭院(3x3 环高2, 中心低)", solve(mk(ring)));
let fails=0, bt=[], fam={}; for (let s=1;s<=200;s++){ const cells=[]; let h=s*2654435761>>>0; for (let x=0;x<6;x++) for (let z=0;z<6;z++){ h=(h^(h>>>13))*0x5bd1e995>>>0; const height=h%4; for (let y=0;y<height;y++) cells.push([x,y,z, (x+z)%3===0?"1":"0"]); }
  const r=solve(mk(cells), s); if(!r.ok){fails++; if(fails<=3) console.log("  fail", r.reason, r.cell);} bt.push(r.stats?.backtracks??0); if(r.ok) for (const k of Object.values(r.by)) { const f=k.split(".")[0]+"."+k.split(".")[1].split("@")[0]; fam[f]=(fam[f]||0)+1; } }
bt.sort((a,b)=>a-b); console.log(`random 6x6x3 blobs: fails=${fails}/200 backtracksP50=${bt[100]} P95=${bt[190]}`);

