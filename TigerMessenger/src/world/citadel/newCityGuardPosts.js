import * as THREE from 'three';
import {CITY_ADVANCE} from './compactNewCity.js';
import {createNewCityPublicSupport} from './newCityPublicSupport.js';

// Authored new-city frame, metres. Keep the central stair corridor open.
// Six original four-person squads; the four original archers retain the balcony.
export function createNewCityGuardPosts(castle,options={}) {
  if(options.root){
    const support=createNewCityPublicSupport(castle,options),posts=support?.posts||[];
    return {source:'new-city-supported-garrison-v2',ready:support?.report.ready===true,support,
      groups:Array.from({length:6},(_,i)=>({id:'public-post-'+i,points:posts.slice(i*4,i*4+4)})),archers:posts.slice(24,28),up:support?.up,face:support?.face};
  }
  const city=castle?.getObjectByName('highland-west-city');
  if(!city)return null;
  city.updateWorldMatrix(true,true);
  const world=p=>city.localToWorld(new THREE.Vector3(...p));
  const groups=[];
  for(let tier=0;tier<3;tier++)for(const side of [-1,1]){
    const y=[4,10,16][tier],z=[50,30,10][tier]+CITY_ADVANCE[tier]+8.1;
    // Keep clear of the measured low obstruction on the right middle landing.
    const lateral=tier===1&&side===1?10.5:8;
    const points=Array.from({length:4},(_,i)=>world([60+side*lateral+(i-1.5)*.85,y+.05,z]));
    groups.push({id:`${['forecourt','middle','keep'][tier]}-${side<0?'left':'right'}`,points});
  }
  const up=new THREE.Vector3(0,1,0).transformDirection(city.matrixWorld);
  const face=new THREE.Vector3(0,0,1).transformDirection(city.matrixWorld);
  const archers=Array.from({length:4},(_,i)=>world([60+(i-1.5)*.85,37.05,3.45+CITY_ADVANCE[2]]));
  return {source:'new-city-layered-garrison-v1',groups,archers,up,face};
}
