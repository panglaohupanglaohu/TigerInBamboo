import * as T from 'three';
/** Remove the measured rear exterior quadrant and cap its two exact cut planes.
 * Retains every untouched corner attribute; does not collapse a surface to sea. */
export function clipRearShipVolume(source,{toChart,x=18,z=-10}={}){
 const p=source.attributes.position,ix=source.index,spec=Object.entries(source.attributes),inverse=toChart.clone().invert(),values=Object.fromEntries(spec.map(([n])=>[n,[]])),edges=[[],[]],report={version:'rear-ship-volume-clip-1',x,z,removedTriangles:0,capTriangles:0,openCapEndpoints:0,sourceTriangles:(ix?.count??p.count)/3};
 const sourceKey=id=>[p.getX(id),p.getY(id),p.getZ(id)].join(',');
 const authoredSkirt=source.userData.gridMethod==='primary-grid+dual-grid+alternating-triangles'&&source.userData.sideSkirt===true&&source.userData.flatBase===false&&!!source.attributes.shoreBoundaryBottom;
 const sourceEdges=new Map();if(authoredSkirt)for(let i=0;i<(ix?.count??p.count);i+=3)for(let j=0;j<3;j++){const a=sourceKey(ix?ix.getX(i+j):i+j),b=sourceKey(ix?ix.getX(i+(j+1)%3):i+(j+1)%3),k=a<b?a+'|'+b:b+'|'+a;sourceEdges.set(k,(sourceEdges.get(k)||0)+1);}
 const mix=(a,b,t)=>({p:a.p.clone().lerp(b.p,t),origin:[...new Set([...a.origin,...b.origin])],attr:Object.fromEntries(spec.map(([n])=>[n,a.attr[n].map((v,k)=>v+(b.attr[n][k]-v)*t)]))});
 function split(poly,axis,value,sign){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a.p[axis]-value)*sign,db=(b.p[axis]-value)*sign;if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const v=mix(a,b,da/(da-db));v.p[axis]=value;out.push(v);}}return out;}
 function emit(a,b,c,normal=null){if(new T.Triangle(a.p,b.p,c.p).getArea()<1e-9)return;for(const v of[a,b,c])for(const[n]of spec){if(n==='position')values[n].push(...v.p.clone().applyMatrix4(inverse).toArray());else if(n==='normal'&&normal)values[n].push(...normal);else values[n].push(...v.attr[n]);}}
 for(let f=0;f<report.sourceTriangles;f++){const v=[0,1,2].map(k=>{const id=ix?ix.getX(f*3+k):f*3+k;return{p:new T.Vector3().fromBufferAttribute(p,id).applyMatrix4(toChart),origin:[sourceKey(id)],attr:Object.fromEntries(spec.map(([n,a])=>[n,Array.from({length:a.itemSize},(_,j)=>a.array[id*a.itemSize+j])]))};});let polys=[v];for(const[axis,value]of[['x',x],['z',z]]){const out=[];for(const poly of polys)if(poly.some(v=>v.p[axis]<value)&&poly.some(v=>v.p[axis]>value))out.push(split(poly,axis,value,1),split(poly,axis,value,-1));else out.push(poly);polys=out;}
  for(const poly of polys){const c=poly.reduce((a,v)=>a.add(v.p),new T.Vector3()).multiplyScalar(1/poly.length);if(c.x>x&&c.z<z){report.removedTriangles++;continue;}for(let i=1;i<poly.length-1;i++)emit(poly[0],poly[i],poly[i+1]);for(let j=0;j<poly.length;j++){const a=poly[j],b=poly[(j+1)%poly.length],mid=a.p.clone().add(b.p).multiplyScalar(.5);if(Math.abs(a.p.x-x)<1e-6&&Math.abs(b.p.x-x)<1e-6&&mid.z<z-1e-6)edges[0].push([a,b]);if(Math.abs(a.p.z-z)<1e-6&&Math.abs(b.p.z-z)<1e-6&&mid.x>x+1e-6)edges[1].push([a,b]);}}
 }
 // A WFC heightfield deliberately has no underside, and its water corridor
 // removes complete cells. Its cut walls need a real lower edge, not an assumed
 // solid-volume loop. Accept only documented original boundary edges here.
 const boundaryEnds=authoredSkirt?edges.flat().flat().filter(v=>v.attr.shoreBoundaryBottom?.[0]>.999999):[];
 const skirtBase=boundaryEnds.length?Math.min(...edges.flat().flat().map(v=>v.p.y))-.25:null;
 const onSourceBoundary=v=>{if(Math.abs(v.p.x-x)<1e-8&&Math.abs(v.p.z-z)<1e-8)return true;if(v.origin.length!==2)return false;const[a,b]=v.origin;return sourceEdges.get(a<b?a+'|'+b:b+'|'+a)===1;};
 report.authoredSkirtPanels=0;report.skirtBase=skirtBase;
 // Match the actual emitted Float32 vertices. Decimal rounding at 1e-4 welds
 // distinct narrow-cut corners and turns a closed cap loop into a dead end.
 const key=v=>v.p.clone().applyMatrix4(inverse).toArray().map(Math.fround).join(',');
 const welds=new Map();report.quantizationSeamWelds=0;report.maxSeamCorrection=0;
 const canonical=k=>{while(welds.has(k))k=welds.get(k);return k;};
 for(let plane=0;plane<2;plane++){
  const unique=new Map(),verts=new Map();for(const[a,b]of edges[plane]){const ka=key(a),kb=key(b);if(ka===kb)continue;verts.set(ka,a);verts.set(kb,b);const k=ka<kb?ka+'|'+kb:kb+'|'+ka;if(unique.has(k))unique.delete(k);else unique.set(k,[ka,kb]);}
  const adjacency=()=>{const m=new Map();for(const[a,b]of unique.values()){if(!m.has(a))m.set(a,[]);if(!m.has(b))m.set(b,[]);m.get(a).push(b);m.get(b).push(a);}return m;};let graph=adjacency();
  // Independent interpolation of already-Float32 neighboring triangles may
  // leave seam ends a few ULPs apart. Join degree-one ends within two ULPs
  // per output coordinate; a sharp valid corner need not continue in an
  // opposite direction. Never merge vertices that already form a closed loop.
  const loose=[...graph].filter(([,n])=>n.length===1).map(([k])=>k).sort(),paired=new Set();
  for(let i=0;i<loose.length;i++){
   const a=loose[i];if(paired.has(a))continue;const A=verts.get(a),local=A.p.clone().applyMatrix4(inverse),magnitude=Math.max(1,...local.toArray().map(Math.abs)),tolerance=2*Math.pow(2,Math.floor(Math.log2(magnitude))-23);let chosen=null,distance=Infinity;
   for(let j=i+1;j<loose.length;j++){
    const b=loose[j];if(paired.has(b))continue;const B=verts.get(b),d=A.p.distanceTo(B.p),other=B.p.clone().applyMatrix4(inverse);
    if(Math.max(Math.abs(local.x-other.x),Math.abs(local.y-other.y),Math.abs(local.z-other.z))<=tolerance&&d<distance){chosen=b;distance=d;}
   }
   if(chosen!==null){paired.add(a);paired.add(chosen);welds.set(chosen,a);report.quantizationSeamWelds++;report.maxSeamCorrection=Math.max(report.maxSeamCorrection,distance);}
  }
  if(paired.size){const rebuilt=new Map();for(const pair of unique.values()){const[a,b]=pair.map(canonical);if(a===b)continue;const k=a<b?a+'|'+b:b+'|'+a;if(rebuilt.has(k))rebuilt.delete(k);else rebuilt.set(k,[a,b]);}unique.clear();for(const [k,pair]of rebuilt)unique.set(k,pair);graph=adjacency();}
  if(skirtBase!==null){
   const visited=new Set();
   for(const start of graph.keys()){
    if(visited.has(start))continue;const component=[],stack=[start];while(stack.length){const k=stack.pop();if(visited.has(k))continue;visited.add(k);component.push(k);for(const next of graph.get(k)||[])if(!visited.has(next))stack.push(next);}
    const ends=component.filter(k=>graph.get(k).length===1);
    if(ends.length!==2||component.some(k=>graph.get(k).length>2)||ends.some(k=>!onSourceBoundary(verts.get(k))))continue;
    const lower=ends.map(k=>{const v=verts.get(k),bottom={...v,p:v.p.clone().setY(skirtBase)},b=key(bottom);verts.set(b,bottom);return b;});
    for(const[a,b]of [[ends[0],lower[0]],[lower[0],lower[1]],[lower[1],ends[1]]])if(a!==b){const k=a<b?a+'|'+b:b+'|'+a;if(unique.has(k))unique.delete(k);else unique.set(k,[a,b]);}
    report.authoredSkirtPanels++;
   }
   graph=adjacency();
  }
  const ends=[...graph].filter(([,v])=>v.length===1).map(([k])=>k),corner=ends.filter(k=>Math.abs(verts.get(k).p.x-x)<1e-4&&Math.abs(verts.get(k).p.z-z)<1e-4).sort((a,b)=>verts.get(a).p.y-verts.get(b).p.y);
  for(let i=0;i+1<corner.length;i+=2)unique.set('corner'+i,[corner[i],corner[i+1]]);graph=adjacency();report.openCapEndpoints+=[...graph.values()].filter(v=>v.length!==2).length;
  (report.openContourNodes??=[]).push(...[...graph].filter(([,v])=>v.length!==2).map(([k,n])=>({plane,point:verts.get(k).p.toArray(),degree:n.length,neighbors:n.map(i=>verts.get(i).p.toArray())})));
  const seen=new Set();for(const start of graph.keys()){if(seen.has(start)||graph.get(start).length!==2)continue;const loop=[];let prev=null,current=start;for(let n=0;n<=graph.size;n++){if(seen.has(current))break;const neighbors=graph.get(current);if(!neighbors||neighbors.length!==2){current=null;break;}seen.add(current);loop.push(verts.get(current));const next=neighbors.find(k=>k!==prev);prev=current;current=next;if(current===start)break;}if(current!==start||loop.length<3)continue;
   const coords=loop.map(v=>new T.Vector2(plane===0?v.p.z:v.p.x,v.p.y)),normal=new T.Vector3(plane===0?1:0,0,plane===0?0:-1),localNormal=normal.clone().applyMatrix3(new T.Matrix3().getNormalMatrix(inverse)).normalize().toArray();
   for(const face of T.ShapeUtils.triangulateShape(coords,[])){let[a,b,c]=face.map(i=>loop[i]);if(new T.Triangle(a.p,b.p,c.p).getNormal(new T.Vector3()).dot(normal)<0)[b,c]=[c,b];emit(a,b,c,localNormal);report.capTriangles++;}
  }
 }
 // Apply the same seam correction to retained faces and caps, not just to the
 // graph labels, so the resulting rendered boundary is geometrically joined.
 for(let i=0;i<values.position.length;i+=3){const k=values.position.slice(i,i+3).map(Math.fround).join(','),c=canonical(k);if(c!==k){const q=c.split(',').map(Number);for(let j=0;j<3;j++)values.position[i+j]=q[j];}}
 const geometry=new T.BufferGeometry();for(const[n,a]of spec)geometry.setAttribute(n,new T.Float32BufferAttribute(values[n],a.itemSize));geometry.computeBoundingBox();geometry.computeBoundingSphere();report.outputTriangles=geometry.attributes.position.count/3;report.closedCutContours=report.openCapEndpoints===0;geometry.userData={...source.userData,rearShipVolumeClip:report};return{geometry,report};
}
