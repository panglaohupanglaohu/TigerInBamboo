// Candidate terrain: reuse original geodesic topology and authored scalar profiles.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {buildGeodesicMainAndDualGrid} from '../../src/procgen/planet/geodesicGrid.js';
import {classifyProfileField} from '../../src/procgen/planet/planetFieldComposer.js';
const root=new URL('../../',import.meta.url);
const layout=JSON.parse(await readFile(new URL('godot/data/world-layout-v2.json',root)));
const R=layout.radius, rad=Math.PI/180;
const norm=v=>{const l=Math.hypot(...v);return v.map(x=>x/l)};
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const unit=(lat,lon)=>[Math.cos(lat*rad)*Math.cos(lon*rad),Math.sin(lat*rad),Math.cos(lat*rad)*Math.sin(lon*rad)];
const mapping={'coast-civil':'bookshop-auckland-hills','highland-sanctum':'highland-snow-massif','old-harbor':'coastal-harbor-citadel','saihoji':'saihoji-plain','abandoned-gate':'triple-gate-highland','crystal-city':'crystal-rift-canyon','moebius-swamp':'swamp-rift-lake'};
const landmarks=layout.regions.filter(r=>mapping[r.id]).map(r=>({id:r.id,direction:unit(r.targetLat,r.targetLon),forward:unit(0,r.targetLon+90),angularRadius:r.angularRadius*rad,profile:mapping[r.id]}));
// Continental support and local relief remain separate. Broad support is a
// proposal, not a command to enlarge/crop any original region's mesh.
const shoulders=landmarks.map(l=>({...l,profile:'coastal-harbor-citadel',angularRadius:Math.min(40,l.angularRadius/rad*1.8+10)*rad}));
const smooth=(a,b,x)=>{let t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
function sample(d){
 const broad=classifyProfileField(d,{landmarks:shoulders});
 const detail=classifyProfileField(d,{landmarks});
 let support=broad.height;
 // Preserve a narrow shore band and real water channels between landmasses.
 support-=0.10;
 let h=support;
 if(detail.height>-2.39) h=Math.max(support,detail.height);
 if(detail.lake>0) h=support*(1-detail.lake)+Math.min(-0.3,support)*detail.lake;
 // Original canyon subtraction remains visible inside its continental support.
 if(detail.canyon>0) h-=detail.canyon*1.1;
 // Separate shoreline surfaces by a visible tolerance; tiny positive legacy
 // profile tails otherwise coincide with the water shell at float precision.
 if (h > 0) h = Math.max(0.12, h); else h = Math.min(-0.12, h);
 return {...detail,height:h};
}
const base=buildGeodesicMainAndDualGrid({radius:1,subdivision:5,seed:20260909});
let verts=base.main.positions.map(norm), faces=base.main.faces.map(f=>f.slice());
for(let pass=0;pass<3;pass++){
 const edges=new Map(),next=[];
 const midpoint=(a,b)=>{let k=[a,b].sort((x,y)=>x-y).join(':');if(!edges.has(k)){edges.set(k,verts.length);verts.push(norm(verts[a].map((x,i)=>x+verts[b][i])))}return edges.get(k)};
 for(const [a,b,c] of faces){const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);next.push([a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca])} faces=next;
}
const samples=verts.map(sample), positions=verts.map((d,i)=>d.map(x=>x*(R+samples[i].height)));
const color=s=>s.height<0?[.08,.23,.29]:s.height>5.2?[.79,.87,.87]:s.height>2.4?[.37,.43,.40]:s.canyon>.1?[.36,.47,.51]:s.mossness>.2?[.22,.39,.27]:[.31,.46,.34];
const colors=samples.map(color), normals=verts.map(()=>[0,0,0]);
let inward=0;const edgeCounts=new Map();
for(const f of faces){let [a,b,c]=f;const u=positions[b].map((v,i)=>v-positions[a][i]),v=positions[c].map((v,i)=>v-positions[a][i]);let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 if(dot(n,positions[a])<0){[f[1],f[2]]=[f[2],f[1]];n=n.map(x=>-x);inward++}
 for(const id of f)for(let j=0;j<3;j++)normals[id][j]+=n[j];
 for(let j=0;j<3;j++){const k=[f[j],f[(j+1)%3]].sort((a,b)=>a-b).join(':');edgeCounts.set(k,(edgeCounts.get(k)||0)+1)}
}
const arrays=[new Float32Array(positions.flat()),new Float32Array(normals.map(norm).flat()),new Float32Array(colors.flat()),new Uint32Array(faces.flat())];
let offset=0;const views=arrays.map(a=>{const v={buffer:0,byteOffset:offset,byteLength:a.byteLength};offset+=a.byteLength;return v});
const gltf={asset:{version:'2.0',generator:'TigerMessenger original-profile global terrain candidate'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:'WorldTerrainCandidate',mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1,COLOR_0:2},indices:3,material:0}]}],materials:[{name:'OriginalTerrainPalette',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:1}}],buffers:[{byteLength:offset}],bufferViews:views,accessors:[{bufferView:0,componentType:5126,count:verts.length,type:'VEC3',min:[0,1,2].map(i=>Math.min(...positions.map(v=>v[i]))),max:[0,1,2].map(i=>Math.max(...positions.map(v=>v[i])))},{bufferView:1,componentType:5126,count:verts.length,type:'VEC3'},{bufferView:2,componentType:5126,count:verts.length,type:'VEC3'},{bufferView:3,componentType:5125,count:faces.length*3,type:'SCALAR'}]};
let j=Buffer.from(JSON.stringify(gltf));j=Buffer.concat([j,Buffer.alloc((4-j.length%4)%4,32)]);const bin=Buffer.concat(arrays.map(a=>Buffer.from(a.buffer)));const head=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);head.writeUInt32LE(0x46546c67);head.writeUInt32LE(2,4);head.writeUInt32LE(12+8+j.length+8+bin.length,8);jh.writeUInt32LE(j.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);
const glb=Buffer.concat([head,jh,j,bh,bin]);
const routeSamples={};
for(const route of layout.routes.filter(r=>!r.dynamic&&r.from!==r.to)){
 const a=layout.regions.find(r=>r.id===route.from),b=layout.regions.find(r=>r.id===route.to),u=unit(a.targetLat,a.targetLon),v=unit(b.targetLat,b.targetLon),angle=Math.acos(Math.max(-1,Math.min(1,dot(u,v))));
 const points=Array.from({length:97},(_,i)=>{const t=i/96;const d=norm(u.map((x,j)=>x*Math.sin((1-t)*angle)+v[j]*Math.sin(t*angle)));const h=sample(d).height;return {direction:d,height:h,position:d.map(x=>x*(R+Math.max(0,h)+2))}});
 routeSamples[route.id]={points,landFraction:points.filter(p=>p.height>0).length/points.length,mode:route.mode,certifiedWalkable:false};
}
const latBands=[[-90,-45],[-45,0],[0,45],[45,90]].map(([min,max])=>{const selected=samples.filter((s,i)=>{const lat=Math.asin(verts[i][1])/rad;return lat>=min&&lat<max});return {min,max,landFraction:selected.filter(s=>s.height>0).length/selected.length}});
const report={version:3,status:'terrain-candidate-not-world-deployed',scope:'Original scalar-profile terrain proposal on whole geodesic globe. No WFC solve or original building/transport relocation in this batch.',radius:R,vertices:verts.length,triangles:faces.length,closedManifold:[...edgeCounts.values()].every(n=>n===2),euler:verts.length-edgeCounts.size+faces.length,reorientedFaces:inward,landFraction:samples.filter(s=>s.height>0).length/samples.length,latitudeBands:latBands,heightRange:[Math.min(...samples.map(s=>s.height)),Math.max(...samples.map(s=>s.height))],regionalHeights:Object.fromEntries(layout.regions.map(r=>[r.id,sample(unit(r.targetLat,r.targetLon)).height])),profileMapping:mapping,continentalSupport:'coastal-harbor-citadel profile, angularRadius=min(40, planningRadius*1.8+10) degrees; proposed footprint independent of original geometry',routes:routeSamples,sha256:createHash('sha256').update(glb).digest('hex')};
await mkdir(new URL('godot/assets/terrain/',root),{recursive:true});await mkdir(new URL('artifacts/world-terrain/',root),{recursive:true});
await writeFile(new URL('godot/assets/terrain/world-terrain-v3.glb',root),glb);
await writeFile(new URL('godot/data/world-terrain-v3.json',root),JSON.stringify(report));
await writeFile(new URL('artifacts/world-terrain/generation.json',root),JSON.stringify({...report,routes:Object.fromEntries(Object.entries(routeSamples).map(([k,v])=>[k,{mode:v.mode,landFraction:v.landFraction,certifiedWalkable:false}]))},null,2));
if(!report.closedManifold||report.euler!==2)throw Error('Terrain topology failed');
console.log(JSON.stringify({vertices:report.vertices,triangles:report.triangles,landFraction:report.landFraction,heightRange:report.heightRange,routes:Object.fromEntries(Object.entries(routeSamples).map(([k,v])=>[k,{mode:v.mode,landFraction:v.landFraction}]))},null,2));
