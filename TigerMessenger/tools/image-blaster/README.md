# 信使图片建模

上游：https://github.com/neilsonnn/image-blaster
固定版本：4acb43ba126a12358f71838d1b1a05e856b10eaf
本机独立checkout：/Users/panglaohu/Downloads/TigerInBamboo-tools/image-blaster

认可目标图已放在工具checkout的 `worlds/tiger-messenger/source/courier-approved.png`，单角色描述在 `worlds/tiger-messenger/output/courier/object.json`。`courier-job.json` 保存清理提示与参数：只提取一个角色，邮包贴侧身腋下；Hunyuan、50000面、PBR。无需生成世界或声音。

在工具checkout的 `.env` 本机设置 `FAL_KEY` 后，运行：

```sh
node TigerMessenger/tools/image-blaster/generate-courier.mjs --check
node TigerMessenger/tools/image-blaster/generate-courier.mjs
```

需要 Node 20+；可用 IMAGE_BLASTER_DIR 指定其它上游checkout。上游自动保留请求记录并复用已有结果，默认不强制重新付费生成。当前仅准备完成，无密钥，尚无请求或生成GLB。生成文件在上游worlds/tiger-messenger/output/courier；先核对实际GLB/材质，再处理骨骼与现有walk/ride/letter接口，不能用静态网格替换正在用的可动画角色。
