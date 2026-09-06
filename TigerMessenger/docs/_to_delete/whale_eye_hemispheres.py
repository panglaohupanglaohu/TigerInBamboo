# -*- coding: utf-8 -*-
"""鲸眼改成「眼珠外两枚半球开合」——主人否掉了眼睑+睫毛拉开那一版。"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/assets/leviathanIsland.js")
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    assert s.count(old) == 1, "多处匹配：" + why
    s = s.replace(old, new, 1)

# ---------------------------------------------------------------- 顶部说明
rep("""    // 结构（每侧一组，挂在 eyeRoot 下，动画只动这一组）：
    //   眼球（近黑压扁球） → 眼珠高光（暖琥珀小球，MeshBasicMaterial 不吃光）
    //   → 上下眼睑（肤色压扁球，沿 Y 相向合拢，合上时把眼球整个盖住）
    //   → 眼灯（PointLight，走 localLightRegistry 参与 K4 预算，不是野生灯）
    //
    // 眼睑用「两片相向合拢」而不是「一片缩放」：巨物的眼要有上下皮的厚度感，
    // 单片缩放会读成一张贴纸在闪。""",
"""    // 结构（每侧一组，挂在 eyeRoot 下，动画只动这一组）：
    //   眼球（近黑压扁球） → 眼珠高光（暖琥珀小球，MeshBasicMaterial 不吃光）
    //   → 眼珠外的**两枚半球壳**（绕前后轴相向开合）
    //   → 眼灯（PointLight，走 localLightRegistry 参与 K4 预算，不是野生灯）
    //
    // 开合形式是主人 2026-09-05 明确指定的：「眼珠外有两个半球开合即可」。
    // 上一版我做成上下两片扁球体沿 Y 平移相向合拢，视觉上读成「眼睑连睫毛
    // 一起被拉开」，主人的原话是「一点都不好看」。两者的差别不是参数而是
    // 机制：平移的是两张皮，旋转的是一个被剖开的壳——后者合上时就是一颗
    // 完整的球，张开时像贝壳让开，没有任何「皮」的形状出现。""",
    "顶部说明")

# ---------------------------------------------------------------- 构造
rep("""      // 上下眼睑：肤色，比眼球略大，闭合时相向合拢到中线
      const lidGeo = new THREE.SphereGeometry(0.95, 6, 4);
      const lidMat = toonMat(SKIN_DEEP, { flatShading: true });
      const mkLid = (dir) => {
        const lid = new THREE.Mesh(lidGeo, lidMat);
        lid.name = `leviathan-eyelid-${tag}-${dir > 0 ? "top" : "bot"}`;
        lid.scale.set(1, 0.62, 0.62);
        lid.userData.lidDir = dir;
        addOutline(lid, OUTLINE_W * 0.5);
        eyeRoot.add(lid);
        return lid;
      };
      const lidTop = mkLid(1);
      const lidBot = mkLid(-1);""",
"""      // 两枚半球壳：合上时拼成一颗完整的球把眼珠整个包住，张开时各自
      // 绕**前后轴**向背离镜头的一侧转开。
      //
      // 半球用 SphereGeometry 的 thetaStart/thetaLength 切：
      // 上壳 theta 0→π/2（+Y 那半），下壳 π/2→π（−Y 那半）。
      //
      // 旋转轴必须是局部 X（鲸的前后向）。眼睛朝 ±Z（体侧），绕 X 转才是
      // 「掀开」；绕 Y 会把壳转到眼珠正前方，绕 Z 是绕着视线自转，两个都不对。
      //
      // lidWrap 承担压扁：**先转再压**。如果把压扁写在半球自己身上，
      // 压扁轴会跟着旋转一起转，转到一半壳会变成一个歪的椭球。
      // 放进父级 group 就是「在正球空间里转好，再整体压向体侧」，
      // 合上时是一枚贴着皮肤的透镜状眼盖，不是一颗突出来的球。
      const lidWrap = new THREE.Group();
      lidWrap.name = `leviathan-eyelid-wrap-${tag}`;
      lidWrap.scale.set(1, 1, 0.62);
      eyeRoot.add(lidWrap);

      const lidMat = toonMat(SKIN_MID, { flatShading: true });
      const mkLid = (upper) => {
        const lid = new THREE.Mesh(
          new THREE.SphereGeometry(
            0.94, 12, 5, 0, Math.PI * 2,
            upper ? 0 : Math.PI / 2, Math.PI / 2
          ),
          lidMat
        );
        lid.name = `leviathan-eyelid-${tag}-${upper ? "top" : "bot"}`;
        lid.userData.lidUpper = upper;
        addOutline(lid, OUTLINE_W * 0.5);
        lidWrap.add(lid);
        return lid;
      };
      const lidTop = mkLid(true);
      const lidBot = mkLid(false);""",
    "半球构造")

# ---------------------------------------------------------------- 动画
rep("""        for (const e of eyes) {
          // 上下眼睑相向合拢：全开时退到眼球外，全闭时压到中线
          const open = 1 - close;
          const gap = 0.78 * open + 0.02;
          e.lidTop.position.y = gap;
          e.lidBot.position.y = -gap;""",
"""        for (const e of eyes) {
          // 两枚半球开合：0 = 合成整球盖住眼珠，最大 ≈83° = 让开眼珠。
          // 不给满 90°：留一点点壳挂在上下缘，眼睛才有眼眶的厚度，
          // 全部转光了会读成「眼珠直接长在皮肤上」。
          const open = 1 - close;
          const ang = Math.PI * 0.46 * open;
          // 往**背离镜头**的一侧转开。右眼 side>0、镜头在 +Z：
          // 上壳要 +Y→−Z（绕 X 负向），下壳要 −Y→−Z（绕 X 正向）；
          // 左眼镜头在 −Z，两个方向同时取反——所以统一写成 ∓side*ang。
          e.lidTop.rotation.x = -e.side * ang;
          e.lidBot.rotation.x = e.side * ang;""",
    "半球动画")

io.open(P, "w", encoding="utf-8").write(s)
print("patched leviathanIsland.js")
