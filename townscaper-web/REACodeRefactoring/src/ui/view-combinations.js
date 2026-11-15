/** Main-thread display combinations over the existing View API. Never modifies World/voxel data. */
export const VIEW_COMBINATIONS=Object.freeze([
 {id:'coastal-life',name:'海岸生态',modules:['src/water/shore.js','src/water/waterfall.js','src/life/birds.js','src/life/decor.js'],toggles:{waves:true,waterfalls:true,birds:true,butterflies:true,flags:true}},
 {id:'wind-clouds',name:'风、云与薄雾',modules:['src/life/atmosphere.js','src/life/vegetation.js','src/light/cloud-shadow.js'],toggles:{clouds:true,cloudshadow:true,fog:true,wind:true}},
 {id:'lighting-review',name:'光影检查',modules:['src/world/view.js'],toggles:{lightonly:true,textureonly:false,shadows:true}},
]);
export function readViewToggle(view,key){const actual={wind:view.atmosphere?.arrows?.visible,fog:view.atmosphere?.fog?.visible,clouds:view.vegetation?.cloudField?.mesh?.visible,cloudshadow:view.cloudShadow?.enabled,shadows:view.sun?.castShadow,lightonly:view.lightOnlyOn,textureonly:view.textureOnlyOn?.value,flags:view.decor?.flags?.visible,waves:view.waves?.visible,waterfalls:view.waterfalls?.group?.visible,birds:view.birds?.visible,butterflies:view.decor?.butterflies?.visible};return !!(actual[key]??view.debugState?.[key]);}
export function createViewCombinationPreview(view){
 if(typeof view?.setDebug!=='function')throw Error('场景View尚未就绪');let current=null;
 function restore(){if(!current)return false;for(const [key,on]of Object.entries(current.before))view.setDebug(key,on);current=null;return true;}
 return{preview(id){const recipe=VIEW_COMBINATIONS.find(r=>r.id===id);if(!recipe)throw Error('未知显示组合');restore();const before=Object.fromEntries(Object.keys(recipe.toggles).map(k=>[k,readViewToggle(view,k)]));current={id,before};try{for(const [key,on]of Object.entries(recipe.toggles))view.setDebug(key,on);}catch(error){restore();throw error;}return{...recipe,before};},restore,current:()=>current?.id||null};
}
