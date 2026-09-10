import * as THREE from 'three';
function mergeGeometries(parts){const merged=new THREE.BufferGeometry();for(const name of Object.keys(parts[0].attributes)){const first=parts[0].attributes[name],C=first.array.constructor,array=new C(parts.reduce((n,g)=>n+g.attributes[name].array.length,0));let offset=0;for(const g of parts){array.set(g.attributes[name].array,offset);offset+=g.attributes[name].array.length;}merged.setAttribute(name,new THREE.BufferAttribute(array,first.itemSize,first.normalized));}merged.computeBoundingSphere();return merged;}
import source from './warshipV6Data.js';
import {getToonGradient} from './toon.js';
const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
let cache;
function resources(){
 if(cache)return cache;
 const bytes=decode(source.binary),poses=new Float32Array(decode(source.poseBinary).buffer);
 const sizes={SCALAR:1,VEC2:2,VEC3:3,VEC4:4},types={5121:Uint8Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
 function attr(i){const a=source.accessors[i],v=source.bufferViews[a.bufferView],C=types[a.componentType],size=sizes[a.type];if(a.sparse||v.byteStride&&v.byteStride!==size*C.BYTES_PER_ELEMENT)throw Error('Unsupported warship accessor');return new THREE.BufferAttribute(new C(bytes.buffer,(v.byteOffset||0)+(a.byteOffset||0),a.count*size),size,!!a.normalized);}
 const geometry=source.meshes.map(m=>m.primitives.map(p=>{const g=new THREE.BufferGeometry();for(const [key,id]of Object.entries(p.attributes)){const name={POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv',COLOR_0:'color'}[key];if(name)g.setAttribute(name,attr(id));}if(p.indices!==undefined)g.setIndex(attr(p.indices));g.computeBoundingBox();let hash=2166136261;for(const a of [...Object.values(g.attributes),g.index].filter(Boolean)){const raw=new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength);for(const v of raw){hash^=v;hash=Math.imul(hash,16777619);}}return {g,material:p.material,signature:(hash>>>0)+':'+g.attributes.position.count};}));
 cache={poses,geometry};return cache;
}
/** Saved Blender asset, synchronous factory: no late visual swap during boarding. */
export function createWarshipV6(){
 const {poses,geometry}=resources(),byId=new Map();
 const materials=source.materials.map(m=>{const p=m.pbrMetallicRoughness||{},c=p.baseColorFactor||[1,1,1,1],mat=new THREE.MeshToonMaterial({color:new THREE.Color().fromArray(c),gradientMap:getToonGradient(),side:m.doubleSided?THREE.DoubleSide:THREE.FrontSide,opacity:c[3],transparent:m.alphaMode==='BLEND'});mat.name=m.name||'';return mat;});
 const nodes=source.nodes.map(s=>{const n=new THREE.Group();n.name=s.name||'';n.userData.sourceNodeId=s.sourceId;n.userData.crewWeaponOwner=s.extras?.warship_crew_index;n.userData.crewWeaponRole=s.extras?.warship_weapon_role;n.visible=!s.hidden;if(s.matrix)new THREE.Matrix4().fromArray(s.matrix).decompose(n.position,n.quaternion,n.scale);else{if(s.translation)n.position.fromArray(s.translation);if(s.rotation)n.quaternion.fromArray(s.rotation);if(s.scale)n.scale.fromArray(s.scale);}if(s.sourceId)byId.set(s.sourceId,n);return n;});
 source.nodes.forEach((s,i)=>s.children?.forEach(c=>nodes[i].add(nodes[c])));const boat=byId.get('n0');boat.name='fisher-boat';
 const dynamic=new Set(source.poseKeys),renderRoot=new THREE.Group();renderRoot.name='blender-v6-render';boat.add(renderRoot);boat.updateMatrixWorld(true);
 const inv=new THREE.Matrix4().copy(boat.matrixWorld).invert(),staticGroups=new Map(),dynamicGroups=new Map(),crew=byId.get('n219')||new THREE.Group();
 function controlled(n){for(let p=n;p&&p!==boat;p=p.parent)if(dynamic.has(p.userData.sourceNodeId)||Number.isInteger(p.userData.crewWeaponOwner)||p===crew)return true;return false;}
 function hidden(n){for(let p=n;p&&p!==boat;p=p.parent)if(!p.visible)return true;return false;}
 source.nodes.forEach((s,i)=>{if(s.mesh===undefined||hidden(nodes[i]))return;for(const part of geometry[s.mesh]){
  if(controlled(nodes[i])){const key=part.signature+':'+part.material;let group=dynamicGroups.get(key);if(!group)dynamicGroups.set(key,group={part,nodes:[]});group.nodes.push(nodes[i]);}
  else{const g=part.g.index?part.g.toNonIndexed():part.g.clone();g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv,nodes[i].matrixWorld));const key=part.material+':'+Object.keys(g.attributes).sort().join(',');if(!staticGroups.has(key))staticGroups.set(key,{material:part.material,geometries:[]});staticGroups.get(key).geometries.push(g);}
 }});
 for(const group of staticGroups.values()){const g=mergeGeometries(group.geometries,false);if(!g)throw Error('Warship static merge failed');const mesh=new THREE.Mesh(g,materials[group.material]);mesh.castShadow=mesh.receiveShadow=true;renderRoot.add(mesh);group.geometries.forEach(g=>g.dispose());}
 const batches=[];
 for(const group of dynamicGroups.values()){const mesh=new THREE.InstancedMesh(group.part.g,materials[group.part.material],group.nodes.length);mesh.frustumCulled=false;mesh.castShadow=mesh.receiveShadow=true;renderRoot.add(mesh);batches.push({...group,mesh});}
 const matA=new THREE.Matrix4(),matB=new THREE.Matrix4(),pa=new THREE.Vector3(),pb=new THREE.Vector3(),qa=new THREE.Quaternion(),qb=new THREE.Quaternion(),sa=new THREE.Vector3(),sb=new THREE.Vector3(),zero=new THREE.Matrix4().makeScale(0,0,0);
 const tracks=source.poseKeys.map((k,i)=>({key:k,node:byId.get(k),offset:i*16})),stride=source.poseKeys.length*16;
 function pose(frameA,frameB,alpha){for(const tr of tracks){if(!tr.node)continue;matA.fromArray(poses,source.frameIndex[frameA]*stride+tr.offset).decompose(pa,qa,sa);matB.fromArray(poses,source.frameIndex[frameB]*stride+tr.offset).decompose(pb,qb,sb);tr.node.position.copy(pa).lerp(pb,alpha);tr.node.quaternion.copy(qa).slerp(qb,alpha);tr.node.scale.copy(sa).lerp(sb,alpha);}}
 function render(){boat.updateMatrixWorld(true);inv.copy(boat.matrixWorld).invert();for(const b of batches){b.nodes.forEach((n,i)=>b.mesh.setMatrixAt(i,hidden(n)?zero:matA.multiplyMatrices(inv,n.matrixWorld)));b.mesh.instanceMatrix.needsUpdate=true;}}
 const rows=Array.from({length:26},(_,i)=>({attach:byId.get('n'+(193+i)),side:i<13?-1:1,index:i%13,sedateT:0,embarked:true,weaponStored:true}));crew.userData.rows=rows;
 const rowTracks=rows.map((_,i)=>tracks.filter(tr=>tr.key==='n'+(63+i*5)||tr.key==='n'+(193+i)||new RegExp('^n(?:22[0-9]|230):i'+i+'$').test(tr.key)||tr.key==='add:forearm-'+i+'L'||tr.key==='add:forearm-'+i+'R'||tr.key==='add:hand-'+i+'L'||tr.key==='add:hand-'+i+'R'));
 const crewVisuals=rows.map((_,i)=>[...byId.entries()].filter(([key])=>new RegExp('^n(?:22[0-9]|230):i'+i+'$').test(key)||key==='add:forearm-'+i+'L'||key==='add:forearm-'+i+'R'||key==='add:hand-'+i+'L'||key==='add:hand-'+i+'R').map(([,node])=>({node,visible:node.visible})));
 const storedWeapons=rows.map((_,i)=>nodes.filter(n=>n.userData.crewWeaponOwner===i));
 let time=0,boarding=0;
 boat.userData={...boat.userData,kind:'fisherBoat',collideRadius:6.8,crew,oars:Array.from({length:26},(_,i)=>byId.get('n'+(63+i*5))),oarPhase:0,oarSpeed:0,
  warshipV6:{source:source.source,sha256:source.sourceSHA256,nodes:byId,batches:batches.length,staticDraws:staticGroups.size,pose,render,
   lanternMaterials:new Set(source.nodes.filter(n=>n.name?.startsWith("night-lantern-")&&n.mesh!==undefined).flatMap(n=>source.meshes[n.mesh].primitives.map(p=>materials[p.material]))),
   boardingContract:Object.freeze({rootPoint:Object.freeze([1.94,.664,.48]),length:1.35,width:.34,deployedPitch:.12,clearanceValidated:false,source:source.source.replace(".glb",".assembly.json")}),
   bindCrewIdentity(index,identity){if(!rows[index])return false;rows[index].identity={...identity};for(const n of storedWeapons[index])n.userData.soldierUid=identity.uid;return true;},
   setCrewEmbarked(index,value){const r=rows[index];if(!r)return false;r.embarked=!!value;for(const item of crewVisuals[index])item.node.visible=r.embarked&&item.visible;render();return true;},
   setCrewWeaponStored(index,value){const r=rows[index];if(!r)return false;r.weaponStored=!!value;for(const node of storedWeapons[index])node.visible=r.weaponStored;render();return true;},
   crewStatus(){return rows.map((r,i)=>({index:i,embarked:r.embarked,weaponStored:r.weaponStored,identity:r.identity||null,weaponNodes:storedWeapons[i].length}));},
   setBoarding(value){boarding=THREE.MathUtils.clamp(value,0,1);},
   update(dt,moving){const d=Math.min(.05,Math.max(0,dt)),target=moving===true?1:Math.max(0,Math.min(1,Number(moving)||0));boat.userData.oarSpeed+=(target-boat.userData.oarSpeed)*Math.min(1,d*5.5);time+=d*boat.userData.oarSpeed;
    if(boarding>0){const f=180+boarding*30;pose(Math.floor(f),Math.min(210,Math.ceil(f)),f%1);}
    else if(boat.userData.oarSpeed<.02)pose(180,180,0);
    else{const f=60+(time*60)%60;pose(Math.floor(f),f>=119?60:Math.ceil(f),f%1);}
    let left=0,right=0;for(let i=0;i<26;i++){const r=rows[i];r.sedateT=Math.max(0,r.sedateT-d);if(r.attach){r.attach.userData.sedated=r.sedateT>0;r.attach.userData.sedateT=r.sedateT;}if(r.sedateT>0||!r.embarked){if(r.sedateT>0){if(r.side<0)left++;else right++;}for(const tr of rowTracks[i])if(tr.node)matA.fromArray(poses,source.frameIndex[180]*stride+tr.offset).decompose(tr.node.position,tr.node.quaternion,tr.node.scale);}}
    boat.userData.oarSedatedCount=left+right;boat.userData.oarImbalance=(right-left)/13;boat.userData.oarPhase=time*6.2;render();},
   paintCrest(pal){for(const batch of batches){const id=batch.nodes[0].userData.sourceNodeId||'';const color=id.startsWith('n224:')?pal.crest:id.startsWith('n225:')?pal.feathers:id.startsWith('n226:')?pal.stems:null;if(color!==null){batch.mesh.userData.crewCrest=true;batch.mesh.material=batch.mesh.material.clone();batch.mesh.material.color.setHex(color);}}},
  }};
 pose(180,180,0);render();return boat;
}
