// R54 端到端：建筑侧栏「多格 prefab 目录」——五种 prefab 的足迹图，每张图上一个门 socket；截图人要看。
// 运行：cd TigerMessenger && $NODE tests/building-prefab-browser.mjs
import {openBuilding,BW,AA,BS} from './lib/building-e2e.mjs';
const t=await openBuilding('building-prefab'),{report,expect,page}=t;
await t.finish(async()=>{
 report.steps.scan=await t.boot('citadel');
 const figs=await page.locator(BS+' .prefab-grid figure').evaluateAll(fs=>fs.map(f=>({id:f.querySelector('svg')?.dataset.prefab,cells:f.querySelectorAll('svg rect:not([data-socket])').length,doors:f.querySelectorAll('[data-socket=door]').length,label:f.textContent})));
 report.steps.figs=figs;expect(figs.length===5,'prefab 数 '+figs.length);
 for(const f of figs){expect(f.doors===1,f.id+' 门数 '+f.doors);t.cap('building.prefabs',{prefab:f.id,cells:f.cells,label:f.label});}
 expect(figs.some(f=>f.cells>=3)&&figs.some(f=>f.cells===4),'没有多格 prefab');
 await t.shotEl(BS+' .prefab-grid','R54-1-prefab-catalog');
});
