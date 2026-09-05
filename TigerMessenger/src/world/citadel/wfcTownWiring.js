// =====================================================================
//  WFC 选型接线层 —— C6 最后一项，Claude 2026-09-04
//
//  ---------------------------------------------------------------
//  先纠正一件事：TODO 那行写的接线方式行不通
//  ---------------------------------------------------------------
//  TODOS C6 写的是「`citadelTown.js` 里 `townscaperModuleSelection` 调用点改走
//  `wfcTownSelection`」。这两个函数**不是同一个域**：
//    · `townscaperModuleSelection(ix,iy,iz,char,salt,openMask)` → 8 个**装饰家族**
//      下标（foundation/floor/fence/balcony/stairs/support/hole/decor）
//    · `solveTownSelection({grid,seed})` → 每格的**体块角色**
//      （body / tower / passage / gable / hip / cone / terrace / flat / garden）
//  而城堡现在的体块角色是 `citadelTown.js` 里的手写规则定的
//  （`classifyRoofComponent`、花园围合判定、平顶分量），压根不经过
//  `townscaperModuleSelection`。把那三个调用点换掉，换的是装饰不是天际线。
//
//  真正的接线是**让 WFC 的角色去接管那些手写规则**。本模块负责两件事：
//    ① 把求解结果算好并缓存（按布局签名，避免每次编辑重解 17ms）
//    ② 提供一个 `roleAt(ix,iy,iz)`，让 `citadelTown.js` 的两处判定改用它
//
//  ---------------------------------------------------------------
//  这一刀接管了哪两处（其余保持原样）
//  ---------------------------------------------------------------
//  1. **顶格是坡顶还是平顶**：原来由 `classifyRoofComponent(comp.cells)` 的形状决定
//     （strip → 坡顶，plaza → 平顶）。接线后由 WFC 的角色决定：
//     `gable / hip / cone` → 坡顶分支；`terrace / flat / garden` → 平顶分支。
//     这正是门 I 五个画面事实所在，也是天际线变化最大的地方。
//  2. **花园**：原来由 `hugsWall`（贴更高的墙）决定。接线后 = WFC 判 `garden`
//     （S20⑥ 的「只在被墙围起来时成立」已经写进 `townBanPolicy`，不用再判一次）。
//
//  屋顶分量内部的形状分类（脊向、L/十字臂、山墙端）**暂不接管**——那部分是几何
//  装配不是选型，换掉它是另一刀。
//
//  ---------------------------------------------------------------
//  ⚠️ 默认关（`P.wfcTownV1 = false`），与 TODOS 写的「默认开」不同
//  ---------------------------------------------------------------
//  因为 100 seed 体检留了一条**脚本判不了**的问题：顶格里只有 ~35% 长成屋顶
//  （gable 6.9% + cone 3.0% + hip 0.8%），其余是晒台 12.7% + 平顶 6.7%。
//  Townscaper 的天际线是屋顶为主还是晒台为主，只能对着 S23 录像看。
//  默认开 = 天际线当场变，而没人看过。**看过截图再翻默认值。**
//
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

import { solveTownSelection } from "./wfcTownSelection.js";

