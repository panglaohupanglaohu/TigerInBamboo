"""Swamp station scoring (art director). Input: a station sheet screenshot (2x2: beauty | semantic / depth | courier).
Outputs metrics + a target visualization. Usage: swamp_score.py sheet.jpg name [outdir]"""
import sys, json, numpy as np
from PIL import Image
from scipy import ndimage as nd
CLS={'sky':(0,0,0),'water':(0,0,255),'path':(255,255,0),'wall':(128,128,128),'foliage':(0,200,0),'bark':(150,75,0),
     'creature':(255,128,0),'warm':(255,150,200),'other':(100,100,200),'courier':(255,255,255),'far':(0,255,255),'legacy':(255,0,0)}
NAMES=list(CLS);CC=np.array([CLS[k] for k in NAMES],float)
def hexs(*h):return [tuple(int(x[i:i+2],16) for i in (1,3,5)) for x in h]
PAL={ # current swamp palette families (game) incl. sanctioned tones
 'water':hexs('#9ec8cc','#6f9794','#75adb2','#386675'),
 'foliage':hexs('#99bbaa','#6f9794','#82a89e','#aecbb3','#a6c39a','#8db4a0','#c9d6bd','#7da294','#507e7c'),
 'path':hexs('#f1e8ce','#e9a18f','#d98d86','#d3d1b8','#b5bcb0'),
 'wall':hexs('#777388','#67647c','#6e9193','#778e90'),
 'bark':hexs('#bd929e','#a37c87','#739187'),
}
def srgb2lab(rgb):
    c=rgb/255.0;c=np.where(c>0.04045,((c+0.055)/1.055)**2.4,c/12.92)
    M=np.array([[0.4124,0.3576,0.1805],[0.2126,0.7152,0.0722],[0.0193,0.1192,0.9505]])
    xyz=c@M.T/np.array([0.95047,1.0,1.08883]);f=np.where(xyz>0.008856,np.cbrt(xyz),7.787*xyz+16/116)
    return np.stack([116*f[...,1]-16,500*(f[...,0]-f[...,1]),200*(f[...,1]-f[...,2])],-1)
def ramp(colors):
    # palette tone plus cel-shade (x.85) and moon haze variants
    out=[]
    for c in colors:
        c=np.array(c,float)
        for k in (1.0,.88,.8):
            for h in (0,.2,.4):out.append(c*k*(1-h)+np.array([150,170,185])*h)
    return srgb2lab(np.array(out))
def tiles(path):
    im=np.asarray(Image.open(path).convert('RGB')).astype(float);H,W,_=im.shape;h,w=H//2,W//2
    return im[:h,:w],im[:h,w:2*w],im[h:2*h,:w],im[h:2*h,w:2*w]
def classify(sem):
    d=((sem[:,:,None,:]-CC[None,None])**2).sum(-1);return d.argmin(-1)
