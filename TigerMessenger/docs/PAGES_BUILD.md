# GitHub Pages 启动包

线上入口使用 `runtime/game-<内容哈希>.js`；本地 localhost 默认使用源码，`?bundle=1` 可验证相同启动包。

```sh
npm install
npm run build:pages
```

构建工具版本固定在 package.json。构建时将纯 JSON 模型模块无损 gzip 压缩到 runtime/data；运行时最多4个并发请求，网络失败重试两次，错误显示实际资源路径。普通代码合并为单个 ESM，Three.js 使用本地 vendor。各源码的 import.meta.url 被保留为原资源目录，GLB、音乐和 Worker 的相对路径不随打包位置改变。需要支持 DecompressionStream 的现代浏览器。

提交 index.html、runtime/build.json、它引用的 game 文件和全部 packedData 文件；构建后入口的 game 文件名需同步。源码保留，用于后续修改与调试。根目录 .nojekyll 使 Pages 按静态资源发布。

本次修复从已提交版本构建（`node tools/pages-build/build.mjs --committed`），避免把其他正在进行的山体改动混入发布。构建证据与本地/线上验证记录在 artifacts/pipeline/pages-startup-fix-20261031。压缩传输不意味着已证明 FPS 提升，也不替代正式游戏启动验收。
