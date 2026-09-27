import * as THREE from 'three';

/** Narrow rock buttresses outside the rail and original meeting approach. */
export function addGateMoebiusRockFaces(root) {
  const material = new THREE.MeshStandardMaterial({color:0x345680,roughness:1,flatShading:true,emissive:0x172c48,emissiveIntensity:.3});
  const ink = new THREE.LineBasicMaterial({color:0x1a324e,transparent:true,opacity:.65});
  for(const side of [-1,1]) for(let k=0;k<7;k++) {
    const cx=side*(14.5+(k%3)*2),cz=-8+k*5.2;
    const height=16+5*Math.sin(k*1.7+side),radius=2.1+(k%3)*.45;
    const points=[],indices=[],N=9,levels=6;
    for(let j=0;j<levels;j++) for(let i=0;i<N;i++) {
      const a=i/N*Math.PI*2,t=j/(levels-1),r=radius*(1-.56*t)*(1+.16*Math.sin(i*2.7+k));
      points.push(cx+Math.cos(a)*r+Math.sin(t*3+k)*.45,-12+t*height+Math.sin(i*2.1+k)*.65,cz+Math.sin(a)*r);
    }
    for(let j=0;j<levels-1;j++)for(let i=0;i<N;i++){
      const a=j*N+i,b=j*N+(i+1)%N;indices.push(a,a+N,b,b,a+N,b+N);
    }
    for(let i=1;i<N-1;i++)indices.push((levels-1)*N,(levels-1)*N+i+1,(levels-1)*N+i);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    const rock=new THREE.Mesh(geometry,material);rock.name='moebius-gate-cliff-buttress';rock.userData.citadelSolidExterior=true;root.add(rock);
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geometry,16),ink);edges.name='moebius-gate-rock-fissures';root.add(edges);
  }
}
