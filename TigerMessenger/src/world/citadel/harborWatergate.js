import * as THREE from 'three';

// Dry pedestrian watergate around the original stair, with a genuine opening.
// Floor height is supplied by the same profile as the walkable stair treads.
export function buildHarborWatergate(floorY,bottomY){
  const root=new THREE.Group();root.name='citadel-harbor-watergate';
  const stone=new THREE.MeshStandardMaterial({color:0xc6c5bb,roughness:.94});
  const trim=new THREE.MeshStandardMaterial({color:0xe0d6bd,roughness:.91});
  const half=6,inner=2.2,spring=3.1,apex=spring+inner,top=6.3,bottom=bottomY-floorY;
  const shape=new THREE.Shape();shape.moveTo(-half,bottom);shape.lineTo(-inner,bottom);shape.lineTo(-inner,spring);
  shape.quadraticCurveTo(-inner*.78,spring+inner*.68,0,apex);
  shape.quadraticCurveTo(inner*.78,spring+inner*.68,inner,spring);
  shape.lineTo(inner,bottom);shape.lineTo(half,bottom);shape.lineTo(half,top);shape.lineTo(-half,top);shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:1.5,bevelEnabled:false,curveSegments:16});g.translate(0,0,-.75);
  const wall=new THREE.Mesh(g,stone);wall.name='harbor-watergate-perforated-wall';root.add(wall);
  function box(name,x,y,z,w,h,d){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),trim);m.position.set(x,y,z);m.name=name;root.add(m);return m;}
  box('harbor-watergate-coping',0,top+.12,0,12.3,.24,1.8);
  for(const side of [-1,1]){
    for(const face of [-1,1])box('harbor-watergate-pilaster',side*5.5,(bottom+top)/2,face*.84,.65,top-bottom,.35);
    for(const face of [-1,1])box('harbor-watergate-opening-jamb',side*2.36,(bottom+spring)/2,face*.86,.32,spring-bottom,.26);
  }
  // Pointed arch matches the approved waterfront gate; each voussoir follows its curve.
  function arch(t){const right=t>.5,u=right?(t-.5)*2:t*2;
    const a=new THREE.Vector2(right?0:-inner,right?apex:spring),c=new THREE.Vector2(right?inner*.78:-inner*.78,spring+inner*.68),b=new THREE.Vector2(right?inner:0,right?spring:apex);
    const p=a.clone().multiplyScalar((1-u)*(1-u)).addScaledVector(c,2*(1-u)*u).addScaledVector(b,u*u);
    const tangent=c.clone().sub(a).multiplyScalar(2*(1-u)).addScaledVector(b.clone().sub(c),2*u).normalize();
    return {p,out:new THREE.Vector2(-tangent.y,tangent.x)};
  }
  for(let i=0;i<14;i++){
    const a=arch(i/14+.0015),b=arch((i+1)/14-.0015),aa=a.p.clone().addScaledVector(a.out,.35),bb=b.p.clone().addScaledVector(b.out,.35),s=new THREE.Shape();
    s.moveTo(a.p.x,a.p.y);s.lineTo(b.p.x,b.p.y);s.lineTo(bb.x,bb.y);s.lineTo(aa.x,aa.y);s.closePath();
    const geo=new THREE.ExtrudeGeometry(s,{depth:.2,bevelEnabled:false});geo.translate(0,0,-.1);
    for(const face of [-1,1]){const m=new THREE.Mesh(geo,trim);m.position.z=face*.87;m.name='harbor-watergate-arch-stone-'+i;root.add(m);}
  }
  // Shallow staggered stone faces stop outside the arch ring; the opening remains real.
  let faceBlocks=0;
  for(let y=Math.max(bottom,0)+.29,row=0;y<top-.2;y+=.58,row++){
    const low=y-.27,ring=inner+.4;
    const opening=low<spring?ring:Math.sqrt(Math.max(0,ring*ring-(low-spring)*(low-spring)));
    for(let x=-half+.66+(row%2)*.65;x<half-.5;x+=1.3){
      if(Math.abs(x)-.625<opening)continue;
      for(const face of [-1,1]){
        const m=new THREE.Mesh(new THREE.BoxGeometry(1.25,.54,.07),stone);
        m.name='harbor-watergate-ashlar';m.position.set(x,y,face*.778);root.add(m);faceBlocks++;
      }
    }
  }
  root.userData.masonry={faces:2,blocks:faceBlocks,archStones:28};
  for(let i=0;i<7;i++)box('harbor-watergate-merlon-'+i,-5.4+i*1.8,top+.7,0,.95,1.15,1.6);
  root.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;m.userData.citadelSolidExterior=true;m.userData.sourceId=m.name;}});
  root.userData.opening={width:inner*2,springHeight:spring,apexHeight:apex,depth:1.5,profile:"pointed"};
  root.userData.sourceId='citadel-harbor-watergate-v2';
  return root;
}
