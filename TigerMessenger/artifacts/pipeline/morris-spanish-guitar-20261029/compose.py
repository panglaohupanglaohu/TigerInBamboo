"""New original nylon-guitar garden score: calm opening, then footwork.
No commercial samples/melody. String partials have individual decay and pluck comb;
wooden heel/toe transients, water and birds are synthesized and explicitly labelled.
"""
from pathlib import Path
import numpy as np, wave, json
def bandpass(a,lo,hi):
 f=np.fft.rfftfreq(len(a),1/SR);mask=1/np.sqrt(1+(lo/np.maximum(f,1))**4)/np.sqrt(1+(f/hi)**4)
 return np.fft.irfft(np.fft.rfft(a)*mask,n=len(a))
R=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
SR=32000;DUR=124.;N=int(SR*DUR);rng=np.random.default_rng(291029)
stems={k:np.zeros((N,2),np.float32)for k in ['guitar','footwork','nature']};events=[]
def put(stem,s,start,amp=1,pan=0):
 i=int(start*SR);n=min(len(s),N-i)
 if i<0 or n<=0:return
 stems[stem][i:i+n,0]+=s[:n]*amp*np.sqrt((1-pan)/2)
 stems[stem][i:i+n,1]+=s[:n]*amp*np.sqrt((1+pan)/2)
def guitar(m,start,amp=.10,length=2.3,pan=-.2,bright=.65):
 f=440*2**((m-69)/12);t=np.arange(int(length*SR))/SR;s=np.zeros(len(t))
 for k in range(1,min(28,int(14000/f))):
  phase=.02*rng.uniform(-1,1);decay=1.15+.32*k**1.18
  s+=np.sin(np.pi*k*.23)*np.cos(2*np.pi*f*k*np.sqrt(1+1e-5*k*k)*t+phase)*np.exp(-t*decay)/k**(1.20 if bright>.7 else 1.5)
 attack=1-np.exp(-t*900);end=np.minimum(1,(length-t)/.09)
 pick=rng.normal(0,1,len(t))*np.exp(-t*160)*.055*bright
 body=.11*np.sin(2*np.pi*112*t)*np.exp(-t*13)+.045*np.sin(2*np.pi*218*t)*np.exp(-t*18)
 put('guitar',(s*attack+pick+body)*end,start,amp,pan)
def strum(ch,start,amp=.06,roll=False):
 for r in range(3 if roll else 1):
  seq=ch if r%2==0 else ch[::-1]
  for j,m in enumerate(seq):guitar(m,start+r*.065+j*.008,amp*(.85 if r else 1),1.35,-.16+j*.05,.9)
def step(start,accent=False,toe=False,gain=1):
 length=.16 if toe else .26;t=np.arange(int(length*SR))/SR
 noise=bandpass(rng.normal(size=len(t)),1000 if toe else 500,10500)
 wood=sum(np.sin(2*np.pi*f*t)*np.exp(-t*d)*a for f,d,a in [(165,33,.7),(314,40,.35),(730,62,.16)])
 s=noise*np.exp(-t*(95 if toe else 75))*.5+wood*(.25 if toe else .75)
 put('footwork',s,start,(.16 if accent else .075)*gain,(-.28 if toe else .28)+rng.uniform(-.06,.06));events.append({'kind':'toe'if toe else'heel','time':round(start,4),'accent':accent})
# Three distinct knuckle/body golpes before the first guitar chord.
for n,start in enumerate([.22,.92,1.62]):
 tt=np.arange(int(.32*SR))/SR
 sound=(np.sin(2*np.pi*116*tt)*np.exp(-tt*17)+.5*np.sin(2*np.pi*205*tt)*np.exp(-tt*24)+.20*bandpass(rng.normal(size=len(tt)),450,4500)*np.exp(-tt*90))
 put('guitar',sound,start,.145 if n<2 else .19,0);events.append({'kind':'guitar-body-golpe','time':start})
