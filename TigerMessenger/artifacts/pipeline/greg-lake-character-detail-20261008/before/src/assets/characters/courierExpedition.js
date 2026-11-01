import * as T from 'three';
import {buildWastelandCourier} from './courierWasteland.js';
import {buildExpeditionHair} from './courierExpeditionHair.js';
import {buildExpeditionFace} from './courierExpeditionFace.js';
import {mergeStaticGroup} from '../../world/geometryMerge.js';

// Approved 2026-10-06 character sheet: exec-433d9e75. Keep the established
// articulated skeleton and sculpted face; replace the complete outfit.
export function buildExpeditionCourier(){
 const root=buildWastelandCourier({scale:1,revision:2}),u=root.userData;
 const {body,head,armL,armR,elbowL,elbowR,handL,handR,legL,legR,kneeL,kneeR,letter}=u;
 // Retain the animation pivots; replace all original visible meshes.
 root.traverse(o=>{if(o.isMesh)o.userData.removeForExpedition=true;});
 const remove=[];root.traverse(o=>{if(o.userData.removeForExpedition)remove.push(o);});for(const o of remove){o.removeFromParent();o.geometry.dispose();}
 const colors={suit:0x889da8,light:0xa5b5bb,shadow:0x536876,leather:0x493e35,edge:0x806b54,dark:0x30383e,metal:0x8d8879,skin:0xb99d83,hair:0x353632,grey:0xa8a79b,band:0x526f7d,paper:0xe8ddc2,seal:0x945344};
 const mats=Object.fromEntries(Object.entries(colors).map(([k,v])=>[k,new T.MeshStandardMaterial({name:'expedition-'+k,color:v,roughness:k==='metal'?.66:.91,metalness:k==='metal'?.3:0})]));
 const add=(p,g,k,pos=[0,0,0],scale)=>{const m=new T.Mesh(g,mats[k]);m.position.set(...pos);if(scale)m.scale.set(...scale);m.castShadow=m.receiveShadow=true;p.add(m);return m;};
 const ell=(p,pos,s,k)=>add(p,new T.SphereGeometry(1,16,12),k,pos,s);
 const box=(p,pos,s,k)=>add(p,new T.BoxGeometry(...s),k,pos);
 const rod=(p,a,b,r,k,r2=r)=>{const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av),m=add(p,new T.CylinderGeometry(r2,r,d.length(),10),k,av.add(bv).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m;};
 const panel=(p,pts,k)=>{const g=new T.BufferGeometry(),idx=[];for(let i=1;i<pts.length-1;i++)idx.push(0,i,i+1);g.setAttribute('position',new T.Float32BufferAttribute(pts.flat(),3));g.setIndex(idx);g.computeVertexNormals();mats[k].side=T.DoubleSide;return add(p,g,k);};
 const loft=(p,rows,k)=>{const pos=[],idx=[],n=20;for(const[y,rx,rz,cx=0,cz=0]of rows)for(let i=0;i<=n;i++){const a=i/n*Math.PI*2;pos.push(cx+Math.cos(a)*rx,y,cz+Math.sin(a)*rz);}for(let j=0;j<rows.length-1;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+1,c=a+n+1,d=c+1;idx.push(a,c,b,b,c,d);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return add(p,g,k);};
 const strap=(p,a,b,width=.027,k='leather')=>{const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av),m=box(p,av.add(bv).multiplyScalar(.5).toArray(),[width,d.length(),.015],k);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m;};
 const buckle=(p,pos,w=.034)=>{box(p,pos,[w,.031,.014],'metal');box(p,[pos[0],pos[1],pos[2]+.008],[w*.60,.017,.009],'leather');};
 const pouch=(p,pos,w=.078,h=.106,d=.048)=>{box(p,pos,[w,h,d],'leather');box(p,[pos[0],pos[1]+h*.3,pos[2]+d*.52],[w*1.05,h*.34,.013],'edge');buckle(p,[pos[0],pos[1]+.006,pos[2]+d*.7],w*.28);};
 // Athletic torso with sloping shoulders, fitted cloth rather than a square coat.
 loft(body,[[ -.13,.125,.085],[-.06,.148,.101],[.04,.127,.090],[.15,.141,.101],[.26,.213,.116],[.34,.210,.105],[.40,.130,.078],[.44,.063,.057]],'suit');
 // Thin folded chest armour, not spherical pectoral pieces.
 for(const s of[-1,1]){
  const outline=[[s*.012,.352,.105],[s*.145,.363,.081],[s*.195,.298,.061],[s*.164,.217,.086],[s*.058,.195,.114],[s*.012,.236,.119]];
  const center=[s*.085,.286,.128];
  for(let i=0;i<outline.length;i++)panel(body,[center,outline[i],outline[(i+1)%outline.length]],i<2?'light':'shadow');
  strap(body,[s*.019,.239,.123],[s*.155,.222,.099],.009,'dark');
 }
 for(let i=0;i<3;i++)panel(body,[[-.068,.181-i*.042,.101],[.068,.181-i*.042,.101],[.060,.148-i*.042,.105],[-.060,.148-i*.042,.105]],'suit');
 loft(body,[[.426,.064,.055],[.49,.058,.052]],'shadow');
 strap(body,[0,.42,.060],[0,.07,.111],.008,'dark');
 armL.position.set(.228,.33,0);armR.position.set(-.228,.33,0);
 for(const[arm,elbow,hand,leg,knee,s]of[[armL,elbowL,handL,legL,kneeL,1],[armR,elbowR,handR,legR,kneeR,-1]]){
  ell(arm,[0,-.033,0],[.075,.092,.078],'suit');
  loft(arm,[[-.265,.052,.051],[-.19,.060,.062],[-.09,.077,.076],[.012,.059,.060]],'suit');
  loft(arm,[[-.193,.062,.064],[-.155,.068,.069]],'dark');
  ell(elbow,[0,-.003,0],[.055,.055,.056],'shadow');
  loft(elbow,[[-.235,.039,.042],[-.15,.048,.049],[-.07,.063,.057],[.024,.052,.049]],'suit');
  ell(elbow,[0,-.095,.044],[.046,.087,.019],'light');
  loft(elbow,[[-.234,.045,.047],[-.209,.045,.047]],'dark');
  ell(hand,[0,-.026,.009],[.047,.064,.027],'dark');
  for(let i=0;i<4;i++){const x=-.027+i*.018;rod(hand,[x,-.048,.018],[x,-.100+(i===3?.016:0),.028],.009,'dark');box(hand,[x,-.047,.034],[.014,.016,.007],'metal');}
  rod(hand,[s*.038,-.010,.018],[s*.054,-.056,.034],.012,'dark');
  loft(leg,[[-.47,.062,.065],[-.36,.081,.078],[-.18,.092,.094],[-.02,.086,.097],[.045,.073,.084]],'suit');
  for(const y of[-.135,-.285])loft(leg,[[y-.018,.088,.088],[y+.009,.088,.088]],'dark');
  pouch(leg,[s*.060,-.195,.065],.078,.13,.035);
  // Cloth fills the actual pivot, including the rear and both sides when flexed.
  ell(knee,[0,0,0],[.062,.066,.064],'shadow');
  const pad=new T.Shape();pad.moveTo(-.037,.067);pad.lineTo(.037,.067);pad.lineTo(.052,.032);pad.lineTo(.043,-.048);pad.lineTo(.024,-.065);pad.lineTo(-.024,-.065);pad.lineTo(-.043,-.048);pad.lineTo(-.052,.032);pad.closePath();
  const padGeo=new T.ExtrudeGeometry(pad,{depth:.010,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.008,bevelThickness:.004});
  add(knee,padGeo,'shadow',[0,0,.057]);
  for(const y of[-.025,.003,.031])box(knee,[0,y,.073],[.066,.004,.003],'dark');
  knee.userData.surfaceRevision='closed-cloth-joint-flat-shield-2';
  loft(knee,[[-.38,.045,.050],[-.27,.071,.069],[-.14,.070,.070],[.026,.059,.058]],'suit');
  for(const y of[-.115,-.32])loft(knee,[[y-.019,.070,.070],[y,.070,.070]],'dark');
  loft(knee,[[-.468,.061,.072,0,.015],[-.365,.053,.058],[-.31,.050,.054]],'shadow');
  ell(knee,[0,-.46,.057],[.070,.052,.121],'shadow');
  ell(knee,[0,-.494,.062],[.067,.010,.108],'dark');
  ell(knee,[0,-.464,.129],[.069,.032,.055],'light');
  for(let i=0;i<4;i++)box(knee,[0,-.502,.006+i*.037],[.112,.006,.012],'shadow');
  for(let i=0;i<3;i++)strap(knee,[-.042,-.40-i*.021,.074],[.042,-.40-i*.021,.074],.008,'dark');
 }
 loft(body,[[.035,.136,.099],[.079,.137,.100]],'dark');buckle(body,[0,.056,.107],.052);
 // Waist-to-groin V harness lies on the garment, with rear hip straps.
 for(const s of[-1,1]){
  strap(body,[s*.137,.021,.073],[s*.080,-.070,.093],.027,'leather');
  strap(body,[s*.080,-.070,.093],[s*.009,-.133,.081],.027,'leather');
  strap(body,[s*.139,.021,-.070],[s*.085,-.093,-.081],.026,'leather');
  buckle(body,[s*.127,-.001,.092],.023);
 }
 panel(body,[[-.043,-.075,.093],[.043,-.075,.093],[.023,-.141,.077],[-.023,-.141,.077]],'shadow');
 for(const s of[-1,1]){pouch(body,[s*.094,.041,.124]);strap(body,[s*.135,.379,.093],[s*.110,.126,.115],.028,'dark');buckle(body,[s*.122,.273,.136]);}
 // Head: retain facial topology; replace hat with swept-back locks and band.
 buildExpeditionFace(head);
 buildExpeditionHair(head);
 // Forehead band and two separate flexible tails keep the head silhouette readable.
 loft(head,[[.155,.094,.088],[.185,.096,.086]],'band');
 box(head,[0,.17,.088],[.084,.025,.012],'band');
 const tails=[];for(let i=0;i<2;i++){const g=new T.Group();g.name='headband-tail-'+i;g.position.set(.065,.172,-.07);head.add(g);panel(g,[[0,.012,0],[.07,.007,-.09],[.12,.030-i*.06,-.17],[.18,.006-i*.075,-.25],[.14,-.010-i*.075,-.25],[.10,.008-i*.06,-.17],[.045,-.014,-.08],[0,-.015,0]],'band');tails.push(g);}
 // Brown leather satchel, cream letters, travel pack and rolled map.
 const bag=new T.Group();bag.name='expedition-postal-satchel';bag.position.set(.195,.105,-.105);bag.rotation.y=Math.PI/2;bag.scale.set(.9,.95,.68);bag.userData.placement='under-arm-side-carry';body.add(bag);
 box(bag,[0,0,0],[.245,.209,.106],'leather');box(bag,[0,.071,.062],[.26,.095,.021],'edge');
 for(const x of[-.073,.073]){strap(bag,[x,.102,.079],[x,-.090,.073],.023);buckle(bag,[x,-.015,.090]);}
 for(let i=0;i<3;i++){const e=box(bag,[-.055+i*.049,.131+i*.009,-.006],[.116,.099,.005],'paper');e.rotation.z=-.14+i*.13;rod(bag,[-.107+i*.049,.177+i*.009,0],[-.055+i*.049,.119+i*.009,.003],.0012,'edge');}
 strap(body,[-.144,.407,.093],[.170,.208,.094],.041);
 strap(body,[.170,.208,.094],[.215,.208,-.002],.041);
 buckle(body,[.039,.211,.145],.040);
 const pack=new T.Group();pack.name='expedition-travel-backpack';pack.position.set(0,.237,-.147);body.add(pack);
 box(pack,[0,0,0],[.263,.326,.116],'leather');ell(pack,[0,.14,0],[.132,.044,.063],'leather');
 box(pack,[0,.034,-.077],[.233,.142,.042],'edge');
 for(const x of[-.085,.085]){strap(pack,[x,.16,-.069],[x,-.153,-.078],.025);buckle(pack,[x,-.019,-.103]);}
 for(const s of[-1,1]){pouch(pack,[s*.162,-.04,0],.064,.151,.081);strap(body,[s*.12,.39,-.067],[s*.125,.053,-.095],.035);}
 rod(pack,[.189,-.127,-.03],[.189,.173,-.03],.030,'paper');rod(pack,[.189,.176,-.03],[.189,.178,-.03],.019,'edge');
 for(const y of[-.07,.10])loft(pack,[[y,.034,.034,.189,-.03],[y+.017,.034,.034,.189,-.03]],'leather');
 box(letter,[0,0,0],[.14,.105,.007],'paper');rod(letter,[-.069,.052,.006],[0,-.005,.006],.0015,'edge');rod(letter,[.069,.052,.006],[0,-.005,.006],.0015,'edge');ell(letter,[0,-.010,.007],[.014,.014,.003],'seal');letter.visible=false;
 // Broad, subtle cloth planes and rubbed leather, baked vertex colours: no texture downloads.
 root.traverse(o=>{if(!o.isMesh||!o.material?.name?.startsWith('expedition-'))return;const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone(),p=g.attributes.position,c=[];const leather=/leather|edge/.test(o.material.name);for(let i=0;i<p.count;i+=3){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),noise=Math.sin(x*193.7+y*317.9+z*81.3)*43758.5453,f=noise-Math.floor(noise),v=leather?.90+f*.19:.97+f*.06;for(let j=0;j<3;j++)c.push(v,v,v);}g.setAttribute('color',new T.Float32BufferAttribute(c,3));o.geometry.dispose();o.geometry=g;o.material.vertexColors=true;});
 // Draw-call batching stays within each moving joint, never across animation pivots.
 for(const p of[body,head,armL,armR,elbowL,elbowR,handL,handR,legL,legR,kneeL,kneeR,letter,bag,pack]){const b=new T.Group();b.name='expedition-surface-'+p.name;p.add(b);for(const child of [...p.children])if(child.isMesh)b.attach(child);mergeStaticGroup(b);}
 Object.assign(root.userData,{runtimeModel:'expedition-courier-1',wastelandCourier:false,expeditionCourier:true,headbandTails:tails,target:'exec-433d9e75',source:'courierExpedition.js',palette:colors,bodyBaseY:.99});return root;
}
