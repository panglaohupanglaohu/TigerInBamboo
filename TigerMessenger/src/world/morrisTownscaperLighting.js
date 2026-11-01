import * as T from 'three';
import {TOWN_TIME_PROFILES} from './morrisTownStage.js?v=reacode-refactor-r2';
// Morris Lake = build-time lighting. While the camera is in the lake (or the build camera is on), the game's own
// lights, fog and sky colour are switched off for the main pass and replaced by the REACodeRefactoring scene rig
// (same colours / intensities / directions / exposure as the town stage), anchored to the lake frame.
export {TOWN_TIME_PROFILES as TOWN_LIGHT_PROFILES};
export function createMorrisTownLighting({group,world,castShadow=false}){
 const rig=new T.Group();rig.name='morris-refactor-build-lighting';rig.visible=false;group.add(rig);
 const ambient=new T.AmbientLight(0xfffbf2),hemi=new T.HemisphereLight(0xf2fbff,0x9fb9b4),sun=new T.DirectionalLight(),fill=new T.DirectionalLight(0xd9ecf6);
 rig.add(ambient,hemi,sun,sun.target,fill);fill.position.set(-16,10,-12);sun.castShadow=castShadow;
 const owned=new Set([ambient,hemi,sun,fill]),target=new T.Vector3(),dir=new T.Vector3();let mode='day';
 function setMode(value){if(!TOWN_TIME_PROFILES[value])return;mode=value;const p=TOWN_TIME_PROFILES[mode];ambient.intensity=p.amb;hemi.intensity=p.hemi;fill.intensity=p.fill;sun.color.setHex(p.sun[0]);sun.intensity=p.sun[1];}
 setMode(mode);
 function beginRender({scene,renderer}){const p=TOWN_TIME_PROFILES[mode],lights=[];
  const previous={background:scene.background,fog:scene.fog,tone:renderer.toneMapping,exposure:renderer.toneMappingExposure,space:renderer.outputColorSpace};
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,maxH=0;for(const c of world.cells){const top=world.top(c);if(!top)continue;minX=Math.min(minX,c.minX);maxX=Math.max(maxX,c.maxX);minZ=Math.min(minZ,c.minZ);maxZ=Math.max(maxZ,c.maxZ);maxH=Math.max(maxH,top);}
  target.set(Number.isFinite(minX)?(minX+maxX)/2:0,Math.max(.6,maxH*.25),Number.isFinite(minZ)?(minZ+maxZ)/2:0);sun.target.position.copy(target);sun.position.copy(target).addScaledVector(dir.set(...p.dir).normalize(),30);
  scene.traverse(o=>{if(o.isLight&&!owned.has(o)&&o.visible){lights.push(o);o.visible=false;}});rig.visible=true;rig.updateWorldMatrix(true,true);
  scene.background=new T.Color(p.bg);scene.fog=null;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=p.exp;renderer.outputColorSpace=T.SRGBColorSpace;
  return()=>{rig.visible=false;for(const light of lights)light.visible=true;scene.background=previous.background;scene.fog=previous.fog;renderer.toneMapping=previous.tone;renderer.toneMappingExposure=previous.exposure;renderer.outputColorSpace=previous.space;};
 }
 return{rig,sun,get mode(){return mode;},setMode,beginRender,dispose(){rig.removeFromParent();}};
}
