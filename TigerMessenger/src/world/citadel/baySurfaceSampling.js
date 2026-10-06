import * as THREE from 'three';
const expected=[
 [4536,[[46.162628,16.689383,-19.189556],[48.308208,21.213041,-19.253059],[46.135860,16.982819,-16.775738]]],
 [4317,[[45.680698,16.572815,-21.164162],[48.308208,21.213041,-19.253059],[46.162628,16.689383,-19.189556]]],
 [4097,[[47.807693,20.879984,-22.791864],[47.897247,21.130898,-20.858311],[45.680698,16.572815,-21.164162]]],
];
// Only the verified unmodified top-grid patch. Skip rather than guess when a
// preceding author edit changes geometry or top/skirt identity.
export function sampleBaySurfacePatch(source){
 const p=source.attributes.position,idx=source.index,shore=source.attributes.shoreBoundaryBottom;
 const skipped=reason=>({geometry:source,audit:{enabled:true,applied:false,reason}});
 if(!idx||!shore)return skipped('indexed source with shore semantic required');
 const ids=f=>[0,1,2].map(j=>idx.getX(f*3+j));
 for(const [f,positions]of expected){if(f*3+2>=idx.count)return skipped('source face missing');const vi=ids(f);for(let j=0;j<3;j++){if(shore.getX(vi[j])!==0)return skipped('expected bare top shore signature mismatch');for(let k=0;k<3;k++)if(Math.abs(p.array[vi[j]*3+k]-positions[j][k])>2e-5)return skipped('source position signature mismatch');}}
 const n=16,selected=new Set(expected.map(e=>e[0])),edgeKey=(a,b)=>a<b?`${a},${b}`:`${b},${a}`,edgeSamples=new Map(),attributes=Object.entries(source.attributes),values=Object.fromEntries(attributes.map(([name,a])=>[name,Array.from(a.array)]));
 const append=(vi,weights)=>{const id=values.position.length/3;for(const [name,a]of attributes)for(let k=0;k<a.itemSize;k++)values[name].push(vi.reduce((s,v,j)=>s+a.array[v*a.itemSize+k]*weights[j],0));return id;};
 for(const f of selected){const v=ids(f);for(let j=0;j<3;j++){let a=v[j],b=v[(j+1)%3];if(a>b)[a,b]=[b,a];const key=edgeKey(a,b);if(!edgeSamples.has(key)){const row=[a];for(let k=1;k<n;k++)row.push(append([a,b],[1-k/n,k/n]));row.push(b);edgeSamples.set(key,row);}}}
 const edge=(a,b)=>{const row=edgeSamples.get(edgeKey(a,b));return a<b?row:[...row].reverse();};
 const out=[],affected=[];let transitions=0;
 for(let f=0;f<idx.count/3;f++){const v=ids(f),start=out.length/3;
  if(selected.has(f)){
   const cache=new Map();const at=(i,j)=>{if(i===0&&j===0)return v[0];if(j===0)return edge(v[0],v[1])[i];if(i===0)return edge(v[0],v[2])[j];if(i+j===n)return edge(v[1],v[2])[j];const key=`${i},${j}`;if(!cache.has(key))cache.set(key,append(v,[1-(i+j)/n,i/n,j/n]));return cache.get(key);};
   for(let j=0;j<n;j++)for(let i=0;i<n-j;i++){out.push(at(i,j),at(i+1,j),at(i,j+1));if(i+j<n-1)out.push(at(i+1,j),at(i+1,j+1),at(i,j+1));}
  }else if([0,1,2].some(j=>edgeSamples.has(edgeKey(v[j],v[(j+1)%3])))){
   transitions++;const boundary=[];for(let j=0;j<3;j++){const a=v[j],b=v[(j+1)%3];if(edgeSamples.has(edgeKey(a,b)))boundary.push(...edge(a,b).slice(0,-1));else boundary.push(a);}
   const center=append(v,[1/3,1/3,1/3]);for(let j=0;j<boundary.length;j++)out.push(center,boundary[j],boundary[(j+1)%boundary.length]);
  }else out.push(...v);
  if(out.length/3-start!==1)affected.push({sourceFace:f,start,end:out.length/3});
 }
 const geometry=new THREE.BufferGeometry();for(const [name,a]of attributes)geometry.setAttribute(name,new THREE.BufferAttribute(new a.array.constructor(values[name]),a.itemSize,a.normalized));geometry.setIndex(out);geometry.userData={...source.userData};
 const audit={enabled:true,applied:true,method:'verified three original top faces, 16-way barycentric sampling before nonlinear bay mapping; shared-edge transition fans',sourceFaces:expected.map(x=>x[0]),sourceTriangles:idx.count/3,triangles:out.length/3,addedTriangles:(out.length-idx.count)/3,originalVertices:p.count,vertices:geometry.attributes.position.count,transitionFaces:transitions,affected,globalInjectivityProved:false,unchangedOriginalAttributes:true};geometry.userData.baySurfaceSampling=audit;
 return {geometry,audit};
}
