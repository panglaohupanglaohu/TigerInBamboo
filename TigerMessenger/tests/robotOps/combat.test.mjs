import{test}from'node:test';import assert from'node:assert/strict';import{RobotCombat,ROBOT_RULES}from'../../src/gameplay/robotOps/combat.js';
test('fire uses ammo, harms enemies only, disables at zero',()=>{const m=new RobotCombat();const a=m.add({id:'a',kind:'locust',z:0}),b=m.add({id:'b',kind:'sentry',team:'enemy',z:12});m.update(.05);assert.equal(a.magazine,27);assert(b.hp<600);m.update(60);assert(m.units.some(u=>u.hp===0));assert(m.units.every(u=>u.hp>=0));});
test('walls, friends and steam block fire',()=>{const m=new RobotCombat({obstacles:[{x:0,z:5,radius:2}]});const a=m.add({id:'a',kind:'locust'}),b=m.add({id:'b',kind:'sentry',team:'enemy',z:12});assert.equal(m.fire(a,b),false);m.obstacles=[];m.add({id:'f',kind:'ant',z:5});assert.equal(m.fire(a,b),false);m.units.pop();m.smoke=[{x:0,z:5,radius:3,expires:8}];assert.equal(m.fire(a,b),false);m.time=9;assert.equal(m.fire(a,b),true);});
test('skills enforce cooldown and pressure; scanner does not see through walls',()=>{const m=new RobotCombat({obstacles:[{x:0,z:5,radius:2}]});const a=m.add({id:'a',kind:'ant',x:10}),b=m.add({id:'b',kind:'beetle'}),e=m.add({id:'e',kind:'sentry',team:'enemy',z:12});assert(m.skill(a));assert.equal(a.pressure,65);assert.equal(m.skill(a),false);m.skill(b);assert.equal(e.markedUntil,undefined);});
test('movement stays clear of obstacles, low health retreats and save keeps IDs',()=>{const m=new RobotCombat({obstacles:[{x:0,z:6,radius:2}]});const a=m.add({id:'a',kind:'locust'});m.command(['a'],'move',{x:0,z:15});for(let i=0;i<200;i++){m.update(.05);assert(Math.hypot(a.x,a.z-6)>=3.4-.001);}a.hp=100;m.update(.1);assert.equal(a.order.type,'retreat');const n=new RobotCombat();n.restore(m.snapshot());assert.equal(n.get('a').hp,a.hp);assert.equal(n.units.length,1);});
test('reload cannot invent ammunition and cancelled movement does not continue',()=>{const m=new RobotCombat();const a=m.add({id:'a',kind:'beetle'});a.magazine=0;a.reserve=7;m.update(3);assert.equal(a.magazine,7);assert.equal(a.reserve,0);m.command(['a'],'move',{x:20,z:0});m.update(1);m.command(['a'],'cease');const x=a.x;m.update(1);assert.equal(a.x,x);});
test('A* routes around a wall to reach the far side',()=>{const m=new RobotCombat({obstacles:[{x:0,z:6,radius:3}]});const a=m.add({id:'a',kind:'beetle'});m.command(['a'],'move',{x:0,z:15});m.update(20);assert(Math.hypot(a.x,a.z-15)<.5,JSON.stringify({x:a.x,z:a.z,state:a.state}));});

