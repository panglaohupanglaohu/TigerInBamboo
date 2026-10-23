import * as T from 'three';

// Reuse the existing upper-city light, in its original pool/update hierarchy.
// The authored bell-room anchor follows axial/radial tower placement.
export function bindTargetTowerLight(castle,cityRoot){
 const light=castle.getObjectByName('old-city-tier-old-upper-court');
 const anchor=cityRoot.getObjectByName('tower-beacon-anchor');
 if(!light?.isPointLight||!anchor||!light.parent)return null;
 const position=light.position.clone(),distance=light.distance;
 anchor.updateWorldMatrix(true,false);
 light.position.copy(light.parent.worldToLocal(anchor.getWorldPosition(new T.Vector3())));
 light.distance=8;
 const report={light:light.name,anchor:anchor.name,towerLocal:anchor.position.toArray(),world:anchor.getWorldPosition(new T.Vector3()).toArray(),radius:8,reused:true};
 return{report,dispose(){light.position.copy(position);light.distance=distance;}};
}
