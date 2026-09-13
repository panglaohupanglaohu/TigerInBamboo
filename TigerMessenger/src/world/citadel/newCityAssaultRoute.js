import * as THREE from 'three';

/** Infantry routes use castle-local coordinates, as do the exported walkRoute
 * and plazaAnchor. They must never become water-navigation destinations. */
export function createNewCityAssaultRoute(castle) {
  const city=castle?.getObjectByName('highland-west-city');
  const anchor=city?.userData.plazaAnchor, route=city?.userData.walkRoute;
  if(!anchor || !route?.length)return null;
  const [x,y,z]=anchor;
  // Skip the old-city bridge: attackers arrive from the new harbor forecourt.
  const entry=city.userData.processionalEntry;
  const start=route.findIndex(p=>entry?Math.hypot(p[0]-entry[0],p[1]-entry[1],p[2]-entry[2])<.01:Math.abs(p[0]-x)<.01 && Math.abs(p[1]-y)<.01 && p[2]<z-15);
  if(start<0)return null;
  const points=route.slice(start).map(p=>castle.localToWorld(new THREE.Vector3(...p)));
  const up=new THREE.Vector3(0,1,0).transformDirection(castle.matrixWorld);
  return {
    source:'new-city-plaza-to-main-tower', points, up,
    // Four 5x5 companies fit on the clear northern side of the forecourt.
    // The statue remains south of these slots, the original horse east of them.
    entryFor(company,gx,gz){
      const index=((company%4)+4)%4;
      const px=60+(index%2===0?-3:3)+(gx-2)*.72;
      const pz=71.5-9.5+Math.floor(index/2)*4.5+(gz-2)*.72;
      return [[px,y,pz],[px,y,60],[60,y,60]].map(p=>city.localToWorld(new THREE.Vector3(...p)))
        .concat(route.slice(start).map(p=>castle.localToWorld(new THREE.Vector3(...p))));
    },
  };
}
