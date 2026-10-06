import * as THREE from 'three';
export function applyTargetRockAppearance(castle){
 const suppressedDecorations=[];const crags=castle.getObjectByName('citadel-study-fractured-buttresses');if(crags){suppressedDecorations.push({mesh:crags,visible:crags.visible});crags.visible=false;}
 const changes=[],palette={mtBase:'#c8cbd0',mtShade:'#8b9fb9',mtChalk:'#ebe0cb',mtVerdure:'#91ad78'};
 const names=[...new Set([...(castle.userData.mountainStudy?.surfaces||['citadel-oskar-grid-mountain-surface']),'citadel-study-rock-crags'])];
 for(const name of names){
  const mesh=castle.getObjectByName(name);if(!mesh?.material?.isMeshStandardMaterial)continue;const original=mesh.material,mat=original.clone(),compile=original.onBeforeCompile,key=original.customProgramCacheKey;
  mat.onBeforeCompile=function(shader,renderer){compile?.call(this,shader,renderer);for(const[name,colour]of Object.entries(palette))if(shader.uniforms[name])shader.uniforms[name].value=new THREE.Color(colour);if(shader.uniforms.mtDetailGain)shader.uniforms.mtDetailGain.value=.09;if(shader.uniforms.mtMossGain)shader.uniforms.mtMossGain.value=.12;shader.fragmentShader=shader.fragmentShader.replace('mtBase,.65+.35*mtWash','mtBase,.84+.16*mtWash');};mat.customProgramCacheKey=()=>key.call(original)+'|target-clean-rock-3';mat.userData={...original.userData,preserveCitadelMaterial:true,targetCleanRock:true};mesh.material=mat;changes.push({mesh,original,mat});
 }
 const report={version:'target-clean-rock-3',meshes:changes.length,palette,detailGain:.09,geometryChanged:false,suppressedDecorations:suppressedDecorations.map(({mesh})=>({name:mesh.name,uuid:mesh.uuid,reason:'floating-looking legacy fractured overlays; final mountain geometry retained'}))};let disposed=false;return{report,dispose(){if(disposed)return;disposed=true;for(const{mesh,visible}of suppressedDecorations)mesh.visible=visible;for(const{mesh,original,mat}of changes){if(mesh.material===mat)mesh.material=original;mat.dispose();}}};
}
