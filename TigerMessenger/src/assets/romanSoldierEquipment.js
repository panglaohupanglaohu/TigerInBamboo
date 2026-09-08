import * as THREE from "three";
import { ROMAN_EQUIPMENT_DATA as DATA } from "./romanEquipmentData.js";

// These offsets are the approved Blender/Godot assembly contract, in original fig units.
const HAND = new THREE.Vector3(0, -.138, 0);
const SWORD_GRIP = new THREE.Vector3(0, .04, 0);
const SHIELD_GRIP = new THREE.Vector3(-.055, 0, 0);
const controllers = new WeakMap();
let resources = null;
let resourceUsers = 0;

function acquireResources() {
  if (!resources) {
    resources = Object.fromEntries(Object.entries(DATA).map(([kind, data]) => {
      const materials = data.materials.map(spec => {
        const pbr = spec.pbrMetallicRoughness;
        return new THREE.MeshToonMaterial({
          color: new THREE.Color().fromArray(pbr.baseColorFactor),
          side: THREE.DoubleSide,
        });
      });
      const meshes = data.meshes.map(spec => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(spec.positions, 3));
        geometry.setAttribute("normal", new THREE.Float32BufferAttribute(spec.normals, 3));
        geometry.setIndex(spec.indices);
        geometry.computeBoundingSphere();
        return {name: spec.name, geometry, material: materials[spec.material]};
      });
      return [kind, {materials, meshes}];
    }));
  }
  resourceUsers++;
  return resources;
}

function releaseResources() {
  if (--resourceUsers !== 0) return;
  for (const value of Object.values(resources)) {
    for (const mesh of value.meshes) mesh.geometry.dispose();
    for (const material of value.materials) material.dispose();
  }
  resources = null;
}

