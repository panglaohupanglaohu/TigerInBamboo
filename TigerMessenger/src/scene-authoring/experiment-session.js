import {validateRecipe,DEFAULT_SETTINGS,effectiveSettings} from './pipeline-model.js';
export function checkedSettings(settings){
 if(!settings||typeof settings!=='object')throw Error('实验参数缺失');
 for(const [key,value]of Object.entries(settings))if(!Object.hasOwn(DEFAULT_SETTINGS,key)||(key==='time'?!['day','dusk','night'].includes(value):typeof value!=='boolean'))throw Error('实验参数无效：'+key);
 return structuredClone(settings);
}
const canonical=value=>value&&typeof value==='object'?(Array.isArray(value)?value.map(canonical):Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]))):value;
const sameRecipe=(a,b)=>JSON.stringify(canonical({...a,discovered:a.discovered||[]}))===JSON.stringify(canonical({...b,discovered:b.discovered||[]}));
export function createExperimentSession({store,plugin,captureRecipe,restoreRecipe}){
 const capture=()=>({data:plugin.encode(),settings:checkedSettings(plugin.settings()),recipe:structuredClone(captureRecipe())});
 const save=(validate=false,goal=null)=>{const s=capture();validateRecipe(s.recipe);const validation=validate?plugin.validate(s.data):null;if(validate&&!validation?.passed)throw Error(validation?.message||'场景验证失败');return store.save(plugin.id,s.data,goal??s.recipe.goal,validation,s.recipe,s.settings);};
 const parameters=row=>checkedSettings(row.settings||effectiveSettings(row.recipe||{version:1,scene:plugin.id,nodes:[],settings:{}},row.recipe?.baseline||DEFAULT_SETTINGS));
 return {save,
 compare(row){const current=capture(),settings=parameters(row);return {geometryEqual:current.data===row.data,settingsDiff:Object.keys(settings).filter(k=>settings[k]!==current.settings[k]),recipeEqual:!row.recipe||sameRecipe(current.recipe,row.recipe)};},
 restore(row){if(row.scene!==plugin.id)throw Error('实验场景不匹配');const validation=plugin.validate(row.data);if(!validation?.passed)throw Error('实验编码无法恢复');if(row.recipe)validateRecipe(row.recipe);const settings=parameters(row),before=capture();store.save(plugin.id,before.data,'恢复前自动保护',null,before.recipe,before.settings);
  try{plugin.restore(row.data);plugin.apply(settings);if(row.recipe)restoreRecipe(structuredClone(row.recipe));}
  catch(error){plugin.restore(before.data);plugin.apply(before.settings);restoreRecipe(before.recipe);throw Error('恢复失败，已回退：'+error.message);}
  return row;
 },
 finalize(row){const compare=this.compare(row);if(!compare.geometryEqual||compare.settingsDiff.length||!compare.recipeEqual)throw Error('请先恢复所选实验并检查，再确认定稿');return store.finalize(row.id);}
 };
}
