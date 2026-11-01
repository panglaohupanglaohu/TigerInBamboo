import * as T from 'three';
import {latLonToDir} from './sphereMath.js';

// Survey the installed scene, rather than treating the historical manifest as
// the current world. Every candidate keeps a 32m island/approach envelope.
export function chooseMorrisIslandSite({obstacles=[],curves=[],R=160}={}){
 const samples=curves.filter(c=>c?.getSpacedPoints).flatMap(c=>c.getSpacedPoints(800));
 const candidates=[];
 for(const lat of [-48,-62,-32])for(let lon=-165;lon<=180;lon+=15){
  const direction=latLonToDir(lat,lon),centre=direction.clone().multiplyScalar(R);
  let clearance=Infinity;
  for(const o of obstacles)if(o.position?.length()>1)clearance=Math.min(clearance,centre.distanceTo(o.position.clone().normalize().multiplyScalar(R))-(o.radius??0));
  for(const p of samples)clearance=Math.min(clearance,centre.distanceTo(p.clone().normalize().multiplyScalar(R))-4);
  candidates.push({lat,lon,direction,clearance});
 }
 candidates.sort((a,b)=>b.clearance-a.clearance);
 const site=candidates[0];if(!site||site.clearance<40)throw new Error('No surveyed empty Morris island site');
 return {...site,report:{method:'installed collider/landmark/rail point survey',lat:site.lat,lon:site.lon,minimumClearance:site.clearance,envelope:32,obstacles:obstacles.length,routeSamples:samples.length,candidates:candidates.length,otherObjectsMoved:false}};
}
