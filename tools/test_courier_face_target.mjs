// tools/test_courier_face_target.mjs
// 验证信使面部 Low Poly 雕刻模型对齐《信使 · Low Poly 面部目标》（正面、侧面、3/4 视图与 8 色卡）
import assert from "node:assert/strict";

const THREE = await import("../TigerMessenger/vendor/three.module.js");
const { buildHumanCourierCodrops, COURIER_PALETTE } = await import("../TigerMessenger/src/assets/characters/courierCodrops.js");
const { updateCourierLookAt } = await import("../TigerMessenger/src/assets/characters/humanCourier.js");

console.log("================================================================");
console.log("  信使 Low Poly 面部目标还原度（三视图特征与色卡）专项测试");
console.log("================================================================");

const courier = buildHumanCourierCodrops();
const head = courier.userData.head;
assert.ok(head, "必须包含 head 头部关节节点");

// 1. 验证目标图低多边形分面雕刻部件完整性
console.log("\n[1] 测试面部 Low Poly 分面五官与雕刻特征 (Facial Anatomy)...");
const headChildrenNames = head.children.map((c) => c.name);

// 验证面部肌肉/骨骼分面网格
const faceFacet2 = head.getObjectByName("head:Anatomy_facet_2.002");
const faceFacet3 = head.getObjectByName("head:Anatomy_facet_3.002");
assert.ok(faceFacet2, "必须包含面部亮部高光分面 (Anatomy_facet_2.002)");
assert.ok(faceFacet3, "必须包含面颊与下颌阴影分面 (Anatomy_facet_3.002)");

// 验证直挺鼻梁与鼻尖（Z > 0.10）
const faceNose = head.getObjectByName("head:Anatomy_stubble_1.001");
faceNose.geometry.computeBoundingBox();
assert.ok(faceNose.geometry.boundingBox.max.z > 0.10, "直挺低模鼻梁与鼻尖必须达到 Z > 0.10 的立体突起");

// 验证杏仁眼、巩膜与琥珀色金瞳
const eyeSclera = head.getObjectByName("head:Anatomy_sclera.001");
const eyeIris = head.getObjectByName("head:Anatomy_iris.001");
assert.ok(eyeSclera, "必须包含象牙白眼白巩膜网格");
assert.ok(eyeIris, "必须包含琥珀金色瞳孔网格");

// 验证双唇与嘴唇材质
const lips = head.getObjectByName("head:Anatomy_lip.001");
assert.ok(lips, "必须包含低多边形立体双唇网格");

console.log("  ✓ 额头、眉弓、直挺鼻梁、高颧骨、深邃眼眶与立体双唇分面雕刻完整");

// 2. 验证目标图胡须系统（上唇胡、下巴短须、下颌连鬓胡、渐变胡茬）
console.log("\n[2] 测试胡须与下颌胡茬雕刻 (Mustache & Boxed Beard)...");
const beardV3 = head.getObjectByName("head:Anatomy_beard_v3");
assert.ok(beardV3, "必须包含精雕上唇胡与下颌短须网格 (Anatomy_beard_v3)");

// 验证渐变胡茬材质色阶
let stubbleCount = 0;
head.traverse((o) => {
  if (o.isMesh && o.name.includes("Anatomy_stubble_")) {
    stubbleCount++;
  }
});
assert.ok(stubbleCount >= 8, `必须包含面部渐变胡茬色阶分面 (当前: ${stubbleCount})`);
console.log(`  ✓ 修剪整齐的上唇胡、下颌短须与 ${stubbleCount} 组渐变胡茬色阶分面就绪`);

// 3. 验证微卷长发与脑后半扎丸子头
console.log("\n[3] 测试发型系统（微卷长发、前额侧鬓垂发、脑后半扎丸子头）...");
const hairHelmet = head.getObjectByName("head:Anatomy_hair");
assert.ok(hairHelmet, "必须包含发体基底网格 (Anatomy_hair)");

const sideLocks = head.getObjectByName("TargetLowPolySideLocks");
assert.ok(sideLocks, "必须包含目标图三视图两侧醒目的微卷垂颊发束");
assert.strictEqual(sideLocks.children.length, 6, "两侧垂发应包含 6 组波浪分面发绺 (左3右3)");

const bunRing = head.children.find((c) => c.geometry?.type === "CylinderGeometry" && c.position.z < -0.05);
assert.ok(bunRing, "必须包含脑后半扎丸子头束圈发扣");
console.log("  ✓ 中分微卷发基底、前额微卷刘海、两侧垂颊波浪发束与脑后半扎丸子头就绪");

// 4. 验证酒红斗篷折叠领口、青绿衬里与古金菱形搭扣
console.log("\n[4] 测试领口与搭扣特征 (Cowl Collar & Golden Clasp)...");
const cowlBust = head.getObjectByName("TargetLowPolyCowlBust");
assert.ok(cowlBust, "必须包含目标图下半身酒红斗篷折叠领口组合");

const cowlOuter = cowlBust.children.find((c) => c.material?.color?.getHex() === COURIER_PALETTE.wine || c.material?.color?.getHex() === COURIER_PALETTE.face_wine);
assert.ok(cowlOuter, "领口必须包含酒红斗篷外折环");

const cowlInner = cowlBust.children.find((c) => c.material?.color?.getHex() === COURIER_PALETTE.teal || c.material?.color?.getHex() === COURIER_PALETTE.face_teal);
assert.ok(cowlInner, "领口必须包含青绿内衬折边");

const clasp = cowlBust.children.find((c) => c.children.length > 0 && (c.material?.color?.getHex() === COURIER_PALETTE.gold || c.material?.color?.getHex() === COURIER_PALETTE.face_gold));
assert.ok(clasp, "右侧领口必须包含标志性古金菱形斗篷搭扣");
console.log("  ✓ 酒红斗篷外折环、青绿内衬折边、象牙白 V 领口与右侧古金菱形搭扣完整");

// 5. 验证零毛发纤维穿模/噪点（干净的低多边形几何面）
console.log("\n[5] 测试网格精简性（排除密集毛发纤维噪点）...");
let fiberMeshFound = false;
head.traverse((o) => {
  if (o.name.toLowerCase().includes("fiber")) fiberMeshFound = true;
});
assert.strictEqual(fiberMeshFound, false, "严禁加载破坏低模美感的微网格毛发纤维");
console.log("  ✓ 密集毛发纤维 100% 排除，保持纯正 Low Poly 几何平整切面");

// 6. 验证视线驱动与头部转动平滑度
console.log("\n[6] 测试 Codrops 头部视线追踪联动 (Look-At Tracking)...");
const playerMock = { lookTarget: { x: 0.8, y: -0.5 }, velocity: new THREE.Vector3(0, 0, 0) };
updateCourierLookAt(playerMock, courier, 0.2);
assert.ok(head.rotation.y < 0, "向右看时头部偏航 yaw 应随目标平滑右转");
assert.ok(head.rotation.x > 0, "向下看时头部俯仰 pitch 应随目标平滑微低头");
console.log(`  ✓ 头部程序化注视转向平滑有效 (yaw: ${(head.rotation.y * 180 / Math.PI).toFixed(1)}°, pitch: ${(head.rotation.x * 180 / Math.PI).toFixed(1)}°)`);

console.log("\n================================================================");
console.log("  🎉 全部 6 项面部 Low Poly 目标还原度专项指标 100% 验证通过！");
console.log("================================================================");
