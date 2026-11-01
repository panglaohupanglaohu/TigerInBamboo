import * as THREE from 'three';
import {createSwampGroundSampler} from '/TigerMessenger/src/world/swampGround.js';
import {MOEBIUS_PALETTE as P} from '/TigerMessenger/src/world/moebiusPalette.js';

// A reachable side-bank sample, in the swamp INNER frame (placement scale .5).
// Original tiger stairs, moving boats and whale/story anchors remain authoritative.
export function installSwampSpatialPlan(swamp) {
  if(new URLSearchParams(globalThis.location?.search||'').get('gregLakeSpatial')==='0')return null;
  if(swamp.userData.gregSpatialPlan)return swamp.userData.gregSpatialPlan;
  const steps=swamp.userData.tigerWalkSurfaces||[];
  if(steps.length<3)return null;
  const root=new THREE.Group();root.name='greg-swamp-three-bank-path';swamp.add(root);
  const stone=new THREE.MeshBasicMaterial({color:P.stone});
  const side=new THREE.MeshBasicMaterial({color:P.shadow});
  const surfaces=[],route=[],levels=[];
  const p=(angle,r,y)=>new THREE.Vector3(Math.cos(angle)*r,y,Math.sin(angle)*r);
  const radius=y=>13+(y-10)*.7-3.3;
  const add=(geometry,name,role='path')=>{
    const mesh=new THREE.Mesh(geometry,[stone,side]);mesh.name=name;
    mesh.userData.gregVisualRole=role;mesh.userData.gregWalkable=true;
    root.add(mesh);surfaces.push(mesh);return mesh;
  };
  // Closed annular slabs: top and underside are explicit, with real side faces.
  function sector(a,b,y,r,width,name) {
    // Sub-pixel physical overlap prevents float32 seams between separate tread rims.
    const direction=Math.sign(b-a);a-=direction*.0005;b+=direction*.0005;
    const n=Math.max(2,Math.ceil(Math.abs(b-a)*r/.5)),pos=[],indices=[],top=[];
    for(let i=0;i<=n;i++)for(const h of [y,y-.65])for(const rr of [r-width/2,r+width/2])pos.push(...p(a+(b-a)*i/n,rr,h));
    for(let i=0;i<n;i++){
      const j=i*4,k=(i+1)*4;
      // Both sides rendered via consistent winding, without an open sheet floor.
      top.push(j,k,j+1,j+1,k,k+1);
      indices.push(j+2,j+3,k+2,j+3,k+3,k+2,j,j+2,k,j+2,k+2,k,j+1,k+1,j+3,j+3,k+1,k+3);
    }
    indices.push(0,1,2,1,3,2,n*4,n*4+2,n*4+1,n*4+1,n*4+2,n*4+3);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    // Paths descend in decreasing angle; reversing this winding keeps tops upward.
    if(b<a)for(const list of [top,indices])for(let i=0;i<list.length;i+=3)[list[i+1],list[i+2]]=[list[i+2],list[i+1]];
    g.setIndex([...top,...indices]);g.addGroup(0,top.length,0);g.addGroup(top.length,indices.length,1);g.computeVertexNormals();
    return add(g,name);
  }
  function landing(a,b,y,index){
    const r=radius(y),mesh=sector(a,b,y,r,4,`greg-bank-terrace-${index}`);
    levels.push({id:index,innerY:y,heightFromRim:(y-40)*.5,waterClearance:(y-25)*.5,width:2,angleStart:a,angleEnd:b,radius:r*.5});
    for(let i=0;i<=12;i++)route.push(p(a+(b-a)*i/12,r,y));
    return mesh;
  }
  function flight(a,b,ya,yb,index){
    const n=32;
    for(let i=0;i<n;i++){
      const t=i/n,u=(i+1)/n,angle=a+(b-a)*t,next=a+(b-a)*u,y=THREE.MathUtils.lerp(ya,yb,t),r=radius(THREE.MathUtils.lerp(ya,yb,(t+u)/2));
      sector(angle,next,y,r,4,`greg-bank-flight-${index}-${i}`);
      route.push(p((angle+next)/2,r,y));
    }
  }
  const topY=34.8,start=steps[2].position.clone();start.y=topY;
  const end=p(.5,radius(topY),topY),delta=end.clone().sub(start),bridge=add(new THREE.BoxGeometry(4,.65,delta.length()+.2),'greg-bank-entry-link');
  bridge.position.copy(start).add(end).multiplyScalar(.5);bridge.position.y=topY-.325;
  bridge.rotation.y=Math.atan2(delta.x,delta.z);
  // BoxGeometry groups use slots 0..5. The top is stone; sides use the quiet shade.
  bridge.material=[side,side,stone,side,side,side];
  for(let i=0;i<=16;i++)route.push(start.clone().lerp(end,i/16));
  landing(.5,.08,topY,1);
  flight(.08,-.66,topY,30.8,1);
  landing(-.66,-.95,30.8,2);
  flight(-.95,-1.74,30.8,26.8,2);
  landing(-1.74,-2.03,26.8,3);
  // Short corbels bury their back ends in the existing bank; decks do not float
  // across the deliberate clearance between walking edge and irregular cliff.
  for(const [i,a,y] of [[1,.35,34.8],[2,.14,34.8],[3,-.29,32.8],[4,-.72,30.8],[5,-.9,30.8],[6,-1.34,28.8],[7,-1.8,26.8],[8,-1.98,26.8]]){
    const support=add(new THREE.BoxGeometry(1.8,1.4,3.6),`greg-bank-stone-corbel-${i}`,'stone');
    support.position.copy(p(a,radius(y)+3.1,y-1.32));support.rotation.y=Math.PI/2-a;support.material=[side,side,stone,side,side,side];
  }
  // Waymarks stand on the existing outer corbels, wholly outside the two-world-unit walking slab.
  const markerMaterial=new THREE.MeshBasicMaterial({color:P.brass});
  const markers=new THREE.InstancedMesh(new THREE.CylinderGeometry(.13,.18,1.8,8),markerMaterial,3),pose=new THREE.Object3D();
  markers.name='greg-bank-waymarks';markers.userData.gregVisualRole='stone';root.add(markers);
  for(const [i,a,y] of [[1,.35,34.8],[2,-.9,30.8],[3,-1.98,26.8]]){
    pose.position.copy(p(a,radius(y)+3.1,y-.62+.9));pose.updateMatrix();markers.setMatrixAt(i-1,pose.matrix);
  }
  // Static slabs share one vertex-colour draw. Metadata retains every logical tread.
  const positions=[],normals=[],colors=[],segments=[];
  for(const mesh of surfaces){
    mesh.updateMatrix();const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry,p=g.attributes.position,n=g.attributes.normal,normalMatrix=new THREE.Matrix3().getNormalMatrix(mesh.matrix);
    const start=positions.length/9;
    for(let i=0;i<p.count;i++){
      const group=g.groups.find(group=>i>=group.start&&i<group.start+group.count),material=Array.isArray(mesh.material)?mesh.material[group?.materialIndex??0]:mesh.material;
      positions.push(...new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrix));
      normals.push(...new THREE.Vector3().fromBufferAttribute(n,i).applyMatrix3(normalMatrix).normalize());colors.push(...material.color);
    }
    segments.push({name:mesh.name,firstTriangle:start,triangleCount:p.count/3});
    root.remove(mesh);if(g!==mesh.geometry)g.dispose();mesh.geometry.dispose();
  }
  const batchGeo=new THREE.BufferGeometry();batchGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));batchGeo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));batchGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));batchGeo.computeBoundingBox();batchGeo.computeBoundingSphere();
  const batch=new THREE.Mesh(batchGeo,new THREE.MeshBasicMaterial({vertexColors:true}));batch.name='greg-bank-walking-slab-batch';batch.userData.gregVisualRole='path';batch.userData.gregWalkable=true;batch.userData.segments=segments;root.add(batch);surfaces.splice(0,surfaces.length,batch);
  const existing=[swamp.getObjectByName('swamp-sinkhole-wall'),...steps,swamp.getObjectByName('swamp-lake-floor')].filter(Boolean);
  swamp.userData.sampleGroundRadius=createSwampGroundSampler(swamp,[...existing,...surfaces]);
  const report={version:1,scope:'three reachable side-bank terraces; original tiger stair retained',levels,route:route.map(v=>v.toArray()),walkMeshes:surfaces,root,worldScale:.5,frame:'inner-swamp-local',slabParts:segments.length,renderMeshes:2};
  swamp.userData.gregSpatialPlan=report;return report;
}
