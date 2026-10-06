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
