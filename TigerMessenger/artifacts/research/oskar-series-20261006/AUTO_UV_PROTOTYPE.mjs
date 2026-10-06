// Isolated research prototype: ordered, non-branching shorelines only.
// v is signed bank distance; +v is normal cross shoreline tangent.
// No terrain mutation, rendering, topology generation, or navigation ownership.
const add = (a,b) => a.map((v,i)=>v+b[i]);
const sub = (a,b) => a.map((v,i)=>v-b[i]);
const mul = (a,s) => a.map(v=>v*s);
const dot = (a,b) => a.reduce((v,x,i)=>v+x*b[i],0);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm = a => Math.hypot(...a);
const unit = a => {const n=norm(a);if(n<1e-10)throw new Error('degenerate direction');return mul(a,1/n);};
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const angle = (a,b) => Math.atan2(norm(cross(a,b)),clamp(dot(a,b),-1,1));
const finitePoint = p => Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);

export function buildAutomaticShoreUV({shoreline, bandVertices, bandTriangles, closed=false,
  surface='plane', normal=[0,1,0], sphereCentre=[0,0,0], sphereRadius,
  repeatLength=4, repeatWidth=2, branches=null, ambiguityTolerance=1e-7,
  surfaceTolerance=1e-5, maxBankDistance=Infinity}={}) {
  if(branches?.length)throw new Error('branching requires separate patches and a junction chart');
  if(!['plane','sphere'].includes(surface))throw new Error('unsupported surface');
  if(!Array.isArray(shoreline)||shoreline.length<(closed?3:2)||!shoreline.every(finitePoint))throw new Error('invalid shoreline');
  if(!Array.isArray(bandVertices)||!bandVertices.length||!bandVertices.every(finitePoint))throw new Error('invalid band vertices');
  if(!Array.isArray(bandTriangles)||!bandTriangles.length||bandTriangles.some(t=>!Array.isArray(t)||t.length!==3||t.some(i=>!Number.isInteger(i)||i<0||i>=bandVertices.length)))throw new Error('band triangles required for seam splitting');
  if(!Number.isFinite(repeatLength)||repeatLength<=0||!Number.isFinite(repeatWidth)||repeatWidth<=0)throw new Error('invalid texture scale');
  if(!Number.isFinite(ambiguityTolerance)||ambiguityTolerance<0||!Number.isFinite(surfaceTolerance)||surfaceTolerance<=0||!(maxBankDistance>0))throw new Error('invalid tolerances');
  if(!finitePoint(normal)||!finitePoint(sphereCentre))throw new Error('invalid frame');
  const n=unit(normal), points=shoreline.map(p=>[...p]);
  if(closed&&norm(sub(points[0],points.at(-1)))<1e-10)points.pop();
  if(points.length<(closed?3:2))throw new Error('degenerate closed shoreline');
  if(surface==='sphere'&&(!Number.isFinite(sphereRadius)||sphereRadius<=0))throw new Error('positive sphereRadius required');
  const all=[...points,...bandVertices];
  if(surface==='sphere') {
    if(all.some(p=>Math.abs(norm(sub(p,sphereCentre))-sphereRadius)>surfaceTolerance))throw new Error('vertex off sphere; arbitrary relief requires geodesic surface solver');
  } else if(all.some(p=>Math.abs(dot(sub(p,points[0]),n))>surfaceTolerance))throw new Error('nonplanar surface requires separate patches');
  const segments=[];let total=0;
  for(let i=0;i<points.length-(closed?0:1);i++) {
    const a=points[i],b=points[(i+1)%points.length];
    let length,tangent,axis,A,B,theta;
    if(surface==='sphere') {
      A=unit(sub(a,sphereCentre));B=unit(sub(b,sphereCentre));theta=angle(A,B);
      if(theta<1e-9||Math.PI-theta<1e-6)throw new Error('degenerate or antipodal sphere segment');
      axis=unit(cross(A,B));tangent=unit(cross(axis,A));length=theta*sphereRadius;
    }else{length=norm(sub(b,a));if(length<1e-9)throw new Error('degenerate shoreline segment');tangent=mul(sub(b,a),1/length);}
    segments.push({a,b,length,tangent,axis,A,B,theta,start:total});total+=length;
  }
  // Repeated internal positions encode self-intersection or a graph, not one chart.
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)if(norm(sub(points[i],points[j]))<1e-9)throw new Error('repeated junction requires separate patches');
  function project(p,seg,index){
    let q,t,localNormal,tangent=seg.tangent,distance;
    if(surface==='sphere') {
      const P=unit(sub(p,sphereCentre)),along=Math.atan2(dot(P,seg.tangent),dot(P,seg.A));
      t=clamp(along/seg.theta,0,1);const a=seg.theta*t;
      localNormal=add(mul(seg.A,Math.cos(a)),mul(seg.tangent,Math.sin(a)));
      tangent=unit(cross(seg.axis,localNormal));q=add(sphereCentre,mul(localNormal,sphereRadius));distance=angle(P,localNormal)*sphereRadius;
    }else{t=clamp(dot(sub(p,seg.a),seg.tangent)/seg.length,0,1);q=add(seg.a,mul(seg.tangent,t*seg.length));localNormal=n;distance=norm(sub(p,q));}
    const side=dot(sub(p,q),cross(localNormal,tangent));
    // Sphere bank distances follow surface arcs, not chord lengths.
    const d=surface==='sphere'?Math.sign(side)*distance:side;
    return {s:seg.start+t*seg.length,d,distance,index,q};
  }
  const records=bandVertices.map((p,vertex)=>{
    const candidates=segments.map((s,i)=>project(p,s,i)).sort((a,b)=>a.distance-b.distance),best=candidates[0];
    if(best.distance>maxBankDistance)throw new Error(`vertex ${vertex} outside bank band`);
    for(const next of candidates.slice(1)) {
      if(next.distance-best.distance>ambiguityTolerance)break;
      const gap=Math.abs(best.s-next.s),wrappedGap=closed?Math.min(gap,total-gap):gap;
      if(wrappedGap>surfaceTolerance)throw new Error(`ambiguous closest shoreline at vertex ${vertex}; split patch or supply narrower band`);
    }
    return best;
  });
  const outVertices=bandVertices.map(p=>[...p]),uv=records.map(r=>[r.s/repeatLength,r.d/repeatWidth]);
  const sourceVertex=bandVertices.map((_,i)=>i),duplicates=new Map(),triangles=[];
  let seamTriangles=0;
  for(const face of bandTriangles){
    const worldArea=norm(cross(sub(bandVertices[face[1]],bandVertices[face[0]]),sub(bandVertices[face[2]],bandVertices[face[0]])));
    if(worldArea<1e-10)throw new Error('degenerate band triangle');
    let result=[...face];
    if(closed){
      const ss=face.map(i=>records[i].s);
      if(Math.max(...ss)-Math.min(...ss)>total/2){
        const unwrapped=ss.map(s=>s<total/2?s+total:s);
        if(Math.max(...unwrapped)-Math.min(...unwrapped)>total/2)throw new Error('triangle spans too much shoreline; subdivide patch');
        seamTriangles++;
        result=face.map(i=>{
          if(records[i].s>=total/2)return i;
          if(!duplicates.has(i)){
            const id=outVertices.length;duplicates.set(i,id);outVertices.push([...bandVertices[i]]);uv.push([(records[i].s+total)/repeatLength,records[i].d/repeatWidth]);sourceVertex.push(i);
          }return duplicates.get(i);
        });
      }
    }
    const [a,b,c]=result.map(i=>uv[i]),det=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    if(Math.abs(det)<1e-12)throw new Error('collapsed UV triangle; split or narrow chart');
    triangles.push(result);
  }
  // Winding may depend on the supplied surface orientation, but cannot flip within a chart.
  const signs=triangles.map(f=>{const[a,b,c]=f.map(i=>uv[i]);return Math.sign((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]));});
  if(signs.some(s=>s!==signs[0]))throw new Error('UV fold or inconsistent triangle winding');
  return {vertices:outVertices,uv,triangles,sourceVertex,report:{version:'auto-shore-uv-prototype-v1',surface,closed,totalLength:total,
    repeatLength,repeatWidth,duplicateSeamVertices:duplicates.size,seamTriangles,
    closureTexturePhase:closed?(total/repeatLength)%1:null,
    metric:surface==='sphere'?'great-circle minor arcs on exact sphere':'3D polyline on plane',
    integrated:false,limitations:['Ordered unbranched charts only; junctions must be separate patches.','No arbitrary relief geodesics, atlas packing, shader blending, global self-overlap or Jacobian optimization.','Closed UV seam is split; noninteger closureTexturePhase requires periodic-length choice or explicit seam blending.']}};
}
