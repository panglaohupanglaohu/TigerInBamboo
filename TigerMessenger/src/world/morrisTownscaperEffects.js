// REACode scene/shore integration in the island's local tangent frame.
import * as THREE from 'three';
import {styleMat} from '../style/materials.js';
import {buildShore,makeSkirtMaterial,makeWaveMaterial} from '../vendor/townscaper-rea/shore.js';
import {buildShoreWaves,makeShoreWaveMaterial} from '../vendor/townscaper-rea/engine/waves.js';
import {createBacklitRim} from '../vendor/townscaper-rea/engine/backlit.js';
import {createWaterVolume} from '../vendor/townscaper-rea/engine/watervol.js';
import {MAX_HEIGHT,pointInQuad} from '../vendor/townscaper-rea/town.js';
import {morrisViewer} from './morrisViewer.js';
import {createMorrisTownLighting} from './morrisTownscaperLighting.js';
import {Birds} from '../vendor/townscaper-rea/birds.js';
import {P} from '../core/params.js';
export function createMorrisTownEffects({root,water,builder,town,grid,index,scale=3}){
 const state={},group=new THREE.Group();group.name='morris-townscaper-local-frame';group.position.y=water.position.y;group.scale.setScalar(scale);root.add(group);
 const time={value:0},shallow={value:new THREE.Color('#5f9fa8')},deep={value:new THREE.Color('#4f8f99')},sky={value:new THREE.Color('#78b1b8')};
 const birds=new Birds({town,grid,index,levelHeight:.5,water:shallow,max:96,seed:7});
 birds.group.name='morris-townscaper-gulls';group.add(birds.group);
 let birdTimer=null,birdsReady=false,lastBirdTime=performance.now()/1000;
 const scheduleBirds=()=>{if(birdTimer!==null)clearTimeout(birdTimer);birdTimer=setTimeout(()=>{birdTimer=null;birds.refresh(state.mesh.geometry);},birdsReady?450:0);birdsReady=true;};
    state.material = styleMat('morris.townscaperEffects.town-voxels','MeshStandardMaterial',{ vertexColors: true, roughness: 0.92, metalness: 0.0 });
    // Night: window glass glows (aGlow is baked per vertex by the mesher).
    state.nightUniform = { value: 0 };
    state.material.onBeforeCompile = (shader) => {
      shader.uniforms.uNight = state.nightUniform;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aGlow;\nvarying float vGlow;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uNight;\nvarying float vGlow;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.72, 0.32) * vGlow * uNight * 1.6;');
    };
    state.mesh = new THREE.Mesh(builder.geometry, state.material);
    state.mesh.castShadow = true;
    state.mesh.receiveShadow = true;
    group.add(state.mesh);

    // Reflection: the town mirrored under the water line, flattened toward a
    // colour halfway between itself and the sea (1215644531221311488: "the
    // bright colors wouldn't let me get away with a monochrome reflection, so
    // I had to figure out this somewhat abstract flat colored mid point").
    state.reflectMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      uniforms: { uTime: time, uWater: shallow, uNight: state.nightUniform },
      vertexShader: /* glsl */ `
        uniform float uTime;
        attribute float aGlow;
        varying vec3 vCol;
        varying float vDepth;
        varying float vGlow;
        void main() {
          vec3 p = position;
          p.x += sin(p.y * 9.0 + uTime * 1.3 + p.z * .7) * .018 * p.y;
          p.z += cos(p.y * 7.0 - uTime * 1.1 + p.x * .5) * .012 * p.y;
          vec4 w = modelMatrix * vec4(p, 1.0);
          vDepth = position.y;


          vCol = color;
          vGlow = aGlow;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uWater;
        uniform float uNight;
        varying vec3 vCol;
        varying float vDepth;
        varying float vGlow;
        void main() {
          vec3 mid = mix(uWater, vCol * 1.25 + 0.04, 0.5);
          mid += vec3(1.0, 0.7, 0.3) * vGlow * uNight * 0.6;
          float fade = exp(-vDepth * 0.9);
          gl_FragColor = vec4(mid, 0.82 * fade);
          #include <colorspace_fragment>
        }`,
    });
    state.reflection = new THREE.Mesh(builder.geometry, state.reflectMaterial);
    state.reflection.scale.y = -1;
    state.reflection.renderOrder = 1;
    group.add(state.reflection);

    const waterMaterial = new THREE.ShaderMaterial({
      side:THREE.DoubleSide,
      uniforms: {uTime:time,uShallow:shallow,uDeep:deep,uSky:sky},
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = position / 3.0;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uShallow;
        uniform vec3 uDeep;
        uniform vec3 uSky;
        varying vec3 vWorld;
        void main() {
          // barely-there drift so the flat sea is not dead (1991103578011029507:
          // "a dynamic ocean without being too distractive")
          vec2 p = vWorld.xz;
          float n = sin(p.x * 0.35 + uTime * 0.21) * sin(p.y * 0.29 - uTime * 0.17)
                  + 0.5 * sin((p.x - p.y) * 0.8 + uTime * 0.37);
          vec3 col = mix(uDeep, uShallow, 0.55 + 0.08 * n);
          float far = smoothstep(25.0, 140.0, length(vWorld.xz));
          col = mix(col, uSky, far);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });

 water.material.dispose();water.material=waterMaterial;water.renderOrder=.5;
 const makeMesh=(mat,order)=>{const m=new THREE.Mesh(new THREE.BufferGeometry(),mat);m.renderOrder=order;m.frustumCulled=false;group.add(m);return m;};
 const skirt=makeMesh(makeSkirtMaterial(new THREE.Color('#9fd0d3')),2),waves=makeMesh(makeWaveMaterial(),3),modernWaves=makeMesh(makeShoreWaveMaterial(),3);
 waves.material.uniforms.uTime=time;modernWaves.material.uniforms.uTime=time;modernWaves.visible=false;
 const line=(color)=>{const m=new THREE.LineSegments(new THREE.BufferGeometry(),styleMat('morris.townscaperEffects.edge-line','LineBasicMaterial',{color,depthTest:false}));m.visible=false;m.renderOrder=6;group.add(m);return m;};
 const shoreLine=line(0xffd23a),seaLine=line(0x3a6dff),gridLines=line(0xffffff);const gp=[],seen=new Set();for(const c of grid.cells)for(let i=0;i<4;i++){const a=c.pts[i],b=c.pts[(i+1)%4],key=[a.id,b.id].sort((x,y)=>x-y).join(':');if(!seen.has(key)){seen.add(key);gp.push(a.x,.015,a.z,b.x,.015,b.z);}}gridLines.geometry.setAttribute('position',new THREE.Float32BufferAttribute(gp,3));
 const catcher=new THREE.Mesh(water.geometry.clone(),new THREE.ShadowMaterial({opacity:.2,depthWrite:false,side:THREE.DoubleSide}));catcher.position.y=water.position.y+.006;catcher.receiveShadow=true;catcher.renderOrder=4;root.add(catcher);
 const rim=createBacklitRim(state.mesh);group.add(rim.mesh);rim.mesh.visible=false;
 const volume=createWaterVolume({extent:30,top:-.05,bottom:-1.6});for(const m of volume.group.children){m.geometry.dispose();m.geometry=water.geometry.clone();m.geometry.scale(1/scale,1/scale,1/scale);m.geometry.rotateX(Math.PI/2);}volume.group.visible=false;group.add(volume.group);
 const hover=makeMesh(styleMat('morris.townscaperEffects.hover','MeshBasicMaterial',{color:0xffffff,transparent:true,opacity:.28,depthWrite:false,side:THREE.DoubleSide}),5);hover.geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(18),3));hover.visible=false;
 const flags={waves:true,shorewaves:false,reflection:true,ao:true,bounce:true,shadows:true,shorelines:false,grid:false,lightonly:false,backlit:false,watervol:false};
 const replace=(o,g)=>{o.geometry.dispose();o.geometry=g;};
 function rebuild(){if(!builder.rebuild())return;state.mesh.geometry=builder.geometry;state.reflection.geometry=builder.geometry;rim.mesh.geometry=builder.geometry;const shore=buildShore(town,grid,index,{posts:builder.posts});replace(skirt,shore.skirt);replace(waves,shore.waves);replace(shoreLine,shore.shoreLine);replace(seaLine,shore.seaLine);replace(modernWaves,buildShoreWaves(town,grid));scheduleBirds();}
 function setDebug(key,on){flags[key]=on;switch(key){case 'waves':skirt.visible=waves.visible=on;break;case 'shorewaves':modernWaves.visible=on;break;case 'reflection':state.reflection.visible=on;birds.reflections=on;break;case 'birds':birds.visible=on;break;case 'ao':case 'bounce':builder.ao=flags.ao;builder.bounce=flags.bounce;builder.invalidate();rebuild();break;case 'shadows':lighting.sun.castShadow=on;state.mesh.castShadow=state.mesh.receiveShadow=catcher.visible=on;break;case 'shorelines':shoreLine.visible=seaLine.visible=on;break;case 'grid':gridLines.visible=on;break;case 'lightonly':state.material.vertexColors=!on;state.material.color.set(on?0xf2efe8:0xffffff);state.material.needsUpdate=true;break;case 'backlit':rim.mesh.visible=on;break;case 'watervol':volume.group.visible=on;break;}}
 const lighting=createMorrisTownLighting({group,town,scale});morrisViewer.beginTownRender=lighting.beginRender;
 function setTimeOfDay(mode){if(lighting.active){lighting.setMode(mode);updateTime(mode);return;}P.timeOfDay={day:.48,dusk:.74,night:0}[mode];P.daySpeed=0;updateTime(mode);}
 function updateTime(mode){const n=mode==='night'?1:mode==='dusk'?.25:0;state.nightUniform.value=n;const colors=mode==='night'?['#2c4c5a','#223f4c','#2b4855']:mode==='dusk'?['#7b8f9e','#5d7787','#c79a8f']:['#5f9fa8','#4f8f99','#78b1b8'];[shallow,deep,sky].forEach((u,i)=>u.value.set(colors[i]));}
 function pickRay(ray) {
    const o = ray.origin;
    const d = ray.direction;

    // Clip the march to the town's vertical slab.
    const maxY = MAX_HEIGHT * .5 + 1.5;
    let tStart = 0;
    let tEnd = 220;
    if (Math.abs(d.y) > 1e-6) {
      const t1 = (0 - o.y) / d.y;
      const t2 = (maxY - o.y) / d.y;
      const lo = Math.min(t1, t2);
      const hi = Math.max(t1, t2);
      tStart = Math.max(tStart, Math.min(lo, hi));
      tEnd = Math.min(tEnd, Math.max(lo, hi));
    }
    if (tEnd <= tStart) return null;

    const step = Math.max(0.035, .5 * 0.14);
    const p = new THREE.Vector3();
    const inside = (x, y, z) => {
      const level = Math.min(MAX_HEIGHT, Math.max(1, Math.floor(y / .5) + 1));
      for (const cell of index.at(x, z)) {
        if (!pointInQuad(cell.pts, x, z)) continue;
        if (!town.isSolid(cell, level)) continue;
        if (y >= 0) return { cell, level };
      }
      return null;
    };

    let prevT = tStart;
    for (let t = tStart; t <= tEnd; t += step) {
      p.copy(o).addScaledVector(d, t);
      const hit = inside(p.x, p.y, p.z);
      if (hit) {
        // Refine the entry point between prevT and t.
        let a = prevT;
        let b = t;
        for (let i = 0; i < 12; i++) {
          const m = (a + b) * 0.5;
          p.copy(o).addScaledVector(d, m);
          if (inside(p.x, p.y, p.z)) b = m;
          else a = m;
        }
        p.copy(o).addScaledVector(d, b);
        return { cell: hit.cell, level: hit.level, point: p.clone() };
      }
      prevT = t;
    }

    // Nothing above the waterline: fall back to the sea surface, so clicking open
    // water still picks the tile under the cursor (and can raise it into land).
    if (Math.abs(d.y) > 1e-6) {
      const tWater = (0 - o.y) / d.y;
      if (tWater > 0 && tWater < 220) {
        p.copy(o).addScaledVector(d, tWater);
        for (const cell of index.at(p.x, p.z)) {
          if (pointInQuad(cell.pts, p.x, p.z)) {
            return { cell, level: 0, point: p.clone(), water: true };
          }
        }
      }
    }
    return null;
  }

 const sun=new THREE.Vector3(),center=new THREE.Vector3();
 return{...state,group,birds,flags,skirt,waves,modernWaves,shoreLine,seaLine,gridLines,rim,volume,hover,catcher,rebuild,lighting,setBuildMode(on){lighting.setActive(on);if(on){lighting.setMode('day');updateTime('day');}},invalidate(){builder.invalidate();},setDebug,setTimeOfDay,pickRay,
  update(t){const dt=Math.min(.05,Math.max(0,t-lastBirdTime));lastBirdTime=t;birds.update(dt);time.value=t;volume.update(t);updateTime(lighting.active?lighting.mode:P.timeOfDay<.2||P.timeOfDay>.85?'night':P.timeOfDay>.65?'dusk':'day');if(lighting.active){lighting.sun.getWorldPosition(sun);sun.sub(lighting.sun.target.getWorldPosition(new THREE.Vector3())).normalize();}else sun.set(-9,21,15).transformDirection(group.matrixWorld);rim.setSun(sun);},
  updateHover(cell,level){hover.visible=!!cell;if(!cell)return;const p=cell.pts,y=level*.5+.012,a=hover.geometry.attributes.position;[0,1,2,0,2,3].forEach((k,i)=>a.setXYZ(i,p[k].x,y,p[k].z));a.needsUpdate=true;hover.geometry.computeVertexNormals();},
  dispose(){if(birdTimer!==null)clearTimeout(birdTimer);birds.dispose();if(morrisViewer.beginTownRender===lighting.beginRender)morrisViewer.beginTownRender=null;lighting.dispose();const gs=new Set(),ms=new Set();group.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());catcher.geometry.dispose();catcher.material.dispose();catcher.removeFromParent();group.removeFromParent();}
 };
}
