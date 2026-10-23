import * as THREE from 'three';
import {GREG_LAKE_PALETTE as P} from './swampGregVisuals.js';
import {createSwampLivingPathConstraints} from './swampGregLivingPaths.js';

// Project plant designs informed by Fallon's observation-first ecology; not
// Aquamarine assets, biological claims, or a replacement of story vegetation.
export const GREG_ECOLOGY_SPECIES = Object.freeze([
  {id:'fold-fan', minY:33, maxY:42, height:1.05, radius:.42, color:P.foliage},
  {id:'cup-fern', minY:29.1, maxY:33, height:.8, radius:.42, color:P.foliageShade},
  {id:'lantern-sedge', minY:25.5, maxY:29.1, height:1.45, radius:.34, color:P.foliage},
]);
const point=(r,a,y)=>new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r);
function routeDistance(p,route){
  let best=Infinity;
  for(let i=1;i<route.length;i++){
    const a=new THREE.Vector3(...route[i-1]),b=new THREE.Vector3(...route[i]);
    const d=b.clone().sub(a),t=THREE.MathUtils.clamp(p.clone().sub(a).dot(d)/Math.max(d.lengthSq(),1e-8),0,1),q=a.addScaledVector(d,t);
    if(Math.abs(q.y-p.y)<2)best=Math.min(best,Math.hypot(q.x-p.x,q.z-p.z));
  }
  return best;
}
function makePlant(species){
  const positions=[],colors=[],rootColor=new THREE.Color(P.bark),leafColor=new THREE.Color(species.color);
  function geometry(g,m,c){
    const flat=g.index?g.toNonIndexed():g,attr=flat.attributes.position;
    for(let i=0;i<attr.count;i++){positions.push(...new THREE.Vector3().fromBufferAttribute(attr,i).applyMatrix4(m));colors.push(c.r,c.g,c.b);}
    if(flat!==g)flat.dispose();g.dispose();
  }
  function stem(a,b,width,c){
    const delta=b.clone().sub(a),pose=new THREE.Object3D();pose.position.copy(a).add(b).multiplyScalar(.5);pose.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize());pose.updateMatrix();geometry(new THREE.CylinderGeometry(width*.62,width,delta.length(),6),pose.matrix,c);
  }
  // Each plant has a buried crown and three continuous roots; no floating leaves.
  for(let k=0;k<3;k++)stem(point(.16,k*Math.PI*2/3,-.018),new THREE.Vector3(0,.14,0),.034,rootColor);
  const reed=species.id==='lantern-sedge',count=reed?3:6;
  for(let k=0;k<count;k++){
    const angle=k*Math.PI*2/count,base=new THREE.Vector3(0,.09,0),height=species.height*(.83+.17*Math.sin(k*2+1));
    if(reed){
      const tip=point(.18,angle,height);stem(base,tip,.021,rootColor);
      const pose=new THREE.Object3D();pose.position.copy(tip);pose.scale.set(.062,.145,.062);pose.updateMatrix();geometry(new THREE.SphereGeometry(1,6,4),pose.matrix,new THREE.Color(P.warm));
    }
    const shape=(t,side)=>{
      const radius=(reed?.28:species.radius)*Math.sin(t*Math.PI*.52),width=(reed?.043:.11)*Math.sin(Math.PI*t);
      const y=.1+(reed?height*.56*t:height*(species.id==='cup-fern'?t*t:.85*Math.sin(t*1.7)));
      return new THREE.Vector3(Math.cos(angle)*radius-Math.sin(angle)*width*side,y+(side===0?.035:0)*Math.sin(Math.PI*t),Math.sin(angle)*radius+Math.cos(angle)*width*side);
    };
    for(let j=0;j<7;j++)for(const side of [-1,1]){
      const t=j/7,u=(j+1)/7,c=leafColor.clone().multiplyScalar(side<0?.82:1);
      for(const v of [shape(t,0),shape(u,0),shape(t,side),shape(t,side),shape(u,0),shape(u,side)]){positions.push(...v);colors.push(c.r,c.g,c.b);}
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}

export function installSwampGregEcology(swamp,{enabled=true}={}){
  if(swamp.userData.gregEcology){swamp.userData.gregEcology.setEnabled(enabled);return swamp.userData.gregEcology;}
  if(!enabled)return null;
  const plan=swamp.userData.gregSpatialPlan;if(!plan)return null;
  const shelves=swamp.getObjectByName('v2-bank-rock-shelves'),supports=[...plan.walkMeshes,...(shelves?[shelves]:[])];
  swamp.updateWorldMatrix(true,true);
  const inverse=swamp.matrixWorld.clone().invert(),up=new THREE.Vector3(0,1,0).transformDirection(swamp.matrixWorld),ray=new THREE.Raycaster();
  function supportAt(p){
    const origin=swamp.localToWorld(p.clone().add(new THREE.Vector3(0,.5,0)));ray.set(origin,up.clone().negate());
    const hit=ray.intersectObjects(supports,false).find(h=>h.face.normal.clone().transformDirection(h.object.matrixWorld).dot(up)>.9);
    if(!hit)return null;const local=hit.point.clone().applyMatrix4(inverse);return Math.abs(local.y-p.y)<.12?{point:local,mesh:hit.object}:null;
  }
  const candidates=[];
  // Keep the entire 2-world-unit landing free. Plants occupy existing rock
  // crevices outside the new walkway, never narrow its edge into a flower bed.
  if(shelves){
    const g=shelves.geometry.index?shelves.geometry.toNonIndexed():shelves.geometry,p=g.attributes.position,relative=inverse.clone().multiply(shelves.matrixWorld);
    for(let i=0;i<p.count;i+=3){
      const a=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(relative),b=new THREE.Vector3().fromBufferAttribute(p,i+1).applyMatrix4(relative),c=new THREE.Vector3().fromBufferAttribute(p,i+2).applyMatrix4(relative);
      if(b.clone().sub(a).cross(c.clone().sub(a)).normalize().y<.9)continue;
      candidates.push({point:a.add(b).add(c).multiplyScalar(1/3),zone:'rock-crevice'});
    }if(g!==shelves.geometry)g.dispose();
  }
  const records=[],counts=[0,0,0],rejected={support:0,path:0,story:0,spacing:0,living:0};
  const living=createSwampLivingPathConstraints(swamp);
  const stories=[...(swamp.userData.tigerWalkSurfaces||[]).map(o=>({p:o.position,r:5})),...[swamp.userData.shipyard?.dock,swamp.userData.shipyard?.barge].filter(Boolean).map(o=>({p:o.position,r:6}))];
  for(const c of candidates){
    const speciesIndex=GREG_ECOLOGY_SPECIES.findIndex(s=>c.point.y>=s.minY&&c.point.y<s.maxY);if(speciesIndex<0||counts[speciesIndex]>=22)continue;
    const species=GREG_ECOLOGY_SPECIES[speciesIndex];
    if(routeDistance(c.point,plan.route)<2.15+species.radius){rejected.path++;continue;}
    if(living&&!living.inspectPlant({position:c.point.toArray(),radius:species.radius,height:species.height+.16}).allowed){rejected.living++;continue;}
    if(stories.some(s=>Math.abs(s.p.y-c.point.y)<3&&Math.hypot(s.p.x-c.point.x,s.p.z-c.point.z)<s.r)){rejected.story++;continue;}
    if(records.some(r=>new THREE.Vector3(...r.position).distanceTo(c.point)<1.2)){rejected.spacing++;continue;}
    const foot=[new THREE.Vector3(),new THREE.Vector3(.17,0,0),new THREE.Vector3(-.17,0,0),new THREE.Vector3(0,0,.17),new THREE.Vector3(0,0,-.17)].map(d=>supportAt(c.point.clone().add(d)));
    if(foot.some(x=>!x)){rejected.support++;continue;}
    records.push({species:species.id,speciesIndex,position:foot[0].point.toArray(),zone:c.zone,supportName:foot[0].mesh.name,rootSupportSamples:5,waterClearanceLocal:foot[0].point.y-25,pathDistanceLocal:routeDistance(c.point,plan.route),radiusLocal:species.radius,radius:species.radius,height:species.height+.16});counts[speciesIndex]++;
  }
  const root=new THREE.Group();root.name='greg-swamp-rooted-ecology';root.userData.gregEcology=true;
  const material=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,fog:false,toneMapped:false}),pose=new THREE.Object3D();let renderMeshes=0;
  GREG_ECOLOGY_SPECIES.forEach((species,speciesIndex)=>{
    const list=records.filter(r=>r.speciesIndex===speciesIndex);if(!list.length)return;
    const mesh=new THREE.InstancedMesh(makePlant(species),material,list.length);mesh.name='greg-ecology-'+species.id;mesh.userData.gregVisualRole='ecology';mesh.userData.ecologySpecies=species.id;mesh.userData.rootedInstances=list;
    list.forEach((r,i)=>{pose.position.fromArray(r.position);pose.rotation.set(0,i*2.399,0);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);});mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);renderMeshes++;
  });
  swamp.add(root);
  const report={version:1,frame:'inner-swamp-local',worldScale:plan.worldScale,root,records,counts,renderMeshes,rejected,waterSurfaceInstances:0,maxWorldHeight:Math.max(...GREG_ECOLOGY_SPECIES.map(s=>s.height))*plan.worldScale,
    setEnabled(value){root.visible=Boolean(value);},
    dispose(){root.removeFromParent();root.traverse(o=>{if(o.isInstancedMesh)o.geometry.dispose();});material.dispose();delete swamp.userData.gregEcology;},
  };swamp.userData.gregEcology=report;return report;
}
