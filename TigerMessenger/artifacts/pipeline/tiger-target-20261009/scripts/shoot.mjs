import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const root=process.argv[2], kind=process.argv[3], out=process.argv[4], views=(process.argv[5]||'side,front').split(',');
const types={'.js':'text/javascript','.html':'text/html','.png':'image/png','.glb':'model/gltf-binary','.json':'application/json','.mjs':'text/javascript'};
const srv=http.createServer((q,r)=>{const p=path.join(root,decodeURIComponent(q.url.split('?')[0]));fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'content-type':types[path.extname(p)]||'application/octet-stream'});r.end(d);});}).listen(0);
const port=srv.address().port;
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const pg=await b.newPage();pg.on('console',m=>{if(m.type()==='error')console.log('ERR',m.text())});pg.on('pageerror',e=>console.log('PAGEERR',e.message));
for(const v of views){
 const [view,w,h]=v.split(':');
 await pg.goto(`http://localhost:${port}/lab/tiger-lab.html?w=${w||1140}&h=${h||450}`);await pg.waitForFunction('window.ready');
 await pg.evaluate(k=>window.loadTiger(k),kind);
 const url=await pg.evaluate(v=>window.shot(v),view);
 fs.writeFileSync(`${out}-${view}.png`,Buffer.from(url.split(',')[1],'base64'));console.log('wrote',view);
}
await b.close();srv.close();
