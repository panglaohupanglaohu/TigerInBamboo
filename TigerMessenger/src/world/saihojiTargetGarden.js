import * as THREE from 'three';
import { mergeStaticGroup } from './geometryMerge.js';

// Approved 2026-09-19 battle target. All coordinates are Kun island local,
// not planet/world coordinates; the six shallow basins travel with the garden.
export const SAIHOJI_TARGET_REVISION = 'ambush-target-20260919-v2';
export const SAIHOJI_TARGET_POOLS = Object.freeze([
  {x:-9.3,z:-.7,rx:1.45,rz:.75,phase:.2},
  {x:-5.6,z:1.35,rx:1.6,rz:.8,phase:1.1},
  {x:-1.7,z:-1.25,rx:1.5,rz:.78,phase:2.2},
  {x:2.2,z:1.25,rx:1.65,rz:.85,phase:.8},
  {x:6.3,z:-1.1,rx:1.55,rz:.8,phase:2.8},
  {x:10.0,z:1.0,rx:1.35,rz:.7,phase:1.7},
]);

export function isSaihojiPool(x,z,margin=0) {
  return SAIHOJI_TARGET_POOLS.some(p=>((x-p.x)/(p.rx+margin))**2+((z-p.z)/(p.rz+margin))**2<1);
}

export function buildSaihojiTargetGarden(island) {
  const group=new THREE.Group();group.name='saihoji-target-shallow-gardens';
  group.userData.targetRevision=SAIHOJI_TARGET_REVISION;
  const water=new THREE.MeshStandardMaterial({color:0x6caeaa,roughness:.88,metalness:0,flatShading:true});
  const earth=new THREE.MeshStandardMaterial({color:0x597459,roughness:1,flatShading:true});
  const stone=new THREE.MeshStandardMaterial({color:0x929280,roughness:1,flatShading:true});
  const moss=[0x80924f,0x6e8850,0x597b4c].map(color=>new THREE.MeshStandardMaterial({color,roughness:1,flatShading:true}));
  const count=16;
  const rockGeometry=new THREE.IcosahedronGeometry(1,0);
  for(const [index,p] of SAIHOJI_TARGET_POOLS.entries()) {
    const ring=[];
    for(let i=0;i<count;i++) {
      const a=i/count*Math.PI*2, r=1+.055*Math.sin(a*3+p.phase)+.025*Math.cos(a*5-p.phase);
      ring.push([p.x+Math.cos(a)*p.rx*r,p.z+Math.sin(a)*p.rz*r]);
    }
    // Opaque shallow water covers existing supporting ground. No deceptive
    // deep hole, waterfall, extra collision floor or navigable water crossing.
    const verts=[p.x,.115,p.z],faces=[];
    for(const [x,z] of ring)verts.push(x,.115,z);
    for(let i=0;i<count;i++)faces.push(0,(i+1)%count+1,i+1);
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(faces);geo.computeVertexNormals();
    const pond=new THREE.Mesh(geo,water);pond.name=`saihoji-target-pool-${index}`;pond.receiveShadow=true;group.add(pond);
    const banks=[],bankFaces=[];
    for(const [x,z] of ring)banks.push(x,.113,z,p.x+(x-p.x)*1.15,.15,p.z+(z-p.z)*1.15);
    for(let i=0;i<count;i++){const a=i*2,b=((i+1)%count)*2;bankFaces.push(a,b,a+1,a+1,b,b+1);}
    const bankGeo=new THREE.BufferGeometry();bankGeo.setAttribute('position',new THREE.Float32BufferAttribute(banks,3));bankGeo.setIndex(bankFaces);bankGeo.computeVertexNormals();
    group.add(new THREE.Mesh(bankGeo,earth));
    for(let i=0;i<count;i++) {
      if(i%4===1)continue; // broken banks, never a uniform bead necklace
      const [x,z]=ring[i],a=i/count*Math.PI*2;
      const rock=new THREE.Mesh(rockGeometry,i%3===0?stone:moss[(i+index)%3]);
      rock.position.set(p.x+(x-p.x)*1.14,.17,p.z+(z-p.z)*1.14);
      const s=.17+.07*(.5+.5*Math.sin(i*7+index));
      rock.scale.set(s*1.45,s*.6,s);rock.rotation.y=a;rock.castShadow=true;rock.receiveShadow=true;group.add(rock);
    }
  }
  mergeStaticGroup(group);island.add(group);
  island.userData.targetGarden={revision:SAIHOJI_TARGET_REVISION,pools:SAIHOJI_TARGET_POOLS.map(p=>({...p})),waterDepth:'shallow visual basin; retained terrain support'};
  return group;
}
