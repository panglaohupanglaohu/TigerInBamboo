# -*- coding: utf-8 -*-
"""鲸眼：上下眼睑开合 + 眼珠高光 + 两枚眼珠点光源（走 localLightRegistry）。"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/assets/leviathanIsland.js")
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    s = s.replace(old, new, 1)

# ---------------------------------------------------------------- import
rep("""import * as THREE from "three";
import { toonMat, addOutline } from "./toon.js";""",
"""import * as THREE from "three";
import { toonMat, addOutline } from "./toon.js";
import { registerLocalLight } from "../render/lighting/localLightRegistry.js";""",
"import")

# ---------------------------------------------------------------- 眼色常量
rep("""/** 藤壶浅壳色（暖白骨色，不是冰蓝） */""",
"""/** 眼珠高光与眼灯色：暖琥珀，不是冷白——冷白在近黑的头上会读成一颗塑料珠 */
const EYE_GLOW = 0xffcf8a;
/** 藤壶浅壳色（暖白骨色，不是冰蓝） */""",
"眼色")

# ---------------------------------------------------------------- 眼睛构造
rep("""    // 太古鲸眼：贴在壳面上、口角后上方。没有眼睛的巨鲸在远景里只是一团影子。
    for (const side of [-1, 1]) {
      const sec = whaleSectionAt(27.5);
      const cy = (sec.top + sec.bot) * 0.5;
      const hy = (sec.top - sec.bot) * 0.5;
      const phi = -0.18;
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.85, 6, 5),
        toonMat(0x101215, { flatShading: true })
      );
      eye.name = `leviathan-eye-${side < 0 ? "L" : "R"}`;
      eye.position.set(27.5, cy + hy * Math.sin(phi), side * sec.hz * Math.cos(phi) * 0.97);
      eye.scale.set(1, 1, 0.55); // 压扁贴面
      addOutline(eye, OUTLINE_W);
      group.add(eye);
    }""",
"""    // 太古鲸眼（主人 2026-09-05 加需求）：**会睁会闭**，眼珠里有光。
    //
    // 结构（每侧一组，挂在 eyeRoot 下，动画只动这一组）：
    //   眼球（近黑压扁球） → 眼珠高光（暖琥珀小球，MeshBasicMaterial 不吃光）
    //   → 上下眼睑（肤色压扁球，沿 Y 相向合拢，合上时把眼球整个盖住）
    //   → 眼灯（PointLight，走 localLightRegistry 参与 K4 预算，不是野生灯）
    //
    // 眼睑用「两片相向合拢」而不是「一片缩放」：巨物的眼要有上下皮的厚度感，
    // 单片缩放会读成一张贴纸在闪。
    const eyes = [];
    for (const side of [-1, 1]) {
      const sec = whaleSectionAt(27.5);
      const cy = (sec.top + sec.bot) * 0.5;
      const hy = (sec.top - sec.bot) * 0.5;
      const phi = -0.18;
      const ex = 27.5;
      const ey = cy + hy * Math.sin(phi);
      const ez = side * sec.hz * Math.cos(phi) * 0.97;
      const tag = side < 0 ? "L" : "R";

      const eyeRoot = new THREE.Group();
      eyeRoot.name = `leviathan-eye-root-${tag}`;
      eyeRoot.position.set(ex, ey, ez);
      group.add(eyeRoot);

      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.85, 6, 5),
        toonMat(0x101215, { flatShading: true })
      );
      eye.name = `leviathan-eye-${tag}`; // 名字不变：test_leviathan / 外部按名取
      eye.scale.set(1, 1, 0.55); // 压扁贴面
      addOutline(eye, OUTLINE_W);
      eyeRoot.add(eye);

      // 眼珠高光：不吃光的小亮点，偏上外侧——这是「活物」的关键一笔
      const shine = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 5, 4),
        new THREE.MeshBasicMaterial({ color: EYE_GLOW })
      );
      shine.name = `leviathan-eye-shine-${tag}`;
      shine.position.set(0.16, 0.24, side * 0.42);
      shine.scale.set(1, 1, 0.6);
      shine.userData.transientFx = true; // 不进静态合并块
      eyeRoot.add(shine);

      // 上下眼睑：肤色，比眼球略大，闭合时相向合拢到中线
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
      const lidBot = mkLid(-1);

      // 眼灯：K4 局部光预算内的注册灯，id 由 owner 派生（leviathan-eye#0/#1）
      const glow = new THREE.PointLight(EYE_GLOW, 0.0, 26, 2);
      glow.name = `leviathan-eye-light-${tag}`;
      glow.position.set(0.2, 0.2, side * 0.7);
      eyeRoot.add(glow);
      registerLocalLight(glow, {
        owner: "leviathan-eye",
        kind: "point",
        color: EYE_GLOW,
        intensity: 1.15,
        radius: 26,
        priority: 4,
      });

      eyes.push({ eyeRoot, eye, shine, lidTop, lidBot, glow, side });
    }
    group.userData.leviathanEyes = eyes;""",
"眼睛构造")

# ---------------------------------------------------------------- 眨眼动画
rep("""    // 尾姿随升空进度：尾鳍比躯干微延迟 12% 扬起""",
"""    // ---- 眨眼（主人 2026-09-05）：确定性节律，不用 Math.random ----
    // 节律参考真实巨鲸：多数时候半睁着缓慢呼吸，偶尔一次快速眨，
    // 更偶尔一次长闭（像在打盹）。三条正弦错相拼出来，同一时刻永远同一结果。
    {
      const eyes = group.userData.leviathanEyes || [];
      if (eyes.length) {
        const cyc = time / 5.7;
        const frac = cyc - Math.floor(cyc);            // 每 5.7s 一轮
        // 快眨：一轮里前 7% 的时间，0→1→0 走一个正弦包
        const quick = frac < 0.07 ? Math.sin((frac / 0.07) * Math.PI) : 0;
        // 长闭：每 6 轮来一次，闭得更久也更深
        const longIdx = Math.floor(cyc) % 6 === 0;
        const long = longIdx && frac < 0.30 ? Math.sin((frac / 0.30) * Math.PI) ** 0.6 : 0;
        // 常态半睁：极缓的呼吸感，眼睑始终有一点点动
        const idle = 0.12 + 0.05 * Math.sin(time * 0.31);
        const close = THREE.MathUtils.clamp(Math.max(quick, long * 0.95, idle), 0, 1);
        for (const e of eyes) {
          // 上下眼睑相向合拢：全开时退到眼球外，全闭时压到中线
          const open = 1 - close;
          const gap = 0.78 * open + 0.02;
          e.lidTop.position.y = gap;
          e.lidBot.position.y = -gap;
          // 闭合时眼珠高光与眼灯一起熄，睁开才亮——不然会隔着眼皮发光
          const lit = Math.max(0, open - 0.25) / 0.75;
          e.shine.visible = lit > 0.02;
          e.shine.scale.setScalar(0.6 + 0.4 * lit);
          e.glow.intensity = 1.15 * lit * lit;
        }
      }
    }

    // 尾姿随升空进度：尾鳍比躯干微延迟 12% 扬起""",
"眨眼动画")

io.open(P, "w", encoding="utf-8").write(s)
print("鲸眼开合 + 眼珠光源已加")
