export const MORRIS_GARDEN_BGM_URL=new URL('../../music/Morris-Spanish-Guitar-Garden-Original-v2.wav',import.meta.url).href;
/** Regional original score. The existing music owner still arbitrates tram,
 * battle, and the elder's interactive track. One play-through per island visit. */
export function createMorrisGardenBgm(ownership,makeAudio,suspendAmbience=()=>{}){
 let el=null,inside=false,envelope=0,done=false,pending=false,retryAt=0,error=null,lastNow=null,attempts=0,lastDistance=Infinity;
 const finite=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k]));
 function update({listener,center,gameStarted=true,muted=false,now=performance.now()/1000}={}){
  const dt=lastNow==null?0:Math.min(.5,Math.max(0,now-lastNow));lastNow=now;
  const distance=finite(listener)&&finite(center)?Math.hypot(listener.x-center.x,listener.y-center.y,listener.z-center.z):Infinity;
  lastDistance=distance;
  const next=gameStarted&&distance<(inside?102:92);
  const entered=next&&!inside;
  if(!next&&inside)done=false;
  if(entered&&el?.ended){el.currentTime=0;done=false;}
  inside=next;
  // The render frame can see ended=true before the queued media ended event.
  // Treat it as completion immediately, rather than trying to restart the song.
  if(el?.ended&&!entered&&inside)done=true;
  const target=inside&&!done?Math.min(1,Math.max(0,(102-distance)/14)):0;
  envelope=muted?0:envelope+(target-envelope)*(1-Math.exp(-dt/(target>envelope?1.8:1.2)));
  if(envelope<.001&&!inside)envelope=0;
  const active=!muted&&!done&&(inside||envelope>0);
  const allowed=ownership.request('morrisGarden',active,{priority:35});
  if(!active||!allowed){if(el){el.volume=0;if(!el.paused)el.pause();}return snapshot(distance);}
  if(!el){el=makeAudio('morrisGarden',MORRIS_GARDEN_BGM_URL);el.preload='auto';el.loop=false;el.addEventListener('ended',()=>{done=true;envelope=0;ownership.request('morrisGarden',false);});el.addEventListener('error',()=>{error='media-error-'+(el.error?.code??'unknown');pending=false;retryAt=(lastNow??now)+5;});}
  suspendAmbience();el.volume=.32*envelope;
  if(el.paused&&!pending&&now>=retryAt){
   if(!inside){ownership.request('morrisGarden',false);return snapshot(distance);}
   if(el.ended)el.currentTime=0;
   pending=true;attempts++;retryAt=now+3;
   Promise.resolve(el.play()).then(()=>{pending=false;error=null;retryAt=0;},e=>{pending=false;error=e?.name??'play-failed';retryAt=now+3;});
  }
  return snapshot(distance);
 }
 function snapshot(distance=lastDistance){return{title:'溪畔吉他与舞步',revision:'morris-spanish-guitar-r18',original:true,instruments:'nylon guitar, heel/toe footwork, creek and sparse birds',arrangement:'three body knocks; rolling-chord calm 0-36s; transition 36-48s; footwork 48-108s; gentle ending',syntheticNature:true,inside,envelope,done,owner:ownership.owner,distance,attempts,error,paused:el?.paused??true,volume:el?.volume??0,currentTime:el?.currentTime??0,duration:Number.isFinite(el?.duration)?el.duration:null,readyState:el?.readyState??0,mediaError:el?.error?.code??null,range:{enter:92,exit:102},onePlayPerVisit:true};}
 return{update,snapshot};
}
