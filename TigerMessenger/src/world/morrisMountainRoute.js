import * as T from 'three';
const V=(x,z)=>new T.Vector3(x,0,z);
/** Hand-authored, C1-connected mountain approach. Circular hairpins give real
 * turning radii; no single-valued X(Z) road and no Catmull overshoot. */
export function createMorrisMountainRoute({R=160,stream,naturalElevation,plateauProtected=()=>false,expansion=1}){
 const points=[],marks={};
 function append(curve,n){for(let j=points.length?1:0;j<=n;j++){const p=curve.getPoint(j/n);points.push({x:p.x,z:p.z});}}
 const line=(a,b)=>append(new T.LineCurve3(V(...a),V(...b)),Math.max(2,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.3)));
 const cubic=(a,b,c,d)=>append(new T.CubicBezierCurve3(V(...a),V(...b),V(...c),V(...d)),100);
 function dubins(a,headingA,b,headingB,r=6){const mod=x=>((x%(Math.PI*2))+Math.PI*2)%(Math.PI*2),dx=b[0]-a[0],dz=b[1]-a[1],d=Math.hypot(dx,dz)/r,theta=Math.atan2(dz,dx),alpha=mod(headingA-theta),beta=mod(headingB-theta),sa=Math.sin(alpha),sb=Math.sin(beta),ca=Math.cos(alpha),cb=Math.cos(beta),cab=Math.cos(alpha-beta),candidates=[];
  function option(type,p2,tmp,t,q){if(p2>=0)candidates.push({type,parts:[mod(t(tmp)),Math.sqrt(p2),mod(q(tmp))]});}
  option('LSL',2+d*d-2*cab+2*d*(sa-sb),Math.atan2(cb-ca,d+sa-sb),v=>-alpha+v,v=>beta-v);
  option('RSR',2+d*d-2*cab+2*d*(-sa+sb),Math.atan2(ca-cb,d-sa+sb),v=>alpha-v,v=>-beta+v);
  let p2=-2+d*d+2*cab+2*d*(sa+sb);if(p2>=0){const tmp=Math.atan2(-ca-cb,d+sa+sb)-Math.atan2(-2,Math.sqrt(p2));option('LSR',p2,tmp,v=>-alpha+v,v=>-beta+v);}
  p2=d*d-2+2*cab-2*d*(sa+sb);if(p2>=0){const tmp=Math.atan2(ca+cb,d-sa-sb)-Math.atan2(2,Math.sqrt(p2));option('RSL',p2,tmp,v=>alpha-v,v=>beta-v);}
  const best=candidates.sort((x,y)=>x.parts.reduce((s,n)=>s+n,0)-y.parts.reduce((s,n)=>s+n,0))[0];if(!best)throw new Error('No bounded-radius road connection');let x=a[0],z=a[1],heading=headingA;if(!points.length)points.push({x,z});for(let k=0;k<3;k++){const length=best.parts[k]*r,n=Math.max(1,Math.ceil(length/.27)),ds=length/n,sign=best.type[k]==='L'?1:best.type[k]==='R'?-1:0;for(let j=0;j<n;j++){if(sign){const next=heading+sign*ds/r;x+=r/sign*(Math.sin(next)-Math.sin(heading));z+=r/sign*(-Math.cos(next)+Math.cos(heading));heading=next;}else{x+=Math.cos(heading)*ds;z+=Math.sin(heading)*ds;}points.push({x,z});}}if(Math.hypot(x-b[0],z-b[1])>.001)throw new Error('Road connection endpoint mismatch');points.at(-1).x=b[0];points.at(-1).z=b[1];
 }
 function ellipse(cx,cz,rx,rz,start,end){const n=Math.ceil(Math.abs(end-start)*Math.max(rx,rz)/.27);for(let j=points.length?1:0;j<=n;j++){const a=T.MathUtils.lerp(start,end,j/n);points.push({x:cx+Math.cos(a)*rx,z:cz+Math.sin(a)*rz});}}
 function arc(cx,cz,r,start,end,basis=null){const n=Math.ceil(Math.abs(end-start)*r/.27);for(let j=points.length?1:0;j<=n;j++){const a=T.MathUtils.lerp(start,end,j/n),u=Math.cos(a)*r,v=Math.sin(a)*r;points.push(basis?{x:cx+basis.tx*u+basis.nx*v,z:cz+basis.tz*u+basis.nz*v}:{x:cx+u,z:cz+v});}}
 const k=stream.reduce((best,p,j)=>Math.hypot(p.x-8,p.z-32)<Math.hypot(stream[best].x-8,stream[best].z-32)?j:best,0),p=stream[k],before=stream[Math.max(0,k-1)],after=stream[Math.min(stream.length-1,k+1)],len=Math.hypot(after.x-before.x,after.z-before.z),tx=(after.x-before.x)/len,tz=(after.z-before.z)/len,nx=-tz,nz=tx;
 const front=[p.x+nx*4,p.z+nz*4],back=[p.x-nx*4,p.z-nz*4];
 // Meadow S approach arrives from the creek side, revealing the bridge span.
 const bridgeHeading=Math.atan2(-nz,-nx),approachCenter=[front[0]-Math.sin(bridgeHeading)*6,front[1]+Math.cos(bridgeHeading)*6],approachZ=approachCenter[1]+6;
 if(expansion>1.2){cubic([-43,56],[-53,67],[-25,72],[-25,61]);dubins([-25,61],-Math.PI/2,[-18,50],0,6);}
 cubic([-18,50],[-8,50],[-8,47],[0,47]);cubic([0,47],[8,47],[5.5,approachZ+8],[13.5,approachZ+8]);
 arc(13.5,approachZ+4,4,Math.PI/2,-Math.PI/2);line([13.5,approachZ],[approachCenter[0],approachZ]);
 arc(approachCenter[0],approachCenter[1],6,Math.PI/2,bridgeHeading-Math.PI/2+Math.PI*2);
 marks.bridgeFront=points.length-1;
 line(front,back);marks.bridgeBack=points.length-1;
 // A straight landing beyond the far bank makes the open farm gate a real
 // mandatory passage, not a decorative object on the first turning arc.
 const q=[back[0]-nx*2,back[1]-nz*2];line(back,q);marks.farmGateDistance=1;
 const bend={x:q[0]-tx*6,z:q[1]-tz*6};arc(bend.x,bend.z,6,0,-Math.PI/2,{tx,tz,nx,nz});const lower=points.at(-1);
 dubins([lower.x,lower.z],Math.atan2(-tz,-tx),[-5,21],Math.PI);marks.westStart=points.length-1;
 arc(-5,12,9,Math.PI/2,Math.PI*1.5);marks.westEnd=points.length-1;
 // Climb around the uphill shoulder through a deliberate opposing bend.
 dubins([-5,3],0,[14,21],Math.PI/2);line([14,21],[14,21.6]);arc(20,21.6,6,Math.PI,Math.PI/2);cubic([20,27.6],[22,27.6],[24,26.1],[26,26.1]);cubic([26,26.1],[28,26.1],[30,27.6],[32,27.6]);marks.eastStart=points.length-1;
 ellipse(32,23.05,5.1,4.55,Math.PI/2,-Math.PI/2);marks.eastEnd=points.length-1;line([32,18.5],[22.5,18.5]);
 // This wider final quarter-turn stays outside the protected music court.
 arc(22.5,10,8.5,Math.PI/2,Math.PI);line([14,10],[14,9.25]);marks.gate=points.length-1;
 let distance=0;for(let j=0;j<points.length;j++){if(j)distance+=Math.hypot(points[j].x-points[j-1].x,points[j].z-points[j-1].z);points[j].s=distance;}
 const endpoint=points.at(-1),groundY=Math.sqrt((R+naturalElevation(endpoint.x,endpoint.z))**2-endpoint.x**2-endpoint.z**2)-R,endH=Math.hypot(endpoint.x,R+groundY+.27,endpoint.z)-R;
 const keys=[[0,1.75],[points[marks.bridgeFront].s,4.0],[points[marks.bridgeBack].s,4.4],[points[marks.westStart].s,5.6],[points[marks.westEnd].s,7.0],[points[marks.eastStart].s,7.7],[points[marks.eastEnd].s,8.0],[distance,endH]];
 for(const point of points){let k=0;while(k<keys.length-2&&point.s>keys[k+1][0])k++;const a=keys[k],b=keys[k+1];point.h=T.MathUtils.lerp(a[1],b[1],T.MathUtils.clamp((point.s-a[0])/(b[0]-a[0]),0,1));if(plateauProtected(point.x,point.z))point.h=Math.max(point.h,naturalElevation(point.x,point.z)+.23);}
 // Lift adjacent approaches to meet preserved flat castle/court foundations,
 // rather than burying the road or making a discontinuous step at their edge.
 for(let pass=0;pass<3;pass++){for(let j=1;j<points.length;j++)points[j].h=Math.max(points[j].h,points[j-1].h-.15*(points[j].s-points[j-1].s));for(let j=points.length-2;j>=0;j--)points[j].h=Math.max(points[j].h,points[j+1].h-.15*(points[j+1].s-points[j].s));}
 const segments=points.slice(0,-1).map((a,j)=>({a,b:points[j+1],j})),cells=new Map(),cellSize=8;
 function project(x,z,s){const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,q=T.MathUtils.clamp(((x-s.a.x)*dx+(z-s.a.z)*dz)/(dx*dx+dz*dz||1),0,1),xx=s.a.x+dx*q,zz=s.a.z+dz*q;return{distance:Math.hypot(x-xx,z-zz),x:xx,z:zz,h:T.MathUtils.lerp(s.a.h,s.b.h,q),s:T.MathUtils.lerp(s.a.s,s.b.s,q),tx:dx/Math.hypot(dx,dz),tz:dz/Math.hypot(dx,dz),segment:s.j};}
 function nearest(x,z){const cx=Math.floor(x/cellSize),cz=Math.floor(z/cellSize),key=cx+','+cz;if(!cells.has(key)){const qx=(cx+.5)*cellSize,qz=(cz+.5)*cellSize,rows=segments.map(s=>({s,d:project(qx,qz,s).distance})),min=Math.min(...rows.map(q=>q.d));cells.set(key,rows.filter(q=>q.d<=min+Math.SQRT2*cellSize).map(q=>q.s));}let best=null;for(const segment of cells.get(key)){const q=project(x,z,segment);if(!best||q.distance<best.distance)best=q;}return best;}
 function at(s){s=T.MathUtils.clamp(s,0,distance);let a=0,b=points.length-1;while(b-a>1){const m=(a+b)>>1;if(points[m].s<s)a=m;else b=m;}const t=(s-points[a].s)/(points[b].s-points[a].s||1);return{x:T.MathUtils.lerp(points[a].x,points[b].x,t),z:T.MathUtils.lerp(points[a].z,points[b].z,t),h:T.MathUtils.lerp(points[a].h,points[b].h,t),tx:(points[b].x-points[a].x)/(points[b].s-points[a].s||1),tz:(points[b].z-points[a].z)/(points[b].s-points[a].s||1),s};}
 const bridgeS=(points[marks.bridgeFront].s+points[marks.bridgeBack].s)/2;
 const farmGateS=points[marks.bridgeBack].s+marks.farmGateDistance;delete marks.farmGateDistance;
 return{points,nearest,at,length:distance,width:3.2,shoulder:6.5,bridge:{x:p.x,z:p.z,k,tx,tz,nx,nz,s:bridgeS,front,back},farmGateS,isBridge:s=>Math.abs(s-bridgeS)<4-1e-6,report:{revision:expansion>1.2?'morris-area2-full-mountain-replan-r1-20261028':'morris-mid-slope-route-r1-20261027',expansion,outerMeadowExtended:expansion>1.2,design:'expanded meadow approach, single creek crossing, open farm gate, wide western nine-metre return and broad eastern shoulder ellipse before lower music court and castle',length:distance,width:3.2,hairpinCenterRadius:9,finalTurnRadius:8.5,eastTurnRadius:4.55,eastEllipse:[5.1,4.55],eastMinimumCurvatureRadius:4.55**2/5.1,farmGateS,bridgeDeckHalfLength:4,mandatorySequence:['flower path','bridge deck','open farm gate','mountain approach','music court outer shoulder','castle gate'],minimumDesignedInnerRadius:2.4,meadowTurnRadius:4,bridgeCenter:[p.x,p.z],bridgeCrossings:1,keys,marks:Object.fromEntries(Object.entries(marks).map(([k,i])=>[k,points[i].s]))}};
}
