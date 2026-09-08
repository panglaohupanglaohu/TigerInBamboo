import * as THREE from "three";
import { bindRomanSoldierEquipment } from "../assets/romanSoldierEquipment.js";

/** Cosmetic continuation of the real battle's movement, hit cooldown and climb state. */
export function createRomanCombatPresentation() {
  const actors = new Map();
  const swordAxis = new THREE.Vector3(0, 1, 0);
  const direction = new THREE.Vector3(), safeDirection = new THREE.Vector3();
  const correction = new THREE.Quaternion();
  let enabled = true;
  function add(actor) {
    const equipment = actor?.userData?.equipment;
    if (actors.has(actor) || !(equipment?.gladius || equipment?.bow || equipment?.spear)) return;
    const controller = bindRomanSoldierEquipment(actor);
    if (!controller) return;
    controller.setEnabled(enabled);
    actors.set(actor, {controller, last: actor.position.clone(), distance: 0, lastCd: 0, attack: 0});
  }
  function attached(actor, battleRoot) {
    for (let node = actor; node; node = node.parent) if (node === battleRoot) return true;
    return false;
  }
  return {
    add,
    setEnabled(value) {
      enabled = !!value;
      for (const {controller} of actors.values()) controller.setEnabled(enabled);
    },
    update(dt, t, battleRoot) {
      for (const [actor, state] of actors) {
        if (!attached(actor, battleRoot)) {
          state.controller.dispose(); actors.delete(actor); continue;
        }
        const delta = actor.position.distanceTo(state.last);
        state.last.copy(actor.position);
        if (!state.controller.active) continue;
        const ud = actor.userData, parts = ud.parts;
        const visible = (() => { for (let node = actor; node; node = node.parent) if (!node.visible) return false; return true; })();
        if (state.controller.armorOnly) {
          // Original bow cycles also pose body and legs. Spear callers own aiming and throwing.
          // These branches only observe the existing action, never replay gladius animation.
          state.controller.update();
          if (!ud.romanEquipment) continue;
          const moving = delta > .0001 && delta < Math.max(2, dt * 12);
          ud.romanEquipment.action = ud.dead ? "dead" : ud.downed ? "downed" : !visible ? "pooled"
            : state.controller.weaponRole === "longbow" ? `bow-${ud.bowCycle?.phase || "idle"}`
              : ud.siegeStage === "climb" ? "climb"
                : ud.throwState?.phase && ud.throwState.phase !== "rest" ? `spear-${ud.throwState.phase}`
                  : moving ? "walk" : "guard";
          continue;
        }
        if (!visible || ud.dead || ud.downed) {
          state.controller.update({climb: ud.siegeStage === "climb"});
          ud.romanEquipment.action = ud.dead ? "dead" : ud.downed ? "downed" : "pooled";
          continue;
        }
        const moving = delta > .0001 && delta < Math.max(2, dt * 12);
        if (moving) state.distance += delta;
        const gait = moving ? Math.sin(state.distance * 8) : 0;
        const cd = ud._meleeCd || 0;
        if (cd > state.lastCd + .05) state.attack = .34;
        state.lastCd = cd;
        state.attack = Math.max(0, state.attack - dt);
        const attack = state.attack > 0 ? Math.sin((1 - state.attack / .34) * Math.PI) : 0;
        const climb = ud.siegeStage === "climb";
        const wave = climb ? Math.sin(t * 7 + (ud.uid || 0)) : gait;
        parts.legL.rotation.z = .08 + wave * (climb ? .55 : .4);
        parts.legR.rotation.z = -.08 - wave * (climb ? .55 : .4);
        parts.armR.rotation.z = climb ? 2.3 - wave * .3 : .85 + attack * .5 - gait * .08;
        if (climb) {
          parts.armL.position.copy(state.controller.saved.get(parts.armL).position);
          parts.armL.rotation.set(0, 0, 2.3 + wave * .3);
        }
        // Target aim can momentarily point across the left shield while the actor turns.
        // Keep the blade in the right-hand forward arc; targeting and damage remain unchanged.
        const sword = ud.equipment.gladius;
        direction.copy(swordAxis).applyQuaternion(sword.quaternion);
        safeDirection.set(Math.max(.5, direction.x), direction.y, Math.min(.12, direction.z)).normalize();
        ud.romanEquipment.aimLimited = !direction.equals(safeDirection);
        correction.setFromUnitVectors(direction, safeDirection);
        sword.quaternion.premultiply(correction);
        state.controller.update({swing: gait * .1, climb});
        ud.romanEquipment.action = climb ? "climb" : attack > 0 ? "strike" : moving ? "walk" : "guard";
      }
    },
    dispose() {
      for (const {controller} of actors.values()) controller.dispose();
      actors.clear();
    },
  };
}
