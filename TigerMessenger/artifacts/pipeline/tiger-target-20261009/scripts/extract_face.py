from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage as nd
im=np.asarray(Image.open('face_full.png').convert('RGB')).astype(float)
H,W,_=im.shape;r,g,b=im[...,0],im[...,1],im[...,2];lum=(r+g+b)/3
poly=[(110,32),(170,55),(215,105),(330,108),(450,105),(500,50),(555,30),(590,80),(590,190),(615,280),(612,420),(575,555),(470,650),(400,692),(330,700),(250,690),(160,610),(85,520),(45,400),(55,280),(85,195),(70,110)]
pm=Image.new('L',(W,H),0);ImageDraw.Draw(pm).polygon(poly,fill=1);fg=np.asarray(pm).astype(bool)
cls=np.zeros((H,W),np.uint8)
cls[fg]=3
orange=(r-b>45)&(lum<228)
pink=(r>200)&(r-g>40)&(b>g)
yellow=(r>200)&(g>185)&(b<110)&(g>r-35)
ink=lum<100
cls[fg&orange]=1;cls[fg&pink]=4;cls[fg&yellow]=5;cls[fg&ink]=2
# remove pinkish label lines: thin pink artifacts outside nose
lab,n=nd.label(cls==4);sz=nd.sum(cls==4,lab,range(1,n+1))
for i,s in enumerate(sz):
    if s<400: cls[lab==i+1]=3
rim=fg&~nd.binary_erosion(fg,iterations=3);cls[rim]=2
np.save('target_face_cls.npy',cls)
pal={0:(170,200,220),1:(0xCD,0x8F,0x48),2:(0x34,0x33,0x3D),3:(0xF2,0xE8,0xD3),4:(0xB9,0x78,0x82),5:(0xC8,0xA6,0x6E)}
out=np.zeros((H,W,3),np.uint8)
for k,c in pal.items(): out[cls==k]=c
Image.fromarray(out).save('target_face.png')
