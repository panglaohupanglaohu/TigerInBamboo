import * as THREE from 'three';

// Shallow surface paving: original plaza slab owns walk support/collision.
// Separate wedge-shaped stones with narrow mortar joints, merged into one draw.
export function buildPlazaPaving(){
  const positions=[],colors=[];
  const palette=[new THREE.Color(0xa6adaf),new THREE.Color(0xd3cbbb),new THREE.Color(0x8b99a3)];
  const rings=Array.from({length:6},(_,i)=>[1.75+i*.95,2.65+i*.95,32+i*12]);
  rings.forEach(([inner,outer,count],r)=>{
    for(let i=0;i<count;i++){
      const da=Math.PI*2/count,a=i*da+(r%2)*da*.5+.006,b=a+da-.012;
      const p=(radius,angle)=>[Math.cos(angle)*radius,0,Math.sin(angle)*radius];
      const corners=[p(inner,a),p(outer,a),p(outer,b),p(inner,b)];
      const color=palette[r%palette.length].clone().multiplyScalar(.95+((i*7+r*3)%9)*.0125);
      for(const j of [0,2,1,0,3,2]){positions.push(...corners[j]);colors.push(color.r,color.g,color.b);}
    }
  });
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();g.computeBoundingSphere();
  const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({name:'citadel-concentric-stone-paving',vertexColors:true,roughness:.94,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
  m.name='west-city-plaza-paving-ring';m.receiveShadow=true;
  Object.assign(m.userData,{sourceId:'citadel-plaza-concentric-stones-v2',stoneCount:372,rings:6,outerRadius:7.4,decorativeOnly:true,skipColliders:true});
  return m;
}
