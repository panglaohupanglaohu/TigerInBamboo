import assert from 'node:assert/strict';
import {marchFraction} from '../../src/world/citadel/marchSeparation.js';
const v=(x,y=0,z=0)=>({x,y,z}),actor=(x,extra={})=>({position:v(x),visible:true,userData:extra});
const a=actor(0),b=actor(1);
assert(marchFraction(a.position,v(3),a,[a,b])<.14,'swept movement does not tunnel through peer');
assert.equal(marchFraction(a.position,v(-3),a,[a,b]),1,'retreat stays free');
b.userData.downed=true;assert(marchFraction(a.position,v(1),a,[b])<1,'downed friendly blocks');
b.userData.dead=true;assert.equal(marchFraction(a.position,v(1),a,[b]),1,'dead removed from active clearance');
b.userData.dead=false;b.position=v(1,2);assert.equal(marchFraction(a.position,v(3),a,[b]),1,'other storey not blocked');
b.position=v(.3);assert.equal(marchFraction(a.position,v(-1),a,[b]),1,'overlapped spawn can separate');assert.equal(marchFraction(a.position,v(1),a,[b]),0,'overlapped spawn cannot move closer');
const people=[actor(0),actor(-.7),actor(-1.4)];
for(let frame=0;frame<500;frame++){
 for(const s of [...people].reverse()){const step=v(.035),f=marchFraction(s.position,step,s,people);s.position.x+=step.x*f;}
 for(let i=1;i<people.length;i++)assert(people[i-1].position.x-people[i].position.x>=.6-1e-8);
}
assert(people[2].position.x>10,'front and followers continue without queue deadlock');
console.log('PASS: swept queue, retreat, downed/dead, storeys, overlap recovery and 500-frame progression');
