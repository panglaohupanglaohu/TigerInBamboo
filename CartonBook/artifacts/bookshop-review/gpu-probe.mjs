import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
const b=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=metal','--ignore-gpu-blocklist','--disable-gpu-sandbox','--remote-debugging-port=19332']});
const p=await b.newPage();p.on('console',m=>console.log(m.type(),m.text().slice(0,300)));p.on('pageerror',e=>console.log('ERROR',e.message));
console.log(await p.evaluate(()=>{let g=document.createElement('canvas').getContext('webgl2');return {webgl:!!g,renderer:g?.getParameter(g.RENDERER)};}));
await b.close();
