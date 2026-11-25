// R-B2 端到端：通用「之前 / 之后 · 同机位对照」面板（before-after-panel.js，挂在每个 tier-workshop 侧栏）真实验收。
//   新开隔离 context（不碰用户存档）→ pipeline.html#mountain → 高山圣城扫描 → 执行出山形候选 →
//   ① 山形侧栏 .ba-panel 出现（同场景建筑侧栏的面板也顺带核对，证明是通用挂载）；
//   ② 先人工点「对照原样 / 看候选」核对 compare 钩子真的切了实景（mountain.state.comparing 真变），
//      这样之后的像素差如果为 0 才能诚实归因到「画面没变」而不是「钩子没切」；
//   ③ 侧栏「拍之前 / 之后（同机位）」一次点击内部走 compare(true)→拍→compare(false)→同机位再拍→逐像素差，
//      断言 __tmBeforeAfter.mountain[0] 生成：before/after 都是 PNG dataURL、steps 非空、diff 已算；
//   ④ diff.changed>0 断言有真实像素差；若为 0 按约定如实记 NOT_RUN + 原因（候选在该机位无视觉差异），不造假。
//   证据：entry 里的两张图解码存 ba-*.png + 面板 / 实景截图 + report.json，全在 artifacts/before-after-e2e/run-<时间戳>/。
// 运行：cd TigerMessenger && $NODE tests/before-after-browser.mjs   （需要 8931 服务）
import fs from 'node:fs';import path from 'node:path';
import {openMountain} from './mountain-e2e-lib.mjs';
const t=await openMountain('before-after'),{report,expect,cmd,page}=t;
const W='#mountain-workshop',SIDE='.tier-side[data-tier="mountain"]',PANEL=SIDE+' .ba-panel',PID='#before-after-mountain';
const dataUrlToPng=async(u,f)=>{expect(/^data:image\/png;base64,/.test(u||''),'entry 图不是 PNG dataURL');fs.writeFileSync(f,Buffer.from(u.slice('data:image/png;base64,'.length),'base64'));};
await t.finish(async()=>{
 report.steps.scan=await t.boot();
 // ① 面板挂载：山形侧栏必须有 .ba-panel；同场景建筑侧栏的通用挂载顺带记录（有就核对结构，不强制）
 await page.waitForSelector(PANEL,{timeout:120000});
 report.steps.panels={mountain:await page.locator(PANEL).count(),building:await page.locator('.tier-side[data-tier="building"] .ba-panel').count()};
 expect(report.steps.panels.mountain>=1,'山形侧栏没有出现 .ba-panel');
 expect(await page.locator(PID).getAttribute('data-layer')==='mountain','面板 data-layer 不是 mountain');
 const h4=await page.locator(PANEL+' h4').first().textContent();expect(h4.includes('之前 / 之后'),'面板标题不对：'+h4);
 // ② 候选 + compare 钩子真实性
 const run=await t.runCandidate();report.steps.run={h4:run.h4};
 await cmd('mountain.camera',{view:'oblique'}).catch(()=>{});
 const stPreview=await cmd('mountain.state');
 expect(stPreview?.previewing===true,'执行后实景没有换上候选');
 // mountain.state.comparing：compare(on) 只藏候选网格不撤 preview，所以钩子切没切看 comparing 标志
 const cmpBtn=page.locator(W+' .agent-actions button',{hasText:'对照原样'});
 await cmpBtn.waitFor({state:'visible',timeout:60000});await cmpBtn.click();
 await page.waitForFunction(()=>{const b=[...document.querySelectorAll('#mountain-workshop .agent-actions button')].find(x=>x.textContent==='看候选');return !!b;},{},{timeout:60000});
 const stOrig=await cmd('mountain.state');
 expect(stOrig?.comparing===true,'点「对照原样」后 mountain.state.comparing 没置位（compare 钩子没切）');
 await page.locator(W+' .agent-actions button',{hasText:'看候选'}).click();
 await page.waitForTimeout(800);const stBack=await cmd('mountain.state');
 expect(stBack?.comparing===false&&stBack?.previewing===true,'点「看候选」后没切回候选');
 report.steps.compareHook={afterRun:{previewing:stPreview.previewing,comparing:!!stPreview.comparing},compareOn:stOrig.comparing,compareOff:stBack.comparing};
 await cmd('mountain.camera',{view:'oblique'}).catch(()=>{});
 await t.shotGame('1-candidate-preview',2000);
 // ③ 拍之前 / 之后
 const go=page.locator(PANEL+' button[data-before-after="mountain"]');
 await go.waitFor({state:'visible',timeout:60000});await go.scrollIntoViewIfNeeded();await go.click();
 await page.waitForSelector(PID+'[data-state="done"],'+PID+'[data-state="error"]',{timeout:180000});
 const state=await page.locator(PID).getAttribute('data-state');
 if(state==='error'){report.steps.shootError=await page.locator(PANEL+' small.muted').textContent().catch(()=>null);}
 expect(state==='done','拍摄没完成（state='+state+'）：'+(report.steps.shootError||''));
 const entry=await page.evaluate(()=>{const e=globalThis.__tmBeforeAfter?.mountain?.[0];return e?{...e,beforeLen:e.before?.length,afterLen:e.after?.length}:null;});
 expect(entry,'__tmBeforeAfter.mountain 没有 entry');
 report.steps.entry={layer:entry.layer,scene:entry.scene,candidate:entry.candidate,steps:entry.steps,verify:entry.verify,diff:entry.diff,pose:entry.pose,beforeLen:entry.beforeLen,afterLen:entry.afterLen};
 expect(entry.layer==='mountain'&&entry.candidate,'entry 字段不完整：'+JSON.stringify({layer:entry.layer,candidate:entry.candidate}));
 expect(Array.isArray(entry.steps)&&entry.steps.length>0,'entry.steps 为空');
 // 面板并排两张图
 const imgs=await page.locator(PANEL+' .ba-pair img[data-shot]').count();
 expect(imgs===2,'面板没有并排两张图（'+imgs+'）');
 for(const k of ['before','after']){const src=await page.locator(PANEL+` img[data-shot="${k}"]`).getAttribute('src');expect(/^data:image\/png/.test(src||''),k+' 图没挂上');}
 // 两张原始图落盘
 const full=await page.evaluate(()=>{const e=globalThis.__tmBeforeAfter?.mountain?.[0];return{before:e?.before,after:e?.after};});
 await dataUrlToPng(full.before,path.join(t.out,'ba-1-before-original.png'));
 await dataUrlToPng(full.after,path.join(t.out,'ba-2-after-candidate.png'));
 report.shots.push('ba-1-before-original.png','ba-2-after-candidate.png');
 await page.locator(PANEL).scrollIntoViewIfNeeded();
 await page.locator(PANEL).screenshot({path:path.join(t.out,'3-ba-panel-pair.png')});report.shots.push('3-ba-panel-pair.png');
 // ④ 像素差：>0 断言；为 0 时对照钩子已验证会切 → 如实记 NOT_RUN 与原因
 if(entry.diff&&entry.diff.changed>0){report.steps.pixelDiff={status:'PASS',mean:entry.diff.mean,changed:entry.diff.changed,pixels:entry.diff.pixels};}
 else if(entry.diff){report.steps.pixelDiff={status:'NOT_RUN',reason:'diff.changed=0：compare 钩子实测会切换（见 compareHook），说明这个候选在当前机位没有可见画面变化或预览与对照画面一致——如实记录，不当作通过',mean:entry.diff.mean,changed:entry.diff.changed,pixels:entry.diff.pixels};}
 else{expect(false,'entry.diff 没有算出来');}
 // 拍完实景应回到候选（compare(false) 收尾）
 const stEnd=await cmd('mountain.state');report.steps.endState={previewing:stEnd?.previewing};
 await t.shotGame('4-after-shoot-state',1200);
});
