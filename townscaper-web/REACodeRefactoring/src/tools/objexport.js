/** Export the shared World surface, not instanced vegetation, water or effects.
 * 1430224300003545091 shows OBJ export and a white model in another application.
 * RGB vertex values are an optional extension, not evidence of original material export.
 */
export function geometryToOBJ(geometry, { name='townscaper', precision=null }={}) {
  if(precision!==null&&(!Number.isInteger(precision)||precision<0||precision>10))throw new RangeError('OBJ precision');
  const pos=geometry?.getAttribute('position'),nor=geometry?.getAttribute('normal'),col=geometry?.getAttribute('color');
  if(!pos||pos.itemSize!==3)throw new Error('OBJ requires 3D positions');
  for(const [label,a] of [['position',pos],['normal',nor],['color',col]])if(a){
    if(a.itemSize!==3||a.count!==pos.count)throw new Error(`OBJ ${label} count mismatch`);
    for(let i=0;i<a.count;i++)if(![a.getX(i),a.getY(i),a.getZ(i)].every(Number.isFinite))throw new Error(`OBJ ${label} contains nonfinite values`);
  }
  const index=geometry.getIndex(),count=index?index.count:pos.count;
  if(count%3)throw new Error('OBJ incomplete triangle');
  if(index)for(let i=0;i<count;i++){const n=index.getX(i);if(!Number.isInteger(n)||n<0||n>=pos.count)throw new Error('OBJ index out of range');}
  // Exact values by default: rounding must not silently collapse small valid triangles.
  const q=x=>precision===null?x:Math.round(x*10**precision)/10**precision;
  const map=new Map(),v=[],vn=[],f=[];let droppedFaces=0;
  const id=i=>{
    const values=[q(pos.getX(i)),q(pos.getY(i)),q(pos.getZ(i)),...(nor?[q(nor.getX(i)),q(nor.getY(i)),q(nor.getZ(i))]:[]),...(col?[q(col.getX(i)),q(col.getY(i)),q(col.getZ(i))]:[])];
    const key=values.join(',');let k=map.get(key);
    if(k===undefined){k=map.size+1;map.set(key,k);v.push(`v ${values.slice(0,3).join(' ')}${col?' '+values.slice(nor?6:3).join(' '):''}`);if(nor)vn.push(`vn ${values.slice(3,6).join(' ')}`);}
    return k;
  };
  for(let t=0;t<count;t+=3){const ids=[0,1,2].map(k=>id(index?index.getX(t+k):t+k));if(new Set(ids).size<3){droppedFaces++;continue;}f.push('f '+ids.map(i=>nor?`${i}//${i}`:String(i)).join(' '));}
  const safeName=String(name).replace(/[\r\n\s#]+/g,'_')||'townscaper';
  const text=`# REACodeRefactoring shared World surface; optional RGB values in source color space\no ${safeName}\n${v.join('\n')}\n${vn.join('\n')}\n${f.join('\n')}\n`;
  return {text,vertices:v.length,faces:f.length,sourceVerts:pos.count,sourceFaces:count/3,droppedFaces,precision};
}
export function downloadOBJ(geometry,filename='town.obj') {
  const r=geometry?geometryToOBJ(geometry):null;if(!r)return null;
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([r.text],{type:'text/plain'}));a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);return r;
}
