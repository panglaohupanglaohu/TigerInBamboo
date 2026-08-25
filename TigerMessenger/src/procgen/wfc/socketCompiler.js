// =====================================================================
//  Socket Compiler — prototype → variant 展开（V7-G2）
//  · 旋转不变 parity；镜像翻转 normal↔flipped（symmetric 不变）。
//  · 展开后按稳定 key 排序冻结 index：同 seed / 模块加载顺序变化
//    不改变 index 与 hash。
//  · 旋转等价 variant 去重（faces 签名相同），导出 equivalence report。
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

import { orientationTransforms, applyTransformToFaces } from "./orientationGroup.js";
import { validateModulePrototype, faceSignature } from "./moduleSchema.js";

/**
 * 展开一个 prototype 的全部 variant。
 * @param {object} proto ModulePrototype
 * @returns {{variants: object[], equivalence: object[]}}
 *   variant = { key, protoId, transformName, mirror, faces, weight, builderKey, boundaryFaces }
 */
export function expandPrototype(proto) {
  const check = validateModulePrototype(proto);
  if (!check.ok) {
    throw new Error(`expandPrototype: invalid prototype ${proto?.id} [${check.errors.join(",")}]`);
  }
  const group = proto.orientationGroup || "Y4";
  const transforms = orientationTransforms(group);
  const variants = [];
  const equivalence = [];
  const seen = new Map(); // faces 签名 → 代表 variant key

  for (const t of transforms) {
    const rotated = applyTransformToFaces(proto.faces, t);
    // 镜像翻转 parity：normal↔flipped；symmetric 不变
    const faces = {};
    for (const [face, desc] of Object.entries(rotated)) {
      faces[face] = {
        ...desc,
        parity: t.mirror
          ? desc.parity === "flipped"
            ? "normal"
            : desc.parity === "normal"
              ? "flipped"
              : "symmetric"
          : desc.parity,
      };
    }
    const sig = facesSignature(faces);
    if (seen.has(sig)) {
      equivalence.push({ key: `${proto.id}@${t.name}`, equivalentTo: seen.get(sig), signature: sig });
      continue;
    }
    seen.set(sig, `${proto.id}@${t.name}`);
    variants.push({
      key: `${proto.id}@${t.name}`,
      protoId: proto.id,
      transformName: t.name,
      mirror: t.mirror,
      faces,
      weight: proto.weight ?? 1,
      builderKey: proto.builderKey ?? proto.family,
      tags: proto.tags ?? [],
      rules: proto.rules ?? {},
      signature: sig,
    });
  }
  return { variants, equivalence };
}

/** faces 的规范签名（面序 + connector + parity；不含权重等元数据） */
function facesSignature(faces) {
  const keys = Object.keys(faces).sort();
  return keys.map((k) => `${k}=${faces[k].connector}/${faces[k].parity || "normal"}`).join("|");
}

/**
 * 编译 module set → 冻结 variant 表。
 * @param {object[]} prototypes
 * @param {object} [opts]
 * @param {(a: object, b: object) => number} [opts.sortKey] 稳定排序键（缺省按 variant key 字典序）
 */
export function compileVariants(prototypes, opts = {}) {
  const allVariants = [];
  const equivalence = [];
  for (const proto of prototypes) {
    const { variants, equivalence: eq } = expandPrototype(proto);
    allVariants.push(...variants);
    equivalence.push(...eq);
  }
  // 稳定排序冻结 index：加载顺序无关
  const sorted = allVariants.slice().sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const variantIndex = new Map(sorted.map((v, i) => [v.key, i]));
  return {
    variants: sorted.map((v, i) => Object.freeze({ ...v, index: i })), // 冻结 index
    variantIndex,
    equivalence,
    stats: {
      prototypes: prototypes.length,
      variants: sorted.length,
      deduped: equivalence.length,
    },
  };
}
