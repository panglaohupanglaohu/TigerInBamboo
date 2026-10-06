import {chromium} from '../../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage();
const results=[];
for(const url of ['https://x.com/OskSta/media','https://threadreaderapp.com/thread/1590669875869286400.html','https://threadreaderapp.com/thread/1670790425232175108.html']){
 try{
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
 await page.waitForTimeout(2000);
 const data=await page.evaluate(()=>({url:location.href,title:document.title,excerpt:document.body.innerText.slice(0,650),videos:[...document.querySelectorAll('video')].map(v=>({src:v.currentSrc||v.querySelector('source')?.src||v.src,poster:v.poster,ancestor:v.closest('[data-tweet-id]')?.getAttribute('data-tweet-id'),links:[...v.parentElement.parentElement.querySelectorAll('a[href]')].map(a=>a.href)})),threadLinks:[...document.querySelectorAll('a[href*="/thread/"]')].map(a=>a.href)}));
 results.push(data);console.log(JSON.stringify(data));
 }catch(e){results.push({url,error:String(e)});}
}
await writeFile(new URL('source-access.json',import.meta.url),JSON.stringify(results,null,2));
await browser.close();
