import assert from 'node:assert/strict';
import {buildMixedGrid,buildQuadGrid} from '../src/core/grid.js';
import {World} from '../src/core/world.js';
import {enumerateHouseTiles,commitHouseTiles,editHouseTiles,placeHouseTiles} from '../src/build/multicell.js';
import {exportHouseProject,importHouseProject} from '../src/ui/house-project.js';
import {encodeWorld,decodeWorld} from '../src/world/save.js';
// 1579483114178768898 补学：通用模块身份 + 统一撤销栈。
// 实例 id 在回执 placement.instance 上；登记处 world.houseInstances 随 world.snapshot() 走，
// 所以撤销/重做一个条目同时恢复体素和身份；工程JSON重载后 id 不变、能继续整栋编辑。
for(const [kind,make]of [['mixed',()=>buildMixedGrid({radius:6,seed:5})],['quad',()=>buildQuadGrid({radius:4,seed:5})]]){
 const world=new World(make());for(const c of world.cells)world.fill(c,2,{rock:true});
 const kinds=kind==='mixed'?[4,3]:[4,4],options=enumerateHouseTiles(world,{kinds}),p=options[0];
 // ① 放置即登记：回执 placement.instance 铸 id，world.houseInstances 指回同一个冻结回执
 const placed=commitHouseTiles(world,[p],{color:3});assert.ok(placed.ok);
 const e0=placed.receipt.entries[0];assert.equal(e0.placement.instance,'house:1');
 assert.equal(world.houseInstances.get('house:1'),e0);assert.ok(Object.isFrozen(world.houseInstances.get('house:1')));
 // ② 整栋替换（同格改层数）自动继承身份；替换后旧回执失效但 id 不换
 const replaced=editHouseTiles(world,{remove:placed.receipt,placements:[{...p,stories:2}],color:4});assert.ok(replaced.ok);
 const e1=replaced.receipt.entries[0];assert.equal(e1.placement.instance,'house:1');assert.equal(world.houseInstances.get('house:1'),e1);
 // ③ 冲突拒绝：新放置占用仍存活的 id、同事务重复 id、畸形 id；拒绝时 world+登记处都不动
 const second=options.find(t=>!t.cells.some(id=>e1.placement.cells.includes(id)));
 assert.equal(editHouseTiles(world,{placements:[{...second,instance:'house:1'}]}).reason,'instance-conflict');
 assert.equal(editHouseTiles(world,{placements:[{...second,instance:'bad id!'}]}).reason,'instance');
 const third=options.find(t=>!t.cells.some(id=>e1.placement.cells.includes(id)||second.cells.includes(id)));
 assert.equal(editHouseTiles(world,{placements:[{...second,instance:'x:9'},{...third,instance:'x:9'}]}).reason,'instance-conflict');
 assert.equal(world.houseInstances.size,1);
 // ④ 统一撤销栈：一条 snapshot 同时恢复体素与实例身份（移除→恢复→替换前的样子回来）
 const undoBase=world.snapshot();
 assert.ok(editHouseTiles(world,{remove:replaced.receipt}).ok);assert.equal(world.houseInstances.get('house:1'),null); // 移除留洞，id 不复用
 world.restore(undoBase);assert.equal(world.houseInstances.get('house:1'),e1);assert.ok(e1.placement.cells.every(id=>world.isBuilt(world.cells[id],e1.placement.floor+1)));
 // ⑤ 移动：同一条事务移除 + 显式带旧 id 放到新格，身份不丢
 const moved=editHouseTiles(world,{remove:replaced.receipt,placements:[{...second,instance:'house:1',stories:2}]});assert.ok(moved.ok);
 assert.equal(moved.receipt.entries[0].placement.instance,'house:1');assert.equal(world.houseInstances.get('house:1'),moved.receipt.entries[0]);
 // ⑥ 新放置跳过留洞 id 铸新号
 const placed3=commitHouseTiles(world,[third],{color:5});assert.ok(placed3.ok);assert.equal(placed3.receipt.entries[0].placement.instance,'house:2');
 // ⑦ v5 体素存档往返：登记处原样（身份不在分享码里，由工程JSON承载）
 const regBefore=[...world.houseInstances],save=encodeWorld(world,'fusion');assert.equal(decodeWorld(save,world),'fusion');assert.deepEqual([...world.houseInstances],regBefore);
 // ⑧ 工程JSON重载：登记处整体重建（含留洞），继续整栋编辑；体素逐项一致
 world.restore(undoBase);const kept=world.houseInstances.get('house:1');
 const project=exportHouseProject(world,[kept,null],{instanceIds:['house:1','gone:old']}),vox=world.snapshot();
 world.reset();assert.equal(world.houseInstances?.size??0,0);
 const restored=importHouseProject(world,project);for(const k of['solid','rock','color','river'])assert.deepEqual(world[k],vox[k]);
 assert.equal(world.houseInstances.get('house:1'),restored.entries[0]);assert.equal(world.houseInstances.get('gone:old'),null);
 assert.equal(restored.entries[0].placement.instance,'house:1');
 assert.ok(editHouseTiles(world,{remove:{entries:[restored.entries[0]]}}).ok);assert.equal(world.houseInstances.get('house:1'),null);
 // ⑨ 重生成一致性：同样初始 World、同种子 → 同放置、连实例 id 都一致
 const w3=new World(make()),w4=new World(make());for(const c of w3.cells)w3.fill(c,2,{rock:true});for(const c of w4.cells)w4.fill(c,2,{rock:true});
 const a=placeHouseTiles(w3,{seed:9,count:4}),b=placeHouseTiles(w4,{seed:9,count:4});
 assert.deepEqual(a.placements.map(x=>x.instance),b.placements.map(x=>x.instance));assert.deepEqual(a.placements.map(x=>x.cells),b.placements.map(x=>x.cells));
 console.log('PASS instance identity, unified undo, tombstone mint, project reload',kind);
}
