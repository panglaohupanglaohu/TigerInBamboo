/**
 * Attach img2threejs-style sculptRuntime to a procedural THREE.Group.
 */
import * as THREE from "../../assets/vendor/three/three.module.js";

/**
 * @param {THREE.Object3D} root
 * @param {object} spec SculptSpec or morphology-compatible plan with sockets/runtime
 * @returns {THREE.Object3D}
 */
export function attachSculptRuntime(root, spec = {}) {
  if (!root) return root;
  const nodes = {};
  const sockets = {};
  const socketList = spec.sockets || spec.sculptTemplate?.sockets || [];

  for (const s of socketList) {
    if (!s?.id) continue;
    const pivot = new THREE.Object3D();
    pivot.name = `socket:${s.id}`;
    if (Array.isArray(s.position) && s.position.length >= 3) {
      pivot.position.set(Number(s.position[0]) || 0, Number(s.position[1]) || 0, Number(s.position[2]) || 0);
    }
    pivot.userData.socketPurpose = s.purpose || null;
    root.add(pivot);
    sockets[s.id] = pivot;
  }

  const runtime = spec.runtime || {};
  root.userData = {
    ...root.userData,
    generatedBy: "tib-sculpt",
    engineLabel: root.userData.engineLabel || "Sculpt 程序化",
    sculptSpec: spec,
    sculptRuntime: {
      version: 1,
      subjectKey: spec.subjectKey || null,
      builderKey: spec.build?.builderKey || null,
      nodes,
      sockets,
      colliders: [],
      ecologyTags: runtime.ecologyTags || spec.ecologyTags || [],
      anatomyProfile: runtime.anatomyProfile || null,
      tick: runtime.tick || null,
      specVersion: spec.specVersion || "tib-sculpt-1",
    },
  };
  return root;
}

/** Wind / flow tick for installed sculpt entities. */
export function tickSculptEntity(entity, time, wind = 0.3) {
  const rt = entity?.userData?.sculptRuntime;
  if (!rt) return;
  if (rt.tick === "sway") {
    const pivot = rt.sockets?.["sway-root"] || entity;
    const phase = entity.userData.swayPhase ?? (entity.userData.swayPhase = Math.random() * Math.PI * 2);
    const flex = 0.1 + wind * 0.35;
    pivot.rotation.z = Math.sin(time * (0.7 + wind) + phase) * flex;
    pivot.rotation.x = Math.cos(time * 0.45 + phase) * flex * 0.35;
  }
}

export function collectBuiltTypesFromPlan(plan) {
  const types = new Set();
  for (const c of plan?.components || []) {
    if (c?.type) types.add(c.type);
  }
  return [...types];
}
