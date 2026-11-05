/** 1120036868966502401: "marching squares on irregular quadrilateral grids".
 * Shared-corner field + cached edge crossings. Quads use a bilinear saddle
 * decider; triangles (and convex polygon fans) use linear interpolation.
 */
const edgeKey=(a,b)=>a<b?`${a}|${b}`:`${b}|${a}`;
export function buildCornerField(cells,valueOf,{quant=1e-6,reduce='mean'}={}){
  if(!Number.isFinite(quant)||quant<=0||!['mean','max'].includes(reduce))throw new RangeError('Invalid corner field');
  const key=p=>p.id===undefined?`p:${Math.round(p.x/quant)},${Math.round(p.z/quant)}`:`v:${p.id}`;
  const corners=new Map();
  // Stable sums/order even if the caller reverses cell enumeration.
  for(const c of [...cells].sort((a,b)=>a.id-b.id)){
    const value=valueOf(c);if(!Number.isFinite(value))throw new TypeError('Nonfinite contour sample');
    for(const p of c.pts){if(!Number.isFinite(p.x)||!Number.isFinite(p.z))throw new TypeError('Invalid corner');const k=key(p),old=corners.get(k);if(old){if(Math.hypot(old.x-p.x,old.z-p.z)>quant*2)throw Error('Conflicting shared vertex');old.sum+=value;old.max=Math.max(old.max,value);old.n++;}else corners.set(k,{key:k,x:p.x,z:p.z,sum:value,max:value,n:1});}
  }
  for(const v of corners.values())v.value=reduce==='max'?v.max:v.sum/v.n;
  return {key,corners,valueAt:p=>corners.get(key(p))?.value};
}
export function marchGrid(cells,valueOf,{iso=.5,levels=null,cornerField=null,...options}={}){
  const field=cornerField??buildCornerField(cells,valueOf,options),list=levels??[iso];if(list.some(v=>!Number.isFinite(v)))throw new RangeError('Invalid contour level');
  const output=list.map(iso=>{
    const crossings=new Map(),segments=[],seen=new Set();
    const cross=(a,b)=>{const va=field.valueAt(a)-iso,vb=field.valueAt(b)-iso;if((va>0)===(vb>0))return null;
      const ka=field.key(a),kb=field.key(b),k=va===0?ka:vb===0?kb:'e:'+edgeKey(ka,kb);if(crossings.has(k))return crossings.get(k);
      // Always interpolate in canonical vertex order, independent of half-edge direction.
      const lo=ka<kb?a:b,hi=ka<kb?b:a,l=field.valueAt(lo),h=field.valueAt(hi),t=(iso-l)/(h-l);const p={key:k,x:lo.x+(hi.x-lo.x)*t,z:lo.z+(hi.z-lo.z)*t};crossings.set(k,p);return p;
    };
    const add=(a,b)=>{if(!a||!b||a.key===b.key)return;const k=edgeKey(a.key,b.key);if(seen.has(k))return;seen.add(k);segments.push({a,b});};
    for(const cell of [...cells].sort((a,b)=>a.id-b.id)){
      const p=cell.pts;if(p.length<3)throw new RangeError('Invalid polygon');
      if(p.length===4){const hit=p.map((a,i)=>cross(a,p[(i+1)%4])),present=hit.filter(Boolean);if(present.length===2)add(...present);else if(present.length===4){const v=p.map(q=>field.valueAt(q)-iso),q=v[0]*v[2]-v[1]*v[3];for(const [a,b]of(q>=0?[[0,1],[2,3]]:[[0,3],[1,2]]))add(hit[a],hit[b]);}}
      else for(let i=1;i<p.length-1;i++){const tri=[p[0],p[i],p[i+1]],hit=tri.map((a,j)=>cross(a,tri[(j+1)%3])).filter(Boolean);if(hit.length===2)add(...hit);}
    }
    const incident=new Map();segments.forEach((s,i)=>{for(const p of [s.a,s.b]){if(!incident.has(p.key))incident.set(p.key,[]);incident.get(p.key).push(i);}});
    const unused=new Set(segments.map((_,i)=>i)),paths=[];
    const walk=(start,first)=>{let p=start,index=first;const points=[p];while(unused.has(index)){unused.delete(index);const s=segments[index];p=s.a.key===p.key?s.b:s.a;points.push(p);const next=incident.get(p.key);if(p.key===start.key||next.length!==2)break;index=next.find(i=>unused.has(i));if(index===undefined)break;}paths.push({points,closed:points.at(-1).key===points[0].key});};
    // Preserve branches as separate paths rather than inventing a connection.
    for(const[k,ids]of incident)if(ids.length!==2)for(const i of ids)if(unused.has(i)){const s=segments[i];walk(s.a.key===k?s.a:s.b,i);}
    for(const i of unused){walk(segments[i].a,i);}
    return {iso,segments,segs:segments.map(s=>[s.a.x,s.a.z,s.b.x,s.b.z]),paths,openEndpoints:[...incident].filter(([,ids])=>ids.length===1).map(([k])=>k),branches:[...incident].filter(([,ids])=>ids.length>2).map(([k])=>k)};
  });return {field,levels:output,cornerCount:field.corners.size};
}
