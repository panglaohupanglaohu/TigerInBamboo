const {chromium}=require('../../../tools/e2e/node_modules/playwright-core');
const fs=require('fs');

(async()=>{
  const browser=await chromium.launch({
    executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless:true,
    args:['--use-angle=metal'],
  });
  try{
    const page=await browser.newPage();
    await page.goto('http://localhost:8931/TigerMessenger/?autostart=1');
    await page.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-west-city'),null,{timeout:180000});
    const report=await page.evaluate(async()=>{
      const T=await import('three');
      const {createFisherBoat}=await import('/TigerMessenger/src/assets/harbor.js');
      const {createWarshipWaterRoutes}=await import('/TigerMessenger/src/world/warshipWaterRoutes.js');
      const {createWarshipClearance}=await import('/TigerMessenger/src/world/warshipClearance.js');
      const {orientWarship}=await import('/TigerMessenger/src/world/warshipNavigation.js');
      const scene=window.__tm.scene,city=scene.getObjectByName('highland-west-city');
      const solver=createWarshipWaterRoutes(scene,160),boat=createFisherBoat();
      boat.scale.setScalar(1.7);
      const guard=createWarshipClearance(boat,solver.obstacles);
      const heading=new T.Vector3(0,0,-1).transformDirection(city.matrixWorld);
      const lanes=[];
      for(let x=20;x<=34;x+=.5){
        let clearFrom=50,firstFailure=null,checks=0;
        for(let z=50;z>=-12;z-=.25){
          const world=city.localToWorld(new T.Vector3(x,-5,z)),direction=world.normalize();
          const position=solver.position(direction);
          if(!position){firstFailure={z,reason:'no-water'};break;}
          orientWarship(boat,direction,heading);
          const hit=guard.clear(position,boat.quaternion,boat.scale);checks++;
          if(!hit.clear){firstFailure={z,reason:'mesh',mesh:hit.mesh,point:hit.point};break;}
          clearFrom=z;
        }
        lanes.push({x,clearToZ:clearFrom,firstFailure,checks});
      }
      return {lanes,best:lanes.slice().sort((a,b)=>a.clearToZ-b.clearToZ)[0],stats:solver.stats,scope:'Original vessel, fixed channel heading, 0.25m samples; no turns, global route, rowing animation or troop boarding'};
    });
    fs.writeFileSync('TigerMessenger/artifacts/pipeline/citadel-plaza-horse/harbor-channel-profile.json',JSON.stringify(report,null,2));
    console.log(report.best);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
