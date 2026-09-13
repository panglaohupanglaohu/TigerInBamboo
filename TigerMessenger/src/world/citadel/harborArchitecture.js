import * as THREE from 'three';
import {mergeStaticGroup} from '../geometryMerge.js';
import {nightWeightAt} from '../../render/lighting/highlandLightVolumes.js';
let sharedCanvasMap;

// Reference-derived harbor kit. Coordinates belong to castleContainer, not world.
// The shops sit on the existing plaza/harbor shelf; nothing enters x=42 stairs,
// x=60 processional route, the statue ring, or the horse's z=67.7..75.3 berth.
export function buildHarborArchitecture(waterHeight, options = {}) {
  const root = new THREE.Group();
  root.name = 'citadel-harbor-architecture';
  const material = (name, color, roughness = .9) => new THREE.MeshStandardMaterial({name, color, roughness});
  const stone = material('harbor-limestone', 0xe0d9c8);
  const trim = material('harbor-cut-stone', 0xbcb9aa);
  const blue = material('harbor-cobalt-roof', 0x2059a6, .77);
  const cloth = material('harbor-blue-canvas', 0x3d75b5);
  cloth.side = THREE.DoubleSide;
  if(typeof document!=='undefined'){
    const canvasMap=sharedCanvasMap??=new THREE.TextureLoader().load(new URL('../../../assets/textures/citadel/blue-woven-canvas-v1.png',import.meta.url).href);
    canvasMap.colorSpace=THREE.SRGBColorSpace;canvasMap.wrapS=canvasMap.wrapT=THREE.RepeatWrapping;
    cloth.map=canvasMap;cloth.color.setHex(0xffffff);
  }
  const wood = material('harbor-oak', 0x846445);
  const dark = material('harbor-timber-recess', 0x443b32);
  const rope = material('harbor-hemp-brass', 0xb79860);
  const glow = material('harbor-amber-window', 0xeac385, .75);
  glow.emissive.setHex(0xffab52);
  const lanterns = [];
  const windows = [];
  function mesh(name, geometry, mat, x, y, z) {
    const item = new THREE.Mesh(geometry, mat);
    item.name = name;
    item.position.set(x, y, z);
    item.castShadow = mat !== glow;
    item.receiveShadow = true;
    root.add(item);
    return item;
  }
  function box(name, x, y, z, w, h, d, mat = stone) {
    return mesh(name, new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  }
  function bar(name, a, b, radius, mat = wood) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const item = mesh(name, new THREE.CylinderGeometry(radius, radius, start.distanceTo(end), 6), mat,
      (a[0]+b[0])/2, (a[1]+b[1])/2, (a[2]+b[2])/2);
    item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
    return item;
  }
  function archPanel(x, y, z, width, height, opening, spring, depth) {
    // Concave wall section with a genuine bottom-open arch, not a painted door.
    const s = new THREE.Shape(), r = opening/2;
    s.moveTo(-width/2, 0); s.lineTo(-width/2, height);
    s.lineTo(width/2, height); s.lineTo(width/2, 0);
    s.lineTo(r, 0); s.lineTo(r, spring);
    s.absarc(0, spring, r, 0, Math.PI, false);
    s.lineTo(-r, 0); s.closePath();
    mesh('harbor-open-arcade', new THREE.ExtrudeGeometry(s, {depth, bevelEnabled:false, curveSegments:10}), stone, x, y, z-depth/2);
    // Individual voussoirs make the rounded aperture legible from the harbor.
    for (let i=0;i<9;i++) {
      const a=(i+.5)*Math.PI/9;
      const m=box('harbor-arch-voussoir', x+Math.cos(a)*(r+.10), y+spring+Math.sin(a)*(r+.10), z+depth*.54,
        .18, .29, .11, trim);
      m.rotation.z=a-Math.PI/2;
    }
  }
  function hipRoof(x, y, z, w, d, h) {
    const p=[[-w/2,0,-d/2],[w/2,0,-d/2],[w/2,0,d/2],[-w/2,0,d/2],[-w*.25,h,0],[w*.25,h,0]];
    const indices=[0,4,5,0,5,1,1,5,2,2,5,4,2,4,3,3,4,0];
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(indices.flatMap(i=>p[i]),3));g.computeVertexNormals();
    mesh('harbor-hipped-blue-roof', g, blue, x, y, z);
    box('harbor-roof-ridge', x,y+h+.035,z,w*.52,.10,.14,blue);
    box('harbor-eave-shadow',x,y-.05,z,w,.10,d,dark);
  }
  function lantern(x, y, z) {
    bar('harbor-lantern-hook',[x,y+.6,z-.26],[x,y+.6,z],.045,dark);
    box('harbor-lantern-glass',x,y+.21,z,.23,.40,.23,glow);
    for (const dx of [-.145,.145])for(const dz of [-.145,.145])
      box('harbor-lantern-cage',x+dx,y+.21,z+dz,.035,.45,.035,dark);
    mesh('harbor-lantern-cap',new THREE.ConeGeometry(.26,.15,4),dark,x,y+.49,z).rotation.y=Math.PI/4;
    box('harbor-lantern-foot',x,y-.025,z,.33,.06,.33,dark);
    lanterns.push([x,y+.21,z]);
  }
  function crate(x,y,z,s=1) {
    box('harbor-crate-core',x,y+s*.42,z,s*.92,s*.84,s*.85,dark);
    for(let i=0;i<4;i++){
      for(const sign of [-1,1])box('harbor-crate-plank',x+(i-1.5)*s*.23,y+s*.42,z+sign*s*.445,s*.20,s*.80,s*.055,wood);
      box('harbor-crate-lid',x+(i-1.5)*s*.23,y+s*.87,z,s*.20,s*.055,s*.95,wood);
    }
    for(const sign of [-1,1])for(const dy of [.12,.73])box('harbor-crate-batten',x,y+s*dy,z+sign*s*.49,s,.085*s,.075*s,rope);
    bar('harbor-crate-brace',[x-s*.39,y+s*.15,z+s*.53],[x+s*.39,y+s*.70,z+s*.53],s*.055,wood);
  }
  function awning(x,y,z,w,reach,ground=()=>4) {
    const pts=[],ids=[],uvs=[],segments=12;
    for(let i=0;i<=segments;i++){
      const t=i/segments;
      for(const side of [-1,1]){pts.push(x+side*w/2,y-.45*t-.18*Math.sin(Math.PI*t),z+reach*t);uvs.push((side+1)/2,t);}
      if(i<segments){const a=i*2;ids.push(a,a+1,a+2,a+1,a+3,a+2);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(ids);g.computeVertexNormals();
    mesh('harbor-sagging-canvas',g,cloth,0,0,0);
    for(const side of [-1,1]){
      bar('harbor-canopy-post',[x+side*w/2,ground(x+side*w/2,z+reach),z+reach],[x+side*w/2,y-.36,z+reach],.055);
      bar('harbor-canopy-side',[x+side*w/2,y,z],[x+side*w/2,y-.45,z+reach],.045);
    }
    bar('harbor-canopy-front',[x-w/2,y-.45,z+reach],[x+w/2,y-.45,z+reach],.06);
    for(let i=0;i<7;i++)box('harbor-canvas-valance',x+(i-3)*w/7,y-.56,z+reach,w/7-.025,.23,.035,cloth);
  }
  function shop({id,x,z,w,d,h,bays,facade,canopyReach=1.4,counter=false}) {
    const y=4, front=z+d/2;
    box('harbor-shop-floor',x,3.97,z,w,.06,d,trim);
    box('harbor-shop-rear-wall',x,y+h/2,z-d/2,w,h,.28);
    // Side walls retain real windows with four masonry sections around each opening.
    for(const side of [-1,1]){
      const sx=x+side*w/2, opening=.64, sill=1.05, top=2.35;
      box('harbor-window-sill-wall',sx,y+sill/2,z,.28,sill,d);
      box('harbor-window-head-wall',sx,y+(h+top)/2,z,.28,h-top,d);
      for(const sign of [-1,1])box('harbor-window-side-wall',sx,y+(sill+top)/2,z+sign*(d+opening)/4,.28,top-sill,(d-opening)/2);
      box('harbor-window-glazing',sx,y+(sill+top)/2,z,.06,top-sill-.07,opening-.06,glow);
      box('harbor-window-mullion',sx+side*.16,y+(sill+top)/2,z,.05,top-sill,.07,wood);
      box('harbor-window-sill',sx,y+sill,z,.48,.10,opening+.2,trim);
      windows.push([sx,y+(sill+top)/2,z]);
    }
    for(let i=0;i<bays;i++){
      const sx=x+(i-(bays-1)/2)*w/bays;
      if(facade && !['arch','slit'].includes(facade[i]))box('harbor-wfc-solid-bay',sx,y+h/2,front,w/bays,h,.30);
      else archPanel(sx,y,front,w/bays,h,facade?Math.min(1.8,w/bays-.35):Math.min(1.62,w/bays-.55),1.6,.30);
    }
    box('harbor-shop-cornice',x,y+h+.02,z,w+.24,.20,d+.24,trim);
    hipRoof(x,y+h+.14,z,w+.42,d+.42,.93);
    awning(x,y+2.82,front+.20,w-.35,canopyReach);
    if(counter){
      box('harbor-market-counter',x,y+.85,front+.80,w*.64,.12,.65,wood);
      for(const side of [-1,1])box('harbor-counter-leg',x+side*w*.27,y+.40,front+.80,.12,.80,.48,dark);
      for(const side of [-1,1])crate(x+side*w*.18,y+.91,front+.80,.32);
    }
    lantern(x-w/2+.24,y+1.82,front+.32);
    lantern(x+w/2-.24,y+1.82,front+.32);
    crate(x-w*.24,y,z-.7,.70);
    crate(x+w*.22,y,z-.6,.85);
    root.userData.shops.push({id,position:[x,y,z],footprint:[w,d],front,roofTop:y+h+1.07});
  }
  root.userData.shops=[];
  for(const stall of options.stalls||[]){
    const {x,y,z,w,reach}=stall;
    awning(x,y+2.82,z,w,reach,options.ground||(()=>y));
    root.userData.shops.push({id:stall.id,position:[x,y,z],footprint:[w,reach],type:'open-canvas-stall'});
  }
  if(options.shops)for(const spec of options.shops)shop(spec);
  else {shop({id:'quayside-arcade',x:48.8,z:68.1,w:5.7,d:6.2,h:3.35,bays:3});
  shop({id:'east-harbor-provisioner',x:69.8,z:62.9,w:3.0,d:3.7,h:3.7,bays:1});}
  // Low seaward edge, on the plaza's existing x=44 foundation. It stops before
  // the harbor top landing z=78 so the player can reach the descent unchanged.
  if(options.perimeter!==false)for(let i=0;i<6;i++){
    const z=62.2+i*2.15;
    box('harbor-quay-low-wall',44.48,4.34,z,.48,.68,2.05);
    box('harbor-quay-coping',44.48,4.74,z,.67,.14,2.1,trim);
  }
  // Cargo and mooring fittings stay at the outer dock edges, not on its centerline.
  if(options.mooring!==false){const dockY=waterHeight(30.5,56)+.9;
  for(const x of [32.6,38.2]){
    bar('harbor-mooring-post',[x,dockY,59.35],[x,dockY+.7,59.35],.13);
    box('harbor-mooring-cap',x,dockY+.66,59.35,.38,.10,.31,dark);
    for(let j=0;j<3;j++){
      const ring=mesh('harbor-coiled-rope',new THREE.TorusGeometry(.20+j*.075,.03,4,12),rope,x+.58,dockY+.06+j*.01,59.3);
      ring.rotation.x=Math.PI/2;
    }
  }
  crate(40.9,dockY,56.8,.66);
  crate(40.13,dockY,56.8,.55); }
  mergeStaticGroup(root,{mergedTag:'citadel-harbor-architecture',onSurface:(m,mat)=>{
    m.name='harbor-detail-'+mat.name;
  }});
  root.userData.lanterns=lanterns;
  root.userData.windows=windows;
  root.userData.sourceId='citadel-reference-harbor-architecture-v1';
  root.userData.visualOnly=true;
  root.userData.update=(phase)=>{
    const weight=nightWeightAt(phase);
    glow.emissiveIntensity=weight*2.1;
    root.userData.nightWeight=weight;
  };
  root.userData.update(.5);
  return root;
}
