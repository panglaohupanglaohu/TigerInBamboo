// 骨骼解剖学装配器：根据物种数据构建通用骨骼层级
// 输入：物种节点（dimensions / anatomicalRef）+ 解剖学类型
// 输出：{ root, skeleton, boneMap } —— 骨骼局部坐标 = 实体局部坐标（原点在地，+Z 朝前）
import * as THREE from "three";

// 骨骼名常量（权重写入与动画驱动共用）
export const BONE = {
  Root: "Root", Pelvis: "Pelvis", Mid: "Mid", Chest: "Chest",
  Neck: "Neck", Head: "Head", Jaw: "Jaw",
  EarL: "Ear_L", EarR: "Ear_R", // 跳跃行（兔科）长耳
  FL1: "FL1", FL2: "FL2", FLFoot: "FLFoot",
  FR1: "FR1", FR2: "FR2", FRFoot: "FRFoot",
  BL1: "BL1", BL2: "BL2", BLFoot: "BLFoot",
  BR1: "BR1", BR2: "BR2", BRFoot: "BRFoot",
  Tail1: "Tail1", Tail2: "Tail2", Tail3: "Tail3", Tail4: "Tail4", Tail5: "Tail5",
};

export class AnatomyRiggingEngine {
  /**
   * @param {Object} speciesNode - 数据仓库叶子节点（dimensions + anatomicalRef）
   * @param {string} anatomyType - "DIGITIGRADE" | "UNGULIGRADE" | "SALTATORIAL"
   */
  static createSkeleton(speciesNode, anatomyType = "DIGITIGRADE") {
    const { width, length } = speciesNode.dimensions;
    const { withersHeight: H, tailLength } = speciesNode.anatomicalRef;
    // 装配旋钮：颈长倍率、关节折叠倍率（lab 页实时预览用）
    const { neckLen = 1, legFold = 1 } = speciesNode.rigTuning ?? {};
    const boneMap = new Map();
    const bones = [];
    const mk = (name, parent, x, y, z) => {
      const b = new THREE.Bone();
      b.name = name;
      b.position.set(x, y, z);
      if (parent) parent.add(b);
      bones.push(b);
      boneMap.set(name, b);
      return b;
    };

    // —— 脊椎链：根骨在肩高（重心），骨盆/腹/胸沿 Z 展开 ——
    const root = mk(BONE.Root, null, 0, H, 0);
    const pelvis = mk(BONE.Pelvis, root, 0, 0, -length * 0.177);
    const mid = mk(BONE.Mid, pelvis, 0, 0, length * 0.177);
    const chest = mk(BONE.Chest, mid, 0, 0, length * 0.177);

    // —— 颈/头/下颌（头颈前伸，虎头探出肩线） ——
    const neck = mk(BONE.Neck, chest, 0, H * 0.067, length * 0.11 * neckLen);
    const head = mk(BONE.Head, neck, 0, H * 0.029, length * 0.1 * neckLen);
    mk(BONE.Jaw, head, 0, -H * 0.095, length * 0.032 * neckLen);

    // —— 兔科长耳：自颅顶向后上舒展（动画驱动器做惯性滞后摆动） ——
    if (anatomyType === "SALTATORIAL") {
      mk(BONE.EarL, head, -width * 0.18, H * 0.18, -length * 0.015);
      mk(BONE.EarR, head, width * 0.18, H * 0.18, -length * 0.015);
    }

    // —— 四肢：趾行为弹性 Z 形（膝/踝预弯），蹄行为直立柱，跳跃行后肢深折 ——
    const buildLeg = (parent, prefix, side, isFront) => {
      // 腿根外偏/前后距按体宽体长比例（与 ProceduralSkinGenerator._legDefs 一致）
      // 猫科走一字步：脚掌落点贴近体轴，腿根收紧（前 0.30 / 后 0.28 体宽）
      const ux = width * (isFront ? 0.3 : 0.28);
      const uz = length * (isFront ? 0.0323 : -0.0323);
      const hip = mk(`${prefix}1`, parent, side * ux, isFront ? -H * 0.14 : -H * 0.11, uz);
      if (anatomyType === "SALTATORIAL") {
        if (isFront) {
          // 前肢短小，落地支撑用，肘微后折
          const knee = mk(`${prefix}2`, hip, 0, -H * 0.34, -H * 0.06 * legFold);
          mk(`${prefix}Foot`, knee, 0, -H * 0.33, H * 0.05 * legFold);
        } else {
          // 后肢极长且深度折叠：膝前顶、飞节后折，呈压缩"弹簧"
          const knee = mk(`${prefix}2`, hip, 0, -H * 0.42, H * 0.3 * legFold);
          mk(`${prefix}Foot`, knee, 0, -H * 0.38, -H * 0.24 * legFold);
        }
        return;
      }
      const seg1 = isFront ? H * 0.36 : H * 0.38;    // 大腿长（腿不收长）
      const seg2 = isFront ? H * 0.31 : H * 0.32;    // 小腿长
      if (anatomyType === "DIGITIGRADE") {
        // 趾行：关节预弯 —— 前肢肘后凸、后肢膝前凸
        const knee = mk(`${prefix}2`, hip, 0, -seg1, isFront ? -0.03 * legFold : 0.04 * legFold);
        mk(`${prefix}Foot`, knee, 0, -seg2, isFront ? 0.04 * legFold : -0.02 * legFold);
      } else {
        const knee = mk(`${prefix}2`, hip, 0, -seg1, 0);
        mk(`${prefix}Foot`, knee, 0, -seg2, 0.01 * legFold);
      }
    };
    buildLeg(chest, "FL", -1, true);
    buildLeg(chest, "FR", 1, true);
    buildLeg(pelvis, "BL", -1, false);
    buildLeg(pelvis, "BR", 1, false);

    // —— 尾：五节链，自胯后尾管接口至尾尖均布（与独立尾管几何逐段对位） ——
    // 尾根接口与 ProceduralSkinGenerator 一致：猫科/蹄行 -0.94·kz（臀段已压缩），兔科 -0.165·kz
    const tail1Z = anatomyType === "SALTATORIAL" ? -length * 0.153 : -length * 0.1262;
    const t1 = mk(BONE.Tail1, pelvis, 0, H * 0.06, tail1Z);
    const t2 = mk(BONE.Tail2, t1, 0, 0, -tailLength * 0.25);
    const t3 = mk(BONE.Tail3, t2, 0, -H * 0.01, -tailLength * 0.25);
    const t4 = mk(BONE.Tail4, t3, 0, -H * 0.01, -tailLength * 0.25);
    mk(BONE.Tail5, t4, 0, -H * 0.02, -tailLength * 0.25);

    return { root, skeleton: new THREE.Skeleton(bones), bones, boneMap };
  }
}
