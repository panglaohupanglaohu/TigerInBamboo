import * as THREE from 'three';
import {CANYON} from './canyon.js';
import {bookshopTownPose,BOOKSHOP_SITE_OUTLINE} from './bookshopTownSite.js';
import {solveStackWfc,sampleStackProfile} from './seaStackWfc.js';

export const seaStackTerracesEnabled = () => new URLSearchParams(globalThis.location?.search || '').get('seaStackTerraces') !== '0';

// Authored geometric specimen: duplicated-height rings make real horizontal
// shelves. This is a module-quality pass, not a claim of 3D WFC topology.
export function terraceStackGeometry(radius, height, seed) {
  const solution=new URLSearchParams(globalThis.location?.search||'').get('seaStackWfc')==='0'?null:solveStackWfc(seed);
  const phase = seed * 2.399963, low = .32 + .035 * Math.sin(seed), high = .65 + .045 * Math.cos(seed);
  const rings = [[0,1.1],[.10,1.08],[.16,.88],[.23,1.02],
    [low,1.01],[low,.70],[low+.035,.69],[high,.68],
    [high,.43],[high+.025,.42],[.91,.41],[1,.34]];
  const sides=32, positions=[], indices=[];
  for(let j=0;j<rings.length;j++) {
    const [t,r]=rings[j];
    for(let i=0;i<=sides;i++) {
      const a=(i%sides)*Math.PI*2/sides;
      // A displaced upper core leaves a broad shoulder on one side, not a skirt.
      const tier=j>=8?2:j>=5?1:0;
      const offset=tier*.09*radius;
      const fracture=1+.12*Math.sin(3*a+phase)+.055*Math.cos(7*a-phase);
      const shoulder=tier===1?.16*(.5+.5*Math.cos(a-phase)):tier===2?.10*(.5+.5*Math.cos(a-phase-1.8)):0;
      const shapedRadius=r+shoulder;
      const ledge=(j===4||j===5||j===7||j===8);
      const rough=ledge?0:.009*height*Math.sin(5*a+phase)*Math.sin(t*Math.PI);
      const cliffVariant=!solution||ledge||t===0?1:1+.045*(sampleStackProfile(solution.modules,t)-.85);
      const crown=t===1?height*(.018*Math.sin(3*a+phase)+.008*Math.cos(7*a)):0;
      positions.push(Math.cos(a)*radius*shapedRadius*fracture*cliffVariant+Math.cos(phase)*offset,
        -height/2+t*height+rough+crown,
        Math.sin(a)*radius*shapedRadius*fracture*cliffVariant*.83+Math.sin(phase)*offset);
    }
  }
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<sides;i++){
    const a=j*(sides+1)+i,b=a+1,c=a+sides+1,d=c+1;
    indices.push(a,c,b,b,c,d);
  }
  const top=positions.length/3;positions.push(Math.cos(phase)*radius*.18,height*.5,Math.sin(phase)*radius*.18);
  const bottom=positions.length/3;positions.push(0,-height/2,0);
  for(let i=0;i<sides;i++){indices.push(top,(rings.length-1)*(sides+1)+i+1,(rings.length-1)*(sides+1)+i);indices.push(bottom,i,i+1);}
  const indexed=new THREE.BufferGeometry();indexed.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));indexed.setIndex(indices);
  const g=indexed.toNonIndexed();indexed.dispose();g.computeVertexNormals();
  const colors=[],n=g.attributes.normal,p=g.attributes.position,c=new THREE.Color();
  for(let i=0;i<p.count;i++){
    const up=n.getY(i), shade=.83+.13*n.getX(i)+.08*n.getZ(i);
    // Limited semantic palette: pale cool shelves, quieter blue-grey walls,
    // olive vegetation. Lighting contrast comes from face orientation.
    c.setHex(up>.75?0xa2b0ad:0x748b99).multiplyScalar(shade);
    const t=(p.getY(i)+height/2)/height;
    if(t<.24)c.lerp(new THREE.Color(0x354f60),.65*(1-t/.24));
    colors.push(c.r,c.g,c.b);
  }
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeBoundingBox();g.computeBoundingSphere();
  if(solution)g.userData.wfc={...solution,modules:solution.modules.map(m=>m.id),scope:"cliff-detail-only; terraces and rim layout are authored"};
  g.userData.terraces={revision:1,seed,levels:[low,high],mode:'authored-asymmetric-shelves',footprintRadius:radius*1.25};
  return g;
}

