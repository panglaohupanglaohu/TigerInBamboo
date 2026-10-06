import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three.module.js';
import {installEditableJunction,junctionRegionDefaults,JUNCTION_EDIT_KEY} from '../../src/world/canalJunctionEditable.js';
const records=new Map(),storage={getItem:k=>records.get(k),setItem:(k,v)=>records.set(k,v)};
const city=new THREE.Group();city.position.set(12,340,-24);city.rotation.z=.3;
installEditableJunction(city,{storage});city.updateMatrixWorld(true);const e=city.userData.junctionEditor;
assert.equal(e.root.children.filter(o=>o.userData.junctionRegion).length,11);
const before=e.snapshot(),r=junctionRegionDefaults()[0],cell={regionId:r.id,ix:1,iy:0,iz:1};
let meshCount=0;e.root.traverse(o=>meshCount+=!!o.isMesh);assert(meshCount>100);
const untouched=e.root.getObjectByName('right-front-teal'),foundation=e.root.children.filter(o=>!o.userData.junctionRegion).map(o=>o.uuid);
assert(e.edit(cell,'erase').ok);assert.equal(e.snapshot().regions[0].levels[0][1][1],'.');assert.equal(e.root.getObjectByName('right-front-teal'),untouched);assert.deepEqual(e.root.children.filter(o=>!o.userData.junctionRegion).map(o=>o.uuid),foundation);assert.equal(records.size,0);
assert(e.undo());assert.deepEqual(e.snapshot(),before);assert(e.redo());assert.equal(e.snapshot().regions[0].levels[0][1][1],'.');assert(e.edit(cell,'place','3').ok);assert.equal(records.size,0);
const top={regionId:r.id,ix:1,iy:2,iz:0},pos=e.cellWorld(top),up=new THREE.Vector3(0,1,0).transformDirection(city.matrixWorld);const ray=new THREE.Raycaster(pos.clone().addScaledVector(up,12),up.clone().negate());const picked=e.pick(ray);assert(picked, 'actual nested mesh ray hit resolves cell');assert.equal(picked.regionId,r.id);
e.save();assert(records.has(JUNCTION_EDIT_KEY));const city2=new THREE.Group();installEditableJunction(city2,{storage});assert.deepEqual(city2.userData.junctionEditor.snapshot(),e.snapshot());
assert(!e.edit({...cell,ix:-1},'erase').ok);assert(!e.edit({...cell,iy:24},'place').ok);
console.log(JSON.stringify({ok:true,regions:11,meshCount,picked,checks:['real modules','erase/add','region-only rebuild','foundation identity','undo/redo','no implicit storage writes','separate save schema reload','nested ray identity','bounds']}));
// Deliberate candidate failure keeps the currently displayed region/history intact.
const {buildCitadelTownAssembly}=await import('../../src/world/odysseyCitadel.js');let fail=false;
const transactional=new THREE.Group();installEditableJunction(transactional,{storage:{getItem:()=>null},build:(...args)=>{if(fail)throw Error('deliberate build failure');return buildCitadelTownAssembly(...args);}});
const tx=transactional.userData.junctionEditor,txBefore=tx.snapshot(),txRev=tx.revision,txGroup=tx.root.getObjectByName(r.id);fail=true;
assert.equal(tx.edit(cell,'erase').ok,false);assert.deepEqual(tx.snapshot(),txBefore);assert.equal(tx.revision,txRev);assert.equal(tx.root.getObjectByName(r.id),txGroup);assert.equal(tx.undo(),false);
console.log('PASS failed rebuild preserves displayed assembly, state, revision and undo history');
const {compileVariants}=await import('../../src/procgen/wfc/socketCompiler.js');
const {compileCompatibilityTable}=await import('../../src/procgen/wfc/compatibilityTable.js');
const {TOWN_MODULE_PROTOTYPES}=await import('../../src/world/citadel/townModulePrototypes.js');
const {createCitadelCellGraph}=await import('../../src/world/citadel/wfcGraphAdapter.js');
const compiled=compileVariants(TOWN_MODULE_PROTOTYPES),table=compileCompatibilityTable(compiled);let edges=0,cells=0;
for(const audit of e.audit().regions){assert(audit.enabled&&audit.ok);assert.equal(Object.keys(audit.assignment).length,audit.occupiedCount);assert(audit.hash);
 const levels=e.snapshot().regions.find(r=>r.id===audit.regionId).levels,grid=new Map();levels.forEach((rows,y)=>rows.forEach((row,z)=>[...row].forEach((v,x)=>{if(v!=='.')grid.set(`${x},${y},${z}`,v);})));const graph=createCitadelCellGraph(grid);
 for(const {id,index}of graph.cells()){cells++;const a=compiled.variantIndex.get(audit.assignment[id].key);assert(Number.isInteger(a));for(const edge of graph.neighborsOf(index)){const b=compiled.variantIndex.get(audit.assignment[graph.cellId(edge.to)].key);assert(table.compatible[edge.direction][a].has(b),`${audit.regionId} incompatible edge ${id}`);edges++;}}
}
console.log(JSON.stringify({wfc:true,prototypes:TOWN_MODULE_PROTOTYPES.length,variants:compiled.variants.length,cells,directedCompatibleEdges:edges,geometryConsumers:['roof-slope-versus-flat','enclosed-garden'],notWfcGeometryConsumers:['wall','corner','arch','decoration']}));
