"""Tiger coat pattern maps (R=ink stripe, G=ivory base). Authored by the striping rules on the reference sheet.
side map: z in [Z0,Z1], y in [0,YH] (ref units), two halves: top=left flank (x>0), bottom=right flank.
face map: x in [-FW,FW], y in [FY0,FY1]."""
import numpy as np, math, random, json, sys
from PIL import Image, ImageDraw, ImageFilter
Z0,Z1,YH=-4.4,3.4,2.8;PX=262;SS=3
FW,FY0,FY1=0.62,1.62,2.78;FPX=900
def poly_band(pts,w):
    """centerline pts [(z,y)], half-width list -> polygon"""
    L,R=[],[]
    for i,(p,hw) in enumerate(zip(pts,w)):
        a=pts[max(0,i-1)];b=pts[min(len(pts)-1,i+1)];dz,dy=b[0]-a[0],b[1]-a[1];n=math.hypot(dz,dy) or 1
        nz,ny=-dy/n,dz/n;L.append((p[0]+nz*hw,p[1]+ny*hw));R.append((p[0]-nz*hw,p[1]-ny*hw))
    return L+R[::-1]
def side_map(seed):
    W,H=int((Z1-Z0)*PX*SS),int(YH*PX*SS)
    ink=Image.new('L',(W,H),0);ivo=Image.new('L',(W,H),0);di=ImageDraw.Draw(ink);dv=ImageDraw.Draw(ivo)
    T=lambda z,y:((z-Z0)*PX*SS,(YH-y)*PX*SS)
    def fill(d,poly,v=255):d.polygon([T(*p) for p in poly],fill=v)
    rnd=random.Random(seed)
    # ---- ivory base regions ----
    belly=[(-2.2,1.62),(-1.6,1.6),(-0.9,1.5),(-0.2,1.46),(0.5,1.44),(1.05,1.40),(1.5,1.55),(1.9,1.78),(2.3,1.92),(2.6,1.98)]
    import numpy as _n
    bz=_n.linspace(-2.2,2.6,120);by=_n.interp(bz,[q[0] for q in belly],[q[1] for q in belly])+0.035*_n.sin(bz*23)
    fill(dv,[q for q in zip(bz,by) if q[0]<0.95]+[(0.95,1.05),(-2.2,1.05)])
    fill(dv,[q for q in zip(bz,by) if q[0]>=1.9]+[(2.6,1.6),(1.9,1.6)])
    # lower legs fade to ivory: forelegs below elbow fully ivory, hind legs below the hock
    fill(dv,[(0.6,0.62)]+[(0.6+0.08*i,0.55+0.07*math.sin(i*1.3)) for i in range(21)]+[(2.2,0.62),(2.2,0),(0.6,0)])
    fill(dv,[(-2.4,0.5)]+[(-2.4+0.06*i,0.42+0.08*math.sin(i*1.1)) for i in range(21)]+[(-1.2,0.5),(-1.2,0),(-2.4,0)])
    # throat & lower cheek / muzzle (side of head)
    fill(dv,[(2.15,2.08),(2.45,2.10),(2.7,2.16),(2.95,2.12),(3.2,2.10),(3.2,1.6),(2.0,1.6)])
    # white spot above eye (side view)
    dv.ellipse([T(2.62,2.40),T(2.80,2.32)],fill=255)
    # tail: ivory except orange upper base, then rings; tip ink
    tr=(0,2.12,-1.75);td=np.array([-0.5,-1.0]);td=td/np.linalg.norm(td)  # (dy,dz) dir normalized (y,z)
    def tp(s):return (tr[2]-1.0/np.hypot(.5,1)*s*1.0*0+(-1/np.hypot(.5,1))*s, tr[1]+(-.5/np.hypot(.5,1))*s)
    fill(dv,[(-1.9,2.4),(-4.4,2.4),(-4.4,0),(-1.9,0)])
    # ---- stripes ----
    def stripe(z0,y0,length,bend,w0,down=1.0,wig=0.0,tip=0.25):
        n=24;pts=[];ws=[]
        for i in range(n+1):
            t=i/n;pts.append((z0-bend*t**1.4+wig*math.sin(t*5.5+z0*3),y0-length*t*down));
            ws.append(w0*(math.sin(min(1,t/tip+0.05)*math.pi/2))*(1-t)**0.55+0.002)
        fill(di,poly_band(pts,ws))
    # dense dorsal / flank stripes (spine -> belly), brackets pointing backward
    z=1.05
    while z>-1.85:
        sp=rnd.uniform(0.13,0.19);ytop=2.55
        L=rnd.uniform(0.6,1.25)*(1.0 if z<0.6 else 0.7);w=rnd.uniform(0.03,0.055)*(0.75 if z>0.6 else 1)
        stripe(z,ytop,L,rnd.uniform(0.15,0.32),w,wig=0.025)
        if rnd.random()<0.35:  # forked / doubled short partner
            stripe(z-rnd.uniform(0.05,0.08),ytop-L*rnd.uniform(0.35,0.6),rnd.uniform(0.18,0.32),0.06,w*0.7)
        if rnd.random()<0.3:   # broken lower piece
            stripe(z-0.18,ytop-L-0.08,rnd.uniform(0.12,0.22),0.05,w*0.8,tip=0.4)
        z-=sp
    # hip triangle: flank verticals meet horizontal thigh bands
    for i in range(6):
        y=1.75-i*0.17;stripe(-1.05-i*0.02,y,0,0,0)  # placeholder (no-op)
        pts=[(-0.95-0.05*i,y+0.04),(-1.35,y-0.02),(-1.75,y+0.05-0.02*i)];ws=[0.012,0.04-0.003*i,0.01]
        fill(di,poly_band(pts,ws))
    # hind leg outer bands (horizontal), down to hock
    for i in range(6):
        y=1.05-i*0.12;fill(di,poly_band([(-1.25,y+0.02),(-1.55,y),(-1.85,y+0.03)],[0.008,0.028,0.008]))
    # forelegs: few bands on the back edge only
    for i in range(4):
        y=1.05-i*0.16;fill(di,poly_band([(1.05,y),(1.22,y-0.01),(1.32,y+0.01)],[0.006,0.022,0.004]))
    # shoulders: sparse thin stripes
    for zz in (1.30,1.48):
        stripe(zz,2.45,rnd.uniform(0.35,0.55),0.08,0.022)
    # neck: stripes encircling the neck
    for zz in (1.75,1.92,2.08):
        stripe(zz,2.42,0.55,-0.04,0.03)
    # cheek stripes on the side of the head: two dark lines from behind the eye
    for k in range(3):
        pts=[(2.62-0.02*k,2.30-0.07*k),(2.45,2.27-0.09*k),(2.25,2.20-0.10*k)];fill(di,poly_band(pts,[0.005,0.022,0.004]))
    # forehead/temple short marks
    for k in range(4):
        stripe(2.42+k*0.08,2.55,0.10,-0.02,0.018)
    # tail rings, along the tail rest line
    s=0.0;seg=0
    while s<2.6:
        a=np.array([-1.75,2.12])+np.array([-1,-0.5])/np.hypot(1,.5)*s
        if s>0.35:
            # ring = band perpendicular to the tail axis, width grows toward tip
            nrm=np.array([-0.5,1])/np.hypot(1,.5);hw=0.035+0.025*s/2.6
            c=a;fill(di,poly_band([tuple(c-nrm*0.2),tuple(c+nrm*0.2)],[hw,hw]))
        s+=0.24
    tipc=np.array([-1.75,2.12])+np.array([-1,-0.5])/np.hypot(1,.5)*2.42;nrm=np.array([-0.5,1])/np.hypot(1,.5)
    tipd=np.array([-1,-0.5])/np.hypot(1,.5)
    fill(di,[tuple(tipc-nrm*0.2),tuple(tipc+nrm*0.2),tuple(tipc+nrm*0.2+tipd*0.6),tuple(tipc-nrm*0.2+tipd*0.6)])
    # downsample
    W2,H2=W//SS,H//SS
    ink=ink.resize((W2,H2),Image.LANCZOS);ivo=ivo.resize((W2,H2),Image.LANCZOS)
    return np.stack([np.asarray(ink),np.asarray(ivo),np.zeros((H2,W2),np.uint8)],-1)
