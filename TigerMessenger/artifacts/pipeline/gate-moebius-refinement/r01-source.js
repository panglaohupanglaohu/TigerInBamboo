import * as THREE from 'three';

/** V10 gate: retain the three original longitudinal arch stations and rail opening. */
export function installGateMoebiusV10(gate){
 const seat=gate.userData.seatRoot;if(seat.userData.moebiusV10)return;
 const root=new THREE.Group();root.name='gate-moebius-v10';seat.add(root);
 const stone=new THREE.MeshBasicMaterial({color:0x607ea8});
 const bronze=new THREE.MeshBasicMaterial({color:0x958464});
 const dark=new THREE.LineBasicMaterial({color:0x253952});
 const glass=new THREE.MeshBasicMaterial({color:0xa4dfd0,transparent:true,opacity:.23,depthWrite:false,side:THREE.DoubleSide});
 function mesh(g,m,name,x,y,z,solid=false){const o=new THREE.Mesh(g,m);o.name=name;o.position.set(x,y,z);o.userData.citadelSolidExterior=solid;root.add(o);return o;}
 function tube(points,r,m,name){return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),32,r,6,false),m,name,0,0,0);}
 for(const old of seat.children.filter(o=>/^(gate-arch-|leftTowerGroup$|rightTowerGroup$|channel-pier-)/.test(o.name))){
  old.visible=false;old.traverse(o=>o.userData.citadelSolidExterior=false);
 }
 for(const z of [-13.2,0,13.2]){
  const inner=4.2,outer=5.0,spring=11;
  const shape=new THREE.Shape();shape.moveTo(-outer,-1.6);shape.lineTo(-outer,spring);shape.absarc(0,spring,outer,Math.PI,0,true);shape.lineTo(outer,-1.6);shape.lineTo(inner,-1.6);shape.lineTo(inner,spring);shape.absarc(0,spring,inner,0,Math.PI,false);shape.lineTo(-inner,-1.6);shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:1.15,bevelEnabled:false,curveSegments:32});
  const arch=mesh(g,stone,'v10-gate-open-arch',0,0,z-.575,true);
  arch.add(new THREE.LineSegments(new THREE.EdgesGeometry(g,25),dark));
  for(const radius of [4.25,4.94])for(const zz of [z-.59,z+.59]){
   const pts=[new THREE.Vector3(-radius,-1.5,zz),new THREE.Vector3(-radius,spring,zz)];
   for(let j=0;j<=32;j++){const a=Math.PI-j/32*Math.PI;pts.push(new THREE.Vector3(Math.cos(a)*radius,spring+Math.sin(a)*radius,zz));}
   pts.push(new THREE.Vector3(radius,-1.5,zz));
   // Polyline follows the arch without Catmull-Rom overshoot into the passage.
   root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xb6a67d})));
  }
  // Engraved joints and solid bronze mouldings, on both faces of each arch.
  for(const face of [-1,1]){
   for(let i=1;i<24;i++){const a=i/24*Math.PI;const points=[4.22,4.98].map(r=>new THREE.Vector3(Math.cos(a)*r,11+Math.sin(a)*r,z+face*.582));const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),dark);line.name='v11-arch-stone-joint';root.add(line);}
   for(const radius of[4.23,4.97])mesh(new THREE.TorusGeometry(radius,.035,5,64,Math.PI),bronze,'v11-bronze-arch-moulding',0,11,z+face*.63);
  }
  for(const side of [-1,1]){
   const x=side*5.55;
   for(const face of[-1,1])for(const y of[8.5,11]){
    const cx=side*4.85,cz=z+face*.76,r=y===11?.68:.43;
    mesh(new THREE.CircleGeometry(r*.86,28),new THREE.MeshBasicMaterial({color:0x344c67,side:THREE.DoubleSide}),'v11-bearing-recess',cx,y,cz);
    for(const f of[1,.74,.33])mesh(new THREE.TorusGeometry(r*f,.045,6,28),bronze,'v11-bearing-ring',cx,y,cz+face*.05);
    for(let b=0;b<8;b++){const a=b/8*Math.PI*2;mesh(new THREE.SphereGeometry(.055,6,4),bronze,'v11-bearing-rivet',cx+Math.cos(a)*r*.88,y+Math.sin(a)*r*.88,cz+face*.1);}
   }

   mesh(new THREE.CylinderGeometry(.5,.5,7,20,1,true),glass,'v10-botanical-glass',x,4,z);
   for(const y of [.5,7.5])mesh(new THREE.CylinderGeometry(.61,.61,.15,20),bronze,'v10-pod-collar',x,y,z);
   for(const dx of [-.48,.48])mesh(new THREE.CylinderGeometry(.045,.045,7,6),bronze,'v10-pod-rib',x+dx,4,z);
   for(let k=0;k<6;k++){
    const y=1+k*.92,a=k*2.4;
    const leaf=mesh(new THREE.SphereGeometry(.26,8,5),new THREE.MeshBasicMaterial({color:k%2?0x678a6f:0x99b482}),'v10-pod-leaf',x+Math.cos(a)*.22,y,z+Math.sin(a)*.22);
    leaf.scale.set(.5,1.7,.7);leaf.rotation.z=Math.sin(a)*.7;
   }
   mesh(new THREE.CylinderGeometry(.035,.06,7,6),bronze,'v10-plant-stem',x,4,z);
   for(const y of [8.5,11]){
    const ring=mesh(new THREE.TorusGeometry(y===11?.54:.34,.08,6,24),bronze,'v10-mechanical-ring',side*4.8,y,z+.65);
    mesh(new THREE.CylinderGeometry(.15,.15,.15,12),bronze,'v10-mechanical-hub',side*4.8,y,z+.65).rotation.x=Math.PI/2;
   }
   for(let k=0;k<3;k++)tube([new THREE.Vector3(side*(5.1+k*.18),0,z),new THREE.Vector3(side*(5.1+k*.18),8,z),new THREE.Vector3(side*(5+k*.18),12+k*.8,z)],.035,bronze,'v10-service-conduit');
   mesh(new THREE.ConeGeometry(.075,1.3,8),bronze,'v10-finial',side*5.2,15,z);
  }
 }
 root.userData.refinement=1;
 seat.userData.moebiusV10=root;
 gate.userData.targetMetrics={...gate.userData.targetMetrics,passageWidth:8.4,passageApex:15.2,towerHeight:15.65,wallWidth:12.4};
}
