# -*- coding: utf-8 -*-
"""门 L 前置：现网 renderer 从不申请模板缓冲，P.stencilWindowsV1 是空转。"""
import io, os
R = os.path.expanduser("~/mnt/TigerInBamboo/")

def edit(rel, pairs):
    p = R + rel
    s = io.open(p, encoding="utf-8").read()
    for old, new in pairs:
        assert old in s, f"{rel} 未匹配：{old[:60]}"
        s = s.replace(old, new, 1)
    io.open(p, "w", encoding="utf-8").write(s)
    print("patched", rel)

# ---- 1. 主渲染器 ----
edit("TigerMessenger/src/core/stage.js", [
("""import * as THREE from "three";

export function createStage() {""",
 """import * as THREE from "three";
import { P } from "./params.js";

export function createStage() {"""),
("""  const renderer = new THREE.WebGLRenderer({ antialias: true });""",
 """  // 模板缓冲：three r163 起 `stencil` 默认 **false**（早年默认 true）。
  // 不申请就没有模板位，`stencilWindows.js` 写的模板状态全部空转——
  // 2026-09-05 实测：现网写法 gl.STENCIL_BITS = 0，加上这一行才是 8。
  // 只在挖窗开关打开时申请，关着的时候不为它付带宽。
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    stencil: P.stencilWindowsV1 === true,
  });"""),
])

# ---- 2. 行星页渲染器 ----
edit("TigerMessenger/src/planet/main.js", [
("""const renderer = new THREE.WebGLRenderer({ antialias: true });""",
 """// 模板缓冲：见 src/core/stage.js 的同名注释（three r163 起默认 false）
const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true });"""),
])

# ---- 3. 编辑器页：URL 开关直通，方便截图对照 ----
edit("TigerMessenger/townscaper.html", [
("""const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });""",
 """// 模板缓冲：three r163 起默认 false，不申请则 stencilWindows 全部空转
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  stencil: new URLSearchParams(location.search).get("stencilWindowsV1") === "1",
});"""),
])

# ---- 4. 门 L 的测试补一条源码级断言，防止这个洞再被无头脚本漏过 ----
p = R + "tools/test_window_stencil_positions.mjs"
s = io.open(p, encoding="utf-8").read()
MARK = "模板缓冲必须真的被申请"
if MARK not in s:
    s += '''

// ---------------------------------------------------------------------
// 门 L 前置：模板缓冲必须真的被申请
//
// 2026-09-05：本脚本与 probe_stencil_windows 都是无头的，拿不到真 GL 上下文，
// 所以「材质状态写对了」和「模板测试真的生效了」被它们混为一谈。实测发现
// 现网四处 `new THREE.WebGLRenderer` 全都没传 stencil，而 vendor 的 three
// （r163+）里这个参数默认 false —— gl.STENCIL_BITS = 0，模板测试恒真，
// P.stencilWindowsV1 打开也不挖洞。脚本判不了 GL，就退一步判源码。
// ---------------------------------------------------------------------
{
  const src = fs.readFileSync(new URL("../TigerMessenger/src/core/stage.js", import.meta.url), "utf8");
  const call = src.slice(src.indexOf("new THREE.WebGLRenderer"));
  const head = call.slice(0, call.indexOf(")") + 1);
  assert.ok(
    /stencil\\s*:/.test(head),
    "src/core/stage.js 的 WebGLRenderer 必须显式传 stencil —— 否则模板挖窗全程空转"
  );
  console.log("  ✓ 门 L 前置：stage.js 已申请模板缓冲");
}
'''
    io.open(p, "w", encoding="utf-8").write(s)
    print("patched tools/test_window_stencil_positions.mjs")
