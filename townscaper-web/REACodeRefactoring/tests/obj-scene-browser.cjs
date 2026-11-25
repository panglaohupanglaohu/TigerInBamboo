const{chromium}=require('playwright'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});const reports=[],errors=[];try{for(const grid of ['mixed','quad']){const p=await b.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));await p.goto(`http://localhost:8769/index.html?scene=town&grid=${grid}`);await p.waitForFunction(()=>window.rea?.view.worldMesh.geometry.attributes.color?.count&&rea.view.water);await p.waitForTimeout(1500);
const expect=await p.evaluate(()=>{
 const wm=rea.view.worldMesh.geometry,pos=wm.attributes.position,index=wm.getIndex();
 const src=[];for(let t=0;t<(index?index.count:pos.count);t++)src.push(...pos.array.slice((index?index.getX(t):t)*3,(index?index.getX(t):t)*3+3));
 const veg=rea.view.vegetation,spec=[['grass',veg.tufts],['flowers',veg.flowers],['shrubs',veg.shrubs],['wallshrubs',veg.wallCards],['trunks',veg.trunks],...veg.crowns.map((c,i)=>[`crown${i}`,c.m])];
 const vegParts=spec.filter(([,m])=>m&&m.count>0&&m.visible!==false).map(([name,m])=>{const g=m.geometry;return{name,count:m.count,tris:(g.getIndex()?.count ?? g.getAttribute('position').count)/3};});
 const sh=rea.view.waterUniforms.uShallow.value,de=rea.view.waterUniforms.uDeep.value;
 return{townFaces:(index?index.count:pos.count)/3,src,waterY:rea.view.water.geometry.attributes.position.array[1],waterTris:(rea.view.water.geometry.getIndex()?.count ?? rea.view.water.geometry.attributes.position.count)/3,vegParts,waterKd:[de.r+(sh.r-de.r)*.55,de.g+(sh.g-de.g)*.55,de.b+(sh.b-de.b)*.55]};});
const dls=[];p.on('download',d=>dls.push(d));await p.click('#exportscene');await p.waitForFunction(()=>false,{timeout:4000}).catch(()=>{});
const files={};fs.mkdirSync(`artifacts/coverage/scene-pair-${grid}`,{recursive:true});
for(const d of dls){const n=d.suggestedFilename(),ext=n.split('.').pop(),path=`artifacts/coverage/scene-${grid}.${ext}`;await d.saveAs(path);await d.saveAs(`artifacts/coverage/scene-pair-${grid}/${n}`);files[ext]={path,name:n};}   // pair 目录保留原始同名 obj+mtl（mtllib 按原文件名引用）
assert.ok(files.obj&&files.mtl,'expected one .obj and one .mtl download');
const text=fs.readFileSync(files.obj.path,'utf8');
assert.ok(text.includes(`mtllib ${files.mtl.name}`),'mtllib must reference the downloaded mtl name');
const v=[],vn=[],sections={};let cur=null;
for(const line of text.split('\n')){
 if(line.startsWith('v '))v.push(line.slice(2).trim().split(/\s+/).map(Number));
 else if(line.startsWith('vn '))vn.push(line.slice(3).trim().split(/\s+/).map(Number));
 else if(line.startsWith('o ')){cur=line.slice(2).trim();sections[cur]={usemtl:null,faces:[]};}
 else if(line.startsWith('usemtl '))sections[cur].usemtl=line.slice(7).trim();
 else if(line.startsWith('f '))sections[cur].faces.push(line.slice(2).trim().split(/\s+/).map(x=>x.split('//').map(Number)));
}
assert.ok(sections.town&&sections.water,'town and water groups required');
// 主体：逐面逐坐标与页面几何一致（索引展开后），面数相等
assert.equal(sections.town.faces.length,expect.townFaces);
for(let t=0;t<sections.town.faces.length;t++)for(let k=0;k<3;k++){const[i,j]=sections.town.faces[t][k];assert.ok(i>0&&i<=v.length&&j>0&&j<=vn.length);for(let a=0;a<3;a++)assert.equal(v[i-1][a],expect.src[t*9+k*3+a]);}
// 主体带顶点色；水面 2 个三角形、全部顶点 y=0 且法线朝上
assert.ok(v.slice(0,v.length).length>0);
const townColored=sections.town.faces.flat().every(([i])=>v[i-1].length===6);assert.ok(townColored,'town vertices keep RGB');
assert.equal(sections.water.faces.length,expect.waterTris);
for(const f of sections.water.faces)for(const[i,j]of f){assert.ok(Math.abs(v[i-1][1]-expect.waterY)<1e-9,'water verts on the y≈0 plane');assert.equal(v[i-1].length,3);assert.ok(j>0);}
// 植被：每组面数 = 实例数 × 单几何三角数，顶点带逐实例色
assert.ok(expect.vegParts.length>0,'town scene must have some vegetation');
for(const part of expect.vegParts){const s=sections[part.name];assert.ok(s,`missing veg group ${part.name}`);assert.equal(s.faces.length,part.count*part.tris,`${part.name} faces`);assert.ok(s.faces.flat().every(([i])=>v[i-1].length===6));}
// mtl：每个 usemtl 都有 newmtl，water Kd = 片元同一 0.55 混色
const mtl=fs.readFileSync(files.mtl.path,'utf8');
for(const s of Object.values(sections))assert.ok(s.usemtl&&mtl.includes(`newmtl ${s.usemtl}`),`material ${s.usemtl}`);
const wm=mtl.match(/newmtl water\nKd ([\d.]+) ([\d.]+) ([\d.]+)/);assert.ok(wm);for(let i=0;i<3;i++)assert.ok(Math.abs(+wm[i+1]-expect.waterKd[i])<1e-5,`water Kd ${i}`);
await p.screenshot({path:`artifacts/coverage/obj-scene-${grid}.png`});
reports.push({grid,townFaces:expect.townFaces,vertices:v.length,groups:Object.fromEntries(Object.entries(sections).map(([k,s])=>[k,s.faces.length])),vegParts:expect.vegParts.map(x=>x.count),bytes:Buffer.byteLength(text),obj:files.obj.path,mtl:files.mtl.path});await p.close();}
assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/coverage/obj-scene-browser.json',JSON.stringify({reports,errors},null,2));console.log('PASS scene OBJ+MTL real download',JSON.stringify(reports.map(r=>({grid:r.grid,groups:r.groups,bytes:r.bytes}))))}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
