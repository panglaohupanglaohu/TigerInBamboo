import * as T from 'three';

/** Plant only after the rail warp: all roots are ray hits on real retained rock
 * or real stone walls. No guessed shelf height, billboard dirt or floating ball. */
export function plantHighlandGateLandscape(root,{curve,railU}={}){
 if(!root?.userData.toRailWorld||!curve)throw new TypeError('Gate landscape requires final rail-seated geometry');
 root.updateWorldMatrix(true,true);
 const rocks=root.children.filter(m=>m.isMesh&&/rock-foundation|foot-rock/.test(m.name));
 const walls=root.children.filter(m=>m.isMesh&&m.userData.approvedGateMonument&&m.userData.citadelSolidExterior&&!m.userData.highlandGateWalkable&&m.material.name.endsWith('-stone'));
 const masonry=root.children.filter(m=>m.isMesh&&m.userData.approvedGateMonument&&m.userData.citadelSolidExterior);
 const walks=root.children.filter(m=>m.isMesh&&m.userData.highlandGateWalkable);
 const group=new T.Group();group.name='highland-gate-rooted-landscape';root.add(group);
 const leaf=[0x556f46,0x73894e,0x3f664c].map(color=>new T.MeshStandardMaterial({color,roughness:1})),wood=new T.MeshStandardMaterial({color:0x6f6245,roughness:1});
 for(const m of[...leaf,wood])m.userData.preserveCitadelMaterial=true;
 const batches=new Map(),roots=[],wallRoots=[],ray=new T.Raycaster(),inv=root.matrixWorld.clone().invert(),rail=[];
 for(let d=-52;d<=52;d+=.5)rail.push(curve.getPointAt((railU+d/curve.getLength()+1)%1));
 const gap=p=>Math.min(...rail.map(q=>p.distanceTo(q)));
 function piece(g,mat,matrix){g.applyMatrix4(matrix);const b=g.index?g.toNonIndexed():g;let arrays=batches.get(mat);if(!arrays)batches.set(mat,arrays={position:[],normal:[]});arrays.position.push(...b.attributes.position.array);arrays.normal.push(...b.attributes.normal.array);if(b!==g)b.dispose();g.dispose();}
 function form(frame,pos,scale,mat,kind='leaf'){const g=kind==='stem'?new T.CylinderGeometry(.07,.105,1,5):new T.IcosahedronGeometry(1,1),local=new T.Matrix4().compose(new T.Vector3(...pos),new T.Quaternion(),new T.Vector3(...scale));piece(g,mat,frame.clone().multiply(local));}
 function sample(x,y,z,kind='rock'){
  const world=root.userData.toRailWorld(x,y,z),up=world.clone().normalize();ray.set(world,up.clone().negate());ray.far=45;const hit=ray.intersectObjects(kind==='rock'?rocks:walks,false)[0];if(!hit)return null;
  const normal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld);return{hit,up,normal};
 }
 let rejectedRail=0,rejectedWalk=0,rejectedCovered=0;
 for(let i=0;i<230;i++){
  const side=i%2?1:-1,x=side*(18.8+(i*7.13%18)),z=-24+(i*5.371%48),s=sample(x,8,z);if(!s||s.normal.dot(s.up)<.42)continue;
  const p=s.hit.point,clearance=gap(p),h=.65+(i%5)*.22,r=.45+(i%4)*.13;
  if(clearance<7.5+r){rejectedRail++;continue;}
  ray.set(p.clone().addScaledVector(s.up,30),s.up.clone().negate());ray.far=30.08;if(ray.intersectObjects(masonry,false).length){rejectedCovered++;continue;}
  // Five real vertical probes keep foliage off retained stairs and decks.
  let blocks=false;const tangent=new T.Vector3(1,0,0).transformDirection(root.matrixWorld),other=new T.Vector3().crossVectors(s.up,tangent).normalize();
  for(const[a,b]of[[0,0],[r,0],[-r,0],[0,r],[0,-r]]){ray.set(p.clone().addScaledVector(tangent,a).addScaledVector(other,b).addScaledVector(s.up,h+.3),s.up.clone().negate());ray.far=h+.65;if(ray.intersectObjects(walks,false).length){blocks=true;break;}}
  if(blocks){rejectedWalk++;continue;}
  const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),s.up),frame=inv.clone().multiply(new T.Matrix4().compose(p,q,new T.Vector3(1,1,1)));
  form(frame,[0,h*.29,0],[1,h*.58,1],wood,'stem');
  for(let j=0;j<6;j++){const a=j*2.4+i*.7,spread=j===0?0:r*.58;form(frame,[Math.cos(a)*spread,h*(.35+(j%3)*.19),Math.sin(a)*spread],[r*(.60+(j%2)*.16),h*.28,r*.61],leaf[(i+j)%3]);}
  roots.push({world:p.toArray(),local:p.clone().applyMatrix4(inv).toArray(),rock:s.hit.object.name,faceIndex:s.hit.faceIndex,normal:s.normal.toArray(),railClearance:clearance,canopyRadius:r,canopyHeight:h});
 }
 // Sparse seams grow real short stems and small leaves, each seated again on
 // the final battered wall instead of an unwarped decorative plane.
 for(const side of[-1,1])for(let cluster=0;cluster<9;cluster++)for(let j=0;j<6;j++){
  const y=4.8+cluster*1.65-j*.21,z=-4+(cluster%3)*3.8+Math.sin(j*.7+cluster)*.24,origin=root.userData.toRailWorld(side*35,y,z),toward=root.userData.toRailWorld(side*11,y,z);
  ray.set(origin,toward.clone().sub(origin).normalize());ray.far=28;const hit=ray.intersectObjects(walls,false)[0];if(!hit||gap(hit.point)<8)continue;
  const n=hit.face.normal.clone().transformDirection(hit.object.matrixWorld),p=hit.point.clone().addScaledVector(n,.028),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),n),frame=inv.clone().multiply(new T.Matrix4().compose(p,q,new T.Vector3(1,1,1)));
  form(frame,[0,0,.025],[.07,.26,.035],wood);form(frame,[.10*Math.sin(j),-.04,.055],[.18,.13,.075],leaf[(j+cluster)%3]);form(frame,[-.12,-.10,.065],[.16,.13,.06],leaf[(j+cluster+1)%3]);wallRoots.push({world:hit.point.toArray(),normal:n.toArray(),railClearance:gap(hit.point),wall:hit.object.name,faceIndex:hit.faceIndex});
 }
 for(const[material,a]of batches){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(a.position,3));g.setAttribute('normal',new T.Float32BufferAttribute(a.normal,3));const m=new T.Mesh(g,material);m.name='highland-rooted-foliage';m.castShadow=m.receiveShadow=true;m.userData={preserveCitadelMaterials:true,skipInkOutline:true};group.add(m);}
 root.userData.rootedLandscape={version:1,roots,wallRoots,rejectedRail,rejectedWalk,rejectedCovered,rockSurface:'post-rail-warp triangles',clearanceSamplingStep:.5,seed:713,draws:group.children.length};return group;
}
