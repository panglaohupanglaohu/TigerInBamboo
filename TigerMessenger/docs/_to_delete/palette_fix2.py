# -*- coding: utf-8 -*-
import io, os
p = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/townscaper.html")
s = io.open(p, encoding="utf-8").read()
old = 'for (const entry of CITADEL_PALETTE) PANEL_CHARS[entry.char] = "#" + entry.color.toString(16).padStart(6, "0");'
new = 'for (const entry of EDITOR_PALETTE) PANEL_CHARS[entry.char] = "#" + entry.color.toString(16).padStart(6, "0");'
assert old in s, "PANEL_CHARS 未匹配"
s = s.replace(old, new, 1)
io.open(p, "w", encoding="utf-8").write(s)
print("平面图色板也换源")
