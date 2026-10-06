import * as T from 'three';
import {clipTurfTriangle,refineTurfTriangle,turfEdgeKey,turfVertexKey} from './mountainTurfGeometry.js';
// Authored local lower-slope habitat correction, not a global erosion method.
// Evidence: real exported left-tail surfaces slope .69-.77, upper bench .89-.91.
export function mountainTurfTailWeight(p,{fadeHeight=[5,9]}={}){const smooth=T.MathUtils.smoothstep;return smooth(p.x,-36,-28)*(1-smooth(p.x,-2,6))*smooth(p.z,-18,-12)*(1-smooth(p.z,5,13))*(1-smooth(p.y,...fadeHeight));}
export function filterTailShrubs(rows,worldToCastle,sample,options={}){
 const kept=[],stats={checked:0,removed:0,retainedOutside:0};
 for(const row of rows){const p=new T.Vector3(...row.world);if(mountainTurfTailWeight(p.clone().applyMatrix4(worldToCastle),options)===0){kept.push(row);stats.retainedOutside++;continue;}
 stats.checked++;const up=p.clone().normalize(),ray=new T.Ray(p.clone().addScaledVector(up,2),up.clone().negate()),hit=sample(ray,0,4);
 // Placement is buried 35mm below the minimum of five actual rock feet.
 // Require final turf at this exact radial root, allowing only that recorded burial.
 const rise=hit?hit.point.clone().sub(p).dot(up):Infinity;
 if(hit&&rise>=-.00006&&rise<=(row.footSpread||0)+.03506)kept.push(row);else stats.removed++;
 }return {kept,stats};
}
export function trimMountainTurfTails(input,worldToCastle,{fadeHeight=[5,9]}={}){
 const smooth=T.MathUtils.smoothstep,field=new Map(),records=[];
 const weight=p=>mountainTurfTailWeight(p,{fadeHeight});
 for(let i=0;i<input.length;i++){const tri=input[i],center=tri.getMidpoint(new T.Vector3()),area=tri.getArea(),slope=Math.abs(tri.getNormal(new T.Vector3()).dot(center.normalize()));for(const p of[tri.a,tri.b,tri.c]){const key=turfVertexKey(p),f=field.get(key)||{area:0,sum:0};f.area+=area;f.sum+=slope*area;field.set(key,f);}records.push({tri,source:i,pieces:[tri]});}
 function value(r,p){const local=p.clone().applyMatrix4(worldToCastle),w=weight(local);if(w===0)return 1;const bary=r.tri.getBarycoord(p,new T.Vector3()),slope=[r.tri.a,r.tri.b,r.tri.c].reduce((sum,v,i)=>{const f=field.get(turfVertexKey(v));return sum+f.sum/Math.max(1e-10,f.area)*bary.getComponent(i);},0);return T.MathUtils.lerp(1,(slope-.85)*8,w);}
 let splitCount=0;for(let level=0;level<2;level++){const edges=new Set();for(const r of records)for(const tri of r.pieces){const vs=[tri.a,tri.b,tri.c],values=vs.map(p=>value(r,p));if(Math.min(...values)>.25||Math.max(...values)<-.25)continue;for(let j=0;j<3;j++)if(edges.size+splitCount<2500&&vs[j].distanceTo(vs[(j+1)%3])>1.2)edges.add(turfEdgeKey(vs[j],vs[(j+1)%3]));}for(const r of records)r.pieces=r.pieces.flatMap(t=>refineTurfTriangle(t,edges));splitCount+=edges.size;if(!edges.size)break;}
 const output=[];let beforeArea=0,afterArea=0,unaffectedArea=0,affectedBeforeArea=0;for(const r of records){const area=r.tri.getArea();beforeArea+=area;if([r.tri.a,r.tri.b,r.tri.c].every(p=>weight(p.clone().applyMatrix4(worldToCastle))===0))unaffectedArea+=area;else affectedBeforeArea+=area;for(const tri of r.pieces)for(const triangle of clipTurfTriangle(tri,[tri.a,tri.b,tri.c].map(p=>value(r,p)))){output.push({triangle,source:r.source});afterArea+=triangle.getArea();if(output.length>120000)throw Error('Local turf tail candidate exceeds output budget');}}
 return {output,stats:{method:'local castle-coordinate lower-slope window; area-weighted actual turf geometric slope, continuous field clipping on source triangles',steepThreshold:.85,window:{x:[-36,-28,-2,6],z:[-18,-12,5,13],fadeHeight:[...fadeHeight]},beforeTriangles:input.length,afterTriangles:output.length,beforeArea,afterArea,unaffectedArea,affectedBeforeArea,sharedSplitEdges:splitCount,maxSharedSplitEdges:2500,maxLevels:2,maxOutput:120000}};
}
