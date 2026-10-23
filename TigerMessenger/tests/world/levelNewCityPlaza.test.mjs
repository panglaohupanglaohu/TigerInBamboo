import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {levelNewCityPlaza,NEW_CITY_PLAZA_POLY} from '../../src/world/citadel/levelNewCityPlaza.js';
function fixture(){
 const scene=new T.Scene(),castle=new T.Group();castle.name='castleContainer';castle.position.set(0,160,0);scene.add(castle);
 const terr=new T.Mesh(new T.PlaneGeometry(200,200,100,100).rotateX(-Math.PI/2).translate(66,2.8,77),new T.MeshBasicMaterial());terr.name='citadel-oskar-grid-mountain-surface';castle.add(terr);
 const cand=new T.Group();cand.name='citadel-target-city-detail-candidate';castle.add(cand);
 const plaza=new T.Group();plaza.name='target-new-city-paved-plaza';cand.add(plaza);
 const shape=new T.Shape(NEW_CITY_PLAZA_POLY.map(([x,z])=>new T.Vector2(x,-z)));const pav=new T.Mesh(new T.ShapeGeometry(shape).rotateX(-Math.PI/2).translate(0,2.83,0),new T.MeshBasicMaterial());pav.name='target-plaza-paving-surface';plaza.add(pav);
 const statue=new T.Group();statue.name='citadel-plaza-hero-statue';statue.position.set(56,2.85,78);castle.add(statue);
 const horse=new T.Group();horse.name='citadel-trojan-horse';horse.position.copy(new T.Vector3(72,2.85,78).add(castle.position));scene.add(horse);
 scene.updateMatrixWorld(true);return{scene,castle,terr,plaza,statue,horse};
}
test('plaza, statue and horse end level with the local radial; terrain above the deck is cut; walls built',()=>{
 const f=fixture(),before=new T.Vector3(0,1,0).transformDirection(f.plaza.matrixWorld).angleTo(new T.Vector3(66,163,77).normalize());
 assert.ok(before>.3,'fixture leans');
 const r=levelNewCityPlaza({scene:f.scene});assert.equal(r.applied,true);assert.ok(r.tiltDegrees>20);
 f.scene.updateMatrixWorld(true);
 const piv=new T.Vector3(66,2.83,77).applyMatrix4(f.plaza.matrixWorld);
 for(const o of[f.plaza,f.statue,f.horse]){const up=new T.Vector3(0,1,0).transformDirection(o.matrixWorld);assert.ok(up.angleTo(piv.clone().normalize())<.01,o.name+' level');}
 assert.ok(r.moved.includes('citadel-trojan-horse')&&r.moved.includes('citadel-plaza-hero-statue'));
 assert.ok(r.terrainCut.vertices>0);assert.ok(f.plaza.getObjectByName('plaza-level-retaining-walls').children.length>0);
 assert.equal(levelNewCityPlaza({scene:f.scene}),r,'idempotent');
});
test('?plazaLevel=0 leaves everything untouched',()=>{const f=fixture(),saved=globalThis.location;globalThis.location={search:'?plazaLevel=0'};try{const r=levelNewCityPlaza({scene:f.scene});assert.equal(r.applied,false);}finally{globalThis.location=saved;}assert.equal(f.plaza.position.length(),0);});
