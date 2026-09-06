# -*- coding: utf-8 -*-
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/tools/test_fleet_cohesion.mjs")
s = io.open(P, encoding="utf-8").read()

old = """  const victim = w.defendersLive[0];
  const craft = w.haulers.find((c) => c.parent && c.visible) || w.haulers[0];"""
new = """  const victim = w.defendersLive[0];
  const craft = w.haulers.find((c) => c.parent && c.visible) || w.haulers[0];
  /** 战场上补一个活着的挡道者（前面那个多半已经被重甲兵解决了） */
  const freshFoe = () => {
    const d = new THREE.Group();
    d.userData = { uid: 700 + w.defendersLive.length };
    d.position.copy(w.hub).multiplyScalar(GROUND);
    w.scene.add(d);
    w.defendersLive.push(d);
    return d;
  };"""
assert s.count(old) == 1
s = s.replace(old, new, 1)

old2 = """  const cp = stick();
  const d0 = victim.position.distanceTo(cp);
  const r0 = victim.position.length();"""
new2 = """  // 作战打完之后原来那个多半已经躺下了：补一个活的挡在离场航路上
  const foe = victim.userData.dead || victim.userData.downed ? freshFoe() : victim;
  const stickFoe = () => {
    craft.updateWorldMatrix(true, false);
    const p = craft.getWorldPosition(new THREE.Vector3());
    foe.position.copy(p).add(new THREE.Vector3(1.2, 0, 0));
    return p;
  };
  const cp = stickFoe();
  const d0 = foe.position.distanceTo(cp);
  const r0 = foe.position.length();"""
assert s.count(old2) == 1
s = s.replace(old2, new2, 1)

# 后续断言里的 victim → foe（只在 ⑭ 这一块的第二段）
i = s.index("  const cp = stickFoe();")
j = s.index("// ---------------------------------------------------------------- ", i)
seg = s[i:j]
seg = seg.replace("victim.userData", "foe.userData").replace("victim.position", "foe.position")
seg = seg.replace("else stick();", "else stickFoe();")
s = s[:i] + seg + s[j:]
io.open(P, "w", encoding="utf-8").write(s)
print("patched ⑭（补一个活的挡道者）")
