import * as THREE from "three";

const up = new THREE.Vector3(), forward = new THREE.Vector3(), side = new THREE.Vector3();
const basis = new THREE.Matrix4();

/** Original FisherBoat and reviewed candidates: +X prow, +Y deck up, -X stern. */
export function orientWarship(boat, surfaceUp, heading = null) {
  up.copy(surfaceUp).normalize();
  if (heading && heading.lengthSq() > 1e-16) forward.copy(heading);
  else forward.set(1, 0, 0).applyQuaternion(boat.quaternion);
  forward.addScaledVector(up, -forward.dot(up));
  if (forward.lengthSq() < 1e-16) {
    forward.set(Math.abs(up.x) < .8 ? 1 : 0, Math.abs(up.x) < .8 ? 0 : 1, 0);
    forward.addScaledVector(up, -forward.dot(up));
  }
  forward.normalize();
  // A rotation requires X cross Y = Z. up cross forward would reflect the frame.
  side.crossVectors(forward, up).normalize();
  boat.quaternion.setFromRotationMatrix(basis.makeBasis(forward, up, side)).normalize();
}

export function placeWarshipOnSphere(boat, direction, radius, heading = null) {
  orientWarship(boat, direction, heading);
  boat.position.copy(direction).normalize().multiplyScalar(radius);
}

/** Exact current leg tangent; holding legs retain the last valid ship heading. */
export function sampleWarshipRoute(legs, progress, direction, heading) {
  let accumulated = 0;
  let leg = legs[legs.length - 1], t = 1;
  for (const entry of legs) {
    if (progress <= accumulated + entry[2]) {
      leg = entry;
      t = THREE.MathUtils.clamp((progress - accumulated) / Math.max(1e-6, entry[2]), 0, 1);
      break;
    }
    accumulated += entry[2];
  }
  direction.copy(leg[0]).lerp(leg[1], t).normalize();
  heading.copy(leg[1]).sub(leg[0]);
  return heading.lengthSq() > 1e-16;
}
