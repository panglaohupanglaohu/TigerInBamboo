import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCurvedWaterMaterial} from '../../src/render/water/curvedWaterMaterial.js';
import {createTargetBayWaterAppearance} from '../../src/world/citadel/targetBayWaterAppearance.js';

test('coastal field is based on final samples, preserves wave clock and restores shared ocean',()=>{
 const original=createCurvedWaterMaterial(THREE); original.fragmentShader=original.fragmentShader.replace('gl_FragColor = vec4(color, alpha);','gl_FragColor=vec4(color,alpha);'); const geometry=new THREE.SphereGeometry(10),ocean=new THREE.Mesh(geometry,original),castle=new THREE.Group();let n=0;
 const c=createTargetBayWaterAppearance({ocean,castle,bounds:[-8,8,-4,4],resolution:[17,9],sampleTerrain:(x,z)=>(n++,x<0?2:-4),sampleSea:()=>0});
 assert.equal(c.report.samples,153);assert.equal(c.report.wet,81);assert.equal(n,153);assert.equal(ocean.geometry,geometry);assert.equal(ocean.material.uniforms.uTime,original.uniforms.uTime);
 const data=ocean.material.uniforms.uCitadelBayField.value.image.data;assert.equal(data[(4*17+8)*4+1],8);assert.equal(data[(4*17+16)*4+1],72);assert.equal(original.fragmentShader.includes('bayRipple'),false);
 let sourceDisposed=0;original.addEventListener('dispose',()=>sourceDisposed++);c.dispose();c.dispose();assert.equal(ocean.material,original);assert.equal(sourceDisposed,0);geometry.dispose();original.dispose();
});
test('missing terrain remains invalid; no invented shoreline',()=>{
 const original=createCurvedWaterMaterial(THREE),ocean=new THREE.Mesh(new THREE.SphereGeometry(10),original);
 const c=createTargetBayWaterAppearance({ocean,castle:new THREE.Group(),bounds:[0,2,0,2],resolution:[3,3],sampleTerrain:()=>null,sampleSea:()=>0});
 assert.equal(c.report.missing,9);assert.equal(c.report.wet,0);const d=ocean.material.uniforms.uCitadelBayField.value.image.data;for(let i=3;i<d.length;i+=4)assert.equal(d[i],0);c.dispose();ocean.geometry.dispose();original.dispose();
});

test('final wet mask stores actual sea-sheet height and rejects incompatible discard without replacing source',()=>{
 const original=createCurvedWaterMaterial(THREE),ocean=new THREE.Mesh(new THREE.SphereGeometry(10),original);
 const c=createTargetBayWaterAppearance({ocean,castle:new THREE.Group(),finalWetMask:true,bounds:[0,2,0,2],resolution:[3,3],sampleTerrain:()=>-20,sampleSea:(x,z)=>-8+x*.5+z*.25});
 try{assert.equal(c.report.finalWetMask,true);const {image}=ocean.material.uniforms.uCitadelBayField.value;const range=ocean.material.uniforms.uCitadelBaySeaRange.value;for(let z=0;z<3;z++)for(let x=0;x<3;x++){const i=(z*3+x)*4,decoded=range.x+image.data[i+2]/255*range.y;assert.ok(Math.abs(decoded-(-8+x*.5+z*.25))<=range.y/255);assert.equal(image.data[i+3],255);}assert.equal(ocean.material.uniforms.uNight,original.uniforms.uNight);}finally{c.dispose();}
 original.fragmentShader=original.fragmentShader.replace('if (waterMask < 0.42) discard;','if (waterMask < 0.4) discard;');
 assert.throws(()=>createTargetBayWaterAppearance({ocean,castle:new THREE.Group(),finalWetMask:true,resolution:[3,3],sampleTerrain:()=>-20,sampleSea:()=>0}),/wet-mask contract/);assert.equal(ocean.material,original);ocean.geometry.dispose();original.dispose();
});


test('bridge-pier contact rings follow only the actual sea-plane intersection',()=>{
 const material=createCurvedWaterMaterial(THREE),ocean=new THREE.Mesh(new THREE.SphereGeometry(10),material),castle=new THREE.Group();castle.position.set(12,8,-4);castle.rotation.y=.6;
 const root=new THREE.Group();castle.add(root);
 const pier=new THREE.Mesh(new THREE.BoxGeometry(1.2,8,1.2));pier.name='double-deck-side-pier-0';pier.position.set(3,0,1);root.add(pier);
 const dry=pier.clone();dry.position.set(-3,8,1);root.add(dry);
 const c=createTargetBayWaterAppearance({ocean,castle,bounds:[-8,8,-4,4],resolution:[17,9],sampleTerrain:()=>-5,sampleSea:()=>0});
 assert.equal(c.bindContactMeshes([root]),1);const tex=ocean.material.uniforms.uCitadelPillarField.value.image;
 const value=(x,z)=>tex.data[(Math.round((z+4)/8*(tex.height-1))*tex.width+Math.round((x+8)/16*(tex.width-1)))*4];
 assert.equal(value(3,1),0);assert.ok(value(-3,1)>140);assert.ok(value(4,1)<value(7,1));
 c.dispose();pier.geometry.dispose();pier.material.dispose();ocean.geometry.dispose();material.dispose();
});

test('wet bridge contacts retain their sea-sheet evidence outside sampled mountain terrain',()=>{
 const source=createCurvedWaterMaterial(THREE),ocean=new THREE.Mesh(new THREE.SphereGeometry(10),source),castle=new THREE.Group();
 const pier=new THREE.Mesh(new THREE.BoxGeometry(1,8,1));pier.name='shore-bridge-pier';pier.position.set(3,-2,1);castle.add(pier);
 const sea=(x,z)=>-2+x*.02+z*.01;
 const water=createTargetBayWaterAppearance({ocean,castle,finalWetMask:true,bounds:[-8,8,-4,4],resolution:[17,9],sampleTerrain:()=>null,sampleSea:sea});
 assert.equal(water.report.wet,0);assert.equal(water.bindContactMeshes([castle]),1);
 const f=ocean.material.uniforms.uCitadelPillarField.value.image;
 const ix=Math.round(11/16*(f.width-1)),iz=Math.round(5/8*(f.height-1)),k=(iz*f.width+ix)*4;
 assert.equal(f.data[k+3],255);assert.equal(f.data[k],0);
 const actual=sea(-8+16*ix/(f.width-1),-4+8*iz/(f.height-1));
 assert.ok(Math.abs(-400+(f.data[k+1]*256+f.data[k+2])/65535*500-actual)<.008);
 assert.equal(f.data[3],0,'distant water gets no invented contact');
 assert.match(ocean.material.fragmentShader,/max\(bayWet,pierRegion\)/);
 water.dispose();pier.geometry.dispose();pier.material.dispose();ocean.geometry.dispose();source.dispose();
});
