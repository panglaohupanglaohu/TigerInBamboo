# -*- coding: utf-8 -*-
"""把剩下的原型几何也登记进 proto() 清扫表——建城 1748 条游离几何的主体。

buildCitadelTown 里的「原型几何」是给一大批网格共享的模板。1514 行的
proto() 会在函数末尾清扫「本次调用没有任何网格用到」的那些。问题是登记只做到
第 2040 行，后面几条规则（屋顶/拱廊/水道/广场/小船）各自在自己的块里 new 了
原型，没进表——某条规则这次一个网格都没产出时（没水、没广场、没船是常态），
它的原型就成了纯泄漏。

实测：建城后游离几何 1748 条，排行榜前 12 名全是这些没登记的原型。
"""
import io, os
R = os.path.expanduser("~/mnt/TigerInBamboo/")

def edit(rel, pairs):
    p = R + rel
    s = io.open(p, encoding="utf-8").read()
    for old, new, why in pairs:
        assert old in s, "%s 未匹配：%s" % (rel, why)
        assert s.count(old) == 1, "%s 多处匹配：%s" % (rel, why)
        s = s.replace(old, new, 1)
    io.open(p, "w", encoding="utf-8").write(s)
    print("patched", rel)

edit("TigerMessenger/src/world/citadelTown.js", [
# ---- 屋顶/尖塔 ----
("""    const gableX = makeGableRoofGeometry(cs, ch); // 屋脊沿 +x
    const gableZ = gableX.clone().rotateY(Math.PI / 2); // 屋脊沿 +z
    const spireGeometry = new THREE.ConeGeometry(cs * 0.58, ch * 0.55, 4);
    spireGeometry.rotateY(Math.PI / 4); // 四坡尖顶对齐格边""",
 """    // 这一段的原型必须登记进 proto()：屋脊/尖塔/教堂塔是「有就用一批、
    // 没有就一条都不用」的类型，某一层没有十字形分量时它们全是纯泄漏。
    const gableX = proto(makeGableRoofGeometry(cs, ch)); // 屋脊沿 +x
    const gableZ = proto(gableX.clone().rotateY(Math.PI / 2)); // 屋脊沿 +z
    const spireGeometry = proto(new THREE.ConeGeometry(cs * 0.58, ch * 0.55, 4));
    spireGeometry.rotateY(Math.PI / 4); // 四坡尖顶对齐格边""",
 "屋脊/尖塔"),

("""    const steepleTowerGeometry = new THREE.BoxGeometry(cs * 0.5, ch * 0.85, cs * 0.5);
    const steepleConeGeometry = new THREE.ConeGeometry(cs * 0.4, ch * 0.95, 4);""",
 """    const steepleTowerGeometry = proto(new THREE.BoxGeometry(cs * 0.5, ch * 0.85, cs * 0.5));
    const steepleConeGeometry = proto(new THREE.ConeGeometry(cs * 0.4, ch * 0.95, 4));""",
 "教堂塔"),

# ---- 拱廊 ----
("""    const archGeoX = new THREE.CylinderGeometry(cs * 0.48, cs * 0.48, cs * 0.96, 12, 1, false, 0, Math.PI);
    archGeoX.rotateZ(Math.PI / 2);
    archGeoX.rotateX(-Math.PI / 2);
    const archGeoZ = archGeoX.clone().rotateY(Math.PI / 2);""",
 """    // 悬空格才有拱廊，多数层一个都没有 → 不登记就是每次建城两条纯泄漏
    const archGeoX = proto(new THREE.CylinderGeometry(cs * 0.48, cs * 0.48, cs * 0.96, 12, 1, false, 0, Math.PI));
    archGeoX.rotateZ(Math.PI / 2);
    archGeoX.rotateX(-Math.PI / 2);
    const archGeoZ = proto(archGeoX.clone().rotateY(Math.PI / 2));""",
 "拱廊"),

# ---- 水道 ----
("""    const waterGeometry = new THREE.BoxGeometry(cs * 0.98, 0.12, cs * 0.98);""",
 """    // leanDecor（水上城堡）会直接 break 掉整个循环，一个网格都不产出
    const waterGeometry = proto(new THREE.BoxGeometry(cs * 0.98, 0.12, cs * 0.98));""",
 "水道"),

# ---- 广场 ----
("""    const plazaGeometry = new THREE.BoxGeometry(cs * 0.97, 0.08, cs * 0.97);
    const seamGeometry = new THREE.BoxGeometry(cs * 0.97, 0.085, 0.045);""",
 """    const plazaGeometry = proto(new THREE.BoxGeometry(cs * 0.97, 0.08, cs * 0.97));
    const seamGeometry = proto(new THREE.BoxGeometry(cs * 0.97, 0.085, 0.045));""",
 "广场"),

# ---- 小船 ----
("""    const boatGeometry = new THREE.BoxGeometry(0.72, 0.22, 0.3);
    const sailGeometry = new THREE.BoxGeometry(0.02, 0.5, 0.22);""",
 """    // 小船是概率装饰（roll），大多数层摇不出来
    const boatGeometry = proto(new THREE.BoxGeometry(0.72, 0.22, 0.3));
    const sailGeometry = proto(new THREE.BoxGeometry(0.02, 0.5, 0.22));""",
 "小船"),
])
