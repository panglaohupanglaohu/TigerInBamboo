// 骨骼解剖学装配器：根据物种数据构建通用骨骼层级
// 输入：物种节点（dimensions / anatomicalRef）+ 解剖学类型
// 输出：{ root, skeleton, boneMap } —— 骨骼局部坐标 = 实体局部坐标（原点在地，+Z 朝前）
import * as THREE from "three";

// 骨骼名常量（权重写入与动画驱动共用）
export const BONE = {
  Root: "Root", Pelvis: "Pelvis", Mid: "Mid", Chest: "Chest",
  Neck: "Neck", Head: "Head", Jaw: "Jaw",
  FL1: "FL1", FL2: "FL2", FLFoot: "FLFoot",
  FR1: "FR1", FR2: "FR2", FRFoot: "FRFoot",
  BL1: "BL1", BL2: "BL2", BLFoot: "BLFoot",
  BR1: "BR1", BR2: "BR2", BRFoot: "BRFoot",
  Tail1: "Tail1", Tail2: "Tail2", Tail3: "Tail3", Tail4: "Tail4", Tail5: "Tail5",
};

export class AnatomyRiggingEngine {
  /**
   * @param {Object} speciesNode - 数据仓库叶子节点（dimensions + anatomicalRef）
   * @param {string} anatomyType - "DIGITIGRADE" | "UNGULIGRADE"
   */
  static createSkeleton(speciesNode, anatomyType = "DIGITIGRADE") {
    const { length } = speciesNode.dimensions;
    const { withersHeight: H, tailLength } = speciesNode.anatomicalRef;
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
    const neck = mk(BONE.Neck, chest, 0, H * 0.067, length * 0.11);
    const head = mk(BONE.Head, neck, 0, H * 0.029, length * 0.1);
    mk(BONE.Jaw, head, 0, -H * 0.095, length * 0.032);

    // —— 四肢：趾行为弹性 Z 形（膝/踝预弯），蹄行为直立柱 ——
    const buildLeg = (parent, prefix, side, isFront) => {
      const ux = isFront ? 0.26 : 0.27;              // 腿根外偏（体宽一半内收）
      const uz = isFront ? 0.1 : -0.1;               // 前后腿距拉开
      const seg1 = isFront ? H * 0.36 : H * 0.38;    // 大腿长（腿不收长）
      const seg2 = isFront ? H * 0.31 : H * 0.32;    // 小腿长
      const hip = mk(`${prefix}1`, parent, side * ux, isFront ? -H * 0.14 : -H * 0.11, uz);
      if (anatomyType === "DIGITIGRADE") {
        // 趾行：关节预弯 —— 前肢肘后凸、后肢膝前凸
        const knee = mk(`${prefix}2`, hip, 0, -seg1, isFront ? -0.03 : 0.04);
        mk(`${prefix}Foot`, knee, 0, -seg2, isFront ? 0.04 : -0.02);
      } else {
        const knee = mk(`${prefix}2`, hip, 0, -seg1, 0);
        mk(`${prefix}Foot`, knee, 0, -seg2, 0.01);
      }
    };
    buildLeg(chest, "FL", -1, true);
    buildLeg(chest, "FR", 1, true);
    buildLeg(pelvis, "BL", -1, false);
    buildLeg(pelvis, "BR", 1, false);

    // —— 尾：自骨盆向后下，五节（摆动起来更柔） ——
    const t1 = mk(BONE.Tail1, pelvis, 0, H * 0.06, -0.2);
    const t2 = mk(BONE.Tail2, t1, 0, 0, -tailLength * 0.22);
    const t3 = mk(BONE.Tail3, t2, 0, -H * 0.01, -tailLength * 0.22);
    const t4 = mk(BONE.Tail4, t3, 0, -H * 0.01, -tailLength * 0.22);
    mk(BONE.Tail5, t4, 0, -H * 0.02, -tailLength * 0.22);

    return { root, skeleton: new THREE.Skeleton(bones), bones, boneMap };
  }
}
