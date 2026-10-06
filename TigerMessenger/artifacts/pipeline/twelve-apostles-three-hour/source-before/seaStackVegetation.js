import * as THREE from 'three';

// Project-authored surface dressing: coherent turf patches, then low scrub.
// Surface occupancy comes from actual cliff triangles, not independent sky points.
export function plantSeaStackTerraces(rock) {
 const g=rock.geometry,p=g.attributes.position,index=g.index,h=rock.userData.seaStack.height;
 const seed=g.userData.terraces.seed,positions=[],colors=[],roots=[],sizes=[];
 const tri=new THREE.Triangle(),normal=new THREE.Vector3(),center=new THREE.Vector3();
 const dark=new THREE.Color(0x50654d),light=new THREE.Color(0x899771);
 let state=(seed+9173)>>>0;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 for(let i=0;i<(index?index.count:p.count);i+=3){
  [tri.a,tri.b,tri.c].forEach((v,j)=>v.fromBufferAttribute(p,index?index.getX(i+j):i+j));
  tri.getNormal(normal);tri.getMidpoint(center);
  if(normal.y<.86||center.y< -h*.24)continue;
  // Low-frequency field makes broad connected green regions and bare rock gaps.
  const field=Math.sin(center.x*.34+seed*1.7)+.65*Math.cos(center.z*.39-seed)+.35*Math.sin((center.x+center.z)*.61);
  if(field<-.55)continue;
  const tint=light.clone().lerp(dark,THREE.MathUtils.clamp(.28+(1-normal.y)*2+.15*Math.sin(center.x*.18+seed),0,1));
  for(const v of [tri.a,tri.b,tri.c]){positions.push(v.x,v.y+.045,v.z);colors.push(tint.r,tint.g,tint.b);}
  // Sparse wind-clipped scrub emerges only within the accepted turf area.
  const safe=2*tri.getArea()/(3*Math.max(tri.a.distanceTo(tri.b),tri.b.distanceTo(tri.c),tri.c.distanceTo(tri.a)));
  if(safe<.22||random()>.20||roots.some(r=>new THREE.Vector3(...r).distanceToSquared(center)<3.2))continue;
  roots.push(center.toArray());sizes.push(Math.min(.78,safe*.9));
 }
 const turfGeometry=new THREE.BufferGeometry();
 turfGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 turfGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));turfGeometry.computeVertexNormals();
 const turf=new THREE.Mesh(turfGeometry,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.FrontSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
 turf.name='sea-stack-terrace-turf';rock.add(turf);
 const geo=new THREE.IcosahedronGeometry(1,0),mat=new THREE.MeshBasicMaterial({color:0xffffff});
 const shrubs=new THREE.InstancedMesh(geo,mat,roots.length*3),matrix=new THREE.Matrix4(),q=new THREE.Quaternion();
 shrubs.name='sea-stack-terrace-shrubs';
 roots.forEach((r,i)=>{const size=sizes[i];for(let j=0;j<3;j++){
  const a=j*Math.PI*2/3+seed,offset=size*.18;
  matrix.compose(new THREE.Vector3(r[0]+Math.cos(a)*offset,r[1]+size*.17+.045,r[2]+Math.sin(a)*offset),q,new THREE.Vector3(size*.58,size*(j===0?.30:.21),size*.53));
  shrubs.setMatrixAt(i*3+j,matrix);shrubs.setColorAt(i*3+j,new THREE.Color([0x4e674e,0x627b58,0x78895f][(i+j)%3]));
 }});
 shrubs.userData.roots=roots;rock.add(shrubs);
 // Tiny tapered fans soften patch silhouettes. Every fan shares a supported root.
 const blades=[];for(let j=0;j<5;j++){const a=j*2.399,dx=Math.cos(a),dz=Math.sin(a),length=.5+(j%3)*.15,width=.055;
  blades.push(-dz*width,0,dx*width,dz*width,0,-dx*width,dx*.15,length,dz*.15);
 }
 const bladeGeometry=new THREE.BufferGeometry();bladeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(blades,3));
 const grass=new THREE.InstancedMesh(bladeGeometry,new THREE.MeshBasicMaterial({color:0x8d9b70,side:THREE.DoubleSide}),roots.length);
 grass.name='sea-stack-coastal-grass';
 roots.forEach((r,i)=>{const size=sizes[i];q.setFromAxisAngle(new THREE.Vector3(0,1,0),i*2.399+seed);matrix.compose(new THREE.Vector3(...r).add(new THREE.Vector3(0,.045,0)),q,new THREE.Vector3(size,size*.7,size));grass.setMatrixAt(i,matrix);});
 grass.userData.roots=roots;rock.add(grass);
 turf.userData.planting={triangles:positions.length/9,clusters:roots.length,seed,method:'surface-masked-turf-and-clustered-scrub'};
 return roots;
}
