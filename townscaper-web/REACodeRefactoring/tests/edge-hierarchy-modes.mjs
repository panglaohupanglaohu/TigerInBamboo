import assert from 'node:assert/strict';
import {buildQuadGrid,buildMixedGrid} from '../src/core/grid.js';
import {World} from '../src/core/world.js';
import {generateTerrain} from '../src/terrain/generate.js';
import {shapeTerrain,smoothingMetrics} from '../src/terrain/shape.js';
const avg=a=>a.reduce((s,x)=>s+x,0)/a.length,stats={},gain=[];
// 1) 1670725072540106755 的三块面板：no / dumb / hierarchical，在真实生成地形上量
for(const [name,build] of [['quad',buildQuadGrid],['mixed',buildMixedGrid]])for(const seed of[3,7]){
 const g=build({radius:8,seed}),w=new World(g);generateTerrain(w,{seed});const snap=JSON.stringify(w.snapshot());
 const none=shapeTerrain(w,{mode:'none'}),dumb=shapeTerrain(w,{mode:'dumb'}),hier=shapeTerrain(w,{mode:'hierarchical'});
 for(const v of g.verts)for(let s=0;s<none.slices;s++)assert.deepEqual(none.at(v,s),[Math.fround(v.x),Math.fround(v.z)]);
 const M=api=>Array.from({length:api.slices-1},(_,i)=>smoothingMetrics(w,api,i+1));const mn=M(none),md=M(dumb),mh=M(hier);
 const top=ms=>avg(ms.map(m=>m.kink['cliff-top']).filter(x=>x!==null)),drift=ms=>avg(ms.map(m=>m.areaDrift));
 assert(top(mh)<top(mn),'hierarchical straightens cliff-top outlines');gain.push(top(mn)-top(mh));assert(top(mh)<top(md),'dumb smoothing does not straighten them');
 assert(drift(md)>drift(mh),'dumb smoothing eats more of the coast than hierarchical');
 // 同一套分级：三个模式 rank 一致；hierarchical 里钉住点不动
 for(let s=1;s<hier.slices;s++)for(const v of g.verts){assert.equal(hier.rank(v.id,s),none.rank(v.id,s));if(hier.rank(v.id,s)==='pinned'){const p=hier.at(v,s);assert.deepEqual(p,[Math.fround(v.x),Math.fround(v.z)]);}}
 assert.equal(JSON.stringify(w.snapshot()),snap);
 stats[name+seed]={kinkTop:[+top(mn).toFixed(1),+top(md).toFixed(1),+top(mh).toFixed(1)],drift:[0,+drift(md).toFixed(3),+drift(mh).toFixed(3)],regularity:[mn,md,mh].map(ms=>+avg(ms.map(m=>m.regularity)).toFixed(2))};
}
assert(avg(gain)>5,'mean cliff-top kink drop '+avg(gain));
// 2) 蓝色"材质边"：平台上一块锯齿状的材质区，只沿材质边、只被同级或更硬的点拉；崖线位置完全不受影响
for(const build of[buildQuadGrid,buildMixedGrid]){
 const g=build({radius:9,seed:5}),w=new World(g);for(const c of g.cells)if(Math.hypot(c.cx,c.cz)<6.5)w.fill(c,2,{rock:true});
 const region=c=>c.cx+.6*Math.sin(c.cz*2.3)>0.3,pairs=[];
 for(const c of g.cells)for(let i=0;i<c.n;i++){const nid=c.edgeNeighbors[i];if(nid<0||nid<c.id)continue;const o=g.cells[nid];if(w.top(c)===2&&w.top(o)===2&&region(c)!==region(o))pairs.push([c.pts[i].id,c.pts[(i+1)%c.n].id]);}
 assert(pairs.length>8);
 // guardCells:false：切面回退保护会按整片比例回缩，比较时关掉它以隔离材质类本身的作用
 const off=shapeTerrain(w,{guardCells:false}),on=shapeTerrain(w,{materials:pairs,guardCells:false}),dumb=shapeTerrain(w,{mode:'dumb',materials:pairs});
 const guarded=shapeTerrain(w,{materials:pairs});for(const v of g.verts)assert(guarded.at(v,2).every(Number.isFinite));
 let mat=0,moved=0;for(const v of g.verts){const r=on.rank(v.id,2);
  if(r==='cliff-top'||r==='cliff-foot'||r==='pinned')assert.deepEqual(on.at(v,2),off.at(v,2),'material class never moves a cliff/pinned vertex');
  if(r==='material'){mat++;const a=on.at(v,2),b=off.at(v,2);if(Math.hypot(a[0]-b[0],a[1]-b[1])>1e-4)moved++;}}
 assert(mat>5&&moved>mat/2,'material line is smoothed');
 const kOn=smoothingMetrics(w,on,2).kink.material,kOff=smoothingMetrics(w,off,2).kink;
 assert(kOff.material===null,'without the option there is no material class');
 // 原始折线（不加 materials 时这些点是 free、位置不动）的拐角 vs 平滑后
 const raw={...on,at:(v)=>[v.x,v.z]};const kRaw=smoothingMetrics(w,raw,2).kink.material;assert(kOn<kRaw*.8,'material border straightened '+kOn+' vs '+kRaw);
 assert(Number.isFinite(smoothingMetrics(w,dumb,2).regularity));
 stats[build.name+'-material']={pairs:pairs.length,materialVerts:mat,moved,kinkRaw:+kRaw.toFixed(1),kinkSmoothed:+kOn.toFixed(1)};
}
const w=new World(buildQuadGrid({radius:3}));assert.throws(()=>shapeTerrain(w,{mode:'clever'}));assert.throws(()=>shapeTerrain(w,{materials:'paint'}));assert.throws(()=>shapeTerrain(w,{materials:[[0,0]]}));
console.log(stats,'PASS no/dumb/hierarchical panels on generated terrain (outline kink, coast area drift), material-border class below cliffs, smoothing metrics');
