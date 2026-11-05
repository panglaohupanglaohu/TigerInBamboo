/** Sphere-union surface nets plus seam springs. Inspired by 1580162341668237312;
 * surface nets is our extraction choice, not the author's stated Marching Cubes.
 */
const EDGES=[[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
function normals(vertices,triangles){const out=vertices.map(()=>[0,0,0]);for(const[a,b,c]of triangles){const n=cross(sub(vertices[b],vertices[a]),sub(vertices[c],vertices[a]));for(const id of [a,b,c])for(let k=0;k<3;k++)out[id][k]+=n[k]}return out.map(n=>{const l=Math.hypot(...n)||1;return n.map(v=>v/l)})}
export function buildCanopy(blobs,{resolution=14,passes=6,hardStiff=.15,softStiff=.3}={}){
 if(!Array.isArray(blobs)||!blobs.length||blobs.length>32||blobs.some(b=>![b.x,b.y,b.z,b.r].every(Number.isFinite)||b.r<=0)||!Number.isInteger(resolution)||resolution<6||resolution>48||!Number.isInteger(passes)||passes<0||passes>30||![hardStiff,softStiff].every(v=>Number.isFinite(v)&&v>=0&&v<=.5))throw new RangeError('Invalid canopy input');
 const nearest=p=>{let id=0,best=Infinity;blobs.forEach((b,i)=>{const d=Math.hypot(p[0]-b.x,p[1]-b.y,p[2]-b.z)-b.r;if(d<best){best=d;id=i}});return id};
 const field=p=>Math.max(...blobs.map(b=>b.r-Math.hypot(p[0]-b.x,p[1]-b.y,p[2]-b.z)));
 const lo=[0,1,2].map(k=>Math.min(...blobs.map(b=>[b.x,b.y,b.z][k]-b.r))),hi=[0,1,2].map(k=>Math.max(...blobs.map(b=>[b.x,b.y,b.z][k]+b.r)));
 const size=Math.max(...hi.map((v,k)=>v-lo[k]))*1.254,step=size/resolution,min=lo.map((v,k)=>(v+hi[k]-size)/2),n=resolution+1;
 const at=(x,y,z)=>(z*n+y)*n+x,grid=new Float64Array(n*n*n),point=(x,y,z)=>[min[0]+x*step,min[1]+y*step,min[2]+z*step];
 for(let z=0;z<n;z++)for(let y=0;y<n;y++)for(let x=0;x<n;x++)grid[at(x,y,z)]=field(point(x,y,z));
 const vertices=[],cube=new Map(),key=(x,y,z)=>`${x},${y},${z}`;
 for(let z=0;z<resolution;z++)for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){
  const values=Array.from({length:8},(_,b)=>grid[at(x+(b&1),y+((b>>1)&1),z+((b>>2)&1))]);if(values.every(v=>v>0)||values.every(v=>v<=0))continue;
  const sum=[0,0,0];let count=0;
  for(const[a,b]of EDGES){if((values[a]>0)===(values[b]>0))continue;const t=values[a]/(values[a]-values[b]);for(let k=0;k<3;k++)sum[k]+=[x,y,z][k]+((a>>k)&1)+(((b>>k)&1)-((a>>k)&1))*t;count++}
  cube.set(key(x,y,z),vertices.length);vertices.push(point(...sum.map(v=>v/count)));
 }
 const triangles=[],get=(x,y,z)=>cube.get(key(x,y,z));
 const quad=(ids,flip)=>{if(ids.some(id=>id===undefined))return;const[a,b,c,d]=ids;if(!flip)triangles.push([a,b,c],[a,c,d]);else triangles.push([a,d,c],[a,c,b])};
 for(let z=0;z<resolution;z++)for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){
  const value=grid[at(x,y,z)]>0;
  if(y>0&&z>0&&value!==(grid[at(x+1,y,z)]>0))quad([get(x,y-1,z-1),get(x,y,z-1),get(x,y,z),get(x,y-1,z)],!value);
  if(x>0&&z>0&&value!==(grid[at(x,y+1,z)]>0))quad([get(x,y,z-1),get(x,y,z),get(x-1,y,z),get(x-1,y,z-1)],value);
  if(x>0&&y>0&&value!==(grid[at(x,y,z+1)]>0))quad([get(x,y-1,z),get(x,y,z),get(x-1,y,z),get(x-1,y-1,z)],!value);
 }
 // Face labels, not endpoint labels: seams separate triangles nearest different spheres.
 const labels=triangles.map(t=>nearest([0,1,2].map(k=>t.reduce((s,id)=>s+vertices[id][k],0)/3))),edges=new Map();
 triangles.forEach((t,face)=>{for(let k=0;k<3;k++){const a=t[k],b=t[(k+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`;let e=edges.get(key);if(!e)edges.set(key,e={a,b,faces:[],orientation:0});e.faces.push(face);e.orientation+=a<b?1:-1}});
 if(!triangles.length||[...edges.values()].some(e=>e.faces.length!==2||e.orientation!==0))throw new Error('Canopy extraction is not a closed oriented manifold');
 // Edge counts alone miss a pinched vertex with two disconnected face fans.
 const links=vertices.map(()=>new Map());
 for(const t of triangles)for(let k=0;k<3;k++){const map=links[t[k]],a=t[(k+1)%3],b=t[(k+2)%3];if(!map.has(a))map.set(a,new Set());if(!map.has(b))map.set(b,new Set());map.get(a).add(b);map.get(b).add(a)}
 for(const link of links){if(!link.size)throw new Error('Unused canopy vertex');const seen=new Set(),stack=[link.keys().next().value];while(stack.length){const id=stack.pop();if(seen.has(id))continue;seen.add(id);stack.push(...link.get(id))}if(seen.size!==link.size||[...link.values()].some(n=>n.size!==2))throw new Error('Canopy vertex link is not a manifold cycle')}
 const adjacency=vertices.map(()=>[]),hard=vertices.map(()=>[]),hardEdges=[];
 for(const e of edges.values()){adjacency[e.a].push(e.b);adjacency[e.b].push(e.a);if(labels[e.faces[0]]!==labels[e.faces[1]]){hard[e.a].push(e.b);hard[e.b].push(e.a);hardEdges.push([e.a,e.b])}}
 const meanHard=v=>hardEdges.reduce((s,[a,b])=>s+Math.hypot(...sub(v[a],v[b])),0)/(hardEdges.length||1),hardBefore=meanHard(vertices);
 let positions=vertices;
 for(let pass=0;pass<passes;pass++){
  const ns=normals(positions,triangles);
  positions=positions.map((p,i)=>{const neighbors=adjacency[i],seam=hard[i];if(!neighbors.length)return p.slice();const mean=[0,1,2].map(k=>neighbors.reduce((s,j)=>s+positions[j][k],0)/neighbors.length);return p.map((v,k)=>{let next=v+(mean[k]-v)*(seam.length?.08:softStiff);if(seam.length)next+=(seam.reduce((s,j)=>s+positions[j][k],0)/seam.length-v)*hardStiff;else next+=ns[i][k]*step*.03;return next})});
 }
 for(const[a,b,c]of triangles){const original=cross(sub(vertices[b],vertices[a]),sub(vertices[c],vertices[a])),relaxed=cross(sub(positions[b],positions[a]),sub(positions[c],positions[a]));if(Math.hypot(...relaxed)<=step*step*1e-8||original.reduce((sum,v,k)=>sum+v*relaxed[k],0)<=0)throw new Error('Canopy relaxation folded a triangle')}
 return {positions,triangles,normals:normals(positions,triangles),hardEdges,stats:{vertices:positions.length,triangles:triangles.length,hardEdges:hardEdges.length,hardBefore,hardAfter:meanHard(positions),resolution,passes,closed:true,extraction:'surface-nets'}};
}
