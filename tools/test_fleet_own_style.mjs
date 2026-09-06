// =====================================================================
// 各舰种维持自己的战斗方式（主人 2026-09-06）
//
//   「在苔庭之战，除了莫比斯 aircraft 有与鲸鱼的反复拉扯的动作，
//     其他 gateHaulerCraft + gatePodCraft + scoutDefense 都要维持自身的战斗方式，
//     不要跟着莫比斯 aircraft 拉扯癫狂。其他场景也是这样。」
//
//   「gateHaulerCraft 是气垫船，抢滩登陆，稳重如山
//     gatePodCraft 是武装直升机，火力压制
//     scoutDefense 是侦察机，轻灵迅捷，……在空中发射曳光弹标记，而不是近身标记，环绕飞行」
//
// 这条测试把主舰摇成筛子（模拟苔庭鲸的反复拉扯），然后看两件事：
//   ① 泡机（武装直升机）机背始终朝天，姿态自己算，不抄主舰的四元数；
//   ② 气垫艇（气垫船）在海面上照直开，位置变化平滑，不跟着抽搐。
// 侦察机那一侧（standoff 盘旋 + 空中曳光指示）归 test_scout_fleet_wing ⑥。
//
// 运行：node tools/test_fleet_own_style.mjs
// =====================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(bridgePkg)) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), { recursive: true });
  fs.writeFileSync(bridgePkg, JSON.stringify({ name: "three", version: "0.172.0-local-bridge", type: "module", main: "../../vendor/three.module.js" }));
}
globalThis.window = { innerWidth: 1280, innerHeight: 720, addEventListener() {}, removeEventListener() {}, requestAnimationFrame() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
const stubEl = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, textContent: "", appendChild() {}, addEventListener() {}, querySelector: () => stubEl(), querySelectorAll: () => [] });
const stubCanvas = () => { const el = stubEl(); el.width = 64; el.height = 64; el.getContext = () => ({ canvas: el, fillRect() {}, clearRect() {}, measureText: () => ({ width: 6 }), createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), fillText() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {} }); el.toDataURL = () => ""; return el; };
globalThis.document = { createElement: (t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), createElementNS: (_n, t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [], body: { appendChild() {} }, addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const { createMoebiusAircraftSquad } = await import(new URL("src/assets/moebiusAircraft.js", BASE).href);
const { mountGatePodEscort, updateGatePodEscort } = await import(new URL("src/world/gatePodCraft.js", BASE).href);

const R = 160;
const DEG = 180 / Math.PI;

// =====================================================================
// ① 泡机 = 僚机：平稳时贴翼同压坡度，长机被拽时拉开掩护、自己保持姿态
// =====================================================================
{
  const scene = new THREE.Scene();
  const centerDir = new THREE.Vector3(0.3, 0.8, 0.5).normalize();
  const squad = createMoebiusAircraftSquad(centerDir, R, { count: 3 });
  scene.add(squad);
  const wing = mountGatePodEscort(squad, { scale: 1 });
  assert.ok(wing && wing.children.length >= 3, "应挂上僚机");
  const members = squad.userData.members || [];
  assert.ok(members.length >= 3, "机队应有成员");

  /**
   * 给长机摆一个姿态：航向绕**当地的天**转，然后绕机体自身的轴加坡度/俯仰。
   *
   * ⚠️ 必须相对当地球面坐标系摆，不能直接写世界坐标系的四元数。
   * 球面世界里世界 +Y 跟当地的天是两回事：直接写世界四元数的话，
   * 「压 30° 坡度」会被算成「机背偏离天顶 60 多度」，僚机就一直以为
   * 长机在剧烈机动，永远待在掩护轮里（第一版就是这么写错的）。
   * 基底约定与 gatePodCraft 一致：makeBasis(side.negate(), up, fwd)。
   */
  const poseHost = (m, tt, roll, pitch, rBase, rWob) => {
    const up = m.position.clone().normalize();
    const fwd = new THREE.Vector3(0, 1, 0);
    if (Math.abs(fwd.dot(up)) > 0.95) fwd.set(1, 0, 0);
    fwd.addScaledVector(up, -fwd.dot(up)).normalize();
    fwd.applyAxisAngle(up, tt * 0.25); // 航向：绕当地的天缓缓盘旋
    const side = new THREE.Vector3().crossVectors(fwd, up).normalize();
    m.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(side.clone().negate(), up, fwd));
    m.rotateX(pitch);
    m.rotateZ(roll);
    m.position.copy(up).multiplyScalar(rBase + rWob);
  };

  const podState = (pod) => {
    const p = pod.getWorldPosition(new THREE.Vector3());
    const q = pod.getWorldQuaternion(new THREE.Quaternion());
    const up = p.clone().normalize();
    const back = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const side = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    return { p, up, back, side, tilt: Math.acos(THREE.MathUtils.clamp(back.dot(up), -1, 1)) };
  };

  // ---- ①a 密集队形：长机缓缓压 30° 坡度盘旋，僚机必须跟着压 ----
  // 这一条防的是「矫枉过正」：为了不跟着癫狂就把僚机做成各飞各的无人机，
  // 编队转弯时长机压坡、僚机机翼笔直，看起来就不是一个编队了。
  const HOST_ROLL = 0.52; // ≈30°
  for (let i = 0; i < 900; i++) {
    const tt = i * 0.05;
    for (const m of members) poseHost(m, tt, HOST_ROLL, 0.06, R + 40, 0);
    squad.updateMatrixWorld(true);
    updateGatePodEscort(squad, tt);
    squad.updateMatrixWorld(true);
  }
  let paradeTilt = 0;
  let paradeGap = 0;
  for (const pod of wing.children) {
    const s0 = podState(pod);
    paradeTilt = Math.max(paradeTilt, s0.tilt);
    const host = members[pod.userData.escortSlot.member % members.length];
    paradeGap = Math.max(paradeGap, s0.p.distanceTo(host.getWorldPosition(new THREE.Vector3())));
  }
  assert.ok(paradeTilt * DEG > 12,
    `长机压 ${(HOST_ROLL * DEG).toFixed(0)}° 坡度盘旋时，僚机必须跟着压坡度，` +
    `实测才 ${(paradeTilt * DEG).toFixed(0)}°——机翼笔直就不是一个编队了，是三架无人机`);
  assert.ok(paradeTilt * DEG < 45,
    `密集队形的坡度也要在自己的包线内，实测 ${(paradeTilt * DEG).toFixed(0)}°`);
  assert.ok(paradeGap < 26,
    `密集队形要贴得住，实测离长机 ${paradeGap.toFixed(1)} 米`);
  console.log(`  ✓ ①a 密集队形：长机压 30° 盘旋 → 僚机同压 ${(paradeTilt * DEG).toFixed(0)}° · 离长机 ${paradeGap.toFixed(1)} 米`);

  // ---- ①b 掩护轮：苔庭鲸把长机拽得天翻地覆 ----
  // 旧代码 pod.quaternion.copy(host.quaternion)，僚机会跟着原样倒扣。
  // 现在要的是：拉开、稳住、绕着它转（主人：「保持飞行姿态来进行保护」）。
  squad.userData.whaleLock = { active: true };
  let maxTilt = 0;
  let maxJump = 0;
  let maxRange = 0;
  const prev = new Map();
  for (let i = 0; i < 900; i++) {
    const tt = 100 + i * 0.05;
    for (const m of members) {
      // 横滚到倒扣、俯仰到垂直、上下窜 ±18 米——鲸的反复拉扯
      poseHost(m, tt, Math.sin(tt * 3.1) * 2.6, Math.sin(tt * 2.3) * 1.4,
        R + 40, Math.sin(tt * 4.1) * 18);
    }
    squad.updateMatrixWorld(true);
    updateGatePodEscort(squad, tt);
    squad.updateMatrixWorld(true);
    if (i < 120) continue; // 让队形切换与阻尼跟位先收敛
    for (const pod of wing.children) {
      const s0 = podState(pod);
      maxTilt = Math.max(maxTilt, s0.tilt);
      const host = members[pod.userData.escortSlot.member % members.length];
      maxRange = Math.max(maxRange, s0.p.distanceTo(host.getWorldPosition(new THREE.Vector3())));
      const last = prev.get(pod);
      if (last) maxJump = Math.max(maxJump, s0.p.distanceTo(last));
      prev.set(pod, s0.p);
    }
  }

  assert.ok(maxTilt * DEG < 45,
    `长机被拽翻时，僚机必须保持自己的飞行姿态，实测最大倾角 ${(maxTilt * DEG).toFixed(0)}°——` +
    "跟着倒扣就是挂件，不是僚机，也没法保护谁");
  assert.ok(maxRange < 60,
    `掩护是要待在够得着的地方，实测离长机最远 ${maxRange.toFixed(1)} 米——` +
    "拉开不等于飞走");
  assert.ok(maxRange > 12,
    `掩护轮必须真的**拉开**，实测最远才 ${maxRange.toFixed(1)} 米——` +
    "还贴在翼侧就等于没换队形");
  assert.ok(maxJump < 6,
    `跟位是阻尼的，实测单帧最大位移 ${maxJump.toFixed(2)} 米`);
  console.log(`  ✓ ①b 掩护轮：长机翻天覆地 → 僚机倾角 ≤ ${(maxTilt * DEG).toFixed(0)}° · 拉开到 ${maxRange.toFixed(0)} 米绕飞 · 单帧位移 ≤ ${maxJump.toFixed(2)} 米`);

  // ---- ①c 归队：鲸戏落幕、长机重新平飞 → 僚机回到密集队形 ----
  squad.userData.whaleLock.active = false;
  for (let i = 0; i < 900; i++) {
    const tt = 300 + i * 0.05;
    for (const m of members) poseHost(m, tt, HOST_ROLL, 0.06, R + 40, 0);
    squad.updateMatrixWorld(true);
    updateGatePodEscort(squad, tt);
    squad.updateMatrixWorld(true);
  }
  let rejoinGap = 0;
  for (const pod of wing.children) {
    const host = members[pod.userData.escortSlot.member % members.length];
    rejoinGap = Math.max(rejoinGap,
      pod.getWorldPosition(new THREE.Vector3())
        .distanceTo(host.getWorldPosition(new THREE.Vector3())));
  }
  assert.ok(rejoinGap < 26,
    `长机重新平飞后僚机必须归队，实测仍在 ${rejoinGap.toFixed(1)} 米外——` +
    "掩护轮是临时的，不是从此各飞各的");
  console.log(`  ✓ ①c 归队：长机恢复平飞 → 僚机回到密集队形（${rejoinGap.toFixed(1)} 米）`);
}

// =====================================================================
// ② 气垫艇 = 气垫船：海面上照直开，稳重如山
// =====================================================================
{
  const { createVanguardAssault } = await import(new URL("src/world/vanguardAssault.js", BASE).href);
  const { createVanguardSquad } = await import(new URL("src/world/vanguardTrooper.js", BASE).href);
  const { createSoccoCraft } = await import(new URL("src/world/gateHaulerCraft.js", BASE).href);

  const scene = new THREE.Scene();
  const squad = createVanguardSquad();
  scene.add(squad);
  const haulers = [0, 1, 2].map((i) => {
    const c = createSoccoCraft();
    c.name = `vanguard-hauler-${i}`;
    scene.add(c);
    return c;
  });
  const wing = new THREE.Group();
  wing.name = "gate-pod-escort";
  const pods = [];
  for (let i = 0; i < 3; i++) {
    const pod = new THREE.Group();
    const muzzle = new THREE.Object3D();
    muzzle.name = "tranq-muzzle";
    pod.add(muzzle);
    pod.userData.tranqMuzzle = muzzle;
    wing.add(pod);
    pods.push(pod);
  }
  scene.add(wing);

  const hub = new THREE.Vector3(0.3, 0.8, 0.5).normalize();
  const fleet = new THREE.Group();
  const members = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Group();
    m.userData = { uid: i };
    m.position.copy(hub).multiplyScalar(R + 60);
    fleet.add(m);
    members.push(m);
  }
  fleet.userData.members = members;
  scene.add(fleet);

  const a = createVanguardAssault({
    scene, squad, R,
    groundHeightAt: () => R + 0.5,
    getPods: () => pods,
    getHaulers: () => haulers,
    getFleet: () => fleet,
    getDefenders: () => [],
  });

  // 鲸的拉扯：把机队中心每秒来回甩好几次（幅度 ~14 米的地面投影抖动）
  const east = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), hub).normalize();
  const north = new THREE.Vector3().crossVectors(hub, east).normalize();
  let maxStep = 0;
  const prev = haulers.map(() => null);
  let minR = Infinity;
  let maxR = -Infinity;
  for (let i = 0; i < 1400; i++) {
    const tt = i * 0.05;
    const jitter = hub.clone().multiplyScalar(R)
      .addScaledVector(east, Math.sin(tt * 5.3) * 14)
      .addScaledVector(north, Math.cos(tt * 4.7) * 14)
      .normalize();
    for (const m of members) {
      m.position.copy(jitter).multiplyScalar(R + 60 + Math.sin(tt * 6.1) * 22);
    }
    a.update(0.05, tt);
    if (i < 400) continue; // 先让低通收敛
    haulers.forEach((c, k) => {
      if (prev[k]) maxStep = Math.max(maxStep, c.position.distanceTo(prev[k]));
      prev[k] = c.position.clone();
      const r = c.position.length();
      minR = Math.min(minR, r); maxR = Math.max(maxR, r);
    });
  }

  assert.ok(maxStep < 1.2,
    `气垫船单帧位移要小，实测 ${maxStep.toFixed(2)} 米——` +
    "几十吨的东西不会跟着天上的主舰一起抽搐（主人：「稳重如山」）");
  assert.ok(maxR - minR < 3,
    `气垫船贴着海面走，半径起伏应当很小，实测 ${(maxR - minR).toFixed(2)} 米——` +
    "高度由海面决定，不由跟随目标决定");
  console.log(`  ✓ ② 气垫艇（气垫船）：主舰在天上乱窜，艇单帧位移 ≤ ${maxStep.toFixed(2)} 米 · 海面起伏 ${(maxR - minR).toFixed(2)} 米`);
}

console.log("✅ test_fleet_own_style（泡机=僚机：贴翼同压坡度 / 长机被拽时拉开掩护并保持姿态 · 艇=气垫船稳重如山）");