test('group movement assigns separated destinations and can finish without a pile-up',()=>{
 const c=new RobotCombat({bounds:{minX:-40,maxX:40,minZ:-40,maxZ:40}});c.add({id:'a',kind:'locust',x:-8,z:10});c.add({id:'b',kind:'locust',x:0,z:10});c.add({id:'c',kind:'locust',x:8,z:10});
 c.command(['a','b','c'],'move',{x:0,z:-8});c.update(25);assert.ok(c.units.every(u=>u.order.type==='hold'));for(const a of c.units)for(const b of c.units)if(a!==b)assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>2.9);
});
test('overheat requires cooling below the release threshold and repair grants whole rounds',()=>{
 const c=new RobotCombat();const a=c.add({id:'a',kind:'locust'}),b=c.add({id:'b',kind:'sentry',team:'enemy',z:10});a.heat=99;assert.equal(c.fire(a,b),true);assert.equal(a.overheated,true);a.cooldown=0;c.update(.1);assert.equal(c.fire(a,b),false);a.order={type:'cease'};c.update(8);assert.equal(a.overheated,false);
 a.x=c.home.x;a.z=c.home.z;a.hp=800;a.reserve=0;c.command(['a'],'retreat');c.update(.7);assert.ok(Number.isInteger(a.reserve));
});

test('group retreat reaches separate repair bays',()=>{
 const c=new RobotCombat({bounds:{minX:-25,maxX:25,minZ:-16,maxZ:16}});c.home={x:0,z:12};
 for(let i=0;i<3;i++)c.add({id:'r'+i,kind:'beetle',x:-20+i*5,z:-10,hp:500});
 c.command(['r0','r1','r2'],'retreat');assert.equal(new Set(c.units.map(u=>u.order.x+':'+u.order.z)).size,3);c.update(25);assert(c.units.every(u=>u.hp===u.maxHp));assert(c.units.every(u=>u.order.type==='hold'));
});
test('invalid combat restore preserves live state and hold is saveable',()=>{
 const c=new RobotCombat();c.add({id:'a',kind:'locust'});c.command(['a'],'hold');const saved=c.snapshot();const n=new RobotCombat();n.restore(saved);assert.deepEqual(n.snapshot(),saved);
 for(const mutate of [s=>s.units[0].magazine=999,s=>s.units[0].hp=-1,s=>s.units[0].path=[{x:null,z:0}],s=>s.units[0].order={type:'move',x:null,z:1},s=>s.units[0].pathGoal={x:0,z:null},s=>s.units[0].blockedFor=-1]){const bad=structuredClone(saved);mutate(bad);assert.throws(()=>c.restore(bad));assert.deepEqual(c.snapshot(),saved);}
});

test('Beetle can roll and fire sideways while its chassis follows the movement order',()=>{
 const c=new RobotCombat();c.autoRetreat=false;const b=c.add({id:'b',kind:'beetle'}),enemy=c.add({id:'e',kind:'sentry',team:'enemy',x:8,z:14});enemy.order={type:'cease'};c.command(['b'],'move',{x:0,z:25});c.update(1);assert(b.z>3);assert(Math.abs(b.heading)<.01);assert(b.turretYaw>.2);assert(enemy.hp<600);assert.equal(b.state,'move');assert(b.magazine<60);
});
test('broken weapon and damaged sensor are meaningful, and repair restores parts',()=>{
 const c=new RobotCombat();const b=c.add({id:'b',kind:'beetle'}),e=c.add({id:'e',kind:'sentry',team:'enemy',z:10});e.order={type:'cease'};b.damageParts.weapon=.5;b.damageParts.sensor=.3;assert.equal(c.fire(b,e),false);assert.equal(c.skill(b),false);c.update(.1);assert.equal(b.order.type,'retreat');b.x=b.order.x;b.z=b.order.z;b.hp=300;c.update(10);assert.equal(b.hp,b.maxHp);assert.deepEqual(b.damageParts,{legs:0,weapon:0,sensor:0});
});
test('Locust brace holds position and cooldown begins when it folds or moves away',()=>{
 const c=new RobotCombat(),l=c.add({id:'l',kind:'locust'});assert(c.skill(l));assert(l.braced);assert.equal(l.skillCooldown,0);c.command(['l'],'move',{x:10,z:0});assert.equal(l.braced,false);assert.equal(l.skillCooldown,8);assert.equal(c.skill(l),false);c.update(8.1);assert(c.skill(l));
});
test('empty reserves request resupply; direct friendly fire remains blocked',()=>{
 const c=new RobotCombat(),a=c.add({id:'a',kind:'locust'}),friend=c.add({id:'f',kind:'ant',z:10});assert.equal(c.fire(a,friend),false);assert.equal(friend.hp,1400);a.magazine=0;a.reserve=0;c.update(.1);assert.equal(a.order.type,'retreat');
});

