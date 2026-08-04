// 湖沼 BGM 进入判定的几何验证：
// createMoebiusSwampPlacement 的包装层（wrap）worldToLocal 应给出"坑口局部坐标"：
//   - 坑缘 = 包装原点（局部 y=0），坑口半径 34（局部 x/z 平面）
//   - 坑内向球心塌陷 → 局部 y 为负
// 据此验证 messengerIsland 里"进入湖沼"判定的四个典型场景。
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// 复用 three → vendor 解析桥
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(bridgePkg)) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), {
    recursive: true,
  });
  fs.writeFileSync(
    bridgePkg,
    JSON.stringify(
      { name: "three", version: "0.172.0-local-bridge", type: "module", main: "../../vendor/three.module.js" },
      null,
      2
    )
  );
}

const THREE = await import("../TigerMessenger/vendor/three.module.js");
const { quatYToDir } = await import("../TigerMessenger/src/world/sphereMath.js");

const R = 40;
const SWAMP_GROUND_Y = 40;

// 复刻 createMoebiusSwampPlacement + placeMoebiusSwampOnSphere 的包装层变换
function makeSwampWrap(dir, scale = 0.5) {
  const inner = new THREE.Group();
  inner.name = "swamp-inner";
  inner.position.y = -SWAMP_GROUND_Y; // 局部 Y=40 的地表对齐包装原点
  const wrap = new THREE.Group();
  wrap.name = "moebius-swamp-placement";
  wrap.userData.kind = "moebius-swamp";
  wrap.add(inner);
  wrap.scale.setScalar(scale);
  wrap.quaternion.copy(quatYToDir(dir, new THREE.Quaternion()));
  wrap.position.copy(dir.clone().multiplyScalar(R)); // 坑缘贴齐地表
  wrap.updateWorldMatrix(true, true);
  return { wrap, inner };
}

const dir = new THREE.Vector3(0.3, 0.9, 0.32).normalize();
const { wrap } = makeSwampWrap(dir);

// 判定常量（与 messengerIsland.js 保持一致）
const ENTER_R = 33;
const CEILING = 28;
function isInside(worldPos) {
  wrap.updateWorldMatrix(true, false);
  const local = worldPos.clone();
  wrap.worldToLocal(local);
  const horiz = Math.hypot(local.x, local.z);
  return horiz < ENTER_R && local.y < CEILING;
}

// 把"坑口局部坐标"反映射回世界坐标，用于构造测试点
function localToWorld(x, yLocal, z) {
  const v = new THREE.Vector3(x, yLocal, z);
  wrap.updateWorldMatrix(true, false);
  return v.applyMatrix4(wrap.matrixWorld);
}

const results = [];
function check(name, cond, detail) {
  results.push([name, !!cond, detail]);
}

// 1) 坑缘中心的地表点 → 局部 (0,0,0)：应判定为"进入"
{
  const pos = localToWorld(0, 0, 0);
  check("坑缘中心地表 → 进入", isInside(pos), "局部(0,0,0)");
}
// 2) 坑内下降 12 单位（向球心）→ 局部 (0,-12,0)：应"进入"
{
  const pos = localToWorld(0, -12, 0);
  check("坑内下降 12 → 进入", isInside(pos), "局部(0,-12,0)");
}
// 3) 坑内靠近边缘 horiz=30 → 应"进入"
{
  const pos = localToWorld(30, -3, 0);
  check("坑内 horiz=30 → 进入", isInside(pos), "局部(30,-3,0)");
}
// 4) 坑外地表 horiz=50 → 应"不进入"
{
  const pos = localToWorld(50, 0, 0);
  check("坑外地表 horiz=50 → 不进入", !isInside(pos), "局部(50,0,0)");
}
// 5) 高空飞越坑心上方 y=60 → 应"不进入"（超过树冠上限）
{
  const pos = localToWorld(0, 60, 0);
  check("高空飞越 y=60 → 不进入", !isInside(pos), "局部(0,60,0)");
}
// 6) 贴地接近但还在坑缘外 horiz=36 → 应"不进入"（进入阈值 33 收口）
{
  const pos = localToWorld(36, 0, 0);
  check("坑缘外 horiz=36 → 不进入", !isInside(pos), "局部(36,0,0)");
}

let pass = true;
for (const [name, ok, detail] of results) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
  if (!ok) pass = false;
}
console.log(pass ? "ALL_PASS" : "HAS_FAILURES");
process.exit(pass ? 0 : 1);
