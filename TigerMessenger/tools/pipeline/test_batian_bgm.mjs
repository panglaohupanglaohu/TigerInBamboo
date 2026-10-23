import assert from 'node:assert/strict';
import {createBgmOwnership} from '../../src/audio/bgmOwnership.js';
import {createBatianBgm,BATIAN_BGM_URL,BATIAN_BGM_REMOTE_URL} from '../../src/audio/batianBgm.js';
class Media extends EventTarget {
 constructor(src){super();this.src=src;this.paused=true;this.currentTime=0;this.readyState=0;this.v=0;this.calls=0;this.reject=false;}
 get volume(){return this.v;}set volume(v){this.v=v;}
 play(){this.calls++;if(this.reject)return Promise.reject(Object.assign(new Error('blocked'),{name:'NotAllowedError'}));this.paused=false;this.readyState=4;this.dispatchEvent(new Event('play'));return Promise.resolve();}
 pause(){this.paused=true;}load(){this.readyState=0;}
}
const tick=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};
const checks=[];const check=(name,value)=>{assert.ok(value,name);checks.push(name);};
let now=0,media,suspended=0;const owner=createBgmOwnership();
const update=createBatianBgm(owner, (key,url)=>{media=new Media(url);return owner.wrap(key,media);},()=>suspended++,{read:()=>({music:1})},()=>now);
update(true);await tick();update(true);check('packaged Hitman starts through real ownership',owner.owner==='batian'&&media.src===BATIAN_BGM_URL&&!media.loop&&media.volume===.5&&suspended>0);
media.currentTime=42;update(true,true);check('mute pauses without rewind',media.paused&&media.currentTime===42);update(true);await tick();check('unmute resumes same position',!media.paused&&media.currentTime===42);
owner.request('tram',true);update(true);check('tram retains priority',media.paused&&owner.owner==='tram');owner.request('tram',false);update(true);await tick();check('tram release resumes',!media.paused&&media.currentTime===42);
media.dispatchEvent(new Event('ended'));update(true);check('one play-through stays ended in this battle',update.snapshot().finished&&owner.owner===null);update(false);update(true);await tick();check('new battle restarts at zero',media.currentTime===0&&!update.snapshot().finished);
media.dispatchEvent(new Event('error'));check('local format/load error selects original official MP3 once',media.src===BATIAN_BGM_REMOTE_URL&&update.snapshot().fallback);
update(false);media.reject=true;update(true);await tick();for(let i=0;i<200;i++)update(true);check('rejected play uses backoff rather than frame-loop retry',update.snapshot().failures===1);now=3;update(true);await tick();now=8;update(true);await tick();now=99;for(let i=0;i<200;i++)update(true);check('play failures capped at three attempts per battle',update.snapshot().failures===3);
const o2=createBgmOwnership();let m2;const u2=createBatianBgm(o2,(key,url)=>{m2=new Media(url);m2.play=()=>{m2.calls++;return new Promise(()=>{});};return o2.wrap(key,m2);},()=>{},undefined,()=>now);u2(true);for(let i=0;i<500;i++)u2(true);check('one pending play promise despite 500 frames',m2.calls===1&&u2.snapshot().pending);u2(false);check('ending battle relinquishes owner even during load',o2.owner===null);
console.log(JSON.stringify({passed:true,checks,count:checks.length},null,2));
