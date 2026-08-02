// =====================================================================
//  AgentsGroup2026 风格送信智能体
//  形态来源：数字孪生页的 createAgentFigure：头部环形核心 + 半透明 U 型躯干。
//  保留 player animation / quest 所需的 userData 接口，但不再使用虎头、四足或尾巴。
// =====================================================================
import * as THREE from "three";

const AGENT_CYAN = 0x72d7e7;
const AGENT_INK = 0x183944;

function basic(color, opacity = 1, extra = {}) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: opacity >= 1,
    ...extra,
  });
}

/**
 * 数字孪生风格的送信人：不模拟动物，也不做实体人脸，
 * 用“头部环形核心 + 发光 U 型身体”表达正在工作的智能体。
 */
export function buildAgentMessenger({ color = AGENT_CYAN } = {}) {
  const group = new THREE.Group();
  const col = new THREE.Color(color);
  const coreMat = basic(col, 0.9);
  const glowMat = basic(col, 0.26, { depthTest: false, depthWrite: false });

  // 与 AgentsGroup2026 数字孪生页一致的顶部环形核心。
  const headRing = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.04, 12, 32), coreMat);
  headRing.position.y = 2.0;
  group.add(headRing);
  const headGlow = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.14, 12, 32), glowMat);
  headGlow.position.copy(headRing.position);
  group.add(headGlow);

  // 数字孪生页的 U 型 TubeGeometry：两端在肩位，中段下垂成开放躯干。
  const points = [];
  for (let i = 0; i <= 32; i++) {
    const t = i / 32;
    const a = Math.PI * t;
    points.push(new THREE.Vector3(
      -Math.cos(a) * 0.48,
      1.25 - Math.sin(a) * 0.65,
      0,
    ));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const bodyGroup = new THREE.Group();
  const body = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.038, 8, false), coreMat);
  body.castShadow = true;
  bodyGroup.add(body);
  const bodyGlow = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.13, 8, false), glowMat);
  bodyGroup.add(bodyGlow);
  group.add(bodyGroup);

  // 底部仅保留很弱的工作状态指示，不使用场景级光环。
  const groundRing = new THREE.Mesh(
    new THREE.RingGeometry(0.38, 0.5, 32),
    basic(col, 0.1, { depthTest: false, depthWrite: false }),
  );
  groundRing.rotation.x = -Math.PI / 2;
  groundRing.position.y = 0.015;
  group.add(groundRing);

  // 送信中的信件：沿用任务系统的 visible 开关。
  const letter = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.16, 0.035),
    basic(0xfff4d6, 0.96),
  );
  letter.position.set(0.58, 1.03, 0.02);
  letter.visible = false;
  group.add(letter);

  // 动画兼容占位节点：智能体没有四肢，但保留接口让走路/跳跃状态继续工作。
  const legL = new THREE.Group();
  const legR = new THREE.Group();
  const armL = new THREE.Group();
  const armR = new THREE.Group();
  const cape = new THREE.Group();
  cape.visible = false;
  group.add(legL, legR, armL, armR, cape);

  group.userData = {
    legL,
    legR,
    armL,
    armR,
    body: bodyGroup,
    head: headRing,
    headG: group,
    cape,
    letter,
    bodyBaseY: 0,
    letterBaseY: 1.03,
    isTiger: false,
    isAgent: true,
    agentColor: col.getHex(),
  };
  // 与当前场景的树木、NPC 比例协调：整体缩小到原智能体的 1/3。
  group.scale.setScalar(0.35);
  return group;
}
