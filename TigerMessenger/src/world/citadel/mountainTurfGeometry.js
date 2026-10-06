import * as THREE from 'three';
/** Linear contour clipping stays on the original support face. Shared endpoints
 * and shared scalar values yield identical cuts on common edges. Project code. */
export function clipTurfTriangle(triangle,values){
 let polygon=[triangle.a,triangle.b,triangle.c].map((p,i)=>({p:p.clone(),v:values[i]})),out=[];
 for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length];if(a.v>=0)out.push(a.p);if((a.v>=0)!==(b.v>=0))out.push(a.p.clone().lerp(b.p,a.v/(a.v-b.v)));}
 const triangles=[];for(let i=1;i+1<out.length;i++){const t=new THREE.Triangle(out[0].clone(),out[i].clone(),out[i+1].clone());if(t.getArea()>1e-8)triangles.push(t);}return triangles;
}
/** Both leaf roots must be on the support triangle, not only its center. */
export function supportedGrassBase(triangle,center,side,halfWidth,up){
 const n=triangle.getNormal(new THREE.Vector3()),denom=n.dot(up);if(Math.abs(denom)<1e-5)return null;
 const ends=[-1,1].map(sign=>{const p=center.clone().addScaledVector(side,sign*halfWidth);return p.addScaledVector(up,n.dot(triangle.a.clone().sub(p))/denom);});
 return ends.every(p=>triangle.containsPoint(p))?ends:null;
}
export const turfVertexKey=v=>v.toArray().map(x=>Math.round(x*1e4)).join(',');
export const turfEdgeKey=(a,b)=>[turfVertexKey(a),turfVertexKey(b)].sort().join('|');
// A shared edge registry is the refinement authority. Neighbors consume exactly
// the same midpoint; centroid fans avoid hanging edges when only one edge splits.
export function refineTurfTriangle(tri,splitEdges){
 const vs=[tri.a,tri.b,tri.c],ring=[];let split=false;for(let i=0;i<3;i++){ring.push(vs[i]);if(splitEdges.has(turfEdgeKey(vs[i],vs[(i+1)%3]))){ring.push(vs[i].clone().lerp(vs[(i+1)%3],.5));split=true;}}
 if(!split)return [tri];const center=tri.getMidpoint(new THREE.Vector3());return ring.map((v,i)=>new THREE.Triangle(center.clone(),v.clone(),ring[(i+1)%ring.length].clone()));
}
