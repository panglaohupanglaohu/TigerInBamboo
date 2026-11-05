const{chromium}=require('playwright');const fs=require('fs'),path=require('path');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[],reports=[],base=process.env.REA_TEST_URL||'http://localhost:8769',out=path.resolve(__dirname,'../artifacts/coverage');p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
for(const kind of ['quad','mixed']){
 await p.goto(base+'/index.html?scene=badnorth'+(kind==='mixed'?'&grid=mixed':''));await p.waitForFunction(()=>window.rea?.battle?.running,{timeout:60000});
 const normal=await p.evaluate(()=>{const b=rea.battle;return {units:b.units.length,resolved:b.units.filter(u=>b.navigation.unitNode(u)).length}});if(normal.resolved!==normal.units)throw Error('Spawn floor mismatch '+JSON.stringify(normal));
 await p.evaluate(()=>{const w=rea.world;w.reset();for(const c of w.cells){w.fill(c,1,{rock:true});if(Math.abs(c.cx)<1.4)w.setSolid(c,3,true,{rock:true})}rea.view.worldMesh.invalidate()});
 await p.waitForFunction(()=>rea.view.worldMesh.builtVersion===rea.world.version,{timeout:60000});await p.waitForTimeout(650);
 const result=await p.evaluate(()=>{
  const w=rea.world,b=rea.battle;b.start(w);b.nextWave=Infinity;
  const left=w.cells.reduce((a,c)=>Math.hypot(c.cx+3,c.cz)<Math.hypot(a.cx+3,a.cz)?c:a),right=w.cells.reduce((a,c)=>Math.hypot(c.cx-3,c.cz)<Math.hypot(a.cx-3,a.cz)?c:a);
  const sq=b.squads[0],u=sq.members[0];for(const other of b.squads.slice(1)){b.group.remove(other.flag,other.flag.userData.cloth)}b.squads=[sq];sq.members=[u];b.units=[u];b.houses=[];u.x=left.cx;u.z=left.cz;u.y=.5;u.navFloor=1;u.dead=false;u.fall=null;b.selected=sq;
  b.onPointer({cell:right,point:{x:right.cx,y:.5,z:right.cz}});
  const pathY=Array.from(b.path.geometry.attributes.position.array).filter((_,i)=>i%3===1);let tunnelSamples=0,maxY=0;
  for(let k=0;k<1000;k++){b.update(1/60);maxY=Math.max(maxY,u.y);if(Math.abs(u.x)<1.4&&w.top(rea.view.index.cellAt(u.x,u.z))===3&&u.navFloor===1)tunnelSamples++}
  b.paused=true;
  return {normal:null,start:left.id,goal:right.id,goalFloor:sq.goalFloor,clickedGoal:sq.goal===right,remaining:Math.hypot(u.x-right.cx,u.z-right.cz),floor:u.navFloor,maxY,tunnelSamples,pathMaxY:Math.max(...pathY),cacheGoals:b.navigation.trees.size};
 });result.normal=normal;reports.push({kind,...result});
 if(!result.clickedGoal||result.goalFloor!==1||result.floor!==1||result.maxY>.51||result.tunnelSamples<1||result.remaining>.4||result.pathMaxY>.56)throw Error('Tunnel battle failed '+JSON.stringify(result));
 await p.evaluate((r)=>{const el=document.createElement('div');el.style='position:fixed;left:16px;top:110px;z-index:50;background:#f7fbf4;padding:14px;font:14px system-ui;border-radius:10px';el.textContent='真实战斗穿洞验收：'+JSON.stringify(r);document.body.appendChild(el)},result);await p.screenshot({path:path.join(out,'battle-tunnel-'+kind+'.png')});
 const attacks=await p.evaluate(async()=>{
  const b=rea.battle,w=rea.world,u=b.units[0],bridge=w.cells.reduce((a,c)=>Math.abs(c.cx)+Math.abs(c.cz)<Math.abs(a.cx)+Math.abs(a.cz)?c:a);
  u.x=bridge.cx;u.z=bridge.cz;u.y=.5;u.navFloor=1;u.hp=3;u.cd=0;
  const enemy={...u,squad:null,team:1,y:1.5,navFloor:3,hp:3,cd:0};b.units=[u,enemy];b.paused=false;
  for(let k=0;k<10;k++)b.update(1/120);
  const meleeHP=[u.hp,enemy.hp];b.units=[u];
  const THREE=await import('/vendor/three.module.js'),mesh=new THREE.Mesh(b.arrowGeo,b.arrowMat);b.group.add(mesh);
  const duration=.4,vy=(.93+3*duration*duration)/duration,v=Math.hypot(1,vy);
  const arrow={mesh,from:[bridge.cx-.2,.65,bridge.cz],to:[bridge.cx+.2,1.58,bridge.cz],t:0,dur:duration,shot:{v,th:Math.atan2(vy,1)},target:enemy,stuck:false};b.arrows.push(arrow);
  for(let k=0;k<60;k++)b.update(1/120);b.paused=true;
  return {meleeHP,projectileStopped:arrow.stuck&&arrow.t<1,projectileT:arrow.t,targetHP:enemy.hp};
 });
 if(attacks.meleeHP.some(h=>h!==3)||!attacks.projectileStopped||attacks.targetHP!==3)throw Error('Stacked-floor attack failed '+JSON.stringify(attacks));reports.at(-1).attacks=attacks;
 const blocked=await p.evaluate(()=>{const b=rea.battle,w=rea.world,sq=b.squads[0],u=b.units[0],left=w.cells[b.navigation.graph.nodes.find(n=>n.cell.id===sq.goal.id)?.cell.id??0];const start=w.cells.find(c=>c.cx<-2.5&&Math.abs(c.cz)<.7);u.x=start.cx;u.z=start.cz;u.y=.5;u.navFloor=1;for(const c of w.cells)if(Math.abs(c.cx)<1.4)w.fill(c,6,{rock:true});b.paused=false;for(let i=0;i<120;i++)b.update(1/60);b.paused=true;return {distance:Math.hypot(u.x-start.cx,u.z-start.cz),height:u.y}});
 if(blocked.distance>.001||blocked.height>.51)throw Error('Closed tunnel causes movement/teleport '+JSON.stringify(blocked));reports.at(-1).closedTunnel=blocked;
}
for(const scene of ['town','terrain','fusion']){await p.goto(base+'/index.html?scene='+scene);await p.waitForFunction(()=>window.rea?.view,{timeout:60000});await p.waitForTimeout(800);await p.screenshot({path:path.join(out,'battle-navigation-regression-'+scene+'.png')})}
fs.writeFileSync(path.join(out,'battle-navigation-browser.json'),JSON.stringify({reports,errors},null,2));await b.close();if(errors.length)throw Error(errors.join('\n'));console.log('PASS actual Battle tunnel traversal and closure',reports);
})().catch(e=>{console.error(e);process.exit(1)});
