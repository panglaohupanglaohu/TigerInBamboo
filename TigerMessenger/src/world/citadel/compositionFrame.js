import {OLD_CITY_YAW,rotateOldCityPoint} from './oldCityOrientation.js';
// Keep the spherical castle anchor stable. Move authored content in its tangent
// plane so world navigation identities and the original tower internals survive.
export const CITADEL_COMPOSITION_OFFSET = Object.freeze([-52, 0, 0]);

export function applyCitadelCompositionFrame(castle) {
  if (castle.userData.compositionOffset) return;
  const [dx,dy,dz]=CITADEL_COMPOSITION_OFFSET;
  for (const child of castle.children) child.position.add({x:dx,y:dy,z:dz});
  const city=castle.getObjectByName('highland-west-city');
  for(const child of castle.userData.mainCastle.children){
    if(child===city)continue;
    const p=rotateOldCityPoint(child.position.toArray());child.position.fromArray(p);child.rotation.y+=OLD_CITY_YAW;
  }
  const oldLights=castle.getObjectByName('highland-light-volumes');
  if(oldLights)oldLights.rotation.y+=OLD_CITY_YAW;
  const foundation=castle.getObjectByName('highland-town-foundation-platform');
  if(foundation)foundation.rotation.y+=OLD_CITY_YAW;
  castle.userData.oldCityYaw=OLD_CITY_YAW;
  const point=p=>[p[0]+dx,p[1]+dy,p[2]+dz];
  const original=castle.userData.highlandAssaultAnchors;
  if(original){
    const moved={...original,keepTop:point(rotateOldCityPoint(original.keepTop)),approach:point(rotateOldCityPoint(original.approach)),
      stairRoute:original.stairRoute.map(p=>point(rotateOldCityPoint(p))),
      interiorFloorRoutes:original.interiorFloorRoutes.map(r=>({...r,points:r.points.map(p=>point(rotateOldCityPoint(p)))}))};
    castle.userData.highlandAssaultAnchors=moved;
    castle.userData.highlandLatestDesignRoot.userData.assaultAnchors=moved;
  }
  if(city){
    city.userData.walkRoute=city.userData.walkRoute.map(point);
    if(city.userData.harborRoute)city.userData.harborRoute=city.userData.harborRoute.map(point);
    for(const key of ['plazaAnchor','horseReservation','harborAnchor'])if(city.userData[key])city.userData[key]=point(city.userData[key]);
  }
  castle.userData.compositionOffset=[dx,dy,dz];
  castle.userData.compositionVersion='old-left-yaw30-new-center-v6';
  castle.updateMatrixWorld(true);
}
