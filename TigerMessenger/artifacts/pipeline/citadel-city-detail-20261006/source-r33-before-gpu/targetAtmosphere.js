import * as THREE from 'three';

// The approved target has a pale cyan bay. Grade only this final castle chart;
// retain the existing ocean geometry, time, opacity and shore animation.
export function applyCitadelTargetOcean(ocean,castle){
 if(new URLSearchParams(globalThis.location?.search||'').get('citadelTargetAtmosphere')!=='1')return null;
 const material=ocean?.material;
 if(!material?.isShaderMaterial||!castle||material.userData.citadelTargetOcean)return null;
 castle.updateWorldMatrix(true,true);
 material.uniforms.uCitadelTargetFrame={value:castle.matrixWorld.clone().invert()};
 material.fragmentShader=material.fragmentShader.replace('uniform vec3 uColor;','uniform vec3 uColor;\n uniform mat4 uCitadelTargetFrame;');
 material.fragmentShader=material.fragmentShader.replace('float alpha = uOpacity',`
 {
 vec3 citadelPoint=(uCitadelTargetFrame*vec4(vRadial*160.72,1.)).xyz;
 vec2 edge=abs(citadelPoint.xz-vec2(0.,20.));
 float region=(1.-smoothstep(130.,158.,edge.x))*(1.-smoothstep(88.,115.,edge.y));
 vec3 targetWater=mix(vec3(.50,.68,.70),vec3(.70,.86,.84),1.-depth*.6);
 targetWater*=mix(.22,1.,uNight);
 targetWater+=vec3(.025,.033,.033)*sin(ripplePhase)*.22;
 targetWater=mix(targetWater,vec3(.91,.96,.94)*mix(.3,1.,uNight),clamp(shorelineFoam*.5,0.,.55));
 color=mix(color,targetWater,region);
 }
 float alpha = uOpacity`);
 material.needsUpdate=true;material.userData.citadelTargetOcean={revision:2,mode:'bounded final castle chart',geometryChanged:false};
 return material.userData.citadelTargetOcean;
}
