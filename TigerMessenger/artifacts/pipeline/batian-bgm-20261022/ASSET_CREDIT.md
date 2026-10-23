# Hitman 本地同曲副本

用户选曲不变：Hitman — Kevin MacLeod (incompetech.com)。

- 作者官方页面：https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1300013
- 本地文件：music/Hitman.ogg；来源：https://commons.wikimedia.org/wiki/File:Hitman_by_Kevin_MacLeod.ogg
- 下载地址：https://upload.wikimedia.org/wikipedia/commons/b/b3/Hitman_by_Kevin_MacLeod.ogg
- CC BY 4.0：https://creativecommons.org/licenses/by/4.0/
- 4,883,590字节；SHA1 1b746f92afed18b2f5ea7cc58ff6d54caa8f5c9b，与root核对的Commons结构化元数据一致；本轮不转码、不修改内容。
- root记录Commons来源指向filmmusic；页面许可复审标记保留，不将镜像当成作者直接下载。
- 正式控制器本地优先；本地加载/格式错误仅切换到原作者官方MP3。保留每场整曲一次、静音和电车优先。
- 官方HTTPS在本轮多次超时；原正常游戏owner=batian/volume=.5，但readyState=0/currentTime=0。旧问题不是音量被静音，而是远端媒体未载入。
- 真实浏览器解码及正式游戏播放由root另行验收；Node模拟媒体测试不是主观试听证据。

## 根正式入口验证追加

正常游戏UI集结出击，实际本地源readyState4/networkState1/mediaErrornull、volume.5、pausedfalse；currentTime18.365→77.29秒，见formal-playback.json。证明真实浏览器解码与时钟推进，不宣称主观听感或整曲播放。
