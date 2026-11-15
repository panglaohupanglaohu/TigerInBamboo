# 水晶城 · 把春天带回家 · 交付复核

状态：已生成可阅读、可下载PDF的56页版；不宣称美术达到原作，也不把漫画新编故事说成已实现游戏关卡。

- 56个A4书本页：双页连续封面 + 54页叙事；网页28跨页。
- 163格、134幅不同实拍像素；场所回接与废片替换有 reusedFrom，全部PNG记录sha256。
- 全部来自8931游戏主场景 canvas；没有生成图，没有游戏菜单。人物摄影摆位与原主线推进分别记录，保留所有失败和重拍记录。
- 原主线后半相认真实交互 snapshot：rescuedFox=true、rescuedTiger=true；苔庭目标为空及UI按钮状态延迟属于既有运行限制，未声称全程游戏通关。
- 身份：父亲信使、不能说话的母亲红狐、女儿虎虎。故事编排串联水晶城、叹息之门、湖沼居民的互助反抗、相认护送和回信。
- 实际研读的Edena公开原图、观察与推论见 docs/EDENA-STUDY.md；书内不包含这些参考图片。
- PDF：56页，中文文本抽检“芭蕉与荷”“我们是一家人”存在；全部56页已经Poppler渲染，并查看接触表，重点页检查文字、人物与遮挡；最终修订页另看全图。
- 网页：56叶/28跨页，所有图片加载、PDF HTTP下载、目录跳转、键盘导航、深链接恢复、390px手机布局检查通过，无JS错误或页脚重叠。

证据：browser-qa.json、pdf-qa.json、pdf-final/page-*.png、family-final-result.json、family-islet-result.json、capture-limits.md。

阅读：http://127.0.0.1:8787/chapters/crystal-tiger-rescue/book.html
PDF：chapters/crystal-tiger-rescue/book.pdf

后续可按读者反馈提升具体分镜，继续使用现有逐页配方，不覆盖用户原资产或用fixtures冒充新实拍。
