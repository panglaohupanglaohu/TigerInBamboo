from PIL import Image
import numpy as np
from scipy import ndimage as nd
im=np.asarray(Image.open('bengal_full.png').convert('RGB')).astype(float)
H,W,_=im.shape
col=im[:,700:745].mean(axis=(0,2));
import sys
dark=np.argsort(col)[:3]+700;print('measure cols',sorted(dark))
c0,c1=dark.min()-4,dark.max()+4
for x in range(c0,c1+1):
    t=(x-c0+1)/(c1-c0+2);im[:,x]=im[:,c0-1]*(1-t)+im[:,c1+1]*t
r,g,b=im[...,0],im[...,1],im[...,2]
lum=(r+g+b)/3
ink=lum<110
blue=(b>r+12)&(b>180)
white=(lum>215)&~blue
# erase labels / dims
mask=np.zeros((H,W),bool)
for (x0,y0,x1,y1) in [(0,0,1140,30),(0,140,300,250),(20,150,315,175)]:
    mask[y0:y1,x0:x1]=True
gray=(lum<212)&(np.abs(r-b)<30)
barrier=nd.binary_dilation(gray,iterations=2)&~mask
bg_cand=(white|blue|mask)&~barrier
lab,n=nd.label(bg_cand)
border=set(np.unique(np.r_[lab[0],lab[-1],lab[:,0],lab[:,-1]]))-{0}
bg=np.isin(lab,list(border))
fg=~bg
fg=nd.binary_dilation(nd.binary_opening(fg,iterations=1),iterations=2)&~(blue&~nd.binary_dilation(lum<150,iterations=1))
lab2,n2=nd.label(fg);sizes=nd.sum(fg,lab2,range(1,n2+1));fg=lab2==(1+np.argmax(sizes))
fg=nd.binary_fill_holes(fg)
from PIL import ImageDraw
pm=Image.new('L',(W,H),0);ImageDraw.Draw(pm).polygon([(870,118),(930,126),(1030,172),(1042,195),(1012,216),(965,213),(925,197),(885,182),(860,165)],fill=1)
fg|=np.asarray(pm).astype(bool)
fg=nd.binary_fill_holes(fg)
cls=np.zeros((H,W),np.uint8) # 0 bg,1 coat,2 stripe,3 ivory
orange=(r-b>60)
cls[fg]=3
cls[fg&orange]=1
cls[fg&ink]=2
rim=fg&~nd.binary_erosion(fg,iterations=3)
cls[rim]=2
np.save('target_side_cls.npy',cls)
pal={0:(170,200,220),1:(0xCD,0x8F,0x48),2:(0x34,0x33,0x3D),3:(0xF2,0xE8,0xD3)}
out=np.zeros((H,W,3),np.uint8)
for k,c in pal.items(): out[cls==k]=c
Image.fromarray(out).save('target_side.png')
ys,xs=np.nonzero(fg);print('bbox',xs.min(),xs.max(),ys.min(),ys.max(),'cover',[(cls==k).sum() for k in range(4)])
