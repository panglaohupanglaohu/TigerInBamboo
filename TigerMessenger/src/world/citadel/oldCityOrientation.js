// Positive local Y: counter-clockwise in the overhead X/Z layout.
// Reference waterfront: retain a slight three-quarter turn while opening the
// town's south facade toward the foreground harbor.
export const OLD_CITY_YAW=30*Math.PI/180;
export function rotateOldCityPoint(p,inverse=false){
 const a=inverse?-OLD_CITY_YAW:OLD_CITY_YAW,c=Math.cos(a),s=Math.sin(a);
 return [c*p[0]+s*p[2],p[1],-s*p[0]+c*p[2]];
}
export const OLD_CITY_BRIDGE_ANCHOR=Object.freeze(rotateOldCityPoint([22.85,5.03,20]));
