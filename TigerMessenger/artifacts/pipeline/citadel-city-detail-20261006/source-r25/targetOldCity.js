import * as THREE from 'three';

export const TARGET_OLD_CITY_PALETTE = Object.freeze({stone:'#e6d3ae',trim:'#f6e8c6',roof:'#e88148',roofLight:'#f39b60',yellow:'#e7bc68',pink:'#da9690',teal:'#65aaa9',blue:'#75b2c9',glass:'#456777'});
/** Authored architectural candidate. Local +Z faces the bay; caller owns placement/yaw.
 * Not a WFC solver, navigation installation or a mutation of the existing city. */
export function createTargetOldCity({seed=20261006,palette={}}={}) {
  const colours={...TARGET_OLD_CITY_PALETTE,...palette}, group=new THREE.Group();group.name='citadel-target-old-city';
  group.userData.preserveCitadelMaterials=true;
  const geometries=new Set(),materials=new Set(),footprints=[],walkable=[],houses=[];
  const mats=Object.fromEntries(Object.entries(colours).map(([k,c])=>{const m=new THREE.MeshStandardMaterial({color:c,roughness:.9});m.userData.preserveCitadelMaterial=true;materials.add(m);return[k,m];}));
  function add(name,g,mat,x=0,y=0,z=0){geometries.add(g);const m=new THREE.Mesh(g,mats[mat]);m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;m.userData.preserveCitadelMaterials=true;group.add(m);return m;}
  function box(name,w,h,d,x,y,z,mat='stone'){return add(name,new THREE.BoxGeometry(w,h,d),mat,x,y,z);}
  function foot(id,x,z,w,d,floorY,roofY,extra={}){footprints.push({id,polygon:[[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]],floorY,roofY,...extra});}
  function roof(name,x,y,z,w,d){const v=[[-w/2,0,-d/2],[w/2,0,-d/2],[w/2,0,d/2],[-w/2,0,d/2],[-w*.23,1.25,0],[w*.23,1.25,0]],ids=[0,4,5,0,5,1,1,5,2,2,5,4,2,4,3,3,4,0,0,1,2,0,2,3];const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(ids.flatMap(i=>v[i]),3));g.computeVertexNormals();add(name,g,'roof',x,y,z);box(name+'-eaves',w,.18,d,x,y,z,'roofLight');}
  function window(name,x,y,z){box(name+'-recess',.65,1,.055,x,y,z,'glass');for(const [dx,dy,w,h]of[[-.37,0,.09,1.18],[.37,0,.09,1.18],[0,.55,.83,.09],[0,-.55,.9,.12]])box(name+'-frame',w,h,.12,x+dx,y+dy,z+.04,'trim');}
  // Symmetric through arch; the centre remains an actual void from floor upwards.
  function arch(name,x,z,w,h,r,spring,depth,base=0){const s=new THREE.Shape();s.moveTo(-w/2,0);s.lineTo(-w/2,h);s.lineTo(w/2,h);s.lineTo(w/2,0);s.lineTo(r,0);s.lineTo(r,spring);for(let i=1;i<=20;i++){const a=i*Math.PI/20;s.lineTo(r*Math.cos(a),spring+r*Math.sin(a));}s.lineTo(-r,0);s.closePath();return add(name,new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:20}),'stone',x,base,z-depth/2);}
  // Separate supported terrace wings keep the central ascending street open.
  for(let row=0;row<3;row++){
    const z=10-row*10,floor=.3+row*4;
    for(const side of[-1,1]){
      const x=side*11.15,w=row===2?16:17.3;
      if(row===0) box(`terrace-${row}-${side}`,w,floor,7.4,x,floor/2,z);
      else {
        const thickness=.45;
        box(`terrace-${row}-${side}-deck`,w,thickness,7.4,x,floor-thickness/2,z);
        // Open front arcade with full-depth piers: genuine voids, supporting a continuous deck.
        const bays=3,bay=w/bays;
        for(let j=0;j<bays;j++) arch(`terrace-${row}-${side}-arcade-${j}`,x-w/2+bay*(j+.5),z+.1,bay,floor-thickness,bay*.32,Math.min(2.2,floor-2.3),7.2,0);
        box(`terrace-${row}-${side}-rear`,w,floor-thickness,.25,x,(floor-thickness)/2,z-3.58);
      }
      foot(`terrace-${row}-${side}`,x,z,w,7.4,0,floor,{support:true,walkable:true});
      walkable.push({id:`terrace-${row}-${side}`,height:floor});
      for(let col=0;col<(row===2?2:3);col++){
        const hx=side*(5.8+col*5.75),hz=z-1.15+(col===1?.6:col===2?-.4:0);
        if(row===2&&side===1&&col===1)continue; // tower occupies its own supported plot
        const hash=((Math.imul(row+1,73856093)^Math.imul(col+1,19349663)^seed^(side+2)*83492791)>>>0),h=5.8+(hash%5)*.6;
        const id=`house-${row}-${side}-${col}`,houseWidth=col===1?6.7:4.85,mat=['yellow','pink','teal','blue'][hash%4];
        box(id,houseWidth,h,4.7,hx,floor+h/2,hz,mat);roof(id+'-roof',hx,floor+h,hz,houseWidth+.4,5.1);
        box(id+'-base',houseWidth+.1,.22,4.8,hx,floor+.11,hz,'trim');
        for(const dx of(col===1?[-1.65,0,1.65]:[-1.15,1.15]))for(let yy=1.65;yy<h-.7;yy+=2.65)window(id+'-window',hx+dx,floor+yy,hz+2.38);
        houses.push({id,position:[hx,floor,hz],height:h,colour:mat});foot(id,hx,hz,houseWidth+.4,5.1,floor,floor+h+1.25,{supportedBy:`terrace-${row}-${side}`});
      }
    }
  }
  // Central street: a flat entry, then forty 0.2m risers and 0.5m treads.
  box('gate-approach',4.4,.3,6,0,.15,13,'trim');foot('gate-approach',0,13,4.4,6,0,.3,{walkable:true,support:true});
  for(let i=0;i<40;i++){const top=.3+(i+1)*.2,z=9.75-i*.5;box(`central-step-${i}`,4.4,top,.51,0,top/2,z,'trim');walkable.push({id:`central-step-${i}`,height:top,z});}
  box('upper-street-landing',4.4,8.3,3,0,4.15,-11.5,'trim');
  arch('old-city-front-open-gate',0,15.65,8,6.3,2.1,3.25,1.0,.3);
  roof('old-city-gate-roof',0,6.6,15.65,8.6,2,1);
  foot('old-city-front-open-gate',0,15.65,8,1,.3,7.85,{opening:{width:4.2,rectangularHeight:3.25}});
  // High, slender cream landmark. Total top is exactly 33m above this origin.
  const tx=11.55,tz=-11.15,base=8.3;
  box('tower-shaft',3.15,18.2,3.15,tx,base+9.1,tz,'trim');
  box('tower-base-band',3.45,.55,3.45,tx,base+.275,tz,'stone');
  for(const y of[12,17,22]){window('tower-window',tx,y,tz+1.6);box('tower-belt',3.3,.18,3.3,tx,y-1.4,tz,'stone');}
  box('tower-clockroom-floor',3.6,.35,3.6,tx,26.65,tz,'stone');
  // Four open bell chamber sides; no opaque central shaft behind the arches.
  arch('tower-bell-front',tx,tz+1.5,3.2,3.05,.72,1.55,.25,26.825);
  arch('tower-bell-back',tx,tz-1.5,3.2,3.05,.72,1.55,.25,26.825);
  for(const side of[-1,1]){const m=arch('tower-bell-side-'+side,0,0,3.2,3.05,.72,1.55,.25,0);m.position.set(tx+side*1.5,26.825,tz);m.rotation.y=Math.PI/2;}
  box('tower-cornice',3.85,.4,3.85,tx,30.075,tz,'trim');
  add('tower-red-cupola',new THREE.SphereGeometry(1.8,20,12,0,Math.PI*2,0,Math.PI/2),'roof',tx,30.275,tz);
  add('tower-finial',new THREE.ConeGeometry(.12,.925,8),'roofLight',tx,32.5375,tz);
  foot('old-city-high-tower',tx,tz,3.65,3.65,base,33,{supportedBy:'terrace-2-1'});
  // The two side streets are explicit endpoints only; external bridge/feed geometry belongs to integration.
  group.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(group);let meshes=0,triangles=0;group.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
  const report={version:'target-old-city-2',seed,origin:'platform-local ground; +Z bay/front',palette:colours,footprints,houses,walkable,
    bounds:{min:bounds.min.toArray(),max:bounds.max.toArray(),size:bounds.getSize(new THREE.Vector3()).toArray()},
    entry:{position:[0,.3,16.3],outward:[0,0,1],clearWidth:4.2,rectangularClearHeight:3.25},
    exits:{upperStreet:[0,8.3,-12.5],bridge:[19.8,.3,12.4],waterfallFeed:[11,.3,13.7]},
    stairs:{from:[0,.3,10],to:[0,8.3,-10],steps:40,rise:.2,tread:.5,width:4.4},
    performance:{meshes,triangles,materials:materials.size,geometries:geometries.size},
    validation:{gpuIntegrated:false,visualScore:null,navigationInstalled:false,surfaceSeated:false},
    limitations:['Hand-authored candidate, not WFC or editable cell generation.','External bridge, waterfall feed and platform seating require integration.','Terrace-side access joins require runtime walkability checks; visual geometry is not a collision installation.']};
  group.userData.targetArchitectureReport=report;let disposed=false;
  return{group,report,dispose(){if(disposed)return;disposed=true;group.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());group.clear();}};
}
