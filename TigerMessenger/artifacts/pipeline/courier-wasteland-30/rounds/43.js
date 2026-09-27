import * as THREE from 'three';
import {COURIER_HEIGHT} from '../../core/characterScale.js';
import {mergeStaticGroup} from '../../world/geometryMerge.js';
// Approved 2026-09-27 荒途邮差. Original Codrops builder remains available.
export const COURIER_REVISION=30;
const palette={straw:0xa88951,hatBand:0x73392d,rust:0x774326,rustLight:0x925431,rustDark:0x482d23,cloth:0x555147,leather:0x493324,edge:0x685541,iron:0x343936,steel:0x60625c,brass:0x826139,skin:0xaa8060,skinShadow:0x74503c,paper:0xd8c8a5,lens:0x202a29,sole:0x272923};
function paintedTexture(hex,seed){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');let n=seed;const rand=()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};x.fillStyle='#'+hex.toString(16).padStart(6,'0');x.fillRect(0,0,256,256);for(let i=0;i<1400;i++){const light=rand()>.53;x.fillStyle=light?'rgba(221,192,149,.035)':'rgba(24,23,21,.055)';const a=rand()*256,b=rand()*256,w=3+rand()*17,h=3+rand()*14;x.save();x.translate(a,b);x.rotate(rand()*6.28);x.beginPath();x.moveTo(0,0);x.lineTo(w,-rand()*3);x.lineTo(w*.8,h);x.lineTo(-w*.2,h*.65);x.fill();x.restore();}for(let i=0;i<95;i++){x.strokeStyle='rgba(207,189,155,.32)';x.lineWidth=.4+rand();const a=rand()*256,b=rand()*256;x.beginPath();x.moveTo(a,b);x.lineTo(a+rand()*18,b+rand()*4);x.stroke();}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;}
export function buildWastelandCourier({scale=COURIER_HEIGHT/1.90,revision=COURIER_REVISION}={}){
 const root=new THREE.Group();root.name='Courier';const mats={};for(const[k,c]of Object.entries(palette))mats[k]=new THREE.MeshStandardMaterial({name:'courier-'+k,color:c,roughness:k==='lens'?.2:.84,metalness:['iron','steel','brass'].includes(k)?.5:0});
 const joint=(p,n,x,y,z)=>{const g=new THREE.Group();g.name=n;g.position.set(x,y,z);p.add(g);return g;};
 const body=joint(root,'body',0,.99,0),head=joint(body,'head',0,.54,0),cape=joint(body,'cape',0,.32,-.1),legL=joint(root,'legL',.105,.99,0),legR=joint(root,'legR',-.105,.99,0),kneeL=joint(legL,'kneeL',0,-.47,0),kneeR=joint(legR,'kneeR',0,-.47,0),armL=joint(body,'armL',.205,.325,0),armR=joint(body,'armR',-.205,.325,0),elbowL=joint(armL,'elbowL',.025,-.255,0),elbowR=joint(armR,'elbowR',-.025,-.255,0),handL=joint(elbowL,'handL',.025,-.24,.005),handR=joint(elbowR,'handR',-.025,-.24,.005),letter=joint(handR,'letter',0,-.09,.045);
 const add=(p,g,k,pos=[0,0,0],s)=>{const m=new THREE.Mesh(g,mats[k]);m.position.set(...pos);if(s)m.scale.set(...s);m.castShadow=m.receiveShadow=true;p.add(m);return m;};
 const box=(p,w,h,d,pos,k)=>add(p,new THREE.BoxGeometry(w,h,d),k,pos);
 const ell=(p,pos,s,k)=>add(p,new THREE.SphereGeometry(1,20,14),k,pos,s);
 const rod=(p,a,b,r,k,r2=r)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av);const m=add(p,new THREE.CylinderGeometry(r2,r,delta.length(),12),k,av.add(bv).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;};
 const plate=(p,pts,depth,pos,k)=>{const sh=new THREE.Shape();pts.forEach(([x,y],i)=>i?sh.lineTo(x,y):sh.moveTo(x,y));sh.closePath();const g=new THREE.ExtrudeGeometry(sh,{depth,bevelEnabled:true,bevelSegments:1,bevelSize:.005,bevelThickness:.005});g.translate(0,0,-depth/2);return add(p,g,k,pos);};
 const disc=(p,r,d,pos,k)=>{const m=add(p,new THREE.CylinderGeometry(r,r,d,24),k,pos);m.rotation.x=Math.PI/2;return m;};
 const ring=(p,r,t,pos,k)=>add(p,new THREE.TorusGeometry(r,t,8,24),k,pos);
 const tube=(p,pts,r,k)=>add(p,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p))),20,r,6,false),k);
 const clothForm=(parent,levels,k,seed=0)=>{const positions=[],uv=[],indices=[],segments=16;for(let j=0;j<levels.length;j++){const[y,rx,rz,cx=0,cz=0]=levels[j];for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,wrinkle=1+.045*Math.sin((i%segments)*Math.PI*4/segments+j*1.3+seed);positions.push(cx+Math.cos(a)*rx*wrinkle,y,cz+Math.sin(a)*rz*wrinkle);uv.push(i/segments,j/(levels.length-1));}}for(let j=0;j<levels.length-1;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+1,c=a+segments+1,d=c+1;if(levels[j+1][0]>levels[j][0])indices.push(a,c,b,b,c,d);else indices.push(a,b,c,b,d,c);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return add(parent,g,k);};
 const stages=[];const step=(n,fn)=>{if(revision>=n){fn();stages.push(n);}};
 step(1,()=>{ell(body,[0,.22,0],[.166,.244,.102],'cloth');box(body,.28,.13,.19,[0,.015,0],'leather');for(const [leg,s]of[[legL,1],[legR,-1]])rod(leg,[0,-.01,0],[s*.014,-.43,0],.073,'cloth',.095);});
 step(2,()=>{
  rod(head,[0,-.075,0],[0,.045,0],.048,'skinShadow');
  // Continuous sculpted face: front profile and jaw are authored together,
  // avoiding a separate block nose or the rippled cloth loft used before.
  const contours=[
   [.016,.034,.025,.067],[.025,.048,.039,.078],[.040,.061,.050,.083],
   [.051,.069,.058,.084],[.058,.073,.061,.083],[.069,.080,.066,.080],
   [.079,.084,.070,.080],[.086,.086,.073,.082],[.099,.089,.076,.083],
   [.113,.091,.078,.084],[.128,.089,.079,.082],[.141,.090,.081,.088],
   [.157,.092,.082,.089],[.18,.090,.080,.085],[.21,.077,.068,.071],[.239,.048,.042,.039]
  ];
  const noseProfile=[[.016,0],[.058,0],[.069,.007],[.079,.036],[.086,.044],[.099,.035],[.113,.024],[.128,.014],[.141,.003],[.239,0]];
  const noseAt=y=>{for(let i=1;i<noseProfile.length;i++)if(y<=noseProfile[i][0]){const a=noseProfile[i-1],b=noseProfile[i];return THREE.MathUtils.lerp(a[1],b[1],(y-a[0])/(b[0]-a[0]));}return 0;};
  const vertices=[],uvs=[],indices=[],segments=48;
  for(let j=0;j<contours.length;j++){const[y,width,back,front]=contours[j];for(let i=0;i<=segments;i++){
   const angle=i/segments*Math.PI*2,x=Math.sin(angle)*width,c=Math.cos(angle);
   const nasal=c>0?noseAt(y)*Math.exp(-Math.pow(x/.016,2)*1.3)*Math.pow(c,6):0;
   const cheek=c>0?.0035*Math.exp(-Math.pow((y-.102)/.023,2))*Math.exp(-Math.pow((Math.abs(x)-.051)/.020,2)):0;
   const recess=c>0?-.004*Math.exp(-Math.pow((y-.127)/.011,2))*Math.exp(-Math.pow((Math.abs(x)-.036)/.019,2)):0;
   vertices.push(x,y,c*(c>=0?front:back)+nasal+cheek+recess);uvs.push(i/segments,j/(contours.length-1));
  }}
  for(let j=0;j<contours.length-1;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+1,c=a+segments+1,d=c+1;indices.push(a,b,c,b,d,c);}
  const faceGeometry=new THREE.BufferGeometry();faceGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));faceGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));faceGeometry.setIndex(indices);faceGeometry.computeVertexNormals();add(head,faceGeometry,'skin').name='courier-reference-face';
  for(const side of[-1,1]){
   // Recessed, narrow eyes and shaped brows; no protruding white eyeballs.
   ell(head,[side*.035,.126,.074],[.017,.0045,.0035],'paper');ell(head,[side*.034,.126,.078],[.005,.0044,.0015],'lens');
   tube(head,[[side*.018,.128,.081],[side*.034,.132,.078],[side*.052,.128,.067]],.0022,'skinShadow');
   tube(head,[[side*.019,.143,.087],[side*.036,.147,.082],[side*.057,.143,.069]],.0025,'leather');
   ell(head,[side*.092,.11,-.003],[.010,.023,.012],'skin');
   ell(head,[side*.012,.076,.094],[.004,.002,.003],'skinShadow');
  }
  tube(head,[[-.022,.050,.080],[-.009,.052,.085],[0,.050,.086],[.010,.052,.085],[.023,.050,.080]],.0017,'skinShadow');
  ell(head,[0,.045,.083],[.019,.003,.002],'skin');
 });
 const hat=joint(head,'courier-hat',0,-.017,0);
 step(3,()=>{
  const crown=add(hat,new THREE.SphereGeometry(1,48,24,0,Math.PI*2,0,Math.PI/2),'straw',[0,.15,0],[.134,.124,.119]);crown.name='straw-rounded-crown';
  const bandGeo=new THREE.CylinderGeometry(.133,.134,.025,48,1,true);const band=add(hat,bandGeo,'hatBand',[0,.170,0],[1,1,.888]);
 });
 step(4,()=>{
  const pos=[],uv=[],ids=[],segments=64,rows=6;
  for(let j=0;j<=rows;j++)for(let i=0;i<=segments;i++){
   const a=i/segments*Math.PI*2,t=j/rows,rx=.125+.099*t,rz=.109+.090*t;
   const y=.151-.017*t+.013*Math.cos(a*2+.5)*t*t;
   pos.push(Math.cos(a)*rx,y,Math.sin(a)*rz);uv.push(i/segments,t);
  }
  for(let j=0;j<rows;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+1,c=a+segments+1,d=c+1;ids.push(a,c,b,b,c,d);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(ids);geo.computeVertexNormals();
  const fabric=mats.straw.clone();fabric.side=THREE.DoubleSide;const brim=new THREE.Mesh(geo,fabric);brim.castShadow=brim.receiveShadow=true;hat.add(brim);
  const edge=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;edge.push([Math.cos(a)*.224,.134+.013*Math.cos(a*2+.5),Math.sin(a)*.199]);}tube(hat,edge,.002,'straw');
 });
 step(5,()=>{
  for(const side of[-1,1]){const g=joint(hat,'goggle-'+side,side*.061,.213,.115);g.rotation.y=side*.12;g.scale.set(.80,.76,.8);disc(g,.059,.024,[0,0,0],'iron');ring(g,.052,.0035,[0,0,.016],'steel');disc(g,.043,.006,[0,0,.017],'lens');ell(g,[-.011,.013,.022],[.010,.005,.0015],'steel');}
  rod(hat,[-.020,.220,.135],[.020,.220,.135],.006,'leather');
  const band=[];for(let i=0;i<=40;i++){const a=i/40*Math.PI*2;band.push([Math.cos(a)*.126,.210,Math.sin(a)*.112]);}tube(hat,band,.006,'leather');
 });
 // Thin, folded cloth surfaces, never extruded armor slabs.
 const fabricPanel=(parent,points,key,name)=>{const geo=new THREE.BufferGeometry(),idx=[];for(let i=1;i<points.length-1;i++)idx.push(0,i,i+1);geo.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));geo.setIndex(idx);geo.computeVertexNormals();const m=new THREE.Mesh(geo,mats[key]);m.material.side=THREE.DoubleSide;m.name=name;parent.add(m);return m;};
 step(6,()=>{
  for(const side of[-1,1]){
   fabricPanel(body,[[side*.058,.466,-.027],[side*.106,.432,-.06],[side*.125,.396,.068],[side*.078,.417,.112],[side*.056,.451,.055]],'rustDark','jacket-folded-collar');
   fabricPanel(body,[[side*.061,.442,.076],[side*.143,.378,.093],[side*.106,.339,.135],[side*.047,.211,.143],[side*.042,.323,.142],[side*.077,.377,.125]],'rustLight','jacket-notched-lapel');
   tube(body,[[side*.141,.377,.095],[side*.105,.338,.137],[side*.046,.212,.145]],.0014,'rustDark');
  }
 });
 step(7,()=>{
  // One small shoulder guard drapes over a sloping shoulder, no second pauldron.
  const guard=ell(armL,[.008,-.012,0],[.087,.052,.080],'steel');guard.rotation.z=-.32;guard.name='single-shoulder-guard';
  fabricPanel(armL,[[.0,.020,.074],[.074,-.022,.057],[.074,-.080,.032],[.017,-.064,.073]],'steel','single-shoulder-guard-edge');
  for(const x of[-.035,.045])disc(armL,.004,.005,[x,-.012,.076],'brass');
 });
 step(8,()=>{for(const [arm,side]of[[armL,1],[armR,-1]]){
  ell(arm,[0,-.010,0],[.068,.060,.072],'rust');
  clothForm(arm,[[.018,.064,.064],[ -.04,.075,.074],[ -.13,.070,.069],[ -.20,.062,.060],[ -.27,.058,.056]],'rust',side);
  tube(arm,[[side*.048,-.071,.051],[side*.056,-.16,.039],[side*.040,-.239,.044]],.0016,'rustDark');
 }});
 step(9,()=>{
  clothForm(body,[[.005,.166,.112],[.09,.165,.112],[.19,.174,.119],[.28,.185,.12],[.33,.190,.111],[.38,.151,.094],[.44,.086,.066]],'rust',4).name='soft-jacket-body';
  // Open V reveals a plain undershirt between the two lapels.
  fabricPanel(body,[[-.052,.423,.085],[.052,.423,.085],[.038,.30,.128],[0,.224,.145],[-.038,.30,.128]],'cloth','jacket-shirt-opening');
  tube(body,[[.012,.214,.146],[.011,.12,.117],[.012,.013,.115]],.002,'rustDark');
  for(const y of[.17,.115,.054])disc(body,.005,.003,[.018,y,.123],'brass');
 });
 step(10,()=>{for(const side of[-1,1]){
  tube(body,[[side*.087,.428,-.055],[side*.149,.365,-.078],[side*.172,.22,-.057],[side*.151,.027,-.052]],.0015,'rustDark');
  fabricPanel(body,[[side*.067,.157,.114],[side*.139,.183,.073],[side*.143,.163,.073],[side*.072,.138,.117]],'rustDark','jacket-welt-pocket');
 }});
 step(11,()=>{
  const edge=[];for(let i=0;i<=48;i++){const a=i/48*Math.PI*2;edge.push([Math.cos(a)*.166,.008+Math.sin(a*3)*.004,Math.sin(a)*.113]);}tube(body,edge,.002,'rustDark');
 });
 step(12,()=>{for(const [e,side]of[[elbowL,1],[elbowR,-1]]){
  ell(e,[0,0,0],[.057,.052,.057],'rust');
  clothForm(e,[[.025,.060,.058],[-.06,.059,.057],[-.14,.050,.048],[-.225,.044,.042]],'rust',side+3);
  clothForm(e,[[-.212,.047,.045],[-.237,.047,.045]],'rustDark',side);
 }});
 step(13,()=>{for(const [h,s]of[[handL,1],[handR,-1]]){ell(h,[0,-.025,.004],[.05,.065,.028],'leather');for(let i=0;i<4;i++){const x=-.027+i*.018;rod(h,[x,-.045,.012],[x,-.10+(i===3?.018:0),.026],.010,'iron');ell(h,[x,-.053,.027],[.013,.014,.009],'steel');rod(h,[x,-.093,.026],[x,-.10,.043],.010,'leather');}rod(h,[s*.04,-.012,.015],[s*.051,-.056,.041],.014,'leather');}});
 step(14,()=>{for(const [l,s]of[[legL,1],[legR,-1]]){plate(l,[[-.059,.14],[.063,.14],[.058,-.09],[.025,-.159],[-.019,-.121],[-.06,-.143]],.072,[s*.006,-.18,.036],'cloth');plate(l,[[-.058,.027],[.035,.033],[.049,-.051],[-.035,-.035]],.017,[s*.012,-.25,.086],'edge');}});
 step(15,()=>{for(const [k,s]of[[kneeL,1],[kneeR,-1]]){ell(k,[0,0,0],[.066,.068,.059],'iron');disc(k,.049,.02,[0,0,.058],'steel');disc(k,.025,.028,[0,0,.07],'iron');for(const x of[-.058,.058])disc(k,.03,.025,[x,0,0],'brass').rotation.y=Math.PI/2;}});
 step(16,()=>{for(const [k,s]of[[kneeL,1],[kneeR,-1]]){rod(k,[0,-.03,0],[0,-.37,.012],.025,'iron',.033);for(const y of[-.06,-.33]){disc(k,.018,.025,[s*.05,y,.01],'steel').rotation.y=Math.PI/2;}plate(k,[[-.024,.05],[.020,.043],[.024,-.073],[-.011,-.085]],.018,[s*.023,-.28,.055],'edge');rod(k,[s*.039,-.06,.015],[s*.044,-.31,.024],.012,'brass');rod(k,[s*.044,-.25,.024],[s*.044,-.39,.031],.008,'steel');plate(k,[[-.046,.12],[.037,.13],[.029,-.16],[-.021,-.18],[-.048,-.10]],.027,[-s*.014,-.19,.032],'cloth');tube(k,[[-s*.042,-.045,-.02],[-s*.069,-.19,-.026],[-s*.033,-.36,0]],.009,'iron');}});
 step(17,()=>{for(const k of[kneeL,kneeR]){ell(k,[0,-.382,.012],[.05,.075,.061],'leather');const sole=box(k,.139,.035,.237,[0,-.502,.052],'sole');sole.name='courier-sole';ell(k,[0,-.462,.059],[.073,.05,.125],'leather');const toe=plate(k,[[-.064,.01],[-.036,.033],[.04,.028],[.067,.006],[.056,-.025],[-.054,-.029]],.060,[0,-.458,.148],'edge');toe.rotation.x=-.18;for(let i=0;i<3;i++)rod(k,[-.04,-.40-i*.023,.065],[.04,-.40-i*.023,.065],.008,'edge');}});
 step(18,()=>{for(const z of[-.127,.144])box(body,.38,.046,.021,[0,.065,z],'leather');box(body,.069,.064,.026,[.015,.065,.167],'brass');box(body,.046,.039,.029,[.015,.065,.173],'iron');for(const s of[-1,1])box(body,.045,.061,.035,[s*.147,.065,.155],'edge');});
 const bag=joint(body,'postal-satchel',.29,-.045,.02);bag.rotation.set(.05,0,-.09);
 step(19,()=>{plate(bag,[[-.175,.15],[.168,.16],[.184,-.14],[.137,-.18],[-.152,-.17],[-.18,-.11]],.15,[0,0,0],'leather');ell(bag,[0,-.026,.076],[.165,.137,.028],'leather');for(const s of[-1,1])box(bag,.025,.255,.155,[s*.175,-.01,0],'rustDark');});
 step(20,()=>{plate(bag,[[-.182,.13],[.18,.131],[.175,-.023],[.139,-.058],[-.153,-.058],[-.18,-.01]],.018,[0,.005,.092],'leather');for(const s of[-1,1]){box(bag,.031,.225,.021,[s*.11,-.031,.116],'edge');box(bag,.046,.043,.025,[s*.11,-.046,.133],'brass');box(bag,.023,.023,.03,[s*.11,-.046,.145],'iron');}});
 step(21,()=>{for(const z of[.166,-.15]){const strap=box(body,.044,.64,.012,[.05,.233,z],'leather');strap.rotation.z=.758;}for(const [x,y]of[[-.07,.36],[.13,.13]]){const b=box(body,.056,.061,.026,[x,y,.159],'brass');b.rotation.z=-.75;const hole=box(body,.034,.04,.03,[x,y,.175],'leather');hole.rotation.z=-.75;}});
 step(22,()=>{for(let i=0;i<3;i++){const e=joint(bag,'stored-letter-'+i,-.083+i*.07,.135+i*.027,-.008);e.rotation.z=-.22+i*.2;box(e,.13,.092,.006,[0,0,0],'paper');rod(e,[-.065,.046,.004],[0,-.005,.005],.0015,'edge');rod(e,[0,-.005,.005],[.065,.046,.004],.0015,'edge');disc(e,.010,.003,[0,-.008,.006],'rustDark');}});
 step(23,()=>{const can=joint(body,'message-canister',-.225,.09,-.11);can.rotation.z=-.12;rod(can,[0,-.13,0],[0,.13,0],.033,'brass');for(const y of[-.13,-.07,.08,.13]){const m=add(can,new THREE.TorusGeometry(.034,.006,6,20),'iron',[0,y,0]);m.rotation.x=Math.PI/2;}box(can,.04,.15,.012,[0,0,.035],'edge');});
 step(24,()=>{disc(body,.072,.038,[-.072,.272,.183],'iron');ring(body,.062,.007,[-.072,.272,.207],'steel');disc(body,.048,.01,[-.072,.272,.212],'lens');rod(body,[-.073,.27,.22],[-.055,.30,.22],.0025,'brass');});
 step(25,()=>{tube(body,[[-.087,.205,.17],[-.18,.13,.175],[-.17,-.016,.15],[.028,-.023,.142]],.011,'iron');tube(body,[[.14,.36,-.145],[.205,.31,-.185],[.14,.12,-.18],[.04,.12,-.14]],.014,'iron');});
 step(26,()=>{for(const s of[-1,1])for(const y of[-.11,.065])disc(bag,.006,.006,[s*.153,y,.105],'brass');});
 step(27,()=>{for(const k of['straw','hatBand','rust','rustLight','rustDark','cloth','leather','edge','steel','iron','brass']){const m=mats[k];m.color.set(0xffffff);m.map=paintedTexture(palette[k],29+k.length*31);m.bumpMap=m.map;m.bumpScale=.0008;m.needsUpdate=true;}});
 step(28,()=>{for(let i=0;i<10;i++){const x=-.15+i*.033;rod(bag,[x,-.142,.083],[x+.008,-.139,.083],.0018,'edge');}});
 step(29,()=>{box(letter,.14,.105,.007,[0,0,0],'paper');rod(letter,[-.069,.051,.005],[0,-.005,.006],.0015,'edge');rod(letter,[0,-.005,.006],[.069,.051,.005],.0015,'edge');disc(letter,.016,.004,[0,-.009,.007],'rustDark');});
 step(30,()=>{for(const s of[-1,1]){const boot=s>0?kneeL:kneeR;for(let i=0;i<4;i++)box(boot,.139,.012,.023,[0,-.51,-.026+i*.047],'sole');}root.userData.groundSoles=true;});
 letter.visible=false;
 // Preserve animation, letter, looking and boarding contracts. Batch only inside joints.
 const joints={body,head,cape,legL,legR,kneeL,kneeR,armL,armR,elbowL,elbowR,handL,handR,letter};
 for(const j of [...Object.values(joints),bag,hat]){const bucket=new THREE.Group();bucket.name='surface-'+j.name;j.add(bucket);for(const child of [...j.children])if(child.isMesh)bucket.attach(child);mergeStaticGroup(bucket);}
 root.userData={...root.userData,isHumanCourier:true,wastelandCourier:true,bodyBaseY:.99,...joints,palette,revision,source:'courierWasteland.js · approved 荒途邮差',stages};root.scale.setScalar(scale);return root;
}
