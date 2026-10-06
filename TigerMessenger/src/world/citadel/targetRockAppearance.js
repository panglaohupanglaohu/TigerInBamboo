import * as THREE from 'three';
// Approved street-camera target: cool mineral body, blue-grey recesses and
// restrained warm exposed planes. Keep cream exclusively legible on city walls.
export const TARGET_ROCK_PALETTE={mtBase:'#bbc8d2',mtShade:'#7896b8',mtChalk:'#e8d8bb',mtVerdure:'#88aa7b',trRose:'#bcb7c5'};
// Project-authored continuous palette coordinates, inspired by the author's
// palette-authoring demonstration; not a reconstruction of his private shader.
export function rockPaletteCoordinates(position,normal,sun=[0,0,0]){
 const [x,y,z]=position,n=new THREE.Vector3(...normal).normalize(),s=new THREE.Vector3(...sun);
 return {exposure:s.lengthSq()>.01?THREE.MathUtils.smoothstep(n.dot(s.normalize()),-.55,.8):.5,
 layer:THREE.MathUtils.smoothstep(Math.sin(y*.17+x*.018+z*.013+Math.sin(x*.028+z*.021)*.6),-.6,.65),
 region:.5+.5*Math.sin(x*.025+z*.019)};
}
export function applyTargetRockAppearance(castle){
 const suppressedDecorations=[];const crags=castle.getObjectByName('citadel-study-fractured-buttresses');if(crags){suppressedDecorations.push({mesh:crags,visible:crags.visible});crags.visible=false;}
 const changes=[],palette={...TARGET_ROCK_PALETTE};
 let sceneRoot=castle;while(sceneRoot.parent)sceneRoot=sceneRoot.parent;
 const directionalLights=[];sceneRoot.traverse(o=>{if(o.isDirectionalLight)directionalLights.push(o);});
 // Hidden lighting-director parents do not contribute to the actual render.
 // Re-select among cached lights so day/night and director toggles remain live.
 const effectiveVisible=o=>{for(let n=o;n;n=n.parent)if(!n.visible)return false;return true;};
 const selectSun=camera=>directionalLights.filter(o=>o.intensity>0&&effectiveVisible(o)&&(!camera?.layers||o.layers.test(camera.layers))).reduce((best,o)=>!best||o.intensity>best.intensity?o:best,null);
 let sun=null;
 const names=[...new Set([...(castle.userData.mountainStudy?.surfaces||['citadel-oskar-grid-mountain-surface']),'citadel-study-rock-crags'])];
 const report={version:'target-continuous-rock-7-mineral-planes',meshes:0,palette,detailGain:.09,geometryChanged:false,paletteMethod:'actual sun exposure plus continuous castle-chart broad strata and regional interpolation; no per-face random colours',sourceEvidence:'1712088611934371876 shows a palette authoring tool, not a disclosed rock shader',sunBound:false,shaderPatches:[],suppressedDecorations:suppressedDecorations.map(({mesh})=>({name:mesh.name,uuid:mesh.uuid}))};
 for(const name of names){
  const mesh=castle.getObjectByName(name);if(!mesh?.material?.isMeshStandardMaterial)continue;
  const original=mesh.material,mat=original.clone(),compile=original.onBeforeCompile,key=original.customProgramCacheKey,oldBefore=mesh.onBeforeRender;
  const sunUniform={value:new THREE.Vector3()},roseUniform={value:new THREE.Color(palette.trRose)};
  mat.onBeforeCompile=function(shader,renderer){
   compile?.call(this,shader,renderer);
   for(const[name,colour]of Object.entries(palette))if(shader.uniforms[name])shader.uniforms[name]={value:new THREE.Color(colour)};
   if(shader.uniforms.mtDetailGain)shader.uniforms.mtDetailGain={value:.09};if(shader.uniforms.mtMossGain)shader.uniforms.mtMossGain={value:.08};
   shader.uniforms.trSunDirection=sunUniform;shader.uniforms.trRose=roseUniform;
   shader.fragmentShader='uniform vec3 trSunDirection; uniform vec3 trRose;\n'+shader.fragmentShader;
   const normal=shader.fragmentShader.includes('varying vec3 vMtShade;')?'normalize(vMtShade)':'(gl_FrontFacing ? mtN : -mtN)';
   const beforeFragment=shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace(/vec3 mtColor=mix\(mtShade,mtBase,[^;]+;\s*mtColor=mix\(mtColor,mtChalk,[^;]+;/,`
    vec3 trN=${normal};
    float trExposure=length(trSunDirection)>.01?smoothstep(-.55,.8,dot(trN,normalize(trSunDirection))):.5;
    float trLayer=smoothstep(-.6,.65,sin(vMt.y*.17+vMt.x*.018+vMt.z*.013+sin(vMt.x*.028+vMt.z*.021)*.6));
    float trRegion=.5+.5*sin(vMt.x*.025+vMt.z*.019);
    // Mineral colour changes across broad inclined rock strata. The normal
    // field still drives actual illumination; this is albedo, not painted AO.
    float trMineral=.5+.5*sin(vMt.x*.19+vMt.z*.11+vMt.y*.027+sin(vMt.z*.05)*1.2);
    vec3 mtColor=mix(mtShade,mtBase,.18+.63*trExposure);
    mtColor=mix(mtColor,trRose,trLayer*(.10+.14*trRegion));
    mtColor=mix(mtColor,mtChalk,(.16+.42*trMineral)*(.40+.60*trExposure));
   `);
   report.shaderPatches.push({mesh:mesh.name,matched:shader.fragmentShader!==beforeFragment,orientationField:normal});
  };
  mesh.onBeforeRender=function(...args){oldBefore?.apply(this,args);sun=selectSun(args[2]);report.sunName=sun?.name||sun?.type||null;if(sun){sun.updateWorldMatrix(true,false);sun.target.updateWorldMatrix(true,false);castle.updateWorldMatrix(true,false);const direction=sun.getWorldPosition(new THREE.Vector3()).sub(sun.target.getWorldPosition(new THREE.Vector3()));sunUniform.value.copy(direction).transformDirection(castle.matrixWorld.clone().invert());report.sunBound=true;}else{sunUniform.value.set(0,0,0);report.sunBound=false;}};
  mat.customProgramCacheKey=()=>key.call(original)+'|target-continuous-rock-7-mineral-planes';mat.userData={...original.userData,preserveCitadelMaterial:true,targetCleanRock:true};mesh.material=mat;changes.push({mesh,original,mat,oldBefore});
 }
 report.meshes=changes.length;let disposed=false;return{report,dispose(){if(disposed)return;disposed=true;for(const{mesh,visible}of suppressedDecorations)mesh.visible=visible;for(const{mesh,original,mat,oldBefore}of changes){if(mesh.material===mat){mesh.material=original;mesh.onBeforeRender=oldBefore;}mat.dispose();}}};
}
