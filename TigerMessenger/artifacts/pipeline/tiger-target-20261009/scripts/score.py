"""Score a rendered tiger view against a target class map.
usage: score.py target_cls.npy render.png [--grid 10x24]"""
import sys, json, numpy as np
from PIL import Image
from scipy import ndimage as nd
PAL=np.array([(170,200,220),(0xCD,0x8F,0x48),(0x34,0x33,0x3D),(0xF2,0xE8,0xD3),(0xB9,0x78,0x82),(0xC8,0xA6,0x6E)],float)
def classify(path,ncls):
    im=np.asarray(Image.open(path).convert('RGB')).astype(float)
    d=((im[:,:,None,:]-PAL[None,None,:ncls])**2).sum(-1);c=d.argmin(-1).astype(np.uint8)
    bg=(np.abs(im-PAL[0]).sum(-1)<40);c[bg]=0;c[~bg&(c==0)]=2
    return c
def crop(c):
    ys,xs=np.nonzero(c);return c[ys.min():ys.max()+1,xs.min():xs.max()+1]
def fit(m,shape):
    H,W=shape;h,w=m.shape;s=H/h;nw=max(1,int(round(w*s)))
    r=np.asarray(Image.fromarray(m).resize((nw,H),Image.NEAREST))
    out=np.zeros((H,W),np.uint8)
    # align centroid x of silhouettes
    return r
def place(r,t):
    H,W=t.shape;out=np.zeros_like(t)
    cx_t=np.nonzero(t)[1].mean();cx_r=np.nonzero(r)[1].mean();off=int(round(cx_t-cx_r))
    for x in range(r.shape[1]):
        X=x+off
        if 0<=X<W: out[:,X]=r[:,x]
    return out
def score(tcls,path,grid=(10,24)):
    t=crop(np.load(tcls));n=int(t.max())+1
    best=None
    for flip in (False,True):
        m=crop(classify(path,max(n,4)))
        if flip:m=m[:,::-1]
        m=place(fit(m,t.shape),t)
        ft,fm=t>0,m>0;iou=(ft&fm).sum()/(ft|fm).sum()
        gy,gx=grid;H,W=t.shape;sims=[]
        for i in range(gy):
            for j in range(gx):
                sl=(slice(i*H//gy,(i+1)*H//gy),slice(j*W//gx,(j+1)*W//gx))
                a,b=t[sl],m[sl]
                if (a>0).sum()+(b>0).sum()==0:continue
                ha=np.bincount(a.ravel(),minlength=n)[:n]/a.size;hb=np.bincount(b.ravel(),minlength=n)[:n]/b.size
                sims.append(1-np.abs(ha-hb).sum()/2)
        pat=float(np.mean(sims))
        res=dict(iou=round(float(iou),3),pattern=round(pat,3),score=round(100*(.5*iou+.5*pat),1),flip=flip)
        if best is None or res['score']>best['score']:best=res;bm=m
    if len(sys.argv)>3 or True:
        vis=np.zeros(t.shape+(3,),np.uint8);vis[...,0]=(t>0)*200;vis[...,1]=(bm>0)*200;Image.fromarray(vis).save(path.replace('.png','-overlap.png'))
    return best
if __name__=='__main__':
    print(json.dumps(score(sys.argv[1],sys.argv[2])))
