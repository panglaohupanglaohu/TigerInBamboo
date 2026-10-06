import{chromium}from'../../../../tools/shot/node_modules/playwright/index.mjs';
import{writeFile}from'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1360,height:980}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
try{
 const response=await page.goto('http://localhost:8931/TigerMessenger/artifacts/research/oskar-deep-20261004/review.html');
 await page.evaluate(async()=>{for(const image of document.images){image.loading='eager';await image.decode();}});
 const results=await page.evaluate(()=>({cards:document.querySelectorAll('article').length,images:[...document.images].map(i=>({src:i.getAttribute('src'),ready:i.complete&&i.naturalWidth>0})),localLinks:[...document.querySelectorAll('a')].map(a=>a.href).filter(u=>u.startsWith(location.origin))}));
 for(const url of results.localLinks){const r=await page.request.get(url);if(!r.ok())throw Error(url+' '+r.status());}
 await page.screenshot({path:new URL('review-check.png',import.meta.url).pathname});
 if(response.status()!==200||errors.length||results.cards!==12||results.images.some(i=>!i.ready))throw Error(JSON.stringify({status:response.status(),errors,results}));
 await writeFile(new URL('review-verification.json',import.meta.url),JSON.stringify({status:response.status(),cards:results.cards,images:results.images,localLinksChecked:results.localLinks.length,errors},null,2));console.log(JSON.stringify({status:response.status(),cards:results.cards,images:results.images.length,localLinksChecked:results.localLinks.length,errors}));
}finally{await browser.close();}
