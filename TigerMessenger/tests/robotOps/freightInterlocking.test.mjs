import{test}from'node:test';import assert from'node:assert/strict';import{findFreightJunctions,createFreightInterlocking}from'../../src/gameplay/robotOps/freightInterlocking.js';
const curve={getLength:()=>650,getPointAt:u=>({x:85*Math.sin(u*Math.PI*2),y:0,z:48*Math.sin(u*Math.PI*4)})};
const service=(id,progress,direction)=>({tram:{userData:{variant:id}},curve,trackLen:650,progress,direction,wagons:Array(8)});
test('junction detection finds nonadjacent crossings, not each normal bend',()=>{const zones=findFreightJunctions(curve);assert(zones.length>0&&zones.length<4);assert(zones.some(z=>Math.hypot(z.center.x,z.center.z)<10));});
test('opposed traffic yields at occupied crossing then clears without deadlock',()=>{const a=service('red',.955,1),b=service('blue',.46,1),sys=createFreightInterlocking(curve,[a,b],7);let stopped=new Set(),distanceA=0,distanceB=0;
 for(let i=0;i<1000;i++){const held=sys.update();for(const s of[a,b]){if(held.has(s.tram.userData.variant)){stopped.add(s.tram.userData.variant);continue;}const step=.05*7/650;s.progress=(s.progress+step)%1;if(s===a)distanceA+=step;else distanceB+=step;}}
 assert(stopped.size>0);assert(distanceA>.25&&distanceB>.25,JSON.stringify({distanceA,distanceB,zones:sys.zones}));
});
