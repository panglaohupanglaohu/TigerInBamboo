# vendor 导航小组的旧件快照（R33）

R33 把 `TigerMessenger/src/vendor/townscaper-rea-refactoring/src/` 里的导航一小组换成了最新库。这里是换之前的原样，**只给回归测试 import**（`tests/nav-vendor-swap.test.mjs` 拿它和新版逐对比路线）：

- 换掉的：`src/world/battle-navigation.js`、`src/world/layerednav.js`、`src/world/navgraph.js`、`src/core/path-samples.js`
- 没换、为了让上面几份的相对 import 能解析而一起拷来的：`src/core/minheap.js`、`src/core/portal-aim.js`、`src/core/world.js`

游戏不读这里。真正的备份在 `TigerMessenger/artifacts/r21-r70-backup/R33/`（按仓库根相对路径），回退方法见那里的 README.txt。
