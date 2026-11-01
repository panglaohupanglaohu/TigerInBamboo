import * as THREE from 'three';

// Object-attached large weathering fields. No texture, random stream, lights,
// mesh draws, frame callback or screen-space noise; all distances are inner units.
export function applySwampCoralWeathering(material,{matrix=new THREE.Matrix4(),exterior=false}={}){
 const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey();
 const color=hex=>new THREE.Color(hex).toArray().map(v=>v.toFixed(8)).join(',');
 material.onBeforeCompile=shader=>{
  previous?.(shader);
  // Retire the previous evenly spaced horizontal courses; the actual relief
  // now owns sparse irregular bedding lines, so these cannot read as bricks.
  shader.fragmentShader=shader.fragmentShader.replace('float strataLOD = 1.0 - smoothstep(25.0, 70.0, gregViewDepth);','float strataLOD = 0.0;');
  shader.uniforms.coralWeatherFrame={value:matrix};
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform mat4 coralWeatherFrame; varying vec3 coralWeatherP;').replace('#include <begin_vertex>','#include <begin_vertex>\ncoralWeatherP=(coralWeatherFrame*vec4(position,1.)).xyz;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\nvarying vec3 coralWeatherP;\nfloat cwHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}\nfloat cwNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(cwHash(i),cwHash(i+vec3(1,0,0)),f.x),mix(cwHash(i+vec3(0,1,0)),cwHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(cwHash(i+vec3(0,0,1)),cwHash(i+vec3(1,0,1)),f.x),mix(cwHash(i+vec3(0,1,1)),cwHash(i+vec3(1,1,1)),f.x),f.y),f.z);}`).replace('#include <opaque_fragment>',`
   {
   vec3 cwUnweathered=outgoingLight;
   float cwAngle=atan(coralWeatherP.z,coralWeatherP.x);
   float cwY=coralWeatherP.y;
   // Overlapping 3D mineral fields break up broad planar slabs without a
   // camera-space texture or repeated angular bands.
   float cwBroad=cwNoise(coralWeatherP*vec3(.105,.14,.105));
   float cwMottle=cwBroad*.62+cwNoise(coralWeatherP*vec3(.31,.42,.31))*.28+cwNoise(coralWeatherP*vec3(.78,.94,.78))*.10;
   float cwPatina=smoothstep(.28,.76,cwMottle);
   // Broad catchments descend from rim joints; horizontal drift avoids stripes.
   float cwCatchment=sin(cwAngle*7.+sin(cwAngle*3.)*.65+cwY*.035);
   float cwPatches=sin(cwAngle*17.+cwY*.23+sin(cwY*.43)*.38)*.58
                +sin(cwAngle*29.-cwY*.39)*.28+sin(cwAngle*47.+cwY*.61)*.14;
   float cwMoss=smoothstep(-.12,.50,cwCatchment)*smoothstep(-.25,.30,cwPatches)
              *smoothstep(.36,.64,cwMottle)*smoothstep(26.,37.,cwY)*.88;
   float cwWet=(1.-smoothstep(25.5,29.7+.55*sin(cwAngle*9.),cwY))*.30;
   float cwMineral=smoothstep(.65,.90,sin(cwAngle*13.+cwY*.11))
                 *smoothstep(.25,.55,cwPatches)*.38;
   vec3 cwStone=vec3(${color(0x829099)});
   vec3 cwCool=vec3(${color(0x697983)}),cwWarm=vec3(${color(0x9b968b)});
   cwStone=mix(cwCool,cwWarm,cwPatina);
   float cwBaseAmount=${exterior?'.28':'.43'};
   outgoingLight=mix(outgoingLight,cwStone,cwBaseAmount);
   outgoingLight*=.88+.20*cwMottle;
   outgoingLight=mix(outgoingLight,vec3(${color(0x657c85)}),cwWet);
   outgoingLight=mix(outgoingLight,vec3(${color(0xb8aa99)}),cwMineral);
   outgoingLight=mix(outgoingLight,vec3(${color(0x739e85)}),cwMoss);
   // A few broken, antialiased erosion fissures; quiet stone stays quiet.
   float cwCrackPhase=cwAngle*23.+sin(cwY*.37+cwAngle*2.)*.19;
   float cwEdge=abs(fract(cwCrackPhase)-.5),cwAa=max(fwidth(cwCrackPhase),.005);
   float cwFissure=(1.-smoothstep(.005-cwAa,.005+cwAa,cwEdge))
                *smoothstep(.35,.75,sin(cwY*.58+cwAngle*5.))*.16;
   outgoingLight=mix(outgoingLight,vec3(${color(0x55576b)}),cwFissure);
   outgoingLight=mix(outgoingLight,cwUnweathered,${exterior?'smoothstep(39.5,39.98,cwY)':'0.'});
   }
   #include <opaque_fragment>`);
 };
 material.customProgramCacheKey=()=>previousKey+':coral-weathered-cliff-4-'+Number(exterior);
 material.userData.coralWeathering={version:4,exterior,frame:'inner',animated:false};material.needsUpdate=true;
 return material;
}
