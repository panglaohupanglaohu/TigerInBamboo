// =====================================================================
//  玩家模型：程序化低多边信使（Cel 材质 + 黑边描边）
// =====================================================================
import * as THREE from "three";
import { toonMat, outlineAs } from "../assets/toon.js";

export function buildMessenger() {
  const group = new THREE.Group();
  const skin = toonMat(0xf0c8a0);
  const cloth = toonMat(0x4a7fd4);
  const dark = toonMat(0x2a3550);
  const accent = toonMat(0xffe08a, { emissive: 0x665520, emissiveIntensity: 0.35 });
  const capeMat = toonMat(0x3a5a9a, { side: THREE.DoubleSide });

  // 身体
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.35), cloth);
  body.position.y = 0.95;
  body.castShadow = true;
  outlineAs(body, "character");
  group.add(body);

  // 头
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 1.45;
  head.castShadow = true;
  outlineAs(head, "character");
  group.add(head);

  // 虎耳
  const earL = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 4), accent);
  earL.position.set(-0.14, 1.72, 0);
  earL.rotation.z = 0.25;
  outlineAs(earL, "characterDetail");
  group.add(earL);
  const earR = earL.clone();
  earR.position.x = 0.14;
  earR.rotation.z = -0.25;
  group.add(earR);

  // 眼睛（低多边点）
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a2030 });
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.04), eyeMat);
  eyeL.position.set(-0.1, 1.48, 0.22);
  group.add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.1;
  group.add(eyeR);

  // 背包
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.18), dark);
  pack.position.set(0, 1.0, -0.26);
  pack.castShadow = true;
  group.add(pack);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.06), accent);
  strap.position.set(0, 1.15, -0.18);
  group.add(strap);

  // 披风（跑动时摆动）
  const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.7), capeMat);
  cape.position.set(0, 0.95, -0.38);
  cape.castShadow = true;
  group.add(cape);

  // 腿（枢轴在髋）
  const legGeo = new THREE.BoxGeometry(0.16, 0.45, 0.18);
  legGeo.translate(0, -0.225, 0);
  const legL = new THREE.Mesh(legGeo, dark);
  legL.position.set(-0.14, 0.58, 0);
  legL.castShadow = true;
  outlineAs(legL, "characterDetail");
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, dark);
  legR.position.set(0.14, 0.58, 0);
  legR.castShadow = true;
  outlineAs(legR, "characterDetail");
  group.add(legR);

  // 臂（枢轴在肩）
  const armGeo = new THREE.BoxGeometry(0.12, 0.42, 0.14);
  armGeo.translate(0, -0.2, 0);
  const armL = new THREE.Mesh(armGeo, cloth);
  armL.position.set(-0.38, 1.15, 0);
  armL.castShadow = true;
  outlineAs(armL, "characterDetail");
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, cloth);
  armR.position.set(0.38, 1.15, 0);
  armR.castShadow = true;
  outlineAs(armR, "characterDetail");
  group.add(armR);

  // 信件道具（持有时显示）
  const letter = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.2, 0.04),
    toonMat(0xfff4d6, { emissive: 0xaa8844, emissiveIntensity: 0.45 })
  );
  letter.position.set(0.42, 1.05, 0.2);
  letter.visible = false;
  group.add(letter);

  group.userData = { legL, legR, armL, armR, body, head, earL, earR, cape, letter, eyeL, eyeR };
  return group;
}
