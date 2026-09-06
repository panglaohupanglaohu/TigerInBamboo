# -*- coding: utf-8 -*-
"""渲染失败不许再变成「画面冻死、编辑器点不动」。"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/main.js")
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    assert s.count(old) == 1, "多处匹配：" + why
    s = s.replace(old, new, 1)

rep("const nightBloom = P.nightBloomV1", "let nightBloom = P.nightBloomV1", "let 化")

rep("""  if (nightBloom) {
    try {
      nightBloom.setSize(renderer.domElement.width, renderer.domElement.height);
      nightBloom.render(scene, camera);
    } catch (error) {
      console.warn("[perf] bloom disabled:", error?.message);
      nightBloom.dispose?.();
      renderer.render(scene, camera);
    }
  } else {
    renderer.render(scene, camera);
  }""",
"""  if (nightBloom) {
    try {
      nightBloom.setSize(renderer.domElement.width, renderer.domElement.height);
      nightBloom.render(scene, camera);
    } catch (error) {
      console.warn("[perf] bloom disabled:", error?.message);
      nightBloom.dispose?.();
      // ⚠️ 必须置空。原来只 dispose 不置空，下一帧照样走进这个分支再抛一次，
      // 于是控制台每帧刷一行「bloom disabled」，而 catch 里的兜底 render 也在
      // 抛——异常从 animate 里逃出去，画面停在最后一帧
      // （主人 2026-09-05 贴的那几千行同一条报错就是这么来的）。
      nightBloom = null;
      safeRender();
    }
  } else {
    safeRender();
  }""",
 "bloom 置空")

rep("""function animate() {
  requestAnimationFrame(animate);""",
"""/**
 * 渲染的最后一道保险：render 抛异常时不许把画面钉死。
 *
 * 2026-09-05 主人报「系统播放声音，但是无法继续编辑，画面不动了」，控制台
 * 每帧刷同一条 THREE.WebGLAttributes 尺寸不符。根因已经在
 * mergedCellPatch.js 修掉了，但这里暴露出一个更要命的结构问题：
 * **render 一旦持续抛异常，整个应用就只剩音频还活着**。rAF 在函数头就排好了
 * 下一帧，逻辑其实一直在跑，只是画面再也不更新——用户看到的是「死机」，
 * 于是只能杀掉页面，正在编辑的城堡跟着没了。
 *
 * 所以这里把它降级成「画面可能有瑕疵，但还能操作」：
 *   · 第一次失败打完整堆栈（要能定位，不能吞）
 *   · 之后同类错误按次数收敛，不刷屏
 *   · 无论如何不让异常逃出 animate，编辑器、快捷键、存档继续可用
 */
let renderFailures = 0;
let lastRenderError = "";
function safeRender() {
  try {
    renderer.render(scene, camera);
    renderFailures = 0;
  } catch (error) {
    const msg = error?.message || String(error);
    renderFailures++;
    if (renderFailures === 1 || msg !== lastRenderError) {
      console.error("[render] 本帧渲染失败（画面可能停更，但编辑器仍可操作）：", error);
      lastRenderError = msg;
    } else if (renderFailures === 60 || renderFailures % 600 === 0) {
      console.error(`[render] 已连续 ${renderFailures} 帧渲染失败：${msg}`);
    }
  }
}

function animate() {
  requestAnimationFrame(animate);""",
 "safeRender")

io.open(P, "w", encoding="utf-8").write(s)
print("patched main.js")
