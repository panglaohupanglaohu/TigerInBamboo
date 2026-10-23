# 李 / LeeBai 舷侧附着件适配

本批仅修改 `src/world/bookshopHarborDetail.js` 的两侧护舷条、舷窗和铆钉。实际正式工厂船 `bookshop-steam-parts-freighter` 的 closedWaterlineLoft 三角面通过船局部射线采样，附着件沿真实外法线留小量安装间隙。四条原直线铜护舷条改成跟随侧壳的 62 段曲线，材质及半径保留；18 个舷窗和 104 个铆钉按实际壳面倾斜方向安装。仍按材质合批，甲板设备合批后 12 个 Mesh。

没有修改船体、船名纹理、颜色、根变换、工厂、码头、起重机、索具或运输动画。未新增表面定义，也没有改 bookshopFreighterHull.js。

## CPU 检查

实际正式工厂构建和原船壳回归均通过。护舷各段 5 个纵向位置 × 12 个周向点，舷窗环及玻璃角点、铆钉上下周界射线落在实际 2784 三角壳面。护舷内表面最低正间隙 0.002890 船局部单位；舷窗最小间隙 0.009000；铆钉最小间隙 0.001000。外表面最大间隙含零件自身厚度，并非悬空距离。船的正式 scale=5，因此该护舷最小间隙约 0.0144 世界单位。0/5/10/20 秒船位置/scale 检查保留原系泊浮动。单次正式工厂构建约 96 ms（不是 GPU 性能测量）。

测试：`tests/world/bookshopFreighterFittings.verify.mjs`、`tests/world/bookshopFreighterHull.verify.mjs`。日志 fittings-cpu.json、hull-regression-cpu.json，恢复源 source-before/bookshopHarborDetail.js。

## 验证边界

CPU 测试用实际生产工厂生成的 indexed 壳面；附着件周界按同样原语尺寸、位置和姿态重建采样。不是正式 GPU 截图或视觉验收。内嵌浏览器控制当前不可用，最终曲线接缝、舷窗可读性及全场帧率仍待 GPU 检查。
