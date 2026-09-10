import assert from 'node:assert/strict';
import {createBgmOwnership} from '../../src/audio/bgmOwnership.js';
class Media extends EventTarget {
 constructor(){super();this.v=0;this.paused=true;this.currentTime=0;this.pending=[];this.loop=true;}
 get volume(){return this.v;}set volume(v){this.v=v;}
 play(){this.paused=false;return new Promise(resolve=>this.pending.push(()=>{this.paused=false;this.dispatchEvent(new Event('play'));resolve();}));}
 pause(){this.paused=true;}
 async finish(){for(const fn of this.pending.splice(0))fn();await Promise.resolve();await Promise.resolve();}
}
const checks=[];const check=(name,test)=>{assert.ok(test,name);checks.push(name);};
const m=createBgmOwnership(),near={x:0,y:160,z:0},far={x:160,y:0,z:0};m.setContext({listener:near,saihoji:near});
const storm=m.wrap('storm',new Media()),tram=m.wrap('tram',new Media()),fleet=m.wrap('fleet',new Media());
m.request('storm',true);storm.play();storm.volume=.5;check('near battle owns music',m.owner==='storm'&&storm.volume===.5);
const oldFade=m.fade(storm);m.request('tram',true);tram.play();tram.volume=.4;
check('tram revokes battle and invalidates old fade',storm.paused&&storm.volume===0&&!oldFade());
await storm.finish();check('late old play cannot revive battle',storm.paused&&storm.volume===0);
for(let i=0;i<20;i++){m.request('storm',true);storm.play();storm.volume=.9;m.request('fleet',true,{source:near});fleet.play();fleet.volume=.9;}
check('repeated distant battle requests cannot steal tram',m.owner==='tram'&&storm.volume===0&&fleet.volume===0);
m.setContext({listener:far});m.request('tram',false);check('alight elsewhere does not restore old battle',m.owner===null&&tram.paused);
m.setContext({listener:near});check('return to actual battle restores eligible intent',m.owner==='storm');storm.play();storm.volume=.5;
const staleFade=m.fade(storm),currentFade=m.fade(storm);check('new fade supersedes earlier fade on same element',!staleFade()&&currentFade());
m.request('storm',false);check('ended whale mission permits local fleet score',m.owner==='fleet');m.request('fleet',false);await storm.finish();check('battle end cannot be revived by pending play',m.owner===null&&storm.paused&&storm.volume===0);
m.request('tram',true);const first=tram.play();tram.pause();const second=tram.play();await tram.finish();await first;await second;check('old same-element play completion does not pause newer valid play',!tram.paused&&m.owner==='tram');
m.request('tram',false);m.request('siege',true,{source:far});check('remote one-shot siege intent remains inaudible',m.owner===null);m.setContext({listener:far});check('local siege can become owner without a new story trigger',m.owner==='siege');
const back=createBgmOwnership(),same=back.wrap('storm',new Media());back.setContext({listener:near,saihoji:near});back.request('storm',true);const late=same.play(),invalidFade=back.fade(same);back.request('tram',true);back.request('tram',false);const fresh=same.play();same.volume=.5;await same.finish();await late;await fresh;check('same element can regain ownership while an older play promise is pending',back.owner==='storm'&&!same.paused&&same.volume===.5&&!invalidFade());
console.log(JSON.stringify({passed:true,count:checks.length,checks},null,2));
