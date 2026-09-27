"""Three reference-led anatomy passes; Y up, +Z face forward, metres."""
def anatomy_pass(stage):
    import bmesh,random
    rng=random.Random(901)
    for obj in list(head.children_recursive):
        if obj.type=='MESH' and obj.name.startswith(('Face','Nose','Nostril','Eye','Iris','Pupil','Brow','Ear','Anatomy_')):
            bpy.data.objects.remove(obj,do_unlink=True)
    def material(name,color,rough=.7):
        m=M['skin'].copy();m.name=name;m.diffuse_color=(*color,1)
        bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough
        M[name]=m;return name
    skinmat=material('Anatomy_skin',(.49,.325,.205))
    lipmat=material('Anatomy_lip',(.285,.137,.084))
    creasemat=material('Anatomy_crease',(.095,.045,.028))
    sclera=material('Anatomy_sclera',(.49,.43,.335),.40)
    hairmat=material('Anatomy_hair',(.034,.024,.018))
    iris=material('Anatomy_iris',(.105,.063,.025),.35)
    if stage>=8:
        neck=bpy.data.objects.get('Neck')
        if neck:
            def taper_neck(p):
                t=max(0,min(1,(p.y-1.47)/.08))
                return Vector((p.x*(1-.26*t),p.y+.008*t,p.z-.013*t))
            deform(neck,taper_neck)
            neck.data.materials.clear();neck.data.materials.append(M[skinmat])
            for poly in neck.data.polygons:poly.use_smooth=True
    levels=[(1.520,.023,.029,.021),(1.535,.037,.042,.016),(1.553,.055,.052,.007),(1.579,.064,.058,.000),(1.613,.073,.064,-.002),(1.647,.070,.066,-.006),(1.671,.073,.067,-.009),(1.712,.068,.067,-.012),(1.741,.043,.046,-.015)]
    if stage>=2:levels[3]=(1.579,.061,.058,.000)
    if stage>=3:levels[1]=(1.535,.036,.044,.014)
    if stage>=5:
        levels[3]=(1.579,.058,.057,.000)
        levels[4]=(1.613,.075,.062,-.004)
    if stage>=7:
        levels[0]=(1.520,.023,.029,.026)
        levels[1]=(1.535,.035,.040,.020)
        levels[2]=(1.553,.050,.048,.010)
    def dimensions(y):
        for a,b in zip(levels,levels[1:]):
            if a[0]<=y<=b[0]:
                t=(y-a[0])/(b[0]-a[0]);return [a[k]*(1-t)+b[k]*t for k in (1,2,3)]
        return levels[0][1:] if y<levels[0][0] else levels[-1][1:]
    def g(x,y,cx,cy,sx,sy):return math.exp(-.5*((x-cx)/sx)**2-.5*((y-cy)/sy)**2)
    def surface(x,y):
        rx,rz,cz=dimensions(y);z=cz+rz*max(0,1-(x/rx)**2)**.38
        for side in [-1,1]:
            z-=(.0075 if stage>=6 else .006)*g(x,y,side*.030,1.648,.020,.013)
            z+=(.009 if stage>=2 else .006)*g(x,y,side*.030,1.670,.022,.008)
            z+=(.006 if stage>=5 else .004)*g(x,y,side*.052,1.624,.017,.014)
            z-=.002*g(x,y,side*.048,1.588,.020,.018)
        # A tapered anatomical wedge, continuously part of the face surface.
        profile=[(1.598,0,.016),(1.607,.006,.018),(1.616,.022,.018),(1.625,.019,.014),(1.642,.013,.012),(1.658,.006,.014),(1.676,0,.022)]
        for a,b in zip(profile,profile[1:]):
            if a[0]<=y<=b[0]:
                t=(y-a[0])/(b[0]-a[0]);t=t*t*(3-2*t)
                height=a[1]*(1-t)+b[1]*t;width=a[2]*(1-t)+b[2]*t
                height*=.87 if stage>=8 else .94 if stage>=6 else 1
                z+=height*max(0,1-(x/width)**2)**2
                break
        return z+.005*g(x,y,0,1.584,.025,.014)+.005*g(x,y,0,1.539,.025,.010)
    verts=[];faces=[];rows=57;cols=80
    for j in range(rows):
        y=1.520+.221*j/(rows-1);rx,rz,cz=dimensions(y)
        for i in range(cols):
            a=2*pi*i/cols;x=rx*cos(a);z=surface(x,y) if sin(a)>=0 else cz+rz*sin(a)
            verts.append((x,y,z))
    for j in range(rows-1):
        for i in range(cols):
            a=j*cols+i;b=j*cols+(i+1)%cols;c=(j+1)*cols+(i+1)%cols;d=(j+1)*cols+i
            for tri in [(a,b,c),(a,c,d)]:
                p=sum((Vector(verts[k]) for k in tri),Vector())/3
                eyehole=stage==2 and p.z>.025 and any(((p.x-s*.030)/.0165)**2+((p.y-1.648)/.0062)**2<1 for s in [-1,1])
                if not eyehole:faces.append(tri)
    faces.extend([tuple(range(cols-1,-1,-1)),tuple((rows-1)*cols+i for i in range(cols))])
    face=mesh('Face',verts,faces,skinmat,head)
    bm=bmesh.new();bm.from_mesh(face.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(face.data);bm.free()
    for p in face.data.polygons:p.use_smooth=True
    # Beard density follows anatomy, using graded skin materials instead of a dark stripe.
    for i in range(1,17):
        t=i/16*.60;name=material('Anatomy_stubble_'+str(i),tuple(a*(1-t)+b*t for a,b in zip((.49,.325,.205),(.047,.034,.024))))
        face.data.materials.append(M[name])
    for poly in face.data.polygons:
        p=sum((Vector(verts[k]) for k in poly.vertices),Vector())/len(poly.vertices)
        if p.z<0:continue
        border=1.592+.030*min(1,abs(p.x)/.065)
        w=max(0,min(1,(border-p.y)/.020))
        moustache=math.exp(-((p.y-1.596)/.004)**2)*max(0,1-(p.x/.026)**4)
        fade=max(0,min(1,p.z/.040))
        poly.material_index=int(min(1,max(w*.65,moustache*.65))*fade*16)
    for side in [-1,1]:
        cx=side*.030;cy=1.648
        if stage>=3:
            # Only the exposed almond is meshed. Full eyeballs previously broke through the skin.
            vv=[];ff=[]
            for j in range(9):
                s=j/8
                for i in range(33):
                    t=i/32;x=cx-.0165+.033*t
                    y=cy+((- .0032+.0066*s) if stage>=6 else (-.0042+.0088*s))*sin(pi*t)+side*(x-cx)*.025
                    vv.append((x,y,surface(x,y)+.0012+.002*sin(pi*t)*sin(pi*s)))
            for j in range(8):
                for i in range(32):
                    a=j*33+i;ff.append((a,a+1,a+34,a+33))
            eye=mesh('Anatomy_eyeball_'+str(side),vv,ff,sclera,head)
            for p in eye.data.polygons:p.use_smooth=True
        elif stage>=2:
            eye=orb('Anatomy_eyeball_'+str(side),(cx,cy,.052),(.0165,.014,.0155),sclera,head,segments=32,ringsn=20)
            for p in eye.data.polygons:p.use_smooth=True
        else:
            orb('Anatomy_eyeball_'+str(side),(cx,cy,.062),(.016,.0048,.0045),sclera,head,segments=24)
        ez=surface(cx,cy)+.0035 if stage>=3 else .0678
        orb('Anatomy_iris_'+str(side),(cx,cy,ez),(.0045,.0038,.0007),iris,head,segments=24)
        orb('Anatomy_pupil_'+str(side),(cx,cy,ez+.0006),(.002,.0026,.0004),hairmat,head,segments=20)
        orb('Anatomy_eye_glint_'+str(side),(cx-.0012,cy+.0012,ez+.001),(.0005,.0005,.0002),sclera,head)
        for upper in [True,False]:
            vv=[]
            for i in range(33):
                t=i/32;x=cx-.0165+.033*t;y=cy+((.0034 if upper else -.0032) if stage>=6 else (.0046 if upper else -.0042))*sin(pi*t)+side*(x-cx)*.025
                innerz=.052+.0155*math.sqrt(max(0,1-((x-cx)/.0175)**2-((y-cy)/.015)**2))
                if stage>=3:innerz=surface(x,y)+.0015
                outer_y=y+(.006 if upper else -.004)*sin(pi*t)
                vv.extend([(x,y,innerz+.0007),(x,outer_y,surface(x,outer_y)+.0005)])
            o=mesh('Anatomy_lid_'+str(side)+str(upper),vv,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(32)],skinmat,head)
            for p in o.data.polygons:p.use_smooth=True
        brow=[]
        for i in range(17):
            t=i/16;x=side*(.012+.041*t);y=1.666+.004*sin(pi*t)-.001*t;z=surface(x,y)+.001
            brow.extend([(x,y,z),(x,y+(.0065*(1-t)+.001),z)])
        mesh('Anatomy_brow_'+str(side),brow,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(16)],hairmat,head)
        ear=orb('Anatomy_ear_'+str(side),(side*.078,1.620,-.003),(.013,.027,.015),skinmat,head,segments=24,ringsn=16)
        for p in ear.data.polygons:p.use_smooth=True
        if stage>=2:
            orb('Anatomy_concha_'+str(side),(side*.087,1.619,.008),(.0025,.010,.006),lipmat,head,segments=20)
            orb('Anatomy_tragus_'+str(side),(side*.087,1.611,.014),(.003,.006,.003),skinmat,head)
            if stage>=3:
                for i in range(20):
                    a=.25+5.1*i/20;b=.25+5.1*(i+1)/20
                    bar('Anatomy_helix',(side*.087,1.62+.019*cos(a),-.003+.010*sin(a)),(side*.087,1.62+.019*cos(b),-.003+.010*sin(b)),.0016,skinmat,head,n=6)
    # No separate nose cylinder, nasal-wing spheres or nostril dots.
    for upper in [True,False]:
        vv=[]
        for i in range(41):
            x=-.023+.046*i/40;u=x/.023;line=1.586-.001*u*u;f=max(0,1-u*u)
            edge=line+((.005-.002*math.exp(-(u/.24)**2)) if upper else -.0055)*f*(.85 if stage>=7 else 1)
            vv.extend([(x,line,surface(x,line)+.002),(x,edge,surface(x,edge)+.003*f)])
        o=mesh('Anatomy_lip_'+str(upper),vv,[(i*2,i*2+1,i*2+3,i*2+2) for i in range(40)],lipmat,head)
        for p in o.data.polygons:p.use_smooth=True
    if stage>=3:
        for i in range(300):
            x=rng.uniform(-.065,.065);y=rng.uniform(1.526,1.615);rx,_,_=dimensions(y)
            if abs(x)>rx*.94 or y>1.586+.030*abs(x)/.065:continue
            z=surface(x,y)+.0004
            bar('Anatomy_beard_fiber_'+str(i),(x,y,z),(x+.0005,y-.0015,z+.0004),.00018,hairmat,head,r2=.00007,n=4)
        for side in [-1,1]:
            for i in range(36):
                t=i/35;x=side*(.013+.039*t);y=1.668+.003*sin(pi*t);z=surface(x,y)+.0015
                bar('Anatomy_brow_fiber',(x,y,z),(x+side*.0025,y+.0035,z),.00028,hairmat,head,r2=.0001,n=4)
    # Crown/profile passes: retain the courier's authored hair layout, refine its volume.
    for obj in []:  # Preserve authored hair through these five facial passes.
        if obj.type=='MESH' and obj.name.startswith(('Hair','Half_tied')):
            def shape(p):
                top=max(0,min(1,(p.y-1.690)/.07));return Vector((p.x*(1-.025*stage*top),p.y,p.z-(.002*stage*top)))
            deform(obj,shape)
    return {'stage':stage,'checks':['face','features','top','profile'],'headVertices':len(face.data.vertices),'headTriangles':len(face.data.polygons)}
