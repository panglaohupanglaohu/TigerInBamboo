import * as THREE from 'three';

/** Final-mesh coastal colour field. Static shoreline/depth samples, animated
 * fragment foam. Does not move sea/terrain or substitute a flat ocean plane. */
export function createTargetBayWaterAppearance({ocean,castle,sampleTerrain,sampleSea,bounds=[-215,165,-100,155],resolution=[224,152],finalWetMask=false}={}){
 if(!ocean?.material?.isShaderMaterial||!castle||typeof sampleTerrain!=='function'||typeof sampleSea!=='function')throw new TypeError('actual ocean, castle and final surface samplers required');
 const [nx,nz]=resolution,[x0,x1,z0,z1]=bounds;
 if(![...bounds,...resolution].every(Number.isFinite)||nx<2||nz<2||nx>256||nz>256||x1<=x0||z1<=z0)throw new RangeError('invalid water field dimensions');
 const dx=(x1-x0)/(nx-1),dz=(z1-z0)/(nz-1),count=nx*nz,depths=new Float32Array(count),distance=new Float32Array(count),valid=new Uint8Array(count),seaHeights=new Float32Array(count);let missing=0,wet=0,seaMin=Infinity,seaMax=-Infinity;
 for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
  const i=z*nx+x,px=x0+x*dx,pz=z0+z*dz,a=sampleTerrain(px,pz),b=sampleSea(px,pz),land=typeof a==='number'?a:a?.height,sea=typeof b==='number'?b:b?.height;
  if(!Number.isFinite(land)||!Number.isFinite(sea)){missing++;distance[i]=1e5;continue;}
  valid[i]=1;seaHeights[i]=sea;seaMin=Math.min(seaMin,sea);seaMax=Math.max(seaMax,sea);depths[i]=sea-land;distance[i]=depths[i]>0?1e5:0;if(depths[i]>0)wet++;
 }
 // Two-pass chamfer distance in castle metres; finite grid approximation.
 const diagonal=Math.hypot(dx,dz);for(let pass=0;pass<2;pass++){
  const sign=pass?-1:1;for(let k=0;k<count;k++){
   const i=pass?count-1-k:k,x=i%nx,z=Math.floor(i/nx);if(!valid[i])continue;
   for(const [ox,oz,cost]of[[-sign,0,dx],[0,-sign,dz],[-sign,-sign,diagonal],[sign,-sign,diagonal]]){const xx=x+ox,zz=z+oz;if(xx<0||xx>=nx||zz<0||zz>=nz)continue;const j=zz*nx+xx;if(valid[j])distance[i]=Math.min(distance[i],distance[j]+cost);}
  }
 }
 const seaRange=Number.isFinite(seaMin)?[seaMin,Math.max(.001,seaMax-seaMin)]:[0,1];
 const data=new Uint8Array(count*4);for(let i=0;i<count;i++)data.set([Math.round(THREE.MathUtils.clamp(depths[i]/15,0,1)*255),Math.round(Math.min(1,distance[i]/32)*255),Math.round(THREE.MathUtils.clamp((seaHeights[i]-seaRange[0])/seaRange[1],0,1)*255),valid[i]?255:0],i*4);
 const texture=new THREE.DataTexture(data,nx,nz,THREE.RGBAFormat);texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;texture.needsUpdate=true;texture.name='citadel-final-bay-shore-distance';
 const contactW=512,contactH=384,contactData=new Uint8Array(contactW*contactH*4);
 const resetContacts=()=>{contactData.fill(0);for(let i=0;i<contactData.length;i+=4)contactData[i]=255;};resetContacts();
 const contactTexture=new THREE.DataTexture(contactData,contactW,contactH,THREE.RGBAFormat);contactTexture.minFilter=contactTexture.magFilter=THREE.LinearFilter;contactTexture.needsUpdate=true;
 const original=ocean.material,material=original.clone();material.name='citadel-target-bay-water';
 // The world controller retains original uniform references for wave/day time.
 material.uniforms={...original.uniforms,uCitadelPillarField:{value:contactTexture}};
 castle.updateWorldMatrix(true,false);material.uniforms.uCitadelBayFrame={value:castle.matrixWorld.clone().invert()};material.uniforms.uCitadelBayRect={value:new THREE.Vector4(x0,z0,x1-x0,z1-z0)};material.uniforms.uCitadelBayField={value:texture};
 material.uniforms.uCitadelBaySeaRange={value:new THREE.Vector2(...seaRange)};
 material.vertexShader='varying vec3 vCitadelBayWorld;\n'+material.vertexShader;
 material.vertexShader=material.vertexShader.replace('gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);','vCitadelBayWorld=(modelMatrix*vec4(p,1.)).xyz;\n gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);');
 material.fragmentShader='varying vec3 vCitadelBayWorld; uniform mat4 uCitadelBayFrame; uniform vec4 uCitadelBayRect; uniform sampler2D uCitadelBayField; uniform vec2 uCitadelBaySeaRange; uniform sampler2D uCitadelPillarField;\n'+material.fragmentShader;
 const marker=/gl_FragColor\s*=\s*vec4\(\s*color\s*,\s*alpha\s*\)\s*;/;if(!marker.test(material.fragmentShader)){texture.dispose();contactTexture.dispose();material.dispose();throw new Error('unsupported ocean fragment output');}
 const bayDeclaration=` vec3 bayP=(uCitadelBayFrame*vec4(vCitadelBayWorld,1.)).xyz;
 vec2 bayUv=(bayP.xz-uCitadelBayRect.xy)/uCitadelBayRect.zw;
 vec4 bayField=texture2D(uCitadelBayField,bayUv);
 float bayBounds=smoothstep(0.,.035,bayUv.x)*(1.-smoothstep(.965,1.,bayUv.x))*smoothstep(0.,.035,bayUv.y)*(1.-smoothstep(.965,1.,bayUv.y));
 float bayRegion=bayBounds*step(.99,bayField.a);
 vec4 pierField=texture2D(uCitadelPillarField,bayUv);
 float pierSeaY=-400.+(pierField.g*65280.+pierField.b*255.)/65535.*500.;
 float pierSheet=1.-smoothstep(.3,.8,abs(bayP.y-pierSeaY));
 float pierRegion=bayBounds*step(.99,pierField.a)*pierSheet*(1.-smoothstep(5.,6.,pierField.r*8.));
`;
 const mainMarker=/void\s+main\s*\(\s*\)\s*\{/;
 const discardMarker=/if\s*\(waterMask\s*<\s*0\.42\)\s*discard\s*;/;
 if(!mainMarker.test(material.fragmentShader)||(finalWetMask&&!discardMarker.test(material.fragmentShader))){texture.dispose();contactTexture.dispose();material.dispose();throw new Error('unsupported ocean wet-mask contract');}
 material.fragmentShader=material.fragmentShader.replace(mainMarker,m=>m+bayDeclaration+(finalWetMask?`
 float baySeaY=uCitadelBaySeaRange.x+bayField.b*uCitadelBaySeaRange.y;
 float baySheet=1.-smoothstep(1.0,2.0,abs(bayP.y-baySeaY));
 bayRegion*=baySheet;
 float bayWet=bayRegion*step(.001,bayField.r);
 `:''));
 if(finalWetMask)material.fragmentShader=material.fragmentShader.replace(discardMarker,'if(waterMask<0.42 && max(bayWet,pierRegion)<0.5) discard;');
 material.fragmentShader=material.fragmentShader.replace(marker,`
 float bayDistance=bayField.g*32.;
 vec3 bayColour=mix(vec3(.60,.83,.82),vec3(.27,.68,.76),max(smoothstep(.02,.36,bayField.r),.9*smoothstep(2.,28.,bayDistance)));
 // Quiet open water: retain a faint irregular colour drift, no long crests.
 float bayRipple=sin(bayP.x*.37+sin(bayP.z*.29)-uTime*.22)*sin(bayP.z*.31-bayP.x*.19+uTime*.17);
 bayColour+=vec3(.009,.013,.012)*bayRipple;
 float pillarDistance=mix(32.,pierField.r*8.,pierSheet*step(.99,pierField.a));
 bayDistance=min(bayDistance,pillarDistance);
 float bayPhase=bayDistance-uTime*.48+.16*sin(bayP.x*.39+bayP.z*.27);
 float bayRing=abs(fract(bayPhase/3.8)-.5)*3.8;
 float bayAA=max(.045,fwidth(bayRing));
 float bayFoam=(1.-smoothstep(.16,.16+bayAA,bayRing))*(1.-smoothstep(.6,5.2,bayDistance));
 float bayEdge=(1.-smoothstep(.22,.95,bayDistance))*(.38+.13*sin(uTime*.8+bayP.x*.48));
 bayColour=mix(bayColour,vec3(.94,.97,.94),clamp(bayFoam*.86+bayEdge,0.,.8));
 bayColour*=mix(.24,1.,uNight);
 float waterRegion=max(bayRegion,pierRegion);
 color=mix(color,bayColour,waterRegion);
 alpha=mix(alpha,.985,waterRegion);
 gl_FragColor = vec4(color, alpha);`);
 material.needsUpdate=true;ocean.material=material;
 const report={version:'target-bay-water-6-independent-wet-pier-contacts',finalWetMask,seaRange,bounds,resolution,cellSize:[dx,dz],samples:count,missing,wet,seaGeometryChanged:false,terrainChanged:false,method:'final mesh sampled depth and 8-neighbour chamfer shore-distance field; quiet turquoise open water; animated shore and actual water-intersecting bridge-pier contact foam',limitations:['Finite shoreline raster; details below cell size may be missed.','No screen-space reflection or spectral wave simulation.','Gate beyond the main terrain sampler requires actual contact geometry; no invented shore where terrain samples are missing.']};
 // Called once after actual transit structures are attached to the castle.
 function bindContactMeshes(structures){
  resetContacts();castle.updateWorldMatrix(true,true);const inv=castle.matrixWorld.clone().invert();let contacts=0;const contactSections=[];
  for(const structure of structures.filter(Boolean)){structure.updateWorldMatrix(true,true);structure.traverse(o=>{
   if(!o.isMesh||!/(?:pier|pillar|column)/i.test(o.name))return;
   const relative=inv.clone().multiply(o.matrixWorld),p=o.geometry.attributes.position;if(!p)return;
   const box=new THREE.Box3(),v=new THREE.Vector3();for(let i=0;i<p.count;i++)box.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(relative));
   const cx=(box.min.x+box.max.x)/2,cz=(box.min.z+box.max.z)/2,seaValue=sampleSea(cx,cz),sy=typeof seaValue==='number'?seaValue:seaValue?.height;
   if(!Number.isFinite(sy)||box.min.y>sy+.18||box.max.y<sy-.18)return;
   // Use the exact triangle/sea-plane section rather than a tall pillar's AABB.
   const section=new THREE.Box2(),index=o.geometry.index,read=k=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(k):k).applyMatrix4(relative),n=index?index.count:p.count;
   for(let i=0;i<n;i+=3){const tri=[read(i),read(i+1),read(i+2)];for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3];if((a.y-sy)*(b.y-sy)>0||Math.abs(a.y-b.y)<1e-8)continue;const t=(sy-a.y)/(b.y-a.y);if(t>=0&&t<=1)section.expandByPoint(new THREE.Vector2(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t));}}
   if(section.isEmpty()||section.max.x<x0||section.min.x>x1||section.max.y<z0||section.min.y>z1)return;contacts++;contactSections.push({name:o.name,center:[cx,sy,cz],bounds:[section.min.x,section.max.x,section.min.y,section.max.y]});
   const sx=(x1-x0)/(contactW-1),sz=(z1-z0)/(contactH-1);
   const left=Math.max(0,Math.floor((section.min.x-x0-6)/sx)),right=Math.min(contactW-1,Math.ceil((section.max.x-x0+6)/sx)),top=Math.max(0,Math.floor((section.min.y-z0-6)/sz)),bottom=Math.min(contactH-1,Math.ceil((section.max.y-z0+6)/sz));
   for(let z=top;z<=bottom;z++)for(let x=left;x<=right;x++){const px=x0+x*sx,pz=z0+z*sz,d=Math.hypot(Math.max(section.min.x-px,0,px-section.max.x),Math.max(section.min.y-pz,0,pz-section.max.y)),k=(z*contactW+x)*4;if(d>6)continue;const seaSample=sampleSea(px,pz),height=typeof seaSample==='number'?seaSample:seaSample?.height;if(!Number.isFinite(height))continue;const encoded=Math.round(THREE.MathUtils.clamp((height+400)/500,0,1)*65535);contactData[k]=Math.min(contactData[k],Math.round(Math.min(1,d/8)*255));contactData[k+1]=encoded>>8;contactData[k+2]=encoded&255;contactData[k+3]=255;}
  });}
  contactTexture.needsUpdate=true;report.pillarContacts=contacts;report.pillarContactSections=contactSections;report.pillarFieldResolution=[contactW,contactH];return contacts;
 }
 let disposed=false;return{report,bindContactMeshes,dispose(){if(disposed)return;disposed=true;if(ocean.material===material)ocean.material=original;material.dispose();texture.dispose();contactTexture.dispose();}};
}
