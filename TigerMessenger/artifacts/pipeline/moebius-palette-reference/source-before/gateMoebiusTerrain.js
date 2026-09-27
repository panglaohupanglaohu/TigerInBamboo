import * as THREE from 'three';

// Refine the existing continuous shoulders. Never raise terrain into the railway.
export function refineGateMoebiusTerrain(site) {
  if(site.userData.moebiusTerrainRevision)return;
  for(const mesh of site.children.filter(o=>o.name.startsWith('canyon-shoulder'))){
    const source=mesh.geometry.attributes.position,positions=[];
    const midpoint=(a,b)=>a.clone().add(b).multiplyScalar(.5);
    const carve=p=>{
      // Open a broad water channel beside the arcade; retain the landward meeting approach.
      const terrace = p.x < -16 && p.z < -10 && p.z > -46;
      const channel = (1-THREE.MathUtils.smoothstep(Math.abs(p.x),20,36))
        * (1-THREE.MathUtils.smoothstep(Math.abs(p.z),32,52));
      if(!terrace) p.y=THREE.MathUtils.lerp(p.y,Math.min(p.y,-25),channel);
      const edge=THREE.MathUtils.smoothstep(Math.abs(p.x),12,22);
      const approach=p.x<0&&p.x>-35&&p.z>-46&&p.z<-10;
      if(approach)return p;
      const fissure=Math.pow(.5+.5*Math.sin(p.z*.72+p.x*.17),10);
      const bedding=.5+.5*Math.sin(p.x*1.13+p.z*.31);
      p.y-=edge*(1.65*fissure+.25*bedding);
      return p;
    };
    const triangle=(a,b,c,depth)=>{
      if(depth){const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);triangle(a,ab,ca,depth-1);triangle(ab,b,bc,depth-1);triangle(ca,bc,c,depth-1);triangle(ab,bc,ca,depth-1);return;}
      for(const p of[a,b,c])positions.push(...carve(p.clone()).toArray());
    };
    for(let i=0;i<source.count;i+=3)triangle(...[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(source,i+j)),2);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
    const colors=[],pos=geometry.attributes.position,n=geometry.attributes.normal;
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
      const seam=Math.pow(.5+.5*Math.sin(y*2.4+.32*Math.sin(x*.7+z*.28)),18);
      const shade=.76+.18*Math.abs(n.getY(i))+.13*n.getX(i)-seam*.12;
      const color=new THREE.Color(0x345989).multiplyScalar(shade);colors.push(color.r,color.g,color.b);
    }
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeBoundingSphere();geometry.computeBoundingBox();
    mesh.geometry=geometry;
    // Fine projected ink creases, rather than outlining every triangulation edge.
    mesh.material.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 rockLocal; varying vec3 rockNormal;');
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nrockLocal=position;rockNormal=normal;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 rockLocal; varying vec3 rockNormal;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float bend=.6*sin(rockLocal.y*.43+sin(rockLocal.z*.7))+.16*sin(rockLocal.y*2.1+rockLocal.z*.91);
        float crease=abs(sin(rockLocal.z*1.75+rockLocal.x*.33+bend));
        float aa=max(fwidth(crease),.009);
        float ink=(1.-smoothstep(.013,.013+aa,crease))*smoothstep(-.3,.5,sin(rockLocal.y*.8+rockLocal.z*2.1+rockLocal.x*.45));
        float ledge=abs(sin(rockLocal.y*1.1+.22*sin(rockLocal.z*.8)));
        float ledgeInk=1.-smoothstep(.018,.018+max(fwidth(ledge),.009),ledge);
        float face=1.-smoothstep(.6,.92,abs(normalize(rockNormal).y));
        diffuseColor.rgb*=1.-face*(ink*.25+ledgeInk*.035);
      `);
    };
    mesh.material.customProgramCacheKey=()=> 'gate-moebius-rock-ink-v2';
    mesh.material.needsUpdate=true;mesh.userData.moebiusTerrainRevision=2;
  }
  // Replace vegetation baked onto the old slope with rooted planting on the revised banks.
  const oldPlants=site.getObjectByName('gate-dressing-vegetation');if(oldPlants)oldPlants.visible=false;
  site.updateWorldMatrix(true,true);
  const slopes=site.children.filter(o=>o.name.startsWith('canyon-shoulder'));
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0).transformDirection(site.matrixWorld);
  const leaves=new THREE.SphereGeometry(1,9,6),bark=new THREE.MeshBasicMaterial({color:0x4b5753});
  const greens=[0x567766,0x708967,0x91a87b].map(color=>new THREE.MeshBasicMaterial({color}));
  let planted=0;
  for(let i=0;i<240;i++){
    const side=i%2?-1:1,x=side*(27+(i*7.13%26)),z=-47+(i*13.71%94);
    if(side<0&&z>-46&&z<-10&&Math.abs(x)<36)continue;
    ray.set(site.localToWorld(new THREE.Vector3(x,60,z)),down);ray.far=110;
    const hit=ray.intersectObjects(slopes,false)[0];if(!hit)continue;
    const p=site.worldToLocal(hit.point.clone());if(p.y < -14)continue;
    const tree=i%9===0,h=tree?3.3+i%4:.45+(i%5)*.12;
    const stem=new THREE.Mesh(new THREE.CylinderGeometry(.10,.20,h,7),bark);stem.position.copy(p).y+=h*.5;stem.name='gate-bank-rooted-stem';site.add(stem);
    for(let j=0;j<3;j++){
      const crown=new THREE.Mesh(leaves,greens[(i+j)%3]);crown.name='gate-bank-rooted-canopy';
      crown.scale.set(tree?1.6:1.0,tree?.65:.4,tree?1.2:.8);
      crown.position.copy(p).add(new THREE.Vector3(Math.cos(j*2.1)*.65,h+j*.2,Math.sin(j*2.1)*.6));site.add(crown);
    }planted++;
  }
  // A calm inlet occupies the opened canyon, below the rail deck and meeting terrace.
  // Its shoreline is formed by the existing carved shoulders, not a painted rock surface.
  const waterGeometry=new THREE.PlaneGeometry(94,142,1,1);waterGeometry.rotateX(-Math.PI/2);
  const waterMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{time:{value:0}},vertexShader:`varying vec2 inlet;void main(){inlet=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 inlet;uniform float time;void main(){
      float edge=1.-smoothstep(.72,1.,length(inlet/vec2(47.,71.)));
      if(edge<.01)discard;
      float stroke=abs(sin(inlet.y*3.+sin(inlet.x*.28)*.8+time*.4));
      float ink=(1.-smoothstep(.03,.03+max(fwidth(stroke),.03),stroke))*smoothstep(-.1,.5,sin(inlet.x*2.+sin(inlet.y)));
      vec3 color=mix(vec3(.055,.23,.43),vec3(.12,.40,.57),.5+.3*sin(inlet.x*.08));
      float reflections=0.;for(int i=0;i<4;i++){float z=-23.76+float(i)*15.84;reflections+=exp(-pow((inlet.y-z+sin(inlet.x*2.)*.13)/.65,2.))*(1.-smoothstep(7.,27.,abs(inlet.x)));}
      color=mix(color,vec3(.44,.64,.73),min(.5,reflections*.45));
      gl_FragColor=vec4(color+vec3(.1,.18,.20)*ink*.36,edge*.97);
    }`});
  const inlet=new THREE.Mesh(waterGeometry,waterMaterial);inlet.name='gate-open-water-inlet';inlet.position.y=-13.5;inlet.renderOrder=2;
  inlet.onBeforeRender=(_renderer,scene)=>{
    waterMaterial.uniforms.time.value=performance.now()/1000;
    if(inlet.userData.oceanAligned)return;
    const ocean=scene.getObjectByName('planet-v8-curved-ocean');if(!ocean)return;
    site.updateWorldMatrix(true,false);
    const m=ocean.material;
    if(!m.userData.gateInlet){
      m.uniforms.uGateInverse={value:site.matrixWorld.clone().invert()};
      m.vertexShader='varying vec3 vGateWorld;\n'+m.vertexShader;
      m.vertexShader=m.vertexShader.replace('gl_Position =','vGateWorld=(modelMatrix*vec4(p,1.)).xyz; gl_Position =');
      m.fragmentShader='varying vec3 vGateWorld;uniform mat4 uGateInverse;\n'+m.fragmentShader;
      m.fragmentShader=m.fragmentShader.replace(/gl_FragColor\s*=\s*vec4\(color,\s*alpha\);/,`{
       vec2 inlet=(uGateInverse*vec4(vGateWorld,1.)).xz;
       float edge=1.-smoothstep(.72,1.,length(inlet/vec2(47.,71.)));
       float stroke=abs(sin(inlet.y*3.+sin(inlet.x*.28)*.8+uTime*.4));
       float ink=(1.-smoothstep(.03,.03+max(fwidth(stroke),.03),stroke))*smoothstep(-.1,.5,sin(inlet.x*2.+sin(inlet.y)));
       vec3 gateColor=mix(vec3(.055,.23,.43),vec3(.12,.40,.57),.5+.3*sin(inlet.x*.08));
       color=mix(color,(gateColor+vec3(.1,.18,.20)*ink*.36)*mix(.48,1.,uNight),edge);
      } gl_FragColor = vec4(color, alpha);`);
      m.needsUpdate=true;m.userData.gateInlet=true;
    }
    inlet.userData.oceanAligned=true;
  };site.add(inlet);
  site.userData.bankPlantings=planted;
  site.userData.moebiusTerrainRevision=3;
}