def score(path,name):
    beauty,sem,depth,cour=tiles(path)
    cls=classify(sem);sky=NAMES.index('sky')
    # erase 1px JPEG seams at tile borders
    valid=np.ones(cls.shape,bool);valid[:2]=valid[-2:]=False;valid[:,:2]=valid[:,-2:]=False
    nonsky=(cls!=sky)&valid
    frac={k:float(((cls==i)&valid).sum()/valid.sum()) for i,k in enumerate(NAMES)}
    g=depth.mean(-1)/255.0;near=g>0.69  # nearer than ~10 world units
    intr=(cls==NAMES.index('far'))&near&valid
    # near outside ground already painted in the swamp rock tone is part of the swamp edge, not an intrusion
    if intr.any():
        rock=srgb2lab(np.array([[181,160,170],[0x77,0x73,0x88],[0xe9,0xa1,0x8f],[0xd9,0x8d,0x86]],float))
        Lb=srgb2lab(beauty)[intr];dmin=np.sqrt(((Lb[:,None,:]-rock[None])**2).sum(-1)).min(1)
        tmp=np.zeros_like(intr);tmp[intr]=dmin>16;intr=tmp
    legacy=float((((cls==NAMES.index('legacy'))&valid)|intr).sum()/max(1,nonsky.sum()))
    sil=(cour.mean(-1)>128)&valid;vis=(cls==NAMES.index('courier'))&valid
    courier_vis=min(1.0,float((vis&nd.binary_dilation(sil,iterations=2)).sum()/max(1,sil.sum()))) if sil.sum()>50 else 0.0
    courier_px=int(sil.sum())
    lab=srgb2lab(beauty)
    pal_ok={};pal_tot=0;pal_hit=0
    for k,cols in PAL.items():
        m=(cls==NAMES.index(k))&valid
        if m.sum()<200:continue
        R=ramp(cols);L=lab[m];d=np.sqrt(((L[:,None,:]-R[None])**2).sum(-1)).min(1)
        hit=float((d<12).mean());pal_ok[k]=round(hit,3);pal_tot+=m.sum();pal_hit+=hit*m.sum()
    palette=pal_hit/max(1,pal_tot)
    fol=(cls==NAMES.index('foliage'))&valid
    fol_std=float(lab[fol][:,0].std()) if fol.sum()>200 else 0.0
    pathm=(cls==NAMES.index('path'))&valid;wallm=(cls==NAMES.index('wall'))&valid
    path_wall=float(lab[pathm][:,0].mean()-lab[wallm][:,0].mean()) if pathm.sum()>200 and wallm.sum()>200 else None
    # occluders between camera and courier: foliage/bark covering the courier silhouette box
    if sil.sum()>50:
        ys,xs=np.nonzero(sil);box=(slice(max(0,ys.min()-10),ys.max()+10),slice(max(0,xs.min()-20),xs.max()+20))
        gc=float(np.median(g[sil]));sub=cls[box];gs=g[box]
        # only occluders in FRONT of the courier count (nearer = brighter depth)
        occl=float((np.isin(sub,[NAMES.index('foliage'),NAMES.index('bark')])&(gs>gc+0.02)).mean())
    else: occl=1.0
    # feet: path visible just below the courier
    if sil.sum()>50:
        ys,xs=np.nonzero(sil);fy=ys.max();band=cls[min(fy+2,cls.shape[0]-1):min(fy+40,cls.shape[0]),max(0,xs.min()-30):xs.max()+30]
        feet=float(np.isin(band,[NAMES.index('path'),NAMES.index('water')]).mean()) if band.size else 0.0
    else: feet=0.0
    # Moebius line: region borders should carry an ink line (darker than the surrounding colour)
    edge=np.zeros_like(cls,bool);edge[:-1]|=cls[:-1]!=cls[1:];edge[:,:-1]|=cls[:,:-1]!=cls[:,1:]
    edge&=valid&(cls!=NAMES.index('sky'))&(cls!=NAMES.index('courier'))&(g>0.15)
    Lb=lab[...,0];Lmed=nd.median_filter(Lb,size=7);dark=nd.minimum_filter(Lb,size=3)<Lmed-8
    line=float((dark&edge).sum()/max(1,edge.sum()))
    s_legacy=max(0,100-2000*legacy)
    s_courier=100*courier_vis*(1 if courier_px>500 else courier_px/500)
    s_palette=100*palette
    s_fol=100*float(np.clip((fol_std-2)/6,0,1)) if fol.sum()>200 else 100
    s_occl=100*float(np.clip(1-occl/0.15,0,1))
    s_feet=100*float(np.clip(feet/0.5,0,1))
    s_value=100 if path_wall is None else 100*float(np.clip(path_wall/15,0,1))
    s_line=100*float(np.clip(line/0.6,0,1))
    total=round(.2*s_legacy+.2*s_courier+.15*s_palette+.1*s_fol+.1*s_occl+.05*s_feet+.1*s_value+.1*s_line,1)
    return dict(station=name,total=total,legacy=round(s_legacy,1),courier=round(s_courier,1),palette=round(s_palette,1),foliage_tone=round(s_fol,1),
                occlusion=round(s_occl,1),line=round(s_line,1),feet=round(s_feet,1),path_vs_wall=round(s_value,1),
                raw=dict(legacy_frac=round(legacy,4),courier_vis=round(courier_vis,3),courier_px=courier_px,palette_by_class=pal_ok,fol_L_std=round(fol_std,2),
                         path_minus_wall_L=None if path_wall is None else round(path_wall,1),occluder_frac=round(occl,3),feet_walkable=round(feet,3),class_frac={k:round(v,3) for k,v in frac.items() if v>0.002}))
if __name__=='__main__':
    print(json.dumps(score(sys.argv[1],sys.argv[2]),ensure_ascii=False))
