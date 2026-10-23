import * as T from 'three';
import {MESSENGER_PALETTE} from './courierMoebius.js';

// 候选：Blender 三视图信使 v2（artifacts/pipeline/courier-blender-threeview-20261008/v2）。
// 只在 URL 带 ?courier=blenderV2 时由 player.js 加载；默认信使不变。
// GLB 的关节节点名与 humanCourier.js 驱动的一致（body/head/legL/kneeL/armL/elbowL/handL…/letter），
// 静止姿态旋转为单位四元数，所以原有六个动作代码直接驱动这些节点。
export const COURIER_BLENDER_V2_URL=new URL('../../../assets/models/courier-blender-v2/courier-v2.glb',import.meta.url).href;
const JOINTS=['body','head','legL','legR','kneeL','kneeR','armL','armR','elbowL','elbowR','handL','handR','letter'];

function flatShade(mesh,surface,ink){
  const g=mesh.geometry,n=g.attributes.normal,src=mesh.material,base=new T.Color(src?.color??0xffffff),dark=base.clone().multiplyScalar(.8),colors=[];
  for(let i=0;i<n.count;i++){const c=(n.getX(i)*.72+n.getZ(i)*.38+n.getY(i)*.45<-.24)?dark:base;colors.push(c.r,c.g,c.b);}
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  src?.dispose?.();mesh.material=surface;mesh.castShadow=mesh.receiveShadow=true;
  const outline=new T.Mesh(g,ink);outline.name=mesh.name+'-ink';outline.raycast=()=>{};mesh.add(outline);
}

export async function upgradeCourierToBlenderV2(root,{url=COURIER_BLENDER_V2_URL,loader=null}={}){
  if(root.userData.blenderV2)return root;
  if(!loader){const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');loader=new GLTFLoader();}
  const gltf=await loader.loadAsync(url);
  const model=gltf.scene.getObjectByName('Courier')||gltf.scene;
  const joints={};for(const name of JOINTS){joints[name]=model.getObjectByName(name);if(!joints[name])throw new Error('courier v2 GLB missing joint '+name);}
  const surface=new T.MeshBasicMaterial({name:'messenger-v2-flat-colour',vertexColors:true});
  const ink=new T.MeshBasicMaterial({name:'messenger-v2-silhouette',color:MESSENGER_PALETTE.ink,side:T.BackSide});
  ink.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed += normalize(normal) * 0.0035;');};
  ink.customProgramCacheKey=()=>'messenger-v2-silhouette-v1';
  const meshes=[];model.traverse(o=>{if(o.isMesh)meshes.push(o);});for(const m of meshes)flatShade(m,surface,ink);
  // Fit inside the existing root, using the same feet line and height as the approved courier.
  root.updateMatrixWorld(true);
  const legacy=root.children.slice(),before=new T.Box3();
  for(const child of legacy){child.updateMatrixWorld(true);before.expandByObject(child,true);}
  const inv=new T.Matrix4().copy(root.matrixWorld).invert();before.applyMatrix4(inv);
  const own=new T.Box3().setFromObject(model,true),height=own.max.y-own.min.y;
  const holder=new T.Group();holder.name='courier-blender-v2';holder.add(model);
  holder.scale.setScalar((before.max.y-before.min.y)/height);holder.position.y=before.min.y-own.min.y*holder.scale.y;
  for(const child of legacy)child.visible=false;
  root.add(holder);
  const u=root.userData,legacyJoints={};for(const name of JOINTS)legacyJoints[name]=u[name];
  Object.assign(u,joints,{bodyBaseY:joints.body.position.y,bodyBaseX:0,cape:null,headbandTails:[],blenderV2:{url,legacyJoints,legacyChildren:legacy,holder,meshes:meshes.length}});
  joints.letter.visible=false;
  return root;
}

// Rollback without reload: show the approved courier again and give its joints back.
export function revertCourierBlenderV2(root){
  const v=root.userData.blenderV2;if(!v)return root;
  v.holder.removeFromParent();for(const c of v.legacyChildren)c.visible=true;
  Object.assign(root.userData,v.legacyJoints);delete root.userData.blenderV2;return root;
}
