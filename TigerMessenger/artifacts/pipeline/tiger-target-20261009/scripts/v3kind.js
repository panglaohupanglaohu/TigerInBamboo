import * as THREE from 'three';
export default async function(swamp){
 const {createMoebiusTigerModel}=await import('../src/assets/characters/moebiusTiger.js');
 const {applySwampTigerV2}=await import('../src/assets/characters/swampTigerV2.js');
 const {upgradeTigerToV3}=await import('../src/assets/characters/tigerSkinV3.js');
 const tiger=createMoebiusTigerModel(Math.random);swamp.add(tiger);
 await tiger.userData.tigerAnatomy?.ready;applySwampTigerV2(tiger);await tiger.userData.swampTigerV2Ready;
 await upgradeTigerToV3(tiger);
 return tiger;
}
