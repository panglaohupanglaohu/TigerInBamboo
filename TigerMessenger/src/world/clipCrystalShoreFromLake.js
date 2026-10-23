import * as THREE from 'three';

// Subtract the lake's sloping inner void from neighbouring authored shore
// triangles. World-space source attributes survive via edge interpolation.
// The cut sits behind the existing bowl wall; that wall remains the visible
// cavity boundary. No whole mesh is hidden, and generated bridges are untouched.
export function clipCrystalShoreFromLake(geometry, swamp) {
 const inner=swamp?.userData?.inner||swamp;
 if(!inner?.isObject3D)return {geometry,changed:false,removedTriangles:0};
 inner.updateWorldMatrix(true,false);
 const inverse=inner.matrixWorld.clone().invert(),planes=[];
 // 1.2 inner units behind the nominal wall covers its jittered stone courses
 // while preserving the 3.3-unit inset, two-world-metre walking terraces.
 for(let i=0;i<48;i++){const a=i*Math.PI/24;planes.push([Math.cos(a),-.7,Math.sin(a),7.2]);}
 planes.push([0,-1,0,-8],[0,1,0,44]);
 const source=geometry.index?geometry.toNonIndexed():geometry,pos=source.attributes.position,col=source.attributes.color,output=[],colours=[];
 const distance=(v,p)=>v.local.x*p[0]+v.local.y*p[1]+v.local.z*p[2]-p[3];
 const mix=(a,b,t)=>({world:a.world.clone().lerp(b.world,t),local:a.local.clone().lerp(b.local,t),color:a.color.clone().lerp(b.color,t)});
 function split(poly,plane){
  const inside=[],outside=[];
  for(let i=0;i<poly.length;i++){
   const a=poly[i],b=poly[(i+1)%poly.length],da=distance(a,plane),db=distance(b,plane),ain=da<=0,bin=db<=0;
   (ain?inside:outside).push(a);
   if(ain!==bin){const v=mix(a,b,da/(da-db));inside.push(v);outside.push(v);}
  }
  return {inside,outside};
 }
 const emit=poly=>{for(let j=1;j<poly.length-1;j++)for(const v of [poly[0],poly[j],poly[j+1]]){output.push(...v.world.toArray());colours.push(v.color.x,v.color.y,v.color.z);}};
 let removedTriangles=0,changedTriangles=0;
 for(let i=0;i<pos.count;i+=3){
  const tri=[0,1,2].map(j=>{const world=new THREE.Vector3().fromBufferAttribute(pos,i+j);return {world,local:world.clone().applyMatrix4(inverse),color:col?new THREE.Vector3().fromBufferAttribute(col,i+j):new THREE.Vector3(1,1,1)};});
  // A separating plane proves the full triangle lies outside the convex void.
  if(planes.some(p=>tri.every(v=>distance(v,p)>0))){emit(tri);continue;}
  let remainder=tri;const fragments=[];
  for(const plane of planes){if(remainder.length<3)break;const result=split(remainder,plane);if(result.outside.length>=3)fragments.push(result.outside);remainder=result.inside;}
  if(remainder.length<3){emit(tri);continue;}
  changedTriangles++;if(!fragments.length)removedTriangles++;
  for(const fragment of fragments)emit(fragment);
 }
 if(source!==geometry)source.dispose();
 if(!changedTriangles)return {geometry,changed:false,removedTriangles:0,changedTriangles:0};
 const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(output,3));result.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));result.computeVertexNormals();result.computeBoundingBox();result.computeBoundingSphere();
 return {geometry:result,changed:true,removedTriangles,changedTriangles,sourceTriangles:pos.count/3,resultTriangles:output.length/9};
}