/** 布局签名：只要它不变，解就不用重算 */
export function townGridSignature(grid) {
  // grid 是 Map "ix,iy,iz" -> char；排序后拼接。978 格 ≈ 12KB 字符串，
  // 比重解 17ms 便宜两个数量级。
  const parts = [...grid.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  let h = 2166136261 >>> 0;
  for (const [k, v] of parts) {
    const s = `${k}:${v};`;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
  }
  return `${parts.length}:${h.toString(16)}`;
}

/**
 * 取（或复用缓存的）WFC 选型。
 *
 * @param {Map<string,string>} grid `levelsToGrid` 的结果
 * @param {object} [cache] 任意可写对象（生产里用 `castleContainer.userData.townCtxCache`）
 * @param {number} [seed]
 * @returns {{ ok:boolean, byCell:object, roleAt:(ix:number,iy:number,iz:number)=>string|null,
 *             hash:string|null, unresolved:string[], fromCache:boolean, ms:number }}
 */
export function resolveTownSelection(grid, { cache = null, seed = 1 } = {}) {
  const sig = `${townGridSignature(grid)}|${seed}`;
  if (cache && cache.wfcTownSelection?.sig === sig) {
    return { ...cache.wfcTownSelection.value, fromCache: true };
  }
  const t0 = Date.now();
  const r = solveTownSelection({ grid, seed });
  const byCell = r.byCell ?? {};
  // 求解失败**不回退哈希路径**（S20④ 静默失败：只标格，不假装成功）。
  // roleAt 全部返回 null，调用方于是原样走手写规则。
  const value = {
    ok: r.ok === true,
    byCell,
    hash: r.hash ?? null,
    unresolved: r.unresolved ?? [],
    ms: Date.now() - t0,
  };
  const roleAt = (ix, iy, iz) => byCell[`${ix},${iy},${iz}`]?.variant ?? null;
  const out = { ...value, roleAt };
  if (cache) cache.wfcTownSelection = { sig, value: { ...value, roleAt } };
  return { ...out, fromCache: false };
}

/** 坡屋顶角色（这些格走屋顶分支） */
export const WFC_SLOPED_ROOF_ROLES = Object.freeze(new Set(["gable", "hip", "cone"]));
/** 平顶角色（这些格走晒台/平顶/花园分支） */
export const WFC_FLAT_TOP_ROLES = Object.freeze(new Set(["terrace", "flat", "garden"]));

/**
 * `citadelTown.js` 消费的薄接口。`selection` 为 null（开关关闭 / 求解失败）时
 * 每个问题都回答 `null`，调用方照旧走手写规则——**这就是回退路径，没有第二套代码。**
 */
export function makeTownRoleOracle(selection) {
  if (!selection || !selection.ok) {
    return {
      enabled: false,
      roleAt: () => null,
      isSlopedRoof: () => null,
      isFlatTop: () => null,
      isGarden: () => null,
    };
  }
  const roleAt = selection.roleAt;
  return {
    enabled: true,
    roleAt,
    isSlopedRoof: (ix, iy, iz) => {
      const r = roleAt(ix, iy, iz);
      return r === null ? null : WFC_SLOPED_ROOF_ROLES.has(r);
    },
    isFlatTop: (ix, iy, iz) => {
      const r = roleAt(ix, iy, iz);
      return r === null ? null : WFC_FLAT_TOP_ROLES.has(r);
    },
    isGarden: (ix, iy, iz) => {
      const r = roleAt(ix, iy, iz);
      return r === null ? null : r === "garden";
    },
  };
}

const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function connectedGroups(cells) {
  const set = new Set(cells.map(([x, z]) => `${x},${z}`));
  const seen = new Set();
  const groups = [];
  for (const [x0, z0] of cells) {
    const k0 = `${x0},${z0}`;
    if (seen.has(k0)) continue;
    const acc = [];
    const q = [[x0, z0]];
    seen.add(k0);
    while (q.length) {
      const [x, z] = q.pop();
      acc.push([x, z]);
      for (const [dx, dz] of DIRS4) {
        const nk = `${x + dx},${z + dz}`;
        if (!set.has(nk) || seen.has(nk)) continue;
        seen.add(nk);
        q.push([x + dx, z + dz]);
      }
    }
    groups.push(acc);
  }
  return groups;
}

/**
 * 把一个 isRoof 连通分量按 WFC 角色拆成坡顶组 / 平顶组。
 * oracle 关闭时整组走手写 classifyRoofComponent（slopedGroups 里原样返回）。
 */
export function partitionRoofComponent(cells, iy, oracle) {
  if (!oracle?.enabled || !cells?.length) {
    return { slopedGroups: cells?.length ? [cells] : [], flatGroups: [] };
  }
  const sloped = [];
  const flat = [];
  const rest = [];
  for (const cell of cells) {
    const [x, z] = cell;
    if (oracle.isSlopedRoof(x, iy, z) === true) sloped.push(cell);
    else if (oracle.isFlatTop(x, iy, z) === true) flat.push(cell);
    else rest.push(cell);
  }
  return {
    slopedGroups: [...connectedGroups(sloped), ...connectedGroups(rest)],
    flatGroups: connectedGroups(flat),
  };
}
