// Deterministic production/transport ledger. The renderer never owns inventory.
export const ROBOT_KINDS=Object.freeze(['locust','ant','beetle']);
export const ROBOT_CARGO_SLOTS=9;
const PREFIX={locust:'LOC',ant:'ANT',beetle:'BTL'};
export class RobotLogistics {
 constructor(saved=null){
  this.version=1;this.time=0;this.serial=0;this.units=[];this.events=[];this.materialDeliveries=0;
  this.factories=Object.fromEntries(ROBOT_KINDS.map(kind=>[kind,{kind,kits:3,active:null,enabled:true,produced:0}]));
  this.trains=Object.fromEntries(['red','blue'].map(id=>[id,{id,slots:Array(ROBOT_CARGO_SLOTS).fill(null),job:null,lastFactory:null}]));
  this.productionSeconds=90;this.handlingSeconds=8;this.maxUnits=24;
  if(saved)this.restore(saved);
 }
 emit(type,data={}){this.events.push({type,time:this.time,...data});if(this.events.length>200)this.events.shift();}
 get(id){return this.units.find(u=>u.id===id);}
 factoryStock(kind){return this.units.filter(u=>u.kind===kind&&u.status==='ready');}
 receive(kind,kits=3){if(!this.factories[kind]||!Number.isInteger(kits)||kits<0)return false;this.factories[kind].kits+=kits;this.materialDeliveries+=kits;this.emit('materials',{kind,kits});return true;}
 startProduction(f){if(!f.enabled||f.active||f.kits<1||this.units.filter(u=>u.status!=='lost').length>=this.maxUnits||this.factoryStock(f.kind).length>=6)return;
  // Reserve room for a complete batch before starting its first machine. Otherwise
  // three parallel factories stop at 8 units each and strand six unshippable units.
  const counts=Object.fromEntries(ROBOT_KINDS.map(kind=>[kind,this.units.filter(u=>u.kind===kind).length]));
  if(counts[f.kind]%3===0){
   const committed=this.units.filter(u=>u.status!=='lost').length+Object.values(counts).reduce((sum,n)=>sum+(3-n%3)%3,0);
   if(f.kits<3||committed+3>this.maxUnits)return;
  }
  const id=PREFIX[f.kind]+'-'+String(++this.serial).padStart(4,'0');f.kits--;f.active=id;
  this.units.push({id,kind:f.kind,status:'assembly',progress:0,factory:f.kind,train:null,slot:null,batch:null,health:1});this.emit('assembly-start',{id,kind:f.kind});
 }
 reserveBatch(trainId,kind){
  const train=this.trains[trainId],factory=this.factories[kind];if(!train||!factory||train.job)return false;
  const ready=this.factoryStock(kind).filter(u=>!u.batch&&!u.defending).slice(0,3);let first=-1;
  for(let s=0;s<=ROBOT_CARGO_SLOTS-3;s++)if(train.slots.slice(s,s+3).every(x=>x===null)){first=s;break;}
  if(ready.length!==3||first<0)return false;
  const batch=`${PREFIX[kind]}-B${ready[0].id.split('-')[1]}`;
  ready.forEach((u,i)=>{u.status='reserved';u.batch=batch;u.train=trainId;u.slot=first+i;train.slots[first+i]=u.id;});
  train.job={type:'load',createdAt:this.time,factory:kind,ids:ready.map(u=>u.id),index:0,elapsed:0};train.lastFactory=kind;this.emit('batch-reserved',{trainId,kind,batch,ids:train.job.ids.slice()});return true;
 }
 dock(trainId,stop){
  const train=this.trains[trainId];if(!train||train.job)return false;
  if(stop==='frontline'){
   const ids=train.slots.filter(Boolean).filter(id=>this.get(id)?.status==='transit');if(!ids.length)return false;
   train.job={type:'unload',createdAt:this.time,factory:null,ids,index:0,elapsed:0};this.emit('unload-start',{trainId,ids:ids.slice()});return true;
  }
  return this.reserveBatch(trainId,stop);
 }
 isHolding(trainId){return !!this.trains[trainId]?.job;}
 handlingDuration(job){return job?.type==='unload'?(this.unloadingSeconds??this.handlingSeconds):this.handlingSeconds;}
 cancelJob(trainId){
  const train=this.trains[trainId];if(!train?.job)return;
  for(const id of train.job.ids){const u=this.get(id);if(u.status==='reserved'||u.status==='loading'){train.slots[u.slot]=null;Object.assign(u,{status:'ready',batch:null,train:null,slot:null});}else if(u.status==='unloading')u.status='transit';}
  train.job=null;this.emit('job-cancelled',{trainId});
 }
 update(dt){
  if(!Number.isFinite(dt)||dt<=0)return;let remaining=dt;
  // Fixed small steps make replay and accelerated tests independent of frame size.
  while(remaining>1e-8){const step=Math.min(remaining,.25);remaining-=step;this.time+=step;
   for(const f of Object.values(this.factories)){
    this.startProduction(f);const u=this.get(f.active);if(!u)continue;u.progress=Math.min(1,u.progress+step/this.productionSeconds);
    if(u.progress>=1-1e-10){u.progress=1;u.status='ready';f.active=null;f.produced++;this.emit('assembly-complete',{id:u.id,kind:u.kind});}
   }
   const owners=new Map();for(const train of Object.values(this.trains).filter(t=>t.job).sort((a,b)=>(a.job.createdAt||0)-(b.job.createdAt||0)||a.id.localeCompare(b.id))){const key=train.job.factory||'frontline';if(!owners.has(key))owners.set(key,train.id);}
   for(const train of Object.values(this.trains)){
    const job=train.job;if(!job||owners.get(job.factory||'frontline')!==train.id)continue;const u=this.get(job.ids[job.index]);
    if(!u){this.cancelJob(train.id);continue;}u.status=job.type==='load'?'loading':'unloading';job.elapsed+=step;
    if(job.elapsed+1e-8<this.handlingDuration(job))continue;
    if(job.type==='load'){u.status='transit';this.emit('loaded',{id:u.id,trainId:train.id,slot:u.slot});}
    else{train.slots[u.slot]=null;u.status='deployed';u.train=null;u.slot=null;this.emit('deployed',{id:u.id,kind:u.kind});}
    job.index++;job.elapsed=0;if(job.index>=job.ids.length){this.emit('train-ready',{trainId:train.id,job:job.type});train.job=null;}
   }
  }
 }
 markLost(id){const u=this.get(id);if(!u||!['ready','deployed','repair'].includes(u.status))return false;u.status='lost';this.emit('lost',{id});return true;}
 repair(id){const u=this.get(id);if(!u||u.status!=='deployed')return false;u.status='repair';this.emit('repair',{id});return true;}
 finishRepair(id){const u=this.get(id);if(u?.status!=='repair')return false;u.health=1;u.status='deployed';this.emit('repaired',{id});return true;}
 snapshot(){return JSON.parse(JSON.stringify({version:this.version,time:this.time,serial:this.serial,units:this.units,factories:this.factories,trains:this.trains,materialDeliveries:this.materialDeliveries}));}
 restore(s){
  if(s?.version!==1||!Array.isArray(s.units)||s.units.length>10000)throw Error('Unsupported logistics save');
  const copy=JSON.parse(JSON.stringify(s)),candidate=new RobotLogistics();
  for(const key of ['version','time','serial','units','factories','trains','materialDeliveries'])candidate[key]=copy[key];
  // v1 saves had six slots; retain identities and append three free flatcars.
  for(const t of Object.values(candidate.trains||{}))if(Array.isArray(t?.slots)&&t.slots.length===6)t.slots.push(null,null,null);
  candidate.assertInvariants();
  for(const key of ['version','time','serial','units','factories','trains','materialDeliveries'])this[key]=candidate[key];
  this.events=[];
  // Resume animations from their nearest stable ownership boundary, not a new unit.
  for(const train of Object.values(this.trains))if(train.job){const u=this.get(train.job.ids[train.job.index]);if(u){u.status=train.job.type==='load'?'reserved':'transit';train.job.elapsed=0;}}
 }
 assertInvariants(){
  const finite=(v,min=0,max=Infinity)=>Number.isFinite(v)&&v>=min&&v<=max;
  const integer=v=>Number.isSafeInteger(v)&&v>=0;
  if(!finite(this.time)||!integer(this.serial)||!integer(this.materialDeliveries))throw Error('Invalid logistics clock/counter');
  if(!this.factories||!this.trains||Object.keys(this.factories).sort().join(',')!=='ant,beetle,locust'||Object.keys(this.trains).sort().join(',')!=='blue,red')throw Error('Invalid logistics topology');
  const states=['assembly','ready','reserved','loading','transit','unloading','deployed','repair','lost'];
  const ids=new Set(),slots=new Set(),jobs=new Set();
  for(const u of this.units){
   if(!u||!ROBOT_KINDS.includes(u.kind)||typeof u.id!=='string'||!new RegExp('^'+PREFIX[u.kind]+'-[0-9]{4,}$').test(u.id)||Number(u.id.split('-')[1])>this.serial||ids.has(u.id))throw Error('Invalid/duplicate robot identity');
   ids.add(u.id);if(!states.includes(u.status)||u.factory!==u.kind||!finite(u.health,0,1)||!finite(u.progress,0,1))throw Error('Invalid robot state '+u.id);
   const cargo=['reserved','loading','transit','unloading'].includes(u.status);
   if(cargo?(!this.trains[u.train]||!Number.isInteger(u.slot)||u.slot<0||u.slot>=ROBOT_CARGO_SLOTS):(u.train!==null||u.slot!==null))throw Error('Invalid robot freight reference '+u.id);
  }
  for(const [key,t]of Object.entries(this.trains)){
   if(!t||t.id!==key||!Array.isArray(t.slots)||t.slots.length!==ROBOT_CARGO_SLOTS)throw Error('Invalid train capacity');
   for(const [slot,id]of t.slots.entries()){
    if(id===null)continue;if(slots.has(id))throw Error('Duplicate cargo');slots.add(id);const u=this.get(id);
    if(!u||u.train!==t.id||u.slot!==slot||!['reserved','loading','transit','unloading'].includes(u.status))throw Error('Invalid cargo ownership '+id);
   }
   const j=t.job;if(j){
    if(!['load','unload'].includes(j.type)||!Array.isArray(j.ids)||j.ids.length<1||j.ids.length>ROBOT_CARGO_SLOTS||new Set(j.ids).size!==j.ids.length||!Number.isInteger(j.index)||j.index<0||j.index>=j.ids.length||!finite(j.elapsed)||!finite(j.createdAt??0)|| (j.type==='load'?!this.factories[j.factory]:j.factory!==null))throw Error('Invalid crane job');
    for(const [i,id]of j.ids.entries()){
     const u=this.get(id);if(!u||(j.type==='load'&&u.kind!==j.factory))throw Error('Invalid crane cargo');
     if(i>=j.index){if(jobs.has(id)||u.train!==key||!['reserved','loading','transit','unloading'].includes(u.status))throw Error('Invalid pending crane cargo');jobs.add(id);}
    }
   }
  }
  for(const u of this.units){
   if(['reserved','loading','transit','unloading'].includes(u.status)&&!slots.has(u.id))throw Error('Missing freight slot '+u.id);
   if(['reserved','loading','unloading'].includes(u.status)&&!jobs.has(u.id))throw Error('Missing crane job '+u.id);
   if(u.status==='assembly'&&this.factories[u.kind].active!==u.id)throw Error('Missing assembly owner');
  }
  for(const [kind,f]of Object.entries(this.factories)){
   if(!f||f.kind!==kind||!integer(f.kits)||!integer(f.produced)||typeof f.enabled!=='boolean')throw Error('Invalid factory stock');
   if(f.active!==null&&(this.get(f.active)?.status!=='assembly'||this.get(f.active)?.kind!==kind))throw Error('Invalid assembly ownership');
  }
  return {total:this.units.length,counts:this.units.reduce((a,u)=>(a[u.status]=(a[u.status]||0)+1,a),{})};
 }
}
