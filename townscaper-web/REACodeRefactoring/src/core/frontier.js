/** 1097458505315946496: triangulate with padding → walk triangle edges →
 * Bezier sample → tessellate both sides. This implements the first three
 * stages as an edge-midpoint graph. Exact source routing is unknown; the
 * fourth stage (fields) is not implemented. Output is the rendered polyline.
 */
import { TriGraph } from './trigraph.js';
const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function frontierClearance(a,b,nodes) {
  const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;
  let best=Infinity;
  for(const n of nodes){const t=l2?Math.max(0,Math.min(1,((n.x-a.x)*dx+(n.y-a.y)*dy)/l2)):0;best=Math.min(best,Math.hypot(a.x+t*dx-n.x,a.y+t*dy-n.y)-n.r)}
  return best;
}
function crosses(path) {
  const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const on=(a,b,p)=>Math.abs(cross(a,b,p))<1e-9&&p.x>=Math.min(a.x,b.x)-1e-9&&p.x<=Math.max(a.x,b.x)+1e-9&&p.y>=Math.min(a.y,b.y)-1e-9&&p.y<=Math.max(a.y,b.y)+1e-9;
  for(let i=1;i<path.length;i++)for(let j=i+2;j<path.length;j++){
    const a=path[i-1],b=path[i],c=path[j-1],d=path[j];
    if(distance(a,b)<1e-10||distance(c,d)<1e-10)continue;
    if((cross(a,b,c)*cross(a,b,d)<-1e-12&&cross(c,d,a)*cross(c,d,b)<-1e-12)||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b))return true;
  }
  return false;
}
export function sampleFrontierBezier(polyline,nodes,{clearance=.02,roundness=.25,samples=8}={}) {
  if(!Array.isArray(polyline)||polyline.length<2||polyline.length>4096||polyline.some(p=>!p||![p.x,p.y].every(Number.isFinite))||!Array.isArray(nodes)||nodes.length>512||nodes.some(n=>!n||![n.x,n.y,n.r].every(Number.isFinite)||n.r<=0)||!Number.isFinite(clearance)||clearance<0||!Number.isFinite(roundness)||roundness<0||roundness>.45||!Number.isInteger(samples)||samples<2||samples>32)throw new RangeError('invalid Bezier sampling input');
  if(crosses(polyline)||polyline.slice(1).some((p,i)=>frontierClearance(polyline[i],p,nodes)<clearance-1e-9))throw new RangeError('unsafe input polyline');
  if(roundness===0)return{path:polyline.map(p=>({...p})),corners:[],fallback:false};
  const path=[polyline[0]],corners=[];
  for(let i=1;i<polyline.length-1;i++){
    const prev=polyline[i-1],p=polyline[i],next=polyline[i+1];let accepted=null;
    for(let attempt=0;attempt<8;attempt++){
      const t=roundness/(2**attempt),a=mix(p,prev,t),b=mix(p,next,t),candidate=[a];
      for(let k=1;k<=samples;k++){const u=k/samples,v=1-u;candidate.push({x:v*v*a.x+2*v*u*p.x+u*u*b.x,y:v*v*a.y+2*v*u*p.y+u*u*b.y})}
      const connected=[path.at(-1),...candidate];
      if(connected.slice(1).every((q,k)=>frontierClearance(connected[k],q,nodes)>=clearance-1e-9)){accepted=candidate;corners.push({index:i,fraction:t});break}
    }
    path.push(...(accepted??[p]));
  }
  path.push(polyline.at(-1));
  return crosses(path)?{path:polyline.map(p=>({...p})),corners:[],fallback:true}:{path,corners,fallback:false};
}
export function buildFrontier(nodes,{position=0,padding=1,clearance=.02,roundness=.25,maxVisits=10000}={}) {
  if(!Array.isArray(nodes)||nodes.length<2||nodes.length>512||nodes.some(n=>!n||![n.x,n.y,n.r].every(Number.isFinite)||n.r<=0||n.r>1e4||Math.abs(n.x)>1e6||Math.abs(n.y)>1e6)||
    ![position,padding,clearance,roundness].every(Number.isFinite)||padding<=0||padding>1e4||clearance<0||clearance>=padding||roundness<0||roundness>.45||!Number.isInteger(maxVisits)||maxVisits<0||maxVisits>20000)throw new RangeError('invalid frontier input');
  const minX=Math.min(...nodes.map(n=>n.x-n.r))-padding,maxX=Math.max(...nodes.map(n=>n.x+n.r))+padding,minY=Math.min(...nodes.map(n=>n.y-n.r))-padding,maxY=Math.max(...nodes.map(n=>n.y+n.r))+padding;
  if(position<=minY||position>=maxY)throw new RangeError('frontier step outside padded bounds');
  const midX=(minX+maxX)/2,midY=(minY+maxY)/2,points=nodes.map(n=>({x:n.x,y:n.y}));
  points.push(...[[minX,minY],[midX,minY],[maxX,minY],[maxX,midY],[maxX,maxY],[midX,maxY],[minX,maxY],[minX,midY]].map(([x,y])=>({x,y})));
  const t=new TriGraph(Math.max(1,...points.flatMap(p=>[Math.abs(p.x),Math.abs(p.y)]))*8);for(const p of points)t.add(p.x,p.y);
  const triangles=t.triangles(),edges=[],index=new Map(),adj=[];
  const edge=(a,b)=>{const key=Math.min(a,b)+':'+Math.max(a,b);if(index.has(key))return index.get(key);const id=edges.length;index.set(key,id);edges.push({id,a,b,...mix(points[a],points[b],.5)});adj.push(new Set());return id};
  for(const triangle of triangles){const ids=triangle.map((a,k)=>edge(a,triangle[(k+1)%3]));for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){adj[ids[i]].add(ids[j]);adj[ids[j]].add(ids[i])}}
  const from={x:minX,y:position},to={x:maxX,y:position},start=edges.length,end=start+1,vertices=[...edges,from,to],graph=vertices.map(()=>[]);
  const safe=(a,b)=>frontierClearance(a,b,nodes)>=clearance-1e-9;
  for(let i=0;i<edges.length;i++)for(const j of adj[i])if(j>i&&safe(edges[i],edges[j])){graph[i].push(j);graph[j].push(i)}
  for(const [id,p]of [[start,from],[end,to]])for(const e of [...edges].sort((a,b)=>distance(a,p)-distance(b,p)||a.id-b.id).filter(e=>safe(e,p)).slice(0,8)){graph[id].push(e.id);graph[e.id].push(id)}
  const costs=new Float64Array(vertices.length).fill(Infinity),parent=new Int32Array(vertices.length).fill(-1),open=new Set([start]),closed=new Set();costs[start]=0;let visited=0;
  while(open.size&&visited<maxVisits){let cur=-1;for(const i of open)if(cur<0||costs[i]<costs[cur])cur=i;open.delete(cur);closed.add(cur);visited++;if(cur===end)break;
    for(const j of graph[cur]){if(closed.has(j))continue;const a=vertices[cur],b=vertices[j],cost=costs[cur]+distance(a,b)*(1+.7*Math.abs((a.y+b.y)/2-position));if(cost<costs[j]){costs[j]=cost;parent[j]=cur;open.add(j)}}}
  const base={points,triangles,edges,from,to,visited,clearance};
  if(!closed.has(end))return{...base,ok:false,reason:open.size?'budget':'blocked',polyline:[],path:[],edgePath:[]};
  const ids=[];for(let i=end;i!==-1;i=parent[i])ids.push(i);ids.reverse();const polyline=ids.map(i=>({x:vertices[i].x,y:vertices[i].y}));
  if(crosses(polyline))return{...base,ok:false,reason:'self-intersection',polyline:[],path:[],edgePath:[]};
  const rounded=sampleFrontierBezier(polyline,nodes,{clearance,roundness});
  return{...base,ok:true,reason:null,polyline,...rounded,edgePath:ids.slice(1,-1),length:rounded.path.slice(1).reduce((sum,p,i)=>sum+distance(rounded.path[i],p),0)};
}
