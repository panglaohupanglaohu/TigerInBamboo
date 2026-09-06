import fs from "node:fs";
import { fileURLToPath } from "node:url";
const BASE = new URL("../TigerMessenger/", import.meta.url);
globalThis.window = { innerWidth: 1280, innerHeight: 720, addEventListener() {}, removeEventListener() {}, requestAnimationFrame() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
const stubEl = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, textContent: "", appendChild() {}, addEventListener() {}, querySelector: () => stubEl(), querySelectorAll: () => [] });
const stubCanvas = () => { const el = stubEl(); el.width = 64; el.height = 64; el.getContext = () => ({ canvas: el, fillRect() {}, clearRect() {}, measureText: () => ({ width: 6 }), createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), fillText() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {} }); el.toDataURL = () => ""; return el; };
globalThis.document = { createElement: (t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), createElementNS: (_n, t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [], body: { appendChild() {} }, addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const { createMoebiusAircraftSquad } = await import(new URL("src/assets/moebiusAircraft.js", BASE).href);
const { mountGatePodEscort, updateGatePodEscort } = await import(new URL("src/world/gatePodCraft.js", BASE).href);
const R = 160;
const scene = new THREE.Scene();
const squad = createMoebiusAircraftSquad(new THREE.Vector3(0.3,0.8,0.5).normalize(), R, { count: 3 });
scene.add(squad);
const wing = mountGatePodEscort(squad, { scale: 1 });
const members = squad.userData.members;
console.log("squad scale", squad.scale.toArray(), "members", members.length, "member scale", members[0].scale.toArray());
const poseHost = (m, tt, roll, pitch, rBase, rWob) => {
  const up = m.position.clone().normalize();
  const q = new THREE.Quaternion().setFromAxisAngle(up, tt*0.25);
  q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1), roll));
  q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), pitch));
  m.quaternion.copy(q); m.position.copy(up).multiplyScalar(rBase + rWob);
};
for (let i=0;i<900;i++){ const tt=i*0.05; for(const m of members) poseHost(m,tt,0.52,0.06,R+40,0); squad.updateMatrixWorld(true); updateGatePodEscort(squad, tt); squad.updateMatrixWorld(true); }
wing.children.forEach((pod,i)=>{
  const host = members[pod.userData.escortSlot.member];
  const hp = host.getWorldPosition(new THREE.Vector3());
  const pp = pod.getWorldPosition(new THREE.Vector3());
  console.log(i, "slot", JSON.stringify(pod.userData.escortSlot), "gap", pp.distanceTo(hp).toFixed(2), "cover", pod.userData._wing.cover.toFixed(3));
});
