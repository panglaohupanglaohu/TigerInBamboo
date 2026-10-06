import {installEditableJunction} from './canalJunctionEditable.js';
import * as THREE from 'three';
import data from '../../assets/models/optimized/canal-junction/junctionTargetData.js';
import {createCitadelPlayerWalls} from './citadel/playerWalls.js';
export function installCanalJunctionTarget(city){
 if(city.userData.junctionTarget)return city.userData.junctionTarget;
 if(new URLSearchParams(globalThis.location?.search||'').get('junctionEditable')!=='0')return installEditableJunction(city);
 const root=new THREE.Group();root.name='canal-junction-target-v1';
 for(const p of data.parts){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(p.normals,3));g.computeBoundingSphere();const m=new THREE.MeshStandardMaterial({color:new THREE.Color(...p.color),roughness:1,metalness:0,flatShading:true});const o=new THREE.Mesh(g,m);o.name=p.name;o.castShadow=true;o.receiveShadow=true;o.userData.junctionWalk=p.walkable;o.userData.citadelSolidExterior=p.solid;root.add(o);}
 const previous=city.children.map(o=>[o,o.visible]);for(const [o]of previous)o.visible=false;city.add(root);city.userData.junctionTarget=root;
 city.userData.restoreOriginalTown=()=>{for(const [o,v]of previous)o.visible=v;root.removeFromParent();root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});delete city.userData.junctionTarget;delete city.userData.restoreOriginalTown;};
 return root;
}
export function createJunctionPlayerSupport(city){
 const ray=new THREE.Raycaster(),local=new THREE.Vector3(),up=new THREE.Vector3();ray.far=2.5;
 let cached=null,cachedRevision=-1,walls=null;
 return {
 ground(position){const root=city?.userData.junctionTarget;if(!root)return null;root.updateWorldMatrix(true,true);local.copy(position);root.worldToLocal(local);if(Math.abs(local.x)>23||Math.abs(local.z)>23||local.y< -3||local.y>30)return null;up.copy(position).normalize();ray.set(position.clone().addScaledVector(up,.4),up.clone().negate());for(const h of ray.intersectObjects((()=>{const meshes=[];root.traverse(o=>{if(o.isMesh&&o.userData.junctionWalk)meshes.push(o);});return meshes;})(),false))if(h.face.normal.clone().transformDirection(h.object.matrixWorld).dot(up)>.5)return h.point.length();return null;},
 walls(before,position,velocity){const root=city?.userData.junctionTarget;if(!root)return false;root.updateWorldMatrix(true,true);if(position.distanceToSquared(root.getWorldPosition(local))>55*55)return false;if(cached!==root||cachedRevision!==root.userData.revision){cached=root;cachedRevision=root.userData.revision;walls=createCitadelPlayerWalls(root);}return walls(before,position,velocity);}
 };
}
