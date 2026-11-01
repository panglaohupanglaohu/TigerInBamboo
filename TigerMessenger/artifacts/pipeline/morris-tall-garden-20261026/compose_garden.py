"""Original instrumental score, generated from the explicit note/chord score below.
No sampled commercial recording, artist melody or external audio is used.
"""
from pathlib import Path
import numpy as np, wave, json
SR=32000; BPM=68; BAR=120/BPM; BARS=32; DURATION=BARS*BAR+6
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
chords=[[50,57,62,65],[46,53,58,62],[48,55,60,64],[45,52,57,61],[43,50,55,58],[50,57,62,65],[46,53,58,62],[45,52,57,61]]
# A gentle original 6/8 theme, varied and answered in four eight-bar phrases.
melodies=[[(74,0,2),(69,2,1),(77,3,2),(76,5,1)],[(74,0,3),(72,3,1),(70,4,2)],[(69,0,2),(72,2,1),(76,3,3)],[(73,0,2),(76,2,1),(69,3,3)],[(70,0,2),(74,2,1),(79,3,2),(77,5,1)],[(76,0,1),(74,1,2),(69,3,2),(65,5,1)],[(70,0,3),(74,3,2),(72,5,1)],[(73,0,2),(69,2,1),(74,3,3)]]
for bar in range(BARS):
 start=bar*BAR;ch=chords[bar%8];phrase=bar//8
 if bar==31:ch=[50,57,62,65]
 for k,m in enumerate(ch):note(m,start,BAR+1,.035 if k else .044,'strings',(-.5+k/3))
 for eighth,k in enumerate([0,2,1,3,2,1]):note(ch[k]+12,start+eighth*BAR/6,BAR*.95,.07 if eighth in [0,3] else .05,'piano',-.2+.08*k)
 if bar>=4:
  for m,beat,dur in melodies[bar%8]:
   if bar==31:m=74 if beat<3 else 62
   # Middle phrase gentle lower octave response, then returns to the main voice.
   note(m-(12 if phrase==2 else 0),start+beat*BAR/6,BAR*dur/6+.11,.052,'flute',.18)
# Airy stereo room, deterministic finite multi-tap tail; feedback is baked, no CPU cost in-game.
dry=mix.copy()
for delay,gain in [(.113,.16),(.191,.13),(.307,.12),(.449,.10),(.673,.08),(1.017,.06),(1.53,.04),(2.17,.025)]:
 n=int(delay*SR);mix[n:]+=dry[:-n,::-1]*gain
peak=float(abs(mix).max());mix*=.72/max(peak,1e-6);fade=np.minimum(1,np.arange(len(mix))/SR/2)*np.minimum(1,(len(mix)-1-np.arange(len(mix)))/SR/4);mix*=fade[:,None]
path=Path('music/Morris-Garden-Original.wav')
with wave.open(str(path),'wb') as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(SR);f.writeframes((mix*32767).astype('<i2').tobytes())
Path('artifacts/pipeline/morris-tall-garden-20261026/music-render.json').write_text(json.dumps({'title':'织锦花园','original':True,'sampledExternalAudio':False,'sampleRate':SR,'channels':2,'duration':len(mix)/SR,'tempo':BPM,'meter':'6/8','peak':float(abs(mix).max()),'rms':float(np.sqrt(np.mean(mix**2))),'bytes':path.stat().st_size},ensure_ascii=False,indent=2))
print(path)
