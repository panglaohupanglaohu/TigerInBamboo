# -*- coding: utf-8 -*-
"""把 moonLake 放进 updateMessengerIsland 的 state——逐帧那一侧要拿得到它。"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/scenes/messengerIsland.js")
s = io.open(P, encoding="utf-8").read()
old = """    const state = {
      scene,
      R,
      camp,
      platforms,
      clouds,
      tramSystem,"""
new = """    const state = {
      scene,
      R,
      camp,
      platforms,
      clouds,
      moonLake, // 月亮 + 涟漪 / 涉水水花 / 倒影的逐帧（updateIsland → updateLakeFx）
      tramSystem,"""
assert s.count(old) == 1
s = s.replace(old, new, 1)
io.open(P, "w", encoding="utf-8").write(s)
print("patched messengerIsland.js（state.moonLake）")
