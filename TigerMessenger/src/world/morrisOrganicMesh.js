import * as T from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
/** Smooth unions of authored ellipsoids: one continuous surface rather than intersecting primitives. */
export function organicEllipsoidSurface(parts,{min,max,step=.075,blend=.13}={}){
 const ns=min.map((v,i)=>Math.ceil((max[i]-v)/step)),size=ns.map(n=>n+1),field=new Float32Array(size[0]*size[1]*size[2]);
 const index=(x,y,z)=>(z*size[1]+y)*size[0]+x;
 const sample=(x,y,z)=>{let d=1e9;for(const c of parts){const r=Math.min(...c.r),q=Math.hypot((x-c.p[0])/c.r[0],(y-c.p[1])/c.r[1],(z-c.p[2])/c.r[2]),b=(q-1)*r;if(d===1e9)d=b;else{const h=Math.max(blend-Math.abs(d-b),0)/blend;d=Math.min(d,b)-h*h*blend*.25;}}return d;};
 for(let z=0;z<size[2];z++)for(let y=0;y<size[1];y++)for(let x=0;x<size[0];x++)field[index(x,y,z)]=sample(min[0]+x*step,min[1]+y*step,min[2]+z*step);
 const corners=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]],tetra=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]],out=[];
 for(let z=0;z<ns[2];z++)for(let y=0;y<ns[1];y++)for(let x=0;x<ns[0];x++){
 const values=corners.map(c=>field[index(x+c[0],y+c[1],z+c[2])]);if(values.every(v=>v>0)||values.every(v=>v<=0))continue;
 const pos=corners.map(c=>[min[0]+(x+c[0])*step,min[1]+(y+c[1])*step,min[2]+(z+c[2])*step]);
 const edge=(a,b)=>{const f=values[a]/(values[a]-values[b]);return pos[a].map((v,k)=>v+(pos[b][k]-v)*f);};
 const triangle=(a,b,c)=>{const A=new T.Vector3(...a),B=new T.Vector3(...b),C=new T.Vector3(...c),normal=B.clone().sub(A).cross(C.clone().sub(A)),center=A.clone().add(B).add(C).multiplyScalar(1/3),epsilon=.004,gradient=new T.Vector3(sample(center.x+epsilon,center.y,center.z)-sample(center.x-epsilon,center.y,center.z),sample(center.x,center.y+epsilon,center.z)-sample(center.x,center.y-epsilon,center.z),sample(center.x,center.y,center.z+epsilon)-sample(center.x,center.y,center.z-epsilon));if(normal.dot(gradient)<0)out.push(...a,...c,...b);else out.push(...a,...b,...c);};
 for(const t of tetra){const a=t.filter(j=>values[j]<=0),b=t.filter(j=>values[j]>0);if(a.length===1)triangle(edge(a[0],b[0]),edge(a[0],b[1]),edge(a[0],b[2]));else if(a.length===3)triangle(edge(b[0],a[0]),edge(b[0],a[1]),edge(b[0],a[2]));else if(a.length===2){const p=edge(a[0],b[0]),q=edge(a[0],b[1]),r=edge(a[1],b[0]),s=edge(a[1],b[1]);triangle(p,q,r);triangle(q,s,r);}}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(out,3));const welded=mergeVertices(g,1e-4);g.dispose();welded.computeVertexNormals();welded.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(welded.attributes.position.count*2),2));return welded;
}