def face_map():
    W=H=int(2*FW*FPX)
    S=SS;W*=1;H=int((FY1-FY0)*FPX)
    Wb,Hb=int(2*FW*FPX*S),int((FY1-FY0)*FPX*S)
    ink=Image.new('L',(Wb,Hb),0);ivo=Image.new('L',(Wb,Hb),0);di=ImageDraw.Draw(ink);dv=ImageDraw.Draw(ivo)
    amb=Image.new('L',(Wb,Hb),0);da=ImageDraw.Draw(amb);eye_masks=[]
    T=lambda x,y:((x+FW)*FPX*S,(FY1-y)*FPX*S)
    def poly(d,pts,v=255):d.polygon([T(*p) for p in pts],fill=v)
    def band(d,pts,ws):poly(d,poly_band(pts,ws))
    def ell(d,cx,cy,rx,ry,v=255):d.ellipse([T(cx-rx,cy+ry),T(cx+rx,cy-ry)],fill=v)
    for sd in (1,-1):
        X=lambda x:x*sd
        # whisker pads + lower cheeks + chin ivory
        ell(dv,X(0.10),1.97,0.13,0.09);ell(dv,X(0.30),1.98,0.16,0.20)
        # white above the eye (eyebrow spot) and crescent below
        ell(dv,X(0.165),2.40,0.075,0.04);band(dv,[(X(0.09),2.215),(X(0.17),2.20),(X(0.25),2.22)],[0.006,0.02,0.006])
        # eye: ink almond rim, amber iris, round pupil (painted, front projected)
        def almond(d,cx,cy,rx,ry,v=255):
            pts=[(cx+rx*math.cos(a),cy+ry*math.sin(a)*(1.0 if math.sin(a)>0 else 0.8)) for a in [i/40*2*math.pi for i in range(40)]]
            poly(d,pts,v)
        almond(di,X(0.17),2.29,0.085,0.048)
        almond(dv,X(0.17),2.29,0.060,0.032,0)
        eye_masks.append((X(0.17),2.29))
        # 'outside corner trails into stripe'
        band(di,[(X(0.24),2.26),(X(0.33),2.20),(X(0.40),2.12)],[0.008,0.016,0.004])
        # cheek stripes: one pair almost circles the face
        band(di,[(X(0.30),2.38),(X(0.40),2.25),(X(0.42),2.08),(X(0.38),1.94)],[0.006,0.02,0.02,0.004])
        band(di,[(X(0.36),2.10),(X(0.47),2.02),(X(0.50),1.92)],[0.006,0.018,0.004])
        # forehead stripes (above the eyes, pointing to the centre)
        for k in range(4):
            y=2.43+k*0.055;band(di,[(X(0.04+0.02*k),y),(X(0.12),y+0.02),(X(0.22+0.02*k),y+0.005)],[0.004,0.012-0.001*k,0.003])
        # whisker spot rows
        for r in range(3):
            for c in range(4):
                ell(di,X(0.08+c*0.045),1.995-r*0.032,0.008,0.006)
        # mouth line
        band(di,[(0,1.92),(X(0.06),1.905),(X(0.14),1.915)],[0.004,0.006,0.003])
    # centre: philtrum line, chin ivory, chin dark dribble
    band(di,[(0,1.985),(0,1.92)],[0.004,0.004])
    ell(dv,0,1.83,0.12,0.08);band(di,[(-0.05,1.86),(0,1.85),(0.05,1.86)],[0.003,0.008,0.003])
    # central forehead mark
    band(di,[(0,2.60),(0,2.47)],[0.004,0.012])
    for (cx,cy) in eye_masks:
        # amber iris fills the almond; clear ink inside, then pupil
        pts=[(cx+0.060*math.cos(a),cy+0.032*math.sin(a)*(1.0 if math.sin(a)>0 else 0.8)) for a in [i/40*2*math.pi for i in range(40)]]
        poly(da,pts);poly(di,pts,0);ell(di,cx,cy+0.002,0.017,0.019)
        ell(di,cx+0.0,cy+0.0,0.0,0.0)
    ink=ink.resize((Wb//S,Hb//S),Image.LANCZOS);ivo=ivo.resize((Wb//S,Hb//S),Image.LANCZOS);amb=amb.resize((Wb//S,Hb//S),Image.LANCZOS)
    return np.stack([np.asarray(ink),np.asarray(ivo),np.asarray(amb)],-1)
L=side_map(7);R=side_map(19)
Image.fromarray(np.concatenate([L,R],0)).save('tiger-v3-side.png')
Image.fromarray(face_map()).save('tiger-v3-face.png')
json.dump(dict(side=dict(z0=Z0,z1=Z1,yh=YH),face=dict(fw=FW,y0=FY0,y1=FY1)),open('tiger-v3-maps.json','w'))
# preview
pal=lambda a:np.where(a[...,:1]>127,[0x34,0x33,0x3D],np.where(a[...,1:2]>127,[0xF2,0xE8,0xD3],[0xCD,0x8F,0x48])).astype(np.uint8)
Image.fromarray(pal(L)).save('preview-side-L.png');Image.fromarray(pal(face_map())).save('preview-face.png')
print('ok',L.shape)
