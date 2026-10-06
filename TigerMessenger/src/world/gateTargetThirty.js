import {seaStackTerracesEnabled} from './seaStackTerraces.js';
import {seaStackWfcEnabled,standSeaStackOnOcean,gateSeaStacksEnabled,seaStackGeometry,seaStackMaterial,addSeaStackFoot} from './gateSeaStacks.js';
import {mergeStaticGroup} from './geometryMerge.js';
import * as THREE from 'three';
import {MOEBIUS_PALETTE as P} from './moebiusPalette.js';
export const GATE_THIRTY_RELEASE=30;
export const GATE_THIRTY_STEPS=['东岸退为远岸','西岸退出门旁水域','压低近岸山脊','东侧远山组','西侧远山组','后景叠嶂','远岸水晶主塔','远岸伴塔','山间阶梯露台','远山植被','消除水面短划线','开阔水域色层','水面双向微波','桥墩水线涟漪','柔和桥影','桥墩基座收边','承重柱柱头','下拱廊金属镶边','檐口双层线脚','上拱廊实体边带','机械圆盘外壳','竖向传动杆','植物舱环箍','植物舱竖向窗棂','植物舱底部花槽','步道石板接缝','观景侧廊托架','步道灯座','顶部橙金针塔','平台栏杆细部'];
export function gateThirtyRound(){return Math.max(0,Math.min(30,Number(new URLSearchParams(location.search).get('gateThirty')??GATE_THIRTY_RELEASE)||0));}
export function installGateTargetThirty(gate){
 const n=gateThirtyRound();if(!n)return;
 const seat=gate.userData.seatRoot,site=seat.userData.siteRoot,root=seat.userData.moebiusV10;
 if(root.userData.thirtyRound)return;root.userData.thirtyRound=n;
 const bronze=new THREE.MeshBasicMaterial({color:P.brass}),stone=new THREE.MeshBasicMaterial({color:P.blue}),cream=new THREE.MeshBasicMaterial({color:P.cream}),ink=new THREE.LineBasicMaterial({color:P.ink,transparent:true,opacity:.45});
 const add=(g,m,name,x,y,z,parent=root)=>{const o=new THREE.Mesh(g,m);o.name='g30-'+name;o.position.set(x,y,z);parent.add(o);return o;};
 const box=(w,h,d,m,name,x,y,z,parent)=>add(new THREE.BoxGeometry(w,h,d),m,name,x,y,z,parent);
 const ring=(r,t,m,name,x,y,z,side=false)=>{const o=add(new THREE.TorusGeometry(r,t,6,40),m,name,x,y,z);if(side)o.rotation.y=Math.PI/2;return o;};
 // Lower only non-route shoulders; keep the original approach surface and pier bed.
 for(const mesh of site.children.filter(o=>o.name.startsWith('canyon-shoulder'))){
  const p=mesh.geometry.attributes.position;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),z=p.getZ(i),y=p.getY(i),route=x< -16&&z> -46&&z< -10;
   if(n>=4&&route)p.setY(i,Math.min(y,-5));
   const east=n>=1&&x>10,west=n>=2&&x< -10&&!route;
   if(east||west){const f=1-THREE.MathUtils.smoothstep(Math.abs(x),n>=3?60:43,n>=3?80:65);p.setY(i,THREE.MathUtils.lerp(y,Math.min(y,-28),f));}
  }p.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
 }
 if(n>=4)for(const pier of root.children.filter(o=>o.name==='v8-meeting-terrace-pier')){pier.geometry=new THREE.CylinderGeometry(.65,1.05,31.15,8);pier.position.y=-12.425+(root.userData.meetingShift?.[1]||0);pier.userData.reseatedAfterBankRetreat=true;}
 // Remove planting whose original bank has become submerged; retain its source objects.
 if(n>=2){const old=site.getObjectByName('gate-dressing-landscape');if(old)old.visible=false;}
 if(n>=1)for(const o of site.children)if(/^gate-bank-rooted/.test(o.name)&&o.position.x>10)o.visible=false;
 if(n>=2)for(const o of site.children)if(/^gate-bank-rooted/.test(o.name)&&o.position.x< -10)o.visible=false;
 const ridge=new THREE.Group();ridge.name='g30-distant-ridges';site.add(ridge);
 site.updateWorldMatrix(true,true);const sphereCenter=site.worldToLocal(new THREE.Vector3());
 const seaY=(x,z)=>sphereCenter.y+Math.sqrt(Math.max(100,160*160-(x-sphereCenter.x)**2-(z-sphereCenter.z)**2));
 const peaks=[];
 const mountains=(side,back=false)=>{for(let i=0;i<7;i++){
  const x=back?-60+i*20:side*(85+(i%3)*8),z=back?93+(i%2)*8+(gateSeaStacksEnabled()?18:0):- 60+i*20;
  const h=28+(i*13%28),r=12+(i%3)*4,base=seaY(x,z)-6;
  if(gateSeaStacksEnabled()){const geo=seaStackGeometry(r*.68,h,i+(back?20:side>0?0:10)),rock=add(geo,seaStackMaterial(h),'far-mountain',x,base+h/2,z,ridge);rock.rotation.y=i*.63;rock.userData.seaStack={height:h,radius:r*.68,base};if(seaStackWfcEnabled()||seaStackTerracesEnabled())standSeaStackOnOcean(rock,site,x,z,h,seaY,i*.63);const detailStart=ridge.children.length;addSeaStackFoot(ridge,x,z,r*.68,i,seaY);rock.userData.seaStack.detailId=`${side}-${back}-${i}`;for(const detail of ridge.children.slice(detailStart))detail.userData.stackOwner=rock.userData.seaStack.detailId;peaks.push({x,y:base+h,z,i});continue;}
  const geo=new THREE.CylinderGeometry(r*.18,r,h,7,6);const a=geo.attributes.position;
  for(let k=0;k<a.count;k++){const y=a.getY(k);const t=(y+h/2)/h; const fac=.86+.14*Math.sin(Math.floor(t*5)*1.9+i);a.setX(k,a.getX(k)*fac+Math.sin(t*5+i)*r*.18);a.setZ(k,a.getZ(k)*fac);}geo.computeVertexNormals();
  const normals=geo.attributes.normal,colors=[];for(let v=0;v<normals.count;v++){const c=new THREE.Color(back?0x789cbd:0x567fa4).multiplyScalar(.82+.18*Math.abs(normals.getY(v))+.12*normals.getX(v));colors.push(c.r,c.g,c.b);}geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));const m=new THREE.MeshBasicMaterial({vertexColors:true});
  const rock=add(geo,m,'far-mountain',x,base+h/2,z,ridge);rock.rotation.y=i*.63;peaks.push({x,y:base+h,z,i});
 }};
 if(n>=4)mountains(1);if(n>=5)mountains(-1);if(n>=6)mountains(1,true);
 const crystalMat=new THREE.MeshBasicMaterial({color:P.glass,transparent:true,opacity:.75,depthWrite:false});
 const crystal=(x,y,z,h,r)=>{const shape=new THREE.CylinderGeometry(r,r,h*.8,6);const shaft=add(shape,crystalMat,'far-crystal-shaft',x,y+h*.4,z,ridge);shaft.add(new THREE.LineSegments(new THREE.EdgesGeometry(shape,25),new THREE.LineBasicMaterial({color:0xc8f0f1,transparent:true,opacity:.7})));const tip=add(new THREE.ConeGeometry(r,h*.2,6),crystalMat,'far-crystal-tip',x,y+h*.9,z,ridge);tip.add(new THREE.LineSegments(new THREE.EdgesGeometry(tip.geometry,25),ink));};
 if(n>=7&&!gateSeaStacksEnabled())for(const p of peaks.filter((_,i)=>i%3===1))crystal(p.x,p.y-4,p.z,23,2.2);
 if(n>=8&&!gateSeaStacksEnabled())for(const p of peaks.filter((_,i)=>i%3===1))for(const s of[-1,1])crystal(p.x+s*4,p.y-7,p.z+2,13+s*2,1.25);
 if(n>=9&&!gateSeaStacksEnabled())for(const p of peaks.filter((_,i)=>i%3===1))for(let k=0;k<2;k++)add(new THREE.CylinderGeometry(4.4,4.6,.6,12),cream,'far-terrace',p.x,p.y+k*7,p.z,ridge);
 if(n>=10&&!gateSeaStacksEnabled()){
  const leaf=new THREE.MeshBasicMaterial({color:P.leaf}),ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0).transformDirection(site.matrixWorld);
  ridge.updateWorldMatrix(true,true);const rocks=ridge.children.filter(o=>o.name==='g30-far-mountain');
  for(const p of peaks)for(let k=0;k<5;k++){
   const a=k*2.4,origin=site.localToWorld(new THREE.Vector3(p.x+Math.cos(a)*5,p.y+12,p.z+Math.sin(a)*5));ray.set(origin,down);ray.far=80;
   const hit=ray.intersectObjects(rocks,false)[0];if(!hit)continue;const at=site.worldToLocal(hit.point.clone());
   add(new THREE.CylinderGeometry(.14,.22,1.4,5),bronze,'far-tree-trunk',at.x,at.y+.7,at.z,ridge);
   const tree=add(new THREE.IcosahedronGeometry(1.7,0),leaf,'far-plant',at.x,at.y+1.7,at.z,ridge);tree.scale.y=.65;
  }
 }

 const inlet=site.getObjectByName('gate-open-water-inlet');
 if(n>=11&&inlet){inlet.visible=false;let scene=site;while(scene.parent)scene=scene.parent;const ocean=scene.getObjectByName('planet-v8-curved-ocean');if(ocean){const m=ocean.material;
  m.uniforms.uG30Inverse={value:site.matrixWorld.clone().invert()};m.uniforms.uG30Time={value:0};
  m.vertexShader='varying vec3 vG30World;\n'+m.vertexShader;
  m.vertexShader=m.vertexShader.replace('gl_Position =','vG30World=(modelMatrix*vec4(p,1.)).xyz;gl_Position =');
  m.fragmentShader='varying vec3 vG30World;uniform mat4 uG30Inverse;uniform float uG30Time;\n'+m.fragmentShader;
  // Work on the existing curved ocean so there is no flat plane seam.
  m.fragmentShader=m.fragmentShader.replace(/gl_FragColor\s*=\s*vec4\(color,\s*alpha\);/,`{
   vec3 gp=(uG30Inverse*vec4(vG30World,1.)).xyz;
   float zone=(1.-smoothstep(90.,130.,abs(gp.x)))*(1.-smoothstep(105.,150.,abs(gp.z)))*smoothstep(-120.,-80.,gp.y);
   vec3 sea=vec3(.075,.30,.46);
   ${n>=12?'sea=mix(vec3(.06,.24,.40),vec3(.13,.40,.53),.5+.5*sin(gp.x*.025+gp.z*.011));':''}
   ${n>=13?'float waves=sin(gp.x*.47+gp.z*.24+uG30Time*.5)*sin(gp.z*.72-gp.x*.18-uG30Time*.36);sea+=vec3(.018,.032,.035)*pow(max(0.,waves),5.);':''}
   ${n>=14?'float ripple=0.;for(int k=0;k<4;k++){vec2 d=gp.xz-vec2(6.55,-23.76+float(k)*15.84);float r=length(d*vec2(1.,.7));ripple+=exp(-r*.5)*pow(.5+.5*sin(r*5.-uG30Time),10.);}sea+=ripple*vec3(.06,.10,.11);':''}
   ${n>=15?'sea*=1.-.13*exp(-abs(gp.x)*.15)*( .65+.35*cos(gp.z*.39));':''}
   color=mix(color,sea*mix(.48,1.,uNight),zone);
  } gl_FragColor = vec4(color, alpha);`);
  m.needsUpdate=true;root.onBeforeRender=()=>{};const before=ocean.onBeforeRender;ocean.onBeforeRender=function(...args){before?.apply(this,args);m.uniforms.uG30Time.value=performance.now()/1000;};
 }}
 const stations=[-23.76,-7.92,7.92,23.76];
 if(n>=16)for(const s of[-1,1])for(const z of stations)box(1.7,.55,1.65,stone,'pier-plinth',s*6.55,-11.3,z);
 if(n>=17)for(const s of[-1,1])for(const z of stations)box(1.7,.48,1.6,cream,'capital',s*6.55,-.65,z);
 if(n>=18)for(const s of[-1,1])for(const z of[-15.84,0,15.84]){const o=add(new THREE.TorusGeometry(7.1,.09,6,40,Math.PI),bronze,'lower-arch-rim',s*6.98,-12.5,z);o.rotation.y=Math.PI/2;}
 if(n>=19)for(const s of[-1,1])for(const y of[20.35,20.85])box(.18,.12,48.9,bronze,'cornice-step',s*7.03,y,0);
 if(n>=20)for(const s of[-1,1])for(const z of[-15.84,0,15.84]){const o=add(new THREE.TorusGeometry(7.48,.12,6,48,Math.PI),bronze,'upper-arch-band',s*7.05,11.44,z);o.rotation.y=Math.PI/2;o.scale.y=1.05;}
 if(n>=21)for(const s of[-1,1])for(const z of stations)ring(.82,.14,bronze,'mechanical-collar',s*7.35,20.475,z,true);
 if(n>=22)for(const s of[-1,1])for(const z of stations)for(const d of[-.45,.45])add(new THREE.CylinderGeometry(.065,.065,17,7),bronze,'drive-rod',s*7.05,9,z+d);
 if(n>=23)for(const s of[-1,1])for(const z of stations)for(const y of[3,7,11]){const o=ring(.48,.07,bronze,'pod-collar',s*6.65,y,z);o.rotation.x=Math.PI/2;}
 if(n>=24)for(const s of[-1,1])for(const z of stations)for(const d of[-.32,.32])box(.045,8,.045,bronze,'pod-mullion',s*6.85,7,z+d);
 if(n>=25)for(const s of[-1,1])for(const z of stations)add(new THREE.CylinderGeometry(.64,.48,.36,12),cream,'pod-planter',s*6.6,2.5,z);
 if(n>=26)for(const s of[-1,1])for(let z=-23;z<24;z+=1.7){const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(s*3.7,.012,z),new THREE.Vector3(s*6.3,.012,z)]);root.add(new THREE.Line(g,ink));}
 if(n>=27)for(const s of[-1,1])for(const z of stations){const b=box(.22,2.5,.28,bronze,'gallery-bracket',s*5.9,-1.3,z);b.rotation.z=s*.65;}
 if(n>=28)for(const s of[-1,1])for(const z of[-19,-11,-3,5,13,21]){add(new THREE.CylinderGeometry(.045,.085,1.8,6),bronze,'walk-lamp-post',s*6.24,.9,z);add(new THREE.SphereGeometry(.17,8,6),cream,'walk-lamp',s*6.24,1.87,z);}
 if(n>=29)for(const s of[-1,1])for(const z of stations){add(new THREE.ConeGeometry(.12,2.8,6),new THREE.MeshBasicMaterial({color:0xf6bc65}),'gold-needle',s*6.55,23,z);}
 if(n>=30)for(let z=-24;z< -15.5;z+=.65)box(.06,.75,.06,bronze,'platform-baluster',-29.55+(root.userData.meetingShift?.[0]||0),3.95+(root.userData.meetingShift?.[1]||0),z+(root.userData.meetingShift?.[2]||0));
 root.userData.thirtyFeatures=GATE_THIRTY_STEPS.slice(0,n);
 root.updateWorldMatrix(true,true);const merged=mergeStaticGroup(root,{skip:o=>!o.name.startsWith('g30-')||o.material?.transparent,skipOutline:()=>true});for(const o of merged.surfaces)o.name='g30-static-ornaments';root.userData.thirtyBatchMeshes=merged.surfaces.length;
 site.updateWorldMatrix(true,true);
}
