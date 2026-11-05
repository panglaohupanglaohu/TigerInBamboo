// Read-only comparison identity. Never replaces legacy recipe IDs or auto-migrates scenes.
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
async function digest(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(value)))))].map(v=>v.toString(16).padStart(2,'0')).join('');}
export async function indexLearningMethods(pipeline){
 if(!Array.isArray(pipeline?.lanes))throw Error('学习管线缺少lanes');
 const candidates=[];
 for(const lane of pipeline.lanes)for(const [group,items]of lane.groups||[])for(const item of items){const post=String(item.id||''),toggle=String(item.toggle||''),where=String(item.where||'').trim().replace(/\s+/g,' ');const identity={post,toggle,where};candidates.push({identity,anchor:JSON.stringify([post,toggle]),lane:lane.key,group,item:structuredClone(item)});}
 const rows=await Promise.all(candidates.map(async row=>({...row,sourceKey:'rea-method:'+await digest(row.identity),revision:await digest({lane:row.lane,group:row.group,item:row.item})})));
 const buckets=new Map();for(const row of rows){const bucket=buckets.get(row.sourceKey)||[];bucket.push(row);buckets.set(row.sourceKey,bucket);}
 const entries=[],conflicts=[];
 for(const [sourceKey,bucket]of buckets){if(bucket.length>1||(!bucket[0].identity.post&&!bucket[0].identity.where)){conflicts.push({type:bucket.length>1?'duplicate-anchor':'missing-anchor',sourceKey,records:bucket});}else entries.push(bucket[0]);}
 return {entries,conflicts};
}
export async function diffLearningPipelines(previous,current){
 const [before,after]=await Promise.all([indexLearningMethods(previous),indexLearningMethods(current)]),old=new Map(before.entries.map(e=>[e.sourceKey,e])),next=new Map(after.entries.map(e=>[e.sourceKey,e]));
 const grouped=new Map();for(const [side,rows]of [['previous',before.conflicts],['current',after.conflicts]])for(const conflict of rows){const key=conflict.type+':'+conflict.sourceKey,existing=grouped.get(key);if(existing){existing.sides.push(side);if(side==='current')existing.records=conflict.records;}else grouped.set(key,{...conflict,sides:[side]});}
 const conflicts=[...grouped.values()],blocked=new Set(conflicts.map(c=>c.sourceKey));
 let added=after.entries.filter(e=>!old.has(e.sourceKey)&&!blocked.has(e.sourceKey)),removed=before.entries.filter(e=>!next.has(e.sourceKey)&&!blocked.has(e.sourceKey));
 // A source-location edit could be a move or a different method: never guess a migration.
 for(const anchor of new Set(added.map(e=>e.anchor))){const a=added.filter(e=>e.anchor===anchor),r=removed.filter(e=>e.anchor===anchor);if(a.length&&r.length){conflicts.push({type:'possible-relocation',anchor,previous:r,current:a});added=added.filter(e=>e.anchor!==anchor);removed=removed.filter(e=>e.anchor!==anchor);}}
 const changed=[],unchanged=[];for(const row of after.entries){const prior=old.get(row.sourceKey);if(prior&&!blocked.has(row.sourceKey))(prior.revision===row.revision?unchanged:changed).push({previous:prior,current:row});}
 return {added,changed,removed,conflicts,unchangedCount:unchanged.length};
}
