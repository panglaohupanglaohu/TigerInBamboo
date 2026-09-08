import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url),data=JSON.parse(await readFile(new URL('godot/data/world-coastal-routes-v1.json',root))),b=await readFile(new URL('godot/assets/terrain/world-terrain-v3.glb',root));
const jl=b.readUInt32LE(12),g=JSON.parse(b.subarray(20,20+jl)),offset=28+jl;
function accessor(i){const a=g.accessors[i],v=g.bufferViews[a.bufferView],n=a.count*(a.type==='VEC3'?3:1);return Array.from({length:n},(_,k)=>b[a.componentType===5125?'readUInt32LE':'readFloatLE'](offset+(v.byteOffset||0)+(a.byteOffset||0)+k*4))}
const p=accessor(0),idx=accessor(3),edges=new Set(),h=Array.from({length:p.length/3},(_,i)=>Math.hypot(...p.slice(i*3,i*3+3))-160);
for(let i=0;i<idx.length;i+=3){const f=idx.slice(i,i+3);if(f.every(v=>h[v]<-.1))for(let j=0;j<3;j++)edges.add([f[j],f[(j+1)%3]].sort((a,b)=>a-b).join(':'))}
const failures=[];let testedEdges=0;function check(v,s){if(!v)failures.push(s)}
check(data.terrainSHA256===createHash('sha256').update(b).digest('hex'),'source GLB hash');
for(const [id,r] of Object.entries(data.routes)){
 check(r.vertexIds[0]===data.ports[r.from].vertex&&r.vertexIds.at(-1)===data.ports[r.to].vertex,id+' endpoints');
 check(r.certifiedPlayable===false,id+' scope');
 for(let i=1;i<r.vertexIds.length;i++){testedEdges++;check(edges.has([r.vertexIds[i-1],r.vertexIds[i]].sort((a,b)=>a-b).join(':')),id+' submerged edge '+i)}
 for(let i=0;i<r.vertexIds.length;i++){const n=r.vertexIds[i],expected=p.slice(n*3,n*3+3),len=Math.hypot(...expected);check(r.points[i].position.every((x,k)=>Math.abs(x-expected[k]/len*162)<1e-7),id+' vertex '+i)}
}
check(Object.keys(data.routes).length===10,'route coverage');
const report={passed:!failures.length,failures,testedEdges,routes:Object.keys(data.routes).length,scope:'Independent GLB topology validation; no vessel or regional access certification'};
await writeFile(new URL('artifacts/world-terrain/coastal-validation.json',root),JSON.stringify(report,null,2));console.log(report);if(failures.length)process.exitCode=1;
