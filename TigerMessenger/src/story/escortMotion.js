import * as THREE from 'three';

// Follow the route actually walked by the player, rather than cutting diagonally
// toward their current position. Collision/grounding is supplied by the world.
export function createEscortMotion({ position, lag = 2, advance, distanceBetween = (a, b) => a.distanceTo(b) }) {
  const world = position.clone();
  const route = [];
  const direction = new THREE.Vector3();
  const before = new THREE.Vector3();
  const movement = new THREE.Vector3();
  let remaining = 0;
  let last = null;
  return {
    position: world,
    direction,
    update(target, dt) {
      if (!last) { last = target.clone(); route.push(last.clone()); }
      const distance = distanceBetween(last, target);
      if (distance >= 0.35) {
        remaining += distance;
        last.copy(target);
        route.push(last.clone());
      }
      // Keep a bounded history if the animal cannot follow a closed passage.
      // Never teleport it through the obstacle to catch up.
      if (route.length > 2048) {
        remaining -= distanceBetween(route[route.length - 2], route[route.length - 1]);
        route.pop(); last.copy(route[route.length - 1]);
      }
      let budget = Math.min(Math.max(dt, 0), 0.1);
      while (budget > 1e-6) {
        const step = Math.min(budget, 1 / 120);
        budget -= step;
        while (route.length > 1 && distanceBetween(world, route[0]) < 0.4) {
          remaining -= distanceBetween(route[0], route[1]);
          route.shift();
        }
        const goal = route[0];
        movement.set(0, 0, 0);
        if (goal && (remaining > lag || distanceBetween(world, goal) > lag)) {
          movement.copy(goal).sub(world);
          const length = movement.length();
          if (length > 0.01) movement.multiplyScalar(Math.min(9, length / step) / length);
        }
        before.copy(world);
        advance(world, movement, step);
        if (world.distanceToSquared(before) > 1e-8) direction.copy(world).sub(before).normalize();
      }
      return world;
    },
  };
}
