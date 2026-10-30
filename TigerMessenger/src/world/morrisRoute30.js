import * as T from 'three';
const V=p=>new T.Vector3(p[0],0,p[1]);
export function createMorrisMountainRoute({stream,naturalElevation,plateauProtected=()=>false,expansion=1}){
 const points=[],marks={};
 function append(out,curve){const n=Math.max(20,Math.ceil(curve.getLength()/.25));for(let j=out.length?1:0;j<=n;j++){const p=curve.getPoint(j/n);out.push({x:p.x,z:p.z});}}
 const cubic=(out,a,b,c,d)=>append(out,new T.CubicBezierCurve3(V(a),V(b),V(c),V(d))),line=(out,a,b)=>append(out,new T.LineCurve3(V(a),V(b)));
 const k=stream.reduce((best,p,j)=>Math.hypot(p.x-24,p.z-34)<Math.hypot(stream[best].x-24,stream[best].z-34)?j:best,0),p=stream[k],a=stream[Math.max(0,k-1)],b=stream[Math.min(stream.length-1,k+1)],len=Math.hypot(b.x-a.x,b.z-a.z),tx=(b.x-a.x)/len,tz=(b.z-a.z)/len,nx=-tz,nz=tx;
 const front=[p.x-nx*6,p.z-nz*6],back=[p.x+nx*6,p.z+nz*6];
 cubic(points,[48,65],[50,66],[43,63],[43,58]);cubic(points,[43,58],[43,53],[46,54],[43,49]);cubic(points,[43,49],[42,47],[38,49],[35,43]);cubic(points,[35,43],[33,39],[front[0]-nx*6,front[1]-nz*6],front);
 marks.bridgeFront=points.length-1;line(points,front,back);marks.bridgeBack=points.length-1;
 const landing=[back[0]+nx*6,back[1]+nz*6];line(points,back,landing);marks.farmGate=points.length-1;
 cubic(points,landing,[landing[0]+nx*7,landing[1]+nz*7],[-2,33],[-5,26]);marks.westStart=points.length-1;
 cubic(points,[-5,26],[-10,19],[-22,24],[-24,17]);marks.westEnd=points.length-1;cubic(points,[-24,17],[-26,10],[-14,17],[-14,12]);line(points,[-14,12],[-14,9.25]);marks.gate=points.length-1;
 function measure(ps){let s=0;ps.forEach((p,j)=>{if(j)s+=Math.hypot(p.x-ps[j-1].x,p.z-ps[j-1].z);p.s=s;});return s;}
 function grade(ps,keys){for(const p of ps){let j=0;while(j<keys.length-2&&p.s>keys[j+1][0])j++;const[a,h]=keys[j],[b,k]=keys[j+1];p.h=T.MathUtils.lerp(h,k,T.MathUtils.clamp((p.s-a)/(b-a),0,1));if(plateauProtected(p.x,p.z))p.h=Math.max(p.h,naturalElevation(p.x,p.z)+.05);}for(let pass=0;pass<4;pass++){for(let j=1;j<ps.length;j++)ps[j].h=Math.max(ps[j].h,ps[j-1].h-.14*(ps[j].s-ps[j-1].s));for(let j=ps.length-2;j>=0;j--)ps[j].h=Math.max(ps[j].h,ps[j+1].h-.14*(ps[j+1].s-ps[j].s));}}
 function atPoints(ps,s){s=T.MathUtils.clamp(s,0,ps.at(-1).s);let a=0,b=ps.length-1;while(b-a>1){const m=(a+b)>>1;if(ps[m].s<s)a=m;else b=m;}const d=ps[b].s-ps[a].s||1,t=(s-ps[a].s)/d;return{x:T.MathUtils.lerp(ps[a].x,ps[b].x,t),z:T.MathUtils.lerp(ps[a].z,ps[b].z,t),h:T.MathUtils.lerp(ps[a].h,ps[b].h,t),tx:(ps[b].x-ps[a].x)/d,tz:(ps[b].z-ps[a].z)/d,s};}
 const length=measure(points),frontS=points[marks.bridgeFront].s,backS=points[marks.bridgeBack].s,bridgeS=(frontS+backS)/2,end=points.at(-1),keys=[[0,2.2],[frontS,4.6],[backS,4.7],[points[marks.westStart].s,6.2],[points[marks.westEnd].s,8],[length,naturalElevation(end.x,end.z)+.05]];
 grade(points,keys);const at=s=>atPoints(points,s),junctionS=frontS-6,junction=at(junctionS),branch=[];
 cubic(branch,[junction.x,junction.z],[junction.x+5,junction.z-1],[45,33],[43,28]);cubic(branch,[43,28],[41,22],[36,24],[34,20]);cubic(branch,[34,20],[32,16],[30,19],[30,15.5]);
 const branchLength=measure(branch);grade(branch,[[0,junction.h],[branchLength,naturalElevation(30,15.5)+.04]]);
 const junctionH=Math.max(junction.h,branch[0].h);branch[0].h=junctionH;for(const q of points)q.h=Math.max(q.h,junctionH-.14*Math.abs(q.s-junctionS));
 const segments=[];for(const[ps,isBranch]of[[points,false],[branch,true]])for(let j=0;j<ps.length-1;j++)segments.push({a:ps[j],b:ps[j+1],isBranch,j});
 function project(x,z,s){const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,d=Math.hypot(dx,dz)||1,t=T.MathUtils.clamp(((x-s.a.x)*dx+(z-s.a.z)*dz)/(d*d),0,1);return{distance:Math.hypot(x-s.a.x-dx*t,z-s.a.z-dz*t),x:s.a.x+dx*t,z:s.a.z+dz*t,h:T.MathUtils.lerp(s.a.h,s.b.h,t),s:T.MathUtils.lerp(s.a.s,s.b.s,t),tx:dx/d,tz:dz/d,isBranch:s.isBranch,segment:s.j};}
 const cells=new Map(),size=8;
 function nearest(x,z){const cx=Math.floor(x/size),cz=Math.floor(z/size),key=cx+','+cz;if(!cells.has(key)){const rows=segments.map(s=>({s,d:project((cx+.5)*size,(cz+.5)*size,s).distance})),min=Math.min(...rows.map(q=>q.d));cells.set(key,rows.filter(q=>q.d<=min+Math.SQRT2*size).map(q=>q.s));}let best=null;for(const s of cells.get(key)){const q=project(x,z,s);if(!best||q.distance<best.distance)best=q;}return best;}
 const patrolPoints=[...points.filter(p=>p.s<junctionS).map(p=>({...p})),{...at(junctionS)},...branch.slice(1).map(p=>({...p})),...branch.slice(0,-1).reverse().map(p=>({...p})),...points.filter(p=>p.s>junctionS).map(p=>({...p}))],patrolLength=measure(patrolPoints),patrolCourtS=junctionS+branchLength,patrolBridgeS=bridgeS+2*branchLength;
 const branchReport={junctionS,junction:[junction.x,junction.z],length:branchLength,end:[30,15.5],width:3.2,bank:'right/east; no stream crossing'};
 return{points,branch,branchAt:s=>atPoints(branch,s),branchReport,nearest,at,length,width:3.2,shoulder:5.2,patrolAt:s=>atPoints(patrolPoints,s),patrolLength,patrolCourtS,patrolBridgeS,bridge:{x:p.x,z:p.z,k,tx,tz,nx,nz,s:bridgeS,front,back},farmGateS:backS+2,isBridge:s=>Math.abs(s-bridgeS)<6-1e-6,isPatrolBridge:s=>Math.abs(s-patrolBridgeS)<6-1e-6,
 report:{revision:'morris-right-bank-court-branch-r3-20261030',expansion,length,width:3.2,bridgeCenter:[p.x,p.z],bridgeCrossings:1,farmGateS:backS+2,keys,branch:branchReport,patrolLength,patrolCourtS,mandatorySequence:['right flower path','right bridge end','bridge deck','left bridge end','open gate','left mountain road','castle gate'],marks:{...Object.fromEntries(Object.entries(marks).map(([k,i])=>[k,points[i].s])),eastEnd:junctionS}}};
}
