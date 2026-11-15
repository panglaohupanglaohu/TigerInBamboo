/** Portable CLI consumer of the refactored capture + analysis Worker. Original sources stay read-only. */
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../../REA-agent/package.json',import.meta.url));
const {chromium}=require('playwright-core');
const files=process.argv.slice(2);if(!files.length)throw Error('Usage: node tools/measure.mjs /REA-agent/gifs/<id>.mp4 [...]');
const browser=await chromium.launch({executablePath:process.env.CHROME_BINARY||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
try{const page=await browser.newPage();await page.goto(process.env.MEASURE_PAGE||'http://localhost:8931/townscaper-web/REACodeRefactoring/tools/measure.html');for(const src of files){const metadata=await page.evaluate(src=>window.load(src),src);const metrics=await page.evaluate(()=>window.run());console.log(JSON.stringify({source:src,metadata,metrics}));}}finally{await browser.close();}
