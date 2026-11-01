import * as T from 'three';
import {morrisWaterGeometry} from './morrisPreservedRegions.js';
import {installMorrisTownscaper} from './morrisTownscaper.js?v=gulls-r1';
import {installMorrisCastlePatrol} from './morrisCastlePatrolRoute.js?v=castle-patrol-r1';
// A homothetic shoreline gives exactly 4/5 of the island's projected area.
export function createMorrisLakeTerrain(R,edge){
 const ratio=Math.sqrt(.8),waterY=3,bedY=-16;
 const u=(x,z)=>Math.hypot(x,z)/edge(Math.atan2(z,x));
 const inLake=(x,z)=>u(x,z)<=ratio;
 const onBank=(x,z,margin=0)=>{const a=Math.atan2(z,x),r=Math.hypot(x,z);return r>edge(a)*ratio+margin&&r<edge(a)-margin;};
 const elevation=(x,z)=>{const q=u(x,z);if(q>=1)return null;const y=T.MathUtils.lerp(bedY,3.8,T.MathUtils.smoothstep(q,ratio,ratio+.025));return Math.hypot(x,R+y,z)-R;};
 const height=(x,z,h=elevation(x,z))=>Math.sqrt(Math.max(1,(R+(h??-.75))**2-x*x-z*z))-R;
 const points=[];let length=0;
 for(let i=0;i<=720;i++){const a=i/720*Math.PI*2,r=edge(a)*.951,x=Math.cos(a)*r,z=Math.sin(a)*r;if(i)length+=Math.hypot(x-points[i-1].x,z-points[i-1].z);points.push({x,z,h:elevation(x,z),s:length});}
 const at=s=>{s=T.MathUtils.clamp(s,0,length);let j=1;while(j<points.length-1&&points[j].s<s)j++;const a=points[j-1],b=points[j],d=b.s-a.s,t=(s-a.s)/d;return{x:T.MathUtils.lerp(a.x,b.x,t),z:T.MathUtils.lerp(a.z,b.z,t),h:T.MathUtils.lerp(a.h,b.h,t),s,tx:(b.x-a.x)/d,tz:(b.z-a.z)/d};};
 const nearest=(x,z)=>{let best={distance:Infinity};for(const p of points){const distance=Math.hypot(x-p.x,z-p.z);if(distance<best.distance)best={...p,distance};}return best;};
 const route={points,branch:[],length,patrolLength:length,at,patrolAt:at,nearest,isBridge:()=>false,isPatrolBridge:()=>false,branchAt:()=>at(length/4),branchReport:{length:0},bridge:{...at(0),k:0},shoulder:2,report:{revision:'lakeside-loop',marks:{eastEnd:length/4}}};
 return{elevation,height,inLake,onBank,waterY,lakeRatio:ratio,route,stream:[],bridgeSightline:()=>false};
}
export function installMorrisLake({root,terrain,edge}){
 const geometry=morrisWaterGeometry(edge,terrain.lakeRatio,terrain.preservation,terrain.waterY);
 const water=new T.Mesh(geometry,new T.MeshStandardMaterial({color:0x578e9c,roughness:.32,metalness:.12,side:T.DoubleSide}));water.name='morris-flat-inner-lake-80-percent';water.position.y=terrain.waterY;water.receiveShadow=true;root.add(water);
 // Empty compatibility anchors keep existing camera tours working, without a castle or bridge mesh.
 const castle=new T.Group(),bridge=new T.Group();castle.position.set(0,terrain.waterY,0);bridge.position.set(edge(0)*.951,3.8,0);
 const a=Math.PI/2,r=edge(a)*.955,musicCourt={x:0,z:r,routeS:terrain.route.length/4};
 const townscaper=installMorrisTownscaper({root,terrain,water});
 const supports=[townscaper.mesh];
 const castlePatrol=installMorrisCastlePatrol({root,terrain,edge,town:townscaper.town,scale:3,supports});
 castlePatrol.update();
 return{water,castle,bridge,musicCourt,townscaper,supports,castlePatrol,report:{lakeAreaRatio:.8,waterPlaneY:terrain.waterY,castleRemoved:!townscaper.seededCastle,townscaperCastle:townscaper.seededCastle,castlePatrol:castlePatrol.status(),musicCourt},update(){castlePatrol.update();townscaper.update();}};
}
