import * as THREE from 'three';
import vanguardData from './battleVanguardData.js';
import soccoData from './battleSoccoData.js';
import {createVanguardRig} from './vanguardOptimizedRig.js';

const caches = new Map();
function acquire(data) {
  let shared = caches.get(data.asset);
  if (!shared) {
    const empty = new THREE.BufferGeometry();
    empty.setAttribute('position',new THREE.Float32BufferAttribute([],3));
    empty.boundingSphere = new THREE.Sphere(new THREE.Vector3(),0);
    const geometries = data.meshes.map(spec => {
      const geometry = new THREE.BufferGeometry(), arrays = {}, indices = [], materialIds = [];
      let offset = 0;
      for (const primitive of spec.primitives) {
        const material = primitive.material;
        if (!materialIds.includes(material)) materialIds.push(material);
        geometry.addGroup(indices.length,primitive.indices.length,materialIds.indexOf(material));
        indices.push(...primitive.indices.map(i=>i+offset));
        for (const [semantic,values] of Object.entries(primitive.attributes)) {
          const name = {POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv',COLOR_0:'color',TANGENT:'tangent'}[semantic];
          if (name) (arrays[name] ||= []).push(...values);
        }
        offset += primitive.attributes.POSITION.length/3;
      }
      for (const [name,values] of Object.entries(arrays)) geometry.setAttribute(name,new THREE.Float32BufferAttribute(values,name==='uv'?2:name==='tangent'?4:name==='color'?values.length/offset:3));
      geometry.setIndex(indices);geometry.computeBoundingSphere();geometry.computeBoundingBox();
      return {geometry,materialIds};
    });
    shared = {empty,geometries,users:0};caches.set(data.asset,shared);
  }
  shared.users++;return shared;
}
function release(data,shared) {
  if (--shared.users) return;
  for (const {geometry} of shared.geometries) geometry.dispose();
  shared.empty.dispose();caches.delete(data.asset);
}
function material(spec) {
  const source = JSON.parse(spec.extras?.three_source || '{}');
  const pbr=spec.pbrMetallicRoughness || {}, rgba=pbr.baseColorFactor || [1,1,1,1];
  const options={color:new THREE.Color().fromArray(rgba),opacity:rgba[3],transparent:spec.alphaMode==='BLEND',side:spec.doubleSided?THREE.DoubleSide:THREE.FrontSide,flatShading:true};
  const basic=source.type==='MeshBasicMaterial' || !!spec.extensions?.KHR_materials_unlit;
  const mat=basic?new THREE.MeshBasicMaterial(options):new THREE.MeshToonMaterial(options);
  if (!basic) mat.emissive.fromArray(spec.emissiveFactor || [0,0,0]);
  if (spec.alphaMode==='MASK') mat.alphaTest=spec.alphaCutoff ?? .5;
  if (options.transparent) mat.depthWrite=false;
  mat.userData={sourceMaterialUUID:spec.extras?.three_uuid,colorRevision:2};
  return mat;
}
function transform(node,spec) {
  const matrix=spec.matrix?new THREE.Matrix4().fromArray(spec.matrix):new THREE.Matrix4().compose(new THREE.Vector3().fromArray(spec.translation),new THREE.Quaternion().fromArray(spec.rotation),new THREE.Vector3().fromArray(spec.scale));
  matrix.decompose(node.position,node.quaternion,node.scale);node.updateMatrix();
}
function bind(root,data,{nodeMap,kind}={}) {
  const old=root.userData.battleOptimizationController;if(old)return old;
  const originals=[];root.traverse(o=>originals.push(o));
  const nodes=nodeMap || new Map(originals.map((o,i)=>['n'+i,o]));
  const source=new Map(data.originalNodes.map(n=>[n.id,n]));
  for (const spec of data.originalNodes) {
    const o=nodes.get(spec.id);
    if (!o || (spec.id!=='n0' && o.parent!==nodes.get(spec.parent))) {
      root.userData.battleOptimization={asset:data.asset,active:false,geometryApplied:false,error:'original-node-contract:'+spec.id};return null;
    }
  }
  const shared=acquire(data),materials=data.materials.map(material),added=[];
  for (const mesh of data.meshes) for (const primitive of mesh.primitives) if (primitive.attributes.COLOR_0) materials[primitive.material].vertexColors = true;
  const saved=new Map([...nodes].map(([id,node])=>[id,{node,geometry:node.geometry,material:node.material,position:node.position.clone(),quaternion:node.quaternion.clone(),scale:node.scale.clone()}]));
  for (const spec of data.nodes) {
    if (nodes.has(spec.id)) continue;
    const node=spec.mesh===null?new THREE.Group():new THREE.Mesh(shared.empty,materials[0]);
    node.name=spec.name;node.userData.blenderSourceNode=spec.id;node.userData.battleOptimizationOwned=true;
    nodes.set(spec.id,node);added.push(node);
  }
  for (const spec of data.nodes) if (added.includes(nodes.get(spec.id))) nodes.get(spec.parent)?.add(nodes.get(spec.id));
  const driverIds=new Set(kind==='vanguard'?['n27','n47','n64','n74','n2','n17']:['n87','n86']);
  const meta=root.userData.battleOptimization={asset:data.asset,active:false,geometryApplied:false,geometrySha256:data.geometrySha256 || data.sha256,sourceGlbSha256:data.sha256,originalNodeCount:data.originalNodes.length,addedNodeCount:added.length,colorRevision:2};
  let active=false,disposed=false,rig=null;
  const rootUpdateMatrix=root.updateMatrix;
  const controller={
    root,nodes,meta,get active(){return active;},
    update(command){if(active)rig?.update(command);},
    setEnabled(enabled) {
      if(disposed)return false;enabled=!!enabled;if(enabled===active)return true;
      if(enabled) {
        for(const spec of data.nodes) {
          const node=nodes.get(spec.id);node.userData.blenderSourceNode=spec.id;
          if(node!==root && !driverIds.has(spec.id))transform(node,spec);
          if(node.isMesh && !node.userData.transientFx && !saved.get(spec.id)?.material?.map) {
            if(spec.hidden || spec.mesh===null)node.geometry=shared.empty;
            else {
              const entry=shared.geometries[spec.mesh];node.geometry=entry.geometry;
              node.material=entry.materialIds.length===1?materials[entry.materialIds[0]]:entry.materialIds.map(i=>materials[i]);
            }
          }
          if(added.includes(node)){node.visible=true;node.castShadow=node.receiveShadow=true;}
        }
        active=meta.active=meta.geometryApplied=true;
        if(kind==='vanguard')rig ||= createVanguardRig(controller);
        rig?.enable();rig?.update();
      } else {
        rig?.disable();
        for(const [id,state] of saved) {
          const node=state.node;
          if(state.geometry)node.geometry=state.geometry;
          if(state.material)node.material=state.material;
          if(node!==root && !driverIds.has(id)){node.position.copy(state.position);node.quaternion.copy(state.quaternion);node.scale.copy(state.scale);node.updateMatrix();}
        }
        for(const node of added)node.visible=false;
        active=meta.active=meta.geometryApplied=false;
      }
      return true;
    },
    dispose() {
      if(disposed)return;controller.setEnabled(false);disposed=true;
      root.updateMatrix=rootUpdateMatrix;
      for(const o of added)o.removeFromParent();
      for(const m of materials)m.dispose();release(data,shared);
      delete root.userData.battleOptimizationController;delete root.userData.battleOptimization;
    },
  };
  // Called by both renderer matrix traversal and getWorldPosition's parent update.
  // Animation command objects retain their original fields and identities.
  root.updateMatrix=function(){controller.update();rootUpdateMatrix.call(this);};
  root.userData.battleOptimizationController=controller;
  controller.setEnabled(true);
  return controller;
}
export function bindVanguardOptimization(root){return bind(root,vanguardData,{kind:'vanguard'});}
export function bindSoccoOptimization(root,nodeMap){return bind(root,soccoData,{kind:'socco',nodeMap});}
