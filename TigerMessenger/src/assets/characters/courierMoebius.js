import * as T from 'three';
import {buildWastelandCourier} from './courierWasteland.js';
import {mergeStaticGroup} from '../../world/geometryMerge.js';

// Project-authored travelling messenger. Public line-and-colour methods inform
// this model; this is not a reproduction of Sable's private rendering code.
export const MESSENGER_PALETTE = Object.freeze({
  ivory:0xf1e8ce, ivoryShade:0xc7bdaf, sage:0x99bbaa, sageShade:0x6f9794,
  plum:0x777388, plumShade:0x57556b, coral:0xe9a18f, coralShade:0xc87e7a,
  ink:0x514b64, skin:0xcaa58e, skinShade:0xaa847c, hair:0x565360, hairLight:0x716c78,
  paper:0xf6eedb, leather:0x74604f, brass:0xcab17b, blue:0x6e8892, blueShade:0x526773, sole:0xd7c9ae,
});

export function buildMoebiusCourier(){
  // Revision zero supplies only the established, mesh-free articulated rig.
  const root=buildWastelandCourier({scale:1,revision:0}),u=root.userData;
  const {body,head,cape,armL,armR,elbowL,elbowR,handL,handR,legL,legR,kneeL,kneeR,letter}=u;
  const surface=new T.MeshBasicMaterial({name:'messenger-flat-colour',vertexColors:true});
  const ink=new T.MeshBasicMaterial({name:'messenger-fine-silhouette',color:MESSENGER_PALETTE.ink,side:T.BackSide});
  ink.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed += normalize(normal) * 0.00115;');};
  ink.customProgramCacheKey=()=> 'messenger-fine-silhouette-v1';
  const buckets=new Map();
  function bucket(parent){if(!buckets.has(parent)){const g=new T.Group();g.name='messenger-surface-'+parent.name;parent.add(g);buckets.set(parent,g);}return buckets.get(parent);}
  function add(parent,geometry,key,position=[0,0,0],scale=[1,1,1],shade=true){
    geometry.computeVertexNormals();const n=geometry.attributes.normal,colors=[];
    const light=new T.Color(MESSENGER_PALETTE[key]),dark=new T.Color(MESSENGER_PALETTE[key+'Shade']??MESSENGER_PALETTE[key]);
    for(let i=0;i<n.count;i++){const c=shade&&(n.getX(i)*.72+n.getZ(i)*.38+n.getY(i)*.45<-.24)?dark:light;colors.push(c.r,c.g,c.b);}
    geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    const mesh=new T.Mesh(geometry,surface);mesh.position.set(...position);mesh.scale.set(...scale);mesh.castShadow=mesh.receiveShadow=true;bucket(parent).add(mesh);return mesh;
  }
  const ell=(p,pos,s,k)=>add(p,new T.SphereGeometry(1,12,8),k,pos,s);
  const box=(p,pos,s,k)=>add(p,new T.BoxGeometry(...s),k,pos);
  function line(p,points,r=.0014,key='ink'){
    return add(p,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v))),Math.max(5,Math.min(18,points.length*3)),r,4,false),key,[0,0,0],[1,1,1],false);
  }
  function loft(p,rows,key,segments=20){
    const pos=[],index=[];
    for(const [y,rx,rz,cx=0,cz=0] of rows)for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2;pos.push(cx+Math.cos(a)*rx,y,cz+Math.sin(a)*rz);}
    for(let j=0;j<rows.length-1;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+1,c=a+segments+1,d=c+1;index.push(a,b,c,b,d,c);}
    // Rows run from high to low; end fans close the cloth volumes.
    for(const [row,up] of [[0,true],[rows.length-1,false]]){const [y,,,cx=0,cz=0]=rows[row],center=pos.length/3;pos.push(cx,y,cz);for(let i=0;i<segments;i++){const a=row*(segments+1)+i;index.push(center,...(up?[a+1,a]:[a,a+1]));}}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(index);return add(p,g,key);
  }
  // Wrapped tunic: no button-front uniform. The asymmetric skirt panels are
  // authored in thigh-local coordinates so seated legs never pierce a rigid hem.
  loft(body,[[.435,.073,.070],[.388,.177,.091],[.30,.169,.101],[.15,.153,.100],[.035,.144,.105],[-.05,.153,.11]],'ivory');
  line(body,[[.065,.40,.078],[.088,.30,.093],[.030,.18,.105],[-.109,.052,.086]],.0016);
  line(body,[[-.142,.17,.043],[-.115,.125,.075],[-.074,.13,.101]],.0011,'ivoryShade');
  loft(body,[[.058,.151,.112],[.035,.156,.116],[-.012,.16,.119],[-.04,.151,.112]],'blue');
  for(const y of [.003,.025])line(body,[[-.14,y,.06],[-.075,y-.008,.105],[0,y+.004,.12],[.08,y+.007,.105],[.143,y,.05]],.0013,'blueShade');
  function panel(p,points,key,depth=.005){const shape=new T.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();return add(p,new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:4}),key);}
  const skirtPanels=[];
  for(const [leg,side] of [[legL,1],[legR,-1]]){
    const hem=new T.Group();hem.name='reedbank-split-hem-'+(side>0?'L':'R');leg.add(hem);skirtPanels.push(hem);
    const mesh=panel(hem,[[-.085,.025],[.082,.023],[.09,side>0?-.185:-.245],[-.03,side>0?-.24:-.30],[-.08,-.19]],'ivory');mesh.position.z=.103;mesh.rotation.y=side*.15;
    line(hem,[[-.066,-.05,.114],[.006,-.10,.117],[.047,-.16,.108]],.001,'ivoryShade');
    const back=panel(hem,[[-.082,.026],[.082,.026],[.066,-.17],[-.074,-.22]],'ivory');back.position.z=-.095;back.rotation.y=Math.PI;
  }
  // Loose elbow-length sleeves with rolled cuffs; exposed forearms and cords.
  armL.position.set(.188,.342,0);armR.position.set(-.188,.342,0);
  for(const [arm,elbow,hand,side] of [[armL,elbowL,handL,1],[armR,elbowR,handR,-1]]){
    loft(arm,[[.055,.020,.025],[.032,.055,.053],[-.008,.073,.069],[-.09,.084,.077,side*.010],[-.175,.074,.067,side*.015],[-.235,.056,.054,side*.025]],'ivory');
    loft(elbow,[[.020,.053,.053],[-.052,.062,.058],[-.086,.050,.049]],'ivory');
    loft(elbow,[[-.052,.063,.061],[-.076,.065,.061],[-.093,.051,.05]],'ivoryShade');
    loft(elbow,[[-.086,.040,.041],[-.15,.033,.036,side*.012],[-.243,.027,.028,side*.025]],'skin');
    line(arm,[[side*.029,-.134,.072],[side*.052,-.171,.059],[side*.03,-.191,.062]],.0012,'ivoryShade');
    line(elbow,[[-.045,-.062,.044],[0,-.073,.062],[.05,-.062,.04]],.0012);
    for(let j=0;j<3;j++){
      const points=[];for(let n=0;n<=16;n++){const a=n/16*Math.PI*2;points.push([side*.021+Math.cos(a)*.031,-.205-j*.012+Math.sin(a)*.005,Math.sin(a)*.032]);}
      line(elbow,points,.0023,j===1?'coralShade':'leather');
    }
    ell(hand,[0,-.027,.005],[.029,.050,.020],'skin');ell(hand,[-side*.026,-.018,.017],[.013,.025,.012],'skin');
    for(const dx of[-.012,0,.012])line(hand,[[dx,-.029,.024],[dx,-.058,.021]],.00065,'skinShade');
  }
  for(const [leg,knee,side] of [[legL,kneeL,1],[legR,kneeR,-1]]){
    loft(leg,[[.027,.092,.096],[-.10,.117,.114,side*.017],[-.23,.121,.112,side*.022],[-.37,.093,.089,side*.014],[-.47,.076,.074]],'blue');
    loft(knee,[[.025,.075,.074],[-.07,.088,.087],[-.14,.077,.077],[-.205,.044,.049],[-.22,.036,.04]],'blue');
    loft(knee,[[-.20,.037,.041],[-.32,.032,.036],[-.378,.034,.039]],'blueShade');
    for(let j=0;j<4;j++)line(knee,[[-.027,-.228-j*.029,.023],[0,-.238-j*.029,.040],[.025,-.247-j*.029,.025]],.002,'plum');
    loft(knee,[[-.344,.046,.048],[-.381,.048,.052],[-.449,.049,.059,0,.018]],'leather');
    ell(knee,[0,-.454,.036],[.052,.056,.092],'leather');ell(knee,[0,-.473,.094],[.052,.030,.078],'leather');
    ell(knee,[0,-.495,.064],[.057,.021,.12],'sole');
    line(knee,[[-.046,-.487,.129],[0,-.487,.183],[.046,-.487,.129]],.0018,'leather');
    for(let j=0;j<3;j++)line(knee,[[-.027,-.407-j*.017,.060+j*.009],[.026,-.412-j*.017,.060+j*.009]],.002,'ivoryShade');
    line(leg,[[side*.063,-.16,.083],[side*.074,-.26,.07],[side*.04,-.34,.071]],.0012,'blueShade');
    line(knee,[[-.035,-.114,.064],[0,-.174,.063],[.025,-.194,.045]],.0012,'blueShade');
  }
  // Off-centre coral cowl; the tilted lip has a broad, readable diagonal opening.
  const cowl=loft(body,[[.49,.068,.063,-.012,-.008],[.448,.095,.092,-.006,.005],[.389,.106,.102,.018,.018],[.368,.073,.08,.027,.027]],'coral');cowl.rotation.z=.10;
  line(body,[[-.080,.443,.045],[-.019,.400,.111],[.056,.395,.109],[.104,.427,.026]],.0016,'coralShade');
  // A one-sided overlapping fan-petal cape; petals have real thickness.
  cape.position.set(-.02,.432,0);const petals=[];
  for(let k=0;k<6;k++){
    const center=-1.5+k*.56,half=.34,positions=[],indices=[],S=6,R=4;
    for(let layer=0;layer<2;layer++)for(let j=0;j<=R;j++)for(let i=0;i<=S;i++){
      const f=j/R,t=(i/S-.5)*2,a=center+t*half,r=(.347+.021*Math.cos(k))*f*(1-.10*t*t);
      positions.push(r*Math.cos(a),(-.282+.082*t*t)*f*f+.025*Math.sin(f*Math.PI)-(layer?.004:0),r*Math.sin(a)*.64);
    }
    const stride=(R+1)*(S+1);
    for(let j=0;j<R;j++)for(let i=0;i<S;i++){const a=j*(S+1)+i,b=a+1,c=a+S+1,d=c+1;indices.push(a,b,c,b,d,c,a+stride,c+stride,b+stride,b+stride,c+stride,d+stride);}
    for(let i=0;i<S;i++){const a=R*(S+1)+i,b=a+1;indices.push(a,b,a+stride,b,b+stride,a+stride);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);add(cape,g,'sage');
    const rim=[];for(let i=0;i<=S;i++){const t=(i/S-.5)*2,a=center+t*half,r=(.347+.021*Math.cos(k))*(1-.10*t*t);rim.push([r*Math.cos(a),-.282+.082*t*t+.001,r*Math.sin(a)*.64]);}line(cape,rim,.0016,'ivoryShade');
    const vein=[];for(let j=0;j<=R;j++){const f=j/R,r=(.347+.021*Math.cos(k))*f;vein.push([r*Math.cos(center),-.282*f*f+.025*Math.sin(f*Math.PI)+.002,r*Math.sin(center)*.64]);}line(cape,vein,.001,'sageShade');
    petals.push({angle:center});
  }
  // Leaf-pod waterproof mail pouch; no rectangular aviation bag or goggles.
  const satchel=new T.Group();satchel.name='reedbank-leaf-postal-pod';satchel.position.set(-.207,-.04,.008);satchel.rotation.z=-.19;satchel.rotation.y=-.30;body.add(satchel);
  ell(satchel,[0,0,-.015],[.099,.155,.034],'leather');
  const edge=[];for(let i=0;i<=24;i++){const a=i/24*Math.PI*2;edge.push([Math.sin(a)*.094,Math.cos(a)*.149,.010]);}line(satchel,edge,.003,'leather');
  // Real articulated leaf shells enclose the dry paper compartments. Hinge
  // groups stay out of static body merging and open away from the body.
  const podLeaves=[],mailSlots=[];
  for(const side of[-1,1]){
    const hinge=new T.Group();hinge.name='reedbank-pod-leaf-'+(side<0?'L':'R');hinge.position.x=side*.090;satchel.add(hinge);podLeaves.push(hinge);
    const pos=[],idx=[],LAT=10,ARC=7,layerSize=(LAT+1)*(ARC+1);
    for(let layer=0;layer<2;layer++)for(let j=0;j<=LAT;j++)for(let i=0;i<=ARC;i++){
      const lat=-Math.PI/2+j/LAT*Math.PI,a=i/ARC*Math.PI/2,c=Math.cos(lat);
      pos.push(side*(.091*c*Math.sin(a)-.090),.149*Math.sin(lat),.014+.061*c*Math.cos(a)-layer*.004);
    }
    for(let j=0;j<LAT;j++)for(let i=0;i<ARC;i++){
      const a=j*(ARC+1)+i,b=a+1,c=a+ARC+1,d=c+1;
      const face=side>0?[a,b,c,b,d,c]:[a,c,b,b,c,d];idx.push(...face);
      for(let n=0;n<face.length;n+=3)idx.push(face[n]+layerSize,face[n+2]+layerSize,face[n+1]+layerSize);
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);add(hinge,g,'sage');
    const vein=[];for(let j=0;j<=8;j++){const lat=-1.32+j/8*2.64,c=Math.cos(lat),a=.43;vein.push([side*(.091*c*Math.sin(a)-.09),.149*Math.sin(lat),.015+.061*c*Math.cos(a)]);}line(hinge,vein,.0014,'ivory');
    // The closed centre seam is only two fine lines; no procedural grain.
    const seam=[];for(let j=0;j<=10;j++){const lat=-Math.PI/2+j/10*Math.PI;seam.push([-side*.09,.149*Math.sin(lat),.015+.061*Math.cos(lat)]);}line(hinge,seam,.0014,'ivoryShade');
    if(side>0)ell(hinge,[-.087,.029,.075],[.014,.014,.003],'coralShade');
  }
  for(let i=0;i<3;i++){
    const y=-.056+i*.061,z=.022+i*.004,width=.112-i*.012;
    box(satchel,[0,y,z],[width,.064,.004],'paper');
    line(satchel,[[-width*.48,y+.029,z+.003],[0,y+.008,z+.003],[width*.48,y+.029,z+.003]],.0009,'ivoryShade');
    box(satchel,[0,y-.018,z+.006],[width+.012,.016,.004],'blueShade');
    mailSlots.push({y,z,width});
  }
  let podOpening=0;
  function updatePostalPod(player,dt){
    const speed=player.velocity?.length?.()??0;
    const inspecting=!!(player.inspectMailbag||player.inspectLetter||(player.holdingLetter&&speed<.6));
    const target=inspecting&&!player.riding&&speed<2?.98:0;
    podOpening=T.MathUtils.lerp(podOpening,target,1-Math.exp(-9*Math.min(Math.max(dt||0,0),.1)));
    podLeaves[0].rotation.y=-podOpening;podLeaves[1].rotation.y=podOpening;
    satchel.userData.openAmount=podOpening/.98;
  }
  // Belt-hung straps connect the pod to the waist; the lower cloth ties move
  // with the thigh rather than cutting through it during a mounted pose.
  for(const x of[-.156,-.199])line(body,[[x,.008,.04],[x-.01,-.04,.035]],.005,'leather');
  for(const [leg,x,length] of [[legL,.07,.35],[legL,.035,.25]]){const tie=panel(leg,[[x,.025],[x+.027,.025],[x+.01,-length],[x-.02,-length+.015]],'blue');tie.position.z=.124;}
  const mapRoll=new T.Group();mapRoll.name='reedbank-waist-map-roll';mapRoll.position.set(0,.002,-.136);mapRoll.rotation.z=Math.PI/2;body.add(mapRoll);
  loft(mapRoll,[[.11,.030,.03],[-.11,.030,.03]],'ivory');
  for(const y of[-.06,.06])loft(mapRoll,[[y+.008,.032,.032],[y-.008,.032,.032]],'blue');
  for(const rad of[.012,.020,.026]){const pts=[];for(let i=0;i<=18;i++){const a=i/18*Math.PI*2;pts.push([Math.cos(a)*rad,.111,Math.sin(a)*rad]);}line(mapRoll,pts,.0008,'ivoryShade');}
  const compass=new T.Group();compass.name='reedbank-crescent-compass';compass.position.set(-.112,.292,.113);body.add(compass);
  const crescent=new T.Shape();crescent.moveTo(-.039,.012);crescent.absarc(0,.012,.039,Math.PI,Math.PI*2,false);crescent.lineTo(.024,.012);crescent.absarc(0,.017,.025,-.20,-Math.PI+.20,true);crescent.closePath();
  add(compass,new T.ExtrudeGeometry(crescent,{depth:.005,bevelEnabled:false,curveSegments:9}),'brass');
  line(compass,[[0,.047,.003],[-.014,.037,.003],[0,.025,.003],[.014,.037,.003],[0,.047,.003]],.002,'leather');
  line(body,[[-.114,.385,.075],[-.113,.35,.111],[-.112,.339,.118]],.003,'leather');
  // Continuous face surface: nose/cheeks/jaw share a single mesh, small eyes
  // sit in the surface instead of detached white spheres.
  ell(head,[0,-.017,0],[.043,.072,.041],'skin');
  const rows=[[.245,.022,.032],[.226,.062,.061],[.197,.080,.075],[.158,.084,.077],[.129,.082,.076],[.104,.074,.073],[.084,.066,.070],[.064,.054,.066],[.043,.041,.060],[.027,.026,.047]],pos=[],ind=[],N=32;
  for(const [y,rx,rz] of rows)for(let i=0;i<=N;i++){const a=i/N*Math.PI*2,x=Math.sin(a)*rx,c=Math.cos(a),nose=c>0?.021*Math.exp(-(((y-.105)/.029)**2))*Math.exp(-((x/.018)**2))*c**6:0;pos.push(x,y,c*rz+nose);}
  for(let j=0;j<rows.length-1;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i,b=a+1,c=a+N+1,d=c+1;ind.push(a,c,b,b,c,d);}
  const face=new T.BufferGeometry();face.setAttribute('position',new T.Float32BufferAttribute(pos,3));face.setIndex(ind);const faceMesh=add(head,face,'skin',[0,0,0],[1,1,1],false);faceMesh.name='messenger-continuous-face';
  // Probe this exact continuous surface before batching. Fine facial marks
  // rest on the skin instead of using a guessed plane in front of the face.
  const facialRay=new T.Raycaster(),facialSamples=[];
  const faceAt=(x,y,lift=.001)=>{
    facialRay.set(new T.Vector3(x,y,.25),new T.Vector3(0,0,-1));
    const hit=facialRay.intersectObject(faceMesh,false)[0];
    if(!hit)throw new Error('courier face surface missing at '+x+','+y);
    return [x,y,hit.point.z+lift];
  };
  for(const side of[-1,1]){
    ell(head,[side*.081,.119,-.001],[.011,.023,.017],'skin');
    const x=side*.033,y=.139,base=faceAt(x,y,0)[2];
    ell(head,[x,y,base+.0009],[.011,.0038,.0021],'ivoryShade');
    ell(head,[x-side*.0007,y+.0002,base+.0028],[.0028,.0031,.0013],'ink');
    line(head,[faceAt(side*.016,.154),faceAt(side*.031,.157),faceAt(side*.049,.153)],.00105,'hair');
    line(head,[faceAt(side*.010,.085),faceAt(side*.014,.083)],.00065,'skinShade');
    facialSamples.push({x:x-side*.0007,y:y+.0002,skinZ:base,eyeFrontZ:base+.0041});
  }
  line(head,[faceAt(-.018,.060),faceAt(0,.061),faceAt(.018,.0605)],.00075,'skinShade');
  u.courierFace={version:6,eyeSamples:facialSamples,browRadius:.00105,mouthRadius:.00075,napeRevision:5};
  // Tousled curls: asymmetric clumps and lifted curling tips, no helmet cap.
  head.scale.set(1.08,1.025,1.065);
  // Extend the existing scalp volume behind the skull down to the nape.
  // Front extent stays at z=.037, behind the face; topology is unchanged.
  const scalp=ell(head,[0,.156,-.037],[.090,.101,.074],'hair');
  const scalpPos=scalp.geometry.attributes.position;
  for(let i=0;i<scalpPos.count;i++){
    const y=scalpPos.getY(i),x=scalpPos.getX(i),z=scalpPos.getZ(i);
    if(y<-.35){const wave=Math.sin(Math.atan2(z,x)*5+.6)*.045*(1+y);scalpPos.setY(i,y+wave);}
  }
  scalp.geometry.computeVertexNormals();
  const hairMeshes=[scalp],markedLocks=[];
  function curlTip(points,index){
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),segments=12,sides=6;
    const geo=new T.TubeGeometry(curve,segments,.006,sides,false),p=geo.attributes.position;
    for(let ring=0;ring<=segments;ring++){
      const t=ring/segments,center=curve.getPointAt(t),taper=1-.91*Math.pow(t,1.7);
      for(let j=0;j<=sides;j++){const k=ring*(sides+1)+j,v=new T.Vector3().fromBufferAttribute(p,k).sub(center).multiplyScalar(taper).add(center);p.setXYZ(k,v.x,v.y,v.z);}
    }
    const idx=Array.from(geo.index.array),end=segments*(sides+1);
    for(let j=1;j<sides-1;j++)idx.push(0,j+1,j,end,end+j,end+j+1);
    geo.setIndex(idx);geo.computeBoundingBox();
    const oldHighest=.3036637604236603,max=index===8?oldHighest:Math.min(geo.boundingBox.max.y,oldHighest-.0015),base=points[0][1];
    if(index===8||geo.boundingBox.max.y>max)for(let i=0;i<p.count;i++)p.setY(i,base+(p.getY(i)-base)*(max-base)/(geo.boundingBox.max.y-base));
    const mesh=add(head,geo,'hair');hairMeshes.push(mesh);
  }
  for(let i=0;i<13;i++){
    const a=i/13*Math.PI*2,x=Math.sin(a)*(.093+.006*Math.sin(i*2.1)),z=Math.cos(a)*(.067+.005*Math.cos(i*1.7));
    if(![3,5,7,11].includes(i)){
      const lock=ell(head,[x,.234+Math.sin(i*1.8)*.025,z-.008],[.032,.030,.037],'hair');lock.rotation.z=Math.sin(i)*.7;hairMeshes.push(lock);if([0,2,12].includes(i))markedLocks.push(lock);
    }
    if(i%2===0){
      // Keep the highest curl's authored control points. curlTip pins its
      // maximum Y so fitting never rescales body, feet or bone positions.
      const cx=i===8?Math.sin(a)*.089:x,cz=i===8?Math.cos(a)*.064:z;
      curlTip([[cx,.25+Math.sin(i)*.012,cz],[cx*(i===8?1.18:1.12),.282+Math.sin(i)*.022,cz*(i===8?1.14:1.22)],[cx*(i===8?1.28:1.26),.265+Math.sin(i)*.014,cz*(i===8?1.27:1.13)]],i);
    }
  }
  for(let i=0;i<5;i++){const x=-.065+i*.032;const lock=ell(head,[x,.205+Math.sin(i*1.7)*.017,.067+(i%2)*.006],[.025,.028,.032],'hair');lock.rotation.z=.45*Math.cos(i);hairMeshes.push(lock);if(i%2===0)markedLocks.push(lock);}
  for(const side of[-1,1]){ell(head,[side*.080,.145,-.027],[.024,.057,.047],'hair');line(head,[[side*.082,.176,.023],[side*.100,.164,.027],[side*.092,.145,.018]],.003,'hair');}
  // Six restrained open arcs reveal the direction of larger locks. Each
  // ribbon edge is projected onto the actual visible hair surface, not a flat
  // floating plane. All are merged into the existing head batch below.
  for(const mesh of hairMeshes){mesh.updateMatrix();mesh.matrixWorld.copy(mesh.matrix);}
  const hairRay=new T.Raycaster(),hairSamples=[];
  const hairAt=(x,y)=>{hairRay.set(new T.Vector3(x,y,.4),new T.Vector3(0,0,-1));return hairRay.intersectObjects(hairMeshes,false)[0];};
  for(let n=0;n<markedLocks.length;n++){
    const lock=markedLocks[n],verts=[],indices=[],samples=[];
    for(let j=0;j<=6;j++){
      const a=-.8+j/6*2.15,x=lock.position.x+Math.cos(a)*.016,y=lock.position.y+Math.sin(a)*.017;
      const hits=[hairAt(x-.0007,y),hairAt(x+.0007,y)];
      if(hits.some(h=>!h))continue;
      const row=verts.length/6;
      for(const hit of hits){verts.push(hit.point.x,hit.point.y,hit.point.z+.0013);samples.push({x:hit.point.x,y:hit.point.y,z:hit.point.z+.0013,skinZ:hit.point.z});}
      if(row>0){const i=(row-1)*2;indices.push(i,i+1,i+2,i+1,i+3,i+2);}
    }
    if(indices.length){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setIndex(indices);add(head,geo,'hairLight',[0,0,0],[1,1,1],false);hairSamples.push(...samples);}
  }
  u.courierHair={version:7,napeRevision:5,crownLocks:9,fringeLocks:5,tipCurls:7,surfaceArcs:markedLocks.length,surfaceSamples:hairSamples,highestY:.3036637604236603};
  // Hand-held story letter stays parented to the original right-hand pivot.
  box(letter,[0,0,0],[.14,.105,.007],'paper');
  line(letter,[[-.068,.050,.004],[0,.003,.005],[.068,.050,.004]],.0011);
  ell(letter,[0,-.008,.006],[.009,.009,.003],'coral');letter.visible=false;
  // The map and compass have no moving parts: fold their surfaces into the
  // body batch while keeping named attachment anchors for story/debug tooling.
  root.updateMatrixWorld(true);
  for(const anchor of[mapRoll,compass]){const group=buckets.get(anchor);if(group){for(const mesh of[...group.children])bucket(body).attach(mesh);group.removeFromParent();buckets.delete(anchor);}}
  // Merge each rigid attachment separately. Animation groups are never baked.
  for(const [joint,b] of buckets){const result=mergeStaticGroup(b);for(const mesh of result.surfaces){mesh.name='messenger-batch-'+joint.name;mesh.userData.messengerSurface=true;const shell=new T.Mesh(mesh.geometry,ink);shell.name='messenger-ink-'+joint.name;shell.userData.isOutline=true;shell.raycast=()=>{};mesh.add(shell);}}
  Object.assign(u,{runtimeModel:'reedbank-courier-2',moebiusCourier:true,wastelandCourier:false,expeditionCourier:false,headbandTails:[],palette:MESSENGER_PALETTE,source:'courierMoebius.js',bodyBaseY:.99,postalSatchel:satchel,styleRevision:'accepted-reedbank-target-v2',geometryRevision:'reedbank-hair-7',approvalStatus:'accepted-reedbank-target-v2',skirtPanels,fanPetals:petals.length,mapRoll,compass,podLeaves,mailSlots,updatePostalPod});
  return root;
}
