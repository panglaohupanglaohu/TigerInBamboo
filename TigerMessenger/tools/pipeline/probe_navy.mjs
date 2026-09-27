import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{const p=await b.newPage();await p.goto('http://localhost:8931/TigerMessenger/?autostart=1',{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-west-city'),null,{timeout:240000});await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{const t=window.__tm,T=t.THREE;const c=t.scene.getObjectByName('castleContainer');c.updateMatrixWorld(true);const inv=c.matrixWorld.clone().invert();
const vis=o=>{while(o){if(!o.visible)return false;o=o.parent;}return true;};const navy=col=>{const h={};col.getHSL(h);return h.h>.5&&h.h<.7&&h.l<.45&&h.l>.12&&h.s>.12;};const out=[];
t.scene.traverse(o=>{if(!o.isMesh||!vis(o)||o.userData.isOutline)return;const box=new T.Box3().setFromObject(o);if(box.isEmpty())return;const lb=box.clone().applyMatrix4(inv);if(lb.max.x<-95||lb.min.x>-18||lb.max.z<-45||lb.min.z>28||lb.max.y<-2)return;
 const ms=Array.isArray(o.material)?o.material:[o.material];let score=0,why=[];
 for(const m of ms){if(m?.color&&navy(m.color)&&!m.map){score+=5;why.push('mat#'+m.color.getHexString());}}
 const vc=o.geometry.attributes.color;if(vc){let n=0,k=0;const cc=new T.Color();for(let i=0;i<vc.count;i+=7){cc.setRGB(vc.getX(i),vc.getY(i),vc.getZ(i));k++;if(navy(cc))n++;}if(n/k>.05){score+=n/k*10;why.push('vc'+(n/k).toFixed(2));}}
 if(score>0){const chain=[];let a=o;while(a&&chain.length<4){chain.push(a.name||'('+a.type+')');a=a.parent;}out.push({score:+score.toFixed(2),why,chain,type:o.type,verts:o.geometry.attributes.position.count,center:lb.getCenter(new T.Vector3()).toArray().map(Math.round)});}});
return out.sort((a,b)=>b.score-a.score).slice(0,15);});
r.forEach(x=>console.log(JSON.stringify(x)));}finally{await b.close();}
