import * as THREE from 'three';

const TAU=Math.PI*2, EPS=1e-5;
const angle=p=>((Math.atan2(p.z,p.x)%TAU)+TAU)%TAU;
const key=p=>`${Math.round(p.x/EPS)},${Math.round(p.z/EPS)}`;
const cross=(a,b)=>a.x*b.z-a.z*b.x;
const failure=message=>{throw new Error(message);};

// Intersect the final rendered triangles, including their actual open boundary.
// In particular, a miss on a bottom edge is never interpreted as another outlet.
function section(mesh,y,toInner){
  const p=mesh.geometry.attributes.position,index=mesh.geometry.index;
  const points=new Map(),edges=new Map(),n=index?index.count:p.count;
  const add=(a,b)=>{
    const ka=key(a),kb=key(b);if(ka===kb)return;
    points.set(ka,a);points.set(kb,b);
    edges.set([ka,kb].sort().join('|'),[ka,kb]);
  };
  for(let i=0;i<n;i+=3){
    const v=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(toInner));
    const hits=[];
    for(let j=0;j<3;j++){
      const a=v[j],b=v[(j+1)%3],da=a.y-y,db=b.y-y;
      if(Math.abs(da)<EPS)hits.push(a.clone().setY(y));
      if((da>EPS&&db< -EPS)||(da< -EPS&&db>EPS))hits.push(a.clone().lerp(b,da/(da-db)).setY(y));
    }
    const distinct=[...new Map(hits.map(v=>[key(v),v])).values()];
    if(distinct.length===2)add(...distinct);
    else if(distinct.length>2)failure('coplanar wall face is not a shoreline');
  }
  if(edges.size<3)failure(`missing wall section at ${y}`);
  const links=new Map();
  for(const [a,b]of edges.values()){if(!links.has(a))links.set(a,[]);if(!links.has(b))links.set(b,[]);links.get(a).push(b);links.get(b).push(a);}
  if([...links.values()].some(v=>v.length>2))failure('branching shoreline');
  const ends=[...links].filter(([,v])=>v.length===1).map(([k])=>k);
  if(ends.length!==0&&ends.length!==2)failure('multiple shoreline openings');
  const start=ends[0]??links.keys().next().value,walk=[];let prev=null,at=start;
  do{walk.push(points.get(at));const next=links.get(at).find(k=>k!==prev);prev=at;at=next;}while(at&&at!==start&&walk.length<=links.size);
  if(walk.length!==links.size)failure('disconnected shoreline');
  let total=0;for(let i=1;i<walk.length;i++)total+=Math.atan2(cross(walk[i-1],walk[i]),walk[i-1].x*walk[i].x+walk[i-1].z*walk[i].z);
  if(total<0)walk.reverse();
  for(let i=1;i<walk.length;i++)if(cross(walk[i-1],walk[i])< -EPS)failure('non-star-shaped shoreline');
  return {points:walk,closed:ends.length===0};
}

function rayRadius(chain,a){
  const d={x:Math.cos(a),z:Math.sin(a)};let found=null;
  const p=chain.points,n=chain.closed?p.length:p.length-1;
  for(let i=0;i<n;i++){
    const A=p[i],B=p[(i+1)%p.length],e={x:B.x-A.x,z:B.z-A.z},den=cross(d,e);
    if(Math.abs(den)<1e-10)continue;
    const r=cross(A,e)/den,t=cross(A,d)/den;
    if(r>0&&t>=-1e-7&&t<=1+1e-7)found=found===null?r:Math.min(found,r);
  }
  return found;
}

function oldDisk(water,matrix){
  const p=water.geometry.attributes.position,v=[];
  for(let i=0;i<p.count;i++)v.push(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(matrix));
  const y=v[0].y;
  if(v.some(p=>Math.abs(p.y-y)>EPS))failure('water surface must be planar in inner coordinates before animation');
  const points=[...new Map(v.filter(p=>Math.hypot(p.x,p.z)>EPS).map(p=>[key(p),p])).values()].sort((a,b)=>angle(a)-angle(b));
  if(points.length<3)failure('missing old water boundary');
  return {y,points,closed:true};
}

function meshGeometry(vertices,indices,toLocal,colors){
  const positions=[];for(const p of vertices)positions.push(...p.clone().applyMatrix4(toLocal));
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);
  if(colors)g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}

function boundaryAngles(...chains){
  return [...new Set(chains.flatMap(s=>s.points.map(p=>Math.round(angle(p)*1e10)/1e10)))].sort((a,b)=>a-b);
}

