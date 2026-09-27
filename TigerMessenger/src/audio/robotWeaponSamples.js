const counts={locust:2,ant:2,beetle:3,sentry:3};
const banks=new WeakMap();
export function loadRobotWeaponSamples(ctx){
 let bank=banks.get(ctx);if(bank)return bank.ready;
 bank={clips:{},error:null};banks.set(ctx,bank);
 bank.ready=Promise.all(Object.entries(counts).filter(([k])=>k!=='sentry').map(async([kind,n])=>{
  bank.clips[kind]=await Promise.all(Array.from({length:n},async(_,i)=>{const url=new URL(`../../assets/audio/robot-combat/${kind}-${i}.wav`,import.meta.url);const r=await fetch(url);if(!r.ok)throw Error(`Robot sample ${r.status}: ${kind}-${i}`);return ctx.decodeAudioData(await r.arrayBuffer());}));
 })).then(()=>true).catch(e=>{bank.error=e.message;return false;});return bank.ready;
}
export function robotSample(ctx,kind,index=0){const clips=banks.get(ctx)?.clips[kind==='sentry'?'beetle':kind];return clips?.[index%clips.length]||null;}
export function robotSampleState(ctx){const b=banks.get(ctx);return{loaded:Object.fromEntries(Object.entries(b?.clips||{}).map(([k,v])=>[k,v.length])),error:b?.error||null};}
