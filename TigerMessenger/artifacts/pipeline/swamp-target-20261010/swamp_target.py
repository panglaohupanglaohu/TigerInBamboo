"""Art-director target from a real station render (Moebius flat blocks):
- clean semantic map; legacy + near intrusions removed (filled from surrounding content);
- each surface class painted in 2–3 flat palette tones following smoothed light/shadow;
- foliage gets deep / mid / light per leaf cluster (front/back), water keeps its depth but in palette tint;
- occluders in front of the courier ghosted; ink lines on region borders fading with distance.
Usage: swamp_target.py sheet.jpg out.png"""
import sys, numpy as np
from PIL import Image
from scipy import ndimage as nd
from swamp_score import tiles, classify, NAMES, PAL, srgb2lab
def T(*h):return np.array([[int(x[i:i+2],16) for i in (1,3,5)] for x in h],float)
TONES={ # dark -> light, from the game's swamp palette (GREG_LAKE_PALETTE + sanctioned foliage tones)
 'water':T('#6f9794','#86b4b8','#9ec8cc'),
 'foliage':T('#5f8783','#82a89e','#a6c39a','#c9d6bd'),
 'path':T('#d98d86','#e9a18f','#f1e8ce'),
 'wall':T('#67647c','#777388','#8d8a9c'),
 'bark':T('#a37c87','#bd929e','#cfa9b2'),
}
def make(path,out):
    beauty,sem,depth,cour=tiles(path);H,W,_=beauty.shape
    cls=nd.median_filter(classify(sem),size=5)
    g=depth.mean(-1)/255.0;dist=(1-np.sqrt(np.clip(g,0,1)))*60
    L=srgb2lab(nd.gaussian_filter(beauty,(4,4,0)))[...,0]
    bad=(cls==NAMES.index('legacy'))|((cls==NAMES.index('far'))&(g>0.69))
    # fill removed clutter from the nearest kept pixel (class + beauty)
    if bad.any():
        idx=nd.distance_transform_edt(bad,return_distances=False,return_indices=True)
        cls=cls[idx[0],idx[1]];beauty=beauty[idx[0],idx[1]];L=L[idx[0],idx[1]];dist=dist[idx[0],idx[1]]
    tgt=beauty.copy()
    for fam,tones in TONES.items():
        m=cls==NAMES.index(fam)
        if m.sum()<30:continue
        n=len(tones)
        if fam=='foliage':
            # per leaf cluster: one tone each (connected components), so deep / light leaves read as separate shapes
            lab,k=nd.label(m);means=nd.mean(L,lab,range(1,k+1))
            order=np.argsort(np.argsort(means)) if k else []
            for i in range(k):
                tone=tones[min(n-1,int(order[i]*n/max(1,k)))] if k>1 else tones[1]
                tgt[lab==i+1]=tone
            # inside a cluster, the lit upper face is one step lighter
            lit=m&(L>nd.gaussian_filter(np.where(m,L,0),8)/np.maximum(nd.gaussian_filter(m.astype(float),8),1e-3)+3)
            tgt[lit]=np.minimum(tgt[lit]+18,255)
            continue
        q=np.quantile(L[m],np.linspace(0,1,n+1)[1:-1]);band=np.digitize(L,q)
        for i in range(n):tgt[m&(band==i)]=tones[i]
        if fam=='water':  # keep what is seen through the water, tinted into the palette
            tgt[m]=tgt[m]*.6+beauty[m]*.4
    haze=np.clip((dist-14)/45,0,.4)[...,None];air=np.array([168,186,198.])
    solid=cls!=NAMES.index('sky');tgt[solid]=tgt[solid]*(1-haze[solid])+air*haze[solid]
    sil=cour.mean(-1)>128
    if sil.sum()>50:
        grow=nd.binary_dilation(sil,iterations=8);occ=grow&np.isin(cls,[NAMES.index('foliage'),NAMES.index('bark')])&~sil
        tgt[occ]=tgt[occ]*.3+beauty[occ]*0+np.array([226,222,206.])*.7
        cv=sil&(classify(sem)==NAMES.index('courier'));tgt[sil]=beauty[sil]
    # foliage/bark right at the lens (closer than ~4 world units) makes way, too
    lens=np.isin(cls,[NAMES.index('foliage'),NAMES.index('bark')])&(dist<4)
    tgt[lens]=tgt[lens]*.3+np.array([226,222,206.])*.7
    edge=np.zeros_like(cls,bool);edge[:-1]|=cls[:-1]!=cls[1:];edge[:,:-1]|=cls[:,:-1]!=cls[:,1:]
    edge=nd.binary_dilation(edge,iterations=1)&(dist<20) | (edge&(dist>=20))
    ink=np.array([0x51,0x4b,0x64],float);a=(1-np.clip((dist-20)/45,0,1))[...,None]*.9
    tgt[edge]=tgt[edge]*(1-a[edge])+ink*a[edge]
    img=Image.fromarray(np.clip(tgt,0,255).astype(np.uint8));img.save(out)
    b0=tiles(path)[0]
    pair=Image.new('RGB',(W*2+6,H),(20,20,20));pair.paste(Image.fromarray(b0.astype(np.uint8)),(0,0));pair.paste(img,(W+6,0));pair.save(out.replace('.png','-pair.png'))
if __name__=='__main__':make(sys.argv[1],sys.argv[2])
