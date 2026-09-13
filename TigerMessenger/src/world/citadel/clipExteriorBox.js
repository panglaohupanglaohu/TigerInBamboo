import * as THREE from 'three';
// Subtract an axis-aligned author-space opening while retaining all source attributes.
export function clipExteriorBox(group,frame,min,max){
 frame.updateWorldMatrix(true,true);let removed=0;
 group.traverse(m=>{if(!m.isMesh)return;const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry,keys=Object.keys(g.attributes),out=Object.fromEntries(keys.map(k=>[k,[]])),toFrame=new THREE.Matrix4().multiplyMatrices(frame.matrixWorld.clone().invert(),m.matrixWorld);let changed=false;
 const vertex=i=>{const a={};for(const k of keys){const at=g.attributes[k];a[k]=Array.from(at.array.slice(i*at.itemSize,(i+1)*at.itemSize));}return {p:new THREE.Vector3(...a.position).applyMatrix4(toFrame).toArray(),a};};
 const mix=(a,b,t)=>({p:a.p.map((v,i)=>v+(b.p[i]-v)*t),a:Object.fromEntries(keys.map(k=>[k,a.a[k].map((v,i)=>v+(b.a[k][i]-v)*t)]))});
 const emit=poly=>{for(let i=1;i<poly.length-1;i++){const tri=[poly[0],poly[i],poly[i+1]],a=new THREE.Vector3(...tri[1].p).sub(new THREE.Vector3(...tri[0].p)),b=new THREE.Vector3(...tri[2].p).sub(new THREE.Vector3(...tri[0].p));if(a.cross(b).lengthSq()<1e-15)continue;for(const v of tri)for(const k of keys)out[k].push(...v.a[k]);}};
 for(let i=0;i<g.attributes.position.count;i+=3){const tri=[vertex(i),vertex(i+1),vertex(i+2)];if([0,1,2].some(axis=>tri.every(v=>v.p[axis]<min[axis])||tri.every(v=>v.p[axis]>max[axis]))){emit(tri);continue;}let inside=tri;
 for(const [axis,edge,sign]of [[0,min[0],1],[0,max[0],-1],[1,min[1],1],[1,max[1],-1],[2,min[2],1],[2,max[2],-1]]){if(!inside.length)break;const a=[],b=[];for(let j=0;j<inside.length;j++){const v=inside[j],w=inside[(j+1)%inside.length],dv=(v.p[axis]-edge)*sign,dw=(w.p[axis]-edge)*sign,yes=dv>=0;if(yes)a.push(v);else b.push(v);if(yes!==(dw>=0)){const cut=mix(v,w,dv/(dv-dw));a.push(cut);b.push(cut);}}emit(b);inside=a;}
 if(inside.length>=3){changed=true;removed++;}}
 if(g!==m.geometry)g.dispose();if(!changed)return;const replacement=new THREE.BufferGeometry();for(const k of keys)replacement.setAttribute(k,new THREE.Float32BufferAttribute(out[k],m.geometry.attributes[k].itemSize));replacement.computeBoundingBox();replacement.computeBoundingSphere();m.geometry.dispose();m.geometry=replacement;
 });return removed;
}
