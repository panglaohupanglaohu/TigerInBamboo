// Runtime references only. Selecting never changes geometry, recipes or saved versions.
const records=new Map();
const batchedOwners=new WeakMap();
export function bindBatchedObjectOwners(mesh,ranges){batchedOwners.set(mesh,ranges);}
export function resolveObjectHit(hit){
 const owner=batchedOwners.get(hit.object)?.find(r=>hit.face?.a>=r.start&&hit.face.a<r.end)?.object;
 if(owner)return records.get(owner.userData.authoringId)||null;
 const object=hit.object;if(!object.isMesh||!object.geometry)return null;
 const instance=Number.isInteger(hit.instanceId)?hit.instanceId:null,id='runtime-mesh:'+object.uuid+(instance===null?'':':instance:'+instance);
 object.geometry.computeBoundingBox();const box=object.geometry.boundingBox?.clone();if(!box||box.isEmpty())return null;
 if(instance!==null){const matrix=object.matrix.clone();object.getMatrixAt(instance,matrix);box.applyMatrix4(matrix);}
 const name=(object.userData.authoringLabel||object.name||object.parent?.name||'未命名网格')+(instance===null?'':' · 实例 '+(instance+1));
 records.set(id,{id,name,kind:'mesh',kindName:object.userData.authoringKind||(instance===null?'场景网格（只读）':'实例物件（只读）'),object,bounds:{min:box.min.toArray(),max:box.max.toArray()}});
 return records.get(id);
}
export function describeSceneObject({id,name,kind,kindName}){return {id,name,kind,kindName:kindName||({'plane-tree':'悬铃树',cypress:'柏树',hollyhock:'蜀葵花丛'}[kind]||'场景对象')};}
export function registerSceneObjects(rows){
 for(const row of rows){if(records.has(row.id))throw Error('场景对象ID重复：'+row.id);records.set(row.id,row);}
 return ()=>{for(const row of rows)if(records.get(row.id)===row)records.delete(row.id);};
}
export function listSceneObjects(){return [...records.values()].map(describeSceneObject);}
export function getSceneObject(id){const row=records.get(id);if(!row)throw Error('该场景对象当前不可用，请刷新对象列表');return row;}