# Opening: sparse nylon arpeggios, no organ/pads and absolutely no shoe taps before36s.
chords=[[45,52,57,60,64],[43,50,55,59,62],[41,48,53,57,60],[40,47,52,56,59,64]]
melodies=[[(76,0,1),(74,1.6,.8),(72,3.2,1)],[(71,.5,1),(69,2.6,1.4)],[(69,0,1),(68,1.8,.7),(65,3.6,1)],[(64,.5,1.8),(68,3,1),(71,4.7,.7)],[(72,0,.8),(76,1.3,1),(74,3.1,1)],[(71,.6,1),(67,2.4,.8),(69,4.2,1)],[(65,.2,1),(64,2,1),(62,3.7,.9)],[(64,0,2),(68,3,.6),(64,4.2,1.3)]]
for cycle in range(20):
 start=cycle*6;ch=chords[cycle%4];dance=cycle>=8;closing=cycle>=18
 if cycle<6:
  # Thumb-supported rolling upper chord tones; quiet plucked attacks, no pad.
  begin=2.4 if cycle==0 else 0
  for group in range(6):
   base=start+group+begin
   if base>=start+6:break
   guitar(ch[0] if group%2==0 else ch[1],base,.080,2.8,-.25)
   for finger in range(3):
    midi=ch[2+(finger+group)%3]+12
    guitar(midi,base+.18+finger*.17,.052 if finger==0 else .044,2.0,.10+finger*.045,.55)
 else:
  for j,k in enumerate([0,2,3,4,1,3,2,4]):
   guitar(ch[k],start+j*.70+(.012 if j%2 else 0),.093 if j in [0,4] else .060,2.2,-.23)
 if cycle>=2:
  for m,b,d in melodies[cycle%8]:guitar(m,start+b,.070 if not dance else .083,d+1,.19,.7)
 if dance and not closing:
  # 12 pulses, accents 3/6/8/10/12. Original phrasing, not a song transcription.
  for pulse in range(1,13):
   tm=start+(pulse-1)*.5;accent=pulse in [3,6,8,10,12]
   step(tm+rng.uniform(-.006,.006),accent,pulse%2==0,.85)
   if pulse in [6,10,12] and cycle%2:step(tm+.25,False,True,.64)
   if accent:strum(ch,tm+.025,.035,roll=pulse==12 and cycle%2==1)
 elif cycle in [6,7]:
  for pulse in [8,10,12]:step(start+(pulse-1)*.5,False,pulse%4==0,.28 if cycle==6 else .46)
 elif closing:
  for pulse in [3,8,12]:step(start+(pulse-1)*.5,False,True,.32 if cycle==18 else .18)
# Creek: filtered low-level flowing texture with ripples, never a loud rain wall.
t=np.arange(N)/SR
for side in range(2):
 noise=rng.normal(0,1,N);flow=bandpass(noise,420,3800)
 flow*=.010*(.65+.20*np.sin(t*.73+side)+.15*np.sin(t*1.63+side*.5))
 stems['nature'][:,side]+=flow
for start in np.arange(1,DUR-3,.73):
 tt=np.arange(int(.13*SR))/SR;f=750+rng.uniform(0,900);drop=np.sin(2*np.pi*(f*tt-480*tt**2))*np.exp(-tt*32)
 put('nature',drop,start+rng.uniform(-.15,.15),.006,rng.uniform(-.8,.8))
# Sparse bird phrases; deliberately synthesized, not claimed field recording/species likeness.
for start in [4.2,13.8,25,33.1,45.5,61.2,78.3,96,113.4]:
 for k in range(3):
  length=.10+.025*k;tt=np.arange(int(length*SR))/SR;f=2600+320*k
  phase=2*np.pi*(f*tt+650*tt**2+.6*np.sin(tt*48));s=np.sin(phase)*np.sin(np.pi*tt/length)**2
  put('nature',s,start+k*.19,.014 if start<48 else .010,.55 if int(start)%2 else -.55)
# Short wooden-room reflections on instruments, not a sustained cathedral/organ tail.
for key in ['guitar','footwork']:
 dry=stems[key].copy()
 for delay,gain in [(.043,.10),(.087,.07),(.149,.035)]:
  d=int(delay*SR);stems[key][d:]+=dry[:-d,::-1]*gain
mix=sum(stems.values());scale=.79/max(float(abs(mix).max()),1e-8)
fade=np.minimum(1,t/.07)*np.minimum(1,np.maximum(0,(DUR-t)/5))
def write(path,a):
 with wave.open(str(path),'wb')as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(SR);f.writeframes((np.clip(a,-1,1)*32767).astype('<i2').tobytes())
for key,a in stems.items():stems[key]=a*scale*fade[:,None];write(OUT/(key+'.wav'),stems[key])
mix=sum(stems.values());path=R/'music/Morris-Spanish-Guitar-Garden-Original-v2.wav';write(path,mix)
write(OUT/'preview-24s.wav',np.concatenate([mix[0:12*SR],mix[60*SR:72*SR]]))
report={'title':'溪畔吉他与舞步','original':True,'commercialSamples':False,'duration':DUR,'sampleRate':SR,'channels':2,'peak':float(abs(mix).max()),'rms':float(np.sqrt(np.mean(mix**2))),'sections':[{'start':0,'end':36,'role':'calm nylon guitar, creek, sparse birds; no footwork'},{'start':36,'end':48,'role':'soft footwork gradually enters'},{'start':48,'end':108,'role':'12-pulse heel/toe footwork and rolled guitar strums'},{'start':108,'end':124,'role':'gentle closing'}],'accentBeats':[3,6,8,10,12],'openingBodyKnocks':[.22,.92,1.62],'introTexture':'thumb bass plus rolling upper chord tones','synthesis':'decaying plucked-string partials, wood heel/toe transients, filtered creek and chirps; no organ voice','stems':{k:{'rms':float(np.sqrt(np.mean(a*a))),'introRms':float(np.sqrt(np.mean(a[:36*SR]**2)))}for k,a in stems.items()},'events':events,'bytes':path.stat().st_size}
(OUT/'render.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in report.items()if k!='events'},ensure_ascii=False))
