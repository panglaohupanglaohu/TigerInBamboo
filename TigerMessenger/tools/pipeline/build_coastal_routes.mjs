// Conservative sea-route proposal over the actual candidate GLB triangle topology.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,root)));
const layout=await read('godot/data/world-layout-v2.json');
const bytes=await readFile(new URL('godot/assets/terrain/world-terrain-v3.glb',root));
const jlen=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+jlen)),bin=20+jlen+8;
function values(i){const a=g.accessors[i],v=g.bufferViews[a.bufferView],n=a.count*(a.type==='VEC3'?3:1),out=[];for(let k=0;k<n;k++)out.push(bytes[a.componentType===5125?'readUInt32LE':'readFloatLE'](bin+(v.byteOffset||0)+(a.byteOffset||0)+k*4));return out}
const ps=values(0),idx=values(3),R=layout.radius,N=ps.length/3,dirs=[],height=[];
for(let i=0;i<N;i++){const p=ps.slice(i*3,i*3+3),r=Math.hypot(...p);dirs.push(p.map(x=>x/r));height.push(r-R)}
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),angle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,dot(a,b))));
// Keep only edges belonging to fully submerged triangles with 0.1 unit clearance.
// This is centerline clearance against this mesh, not a ship-width/depth certification.
const graph=Array.from({length:N},()=>new Set());
for(let i=0;i<idx.length;i+=3){const f=idx.slice(i,i+3);if(f.every(v=>height[v]<-.1))for(let j=0;j<3;j++){graph[f[j]].add(f[(j+1)%3]);graph[f[(j+1)%3]].add(f[j])}}
// Restrict endpoints to the main ocean component, excluding disconnected inland lakes.
const seen=new Set(),components=[];for(let i=0;i<N;i++){if(seen.has(i)||!graph[i].size)continue;const q=[i];seen.add(i);for(let k=0;k<q.length;k++)for(const n of graph[q[k]])if(!seen.has(n)){seen.add(n);q.push(n)}components.push(q)}
components.sort((a,b)=>b.length-a.length);const ocean=components[0];if(!ocean)throw Error('No ocean graph');
const endpointIds=new Set(layout.routes.filter(r=>r.mode==='sea').flatMap(r=>[r.from,r.to]));
const ports={};for(const region of layout.regions.filter(r=>endpointIds.has(r.id))){const lat=region.targetLat*Math.PI/180,lon=region.targetLon*Math.PI/180,d=[Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon)];let best=ocean[0];for(const v of ocean)if(dot(d,dirs[v])>dot(d,dirs[best]))best=v;ports[region.id]={vertex:best,direction:dirs[best],accessDistance:R*angle(d,dirs[best]),accessStatus:'unbuilt-region-to-shore-connection',position:dirs[best].map(x=>x*(R+2))}}
function path(start,end){const cost=new Float64Array(N).fill(Infinity),parent=new Int32Array(N).fill(-1),closed=new Set(),open=new Set([start]);cost[start]=0;while(open.size){let v=-1,b=Infinity;for(const n of open){const f=cost[n]+R*angle(dirs[n],dirs[end]);if(f<b){v=n;b=f}}if(v===end){const out=[];for(let n=end;n!==-1;n=parent[n])out.push(n);return out.reverse()}open.delete(v);closed.add(v);for(const n of graph[v]){if(closed.has(n))continue;const c=cost[v]+R*angle(dirs[v],dirs[n]);if(c<cost[n]){cost[n]=c;parent[n]=v;open.add(n)}}}return null}
const routes={};for(const r of layout.routes.filter(r=>r.mode==='sea')){const ids=path(ports[r.from].vertex,ports[r.to].vertex);if(!ids)throw Error('Disconnected '+r.id);routes[r.id]={from:r.from,to:r.to,mode:r.mode,vertexIds:ids,points:ids.map(v=>({position:dirs[v].map(x=>x*(R+2)),height:height[v]})),length:ids.slice(1).reduce((s,v,i)=>s+R*angle(dirs[v],dirs[ids[i]]),0),certifiedPlayable:false};for(let i=1;i<ids.length;i++)if(!graph[ids[i-1]].has(ids[i]))throw Error('Invalid edge')}
const report={version:1,status:'coastal-route-proposal',terrainSHA256:createHash('sha256').update(bytes).digest('hex'),scope:'Sea centerlines on submerged candidate triangles. Region access legs, ship dimensions, collision, currents and gameplay are not validated.',oceanVertices:ocean.length,disconnectedWaterComponents:components.length-1,ports,routes};
await writeFile(new URL('godot/data/world-coastal-routes-v1.json',root),JSON.stringify(report));
await writeFile(new URL('artifacts/world-terrain/coastal-routes.json',root),JSON.stringify({...report,routes:Object.fromEntries(Object.entries(routes).map(([k,v])=>[k,{vertices:v.vertexIds.length,length:v.length,certifiedPlayable:false}]))},null,2));
console.log(JSON.stringify({routes:Object.keys(routes).length,ports:Object.fromEntries(Object.entries(ports).map(([k,v])=>[k,v.accessDistance])),oceanVertices:ocean.length}));
