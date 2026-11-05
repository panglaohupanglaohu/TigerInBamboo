const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('fs');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});const reports=[],errors=[];try{for(const grid of ['mixed','quad']){const p=await b.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));await p.goto('http://localhost:8769/qa-replay.html');if(grid==='quad')await p.selectOption('#grid',grid);await p.waitForFunction(()=>window.qaReplay?.api.gridKind===document.querySelector('#grid').value);const r=await p.evaluate(async()=>{
const {api}=qaReplay,{world,view}=api,base=world.snapshot(),palette=world.palette;
const same=()=>['solid','rock','color','river'].every(k=>base[k].every((v,i)=>v===world[k][i]))&&world.palette===palette;
const result=await qaReplay.run();if(!same())throw Error('Successful replay changed snapshot');
const {runWorldQA}=await import('./src/core/qa-replay.js');let failureRestored=false;
try{await runWorldQA(api,{afterStep:()=>{throw Error('injected failure')}})}catch(e){if(e.message!=='injected failure')throw e;failureRestored=same();}
if(!failureRestored)throw Error('Failure restore failed');
// Fixed roof identity and wall palette edits, with bake disabled to isolate base colors.
const {BUILD}=await import('./src/core/palette.js');const build=JSON.stringify(BUILD),bake=view.worldMesh.bake;view.worldMesh.bake=false;view.worldMesh.invalidate();view.render(0);
const before=view.worldMesh.geometry.attributes.color.array.slice(),pos=view.worldMesh.geometry.attributes.position.array.slice();
api.setWallPalette(palette.colors.map((_,i)=>i%2?'#00ff00':'#ff00ff'));view.render(0);const after=view.worldMesh.geometry.attributes.color.array;let changed=0,unchanged=0;for(let i=0;i<after.length;i++)after[i]===before[i]?unchanged++:changed++;
if(!changed||!unchanged||JSON.stringify(BUILD)!==build||pos.some((v,i)=>v!==view.worldMesh.geometry.attributes.position.array[i]))throw Error('Wall-only edit identity/position invariant failed');
api.setWallPalette(palette.colors);world.palette=palette;view.worldMesh.bake=bake;view.worldMesh.invalidate();view.render(0);
return {grid:api.gridKind,steps:result.steps.length,maxDegenerate:Math.max(...result.steps.map(x=>x.degenerateTriangles)),successRestored:same(),failureRestored,changed,unchanged};});assert.equal(r.steps,16);assert.ok(r.successRestored&&r.failureRestored);await p.waitForTimeout(700);await p.screenshot({path:`artifacts/coverage/qa-replay-${grid}.png`});reports.push(r);await p.close();}assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/coverage/qa-replay-browser.json',JSON.stringify({reports,errors},null,2));console.log('PASS',reports)}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
