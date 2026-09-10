// Owns music elements only: positional sound effects and ambient WebAudio are untouched.
export function createBgmOwnership() {
  const requests=new Map(), elements=new Set(), versions=new WeakMap();
  let context={listener:null,saihoji:null},owner=null,needsResume=false,revision=0,activeElement=null;
  const priorities={tram:100,infiltration:90,siege:85,storm:80,cue:79,fleet:70,bubble:60,musicBox:50,swamp:30,canyon:20};
  const spatial=new Set(['storm','cue','fleet','siege','infiltration']);
  const finite=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k]));
  function nearby(key,r) {
    if(!spatial.has(key))return true;
    const source=(key==='storm'||key==='cue')?context.saihoji:r.source;
    if(!finite(source)||!finite(context.listener)){r.inRange=false;return false;}
    const d=Math.hypot(...['x','y','z'].map(k=>context.listener[k]-source[k]));
    const enter=key==='infiltration'?42:70,exit=key==='infiltration'?52:82;
    r.inRange=d<=(r.inRange?exit:enter);r.distance=d;
    return r.inRange;
  }
  function invalidate(el){versions.set(el,(versions.get(el)||0)+1);}
  function silence(record){invalidate(record.el);record.playRevision++;record.rawPause();record.writeVolume(0);}
  function reconcile() {
    let next=null,best=-Infinity;
    for(const [key,r] of requests)if(!context.muted&&r.active&&nearby(key,r)){
      const priority=r.priority??priorities[key]??0;
      if(priority>best){best=priority;next=key;}
    }
    const changed=next!==owner;
    if(changed){owner=next;revision++;needsResume=!!next;}
    for(const r of elements)if(r.key!==owner&&(changed||!r.el.paused||r.readVolume()>0))silence(r);
    return owner;
  }
  const api={
    get owner(){return owner;},
    request(key,active,options={}){
      const r=requests.get(key)||{};Object.assign(r,options,{active:!!active});
      if(options.source)r.source={x:options.source.x,y:options.source.y,z:options.source.z};
      requests.set(key,r);reconcile();return owner===key;
    },
    isRequested:key=>!!requests.get(key)?.active,
    source:key=>requests.get(key)?.source,
    allowed:key=>owner===key,
    setContext(next){context={...context,...next};if(finite(next.listener))context.listener={x:next.listener.x,y:next.listener.y,z:next.listener.z};reconcile();},
    takeResume(){if(!needsResume)return null;needsResume=false;return owner;},
    fade(el){invalidate(el);const v=versions.get(el);return ()=>versions.get(el)===v;},
    wrap(key,el){
      let proto=el,descriptor;
      while(proto&&!descriptor){descriptor=Object.getOwnPropertyDescriptor(proto,'volume');proto=Object.getPrototypeOf(proto);}
      if(!descriptor?.get||!descriptor?.set)throw new Error('BGM media volume accessor unavailable');
      const readVolume=()=>descriptor.get.call(el),writeVolume=v=>descriptor.set.call(el,v);
      const rawPlay=el.play.bind(el),rawPause=el.pause.bind(el);
      const r={key,el,readVolume,writeVolume,rawPause,playRevision:0};elements.add(r);
      Object.defineProperty(el,'volume',{configurable:true,get:readVolume,set:v=>writeVolume(owner===key?v:0)});
      el.pause=()=>{invalidate(el);r.playRevision++;if(activeElement===el)activeElement=null;rawPause();};
      el.play=()=>{
        if(owner!==key){silence(r);return Promise.resolve();}
        needsResume=false;invalidate(el);
        for(const other of elements)if(other!==r&&(!other.el.paused||other.readVolume()>0))silence(other);
        r.playRevision++;activeElement=el;
        const result=rawPlay();
        return Promise.resolve(result).then(()=>{if(owner!==key||activeElement!==el){rawPause();writeVolume(0);}});
      };
      el.addEventListener('play',()=>{if(owner!==key||activeElement!==el)silence(r);});
      el.addEventListener('ended',()=>{if(key!=='tram'&&!el.loop){const request=requests.get(key);if(request)request.active=false;reconcile();}});
      return el;
    },
    snapshot(){return {owner,revision,listener:context.listener,requests:[...requests].map(([key,r])=>({key,active:r.active,inRange:r.inRange??null,distance:r.distance??null})),elements:[...elements].map(r=>({key:r.key,source:r.el.currentSrc||r.el.src,paused:r.el.paused,volume:r.readVolume(),currentTime:r.el.currentTime}))};},
  };
  return api;
}
