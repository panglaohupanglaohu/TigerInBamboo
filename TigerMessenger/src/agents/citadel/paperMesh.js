// =====================================================================
//  登陆样片纸兵网格。仅 V3 样片使用，不改默认方阵兵模。
// =====================================================================
import * as THREE from "three";
import { applyPaperPose } from "./paperBind.js";

export function createPaperSoldierMesh(agent) {
  const root = new THREE.Group();
  root.name = `paper-${agent.id}`;
  root.userData.kind = "citadel-v6-paper-soldier";
  root.userData.agentId = agent.id;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.16), new THREE.MeshToonMaterial({ color: agent.side === "red" ? 0x593b47 : 0x416f91 }));
  body.name = "torso";
  body.position.y = 0.55;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.08), body.material);
  legL.name = "legL";
  legL.position.set(-0.06, 0.18, 0);
  const legR = legL.clone();
  legR.name = "legR";
  legR.position.x = 0.06;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.06), body.material);
  armL.name = "armL";
  armL.position.set(-0.16, 0.62, 0);
  const armR = armL.clone();
  armR.name = "armR";
  armR.position.x = 0.16;
  const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.1, 4), new THREE.MeshToonMaterial({ color: 0x9a7434 }));
  spear.name = "spear";
  spear.position.set(0.22, 0.7, 0.15);
  const shield = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.04), new THREE.MeshToonMaterial({ color: 0xeee2cb }));
  shield.name = "shield";
  shield.position.set(-0.22, 0.58, 0.08);
  const torch = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 4), new THREE.MeshToonMaterial({ color: 0xffb347 }));
  torch.name = "torch";
  torch.visible = agent.role === "torch";
  torch.position.set(-0.18, 0.85, 0.05);
  root.add(body, legL, legR, armL, armR, spear, shield, torch);
  root.userData.parts = { torso: body, legL, legR, armL, armR, spear, shield, torch };
  applyPaperPose(root.userData.parts, { legL: 0, legR: 0, armL: 0, armR: 0, amp: 0 }, { spear: 0, shield: 0.1 });
  return root;
}
