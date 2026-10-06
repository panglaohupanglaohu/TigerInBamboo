import * as THREE from 'three';
import {validateTargetOldCityRoofRoles} from './targetOldCityRoofWfc.js';
import {TARGET_ARCHITECTURE_PALETTE,TARGET_ARCHITECTURE_COLOUR_VERSION} from './targetArchitecturePalette.js';

export const TARGET_OLD_CITY_PALETTE = Object.freeze(Object.fromEntries(['stone','trim','roof','roofLight','yellow','pink','teal','blue','glass'].map(k=>[k,TARGET_ARCHITECTURE_PALETTE[k]])));
/** Authored architectural candidate. Local +Z faces the bay; caller owns placement/yaw.
 * Not a WFC solver, navigation installation or a mutation of the existing city. */
export function createTargetOldCity({seed=20261006,palette={},roofRoles={},streetInfill=true,wingStreets=false}={}) {
  if(typeof streetInfill!=='boolean')throw new TypeError('streetInfill must be boolean');
  if(typeof wingStreets!=='boolean')throw new TypeError('wingStreets must be boolean');
  const roleOverrides=validateTargetOldCityRoofRoles(roofRoles);
  const colours={...TARGET_OLD_CITY_PALETTE,...palette}, group=new THREE.Group();group.name='citadel-target-old-city';
  group.userData.preserveCitadelMaterials=true;
  const instances=new Set(),geometries=new Set(),materials=new Set(),footprints=[],walkable=[],houses=[],housePlans=[],facadeWindows=[],rejectedWindows=[],residentialArcades=[];
  const mats=Object.fromEntries(Object.entries(colours).map(([k,c])=>{const m=new THREE.MeshStandardMaterial({color:c,roughness:.9});m.name=`target-old-city-${k}`;m.userData={preserveCitadelMaterial:true,preserveCitadelMaterials:true,targetArchitectureColour:{version:TARGET_ARCHITECTURE_COLOUR_VERSION,role:k,albedo:c}};materials.add(m);return[k,m];}));
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
        const blocked=[...obstacles,...(p.infillObstacles??[])].find(o=>o.id!==p.id&&world[0]+ex+.06>o.min[0]&&world[0]-ex-.06<o.max[0]&&world[2]+ez+.06>o.min[2]&&world[2]-ez-.06<o.max[2]&&world[1]+.64>o.min[1]&&world[1]-.64<o.max[1]);
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
  function arch(name,x,z,w,h,r,spring,depth,base=0,parent=group,mat='stone',openingOffset=0){const s=new THREE.Shape();s.moveTo(-w/2,0);s.lineTo(-w/2,h);s.lineTo(w/2,h);s.lineTo(w/2,0);s.lineTo(openingOffset+r,0);s.lineTo(openingOffset+r,spring);for(let i=1;i<=20;i++){const a=i*Math.PI/20;s.lineTo(openingOffset+r*Math.cos(a),spring+r*Math.sin(a));}s.lineTo(openingOffset-r,0);s.closePath();return add(name,new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:20}),mat,x,base,z-depth/2,parent);}
  function mergeParts(parts,name,mat,parent){
    const positions=[],normals=[];
    for(const part of parts){part.updateMatrix();const g=part.geometry.index?part.geometry.toNonIndexed():part.geometry.clone();g.applyMatrix4(part.matrix);positions.push(...g.attributes.position.array);normals.push(...g.attributes.normal.array);g.dispose();part.removeFromParent();geometries.delete(part.geometry);part.geometry.dispose();}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));return add(name,g,mat,0,0,0,parent);
  }
  // v5 street-camera target: the high tower stays on its approved support.
  // Fixed ID slots are redistributed within the existing terrace footprints;
  // the upper right flank now balances the tower rather than leaving it at the
  // exposed end of three uniform house rows. The public front strips stay open.
  const bodyLayout={
    'house-0--1-0':[-5.65,9.4,4.6,6.1], 'house-0--1-1':[-11.1,8.9,6.15,6.8], 'house-0--1-2':[-17.05,9.25,4.75,5.3],
    'house-0-1-0':[5.55,8.85,4.5,6.8], 'house-0-1-1':[11,9.35,6.2,7.5], 'house-0-1-2':[17,8.9,4.7,5.9],
    'house-1--1-0':[-5.7,-.55,4.6,7.2], 'house-1--1-1':[-11.1,-1.15,6,6.2], 'house-1--1-2':[-17.05,-.75,4.8,5.8],
    'house-1-1-0':[5.7,-1.1,4.6,6.4], 'house-1-1-1':[11.15,-.5,6.1,9.2], 'house-1-1-2':[17.1,-1.05,4.65,7.3],
    'house-2--1-0':[-6,-10.6,4.8,5.9], 'house-2--1-1':[16.55,-10.7,4.6,7], 'house-2-1-0':[6.4,-10.95,4.8,8.8],
  },layoutChanges=[],sharedArcadeFloors=[];
  const arcadePlots=[];
  for(let row=0;row<2;row++)for(const side of[-1,1])for(let col=0;col<3;col++){
    const id=`house-${row}-${side}-${col}`,[x,z,w]=bodyLayout[id];arcadePlots.push({id,row,side,col,x,z,floor:.3+row*4,w,d:4.7});
  }
  const arcadeIds=new Set(arcadePlots.map(p=>p.id)),arcadeLinks=[],arcadePorts=new Map(arcadePlots.map(p=>[p.id,[]]));
  for(let i=0;i<arcadePlots.length;i++)for(let j=i+1;j<arcadePlots.length;j++){
    const a=arcadePlots[i],b=arcadePlots[j];if(a.row!==b.row||a.side!==b.side)continue;
    const left=a.x<b.x?a:b,right=a.x<b.x?b:a,gap=right.x-right.w/2-left.x-left.w/2;
    const zMin=Math.max(a.z-a.d/2,b.z-b.d/2),zMax=Math.min(a.z+a.d/2,b.z+b.d/2);
    if(gap<-.08||gap>.6||zMax-zMin<2.5)continue;
    const centerZ=(zMin+zMax)/2,edgeX=(left.x+left.w/2+right.x-right.w/2)/2;
    const link={id:`${left.id}--${right.id}`,houses:[left.id,right.id],source:'actual-same-level-body-adjacency',edgeX,centerZ,floorY:a.floor+.22,width:2,springY:a.floor+1.6,crownY:a.floor+2.6,bodyGap:gap,sharedDepth:zMax-zMin,publicNavigationInstalled:false};
    arcadeLinks.push(link);arcadePorts.get(left.id).push({...link,side:1,localZ:centerZ-left.z});arcadePorts.get(right.id).push({...link,side:-1,localZ:centerZ-right.z});
  }
  function arcadeBody(id,w,baseH,mat,parent,hx,hz,floor){
    const top=2.85,parts=[],stone=[],trim=[],bays=w>6?3:2,bay=w/bays,r=Math.min(.78,bay*.34),spring=1.8;
    const plot=arcadePlots.find(p=>p.id===id),inset=.3+.15*((plot.row+plot.col+(plot.side===1?1:0))%3);
    const body={id:'base',x:0,y:top,z:-inset,w:w-2*inset,d:3.45,h:baseH-top};
    const upper=bevelWall(id+'-upper-body',body.w,body.h,body.d,mat,parent);upper.position.set(0,top+body.h/2,body.z);parts.push(upper);
    const openings=[];
    for(let i=0;i<bays;i++){const x=-w/2+bay*(i+.5);for(const z of[-2.19,2.19])stone.push(arch(id+'-arcade-arch',x,z,bay,top-.10,r,spring,.32,0,parent,'stone'));openings.push({centerX:hx+x,frontZ:hz+2.35,backZ:hz-2.35,width:r*2,springY:floor+spring,crownY:floor+spring+r,floorY:floor+.22});}
    const ports=arcadePorts.get(id)??[];
    for(const side of[-1,1]){
      const port=ports.find(p=>p.side===side);
      if(!port){stone.push(box(id+'-arcade-side',.24,top-.1,4.06,side*(w/2-.12),(top-.1)/2,0,'stone',parent));continue;}
      // A true sideways arch replaces the shared solid wall. Keep the outer
      // rectangle fixed; shift only its void to match the neighbour's void.
      const wall=arch(id+'-arcade-side-port',0,0,4.7,top-.1,1,1.6,.24,0,parent,'stone',-port.localZ);
      wall.rotation.y=Math.PI/2;wall.position.set(side*(w/2-.12)-.12,0,0);stone.push(wall);
    }
    // A thin load-bearing slab caps the arches; the inset room leaves a real
    // narrow front gallery, without inventing public access to this upper deck.
    trim.push(box(id+'-arcade-deck',w,.16,4.7,0,top-.08,0,'trim',parent));
    trim.push(box(id+'-gallery-handrail',w-.25,.08,.08,0,top+.77,2.23,'trim',parent));
    const posts=Math.ceil((w-.3)/.85);for(let i=0;i<=posts;i++)trim.push(box(id+'-gallery-post',.07,.73,.07,-w/2+.15+(w-.3)*i/posts,top+.365,2.23,'trim',parent));
    for(const side of[-1,1])trim.push(box(id+'-gallery-return',.08,.08,.83,side*(w/2-.15),top+.77,1.845,'trim',parent));
    const support=mergeParts([...stone,...trim],id+'-stone-residential-arcade','stone',parent);support.userData.targetResidentialArcade=true;support.userData.targetWalkable=false;const wall=mergeParts(parts,id+'-walls',mat,parent);wall.userData.targetWall=true;
    residentialArcades.push({houseId:id,openings,sideConnections:ports.map(p=>({linkId:p.id,side:p.side,center:[p.edgeX,p.floorY,p.centerZ],width:p.width,springY:p.springY,crownY:p.crownY})),material:'stone',connectedBehindPiers:true,throughDepth:4.7,publicNavigationInstalled:false,gallery:{topY:floor+top,frontDepth:2.35-body.z-body.d/2,sideSetback:inset,publicAccess:false}});return body;
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
        if(row===2&&side===1&&col===1)continue; // stable tower-reserved ID remains absent
        const id=`house-${row}-${side}-${col}`,[hx,hz,houseWidth,designedHeight]=bodyLayout[id];
        const hash=((Math.imul(row+1,73856093)^Math.imul(col+1,19349663)^seed^(side+2)*83492791)>>>0),h=designedHeight+(hash%3-1)*.08;
        const mat=['pink','yellow','teal','yellow','blue','pink','stone','teal','yellow','blue','pink','yellow','stone','teal','pink'][houses.length%15];
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
        const oldHeight=5.8+(hash%5)*.6,oldBase=role==='hip-roof'?oldHeight:Math.max(4.6,oldHeight-1.3),oldRise={'hip-roof':1.25,'open-terrace-pavilion':3.47,'setback-upper-room':4.37,'outer-edge-short-tower':5.07,'upper-street-cupola':7.08}[role];layoutChanges.push({id,before:{position:[side*(5.8+col*5.75),floor,z-1.15+(col===1?.6:col===2?-.4:0)],width:col===1?6.7:4.85,authoredHeight:oldHeight,roofY:floor+oldBase+oldRise},after:{position:[hx,floor,hz],width:houseWidth,authoredHeight:h,roofY},supportTerrace:`terrace-${row}-${hx<0?-1:1}`});
        houses.push({id,position:[hx,floor,hz],height:baseH,authoredHeight:h,colour:mat,bodyVariant:hasArcade?'through-arcade-inset-storey':'solid-street-house',roofRole:role,roofY,volumes:volumes.map(v=>v.id==='base'&&hasArcade?{id:'base',x:0,y:0,z:0,w:houseWidth,d:4.7,h:baseH,kind:'compound-envelope',includesVoid:true}:{...v}),facadeVolumes:volumes.map(v=>({...v})),terrace});foot(id,hx,hz,houseWidth+.4,5.1,floor,roofY,{supportedBy:`terrace-${row}-${hx<0?-1:1}`});
      }
    }
  }
  // Shared lower floors bridge the small deliberate building separations. They
  // remain on the existing terrace deck and never cross its public front strip.
  for(const link of arcadeLinks){const gap=Math.max(0,link.bodyGap),depth=Math.min(2.6,link.sharedDepth-.1),floor=link.floorY-.22;
    const mesh=box(link.id+'-shared-floor',gap+.12,.22,depth,link.edgeX,floor+.11,link.centerZ,'stone');mesh.userData.targetSharedResidentialFloor=true;
    sharedArcadeFloors.push({linkId:link.id,center:[link.edgeX,link.floorY,link.centerZ],width:gap+.12,depth,supportedBy:footprints.find(f=>f.id===link.houses[0]).supportedBy});
  }
  const infillModules=[],infillWindows=[];
  // Three small clusters, not another row: two homes on the unused upper-left
  // terrace and four low attached rooms on existing residential arcade slabs.
  // The latter deliberately reclaim only the private gallery corners; the
  // public streets, lower through-arches and central gallery band remain open.
  if(streetInfill){
    const clusters=new Map();
    function infillRoom({id,x,z,w,d,h,floor,parent,colour,cluster,support,attachedTo=null}){
      const parts=clusters.get(parent)??[];clusters.set(parent,parts);
      const start=parent.children.length,wall=bevelWall(id+'-wall',w,h,d,colour,parent);wall.position.set(x,floor+h/2,z);wall.userData.targetWall=!!attachedTo;
      // A low hip with a shallow rise stays subordinate to the existing roofs.
      const roofStart=parent.children.length;roof(id+'-roof',x,floor+h,z,w+.16,d+.16,parent);
      parent.children[roofStart].scale.y=.52;
      box(id+'-cornice',w+.12,.10,d+.12,x,floor+h-.07,z,'trim',parent);
      for(const dx of w>3?[-.95,.95]:[0]){
        const wx=x+dx,wy=floor+Math.min(1.3,h*.58),wz=z+d/2;
        box(id+'-window',.43,.54,.04,wx,wy,wz+.023,'glass',parent);
        for(const[a,b,ww,hh]of[[-.26,0,.07,.68],[.26,0,.07,.68],[0,.305,.59,.07],[0,-.305,.59,.07]])box(id+'-frame',ww,hh,.075,wx+a,wy+b,wz+.047,'trim',parent);
        infillWindows.push({moduleId:id,position:[wx+parent.position.x,wy+parent.position.y,wz+parent.position.z],width:.59,height:.68});
      }
      parts.push(...parent.children.slice(start));
      const px=x+parent.position.x,pz=z+parent.position.z,py=floor+parent.position.y;
      infillModules.push({id,cluster,attachedTo,colour,position:[px,py,pz],width:w,depth:d,height:h,roofY:py+h+.65,polygon:[[px-w/2-.08,pz-d/2-.08],[px+w/2+.08,pz-d/2-.08],[px+w/2+.08,pz+d/2+.08],[px-w/2-.08,pz+d/2+.08]],support,publicAccess:false});
    }
    const upper=new THREE.Group();upper.name='old-city-upper-left-street-infill';upper.userData.targetStreetInfill=true;group.add(upper);
    for(const [i,x,h,colour]of[[0,-16.65,3.45,'yellow'],[1,-11.9,4.1,'teal']])infillRoom({id:`street-infill-upper-${i}`,x,z:-10.9,w:4.55,d:4.35,h,floor:8.3,parent:upper,colour,cluster:'upper-left',support:{mesh:'terrace-2--1-deck',top:8.3}});
    const joint=box('street-infill-party-link',.24,3.45,4.35,-14.275,8.3+3.45/2,-10.9,'yellow',upper);clusters.get(upper).push(joint);
    for(const id of ['house-1--1-1','house-0-1-1']){
      const p=housePlans.find(p=>p.id===id),h=houses.find(h=>h.id===id),cluster=id==='house-1--1-1'?'middle-left':'lower-right';p.infillObstacles=[];
      for(const side of[-1,1]){
        const x=side*(p.w/2-1.12),z=1.37,w=1.8,d=1.45,floor=2.85,height=1.98,moduleId=`street-infill-${id}-${side}`;
        infillRoom({id:moduleId,x,z,w,d,h:height,floor,parent:p.root,colour:h.colour,cluster,attachedTo:id,support:{mesh:id+'-stone-residential-arcade',top:p.floor+floor}});
        p.infillObstacles.push({id:moduleId,min:[p.hx+x-w/2,p.floor+floor,p.hz+z-d/2],max:[p.hx+x+w/2,p.floor+floor+height+.65,p.hz+z+d/2]});
      }
      residentialArcades.find(a=>a.houseId===id).gallery.privateCornerRooms=p.infillObstacles.map(o=>o.id);
    }
    // Merge only the new parts by material and owner. Attached wings remain
    // inside their editable house group; public supporting slabs remain outside.
    for(const [parent,parts]of clusters){const batches=new Map();for(const part of parts){const key=Object.keys(mats).find(k=>mats[k]===part.material);if(!batches.has(key))batches.set(key,[]);batches.get(key).push(part);}
      for(const [mat,meshes]of batches){const merged=mergeParts(meshes,parent.name+'-infill-'+mat,mat,parent);merged.userData.targetStreetInfill=true;if(parent.userData.targetEditableHouse&&mat===parent.userData.targetEditableHouse.colour)merged.userData.targetWall=true;}
    }
  }
  detailHouseWindows();
  if(streetInfill)for(const id of ['house-1--1-1','house-0-1-1']){
    const p=housePlans.find(p=>p.id===id),colour=p.root.userData.targetEditableHouse.colour;
    for(const [mat,suffix]of[[colour,'walls'],['glass','windows-glass'],['trim','windows-trim'],['roof','roof'],['roofLight','drip-edge']]){
      const old=p.root.getObjectByName(id+'-'+suffix),extra=p.root.getObjectByName(id+'-infill-'+mat);if(!old||!extra)continue;
      const metadata={...old.userData},merged=mergeParts([old,extra],old.name,mat,p.root);Object.assign(merged.userData,metadata);
    }
  }
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
  const towerWindows=[],towerPanes=[],towerFrames=[];
  for(const y of[11,14.5,18,21.5,25])for(let side=0;side<4;side++){
    const yaw=side*Math.PI/2,rot=new THREE.Matrix4().makeRotationY(yaw),basePoint=new THREE.Vector3(tx,y,tz);
    const pane=box('tower-window-pane',.48,.74,.04,0,0,1.602,'glass');pane.applyMatrix4(rot);pane.position.add(basePoint);towerPanes.push(pane);
    for(const [x,dy,w,h,d]of[[-.285,0,.09,.94,.10],[.285,0,.09,.94,.10],[0,.425,.66,.09,.10],[0,-.425,.72,.11,.16]]){
      const frame=box('tower-window-white-reveal',w,h,d,x,dy,1.625,'trim');frame.applyMatrix4(rot);frame.position.add(basePoint);towerFrames.push(frame);
    }
    towerWindows.push({side,y,width:.72,height:.94,normal:[Math.sin(yaw),0,Math.cos(yaw)]});
  }
  mergeParts(towerPanes,'tower-window-panes-batched','glass',group);
  mergeParts(towerFrames,'tower-window-reveals-batched','trim',group);
  for(const y of[12,17,22])box('tower-belt',3.3,.18,3.3,tx,y-1.4,tz,'stone');
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
  const report={version:'target-old-city-11-three-street-clusters',seed,origin:'platform-local ground; +Z bay/front',palette:colours,footprints,houses,streetInfill:{enabled:streetInfill,modules:infillModules,windows:infillWindows,clusters:['upper-left','middle-left','lower-right'],existingPlotsUnchanged:true,privateGalleryCornersReclaimed:streetInfill,publicRoutesChanged:false,wfcDomainExpanded:false,newUpperHomesEditable:false},layoutRedistribution:{target:'target-v5-street-cameras.png',method:'authored tower flanks, uneven terrace positions, height falloff and three upper-wall setbacks; not WFC positioning',towerPosition:[11.55,8.3,-11.15],towerMoved:false,existingPublicRoutesChanged:false,terrainChanged:false,changes:layoutChanges},walkable,towerWindows,facadeWindows,rejectedWindows,residentialArcades,streetArcades:{selection:'first two inhabited levels; fixed actual same-level plot adjacency',groups:[0,1].flatMap(row=>[-1,1].map(side=>({id:`street-arcade-${row}-${side}`,houses:arcadePlots.filter(p=>p.row===row&&p.side===side).map(p=>p.id)}))),links:arcadeLinks,sharedFloors:sharedArcadeFloors,publicGeometryChanged:false,terrainChanged:false,publicNavigationInstalled:false,galleryAccessClaimed:false},roofRoleSelection:{method:Object.keys(roleOverrides).length?'validated explicit role overrides':'deterministic authored terrace-level and plot-edge rules',overrides:roleOverrides,wfc:false,solverRun:false,modifiedHouseCount:houses.filter(h=>h.roofRole!=='hip-roof').length},houseGrouping:{stableIds:true,windowMaterialBatchesPerHouse:2,editorIntegrated:false,wfcIntegrated:false},
    bounds:{min:bounds.min.toArray(),max:bounds.max.toArray(),size:bounds.getSize(new THREE.Vector3()).toArray()},
    entry:{position:[0,.3,16.3],outward:[0,0,1],clearWidth:4.2,rectangularClearHeight:3.25},
    exits:{upperStreet:[0,8.3,-12.5],bridge:[19.8,.3,12.4],waterfallFeed:[11,.3,13.7]},
    stairs:{from:[0,.3,10],to:[0,8.3,-10],steps:40,rise:.2,tread:.5,width:4.4},
    performance:{meshes,triangles,materials:materials.size,geometries:geometries.size},
    validation:{gpuIntegrated:false,visualScore:null,navigationInstalled:false,surfaceSeated:false},
    limitations:['Hand-authored candidate, not WFC or editable cell generation.','External bridge, waterfall feed and platform seating require integration.','Terrace-side access joins require runtime walkability checks; visual geometry is not a collision installation.']};
  group.userData.targetArchitectureReport=report;let disposed=false,activeWings=null;
  report.wingStreets={enabled:false,requested:wingStreets,status:wingStreets?'awaiting-actual-surface':'disabled',version:'old-wing-streets-1'};
  /** Post-placement candidate. Surface callback and protection polygons are in
   * this old-city group's LOCAL coordinates; collisionGroups are actual WORLD
   * scene objects. No surface fallback, new terrain or shared platform is made.
   * New rooms are protected architecture, outside the fifteen editable plots. */
  function completeWingStreets({enabled=wingStreets,sampleSurface,collisionGroups=[],protectedFootprints=[]}={}){
    if(disposed)throw new Error('OLD_WING_CITY_DISPOSED');
    if(!enabled)return null;
    if(activeWings)throw new Error('OLD_WINGS_ALREADY_INSTALLED');
    if(typeof sampleSurface!=='function'||!Array.isArray(collisionGroups)||!Array.isArray(protectedFootprints))throw new TypeError('OLD_WINGS_REQUIRE_ACTUAL_SURFACE_AND_PROTECTIONS');
    group.updateWorldMatrix(true,true);const inverse=group.matrixWorld.clone().invert(),obstacles=[];
    const roots=[group,...collisionGroups],seen=new Set();
    for(const root of roots){if(!root?.isObject3D)throw new TypeError('OLD_WING_COLLISION_GROUP');root.updateWorldMatrix(true,true);root.traverse(mesh=>{
      if(!mesh.isMesh||seen.has(mesh))return;seen.add(mesh);
      for(let p=mesh;p;p=p.parent)if(!p.visible)return;
      const base=inverse.clone().multiply(mesh.matrixWorld),p=mesh.geometry.attributes.position;if(!p)return;
      const transforms=[];if(mesh.isInstancedMesh){for(let i=0;i<mesh.count;i++){const m=new THREE.Matrix4();mesh.getMatrixAt(i,m);if(Math.abs(m.determinant())>1e-12)transforms.push(base.clone().multiply(m));}}else transforms.push(base);
      const localBounds=new THREE.Box3().setFromBufferAttribute(p);for(const matrix of transforms)obstacles.push({mesh,matrix,box:localBounds.clone().applyMatrix4(matrix)});
    });}
    const protectedRects=[{id:'central-street',polygon:[[-2.7,-14],[2.7,-14],[2.7,18],[-2.7,18]]},...[-7.6,2.4,12.4].map(z=>({id:'public-cross-street-'+z,polygon:[[-30,z-.75],[30,z-.75],[30,z+.75],[-30,z+.75]]})),...protectedFootprints];
    for(const p of protectedRects)if(!Array.isArray(p.polygon)||p.polygon.length<3||p.polygon.some(v=>v.length!==2||!v.every(Number.isFinite)))throw new TypeError('OLD_WING_PROTECTED_POLYGON');
    const overlaps=(a,b)=>{for(const poly of[a,b])for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],axis=[p[1]-q[1],q[0]-p[0]],aa=a.map(v=>v[0]*axis[0]+v[1]*axis[1]),bb=b.map(v=>v[0]*axis[0]+v[1]*axis[1]);if(Math.max(...aa)<=Math.min(...bb)||Math.max(...bb)<=Math.min(...aa))return false;}return true;};
    const triangle=new THREE.Triangle();let triangleTests=0;
    function collision(box){for(const o of obstacles){if(!box.intersectsBox(o.box))continue;const g=o.mesh.geometry,p=g.attributes.position,idx=g.index,start=g.drawRange.start,end=Math.min(idx?.count??p.count,start+g.drawRange.count);for(let i=start;i+2<end;i+=3){for(const[v,j]of[[triangle.a,0],[triangle.b,1],[triangle.c,2]])v.fromBufferAttribute(p,idx?idx.getX(i+j):i+j).applyMatrix4(o.matrix);triangleTests++;if(box.intersectsTriangle(triangle))return o.mesh.name;}}return null;}
    const accepted=[],rejected=[];
    // Four paired street edges. The two z bands leave all three public cross
    // streets intact. A shallow outer footprint stops before the west cliff.
    for(const side of[-1,1])for(const band of['middle','front']){
      const id=`old-wing-${side}-${band}`,x=side*22.05,zs=band==='middle'?[-3.95,-.75]:[5.45,8.65],w=3.65,d=3.2,heights=band==='middle'?[6.1,5.15]:[4.7,3.85];
      const plans=zs.map((z,i)=>({id:id+'-'+i,x,z,w,d,h:heights[i],side,colour:side===-1?['yellow','teal'][i]:['pink','blue'][i],polygon:[[x-w/2-.07,z-d/2],[x+w/2+.07,z-d/2],[x+w/2+.07,z+d/2],[x-w/2-.07,z+d/2]],samples:[]}));
      let reason=null;
      for(const p of plans){const blocked=protectedRects.find(q=>overlaps(p.polygon,q.polygon));if(blocked){reason={kind:'protected-footprint',id:blocked.id};break;}
        for(let ix=0;ix<=8;ix++)for(let iz=0;iz<=7;iz++){const sx=p.x-p.w/2+p.w*ix/8,sz=p.z-p.d/2+p.d*iz/7,result=sampleSurface(sx,sz),height=typeof result==='number'?result:result?.height;p.samples.push({x:sx,z:sz,height});if(!Number.isFinite(height))reason={kind:'missing-actual-support',at:[sx,sz]};}
      }
      const samples=plans.flatMap(p=>p.samples),finite=samples.map(p=>p.height).filter(Number.isFinite),lo=finite.length?Math.min(...finite):null,hi=finite.length?Math.max(...finite):null;
      if(!reason&&hi-lo>1.25)reason={kind:'unsupported-height-spread',spread:hi-lo,maximum:1.25};
      const floor=hi+.05;
      if(!reason)for(const p of plans){const box=new THREE.Box3(new THREE.Vector3(p.x-p.w/2-.07,floor+.025,p.z-p.d/2),new THREE.Vector3(p.x+p.w/2+.07,floor+p.h+.72,p.z+p.d/2)),hit=collision(box);if(hit){reason={kind:'actual-obstacle-triangle',mesh:hit};break;}}
      if(reason){rejected.push({id,reason,plans:plans.map(p=>({id:p.id,polygon:p.polygon})),supportRange:[lo,hi]});continue;}
      accepted.push({id,side,band,floor,supportRange:[lo,hi],plans});
    }
    const candidate=new THREE.Group();candidate.name='old-city-continuous-wing-streets';candidate.userData={preserveCitadelMaterials:true,targetWingStreets:true,targetProtectedArchitecture:true};
    const before={version:report.version,bounds:report.bounds,performance:report.performance,wingStreets:report.wingStreets},owned=new Set(),modules=[],doors=[];let installed=false,closed=false;
    const cleanup=()=>{candidate.removeFromParent();candidate.traverse(o=>{if(o.isMesh)owned.add(o.geometry);});owned.forEach(g=>{geometries.delete(g);g.dispose();});candidate.clear();};
    try{
      for(const side of[-1,1]){const parent=new THREE.Group();parent.name='old-wing-side-'+side;candidate.add(parent);
        for(const pair of accepted.filter(p=>p.side===side)){
          for(const[pindex,p]of pair.plans.entries()){
            const y=pair.floor,id=p.id;
            // Short fitted stone footing: edge bottoms use the actual sampled
            // contour. There is no tall common plinth filling the cliff.
            const edges=[p.samples.filter((_,i)=>i<8),p.samples.filter((_,i)=>i%8===7),p.samples.filter((_,i)=>i>=64).reverse(),p.samples.filter((_,i)=>i%8===0).reverse()],positions=[];
            for(const edge of edges)for(let j=0;j<edge.length-1;j++){const a=edge[j],b=edge[j+1];positions.push(a.x,a.height-.025,a.z,b.x,b.height-.025,b.z,b.x,y,b.z,a.x,a.height-.025,a.z,b.x,y,b.z,a.x,y,a.z);}
            const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();add(id+'-fitted-footing',g,'stone',0,0,0,parent);
            box(id+'-floor',p.w,.10,p.d,p.x,y+.05,p.z,'stone',parent);
            const front=arch(id+'-real-door',0,0,p.d,p.h,.52,1.65,.22,0,parent,p.colour);front.rotation.y=Math.PI/2;front.position.set(p.x+side*(p.w/2-.11)-.11,y,p.z);
            box(id+'-rear-wall',.22,p.h,p.d,p.x-side*(p.w/2-.11),y+p.h/2,p.z,p.colour,parent);
            // Single party wall owns the shared edge; two upper hips remain
            // visibly stepped instead of duplicating two overlapping walls.
            if(pindex===0)box(id+'-party-wall',p.w,Math.max(...pair.plans.map(q=>q.h)),.20,p.x,y+Math.max(...pair.plans.map(q=>q.h))/2,p.z+p.d/2,p.colour,parent);
            box(id+'-end-wall',p.w,p.h,.20,p.x,y+p.h/2,p.z+(pindex===0?-1:1)*(p.d/2-.10),p.colour,parent);
            const n=parent.children.length;roof(id+'-hip',p.x,y+p.h,p.z,p.w+.12,p.d,parent);parent.children[n].scale.y=.56;
            // Front windows are on the coloured outer facade, above the door;
            // no window is created on the shared party wall.
            for(const dz of[-.9,.9]){const frame=new THREE.Group();frame.position.set(p.x+side*p.w/2,y+p.h-.95,p.z+dz);frame.rotation.y=side*Math.PI/2;parent.add(frame);box(id+'-pane',.44,.56,.035,0,0,.02,'glass',frame);for(const[a,b,ww,hh]of[[-.26,0,.07,.70],[.26,0,.07,.70],[0,.315,.59,.07],[0,-.315,.59,.07]])box(id+'-white-window',ww,hh,.07,a,b,.04,'trim',frame);frame.updateMatrix();for(const child of [...frame.children]){child.updateMatrix();child.applyMatrix4(frame.matrix);parent.add(child);}parent.remove(frame);}
            modules.push({id,cluster:pair.id,position:[p.x,y,p.z],width:p.w,depth:p.d,height:p.h,roofY:y+p.h+.70,colour:p.colour,polygon:p.polygon,supportSamples:p.samples,supportRange:pair.supportRange,foundationMaximumHeight:y-pair.supportRange[0],publicAccess:false,editable:false});
            doors.push({moduleId:id,position:[p.x+side*p.w/2,y+.10,p.z],normal:[side,0,0],width:1.04,springHeight:1.65,privateInterior:true,throughPassage:false});
          }
        }
        const batches=new Map();for(const part of [...parent.children]){const mat=Object.keys(mats).find(k=>mats[k]===part.material);if(!batches.has(mat))batches.set(mat,[]);batches.get(mat).push(part);}
        for(const[mat,parts]of batches){const m=mergeParts(parts,parent.name+'-'+mat,mat,parent);m.userData.targetWingStreets=true;m.userData.targetWalkable=false;m.userData.targetProtectedArchitecture=true;m.userData.targetWingModuleIds=modules.filter(p=>Math.sign(p.position[0])===side).map(p=>p.id);owned.add(m.geometry);}
      }
      const next={version:'old-wing-streets-1',enabled:true,status:modules.length?'installed-candidate':'no-safe-pairs',modules,doors,rejected,protectedFootprints:protectedRects,triangleTests,supportSampleCount:modules.reduce((n,p)=>n+p.supportSamples.length,0),baseCityUnchanged:true,terrainChanged:false,wfcDomainExpanded:false,gpuVerified:false,visualAccepted:false};
      group.add(candidate);group.updateWorldMatrix(true,true);let meshes=0,triangles=0;candidate.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});next.performance={meshes,triangles,newMaterials:0};
      // Bounds are reported in factory-local space even after world placement.
      const b=new THREE.Box3(new THREE.Vector3(...before.bounds.min),new THREE.Vector3(...before.bounds.max));candidate.traverse(o=>{if(!o.isMesh)return;const bb=new THREE.Box3().setFromBufferAttribute(o.geometry.attributes.position);b.union(bb.applyMatrix4(inverse.clone().multiply(o.matrixWorld)));});
      report.bounds={min:b.min.toArray(),max:b.max.toArray(),size:b.getSize(new THREE.Vector3()).toArray()};report.performance={...before.performance,meshes:before.performance.meshes+meshes,triangles:before.performance.triangles+triangles,geometries:geometries.size};report.wingStreets=next;report.version='target-old-city-12-wing-streets-candidate';installed=true;
      activeWings={group:candidate,report:next,dispose(){if(closed)return;closed=true;cleanup();if(installed){Object.assign(report,before);activeWings=null;}}};return activeWings;
    }catch(error){cleanup();throw error;}
  }
  return{group,report,completeWingStreets,dispose(){if(disposed)return;activeWings?.dispose();disposed=true;group.removeFromParent();instances.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());group.clear();}};
}
