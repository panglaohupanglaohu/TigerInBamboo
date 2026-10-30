import * as T from 'three';
/** Move on the planet, using the same authored ground and ocean levels as the game. */
export function stepHorseSurface({horse,heading,distance,turn=0,groundRadius,waterRadius}){
  horse.updateWorldMatrix(true,false);
  const origin=horse.getWorldPosition(new T.Vector3()),up=origin.clone().normalize();
  heading.projectOnPlane(up).normalize().applyAxisAngle(up,turn);
  const next=origin.clone().addScaledVector(heading,distance),normal=next.clone().normalize();
  const sea=waterRadius(next),ground=groundRadius(next);
  if(!Number.isFinite(sea)||ground===Infinity)return{moved:false,swimming:false};
  const swimming=!Number.isFinite(ground)||ground<sea-.25;
  let radius=Math.max(Number.isFinite(ground)?ground:-Infinity,sea-.45);
  // No climbing walls or teleporting down a cliff. A low shoreline remains traversable.
  if(radius-origin.length()>.42){if(!swimming)return{moved:false,swimming:!!horse.userData.horse.swimming};radius=origin.length()+.12;}
  // Ease a sea-entry drop over successive physics substeps instead of snapping down.
  if(origin.length()-radius>.42){if(!swimming)return{moved:false,swimming:false};radius=origin.length()-.12;}
  next.copy(normal).multiplyScalar(radius);
  heading.applyQuaternion(new T.Quaternion().setFromUnitVectors(up,normal)).projectOnPlane(normal).normalize();
  const right=new T.Vector3().crossVectors(normal,heading).normalize();
  const rotation=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(right,normal,heading));
  horse.position.copy(horse.parent?horse.parent.worldToLocal(next):next);
  if(horse.parent)rotation.premultiply(horse.parent.getWorldQuaternion(new T.Quaternion()).invert());
  horse.quaternion.copy(rotation);horse.updateWorldMatrix(true,false);
  return{moved:true,swimming:swimming&&radius<=sea+.05,radius};
}
