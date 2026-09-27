import * as THREE from 'three';

// Refine the existing continuous shoulders. Never raise terrain into the railway.
export function refineGateMoebiusTerrain(site) {
  if(site.userData.moebiusTerrainRevision)return;
  for(const mesh of site.children.filter(o=>o.name.startsWith('canyon-shoulder'))){
    const source=mesh.geometry.attributes.position,positions=[];
    const midpoint=(a,b)=>a.clone().add(b).multiplyScalar(.5);
    const carve=p=>{
      const edge=THREE.MathUtils.smoothstep(Math.abs(p.x),12,22);
      const approach=p.x<0&&p.x>-35&&p.z>-46&&p.z<-10;
      if(approach)return p;
      const fissure=Math.pow(.5+.5*Math.sin(p.z*.72+p.x*.17),10);
      const bedding=.5+.5*Math.sin(p.x*1.13+p.z*.31);
      p.y-=edge*(1.65*fissure+.25*bedding);
      return p;
    };
    const triangle=(a,b,c,depth)=>{
      if(depth){const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);triangle(a,ab,ca,depth-1);triangle(ab,b,bc,depth-1);triangle(ca,bc,c,depth-1);triangle(ab,bc,ca,depth-1);return;}
      for(const p of[a,b,c])positions.push(...carve(p.clone()).toArray());
    };
    for(let i=0;i<source.count;i+=3)triangle(...[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(source,i+j)),2);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
    const colors=[],pos=geometry.attributes.position,n=geometry.attributes.normal;
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
      const seam=Math.pow(.5+.5*Math.sin(y*2.4+.32*Math.sin(x*.7+z*.28)),18);
      const shade=.76+.18*Math.abs(n.getY(i))+.13*n.getX(i)-seam*.12;
      const color=new THREE.Color(0x345989).multiplyScalar(shade);colors.push(color.r,color.g,color.b);
    }
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeBoundingSphere();geometry.computeBoundingBox();
    mesh.geometry=geometry;mesh.userData.moebiusTerrainRevision=1;
  }
  site.userData.moebiusTerrainRevision=1;
}
