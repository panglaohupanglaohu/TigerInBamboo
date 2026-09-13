import * as THREE from 'three';

// Dry pedestrian watergate around the original stair, with a genuine opening.
// Floor height is supplied by the same profile as the walkable stair treads.
export function buildHarborWatergate(floorY,bottomY){
  const root=new THREE.Group();root.name='citadel-harbor-watergate';
  const stone=new THREE.MeshStandardMaterial({color:0xc6c5bb,roughness:.94});
  const trim=new THREE.MeshStandardMaterial({color:0xe0d6bd,roughness:.91});
  const half=6,inner=2.2,spring=3.1,apex=spring+inner,top=6.3,bottom=bottomY-floorY;
  const shape=new THREE.Shape();shape.moveTo(-half,bottom);shape.lineTo(-inner,bottom);shape.lineTo(-inner,spring);
  shape.absarc(0,spring,inner,Math.PI,0,true);
  shape.lineTo(inner,bottom);shape.lineTo(half,bottom);shape.lineTo(half,top);shape.lineTo(-half,top);shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:1.5,bevelEnabled:false,curveSegments:16});g.translate(0,0,-.75);
  const wall=new THREE.Mesh(g,stone);wall.name='harbor-watergate-perforated-wall';root.add(wall);
  function box(name,x,y,z,w,h,d){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),trim);m.position.set(x,y,z);m.name=name;root.add(m);return m;}
  box('harbor-watergate-coping',0,top+.12,0,12.3,.24,1.8);
  for(const side of [-1,1]){
    box('harbor-watergate-pilaster',side*5.5,(bottom+top)/2,-.84,.65,top-bottom,.35);
    box('harbor-watergate-opening-jamb',side*2.36,(bottom+spring)/2,-.86,.32,spring-bottom,.26);
  }
  // Individual arch stones articulate a structurally legible semicircle.
  for(let i=0;i<14;i++){
    const a=i*Math.PI/14+.008,b=(i+1)*Math.PI/14-.008,s=new THREE.Shape();
    s.moveTo(inner*Math.cos(a),spring+inner*Math.sin(a));s.absarc(0,spring,inner,a,b,false);
    s.lineTo((inner+.35)*Math.cos(b),spring+(inner+.35)*Math.sin(b));s.absarc(0,spring,inner+.35,b,a,true);s.closePath();
    const geo=new THREE.ExtrudeGeometry(s,{depth:.2,bevelEnabled:false,curveSegments:3});geo.translate(0,0,-.96);
    const m=new THREE.Mesh(geo,trim);m.name='harbor-watergate-arch-stone-'+i;root.add(m);
  }
  for(let i=0;i<7;i++)box('harbor-watergate-merlon-'+i,-5.4+i*1.8,top+.7,0,.95,1.15,1.6);
  root.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;m.userData.citadelSolidExterior=true;m.userData.sourceId=m.name;}});
  root.userData.opening={width:inner*2,springHeight:spring,apexHeight:apex,depth:1.5};
  root.userData.sourceId='citadel-harbor-watergate-v1';
  return root;
}
