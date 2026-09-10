import * as THREE from 'three';
import data from './saihojiPineData.js';
import { getToonGradient } from './toon.js';

// Deliberate Web material revision against ancient-pine-target-v1.png.
// Geometry is the actual unchanged Blender candidate; colors are a separate
// warm grey bark / dark green / olive / sunlit green interpretation.
export const SAIHOJI_PINE_PALETTE = Object.freeze(['#766958','#504a3e','#253e2b','#446439','#72934d']);
export const SAIHOJI_PINE_SEEDS = Object.freeze(Object.keys(data).map(Number));
const cache = new Map();
const sizes = {SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
const types = {5121:Uint8Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
const attributeNames = {POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv',COLOR_0:'color'};

function template(seed) {
  if(cache.has(seed))return cache.get(seed);
  const source=data[seed];
  if(!source)throw new Error(`No verified Blender pine for seed ${seed}`);
  const bytes=Uint8Array.from(atob(source.binary),c=>c.charCodeAt(0));
  function attribute(index) {
    const a=source.accessors[index],v=source.bufferViews[a.bufferView],Ctor=types[a.componentType];
    const size=sizes[a.type],offset=(v.byteOffset||0)+(a.byteOffset||0);
    if(!Ctor||!size||a.sparse||v.byteStride&&v.byteStride!==size*Ctor.BYTES_PER_ELEMENT)throw new Error('Unsupported pine buffer layout');
    return new THREE.BufferAttribute(new Ctor(bytes.buffer,offset,a.count*size),size,!!a.normalized);
  }
  const materials=SAIHOJI_PINE_PALETTE.map((color,i)=>{
    const material=new THREE.MeshToonMaterial({color,gradientMap:getToonGradient(),side:THREE.DoubleSide});
    material.name=`SaihojiPine_TargetPalette_m${i}`;
    material.userData={shared:true,sourceLinear:source.sourceColors[i],targetSRGB:color,revision:'target-palette-web-v1'};
    return material;
  });
  const meshes=source.meshes.map(spec=>{
    if(spec.primitives.length!==1)throw new Error('Expected one pine material per mesh');
    const p=spec.primitives[0],geometry=new THREE.BufferGeometry();
    for(const [semantic,index] of Object.entries(p.attributes)) {
      if(!attributeNames[semantic])throw new Error(`Unsupported pine attribute ${semantic}`);
      geometry.setAttribute(attributeNames[semantic],attribute(index));
    }
    geometry.setIndex(attribute(p.indices));geometry.computeBoundingBox();geometry.computeBoundingSphere();
    return {geometry,material:materials[p.material]};
  });
  const item={source,meshes};cache.set(seed,item);return item;
}

/** Same factory root contract as createAncientPineTree: seed yaw + scale 1.02.
 * Placement may overwrite yaw and multiply scale once. GLB n0 is used as this
 * root, never nested under another transformed root; children stay GLB-local.
 * Geometry/materials are shared immutable resources; callers must not dispose
 * or mutate them per instance. No asynchronous replacement or fetch race.
 */
export function createOptimizedSaihojiPine(seed) {
  const {source,meshes}=template(seed);
  const nodes=source.nodes.map(spec=>{
    const part=spec.mesh===undefined?null:meshes[spec.mesh];
    const node=part?new THREE.Mesh(part.geometry,part.material):new THREE.Group();
    node.name=spec.id==='n0'?'giantTreeGroup':`pine-${seed}-${spec.id}`;
    node.userData.sourceNodeId=spec.id;
    if(spec.matrix)new THREE.Matrix4().fromArray(spec.matrix).decompose(node.position,node.quaternion,node.scale);
    else {
      if(spec.translation)node.position.fromArray(spec.translation);
      if(spec.rotation)node.quaternion.fromArray(spec.rotation);
      if(spec.scale)node.scale.fromArray(spec.scale);
    }
    node.visible=!spec.hidden;
    if(part)node.castShadow=node.receiveShadow=true;
    return node;
  });
  source.nodes.forEach((s,i)=>s.children?.forEach(c=>nodes[i].add(nodes[c])));
  const root=nodes[source.nodes.findIndex(s=>s.id==='n0')];
  // Restore the exact factory scalar after float32 Blender round-tripping.
  root.scale.setScalar(1.02);root.quaternion.normalize();
  root.userData={...root.userData,collideRadius:.58,kind:'gardenPine',sourceSeed:Number(seed),
    pineOptimization:{asset:'saihoji-pines-v1',lod:0,source:source.source,sourceGlbSha256:source.sha256,
      geometryApplied:true,palette:'target-palette-web-v1',rootContract:'original factory root, placement overwrites yaw'}};
  return root;
}

/** Bounds before factory yaw/scale; used by world placement and cover planning. */
export function getOptimizedSaihojiPineBounds(seed) {
  const root=createOptimizedSaihojiPine(seed);root.position.set(0,0,0);root.quaternion.identity();root.scale.setScalar(1);root.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(root),crown=new THREE.Box3();
  root.traverse(n=>{if(n.isMesh&&['n10','n11','n12'].includes(n.userData.sourceNodeId))crown.union(n.geometry.boundingBox.clone().applyMatrix4(n.matrixWorld));});
  return {min:box.min.toArray(),max:box.max.toArray(),height:box.max.y-box.min.y,
    crownRadius:Math.hypot(Math.max(Math.abs(crown.min.x),Math.abs(crown.max.x)),Math.max(Math.abs(crown.min.z),Math.abs(crown.max.z))),trunkRadius:.30,collisionRadius:.58};
}
