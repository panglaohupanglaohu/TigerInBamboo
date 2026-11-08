// Immutable scene versions. No worker may write the editor through this store.
export function createVersionStore(storage, key='tm.scene-authoring.v1') {
 const read=()=>JSON.parse(storage.getItem(key)||'{"versions":[],"finals":{}}');
 return {
  read,
  save(scene, data, goal='', validation=null,recipe=null,settings=null,objects=null,style=null) {
   if(typeof data!=='string'||!data.length)throw Error('场景编码为空');
   const state=read(), row={id:crypto.randomUUID(),scene,data,goal,validation,time:Date.now(),origin:'manual',...(recipe?{recipe:structuredClone(recipe)}:{}),...(settings?{settings:structuredClone(settings)}:{}),...(objects&&Object.keys(objects).length?{objects:structuredClone(objects)}:{}),...(style&&Object.keys(style).length?{style:structuredClone(style)}:{})};
   state.versions.push(row);storage.setItem(key,JSON.stringify(state));return row;
  },
  finalize(id) {
   const state=read(),row=state.versions.find(v=>v.id===id);
   if(!row?.validation?.passed)throw Error('请先验证并保存当前版本');
   state.finals[row.scene]=id;storage.setItem(key,JSON.stringify(state));return row;
  }
 };
}
export function createSceneRegistry(){
 const scenes=new Map();
 return {register(plugin){if(scenes.has(plugin.id))throw Error('场景重复注册');scenes.set(plugin.id,plugin);return()=>scenes.delete(plugin.id);},list:()=>[...scenes.values()],get:id=>scenes.get(id)};
}

// Resolve an exact immutable version, never the moving latest-final pointer in a link.
export function resolveSceneVersion(storage, scene, id) {
 if(!id)return null;
 const row=createVersionStore(storage).read().versions.find(v=>v.id===id&&v.scene===scene);
 if(!row?.validation?.passed)throw Error('指定场景版本不存在或未验证');
 return row;
}
