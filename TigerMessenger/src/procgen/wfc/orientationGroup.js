// =====================================================================
//  Orientation Group — NONE / Y4 / D4 / CUBE24（V7-G2）
//  每个变换是 6 面（N/E/S/W/U/D）的一个置换 + 可选镜像标志。
//  提供 closure、inverse、opposite face 验证；CUBE24 由两个基旋转
//  （rY、rX）BFS 生成，群阶恰为 24。
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

const FACES = ["N", "E", "S", "W", "U", "D"];

/** 置换表示：perm[from] = to（from 面的内容旋转后到 to 面） */
function compose(a, b) {
  // (a∘b)：先 b 后 a
  const out = {};
  for (const f of FACES) out[f] = a[b[f]];
  return out;
}

function invert(perm) {
  const out = {};
  for (const f of FACES) out[perm[f]] = f;
  return out;
}

// —— 基变换 ——
const IDENTITY = { N: "N", E: "E", S: "S", W: "W", U: "U", D: "D" };
/** 绕 Y 轴 90°（俯视逆时针）：N→E→S→W */
const RY = { N: "E", E: "S", S: "W", W: "N", U: "U", D: "D" };
/** 绕 X 轴 90°：N→U→S→D */
const RX = { N: "U", U: "S", S: "D", D: "N", E: "E", W: "W" };
/** 镜像 X：E↔W */
const MX = { N: "N", E: "W", W: "E", S: "S", U: "U", D: "D" };

function permKey(perm, mirror) {
  return FACES.map((f) => perm[f]).join("") + (mirror ? "m" : "");
}

/** BFS 生成群闭包 */
function generateGroup(generators) {
  const seen = new Map();
  const queue = [{ perm: IDENTITY, mirror: false, path: [] }];
  seen.set(permKey(IDENTITY, false), queue[0]);
  while (queue.length) {
    const cur = queue.shift();
    for (const g of generators) {
      const next = {
        perm: compose(g.perm, cur.perm),
        mirror: cur.mirror !== g.mirror,
        path: [...cur.path, g.name],
      };
      const key = permKey(next.perm, next.mirror);
      if (!seen.has(key)) {
        seen.set(key, next);
        queue.push(next);
      }
    }
  }
  return [...seen.values()];
}

const CUBE24_ROTATIONS = generateGroup([
  { name: "rY", perm: RY, mirror: false },
  { name: "rX", perm: RX, mirror: false },
]);

/** opposite face（共享边连接时方向互补） */
export const OPPOSITE_FACE = Object.freeze({ N: "S", S: "N", E: "W", W: "E", U: "D", D: "U" });
/** 镜像轴面映射（E↔W） */
export const MIRROR_FACE = Object.freeze({ N: "N", E: "W", W: "E", S: "S", U: "U", D: "D" });

/**
 * 列出 orientation group 的全部唯一变换。
 * @param {"NONE"|"Y4"|"D4"|"CUBE24"} group
 * @returns {{name:string, perm:object, mirror:boolean}[]} 稳定序
 */
export function orientationTransforms(group) {
  switch (group) {
    case "NONE":
      return [{ name: "r0", perm: IDENTITY, mirror: false }];
    case "Y4": {
      const out = [];
      let p = IDENTITY;
      for (let i = 0; i < 4; i++) {
        out.push({ name: `r${i * 90}`, perm: p, mirror: false });
        p = compose(RY, p);
      }
      return out;
    }
    case "D4": {
      const rots = orientationTransforms("Y4");
      return [...rots, ...rots.map((t) => ({ name: t.name + "m", perm: compose(MX, t.perm), mirror: true }))];
    }
    case "CUBE24": {
      if (CUBE24_ROTATIONS.length !== 24) {
        throw new Error(`CUBE24 closure broken: ${CUBE24_ROTATIONS.length}`);
      }
      // 稳定名：按置换键排序
      return CUBE24_ROTATIONS.slice().sort((a, b) => (a.path.join(",") < b.path.join(",") ? -1 : 1)).map((t) => ({
        name: t.path.length ? t.path.join(".") : "r0",
        perm: t.perm,
        mirror: false,
      }));
    }
    default:
      throw new Error(`unknown orientation group: ${group}`);
  }
}

/** 变换的逆（用于闭包/还原验证） */
export function invertTransform(transform) {
  return { name: `inv(${transform.name})`, perm: invert(transform.perm), mirror: transform.mirror };
}

/**
 * 把 prototype 的 faces 按变换旋转。
 * 语义：transform.perm 已烘焙全部几何变换（含 D4 镜像），
 * 即 newFaces[perm(from)] = oldFaces[from]。
 * mirror 标志只用于 parity 翻转（socketCompiler）与报告，不在此二次应用。
 * CUBE24 变换可能把 U/D 转到水平面：faces 必须已声明全部 6 面。
 */
export function applyTransformToFaces(faces, transform) {
  const out = {};
  for (const from of Object.keys(faces)) {
    out[transform.perm[from]] = faces[from];
  }
  return out;
}

/** 方向群完整性自检（单测消费） */
export function validateOrientationGroup(group) {
  const transforms = orientationTransforms(group);
  const expected = { NONE: 1, Y4: 4, D4: 8, CUBE24: 24 }[group];
  const errors = [];
  if (transforms.length !== expected) errors.push(`order:${transforms.length}!=${expected}`);
  const seen = new Set();
  for (const t of transforms) {
    const key = permKey(t.perm, t.mirror);
    if (seen.has(key)) errors.push(`duplicate:${key}`);
    seen.add(key);
  }
  // 逆元存在性：每个变换的逆也在群内
  for (const t of transforms) {
    const inv = invertTransform(t);
    const hasInv = transforms.some(
      (u) => permKey(u.perm, u.mirror) === permKey(inv.perm, inv.mirror)
    );
    if (!hasInv) errors.push(`no-inverse:${t.name}`);
  }
  // 闭包：任意两个变换的复合仍在群内
  for (const a of transforms) {
    for (const b of transforms) {
      const ab = compose(a.perm, b.perm);
      const mirror = a.mirror !== b.mirror;
      if (!transforms.some((u) => permKey(u.perm, u.mirror) === permKey(ab, mirror))) {
        errors.push(`not-closed:${a.name}*${b.name}`);
      }
    }
  }
  // opposite face 不变量：perm[OPPOSITE[f]] === OPPOSITE[perm[f]]（纯旋转）
  if (group !== "D4") {
    for (const t of transforms) {
      for (const f of FACES) {
        if (t.perm[OPPOSITE_FACE[f]] !== OPPOSITE_FACE[t.perm[f]]) {
          errors.push(`opposite-broken:${t.name}:${f}`);
        }
      }
    }
  }
  return { ok: errors.length === 0, errors, order: transforms.length };
}
