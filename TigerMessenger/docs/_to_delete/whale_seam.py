# -*- coding: utf-8 -*-
"""鲸尾接口有一道断裂口：两段壳在枢纽处对接，尾巴一抬就把接缝掰开。"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/assets/leviathanIsland.js")
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    s = s.replace(old, new, 1)

# ---------------------------------------------------------------- 放样器加半径缩放
rep("""function buildWhaleHull({ fromX, toX, rings = 26, radial = 12, scale, originX = 0, originY = 0 }) {""",
"""function buildWhaleHull({
  fromX, toX, rings = 26, radial = 12, scale, originX = 0, originY = 0,
  /** 可选：按体轴 X 缩放该处截面半径。用来让尾柄段的前几环「缩进」躯干里 */
  radiusMul = null,
}) {""",
"放样器签名")

rep("""    const sec = whaleSectionAt(x);
    const cy = (sec.top + sec.bot) * 0.5;
    const hy = Math.max(0.05, (sec.top - sec.bot) * 0.5);
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      put(x, cy + hy * Math.sin(a), sec.hz * Math.cos(a));
    }""",
"""    const sec = whaleSectionAt(x);
    const cy = (sec.top + sec.bot) * 0.5;
    const k = radiusMul ? radiusMul(x) : 1;
    const hy = Math.max(0.05, (sec.top - sec.bot) * 0.5) * k;
    const hz = sec.hz * k;
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      put(x, cy + hy * Math.sin(a), hz * Math.cos(a));
    }""",
"环生成")

# ---------------------------------------------------------------- 躯干壳往后多伸一截
rep("""    const bodyGeo = buildWhaleHull({
      fromX: 43.0,
      toX: -31.2,""",
"""    const bodyGeo = buildWhaleHull({
      fromX: 43.0,
      // 比尾柄枢纽（−31.2）再往后多伸 2.8：接口要**互相埋进去**，不能对接。
      // 对接的话尾巴一抬（tailRoot.rotation.z）就把两段壳掰开一道楔形缝，
      // 加上两端封口盖与各自的描边壳，看上去就是尾巴断了——主人 2026-09-05
      // 「鲸鱼尾还真有断裂口」。
      toX: -34.0,""",
"躯干后延")

# ---------------------------------------------------------------- 尾柄壳前伸并缩进
rep("""      const stalkGeo = buildWhaleHull({
        fromX: -31.2,
        toX: -51.0,
        rings: 14,
        radial: 12,
        scale: new THREE.Vector3(1, 1, 1),
        originX: -31.2,
        originY: pivotY,
      });""",
"""      const stalkGeo = buildWhaleHull({
        // 从枢纽**之前** 3.2 起步，整段前端埋进躯干里；埋进去的那截半径缩到
        // 0.84 再渐回 1.0，避免与躯干壳同半径重合而 z-fighting。
        // 这样尾巴绕枢纽俯仰时，掰动发生在躯干内部，外面看不到接缝。
        fromX: -28.0,
        toX: -51.0,
        rings: 16,
        radial: 12,
        scale: new THREE.Vector3(1, 1, 1),
        originX: -31.2,
        originY: pivotY,
        radiusMul: (x) => (x >= -34.0
          ? THREE.MathUtils.lerp(0.84, 1.0, THREE.MathUtils.clamp((-28.0 - x) / 6.0, 0, 1))
          : 1),
      });""",
"尾柄前伸")

io.open(P, "w", encoding="utf-8").write(s)
print("鲸尾接口已改成互埋式")
