// Approved composition: keep the foreground plaza fixed while the new keep
// turns clockwise. These coordinates are authored before the -52 composition shift.
export const NEW_CITY_YAW=-Math.PI/6;
export const NEW_CITY_PIVOT=Object.freeze([60,0,71.5]);
export function rotateNewCityPoint(p,inverse=false){
  const a=inverse?-NEW_CITY_YAW:NEW_CITY_YAW,c=Math.cos(a),s=Math.sin(a);
  const x=p[0]-NEW_CITY_PIVOT[0],z=p[2]-NEW_CITY_PIVOT[2];
  return [NEW_CITY_PIVOT[0]+c*x+s*z,p[1],NEW_CITY_PIVOT[2]-s*x+c*z];
}
