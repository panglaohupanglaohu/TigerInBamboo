import * as T from 'three';
import {buildWastelandCourier} from './courierWasteland.js';
import {mergeStaticGroup} from '../../world/geometryMerge.js';

// Project-authored travelling messenger. Public line-and-colour methods inform
// this model; this is not a reproduction of Sable's private rendering code.
export const MESSENGER_PALETTE = Object.freeze({
  ivory:0xf1e8ce, ivoryShade:0xc7bdaf, sage:0x99bbaa, sageShade:0x6f9794,
  plum:0x777388, plumShade:0x57556b, coral:0xe9a18f, coralShade:0xc87e7a,
  ink:0x514b64, skin:0xcaa58e, skinShade:0xaa847c, hair:0x565360,
  paper:0xf6eedb, leather:0x746773,
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
  const ell=(p,pos,s,k)=>add(p,new T.SphereGeometry(1,16,10),k,pos,s);
  const box=(p,pos,s,k)=>add(p,new T.BoxGeometry(...s),k,pos);
  function line(p,points,r=.0014,key='ink'){
    return add(p,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v))),Math.max(5,points.length*3),r,4,false),key,[0,0,0],[1,1,1],false);
  }
  function loft(p,rows,key,segments=20){
    const pos=[],index=[];
    for(const [y,rx,rz,cx=0,cz=0] of rows)for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2;pos.push(cx+Math.cos(a)*rx,y,cz+Math.sin(a)*rz);}
    for(let j=0;j<rows.length-1;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+1,c=a+segments+1,d=c+1;index.push(a,b,c,b,d,c);}
    // Rows run from high to low; end fans close the cloth volumes.
    for(const [row,up] of [[0,true],[rows.length-1,false]]){const [y,,,cx=0,cz=0]=rows[row],center=pos.length/3;pos.push(cx,y,cz);for(let i=0;i<segments;i++){const a=row*(segments+1)+i;index.push(center,...(up?[a+1,a]:[a,a+1]));}}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(index);return add(p,g,key);
  }
  // Unbroken cloth torso, a short split travel tunic, and visible trouser legs.
  // The hem ends at the pelvis so it can sit astride mounts without a rigid skirt.
  loft(body,[[.435,.073,.070],[.392,.185,.093],[.31,.186,.103],[.15,.151,.100],[.035,.147,.105],[-.085,.176,.116]],'ivory');
  loft(body,[[.015,.143,.097],[-.12,.142,.097]],'plum');
  line(body,[[0,.355,.104],[.008,.20,.107],[.006,.03,.112],[.013,-.081,.117]],.0015);
  line(body,[[-.152,-.065,.059],[-.08,-.079,.103],[0,-.085,.118],[.09,-.077,.097],[.155,-.066,.049]],.0018);
  // Sage shoulder yoke and collar; no armour plates or glowing robot joints.
  loft(body,[[.422,.068,.067],[.394,.182,.095],[.342,.183,.102]],'sage');
  line(body,[[-.175,.341,.035],[-.10,.34,.089],[0,.342,.105],[.10,.341,.089],[.175,.34,.035]]);
  armL.position.set(.19,.342,0);armR.position.set(-.19,.342,0);
  for(const [arm,elbow,hand,side] of [[armL,elbowL,handL,1],[armR,elbowR,handR,-1]]){
    loft(arm,[[.057,.020,.025],[.041,.046,.049],[.015,.065,.064],[-.035,.070,.070],[-.105,.062,.065,side*.008],[-.185,.053,.056,side*.019],[-.258,.047,.049,side*.025]],'ivory');
    loft(elbow,[[.025,.047,.050],[-.035,.053,.055],[-.095,.049,.051,side*.007],[-.158,.043,.044,side*.016],[-.21,.038,.039,side*.022],[-.244,.032,.034,side*.025]],'ivory');
    loft(elbow,[[-.194,.040,.043,side*.020],[-.239,.035,.037,side*.025]],'sage');
    ell(hand,[0,-.027,.005],[.029,.050,.020],'skin');
    ell(hand,[-side*.026,-.018,.017],[.013,.025,.012],'skin');
    for(const dx of[-.012,0,.012])line(hand,[[dx,-.029,.024],[dx,-.058,.021]],.00065,'skinShade');
    line(arm,[[side*.065,-.06,.018],[side*.06,-.13,.038],[side*.045,-.20,.037]],.0011,'ivoryShade');
    line(arm,[[side*.012,-.210,.055],[side*.036,-.221,.049],[side*.053,-.216,.035]],.0011,'ivoryShade');
    line(elbow,[[-.024,-.043,.049],[0,-.054,.055],[.025,-.048,.050]],.0011,'ivoryShade');
  }
  for(const [leg,knee,side] of [[legL,kneeL,1],[legR,kneeR,-1]]){
    loft(leg,[[.027,.081,.087],[-.14,.078,.079],[-.32,.057,.062],[-.472,.049,.050]],'plum');
    loft(knee,[[.025,.049,.053],[-.12,.048,.052],[-.32,.034,.037]],'plum');
    loft(knee,[[-.19,.045,.050],[-.28,.049,.052],[-.40,.041,.052]],'sage');
    ell(knee,[0,-.442,.027],[.048,.065,.085],'leather');
    ell(knee,[0,-.466,.081],[.049,.034,.082],'leather');
    line(knee,[[-.04,-.475,.105],[0,-.484,.155],[.04,-.475,.105]],.002);
    line(leg,[[side*.054,-.20,.044],[side*.049,-.29,.039],[side*.029,-.37,.048]],.0014,'plumShade');
  }
  // Coral scarf reads from both front and over-the-shoulder gameplay cameras.
  loft(body,[[.466,.063,.060],[.425,.094,.079],[.382,.087,.095]],'coral');
  ell(body,[-.072,.405,.069],[.036,.028,.027],'coral');
  cape.position.set(-.061,.422,-.061);
  const scarf=new T.Shape();scarf.moveTo(-.015,0);scarf.bezierCurveTo(-.10,-.08,-.05,-.24,-.15,-.37);scarf.lineTo(-.065,-.405);scarf.bezierCurveTo(.019,-.27,.045,-.10,.037,-.008);scarf.closePath();
  add(cape,new T.ExtrudeGeometry(scarf,{depth:.007,bevelEnabled:false,curveSegments:7}),'coral',[0,0,-.020]);
  line(cape,[[-.027,-.055,-.012],[-.033,-.18,-.012],[-.080,-.30,-.012],[-.11,-.373,-.012]],.0013,'coralShade');
  // A postal satchel with flap, envelopes and a continuous cross-body strap.
  const satchel=new T.Group();satchel.name='moebius-postal-satchel';satchel.position.set(-.18,.016,.035);satchel.rotation.z=-.07;body.add(satchel);
  loft(satchel,[[.093,.09,.046],[.06,.102,.051],[-.07,.10,.05],[-.104,.073,.040]],'leather');
  box(satchel,[0,.025,.052],[.176,.125,.008],'plum');
  line(satchel,[[-.087,.083,.058],[-.072,.006,.060],[0,-.035,.061],[.072,.006,.060],[.087,.083,.058]],.0017);
  ell(satchel,[0,-.010,.060],[.008,.012,.004],'ivory');
  const mail=box(satchel,[.012,.11,.002],[.102,.069,.004],'paper');mail.rotation.z=-.13;
  line(satchel,[[-.038,.133,.007],[.012,.104,.007],[.06,.131,.007]],.0012);
  // Front diagonal band and its back continuation are thin cloth geometry.
  function strap(points){for(let i=1;i<points.length;i++){const a=new T.Vector3(...points[i-1]),b=new T.Vector3(...points[i]),mesh=box(body,a.clone().add(b).multiplyScalar(.5).toArray(),[.028,a.distanceTo(b),.007],'leather');mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.sub(a).normalize());}}
  strap([[.137,.382,.077],[.083,.277,.109],[-.018,.15,.113],[-.126,.035,.104],[-.173,.009,.086]]);
  strap([[.137,.382,-.083],[.08,.275,-.107],[-.028,.148,-.111],[-.161,.028,-.093]]);
  // Continuous face surface: nose/cheeks/jaw share a single mesh, small eyes
  // sit in the surface instead of detached white spheres.
  ell(head,[0,-.017,0],[.043,.072,.041],'skin');
  const rows=[[.245,.022,.032],[.226,.062,.061],[.197,.080,.075],[.158,.086,.078],[.129,.081,.076],[.104,.080,.075],[.084,.075,.071],[.064,.067,.070],[.043,.053,.064],[.027,.031,.050]],pos=[],ind=[],N=32;
  for(const [y,rx,rz] of rows)for(let i=0;i<=N;i++){const a=i/N*Math.PI*2,x=Math.sin(a)*rx,c=Math.cos(a),nose=c>0?.028*Math.exp(-(((y-.101)/.027)**2))*Math.exp(-((x/.018)**2))*c**6:0;pos.push(x,y,c*rz+nose);}
  for(let j=0;j<rows.length-1;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i,b=a+1,c=a+N+1,d=c+1;ind.push(a,c,b,b,c,d);}
  const face=new T.BufferGeometry();face.setAttribute('position',new T.Float32BufferAttribute(pos,3));face.setIndex(ind);add(head,face,'skin').name='messenger-continuous-face';
  for(const s of[-1,1]){
    ell(head,[s*.083,.119,-.001],[.012,.024,.019],'skin');
    ell(head,[s*.033,.137,.073],[.016,.0055,.0035],'skinShade');
    ell(head,[s*.030,.138,.076],[.003,.0035,.0023],'ink');
    line(head,[[s*.014,.155,.078],[s*.031,.159,.077],[s*.050,.155,.066]],.0018,'hair');
    line(head,[[s*.010,.083,.086],[s*.016,.082,.076]],.001,'skinShade');
  }
  line(head,[[-.021,.059,.067],[0,.056,.075],[.021,.059,.067]],.0011,'skinShade');
  // A single hair silhouette with a few swept locks, rather than stubble noise.
  ell(head,[0,.208,-.016],[.086,.062,.078],'hair');
  for(let i=0;i<7;i++){const x=-.071+i*.021;const lock=ell(head,[x,.204+Math.sin(i*.45)*.018,.042],[.027,.043,.038],'hair');lock.rotation.z=-.42;}
  for(const s of[-1,1])ell(head,[s*.078,.159,-.007],[.012,.035,.042],'hair');
  for(const x of[-.04,0,.04])line(head,[[x-.012,.232,.047],[x,.246,.039],[x+.022,.244,.008]],.001,'plum');
  // Hand-held story letter stays parented to the original right-hand pivot.
  box(letter,[0,0,0],[.14,.105,.007],'paper');
  line(letter,[[-.068,.050,.004],[0,.003,.005],[.068,.050,.004]],.0011);
  ell(letter,[0,-.008,.006],[.009,.009,.003],'coral');letter.visible=false;
  // Merge each rigid attachment separately. Animation groups are never baked.
  for(const [joint,b] of buckets){const result=mergeStaticGroup(b);for(const mesh of result.surfaces){mesh.name='messenger-batch-'+joint.name;mesh.userData.messengerSurface=true;const shell=new T.Mesh(mesh.geometry,ink);shell.name='messenger-ink-'+joint.name;shell.userData.isOutline=true;shell.raycast=()=>{};mesh.add(shell);}}
  Object.assign(u,{runtimeModel:'moebius-courier-1',moebiusCourier:true,wastelandCourier:false,expeditionCourier:false,headbandTails:[],palette:MESSENGER_PALETTE,source:'courierMoebius.js',bodyBaseY:.99,postalSatchel:satchel,styleRevision:'coral-lake-messenger-1'});
  return root;
}
