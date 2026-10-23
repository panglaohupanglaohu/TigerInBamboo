import * as THREE from 'three';
// Locally authored honeycomb terrain. Shared, slightly irregular corners are reused;
// clipped boundary cells close the rectangular heightfield without square turf cards.
export function buildHexGrassSurface({minX,maxX,minZ,maxZ,size=2,heightAt,toWorld}){
  const verts=[],flat=[],indices=[],col=[],ids=new Map(),edges=new Map();let hexes=0,clipped=0;
  const grass=new THREE.Color(0x55875f),soil=new THREE.Color(0x8a7a56),colour=new THREE.Color(),v=new THREE.Vector3();
  const clip=(poly,axis,value,sign)=>{const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a[axis]-value)*sign,db=(b[axis]-value)*sign;if(da>=-1e-8)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}return out;};
  const vertex=(x,z)=>{const key=x.toFixed(6)+','+z.toFixed(6);if(ids.has(key))return ids.get(key);const i=flat.length/2;flat.push(x,z);const h=heightAt(x,z);toWorld(x,h,z,v);verts.push(v.x,v.y,v.z);colour.copy(grass).lerp(soil,THREE.MathUtils.clamp((h-.6)/1.2,0,1));col.push(colour.r,colour.g,colour.b);ids.set(key,i);return i;};
  const dz=Math.sqrt(3)*size;const q0=Math.floor(minX/(size*1.5))-2,q1=Math.ceil(maxX/(size*1.5))+2;
  for(let q=q0;q<=q1;q++)for(let r=Math.floor(minZ/dz)-3;r<=Math.ceil(maxZ/dz)+3;r++){
    const cx=q*size*1.5,cz=(r+(q%2)*.5)*dz;
    let poly=Array.from({length:6},(_,k)=>[cx+size*Math.cos(k*Math.PI/3),cz+size*Math.sin(k*Math.PI/3)]);
    poly=clip(clip(clip(clip(poly,0,minX,1),0,maxX,-1),1,minZ,1),1,maxZ,-1);if(poly.length<3)continue;
    const area=poly.reduce((s,a,k)=>{const b=poly[(k+1)%poly.length];return s+a[0]*b[1]-b[0]*a[1];},0);if(Math.abs(area)<1e-7)continue;
    if(poly.length===6)hexes++;else clipped++;
    const centre=vertex(poly.reduce((s,p)=>s+p[0],0)/poly.length,poly.reduce((s,p)=>s+p[1],0)/poly.length),ring=poly.map(p=>vertex(...p));
    for(let k=0;k<ring.length;k++){const a=ring[k],b=ring[(k+1)%ring.length];indices.push(centre,b,a);const key=a<b?a+','+b:b+','+a;const e=edges.get(key);if(e)e.count++;else edges.set(key,{a,b,count:1});}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
  // Spatial triangle bins keep player support queries local after grid replacement.
  const step=4,buckets=new Map();for(let t=0;t<indices.length;t+=3){const tri=indices.slice(t,t+3),xs=tri.map(i=>flat[i*2]),zs=tri.map(i=>flat[i*2+1]);for(let x=Math.floor(Math.min(...xs)/step);x<=Math.floor(Math.max(...xs)/step);x++)for(let z=Math.floor(Math.min(...zs)/step);z<=Math.floor(Math.max(...zs)/step);z++){const key=x+','+z;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(t);}}
  g.userData.hexGrass={flat,step,buckets,boundary:[...edges.values()].filter(e=>e.count===1),hexes,clipped,version:'hex-grass-1'};return g;
}
