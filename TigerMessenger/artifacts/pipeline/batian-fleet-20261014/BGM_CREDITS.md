# 霸天舰队战斗音乐

用户于2026-10-14确认使用《Hitman》。正式main通过setBatianBattleBgm接入：集结出击至返航期间播放，dock/idle解除；静音和电车可暂停后续播，整曲一次，下次战斗从头开始。使用作者官方MP3在线流，运行时需要网络。

Hitman — Kevin MacLeod (incompetech.com)
Source: https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1300013
Licensed under Creative Commons Attribution 4.0: https://creativecommons.org/licenses/by/4.0/

验证：Node模拟媒体/真实BGM ownership通过启动、静音续播、电车优先、单次播放、回港恢复和再次出击检查；main/sfx语法通过。尚未重新加载正式游戏进行实际音频播放验证。
