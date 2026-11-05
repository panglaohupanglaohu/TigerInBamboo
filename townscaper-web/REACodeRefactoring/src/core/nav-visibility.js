/** 810878197134950401: "approximate line of sight on a nav mesh".
 * Sample angular rays through existing convex polygon portals. No distance-step
 * sampling: a thin closed cell edge cannot be skipped. This is graph visibility,
 * not optical triangle-mesh LOS; navigation doors/clearance affect its result.
 */
const cross=(ax,az,bx,bz)=>ax*bz-az*bx;
export function castNavVisibility(graph,start,{rays=96,maxRange=12,maxFloorDelta=0,startAngle=0,fov=Math.PI*2,origin=null}={}){
  if(!Number.isInteger(rays)||rays<1||rays>4096||!Number.isFinite(maxRange)||maxRange<=0||!Number.isInteger(maxFloorDelta)||maxFloorDelta<0||!Number.isFinite(startAngle)||!Number.isFinite(fov)||fov<=0||fov>Math.PI*2)throw new RangeError('Invalid visibility options');
  const source=graph.nodes[start],stats={edgeTests:0,portalCrossings:0};if(!source)return {ok:false,reason:'source',rays:[],visibleNodes:[],stats};
  const o=origin??{x:source.x,z:source.z},eps=1e-8;if(!Number.isFinite(o.x)||!Number.isFinite(o.z))throw new TypeError('Invalid origin');
  let sign=0;for(let e=0;e<source.cell.pts.length;e++){const a=source.cell.pts[e],b=source.cell.pts[(e+1)%source.cell.pts.length],c=cross(b.x-a.x,b.z-a.z,o.x-a.x,o.z-a.z);if(Math.abs(c)<=eps)throw new RangeError('Origin must be strictly inside source polygon');if(sign&&Math.sign(c)!==sign)throw new RangeError('Origin outside source polygon');sign=Math.sign(c);}
  const visible=new Set([start]),out=[];
  for(let i=0;i<rays;i++){
    const angle=startAngle+(rays===1?fov/2:i*fov/(fov===Math.PI*2?rays:rays-1)),dx=Math.cos(angle),dz=Math.sin(angle);let node=source,distance=0,reason='range';const path=[start];
    for(let iteration=0;iteration<=graph.nodes.length;iteration++){
      const hits=[];for(let edge=0;edge<node.cell.pts.length;edge++){stats.edgeTests++;const a=node.cell.pts[edge],b=node.cell.pts[(edge+1)%node.cell.pts.length],vx=b.x-a.x,vz=b.z-a.z,den=cross(dx,dz,vx,vz);if(Math.abs(den)<eps)continue;const ax=a.x-o.x,az=a.z-o.z,t=cross(ax,az,vx,vz)/den,u=cross(ax,az,dx,dz)/den;if(t>distance+eps&&u>=-eps&&u<=1+eps)hits.push({edge,t});}
      hits.sort((a,b)=>a.t-b.t||a.edge-b.edge);const hit=hits[0];if(!hit){reason='geometry';break;}if(hit.t>=maxRange){distance=maxRange;break;}
      distance=hit.t;if(hits[1]&&Math.abs(hits[1].t-hit.t)<eps){reason='vertex';break;} // conservative ambiguous corner
      const next=(graph.adj[node.id]??[]).filter(e=>e.portal?.edge===hit.edge&&Math.abs(graph.nodes[e.to].floor-source.floor)<=maxFloorDelta).sort((a,b)=>Math.abs(graph.nodes[a.to].floor-source.floor)-Math.abs(graph.nodes[b.to].floor-source.floor)||a.to-b.to)[0];
      if(!next){reason='blocked';break;}node=graph.nodes[next.to];path.push(node.id);visible.add(node.id);stats.portalCrossings++;if(iteration===graph.nodes.length)reason='budget';
    }
    out.push({angle,x:o.x+dx*distance,z:o.z+dz*distance,node:node.id,range:distance,reason,path});
  }
  return {ok:true,origin:{x:o.x,z:o.z,floor:source.floor},rays:out,visibleNodes:[...visible].sort((a,b)=>a-b),stats};
}
