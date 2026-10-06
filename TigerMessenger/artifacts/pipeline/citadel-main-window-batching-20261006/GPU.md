# 正式首页同机位GPU

14:52 默认main newCityWindowBatching:true，candidate传给factory batchWindowDetails，工厂默认仍false。实际全景见live-front.png/json，GL0/gpuFailures[]/console errors[]；同.49白ambient/fff6df太阳。窗框、窗片和几何外观正常；14窗合批CPU+3水面CPU共17通过。CPU证明主楼317→119mesh，总三角形13338不变，不能视为实际FPS。

实际renderer.info前9932calls/4204295tri，后8316calls/3278953tri。截图里动态列车/机器人集合不同，因此不是隔离A/B，不能把差值1616当窗合批收益，也不称FPS提升。本次先确认实际加载后视觉与渲染正常，详细main报告UI字段补入下一次加载。结束UI恢复daySpeed.4和玩家镜头，信使书店未移动。回退main newCityWindowBatching:false并重建。
