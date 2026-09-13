import {OLD_CITY_BRIDGE_ANCHOR} from './oldCityOrientation.js';
import {rotateNewCityPoint} from './newCityOrientation.js';
// Foreground-right new holy city; legacy WEST_CITY identifier retained for saved asset compatibility. Coordinates are local to castleContainer.
export const WEST_CITY = Object.freeze({ x: 60, halfWidth: 15,
  districts: Object.freeze([{id:'harbor', z:50, y:4.0, halfWidth:14.5, buildingWidthScale:1}, {id:'middle', z:30, y:10, halfWidth:17.4, buildingWidthScale:1.2}, {id:'crown', z:10, y:16, halfWidth:21.75, buildingWidthScale:1.5}]) });

function authoredWaterChannel(x,z){return x>=18 && x<=43.8 && z>=52 && z<=69 || x>=18 && x<=37.5 && z>=-4 && z<=64;}
export function westCityWaterChannel(x,z){[x,,z]=rotateNewCityPoint([x,0,z],true);return authoredWaterChannel(x,z);}

export function westCityBenchHeight(x,z,original) {
  [x,,z]=rotateNewCityPoint([x,0,z],true);
  const dx=Math.abs(x-WEST_CITY.x);
  // Preserve clearance around the diagonal crossing out of the old city.
  const bridge=rotateNewCityPoint(OLD_CITY_BRIDGE_ANCHOR,true);
  const ax=bridge[0],az=bridge[2],bx=WEST_CITY.x-14.35,bz=WEST_CITY.districts[0].z;
  const vx=bx-ax,vz=bz-az;
  const t=Math.min(1,Math.max(0,((x-ax)*vx+(z-az)*vz)/(vx*vx+vz*vz)));
  if(Math.hypot(x-ax-vx*t,z-az-vz*t)<4.5)return Math.min(original,4.45);

  // Cut beneath the harbor stair and quay; retain the plaza above its top landing.
  if(x>=39.8&&x<=44.2&&z>=57.8&&z<=78.2)return Math.min(original,-25);
  if(authoredWaterChannel(x,z)) return Math.min(original,-30);
  // The plaza is a real rock shelf extending beyond the former z=59 mesh edge.
  const plazaSideRun=x>WEST_CITY.x?27:7;
  if(z>=58 && z<=116 && dx<=18+plazaSideRun){
    const sideT=Math.min(1,Math.max(0,(18+plazaSideRun-dx)/plazaSideRun));
    const side=sideT*sideT*(3-2*sideT);
    const frontT=Math.min(1,Math.max(0,(116-z)/32));
    const front=frontT*frontT*(3-2*frontT);
    const back=Math.min(1,Math.max(0,(z-58)/2));
    const weight=side*front*back;
    original=original*(1-weight)+3.78*weight;
    if(z>=64)return original;
  }
  if(authoredWaterChannel(x,z)) return Math.min(original,-12);
  if(dx>(x>WEST_CITY.x?55:27) || z < -14 || z > 64) return original;
  // Clear the *whole* processional staircase including terrain between samples,
  // not only the collision-tagged wooden/stone steps.
  if(dx<=6){
    for(let tier=1;tier<WEST_CITY.districts.length;tier++){
      const low=WEST_CITY.districts[tier-1],high=WEST_CITY.districts[tier];
      const start=low.z-2,end=high.z+2;
      if(z>=end-1 && z<=start+1){
        const t=Math.min(1,Math.max(0,(start-z)/(start-end)));
        return low.y+(high.y-low.y)*t-.28;
      }
    }
  }
  const district=WEST_CITY.districts.reduce((a,b)=>Math.abs(z-a.z)<Math.abs(z-b.z)?a:b);
  const dz=Math.abs(z-district.z);
  // The open eastern flank descends over a broad mountain shoulder; the
  // western canal bank stays steep so it cannot engulf the harbor crossing.
  const shoulderRun=x>WEST_CITY.x?26:5;
  const shoulderT=Math.min(1,Math.max(0,(district.halfWidth+shoulderRun-dx)/shoulderRun));
  const shoulderWeight=shoulderT*shoulderT*(3-2*shoulderT);
  const weight=shoulderWeight*Math.min(1,Math.max(0,((z<district.z?Math.max(14,13.2*district.buildingWidthScale+4):14)-dz)/4));
  return original*(1-weight)+(district.y-.18)*weight;
}

export function westCitySpec(tier) {
  const size=11, floors=tier===2?12:4;
  const levels=Array.from({length:floors},(_,iy)=>Array.from({length:size},(_,iz)=>
    Array.from({length:size},(_,ix)=>{
      if(tier===2){
        // Equal-height 3x3 crowns deliberately satisfy the original dome rule.
        // A taller central tower and lower paired shoulders reproduce the target skyline.
        // Occupancy reservation for the actual upper entry and central stair shaft.
        if(ix===5&&iz===1&&iy>=3&&iy<=10)return '.';
        if(ix===5&&iz===2&&((iy>=3&&iy<=4)||iy===10))return '.';
        if(ix>=4&&ix<=6&&iz<=2)return iy<12?'0':'.';
        if(((ix>=1&&ix<=3)||(ix>=7&&ix<=9))&&iz>=1&&iz<=3)return iy<9?'0':'.';
        if(((ix>=1&&ix<=3)||(ix>=7&&ix<=9))&&iz>=5&&iz<=7)return iy<3?'0':'.';
        // Low side wings join the rear shoulders to the front towers, retaining the processional opening.
        if(((ix>=1&&ix<=3)||(ix>=7&&ix<=9))&&iz===4)return iy<3?'0':'.';
        return '.';
      }
      // Three-cell processional axis; forecourt stays open rather than filled with houses.
      if(ix>=4&&ix<=6 && !(tier===2&&iz>=2&&iz<=3)) return '.';
      if(tier===0){
        if(iz<3||iz>7||iz===5||ix>2&&ix<8) return '.';
        return iy<(iz<5?2:1)?'0':'.';
      }
      if(tier===1){
        if(iz<2||iz>7||ix===0||ix===10) return '.';
        return iy<(iz<4?4:2)?'0':'.';
      }
      // Paired shoulder towers rise above a low gate approach, framing the open axis.
      if(iz<2||iz>7||ix===0||ix===10) return '.';
      const tower=(ix===2||ix===3||ix===7||ix===8)&&(iz===2||iz===3);
      const height=tower?10:(iz<4?8:iz<5?6:3);
      return iy<height?'0':'.';
    }).join('')));
  return {gridSize:size,cellSize:2.4,cellHeight:2.1,floors,levels,interiorVoids:tier===2?[...Array.from({length:8},(_,i)=>`5,${i+3},1`),'5,3,2','5,4,2','5,10,2']:[]};
}
