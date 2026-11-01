"""Original instrumental score, generated from the explicit note/chord score below.
No sampled commercial recording, artist melody or external audio is used.
"""
from pathlib import Path
import numpy as np, wave, json
SR=32000; BPM=76; BAR=240/BPM; BARS=32; DURATION=BARS*BAR+6
mix=np.zeros((int(DURATION*SR),2),np.float64)
def note(midi,start,length,amp,voice,pan=0):
 n=min(int(length*SR),len(mix)-int(start*SR));t=np.arange(n)/SR;freq=440*2**((midi-69)/12)
 if voice=='piano':
  wave=sum(np.sin(2*np.pi*freq*k*t)*np.exp(-t*(.65+k*.28))/k**1.7 for k in range(1,7));env=(1-np.exp(-t*180))*np.minimum(1,np.maximum(0,(length-t)/.18))
 elif voice=='strings':
  wave=sum(np.sin(2*np.pi*freq*k*t+.012*k*np.sin(2*np.pi*4.7*t))/k**2.2 for k in range(1,9));env=np.minimum(1,t/.6)*np.minimum(1,np.maximum(0,(length-t)/.9))
 else:
  phase=2*np.pi*freq*t+.045*np.sin(2*np.pi*5*t);wave=np.sin(phase)+.13*np.sin(phase*2)+.045*np.sin(phase*3);env=np.minimum(1,t/.1)*np.minimum(1,np.maximum(0,(length-t)/.24))*(.94+.06*np.sin(t*2.3))
 sound=wave*env*amp;offset=int(start*SR);mix[offset:offset+n,0]+=sound*np.sqrt((1-pan)/2);mix[offset:offset+n,1]+=sound*np.sqrt((1+pan)/2)

# Newly composed D pentatonic phrases; no transcription or sampled recording.
chords=[[50,57,62,66],[47,54,59,62],[43,50,55,62],[45,52,57,64]]
phrases=[[(66,0,1),(69,1.5,.5),(71,2,1.5)],[(69,0,2),(64,2.5,1)],[(62,0,1.5),(64,2,.5),(66,3,.8)],[(69,0,3.4)],[(71,0,1.5),(74,2,1.5)],[(76,0,1),(74,1.5,.5),(71,2,1.5)],[(69,0,1.5),(66,2,.8)],[(64,0,1),(62,1.5,2)]]
for bar in range(BARS):
 start=bar*BAR;ch=chords[bar%4];beat=BAR/4;section=bar//8
 for k,m in enumerate(ch):note(m,start,BAR+1,.027 if k else .034,'strings',-.55+k*.35)
 # Gentle alternating bass and answering plucks, with room for the lead phrase.
 for j,k in enumerate([0,2,1,3,0,2,1,2]):
  note(ch[k]+12,start+j*beat/2,beat*1.65,.045 if j in [0,4] else .029,'piano',-.3+.15*k)
 if bar>=4:
  for m,b,d in phrases[bar%8]:
   if section==2:m-=12
   if bar==31:m=62
   note(m,start+b*beat,d*beat,.052 if section!=2 else .043,'flute',.18)
 # A restrained upper piano response in the second half, rather than percussion.
 if section>=2 and bar%2:
  note(ch[2]+24,start+3.5*beat,.8*beat,.024,'piano',-.3)
# Airy stereo room, deterministic finite multi-tap tail; feedback is baked, no CPU cost in-game.
dry=mix.copy()
for delay,gain in [(.113,.16),(.191,.13),(.307,.12),(.449,.10),(.673,.08),(1.017,.06),(1.53,.04),(2.17,.025)]:
 n=int(delay*SR);mix[n:]+=dry[:-n,::-1]*gain
peak=float(abs(mix).max());mix*=.72/max(peak,1e-6);fade=np.minimum(1,np.arange(len(mix))/SR/2)*np.minimum(1,(len(mix)-1-np.arange(len(mix)))/SR/4);mix*=fade[:,None]
path=Path('music/Morris-White-Horse-Garden-Original.wav')
with wave.open(str(path),'wb') as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(SR);f.writeframes((mix*32767).astype('<i2').tobytes())
Path('artifacts/pipeline/morris-white-horse-bgm-20261027/music-render.json').write_text(json.dumps({'title':'白马花径','original':True,'sampledExternalAudio':False,'sampleRate':SR,'channels':2,'duration':len(mix)/SR,'tempo':BPM,'meter':'4/4','peak':float(abs(mix).max()),'rms':float(np.sqrt(np.mean(mix**2))),'bytes':path.stat().st_size},ensure_ascii=False,indent=2))
print(path)