test('steam prevents a scanner from discovering a new target; the previous marker stays at its last position',()=>{
 const c=new RobotCombat(),b=c.add({id:'b',kind:'beetle'}),e=c.add({id:'e',kind:'sentry',team:'enemy',z:12});
 c.smoke=[{x:0,z:5,radius:3,expires:30}];assert(c.skill(b));assert.equal(e.markedUntil,undefined);
 c.smoke=[];b.skillCooldown=0;assert(c.skill(b));assert.deepEqual(e.lastMarkedPosition,{x:0,z:12,time:0});
 e.z=16;c.smoke=[{x:0,z:5,radius:3,expires:30}];b.skillCooldown=0;assert(c.skill(b));assert.equal(e.lastMarkedPosition.z,12);assert.equal(c.acquire(b),null);
});

test('events created between frames have distinct cursors even at the same combat time',()=>{
 const c=new RobotCombat(),a=c.add({id:'a',kind:'ant'});c.update(.1);const frameTime=c.time,cursor=c.eventSequence;assert(c.skill(a));assert.equal(c.events.at(-1).time,frameTime);assert(c.events.at(-1).sequence>cursor);
 const first=c.events.at(-1).sequence;for(let i=0;i<300;i++)c.emit('sample',{});assert.equal(c.events.length,256);assert(c.events[0].sequence>first);const last=c.eventSequence;c.restore(c.snapshot());c.emit('after-restore',{});assert(c.events[0].sequence>last);
});

test('repair refills a partially used magazine before releasing a fully stocked unit',()=>{
 const c=new RobotCombat(),u=c.add({id:'u',kind:'locust',x:0,z:30});u.magazine=25;u.reserve=120;c.command([u.id],'retreat');c.update(1);assert.equal(u.state,'repair');assert.equal(u.magazine,28);assert.equal(u.order.type,'retreat');c.update(1);assert.equal(u.magazine,30);assert.equal(u.reserve,120);assert.equal(u.order.type,'hold');
});

test('a teammate parking on an old waypoint triggers a safe route around it',()=>{
 const c=new RobotCombat({bounds:{minX:-25,maxX:25,minZ:-16,maxZ:16}}),u=c.add({id:'moving',kind:'beetle',x:4.91,z:9.05}),parked=c.add({id:'parked',kind:'beetle',x:5.34,z:11.92});parked.order={type:'cease'};c.command([u.id],'move',{x:1.4,z:12});u.path=[{x:5,z:10},{x:3,z:10},{x:1,z:12}];u.pathGoal={x:1.4,z:12};
 for(let i=0;i<200;i++){c.update(.05);assert(Math.hypot(u.x-parked.x,u.z-parked.z)>=2.9-.001);}
 assert(Math.hypot(u.x-1.4,u.z-12)<.4,JSON.stringify({x:u.x,z:u.z,path:u.path}));assert.equal(u.order.type,'hold');
});

for(const kind of ['locust','ant','beetle'])test(kind+' keeps locomotion while tracking and firing at an offset enemy',()=>{
 const c=new RobotCombat();c.autoRetreat=false;const u=c.add({id:'mover',kind}),e=c.add({id:'target',kind:'sentry',team:'enemy',x:5,z:10});e.order={type:'cease'};
 c.command([u.id],'move',{x:0,z:25});c.update(1.2);
 assert(u.z>ROBOT_RULES[kind].speed*.9);assert(Math.abs(u.heading)<.01);assert(u.turretYaw>.1);assert(u.magazine<ROBOT_RULES[kind].magazine);assert(e.hp<600);assert.equal(u.state,'move');
});
