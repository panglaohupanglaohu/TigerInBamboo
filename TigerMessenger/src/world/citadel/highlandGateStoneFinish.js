import * as T from 'three';

// Project-authored restrained weathering; not an Oskar proprietary shader.
// Coordinates are baked gate-local geometry, so neighbouring parts share
// courses/rain bands even after the final rail seating transformation.
export function applyHighlandStoneWeathering(material,{strength=1}={}){
 if(!Number.isFinite(strength)||strength<0||strength>1)throw new TypeError('strength 0..1 required');
 material.onBeforeCompile=s=>{
  s.uniforms.uGateWeatherStrength={value:strength};
  s.vertexShader='varying vec3 vGateStone;\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGateStone=position;');
  s.fragmentShader='varying vec3 vGateStone;\nuniform float uGateWeatherStrength;\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec3 gateNormal=abs(normalize(cross(dFdx(vGateStone),dFdy(vGateStone))));
   vec2 gateP=gateNormal.y>.7?vGateStone.xz:vec2(gateNormal.x>gateNormal.z?vGateStone.z:vGateStone.x,vGateStone.y);
   float gateRow=floor(gateP.y/1.65);
   vec2 gateCell=vec2(gateP.x/2.75+mod(gateRow,2.)*.5,gateP.y/1.65);
   float gateBlock=fract(sin(dot(floor(gateCell),vec2(127.1,311.7)))*43758.5453);
   vec2 gateEdge=min(fract(gateCell),1.-fract(gateCell));
   float gateSeam=1.-smoothstep(.009,.021,min(gateEdge.x,gateEdge.y));
   float gateLarge=.5+.5*sin(vGateStone.x*.16+sin(vGateStone.z*.21)+vGateStone.y*.10);
   vec3 gateWarm=vec3(1.025,1.006,.969),gateCool=vec3(.935,.976,1.015);
   vec3 gatePatina=diffuseColor.rgb*mix(gateCool,gateWarm,gateLarge)*(.945+.11*gateBlock);
   // Fine eroded joints break the broad ashlar without a heavy black grid.
   gatePatina=mix(gatePatina,gatePatina*vec3(.84,.86,.82),gateSeam*.32);
   // Broken narrow rain stains beneath real coping elevations, not a full grid.
   float gateLedge=min(min(abs(vGateStone.y-15.5),abs(vGateStone.y-20.2)),min(abs(vGateStone.y-24.2),abs(vGateStone.y-23.6)));
   float gateRain=smoothstep(.77,.95,.5+.5*sin(gateP.x*1.77+sin(gateP.x*.43))) * exp(-gateLedge*.75)*(1.-gateNormal.y);
   gatePatina=mix(gatePatina,gatePatina*vec3(.81,.84,.82),gateRain*.27);
   float gateFoot=(1.-smoothstep(2.4,5.5,vGateStone.y))*smoothstep(.22,.78,gateLarge)*(1.-gateNormal.y);
   gatePatina=mix(gatePatina,gatePatina*vec3(.78,.88,.72),gateFoot*.30);
   diffuseColor.rgb=mix(diffuseColor.rgb,gatePatina,uGateWeatherStrength);
  `);
 };
 material.customProgramCacheKey=()=> 'highland-stone-weather-3';material.userData.gateWeathering={version:3,strength,scope:'low-frequency block tint, coping rain, foot patina; no dense dark mortar'};material.needsUpdate=true;return material;
}

// Bevel removed from the original box, never protrudes into a passage.
// Used only for non-walkable coping: traffic/standing planes remain original.
export function wornGateCopingBox(w,h,d,r=.045){
 const radius=Math.min(r,w*.12,h*.2,d*.12),g=new T.BoxGeometry(w,h,d,2,2,2),p=g.attributes.position;
 const half=new T.Vector3(w/2,h/2,d/2),inner=half.clone().addScalar(-radius),v=new T.Vector3(),q=new T.Vector3();
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);q.copy(v).clamp(inner.clone().negate(),inner);const delta=v.clone().sub(q);if(delta.lengthSq())v.copy(q).add(delta.setLength(radius));p.setXYZ(i,v.x,v.y,v.z);}
 g.computeVertexNormals();g.computeBoundingBox();g.userData.gateWear={radius,containedWithinOriginalBox:true};return g;
}
