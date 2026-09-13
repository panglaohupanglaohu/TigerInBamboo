import * as THREE from 'three';
import data from '../../assets/claudeCitadelHousesData.js';
import {mergeStaticGroup} from '../geometryMerge.js';

// Existing source is retained; ?citadelClaudeHouses=0 selects the WFC facade.
export const claudeHousesEnabled = typeof location === 'undefined'
  || new URLSearchParams(location.search).get('citadelClaudeHouses') !== '0';

export function buildClaudeHouses(tier, customLots = null) {
  const root = new THREE.Group(), materials = new Map(), lamps = [];
  root.name = tier ? 'west-city-middle' : 'west-city-harbor';
  root.userData.blenderSource = data.source;
  root.userData.sourceId = 'claude-citadel-houses-v1';
  root.userData.importRole = 'static-exterior-houses';
  const lots = customLots ? [...customLots] : [];
  if (customLots) {
    root.name='citadel-target-hillside-houses';
  } else if (tier === 0) {
    for (const x of [48.4,71.6]) for (const z of [44.9,54.8])
      lots.push([x,4,z,5.5,4.1,z<50?5.1:3.5]);
  } else {
    lots.push([46.8,10,23.4,4.7,4.7,8.8,4],[46.8,10,35.4,4.7,4.7,4.6,6],
      [73.2,10,25,4.7,4.7,7.8,13],[73.2,10,34.8,4.7,4.7,4.6,15]);
  }
  const material = key => {
    if(materials.has(key))return materials.get(key);
    let m;
    if(data.emission[key]) {
      const col = new THREE.Color(key==='win_gold'?0xffd394:key==='win_pink'?0xffc279:0xffae55);
      m = new THREE.MeshStandardMaterial({color:col.clone().multiplyScalar(.18),emissive:col,emissiveIntensity:1.0,roughness:.7});
      lamps.push(m);
    } else {
      const [col,roughness,metalness] = data.palette[key];
      const tint=key.startsWith('roof')?new THREE.Color(0x1b579c):new THREE.Color().fromArray(col).multiplyScalar(.65);
      m = new THREE.MeshStandardMaterial({color:tint,roughness,metalness});
    }
    m.name = 'claude-house-'+key;materials.set(key,m);return m;
  };
  lots.forEach(([x,y,z,w,d,h,sourceIndex],i) => {
    const source = data.houses[(sourceIndex??(i+tier*4))%data.houses.length];
    for(const [key,part] of Object.entries(source.parts)) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute(part.positions,3));
      geo.setAttribute('normal',new THREE.Float32BufferAttribute(part.normals,3));
      const mesh = new THREE.Mesh(geo,material(key));
      mesh.position.set(x,y,z);
      mesh.scale.set(w/source.size[0],h/source.size[1],d/source.size[2]);
      mesh.name = `claude-house-${tier}-${i}-${key}`;
      root.add(mesh);
    }
  });
  const merged = mergeStaticGroup(root,{mergedTag:'claude-houses'});
  merged.surfaces.forEach((m,i)=>{
    m.name = `${root.name}-claude-exterior-${i}`;
    m.castShadow=true;m.receiveShadow=true;
    m.userData.sourceId=root.userData.sourceId;
    m.userData.citadelSolidExterior = true;
  });
  root.userData.lots=lots;
  root.userData.importedHouseCount=lots.length;
  root.userData.update = phase => {
    const night = Math.max(0,Math.min(1,(Math.abs((phase??.85)-.5)-.18)/.14));
    lamps.forEach(m=>m.emissiveIntensity=.04+night*1.0);
  };
  root.userData.update(.85);
  return root;
}
