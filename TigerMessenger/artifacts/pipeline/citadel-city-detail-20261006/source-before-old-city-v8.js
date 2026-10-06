import * as THREE from 'three';
import {validateTargetOldCityRoofRoles} from './targetOldCityRoofWfc.js';

export const TARGET_OLD_CITY_PALETTE = Object.freeze({stone:'#e6d3ae',trim:'#f6e8c6',roof:'#e88148',roofLight:'#f39b60',yellow:'#f4d588',pink:'#eda6a0',teal:'#72c3c0',blue:'#87c4e0',glass:'#456777'});
/** Authored architectural candidate. Local +Z faces the bay; caller owns placement/yaw.
 * Not a WFC solver, navigation installation or a mutation of the existing city. */
export function createTargetOldCity({seed=20261006,palette={},roofRoles={}}={}) {
  const roleOverrides=validateTargetOldCityRoofRoles(roofRoles);
  const colours={...TARGET_OLD_CITY_PALETTE,...palette}, group=new THREE.Group();group.name='citadel-target-old-city';
  group.userData.preserveCitadelMaterials=true;
  const instances=new Set(),geometries=new Set(),materials=new Set(),footprints=[],walkable=[],houses=[],housePlans=[],facadeWindows=[],rejectedWindows=[],residentialArcades=[];
  const mats=Object.fromEntries(Object.entries(colours).map(([k,c])=>{const m=new THREE.MeshStandardMaterial({color:c,roughness:.9});m.userData.preserveCitadelMaterial=true;materials.add(m);return[k,m];}));
  function add(name,g,mat,x=0,y=0,z=0,parent=group){geometries.add(g);const m=new THREE.Mesh(g,mats[mat]);m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;m.userData.preserveCitadelMaterials=true;parent.add(m);return m;}
  function box(name,w,h,d,x,y,z,mat='stone',parent=group){return add(name,new THREE.BoxGeometry(w,h,d),mat,x,y,z,parent);}
  function foot(id,x,z,w,d,floorY,roofY,extra={}){footprints.push({id,polygon:[[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]],floorY,roofY,...extra});}
  function roof(name,x,y,z,w,d,parent=group){const v=[[-w/2,0,-d/2],[w/2,0,-d/2],[w/2,0,d/2],[-w/2,0,d/2],[-w*.23,1.25,0],[w*.23,1.25,0]],ids=[0,4,5,0,5,1,1,5,2,2,5,4,2,4,3,3,4,0,0,1,2,0,2,3];const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(ids.flatMap(i=>v[i]),3));g.computeVertexNormals();add(name,g,'roof',x,y,z,parent);box(name+'-eaves',w,.18,d,x,y,z,'roofLight',parent);}
  function window(name,x,y,z){box(name+'-recess',.65,1,.055,x,y,z,'glass');for(const [dx,dy,w,h]of[[-.37,0,.09,1.18],[.37,0,.09,1.18],[0,.55,.83,.09],[0,-.55,.9,.12]])box(name+'-frame',w,h,.12,x+dx,y+dy,z+.04,'trim');}
  function bevelWall(name,w,h,d,mat,parent){const r=.09,shape=new THREE.Shape();shape.moveTo(-w/2+r,-h/2+r);shape.lineTo(w/2-r,-h/2+r);shape.lineTo(w/2-r,h/2-r);shape.lineTo(-w/2+r,h/2-r);shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:d-2*r,steps:1,bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:1,curveSegments:1});g.translate(0,0,-d/2+r);return add(name,g,mat,0,h/2,0,parent);}
  // Fixed layout roles follow terrace level / exposed edge / broad plot, not
  // random labels or a WFC claim. All geometry remains within its house plot.
  function roofRole(row,side,col){
    if(row===0&&side===-1&&col===1)return 'open-terrace-pavilion';
    if(row===1&&side===-1&&col===2)return 'outer-edge-short-tower';
    if(row===1&&side===1&&col===1)return 'setback-upper-room';
    if(row===2&&side===-1&&col===0)return 'upper-street-cupola';
    return 'hip-roof';
  }
  function terraceRail(id,w,d,y,parent){
    const x=w/2-.13,z=d/2-.13,posts=[];
    for(const [a,b]of[[[-x,z],[x,z]],[[x,z],[x,-z]],[[x,-z],[-x,-z]],[[-x,-z],[-x,z]]]){
      const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),rail=box(id+'-terrace-handrail',.095,.095,length,(a[0]+b[0])/2,y+.88,(a[1]+b[1])/2,'trim',parent);rail.rotation.y=Math.atan2(dx,dz);
      const n=Math.ceil(length/.85);for(let i=0;i<n;i++)posts.push([a[0]+dx*i/n,a[1]+dz*i/n]);
    }
    const g=new THREE.BoxGeometry(.095,.83,.095);geometries.add(g);const mesh=new THREE.InstancedMesh(g,mats.trim,posts.length),dummy=new THREE.Object3D();instances.add(mesh);mesh.name=id+'-terrace-balusters';mesh.castShadow=mesh.receiveShadow=true;mesh.userData.preserveCitadelMaterials=true;
    posts.forEach(([x,z],i)=>{dummy.position.set(x,y+.415,z);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.instanceMatrix.needsUpdate=true;parent.add(mesh);
  }
  function detailHouseWindows(){
    const tower={id:'old-city-high-tower',min:[9.625,8.3,-13.075],max:[13.475,33,-9.225]};
    const obstacles=housePlans.map(p=>({id:p.id,min:[p.hx-p.w/2-.2,p.floor,p.hz-2.55],max:[p.hx+p.w/2+.2,p.roofY,p.hz+2.55]}));obstacles.push(tower);
    for(const p of housePlans){const panes=[],trims=[];
      for(const volume of p.volumes){const narrow=volume.w<4,columns=narrow?[0]:[-Math.min(1.35,volume.w*.24),Math.min(1.35,volume.w*.24)];
      const faces=[{name:'front',normal:[0,1],tangent:[1,0],offset:[0,volume.d/2],columns},{name:'back',normal:[0,-1],tangent:[-1,0],offset:[0,-volume.d/2],columns},{name:'right',normal:[1,0],tangent:[0,-1],offset:[volume.w/2,0],columns:volume.d<4.9?[0]:[-1.1,1.1]},{name:'left',normal:[-1,0],tangent:[0,1],offset:[-volume.w/2,0],columns:volume.d<4.9?[0]:[-1.1,1.1]}];
      for(const f of faces)for(const u of f.columns)for(let vy=volume.id==='base'?1.65:1.3;vy<volume.h-.55;vy+=3.25){
        const x=volume.x+f.offset[0]+f.tangent[0]*u,z=volume.z+f.offset[1]+f.tangent[1]*u,y=volume.y+vy,world=[p.hx+x,p.floor+y,p.hz+z],ex=Math.abs(f.tangent[0])*.49+Math.abs(f.normal[0])*.15,ez=Math.abs(f.tangent[1])*.49+Math.abs(f.normal[1])*.15;
        const blocked=obstacles.find(o=>o.id!==p.id&&world[0]+ex+.06>o.min[0]&&world[0]-ex-.06<o.max[0]&&world[2]+ez+.06>o.min[2]&&world[2]-ez-.06<o.max[2]&&world[1]+.64>o.min[1]&&world[1]-.64<o.max[1]);
        const id=`${p.id}-window-${volume.id}-${f.name}-${u}-${y}`;
        if(blocked){rejectedWindows.push({id,houseId:p.id,side:f.name,blockedBy:blocked.id});continue;}
        const frame=new THREE.Group();frame.name=id;frame.position.set(x,y,z);frame.rotation.y=Math.atan2(f.normal[0],f.normal[1]);p.root.add(frame);
        panes.push(box(id+'-glass',.48,.61,.036,0,0,.021,'glass',frame));
        for(const[a,b,w,h]of[[-.28,0,.08,.77],[.28,0,.08,.77],[0,.345,.64,.08],[0,-.345,.64,.08],[0,0,.035,.65]])trims.push(box(id+'-trim',w,h,.075,a,b,.056,'trim',frame));
        trims.push(box(id+'-sill',.68,.065,.12,0,-.42,.057,'trim',frame));
        facadeWindows.push({id,houseId:p.id,volumeId:volume.id,wallVolume:{...volume},side:f.name,position:world,normal:[f.normal[0],0,f.normal[1]],width:.68,height:.905,maxProjection:.117});
      }
      }
      p.root.updateWorldMatrix(true,true);const inv=p.root.matrixWorld.clone().invert();
      for(const[parts,mat]of[[panes,'glass'],[trims,'trim']]){
        if(!parts.length)continue;const positions=[],normals=[];for(const part of parts){const g=part.geometry.toNonIndexed();g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv,part.matrixWorld));positions.push(...g.attributes.position.array);normals.push(...g.attributes.normal.array);g.dispose();part.removeFromParent();geometries.delete(part.geometry);part.geometry.dispose();}
        const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));const mesh=add(`${p.id}-windows-${mat}`,g,mat,0,0,0,p.root);mesh.userData.targetHouseId=p.id;
      }
      for(const child of [...p.root.children])if(child.isGroup&&child.children.length===0)p.root.remove(child);
    }
  }
  // Symmetric through arch; the centre remains an actual void from floor upwards.
  function arch(name,x,z,w,h,r,spring,depth,base=0,parent=group,mat='stone'){const s=new THREE.Shape();s.moveTo(-w/2,0);s.lineTo(-w/2,h);s.lineTo(w/2,h);s.lineTo(w/2,0);s.lineTo(r,0);s.lineTo(r,spring);for(let i=1;i<=20;i++){const a=i*Math.PI/20;s.lineTo(r*Math.cos(a),spring+r*Math.sin(a));}s.lineTo(-r,0);s.closePath();return add(name,new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:20}),mat,x,base,z-depth/2,parent);}
  function mergeParts(parts,name,mat,parent){
    const positions=[],normals=[];
    for(const part of parts){part.updateMatrix();const g=part.geometry.index?part.geometry.toNonIndexed():part.geometry.clone();g.applyMatrix4(part.matrix);positions.push(...g.attributes.position.array);normals.push(...g.attributes.normal.array);g.dispose();part.removeFromParent();geometries.delete(part.geometry);part.geometry.dispose();}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));return add(name,g,mat,0,0,0,parent);
  }
  // Five exposed plots gain inhabited arcades and an inset storey. This is a
  // fixed architectural body variant, independent of the five roof-role domains.
  const arcadeIds=new Set(['house-0--1-0','house-0--1-2','house-0-1-1','house-1--1-0','house-1-1-2']);
  function arcadeBody(id,w,baseH,mat,parent,hx,hz,floor){
    const top=2.85,parts=[],trim=[],bays=w>6?3:2,bay=w/bays,r=Math.min(.78,bay*.34),spring=1.8;
    const body={id:'base',x:0,y:top,z:-.425,w:w-.5,d:3.45,h:baseH-top};
    const upper=bevelWall(id+'-upper-body',body.w,body.h,body.d,mat,parent);upper.position.set(0,top+body.h/2,body.z);parts.push(upper);
    const openings=[];
    for(let i=0;i<bays;i++){const x=-w/2+bay*(i+.5);for(const z of[-2.19,2.19])parts.push(arch(id+'-arcade-arch',x,z,bay,top-.10,r,spring,.32,0,parent,mat));openings.push({centerX:hx+x,frontZ:hz+2.35,backZ:hz-2.35,width:r*2,springY:floor+spring,crownY:floor+spring+r,floorY:floor+.22});}
    for(const side of[-1,1])parts.push(box(id+'-arcade-side',.24,top-.1,4.06,side*(w/2-.12),(top-.1)/2,0,mat,parent));
    // A thin load-bearing slab caps the arches; the inset room leaves a real
    // narrow front gallery, without inventing public access to this upper deck.
    trim.push(box(id+'-arcade-deck',w,.16,4.7,0,top-.08,0,'trim',parent));
    trim.push(box(id+'-gallery-handrail',w-.25,.08,.08,0,top+.77,2.23,'trim',parent));
    const posts=Math.ceil((w-.3)/.85);for(let i=0;i<=posts;i++)trim.push(box(id+'-gallery-post',.07,.73,.07,-w/2+.15+(w-.3)*i/posts,top+.365,2.23,'trim',parent));
    for(const side of[-1,1])trim.push(box(id+'-gallery-return',.08,.08,.83,side*(w/2-.15),top+.77,1.845,'trim',parent));
    mergeParts(trim,id+'-arcade-trim','trim',parent);const wall=mergeParts(parts,id+'-walls',mat,parent);wall.userData.targetWall=true;
    residentialArcades.push({houseId:id,openings,connectedBehindPiers:true,throughDepth:4.7,publicNavigationInstalled:false,gallery:{topY:floor+top,frontDepth:1.05,publicAccess:false}});return body;
  }
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
        const id=`house-${row}-${side}-${col}`,houseWidth=col===1?6.7:4.85,mat=['pink','yellow','teal','yellow','blue','pink','stone','teal','yellow','blue','pink','yellow','stone','teal','pink'][houses.length%15];
        const root=new THREE.Group();root.name=id;root.position.set(hx,floor,hz);root.userData={preserveCitadelMaterials:true,targetHouseId:id,candidateEntityId:`old-city:${id}`,targetEditableHouse:{id,city:'old',colour:mat},editorIntegrated:false};group.add(root);
        const role=roleOverrides[id]??roofRole(row,side,col),baseH=role==='hip-roof'?h:Math.max(4.6,h-1.3),hasArcade=arcadeIds.has(id),body=hasArcade?arcadeBody(id,houseWidth,baseH,mat,root,hx,hz,floor):{id:'base',x:0,y:0,z:0,w:houseWidth,d:4.7,h:baseH},volumes=[body];
        if(!hasArcade){const wall=bevelWall(id+'-walls',houseWidth,baseH,4.7,mat,root);wall.userData.targetWall=true;}
        const support=box(id+'-base',houseWidth+.1,.22,4.8,hx,floor+.11,hz,'trim');support.userData.targetHouseSupportFor=id;
        const capW=role==='hip-roof'?body.w:houseWidth,capD=role==='hip-roof'?body.d:4.7,capZ=role==='hip-roof'?body.z:0;
        box(id+'-cornice',capW+.12,.12,capD+.12,0,baseH-.15,capZ,'trim',root);
        box(id+'-drip-edge',capW+.3,.055,capD+.3,0,baseH-.067,capZ,'roofLight',root);
        let roofY=floor+baseH+1.25,terrace=null;
        if(role==='hip-roof'){
          roof(id+'-roof',0,baseH,capZ,capW+.4,capD+.4,root);box(id+'-ridge',capW*.43,.08,.14,0,baseH+1.20,capZ,'roofLight',root);
        }else{
          const deck=baseH+.12;box(id+'-terrace-deck',houseWidth+.16,.16,4.86,0,baseH+.04,0,'trim',root);terraceRail(id,houseWidth+.16,4.86,deck,root);
          const v=role==='open-terrace-pavilion'?{id:'pavilion',x:-1.1,y:deck,z:-1.0,w:2.8,d:2.15,h:2.1}:role==='setback-upper-room'?{id:'setback',x:.7,y:deck,z:-.65,w:3.7,d:2.6,h:3.0}:role==='outer-edge-short-tower'?{id:'short-tower',x:-.3,y:deck,z:-.15,w:2.6,d:2.7,h:3.7}:{id:'cupola-tower',x:0,y:deck,z:-.15,w:2.75,d:2.75,h:4.9};const insetLimit=(houseWidth+.4)/2-(v.w+.3)/2-.1;v.x=THREE.MathUtils.clamp(v.x,-insetLimit,insetLimit);volumes.push(v);
          const upper=bevelWall(id+'-'+v.id+'-walls',v.w,v.h,v.d,mat,root);upper.position.set(v.x,v.y+v.h/2,v.z);upper.userData.targetWall=true;
          box(id+'-upper-cornice',v.w+.18,.14,v.d+.18,v.x,v.y+v.h-.07,v.z,'trim',root);
          if(role==='upper-street-cupola'){
            const domeY=v.y+v.h+.08;add(id+'-orange-cupola',new THREE.SphereGeometry(1.52,16,8,0,Math.PI*2,0,Math.PI/2),'roof',v.x,domeY,v.z,root);
            add(id+'-cupola-finial',new THREE.ConeGeometry(.09,.46,8),'roofLight',v.x,domeY+1.52+.23,v.z,root);roofY=floor+domeY+1.98;
          }else{roof(id+'-roof',v.x,v.y+v.h,v.z,v.w+.3,v.d+.3,root);box(id+'-ridge',v.w*.43,.08,.14,v.x,v.y+v.h+1.20,v.z,'roofLight',root);roofY=floor+v.y+v.h+1.25;}
          terrace={topY:floor+deck,polygon:[[hx-houseWidth/2,hz-2.35],[hx+houseWidth/2,hz-2.35],[hx+houseWidth/2,hz+2.35],[hx-houseWidth/2,hz+2.35]],upperVolume:v.id,publicAccess:false,railHeight:.9275};
        }
        housePlans.push({id,root,hx,hz,floor,w:houseWidth,h:baseH,col,volumes,roofY});
        houses.push({id,position:[hx,floor,hz],height:baseH,authoredHeight:h,colour:mat,bodyVariant:hasArcade?'through-arcade-inset-storey':'solid-street-house',roofRole:role,roofY,volumes:volumes.map(v=>v.id==='base'&&hasArcade?{id:'base',x:0,y:0,z:0,w:houseWidth,d:4.7,h:baseH,kind:'compound-envelope',includesVoid:true}:{...v}),facadeVolumes:volumes.map(v=>({...v})),terrace});foot(id,hx,hz,houseWidth+.4,5.1,floor,roofY,{supportedBy:`terrace-${row}-${side}`});
      }
    }
  }
  detailHouseWindows();
  // Central street: a flat entry, then forty 0.2m risers and 0.5m treads.
  box('gate-approach',4.4,.3,6,0,.15,13,'trim');foot('gate-approach',0,13,4.4,6,0,.3,{walkable:true,support:true});
  for(let i=0;i<40;i++){const top=.3+(i+1)*.2,z=9.75-i*.5;box(`central-step-${i}`,4.4,top,.51,0,top/2,z,'trim');walkable.push({id:`central-step-${i}`,height:top,z});}
  box('upper-street-landing',4.4,8.3,3,0,4.15,-11.5,'trim');
  arch('old-city-front-open-gate',0,15.65,8,6.3,2.1,3.25,1.0,.3);
  roof('old-city-gate-roof',0,6.6,15.65,8.6,2);
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
  group.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(group);let meshes=0,triangles=0;group.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}});
  const report={version:'target-old-city-7-inset-residential-arcades',seed,origin:'platform-local ground; +Z bay/front',palette:colours,footprints,houses,walkable,facadeWindows,rejectedWindows,residentialArcades,roofRoleSelection:{method:Object.keys(roleOverrides).length?'validated explicit role overrides':'deterministic authored terrace-level and plot-edge rules',overrides:roleOverrides,wfc:false,solverRun:false,modifiedHouseCount:houses.filter(h=>h.roofRole!=='hip-roof').length},houseGrouping:{stableIds:true,windowMaterialBatchesPerHouse:2,editorIntegrated:false,wfcIntegrated:false},
    bounds:{min:bounds.min.toArray(),max:bounds.max.toArray(),size:bounds.getSize(new THREE.Vector3()).toArray()},
    entry:{position:[0,.3,16.3],outward:[0,0,1],clearWidth:4.2,rectangularClearHeight:3.25},
    exits:{upperStreet:[0,8.3,-12.5],bridge:[19.8,.3,12.4],waterfallFeed:[11,.3,13.7]},
    stairs:{from:[0,.3,10],to:[0,8.3,-10],steps:40,rise:.2,tread:.5,width:4.4},
    performance:{meshes,triangles,materials:materials.size,geometries:geometries.size},
    validation:{gpuIntegrated:false,visualScore:null,navigationInstalled:false,surfaceSeated:false},
    limitations:['Hand-authored candidate, not WFC or editable cell generation.','External bridge, waterfall feed and platform seating require integration.','Terrace-side access joins require runtime walkability checks; visual geometry is not a collision installation.']};
  group.userData.targetArchitectureReport=report;let disposed=false;
  return{group,report,dispose(){if(disposed)return;disposed=true;group.removeFromParent();instances.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());group.clear();}};
}