// Finalize after the actual ocean mesh exists. Center anchors use its rendered
// triangles, including the canyon depression, rather than a nominal R sphere.
export function seatTerracedSeaStacks(scene, radius=160, railCurves={}, protectedRoots=[]) {
  if(!seaStackTerracesEnabled())return;
  const ocean=scene.getObjectByName('planet-v8-curved-ocean');if(!ocean)return;
  scene.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(),world=new THREE.Vector3(),audit=[];
  const waterAt=point=>{
    const direction=point.clone().normalize();
    ray.set(direction.clone().multiplyScalar(radius+100),direction.clone().negate());ray.far=radius+100;
    return ray.intersectObject(ocean,false)[0]?.point;
  };
  const rocks=[];scene.traverse(o=>{if(o.geometry?.userData.terraces)rocks.push(o);});
  const lat=THREE.MathUtils.degToRad(CANYON.lat),lon=THREE.MathUtils.degToRad(CANYON.lon);
  const canyonCenter=new THREE.Vector3(Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon));
  if(!rocks.length)return;
  // The square world AABB misses the public circle's intended open-space
  // clearance. Test the town's authored spherical footprint in its own chart.
  const townInverse=bookshopTownPose(radius).quaternion.clone().invert();
  const plazaMargin=direction=>{
    const local=direction.clone().applyQuaternion(townInverse);
    if(local.y<=0)return Infinity;
    return Math.hypot(local.x*radius/local.y,local.z*radius/local.y-BOOKSHOP_SITE_OUTLINE.centerZ)-BOOKSHOP_SITE_OUTLINE.radius;
  };
  const protectedBoxes=protectedRoots.filter(Boolean).map(o=>new THREE.Box3().setFromObject(o));
  const railPoints=Object.values(railCurves).flatMap(curve=>Array.from({length:2600},(_,i)=>curve.getPointAt(i/2600)));
  const reference=rocks[0].parent.localToWorld(new THREE.Vector3(85,-45,-60)).normalize();
  const rimTangent=reference.clone().addScaledVector(canyonCenter,-reference.dot(canyonCenter)).normalize();
  // Approved screen-left gate sector, mapped in the fixed overview camera.
  // Eight sites in staggered depth rows; never distribute around the full rim.
  const sites=[[21,.99],[23.4,.99],[25.8,.99],[21.6,1.20],[24,1.20],[26.4,1.20],[22.4,1.41],[25,1.41]];
  for(const [stackIndex,rock] of rocks.entries()){
    const data=rock.userData.seaStack, oldSea=new THREE.Vector3(...data.seaAnchor);
    if(stackIndex>=sites.length){rock.visible=false;rock.userData.excludedSeaStack=true;for(const detail of rock.parent.children.filter(o=>o.userData.stackOwner===data.detailId))detail.visible=false;audit.push({seed:rock.geometry.userData.terraces.seed,skipped:'outside-approved-gate-left-group'});continue;}
    let rimAngle=sites[stackIndex][1];
    const around=rimTangent.clone().applyAxisAngle(canyonCenter,sites[stackIndex][0]*Math.PI/18);
    const normal=new THREE.Vector3();
    let railClear=false;
    for(let attempt=0;attempt<12;attempt++){
      normal.copy(canyonCenter).multiplyScalar(Math.cos(rimAngle)).addScaledVector(around,Math.sin(rimAngle));
      railClear=railPoints.every(point=>{
        const along=THREE.MathUtils.clamp(point.dot(normal),radius-8,radius+data.height+8);
        return point.distanceToSquared(normal.clone().multiplyScalar(along))>(data.radius*1.3+5)**2;
      });
      railClear=railClear&&plazaMargin(normal)>data.radius*1.3+20;
      if(railClear){
        const footprint=data.radius*1.3+3;
        const axisBox=new THREE.Box3().setFromPoints([normal.clone().multiplyScalar(radius-8),normal.clone().multiplyScalar(radius+data.height)]).expandByScalar(footprint);
        railClear=protectedBoxes.every(box=>!box.intersectsBox(axisBox));
      }
      if(railClear)break;
      rimAngle+=.035;
    }
    // A blocked decorative site must not block startup or occupy a rail corridor.
    if(!railClear){rock.visible=false;rock.userData.excludedSeaStack=true;for(const detail of rock.parent.children.filter(o=>o.userData.stackOwner===data.detailId))detail.visible=false;audit.push({seed:rock.geometry.userData.terraces.seed,skipped:'protected-corridor-or-city'});continue;}
    const worldQ=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),normal);
    rock.quaternion.copy(rock.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(worldQ));
    data.worldUp=normal.toArray();data.rimAngle=rimAngle;data.placement='approved-gate-left-sector';
    ray.set(normal.clone().multiplyScalar(radius+100),normal.clone().negate());ray.far=200;
    const hit=ray.intersectObject(ocean,false)[0];
    if(!hit)throw new Error('Terraced sea stack has no ocean support');
    const sea=hit.point,center=sea.clone().addScaledVector(normal,data.height*.5-6);
    rock.position.copy(rock.parent.worldToLocal(center));rock.updateWorldMatrix(true,false);
    data.seaAnchor=sea.toArray();data.waterSupport='rendered-ocean-triangle';
    // Check all bottom-ring directions, not just the center anchor.
    let maxBaseAboveWater=-Infinity;
    const position=rock.geometry.attributes.position;
    for(let i=0;i<position.count;i++)if(position.getY(i)<-data.height/2+.001){
      const foot=rock.localToWorld(new THREE.Vector3().fromBufferAttribute(position,i)),water=waterAt(foot);
      if(water)maxBaseAboveWater=Math.max(maxBaseAboveWater,foot.length()-water.length());
    }
    if(maxBaseAboveWater>-.5){
      const shift=maxBaseAboveWater+.5;
      rock.getWorldPosition(world);world.addScaledVector(normal,-shift);rock.position.copy(rock.parent.worldToLocal(world));rock.updateWorldMatrix(true,false);
      maxBaseAboveWater-=shift;
    }
    // Move the existing foam/skerries with their parent stack's shore anchor.
    const ridge=rock.parent,from=oldSea.clone().normalize(),rotation=new THREE.Quaternion().setFromUnitVectors(from,normal);
    for(const detail of ridge.children.filter(o=>o.userData.stackOwner===data.detailId)){
      if(detail.name==='gate-sea-stack-surf'){
        const p=detail.geometry.attributes.position;
        for(let i=0;i<p.count;i++){
          world.fromBufferAttribute(p,i);detail.localToWorld(world);world.applyQuaternion(rotation);detail.worldToLocal(world);p.setXYZ(i,world.x,world.y,world.z);
        }
      }else{detail.getWorldPosition(world);world.applyQuaternion(rotation);detail.position.copy(ridge.worldToLocal(world));}
    }
    // Root points are obtained by actual triangle raycasts, in each rock's frame.
    const roots=[],matrix=new THREE.Matrix4(),q=new THREE.Quaternion();
    for(let j=0;j<48;j++){
      const a=j*2.399+rock.geometry.userData.terraces.seed,r=data.radius*(.28+(j%5)*.145);
      const origin=rock.localToWorld(new THREE.Vector3(Math.cos(a)*r,data.height,Math.sin(a)*r*.83));
      ray.set(origin,normal.clone().negate());ray.far=data.height*2;
      const h=ray.intersectObject(rock,false)[0];if(!h)continue;
      const local=rock.worldToLocal(h.point.clone());
      if(h.face.normal.y<.88 || local.y < -data.height*.25)continue;
      roots.push(local.toArray());
    }
    const bushGeo=new THREE.IcosahedronGeometry(1,1),bushMat=new THREE.MeshBasicMaterial({color:0x566e58});
    const bushes=new THREE.InstancedMesh(bushGeo,bushMat,roots.length);bushes.name='sea-stack-terrace-shrubs';
    roots.forEach((r,i)=>{const size=.42+(i%4)*.13;matrix.compose(new THREE.Vector3(...r).add(new THREE.Vector3(0,size*.32,0)),q,new THREE.Vector3(size,size*.44,size*.8));bushes.setMatrixAt(i,matrix);});
    rock.add(bushes);bushes.userData.roots=roots;
    audit.push({seed:rock.geometry.userData.terraces.seed,waterRadius:sea.length(),burial:sea.length()-rock.localToWorld(new THREE.Vector3(0,-data.height/2,0)).length(),maxBaseAboveWater,rimAngle,plazaClearance:plazaMargin(normal)-data.radius*1.3,roots:roots.length});
  }
  // Foam and detached blocks share the same rendered-triangle ocean sampler.
  scene.traverse(o=>{
    if(o.name==='gate-sea-stack-surf'){
      const p=o.geometry.attributes.position;
      for(let i=0;i<p.count;i++){
        world.fromBufferAttribute(p,i);o.localToWorld(world);const water=waterAt(world);if(water)world.copy(water).addScaledVector(water.clone().normalize(),.10);
        o.worldToLocal(world);p.setXYZ(i,world.x,world.y,world.z);
      }
      p.needsUpdate=true;o.geometry.computeBoundingSphere();
    }else if(o.name==='gate-sea-stack-fallen-block'){
      o.getWorldPosition(world);const water=waterAt(world);if(water)world.copy(water).addScaledVector(water.clone().normalize(),-.15);o.position.copy(o.parent.worldToLocal(world));
    }
  });
  scene.userData.seaStackTerraceAudit=audit;
}
