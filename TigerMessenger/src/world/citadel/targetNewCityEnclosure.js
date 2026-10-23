import * as THREE from 'three';

// Coordinates are already proportion-deformed MAIN local coordinates. The
// caller applies the radial city placement once, after this factory returns.
export function createTargetNewCityEnclosure({surfaceHeightAt,materials,court=null,scale=1.1}={}){
 const group=new THREE.Group();group.name='target-new-city-walled-enclosure';
 const owned=new Set(),privateMaterials=new Set(),walls=[],rejected=[],footprints=[],publicMeshes=[];
 const report={version:'walled-court-1',frame:'deformed-main-local',walls,rejected,footprints,gates:[],towers:[],fountain:{built:false},publicRoutes:[],groundSamplingStep:.45,syntheticSupport:typeof surfaceHeightAt!=='function'};
 const own=(g)=>{owned.add(g);return g;};
 function mesh(name,g,mat,x=0,y=0,z=0){const m=new THREE.Mesh(own(g),typeof mat==='string'?materials[mat]:mat);m.name=name;m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;m.userData.preserveCitadelMaterials=true;group.add(m);return m;}
 function box(name,w,h,d,x,y,z,mat='stone'){return mesh(name,new THREE.BoxGeometry(w,h,d),mat,x,y,z);}
 function walk(m){m.userData.targetWalkable=true;m.userData.newCityPublicWalkable=true;publicMeshes.push(m);return m;}
 function ground(x,z,w,d,yaw=0){
  const samples=[];for(let a=0;a<=Math.ceil(w/.45);a++)for(let b=0;b<=Math.ceil(d/.45);b++){
   const u=-w/2+w*a/Math.ceil(w/.45),v=-d/2+d*b/Math.ceil(d/.45),px=x+u*Math.cos(yaw)+v*Math.sin(yaw),pz=z-u*Math.sin(yaw)+v*Math.cos(yaw),y=surfaceHeightAt?surfaceHeightAt(px,pz):null;
   samples.push({x:px,z:pz,y});
  }
  if(samples.some(s=>!Number.isFinite(s.y)))return {ok:false,reason:'missing-actual-ground',samples};
  const low=Math.min(...samples.map(s=>s.y)),high=Math.max(...samples.map(s=>s.y));
  return{ok:high-low<=1.25,reason:high-low>1.25?'steep-actual-ground':null,low,high,samples};
 }
 function register(id,x,z,w,d,bottom,top,yaw=0,extra={}){const polygon=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([a,b])=>[x+a*Math.cos(yaw)+b*Math.sin(yaw),z-a*Math.sin(yaw)+b*Math.cos(yaw)]);const row={id,polygon,floorY:bottom,roofY:top,...extra};footprints.push(row);return row;}
 function wallLine(id,a,b){
  const len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(len/2.5),yaw=-Math.atan2(b[1]-a[1],b[0]-a[0]);
  for(let i=0;i<n;i++){
   const t=(i+.5)/n,x=THREE.MathUtils.lerp(a[0],b[0],t),z=THREE.MathUtils.lerp(a[1],b[1],t),w=len/n+.018,d=.92,s=ground(x,z,w,d,yaw),name=`new-city-enclosure-${id}-${i}`;
   if(!s.ok){rejected.push({id:name,...s});continue;}
   const floor=s.low-.08,top=s.high+3.4,m=box(name,w,top-floor,d,x,(top+floor)/2,z);m.rotation.y=yaw;
   const cap=box(name+'-cap',w+.08,.2,1.06,x,top+.1,z,'trim');cap.rotation.y=yaw;
   for(let k=0;k<2;k++){const dx=(-.27+.54*k)*w,cr=box(name+'-merlon-'+k,.58,.56,1.02,x+Math.cos(yaw)*dx,top+.48,z-Math.sin(yaw)*dx,'trim');cr.rotation.y=yaw;}
   walls.push({id:name,support:s.samples,top,bottom:floor});register(name,x,z,w,d,floor,top+.76,yaw,{enclosure:true});
  }
 }
 function gate(id,x,z,yaw=0){
  const width=6.8,depth=1.08,s=ground(x,z,width,depth,yaw);if(!s.ok){rejected.push({id,...s});return;}
  const floor=s.high+.035,spring=floor+2.6,r=2.25,top=floor+5.3,shape=new THREE.Shape();shape.moveTo(-width/2,s.low-.08);shape.lineTo(-width/2,top);shape.lineTo(width/2,top);shape.lineTo(width/2,s.low-.08);shape.lineTo(r,s.low-.08);shape.lineTo(r,spring);
  for(let i=1;i<=24;i++){const a=i*Math.PI/24;shape.lineTo(r*Math.cos(a),spring+r*Math.sin(a));}shape.lineTo(-r,s.low-.08);shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false});g.translate(0,0,-depth/2);const m=mesh(id,g,'stone',x,0,z);m.rotation.y=yaw;
  const cap=box(id+'-cap',width+.16,.28,1.24,x,top+.14,z,'trim');cap.rotation.y=yaw;
  const sill=walk(box(id+'-walking-sill',4.5,floor-s.low+.09,1.14,x,(floor+s.low-.09)/2,z,'trim'));sill.rotation.y=yaw;
  report.gates.push({id,center:[x,floor,z],yaw,clearWidth:4.5,clearHeight:2.6,through:true,support:s.samples});register(id,x,z,width,depth,s.low-.08,top+.28,yaw,{enclosure:true,opening:{width:4.5,height:2.6}});
 }
 // Front has a generous unbuilt central gap over the original main stairs.
 wallLine('rear-left',[-22,-20],[-3.4,-20]);wallLine('rear-right',[3.4,-20],[22,-20]);gate('new-city-rear-gate',0,-20);
 for(const side of[-1,1]){
  const frontZ=side<0?7.2:8.2;
  wallLine('side-rear-'+side,[side*22,-20],[side*22,-2.4]);
  wallLine('side-front-'+side,[side*22,4.4],[side*22,frontZ]);gate('new-city-side-gate-'+side,side*22,1,Math.PI/2);
  wallLine('front-'+side,[side*22,frontZ],[side*4.9,frontZ]);
  for(const z of[-18.1,6.3]){
   const x=side*20.1,id=`new-city-corner-tower-${side}-${z}`,s=ground(x,z,3.8,3.8);if(!s.ok){rejected.push({id,...s});continue;}
   const h=6.0,geometry=new THREE.CylinderGeometry(2.22,2.65,h+s.high-s.low,4,1);geometry.rotateY(Math.PI/4);mesh(id,geometry,'stone',x,(s.low+s.high+h)/2,z);
   const crown=box(id+'-crown',3.3,.25,3.3,x,s.high+h+.125,z,'trim');
   const roof=new THREE.ConeGeometry(2.65,1.25,4);roof.rotateY(Math.PI/4);mesh(id+'-roof',roof,'roof',x,s.high+h+.85,z);
   report.towers.push({id,position:[x,s.low,z],support:s.samples});register(id,x,z,3.8,3.8,s.low,s.high+h+1.5,0,{enclosure:true});
  }
 }
 if(court){
  const {top,bottom,minX,maxX,minZ,maxZ}=court,cx=0,cz=(minZ+maxZ)/2,radius=1.3;
  const shape=new THREE.Shape();shape.moveTo(minX,minZ);shape.lineTo(maxX,minZ);shape.lineTo(maxX,maxZ);shape.lineTo(minX,maxZ);shape.closePath();const hole=new THREE.Path();hole.absarc(cx,cz,radius,0,Math.PI*2,true);shape.holes.push(hole);
  const g=new THREE.ExtrudeGeometry(shape,{depth:top-bottom,bevelEnabled:false,curveSegments:48});g.rotateX(-Math.PI/2);g.scale(1,1,-1);g.translate(0,bottom,0);g.computeVertexNormals();
  // Reflection above changes winding; restore outward faces for ray support.
  const pos=g.attributes.position,norm=g.attributes.normal;for(let i=0;i<pos.count;i+=3)for(const attr of[pos,norm]){const a=[attr.getX(i+1),attr.getY(i+1),attr.getZ(i+1)];attr.setXYZ(i+1,attr.getX(i+2),attr.getY(i+2),attr.getZ(i+2));attr.setXYZ(i+2,...a);}g.computeVertexNormals();
  walk(mesh('rear-court-fountain-bypass',g,'trim'));
  register('rear-court-fountain-bypass',0,(minZ+maxZ)/2,maxX-minX,maxZ-minZ,bottom,top,0,{walkable:true,support:true,holes:[{center:[cx,cz],radius}]});
  const waterMaterial=new THREE.MeshStandardMaterial({color:0x82b4bf,roughness:.26,metalness:.05});waterMaterial.userData.preserveCitadelMaterials=true;privateMaterials.add(waterMaterial);
  mesh('new-city-rear-fountain-basin',new THREE.CylinderGeometry(radius,radius,.26,40),'stone',cx,top+.13,cz);
  const rim=new THREE.TorusGeometry(1.16,.12,6,40);rim.rotateX(Math.PI/2);mesh('new-city-rear-fountain-rim',rim,'trim',cx,top+.44,cz);
  mesh('new-city-rear-fountain-water',new THREE.CylinderGeometry(1.04,1.04,.04,40),waterMaterial,cx,top+.34,cz);
  mesh('new-city-rear-fountain-stem',new THREE.CylinderGeometry(.16,.29,1.35,12),'trim',cx,top+.91,cz);
  const bowl=new THREE.TorusGeometry(.5,.105,6,24);bowl.rotateX(Math.PI/2);mesh('new-city-rear-fountain-bowl',bowl,'trim',cx,top+1.5,cz);
  for(let i=0;i<4;i++){const a=i*Math.PI/2,pts=[];for(let k=0;k<=12;k++){const t=k/12;pts.push(new THREE.Vector3(Math.cos(a)*(.1+.7*t),top+1.53+.32*Math.sin(Math.PI*t)-1.13*t,cz+Math.sin(a)*(.1+.7*t)));}mesh('new-city-rear-fountain-stream-'+i,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),12,.028,5,false),waterMaterial);}
  const sideX=(radius+Math.min(maxX,-minX))*.5;
  report.publicRoutes=[[-sideX,sideX].map(x=>[[0,top,maxZ-.9],[x,top,maxZ-.9],[x,top,minZ+.9],[0,top,minZ+.9]])].flat();
  report.fountain={built:true,center:[cx,top,cz],radius,sideClearance:Math.min(maxX,-minX)-radius,walkable:false};
  register('new-city-rear-fountain',cx,cz,radius*2,radius*2,top,top+1.8,0,{obstacle:true,walkable:false});
  // Rear exit bridge is sampled independently, never a hovering extension.
  const gateReport=report.gates.find(x=>x.id==='new-city-rear-gate');
  if(gateReport){const end=gateReport.center[2],len=Math.abs(minZ-end),z=(minZ+end)/2,s=ground(0,z,2.7,len);if(s.ok&&Math.abs(s.high-top)<.3){const y=Math.max(top,s.high+.035);walk(box('rear-court-gate-path',2.7,y-s.low+.12,len+.1,0,(y+s.low-.12)/2,z,'trim'));report.rearExitConnected=true;}else{report.rearExitConnected=false;rejected.push({id:'rear-court-gate-path',reason:'unsupported-or-step-above-limit',...s});}}
 }
 // Bake repeated masonry into material batches; genuine gates and public
 // ground remain individually inspectable. Preserve logical wall face ranges.
 const buckets=new Map();group.updateMatrixWorld(true);
 for(const node of [...group.children])if(node.isMesh&&/^(new-city-enclosure-|new-city-corner-tower-)/.test(node.name)){
  if(!buckets.has(node.material))buckets.set(node.material,[]);buckets.get(node.material).push(node);
 }
 report.staticBatching={sourceMeshes:0,batches:0};
 for(const[mat,nodes]of buckets){const positions=[],normals=[],segments=[];
  for(const node of nodes){node.updateMatrix();const g=node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone();g.applyMatrix4(node.matrix);segments.push({id:node.name,firstTriangle:positions.length/9,triangleCount:g.attributes.position.count/3});positions.push(...g.attributes.position.array);normals.push(...g.attributes.normal.array);g.dispose();node.removeFromParent();owned.delete(node.geometry);node.geometry.dispose();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.computeBoundingBox();g.computeBoundingSphere();const merged=mesh('new-city-enclosure-batch-'+report.staticBatching.batches,g,mat);merged.userData.enclosureFaces=segments;report.staticBatching.sourceMeshes+=nodes.length;report.staticBatching.batches++;
 }
 report.renderMeshes=group.children.filter(o=>o.isMesh).length;
 report.closedSides=report.towers.length===4&&report.gates.length===3&&rejected.filter(r=>r.id!=='rear-court-gate-path').length===0;
 group.updateMatrixWorld(true);return{group,report,publicMeshes,dispose(){group.removeFromParent();for(const g of owned)g.dispose();for(const m of privateMaterials)m.dispose();group.clear();}};
}
