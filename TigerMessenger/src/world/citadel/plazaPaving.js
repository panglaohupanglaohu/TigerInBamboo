import {PLAZA_SHIFT,PLAZA_LAYOUT,PLAZA_R03} from './newPlazaLayout.js';
import * as THREE from 'three';

// Shallow surface paving: original plaza slab owns walk support/collision.
// Separate wedge-shaped stones with narrow mortar joints, merged into one draw.
export function buildPlazaPaving(){
  const positions=[],colors=[];
  let fieldStones=0;
  const palette=[new THREE.Color(0xd8cbb7),new THREE.Color(0xded2bf),new THREE.Color(0x8795a2)];
  const pitch=PLAZA_R03?1.5:.95;
  const rings=Array.from({length:6},(_,i)=>[1.75+i*pitch,1.75+(i+1)*pitch-.05,32+i*12]);
  rings.forEach(([inner,outer,count],r)=>{
    for(let i=0;i<count;i++){
      const da=Math.PI*2/count,a=i*da+(r%2)*da*.5+.006,b=a+da-.012;
      const p=(radius,angle)=>[Math.cos(angle)*radius,0,Math.sin(angle)*radius];
      const corners=[p(inner,a),p(outer,a),p(outer,b),p(inner,b)];
      const color=palette[r%palette.length].clone().multiplyScalar(.95+((i*7+r*3)%9)*.0125);
      for(const j of [0,2,1,0,3,2]){positions.push(...corners[j]);colors.push(color.r,color.g,color.b);}
    }
  });
  // Continue the plaza paving beyond the medallion. Clip each jointed stone
  // against the circular inlay and the original horse's dais/stair/ramp footprint.
  // Coordinates are relative to the unchanged statue anchor (59, 76).
  function half(poly,a,b,inside){
    const out=[],d=p=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
    for(let i=0;i<poly.length;i++){
      const p=poly[i],q=poly[(i+1)%poly.length],dp=d(p),dq=d(q),ip=inside?dp>=0:dp<=0,iq=inside?dq>=0:dq<=0;
      if(ip)out.push(p);
      if(ip!==iq){const t=dp/(dp-dq);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}
    }return out;
  }
  function subtract(poly,cut){
    const out=[];let rest=poly;
    for(let i=0;i<cut.length&&rest.length>=3;i++){
      const a=cut[i],b=cut[(i+1)%cut.length],piece=half(rest,a,b,false);
      if(piece.length>=3)out.push(piece);rest=half(rest,a,b,true);
    }return out;
  }
  const rect=(x0,z0,x1,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
  const radius=PLAZA_LAYOUT.ringRadius,horseDelta=PLAZA_LAYOUT.horseX-PLAZA_LAYOUT.statueX-16;
  const circle=Array.from({length:96},(_,i)=>[Math.cos(i*Math.PI/48)*(radius+.04),Math.sin(i*Math.PI/48)*(radius+.04)]);
  const cuts=[circle,rect(10+horseDelta,-10.5,22+horseDelta,3.5),rect(7.6+horseDelta,-.2,10+horseDelta,2.2),rect(13.2+horseDelta,-16,18.8+horseDelta,-10.5)];
  const left=PLAZA_LAYOUT.left-PLAZA_LAYOUT.statueX,right=PLAZA_LAYOUT.right-PLAZA_LAYOUT.statueX;
  for(let row=0,z=-16.5;z<12.5;row++,z+=1.15){
    for(let col=0,x=left-(row%2)*.575;x<right;col++,x+=1.15){
      const x0=Math.max(left,x)+.022,x1=Math.min(right,x+1.15)-.022,z0=z+.022,z1=Math.min(12.5,z+1.15)-.022;
      if(x1<=x0||z1<=z0)continue;
      let pieces=[rect(x0,z0,x1,z1)];
      for(const cut of cuts)pieces=pieces.flatMap(p=>subtract(p,cut));
      if(!pieces.length)continue;fieldStones++;
      const c=new THREE.Color(0xd3c8b5).multiplyScalar(.96+((row*13+col*7)%11)*.008);
      for(const poly of pieces)for(let j=1;j<poly.length-1;j++){
        const a=poly[0],b=poly[j],d=poly[j+1];
        if((b[0]-a[0])*(d[1]-a[1])-(b[1]-a[1])*(d[0]-a[0])<1e-7)continue;
        for(const k of [0,j+1,j]){positions.push(poly[k][0],0,poly[k][1]);colors.push(c.r,c.g,c.b);}
      }
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();g.computeBoundingSphere();
  const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({name:'citadel-concentric-stone-paving',vertexColors:true,roughness:.94,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
  m.name='west-city-plaza-paving-ring';m.receiveShadow=true;
  Object.assign(m.userData,{sourceId:PLAZA_R03?'placement-r03-wide-ring-plaza':'citadel-plaza-complete-paving-v3',fieldStones,stoneCount:372+fieldStones,rings:6,outerRadius:radius,decorativeOnly:true,skipColliders:true});
  return m;
}