// Only this module's geometries and shoreline material are owned by the handle.
// Installation is transactional: malformed/multiple/non-star-shaped sections
// preserve the original water and return an explicit unsuccessful report.
export function installSwampWaterShore(swamp,{enabled=new URLSearchParams(globalThis.location?.search||'').get('swampWaterShore')!=='0',inset=.04}={}){
  const inner=swamp.userData.inner||swamp;
  if(inner.userData.swampWaterShore)return inner.userData.swampWaterShore;
  if(!enabled)return null;
  const water=inner.getObjectByName('swamp-underground-waterline'),wall=inner.getObjectByName('swamp-sinkhole-wall'),volume=inner.getObjectByName('swamp-water-volume');
  if(!water||!wall||!volume)return {ok:false,reason:'water, wall or volume missing'};
  const owned=[];
  try{
    if(!Number.isFinite(inset)||inset<0)failure('volume inset must be nonnegative');
    inner.updateWorldMatrix(true,true);
    const inverse=inner.matrixWorld.clone().invert();
    const matrix=o=>inverse.clone().multiply(o.matrixWorld);
    const wm=matrix(water),vm=matrix(volume),bm=matrix(wall),disk=oldDisk(water,wm),top=section(wall,disk.y,bm);
    if(top.closed)failure('expected the authored departure opening');
    // Follow the entire real wall, then the original polygon arc across its gap.
    const angles=boundaryAngles(top,disk),first=angle(top.points[0]),last=angle(top.points.at(-1));
    const span=((last-first)+TAU)%TAU;
    if(span<Math.PI)failure('wall section does not enclose the basin');
    const along=a=>{const d=((a-first)+TAU)%TAU;return d<TAU-1e-8?d:0;};
    const onWall=angles.filter(a=>along(a)<span+1e-8).sort((a,b)=>along(a)-along(b));
    const point=(a,r,y)=>new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r);
    const edge=onWall.map(a=>point(a,Math.min(rayRadius(top,a)??failure('wall section gap'),rayRadius(disk,a)),disk.y));
    const shore=edge.map(p=>p.clone());
    edge.push(point(last,rayRadius(disk,last),disk.y));
    for(const a of angles.filter(a=>along(a)>span+1e-8).sort((a,b)=>along(a)-along(b)))edge.push(point(a,rayRadius(disk,a),disk.y));
    edge.push(point(first,rayRadius(disk,first),disk.y));
    const vertices=[new THREE.Vector3(0,disk.y,0),...edge],triangles=[];
    for(let i=0;i<edge.length;i++)triangles.push(0,1+(i+1)%edge.length,1+i);
    const waterGeo=meshGeometry(vertices,triangles,wm.clone().invert());owned.push(waterGeo);

    // Keep the old volume's actual polygon, levels and colours as upper bounds.
    const vp=volume.geometry.attributes.position,heights=[];
    for(let i=0;i<vp.count;i++)heights.push(new THREE.Vector3().fromBufferAttribute(vp,i).applyMatrix4(vm).y);
    const ys=[...new Set(heights.map(y=>Math.round(y*1e6)/1e6))].sort((a,b)=>a-b);
    const slices=ys.map(y=>({y,wall:section(wall,y,bm),old:section(volume,y,vm)}));
    if(slices.some(s=>s.wall.closed||!s.old.closed))failure('inconsistent wall opening or old volume');
    const all=boundaryAngles(...slices.flatMap(s=>[s.wall,s.old]));
    // Only mouth endpoints need two radial lanes; ordinary angles share a vertex.
    const mouths=slices.flatMap(s=>[angle(s.wall.points[0]),angle(s.wall.points.at(-1))]);
    const lanes=all.flatMap(a=>mouths.some(b=>Math.abs(a-b)<1e-8)?[{a,side:-1},{a,side:1}]:[{a,side:0}]),body=[],indices=[],colors=[];
    const vc=volume.geometry.attributes.color;
    function oldColor(y){
      let best=Infinity,c=new THREE.Color(1,1,1);
      if(vc)for(let i=0;i<vp.count;i++){
        const h=new THREE.Vector3().fromBufferAttribute(vp,i).applyMatrix4(vm).y,d=Math.abs(h-y);
        if(d<best){best=d;c.fromBufferAttribute(vc,i);}
      }return c;
    }
    for(const s of slices){const color=oldColor(s.y);for(const {a,side}of lanes){
      const rOld=rayRadius(s.old,a),exists=rayRadius(s.wall,a+side*1e-6)!==null,rWall=rayRadius(s.wall,a);
      const r=exists?Math.min(rOld,(rWall??rayRadius(s.wall,a+side*1e-6))-inset):rOld;
      if(!(r>0&&Number.isFinite(r)))failure('invalid volume radius');body.push(point(a,r,s.y));colors.push(color.r,color.g,color.b);
    }}
    const count=lanes.length;
    for(let j=0;j<slices.length-1;j++)for(let i=0;i<count;i++){const a=j*count+i,b=j*count+(i+1)%count,c=a+count,d=b+count;indices.push(a,c,b,b,c,d);}
    const volumeGeo=meshGeometry(body,indices,vm.clone().invert(),colors);owned.push(volumeGeo);

    const lineGeo=new THREE.BufferGeometry().setFromPoints(shore.map(p=>p.clone().add(new THREE.Vector3(0,.035,0)).applyMatrix4(wm.clone().invert())));owned.push(lineGeo);
    const lineMaterial=new THREE.LineBasicMaterial({color:0x489ba9,transparent:true,opacity:.32,depthWrite:false,fog:false,toneMapped:false});
    const shoreline=new THREE.Line(lineGeo,lineMaterial);shoreline.name='swamp-real-wet-shore';shoreline.raycast=()=>{};
    const old={water:water.geometry,volume:volume.geometry,attachments:water.children.map(o=>[o,o.visible])};
    water.geometry=waterGeo;volume.geometry=volumeGeo;
    for(const [o]of old.attachments)o.visible=false;
    water.add(shoreline);
    let disposed=false;
    const report={ok:true,version:1,frame:'inner-swamp-local',waterY:disk.y,inset,wallSection:top.points.map(p=>p.toArray()),waterBoundary:edge.map(p=>p.toArray()),opening:{from:last,to:first},volumeLevels:ys,waterTriangles:triangles.length/3,volumeTriangles:indices.length/3,shorelineDraws:1,
      dispose(){if(disposed)return;disposed=true;water.geometry=old.water;volume.geometry=old.volume;for(const[o,visible]of old.attachments)o.visible=visible;shoreline.removeFromParent();owned.forEach(g=>g.dispose());lineMaterial.dispose();delete inner.userData.swampWaterShore;}
    };
    inner.userData.swampWaterShore=report;return report;
  }catch(error){owned.forEach(g=>g.dispose());return {ok:false,reason:error.message};}
}
