# -*- coding: utf-8 -*-
"""重做鲸嘴（第二段）：把 createWhaleMaw 里用旧三件套的地方换成铰链。"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/whaleMaw.js")
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    assert s.count(old) == 1, "多处匹配：" + why
    s = s.replace(old, new, 1)

# ---- attach ----
rep("""    if (whale === w && net?.parent) return true;
    whale = w;
    if (!net) net = buildNet();
    if (!maw) maw = buildMaw();""",
"""    if (whale === w && net?.parent) return true;
    whale = w;
    if (!net) net = buildNet();
    // 切嘴是**一次性**的：把鲸自己的模型切开、零件重挂。
    // 只在第一次遇到这条鲸时做；重复切会把已经挂进铰链的东西再切一遍。
    if (!maw || maw.hinge.parent !== whale) maw = buildJawSplit(whale);""",
    "attach 造嘴")

rep("""    if (net.parent !== whale) whale.add(net);
    if (maw.mawRoot.parent !== whale) whale.add(maw.mawRoot);
    if (bulge.parent !== whale) whale.add(bulge);""",
"""    if (net.parent !== whale) whale.add(net);
    if (bulge.parent !== whale) whale.add(bulge);""",
    "attach 挂件")

# ---- 嘴心 ----
rep("    return out.set(36.0, -8.0, 0).applyMatrix4(whale.matrixWorld);",
"""    // 喉口：切面往前一点。张开时前段绕眼睛抬起来，这个点正好在张开的口中央
    return out
      .set((maw?.eyeX ?? WHALE_MAW.eyeX) + 5, (maw?.eyeY ?? WHALE_MAW.eyeY) - 1.2, 0)
      .applyMatrix4(whale.matrixWorld);""",
    "嘴心")

# ---- openTo ----
rep("""    const openTo = (k) => {
      if (!maw) return;
      maw.jawLower.rotation.z = -WHALE_MAW.gapeLower * k;
      maw.jawUpper.rotation.z = WHALE_MAW.gapeUpper * k;
      maw.cavity.visible = k > 0.06;
    };""",
"""    /**
     * 张嘴 = **眼前那一整段绕眼睛（+Z 轴）抬起来**。
     * +Z 是右舷，绕它转正角把 +X（鲸头）抬向 +Y（背上）——吻端往上掀。
     * k=0 时铰链归零，两半严丝合缝拼回原样，鲸和没被切过一模一样。
     */
    const openTo = (k) => {
      if (!maw) return;
      maw.hinge.rotation.z = WHALE_MAW.gape * k;
      maw.throat.visible = k > 0.04; // 切面（口腔）只在张开时露出来
    };""",
    "openTo")

# ---- parts ----
rep("    parts: () => { attach(); return { net, maw, bulge }; },",
    "    parts: () => { attach(); return { net, maw, bulge, hinge: maw?.hinge || null }; },",
    "parts")

io.open(P, "w", encoding="utf-8").write(s)
print("patched whaleMaw.js（铰链接线）")
