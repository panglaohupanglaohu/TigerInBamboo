import {MOEBIUS_PALETTE as P} from './moebiusPalette.js';
import * as THREE from 'three';
import {cityLocalToDir,getCityFrame,dirToCityLocal} from './crystalCityLayout.js';
import {officialOceanLevelAt} from './waterV8/officialOcean.js';

// Regional ink treatment on the existing ocean shader; no duplicate water surface.
export function installCrystalLakeV10({scene,city,swamp}){
 if(scene.getObjectByName('crystal-v10-lake'))return;
 const frame=getCityFrame(),N=1,positions=[],uv=[],indices=[];
 for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){
  const x=-.23+i/N*1.07,z=-.48+j/N*1.08,d=cityLocalToDir(x,z);
  positions.push(...d.multiplyScalar(160+officialOceanLevelAt(d)+.14).toArray());uv.push(x*140,z*140);
  if(i<N&&j<N){const a=j*(N+1)+i,b=a+N+1;indices.push(a,b,a+1,a+1,b,b+1);}
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
 const swampLocal=dirToCityLocal(swamp.position.clone().normalize());
 const towers=Array.from({length:12},(_,i)=>new THREE.Vector3((city.crystals[i]?.lx||0)*140,(city.crystals[i]?.lz||0)*140,city.crystals[i]?.h||20));
 geometry.setAttribute('lakeMask',new THREE.BufferAttribute(new Float32Array(positions.length/3).fill(1),1));
 const material=new THREE.ShaderMaterial({side:THREE.DoubleSide,transparent:true,depthWrite:true,uniforms:{night:{value:1},time:{value:0},eye:{value:new THREE.Vector2()},eyeHeight:{value:30},towers:{value:towers},swamp:{value:new THREE.Vector2(swampLocal.lx*140,swampLocal.lz*140)}},vertexShader:`varying vec2 lake;varying float mask;attribute float lakeMask;void main(){lake=uv;mask=lakeMask;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`precision highp float;
 varying vec2 lake;varying float mask;uniform float time;uniform vec2 eye;uniform float eyeHeight;uniform vec2 swamp;uniform vec3 towers[12];
 void main(){
  if(mask<.42)discard;
  float bowl=length(lake-swamp);if(bowl<20.8)discard;
  vec2 q=lake;float rim=min(min(q.x+32.2,117.6-q.x),min(q.y+67.2,84.-q.y));
  float alpha=smoothstep(0.,7.,rim)*smoothstep(20.8,22.5,bowl);if(alpha<.005)discard;
  // Multi-direction waves perturb waveA continuous normal, not waveA striped color mask.
  float waveA=dot(q,vec2(.64,.77))*.48+time*.48;
  float waveB=dot(q,vec2(-.91,.41))*.83-time*.62;
  float waveC=dot(q,vec2(.22,-.98))*1.57+time*.83;
  vec2 slope=.10*cos(waveA)*vec2(.64,.77)+.065*cos(waveB)*vec2(-.91,.41)+.025*cos(waveC)*vec2(.22,-.98);
  float detail=1.-smoothstep(.7,2.,length(fwidth(q)));
  vec3 n=normalize(vec3(slope.x*detail,1.,slope.y*detail));
  vec2 toward=eye-q;
  vec3 view=normalize(vec3(toward.x,max(3.,eyeHeight),toward.y));
  float fresnel=.025+.58*pow(1.-max(0.,dot(n,view)),4.);
  float swell=.5+.25*sin(waveA)*sin(waveB)+.12*sin(waveC);
  vec3 color=mix(vec3(.035,.25,.46),vec3(.09,.40,.54),swell);
  float shallows=0.;
  for(int i=0;i<12;i++)shallows=max(shallows,1.-smoothstep(4.,12.,length(q-towers[i].xy)));
  color=mix(color,vec3(.20,.51,.55),shallows*.4);
  color=mix(color,vec3(.42,.65,.73),fresnel);
  vec3 halfLight=normalize(view+normalize(vec3(-.35,.82,.43)));
  float sheen=pow(max(0.,dot(n,halfLight)),90.)*detail;
  color+=vec3(.20,.24,.22)*sheen*.30;
  gl_FragColor=vec4(color,alpha*.97);
 }`});
 const lake=new THREE.Mesh(geometry,material);lake.name='crystal-v10-lake';lake.renderOrder=4;lake.frustumCulled=false;
 // Apply the regional ink treatment to the live ocean shader itself: no overlapping water sheets.
 const regionBody=material.fragmentShader.slice(material.fragmentShader.indexOf('  // Multi-direction waves'),material.fragmentShader.indexOf('  gl_FragColor='));
 const regionFunction=regionBody.replaceAll('time','uCrystalTime').replaceAll('towers','uCrystalTowers').replaceAll('eye','uCrystalEye').replace('vec3 color=','vec3 crystalColor=').replaceAll('color=mix(color','crystalColor=mix(crystalColor').replace('  color+=','  crystalColor+=');
 // This mesh is only an onBeforeRender driver for the real ocean/lake.
 // An all-discard shader has no active fragment output on ANGLE and causes
 // INVALID_OPERATION if submitted to a colour attachment. Keep the callback
 // but submit zero indices; also use a valid, non-writing fallback material.
 geometry.setDrawRange(0,0);
 material.fragmentShader='void main(){gl_FragColor=vec4(0.0);}';
 material.colorWrite=false;
 material.depthWrite=false;
 lake.onBeforeRender=(_r,_s,camera)=>{
  const cityLake=scene.getObjectByName('city-sea-lake');
  if(cityLake&&!cityLake.userData.v10WaterStyle){
   const surface=cityLake.children.find(o=>o.isMesh&&o.geometry.userData.sphericalWater&&o.renderOrder===2);
   if(surface){
    const water=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
     uniforms:{...material.uniforms,center:{value:frame.center},east:{value:frame.east},north:{value:frame.north}},
     vertexShader:`varying vec3 waterWorld;void main(){waterWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(waterWorld,1.);}`,
     fragmentShader:`varying vec3 waterWorld;uniform float night;uniform float time;uniform vec2 eye;uniform float eyeHeight;uniform vec3 towers[12];uniform vec2 swamp;uniform vec3 center;uniform vec3 east;uniform vec3 north;
      void main(){vec3 d=normalize(waterWorld);float a=acos(clamp(dot(d,center),-1.,1.));vec2 q=vec2(dot(d,east),dot(d,north))*a/max(.00001,sin(a))*140.;
       if(length(q-swamp)<20.8)discard;
       ${regionBody}
       gl_FragColor=vec4(color*mix(.48,1.,night),.94);
      }`});
    surface.material=water;surface.name='crystal-city-illustrated-lake-surface';
    cityLake.userData.v10WaterStyle=true;lake.userData.citySurfaceStyled=true;
    // Existing lake remains at its authored waterline; diving and animals retain that same surface.
    cityLake.updateWorldMatrix(true,true);const ray=new THREE.Raycaster();
    for(const g of islands.children){const d=g.position.clone().normalize();ray.set(d.clone().multiplyScalar(250),d.clone().negate());const h=ray.intersectObject(surface,false)[0];if(h&&h.point.length()>g.position.length())g.position.copy(h.point);}
   }
  }
  const ocean=scene.getObjectByName('planet-v8-curved-ocean');if(!ocean)return;
  const m=ocean.material;material.uniforms.night.value=m.uniforms.uNight.value;
  if(!m.userData.crystalLake){
   Object.assign(m.uniforms,{uCrystalTime:material.uniforms.time,uCrystalEye:material.uniforms.eye,uCrystalEyeHeight:material.uniforms.eyeHeight,uCrystalTowers:material.uniforms.towers,uCrystalSwamp:material.uniforms.swamp,uCrystalCenter:{value:frame.center},uCrystalEast:{value:frame.east},uCrystalNorth:{value:frame.north}});
   m.fragmentShader=`uniform float uCrystalTime;uniform vec2 uCrystalEye;uniform float uCrystalEyeHeight;uniform vec3 uCrystalTowers[12];uniform vec2 uCrystalSwamp;uniform vec3 uCrystalCenter;uniform vec3 uCrystalEast;uniform vec3 uCrystalNorth;\n`+m.fragmentShader;
   m.fragmentShader=m.fragmentShader.replace('gl_FragColor = vec4(color, alpha);',`
    float angle=acos(clamp(dot(normalize(vRadial),uCrystalCenter),-1.,1.));
    vec2 q=vec2(dot(vRadial,uCrystalEast),dot(vRadial,uCrystalNorth))*angle/max(.00001,sin(angle))*140.;
    float rim=min(min(q.x+32.2,117.6-q.x),min(q.y+67.2,84.-q.y));
    float region=(1.-smoothstep(.62,1.,length((q-vec2(32.,5.))/vec2(106.,98.))))*smoothstep(20.8,22.5,length(q-uCrystalSwamp));
    if(region>0.){
     ${regionFunction}
     color=mix(color,crystalColor*mix(.48,1.,uNight),region);
    }
    gl_FragColor=vec4(color,alpha);`);
   m.needsUpdate=true;m.userData.crystalLake=true;lake.userData.matchedOcean=true;
   // Root small islands on the actual visible curved water rather than its analytic approximation.
   ocean.updateWorldMatrix(true,true);const ray=new THREE.Raycaster();
   for(const g of islands.children){const d=g.position.clone().normalize();ray.set(d.clone().multiplyScalar(250),d.clone().negate());const hit=ray.intersectObject(ocean,false)[0];if(hit&&hit.point.length()>g.position.length())g.position.copy(hit.point);}
  }
  material.uniforms.time.value=performance.now()/1000;material.uniforms.eyeHeight.value=Math.max(2.,camera.position.length()-136.);const local=dirToCityLocal(camera.position.clone().normalize());material.uniforms.eye.value.set(local.lx*140,local.lz*140);
 };
 scene.add(lake);
 lake.userData.scope='Regional illustrated ripples and stylized crystal reflections, not physical mirror reflections';
 const islands=new THREE.Group();islands.name='crystal-v10-planted-islets';scene.add(islands);
 const rock=new THREE.MeshBasicMaterial({color:P.rock}),foliage=[P.leafDark,P.leaf,P.leafLight].map(color=>new THREE.MeshBasicMaterial({color}));
 for(const [i,[x,z]]of [[-.01,.04],[.12,-.13],[.47,.04],[.57,.18],[.23,-.25],[.40,.33],[.0,.32],[.5,-.23]].entries()){
  const d=cityLocalToDir(x,z);if(d.angleTo(swamp.position.clone().normalize())*140<24)continue;
  const level=160+officialOceanLevelAt(d),g=new THREE.Group();g.position.copy(d).multiplyScalar(level);g.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d);g.name='v10-low-planted-islet';islands.add(g);
  const r=1.4+i%3*.65,base=new THREE.Mesh(new THREE.SphereGeometry(1,24,12),rock);base.scale.set(r,.52,r*.62);base.position.y=-.1;g.add(base);
  for(let j=0;j<9;j++){const a=j*2.4,rr=r*.7*Math.sqrt((j+1)/10),m=new THREE.Mesh(new THREE.SphereGeometry(1,10,7),foliage[j%3]);m.position.set(Math.cos(a)*rr,.35+(j%3)*.13,Math.sin(a)*rr*.6);m.scale.set(.6,.4,.5);g.add(m);}
  const points=[];for(let j=0;j<=80;j++){const a=j/80*Math.PI*2;points.push(new THREE.Vector3(Math.cos(a)*(r+.3),.07,Math.sin(a)*(r*.62+.3)));}
  const fringe=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x82b5c5,transparent:true,opacity:.6}));g.add(fringe);
 }
 lake.userData.islets=islands.children.length;
}
