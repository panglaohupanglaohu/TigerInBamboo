/** 890611046435627008 shows houses attacked/defended on separate terraces.
 * Local eligibility rule: living grounded units at the door's actual nav floor.
 * Not the original burn algorithm, and not a full visibility test.
 */
export function atHouseDoor(unit,door,{floor,levelHeight,radius}={}){
 if(!Number.isInteger(floor)||floor<0||!Number.isFinite(levelHeight)||levelHeight<=0||!Number.isFinite(radius)||radius<0)throw new RangeError('invalid house-door bounds');
 if(!unit||!door||unit.dead||unit.onBoat||unit.fall||unit.navFloor!==floor)return false;
 if(![unit.x,unit.y,unit.z,door.cx,door.cz].every(Number.isFinite))return false;
 return Math.abs(unit.y-floor*levelHeight)<=levelHeight*.6&&Math.hypot(unit.x-door.cx,unit.z-door.cz)<radius;
}
