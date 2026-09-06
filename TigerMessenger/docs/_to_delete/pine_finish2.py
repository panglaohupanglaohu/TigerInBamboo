# -*- coding: utf-8 -*-
"""松树 ×6 + 株距 ×2 只做了一半：测试还锁着旧值，苔庭也撑出了地壳板。"""
import io, os
R = os.path.expanduser("~/mnt/TigerInBamboo/")

def edit(rel, pairs):
    p = R + rel
    s = io.open(p, encoding="utf-8").read()
    for old, new, why in pairs:
        assert old in s, f"{rel} 未匹配：{why}"
        s = s.replace(old, new, 1)
    io.open(p, "w", encoding="utf-8").write(s)
    print("patched", rel)

# ---------------------------------------------------------------- ① 测试跟进
edit("tools/test_saihoji_pine.mjs", [
('const { buildSaihojiPlanet, SAIHOJI_PINE_SIZE } = await import(',
 'const { buildSaihojiPlanet, SAIHOJI_PINE_SIZE, SAIHOJI_PINE_SPREAD } = await import(',
 "import"),
('assert.equal(SAIHOJI_PINE_SIZE, 3, "苔庭松树体积应为三倍");',
 '''// 2026-09-05：体积从 ×3 再放大到 ×6，株距同步 ×2（SAIHOJI_PINE_SPREAD）。
// 两个数必须成对改：只放大体积不放大间距，树冠互相穿插挤成一坨；
// 只放大间距不放大体积，六景之间又会空得发慌。
// 谁再动这两个数，必须同时交代苔庭在鲸背地壳板上的投影怎么办
// ——见 test_leviathan [2] 的「六景落入地壳板投影」，那条门是硬的。
assert.equal(SAIHOJI_PINE_SIZE, 6, "苔庭松树体积应为六倍");
assert.equal(SAIHOJI_PINE_SPREAD, 2, "体积放大后株距必须同步 ×2，否则挤成一坨");''',
 "体积断言"),
('assert(vMin >= 1.02 * sMin * SAIHOJI_PINE_SIZE * 0.98, `幼松可见尺度应约 3×（min=${vMin.toFixed(2)}）`);',
 'assert(vMin >= 1.02 * sMin * SAIHOJI_PINE_SIZE * 0.98, `幼松可见尺度应约 ${SAIHOJI_PINE_SIZE}×（min=${vMin.toFixed(2)}）`);',
 "vMin 文案"),
('assert(vMax >= 1.02 * 1.2 * SAIHOJI_PINE_SIZE * 0.98, `主木可见尺度应约 3×（max=${vMax.toFixed(2)}）`);',
 'assert(vMax >= 1.02 * 1.2 * SAIHOJI_PINE_SIZE * 0.98, `主木可见尺度应约 ${SAIHOJI_PINE_SIZE}×（max=${vMax.toFixed(2)}）`);',
 "vMax 文案"),
])

# ---------------------------------------------------------------- ② 苔庭收回地壳板
edit("TigerMessenger/src/assets/leviathanIsland.js", [
('''/** 苔庭压缩比：六景跨度 ~40×23 → ~22×12.6，收进 25×14 地壳板 */
export const LEVIATHAN_GARDEN_SCALE = 0.55;''',
 '''/**
 * 苔庭压缩比：把六景整体压到鲸背那块 25×14 的地壳板上。
 *
 * 2026-09-05 从 0.55 调到 0.43：苔庭古松体积放大到 ×6、株距同步 ×2 之后，
 * 六景本身的跨度变大了，按旧比例压下来投影是 15.1×10.1，撑出板外
 * （`test_leviathan` [2] 的门是 13.2×8.0）——树会长到板沿外面悬空。
 *
 * 这里**不动松树、只动压缩比**：主人要的是苔庭内部「树大、树距也大」的
 * 疏朗关系，那是六景自己的事；板子多大是鲸的事。压缩比是这两件事之间
 * 唯一该动的那颗螺丝。净效果：松树落到鲸背上仍比改之前大 ~1.6 倍，
 * 株距也宽 ~1.6 倍，只是整体收进了板内。
 */
export const LEVIATHAN_GARDEN_SCALE = 0.43;'''
 , "苔庭压缩比"),
])