function groupFrom(kind, shared) {
  const group = new THREE.Group();
  group.name = `roman-${kind}-approved`;
  group.userData.romanEquipmentOwned = true;
  for (const spec of shared[kind].meshes) {
    const mesh = new THREE.Mesh(spec.geometry, spec.material);
    mesh.name = spec.name;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  return group;
}

function snapshot(node) {
  return {position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone()};
}
function restore(node, saved) {
  node.position.copy(saved.position);
  node.quaternion.copy(saved.quaternion);
  node.scale.copy(saved.scale);
  node.updateMatrix();
}

/** Reuse the original Roman body contract; only gladius owns an approved weapon-grip profile. */
export function bindRomanSoldierEquipment(actor, {armorOnly = false} = {}) {
  if (!actor?.userData) return null;
  const existing = controllers.get(actor);
  if (existing) {
    // An explicit costume-only request must never retain a previously bound weapon controller.
    // Ordinary repeat binds do not upgrade an explicitly restricted binding.
    if (!armorOnly || existing.armorOnly) return existing;
    existing.dispose();
  }
  const {body, armL, armR, legL, legR} = actor.userData.parts || {};
  const {gladius, shield, bow, spear} = actor.userData.equipment || {};
  const weaponRole = gladius ? "gladius" : bow ? "longbow" : spear ? "spear" : null;
  if (!body || (!weaponRole && !armorOnly)) return null;
  armorOnly = !!armorOnly || weaponRole !== "gladius";
  if (!armorOnly && (!armL || !armR || !legL || !legR || !shield)) return null;
  const helm = body.getObjectByName("soldier-helm");
  const skirt = body.children[1];
  const crests = ["soldier-crest", "soldier-crest-feathers", "soldier-crest-stems"].map(name => body.getObjectByName(name));
  if (!helm || !skirt?.isMesh || crests.some(n => !n || n.parent !== body)) return null;
  const originalNodes = [];
  actor.traverse(node => originalNodes.push(node));
  const parents = new Map(originalNodes.map(node => [node, node.parent]));
  // Bow cycles and spear/rope/torch callers retain complete ownership of their moving parts,
  // including when the armor is disabled mid-action. Only save transforms this profile writes.
  const savedNodes = armorOnly ? crests : [armL, armR, legL, legR, gladius, shield, ...crests];
  const saved = new Map(savedNodes.map(node => [node, snapshot(node)]));
  const originalVisibility = new Map([helm, skirt].map(node => [node, node.visible]));
  const shared = acquireResources();
  const armor = groupFrom("armor", shared), handle = armorOnly ? null : groupFrom("handle", shared);
  body.add(armor);
  if (handle) shield.add(handle);
  armor.visible = false;
  if (handle) handle.visible = false;
  let active = false, disposed = false;
  const point = new THREE.Vector3(), offset = new THREE.Vector3();
  const turnY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const guardY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -.8);
  const guardZ = new THREE.Quaternion();
  const zAxis = new THREE.Vector3(0, 0, 1);
  const meta = actor.userData.romanEquipment = {
    version: 3, active: false, armorOnly, weaponRole, armorSha256: DATA.armor.sha256,
    handleSha256: handle ? DATA.handle.sha256 : null,
    originalNodeCount: originalNodes.length, addedMeshCount: handle ? 6 : 3,
    frontAxis: "+X", action: "idle",
  };

  function grip(arm, weapon, localGrip) {
    // Position-only correction after animation/aim; works with rotated/scaled world ancestors.
    arm.updateWorldMatrix(true, false);
    weapon.parent.updateWorldMatrix(true, false);
    if (Math.abs(weapon.parent.matrixWorld.determinant()) < 1e-12) return false;
    point.copy(HAND).applyMatrix4(arm.matrixWorld);
    weapon.parent.worldToLocal(point);
    offset.copy(localGrip).multiply(weapon.scale).applyQuaternion(weapon.quaternion);
    weapon.position.copy(point).sub(offset);
    weapon.updateMatrix();
    return true;
  }
  function setEnabled(enabled) {
    if (disposed) return false;
    enabled = !!enabled;
    if (enabled === active) return true;
    if (enabled && originalNodes.some(node => node !== actor && node.parent !== parents.get(node))) return false;
    if (enabled) {
      for (const crest of crests) {
        restore(crest, saved.get(crest));
        crest.position.applyQuaternion(turnY).y -= .018;
        crest.quaternion.premultiply(turnY);
      }
      helm.visible = skirt.visible = false;
    } else {
      for (const [node, state] of saved) restore(node, state);
      for (const [node, visible] of originalVisibility) node.visible = visible;
    }
    active = meta.active = enabled;
    armor.visible = enabled;
    if (handle) handle.visible = enabled;
    // Never changes actor/shield visibility: damage and pooling own those flags.
    if (active) update();
    return true;
  }
  function update({swing = 0, climb = false} = {}) {
    if (!active || disposed) return false;
    if (originalNodes.some(node => node !== actor && node.parent !== parents.get(node))) {
      setEnabled(false);
      return false;
    }
    // Costume assembly follows the existing body hierarchy automatically. In particular,
    // do not touch longbow limbs/strings/arrows or spear aim/throw/rope/torch transforms.
    if (armorOnly) return true;
    if (climb) {
      // Existing combat contract: climbing soldiers carry the shield on their back.
      shield.position.set(-.11, .29, .02);
      shield.quaternion.identity();
    } else {
      armL.position.copy(saved.get(armL).position);
      armL.position.z += .034;
      guardZ.setFromAxisAngle(zAxis, 1.05 + THREE.MathUtils.clamp(swing, -.15, .15));
      armL.quaternion.copy(guardY).multiply(guardZ);
      shield.rotation.set(0, -.5, 0);
      grip(armL, shield, SHIELD_GRIP);
    }
    return grip(armR, gladius, SWORD_GRIP);
  }
  const controller = {
    actor, originalNodes, saved, armor, handle, armorOnly, weaponRole, setEnabled, update,
    get active() { return active; },
    dispose() {
      if (disposed) return;
      setEnabled(false);
      disposed = true;
      armor.removeFromParent(); handle?.removeFromParent();
      releaseResources();
      controllers.delete(actor);
      delete actor.userData.romanEquipment;
      delete actor.userData.setRomanEquipment;
      delete actor.userData.disposeRomanEquipment;
    },
  };
  controllers.set(actor, controller);
  actor.userData.setRomanEquipment = setEnabled;
  actor.userData.disposeRomanEquipment = () => controller.dispose();
  setEnabled(true);
  return controller;
}
