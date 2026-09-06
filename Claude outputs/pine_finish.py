# -*- coding: utf-8 -*-
"""松树放大到 6 倍 + 间距 ×2 这件事只做了一半：测试还锁着旧值，苔庭也撑出了地壳板。"""
import io, os
R = os.path.expanduser("~/mnt/TigerInBamboo/")

# ---------------------------------------------------------------- ① 测试跟进
P = R + "tools/test_saihoji_pine.mjs"
s = io.open(P, encoding="utf-8").read()

def rep(p, old, new, why):
    assert old in p, "未匹配：" + why
    return p.replace(old, new, 1)

s = rep(s,
'assert.equal(SAIHOJI_PINE_SIZE, 3, "苔庭松树体积应为三倍");',
'''// 2026-09-05：松树体积从 ×3 再放大到 ×6，同时株距 ×2（SAIHOJI_PINE_SPREAD）——
// 只放大体积不放大间距，树冠会互相穿插挤成一坨。这条断言跟着改，
// 是因为「几倍」是主人定的美术口径，不是可以随手漂的实现细节：
// 谁再改它，必须同时交代间距与苔庭在地壳板上的投影怎么办（见 test_leviathan [2]）。
assert.equal(SAIHOJI_PINE_SIZE, 6, "苔庭松树体积应为六倍");
assert.equal(SAIHOJI_PINE_SPREAD, 2, "松树体积放大后株距必须同步 ×2，否则挤成一坨");''',
"体积断言")

s = rep(s,
'import { SAIHOJI_PINE_SIZE',
'import { SAIHOJI_PINE_SPREAD, SAIHOJI_PINE_SIZE' if 'SAIHOJI_PINE_SPREAD' not in s.split("\n")[0:40].__str__() else 'import { SAIHOJI_PINE_SIZE',
"import 占位")
io.open(P, "w", encoding="utf-8").write(s)
print("test_saihoji_pine 已跟进")
