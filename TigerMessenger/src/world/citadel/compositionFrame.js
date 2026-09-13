import {OLD_CITY_YAW,rotateOldCityPoint} from './oldCityOrientation.js';
import {NEW_CITY_YAW,rotateNewCityPoint} from './newCityOrientation.js';
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
  // The lake cutout is authored in the fixed terrain frame. Only buildings
  // turn: undo the inherited yaw on its water cover to keep the shoreline sealed.
  const waterfront=castle.getObjectByName('highland-waterfront-foreground');
  if(waterfront)waterfront.rotation.y-=OLD_CITY_YAW;
  // Mountain plants belong to the fixed terrain, not the rotated old buildings.
  const slopePlants=castle.getObjectByName('highland-mountain-slope-vegetation');
  if(slopePlants)slopePlants.rotation.y-=OLD_CITY_YAW;
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
    city.rotation.y=NEW_CITY_YAW;city.position.fromArray(rotateNewCityPoint([0,0,0]));
    const cityPoint=p=>point(rotateNewCityPoint(p));
    city.userData.walkRoute=city.userData.walkRoute.map(cityPoint);
    if(city.userData.harborRoute)city.userData.harborRoute=city.userData.harborRoute.map(cityPoint);
    if(city.userData.horsePlazaExit)city.userData.horsePlazaExit=city.userData.horsePlazaExit.map(cityPoint);
    for(const key of ['plazaAnchor','statueAnchor','horseReservation','harborAnchor','processionalEntry'])if(city.userData[key])city.userData[key]=cityPoint(city.userData[key]);
  }
  castle.userData.compositionOffset=[dx,dy,dz];
  castle.userData.compositionVersion='old-yaw30-new-yaw-minus30-v9';
  castle.updateMatrixWorld(true);
}
