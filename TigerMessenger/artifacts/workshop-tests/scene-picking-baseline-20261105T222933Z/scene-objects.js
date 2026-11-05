// Runtime references only. Selecting never changes geometry, recipes or saved versions.
const records=new Map();
export function registerSceneObjects(rows){
 for(const row of rows){if(records.has(row.id))throw Error('场景对象ID重复：'+row.id);records.set(row.id,row);}
 return ()=>{for(const row of rows)if(records.get(row.id)===row)records.delete(row.id);};
}
export function listSceneObjects(){return [...records.values()].map(({id,name,kind})=>({id,name,kind}));}
export function getSceneObject(id){const row=records.get(id);if(!row)throw Error('该场景对象当前不可用，请刷新对象列表');return row;}
