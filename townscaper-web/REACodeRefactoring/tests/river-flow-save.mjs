// src/navgraph.js (1795831296952041691 faster downstream, 1582293326815862786 simplified nav graph):
// World.riverFlow (carve order = flat-reach downstream) must survive save.js encode → decode,
// old v5 codes without the flow tail still decode, and buildNav reads identical directions after load.
import assert from 'node:assert/strict';
import {World} from '../src/core/world.js';
import {buildMixedGrid,buildQuadGrid} from '../src/core/grid.js';
import {generateTerrain} from '../src/terrain/generate.js';
import {buildNav} from '../src/world/navgraph.js';
import {encodeWorld,decodeWorld} from '../src/world/save.js';
const dirs=(w,nav)=>{const o=[];for(const a of w.cells)if(w.river[a.id])for(const id of a.edgeNeighbors)if(id>a.id&&w.river[id])o.push(nav.riverDirection(a,w.cells[id]));return o;};
let total=0,flatFixed=0;
for(const [name,mk] of [['mixed',()=>buildMixedGrid({radius:9,seed:7})],['quad',()=>buildQuadGrid({radius:9,seed:7})]])for(const seed of [1,3,7,19]){
  const grid=mk(),a=new World(grid);generateTerrain(a,{seed,rivers:3});
  assert.equal(a.riverFlow.version,a.version);
  const code=encodeWorld(a,'terrain');
  // legacy code = same payload with the flow tail stripped (drop riverFlow → encoder emits exact old v5 bytes)
  const saved=a.riverFlow;a.riverFlow=null;const legacy=encodeWorld(a,'terrain');a.riverFlow=saved;
  assert.ok(code.length>legacy.length&&code.startsWith(legacy.slice(0,-1)),'flow is an appended tail');
  const b=new World(grid);assert.equal(decodeWorld(code,b),'terrain');
  assert.deepEqual(b.snapshot(),a.snapshot());
  assert.equal(b.riverFlow.version,b.version);assert.equal(b.riverFlow.restored,true);
  for(let i=0;i<a.cells.length;i++)assert.equal(b.riverFlow.flowTo[i],a.river[i]?a.riverFlow.flowTo[i]:-1);
  const na=buildNav(a),nb=buildNav(b);assert.equal(nb.flowSource,'carve');
  const da=dirs(a,na),db=dirs(b,nb);assert.deepEqual(db,da);total+=da.length;
  // without the tail (old code) flat reaches fall back to mouth distance — the gap this closes.
  const c=new World(grid);decodeWorld(legacy,c);assert.equal(c.riverFlow,undefined);const nc=buildNav(c);assert.equal(nc.flowSource,'mouthDistance');
  flatFixed+=dirs(c,nc).filter((d,i)=>d!==da[i]).length;
  // canonical: re-encode after load is byte-identical (house-project relies on this)
  assert.equal(encodeWorld(b,'terrain'),code);
  for(const p of b.riverFlow.paths)for(let i=0;i+1<p.length;i++)assert.equal(b.riverFlow.flowTo[p[i]],p[i+1]);
  // stale after edit: not re-saved
  b.touch();assert.equal(encodeWorld(b,'terrain'),legacy);
  // atomic: corrupt flow slot leaves live world untouched
  const before=c.snapshot(),v=c.version;assert.throws(()=>decodeWorld(code+'_',c));assert.deepEqual(c.snapshot(),before);assert.equal(c.version,v);
}
assert.ok(total>0&&flatFixed>0);
console.log('PASS riverFlow save tail: 8 terrains roundtrip,',total,'river edges same direction after load,',flatFixed,'edges would differ with legacy code; canonical, stale-dropped, atomic');
