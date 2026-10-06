import * as THREE from 'three';

/** Final-mesh coastal colour field. Static shoreline/depth samples, animated
 * fragment foam. Does not move sea/terrain or substitute a flat ocean plane. */
export function createTargetBayWaterAppearance({ocean,castle,sampleTerrain,sampleSea,bounds=[-115,135,-45,130],resolution=[144,104]}={}){
 if(!ocean?.material?.isShaderMaterial||!castle||typeof sampleTerrain!=='function'||typeof sampleSea!=='function')throw new TypeError('actual ocean, castle and final surface samplers required');
 const [nx,nz]=resolution,[x0,x1,z0,z1]=bounds;
 if(![...bounds,...resolution].every(Number.isFinite)||nx<2||nz<2||nx>256||nz>256||x1<=x0||z1<=z0)throw new RangeError('invalid water field dimensions');
 const dx=(x1-x0)/(nx-1),dz=(z1-z0)/(nz-1),count=nx*nz,depths=new Float32Array(count),distance=new Float32Array(count),valid=new Uint8Array(count);let missing=0,wet=0;
 for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
  const i=z*nx+x,px=x0+x*dx,pz=z0+z*dz,a=sampleTerrain(px,pz),b=sampleSea(px,pz),land=typeof a==='number'?a:a?.height,sea=typeof b==='number'?b:b?.height;
  if(!Number.isFinite(land)||!Number.isFinite(sea)){missing++;distance[i]=1e5;continue;}
  valid[i]=1;depths[i]=sea-land;distance[i]=depths[i]>0?1e5:0;if(depths[i]>0)wet++;
 }
 // Two-pass chamfer distance in castle metres; finite grid approximation.
 const diagonal=Math.hypot(dx,dz);for(let pass=0;pass<2;pass++){
  const sign=pass?-1:1;for(let k=0;k<count;k++){
   const i=pass?count-1-k:k,x=i%nx,z=Math.floor(i/nx);if(!valid[i])continue;
   for(const [ox,oz,cost]of[[-sign,0,dx],[0,-sign,dz],[-sign,-sign,diagonal],[sign,-sign,diagonal]]){const xx=x+ox,zz=z+oz;if(xx<0||xx>=nx||zz<0||zz>=nz)continue;const j=zz*nx+xx;if(valid[j])distance[i]=Math.min(distance[i],distance[j]+cost);}
  }
 }
 const data=new Uint8Array(count*4);for(let i=0;i<count;i++)data.set([Math.round(THREE.MathUtils.clamp(depths[i]/15,0,1)*255),Math.round(Math.min(1,distance[i]/32)*255),depths[i]>0?255:0,valid[i]?255:0],i*4);
 const texture=new THREE.DataTexture(data,nx,nz,THREE.RGBAFormat);texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;texture.needsUpdate=true;texture.name='citadel-final-bay-shore-distance';
 const original=ocean.material,material=original.clone();material.name='citadel-target-bay-water';
 // The world controller retains original uniform references for wave/day time.
 material.uniforms={...original.uniforms};
 castle.updateWorldMatrix(true,false);material.uniforms.uCitadelBayFrame={value:castle.matrixWorld.clone().invert()};material.uniforms.uCitadelBayRect={value:new THREE.Vector4(x0,z0,x1-x0,z1-z0)};material.uniforms.uCitadelBayField={value:texture};
 material.vertexShader='varying vec3 vCitadelBayWorld;\n'+material.vertexShader;
 material.vertexShader=material.vertexShader.replace('gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);','vCitadelBayWorld=(modelMatrix*vec4(p,1.)).xyz;\n gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);');
 material.fragmentShader='varying vec3 vCitadelBayWorld; uniform mat4 uCitadelBayFrame; uniform vec4 uCitadelBayRect; uniform sampler2D uCitadelBayField;\n'+material.fragmentShader;
 const marker=/gl_FragColor\s*=\s*vec4\(\s*color\s*,\s*alpha\s*\)\s*;/;if(!marker.test(material.fragmentShader)){texture.dispose();material.dispose();throw new Error('unsupported ocean fragment output');}
 material.fragmentShader=material.fragmentShader.replace(marker,`
 vec3 bayP=(uCitadelBayFrame*vec4(vCitadelBayWorld,1.)).xyz;
 vec2 bayUv=(bayP.xz-uCitadelBayRect.xy)/uCitadelBayRect.zw;
 vec4 bayField=texture2D(uCitadelBayField,bayUv);
 float bayBounds=smoothstep(0.,.035,bayUv.x)*(1.-smoothstep(.965,1.,bayUv.x))*smoothstep(0.,.035,bayUv.y)*(1.-smoothstep(.965,1.,bayUv.y));
 float bayRegion=bayBounds*step(.99,bayField.a);
 float bayDistance=bayField.g*32.;
 vec3 bayColour=mix(vec3(.69,.82,.81),vec3(.36,.64,.71),max(smoothstep(.02,.36,bayField.r),.9*smoothstep(2.,28.,bayDistance)));
 float bayWarp=1.8*sin(bayP.x*.13+bayP.z*.09)+1.2*sin(bayP.z*.17-bayP.x*.08);
 float bayRipple=sin(bayP.x*.71+bayP.z*.33+bayWarp-uTime*.7)*sin(bayP.z*.42-bayP.x*.23-uTime*.32);
 bayColour+=vec3(.008,.012,.012)*bayRipple;
 float bayPhase=bayDistance-uTime*.48+.16*sin(bayP.x*.39+bayP.z*.27);
 float bayRing=abs(fract(bayPhase/3.8)-.5)*3.8;
 float bayAA=max(.045,fwidth(bayRing));
 float bayFoam=(1.-smoothstep(.085,.085+bayAA,bayRing))*(1.-smoothstep(.6,5.2,bayDistance));
 float bayEdge=(1.-smoothstep(.15,.7,bayDistance))*(.38+.13*sin(uTime*.8+bayP.x*.48));
 bayColour=mix(bayColour,vec3(.94,.97,.94),clamp(bayFoam*.68+bayEdge,0.,.8));
 bayColour*=mix(.24,1.,uNight);
 color=mix(color,bayColour,bayRegion);
 alpha=mix(alpha,.985,bayRegion);
 gl_FragColor = vec4(color, alpha);`);
 material.needsUpdate=true;ocean.material=material;
 const report={version:'target-bay-water-2-depth-colour',bounds,resolution,cellSize:[dx,dz],samples:count,missing,wet,seaGeometryChanged:false,terrainChanged:false,method:'final mesh sampled depth and 8-neighbour chamfer shore-distance field; continuous fragment-time foam and ripples',limitations:['Finite shoreline raster; details below cell size may be missed.','No screen-space reflection or spectral wave simulation.','Material-only candidate; actual GPU and shoreline comparison pending.']};
 let disposed=false;return{report,dispose(){if(disposed)return;disposed=true;if(ocean.material===material)ocean.material=original;material.dispose();texture.dispose();}};
}
