import * as THREE from 'three';

export const TARGET_NEW_CITY_ORIGIN = Object.freeze([74,12,33]);
export const TARGET_NEW_CITY_YAW = -55*Math.PI/180;
/** A rigid architectural frame: origin stays in the approved castle chart,
 * while its vertical is the world's radial direction at that origin. */
export function createTargetNewCityPlacement(castleMatrix,{origin=TARGET_NEW_CITY_ORIGIN,yaw=TARGET_NEW_CITY_YAW}={}){
 if(!castleMatrix?.isMatrix4||!castleMatrix.elements.every(Number.isFinite)||Math.abs(castleMatrix.determinant())<1e-10)throw new TypeError('finite invertible castle matrix required');
 if(!Array.isArray(origin)||origin.length!==3||!origin.every(Number.isFinite)||!Number.isFinite(yaw))throw new TypeError('finite origin and yaw required');
 const anchor=new THREE.Vector3(...origin),worldAnchor=anchor.clone().applyMatrix4(castleMatrix);
 if(worldAnchor.lengthSq()<1)throw new RangeError('new city anchor must be outside sphere centre');
 const upWorld=worldAnchor.clone().normalize(),upLocal=upWorld.clone().transformDirection(castleMatrix.clone().invert());
 const quaternion=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),upLocal).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw));
 const matrix=new THREE.Matrix4().compose(anchor,quaternion,new THREE.Vector3(1,1,1)),inverse=matrix.clone().invert();
 const transform=point=>new THREE.Vector3(...point).applyMatrix4(matrix).toArray();
 const planeAt=(x,z,localY=0)=>origin[1]+(localY-upLocal.x*(x-origin[0])-upLocal.z*(z-origin[2]))/upLocal.y;
 return{matrix,inverse,quaternion,upLocal,upWorld,transform,planeAt,report:{version:'new-city-radial-placement-1',origin:[...origin],yawDegrees:yaw*180/Math.PI,placementMatrix:matrix.toArray(),worldAnchor:worldAnchor.toArray(),upWorld:upWorld.toArray(),upCastle:upLocal.toArray(),plane:{normal:upLocal.toArray(),anchor:[...origin]},scope:'new-city buildings only; fixed railway and plaza anchors'}};
}
