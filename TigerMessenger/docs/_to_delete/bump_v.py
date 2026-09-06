# -*- coding: utf-8 -*-
import io, os
p = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/index.html")
s = io.open(p, encoding="utf-8").read()
old = './src/main.js?v=20260904-distcull-recollect-v1'
new = './src/main.js?v=20260905-ride-gate-v1'
assert old in s, "main.js ?v= 未匹配"
s = s.replace(old, new, 1)
io.open(p, "w", encoding="utf-8").write(s)
print("index.html ?v= 已 bump（否则浏览器缓存住旧 main.js，改了也看不到）")
