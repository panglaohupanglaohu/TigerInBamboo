"""Three reference-led anatomy passes; Y up, +Z face forward, metres."""
def anatomy_pass(stage):
    import bmesh,random
    rng=random.Random(901)
    for obj in list(head.children_recursive):
        if obj.type=='MESH' and obj.name.startswith(('Face','Nose','Nostril','Eye','Iris','Pupil','Brow','Ear','Anatomy_','Hair_target_fringe')):
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
    levels=[(1.520,.023,.029,.021),(1.535,.037,.042,.016),(1.553,.055,.052,.007),(1.579,.064,.058,.000),(1.613,.073,.064,-.002),(1.647,.070,.066,-.006),(1.671,.073,.067,-.009),(1.712,.068,.067,-.012),(1.741,.043,.046,-.015)]
    if stage>=2:levels[3]=(1.579,.061,.058,.000)
    if stage>=3:levels[1]=(1.535,.036,.044,.014)
    if stage>=19:
        # Shorter, stronger target silhouette: broad cheek/jaw shelf, compact
        # chin, and a narrower forehead under the hair mass.
        levels=[(1.528,.026,.034,.020),(1.542,.040,.046,.014),(1.565,.058,.056,.006),(1.592,.071,.064,.000),(1.625,.076,.067,-.002),(1.655,.073,.065,-.006),(1.680,.067,.062,-.009),(1.710,.056,.056,-.012),(1.738,.036,.040,-.015)]
    def dimensions(y):
        for a,b in zip(levels,levels[1:]):
            if a[0]<=y<=b[0]:
                t=(y-a[0])/(b[0]-a[0]);return [a[k]*(1-t)+b[k]*t for k in (1,2,3)]
        return levels[0][1:] if y<levels[0][0] else levels[-1][1:]
    def g(x,y,cx,cy,sx,sy):return math.exp(-.5*((x-cx)/sx)**2-.5*((y-cy)/sy)**2)
    def surface(x,y):
        rx,rz,cz=dimensions(y);z=cz+rz*max(0,1-(x/rx)**2)**.38
        for side in [-1,1]:
            z-=.006*g(x,y,side*.030,1.648,.020,.013)
            z+=(.009 if stage>=2 else .006)*g(x,y,side*.030,1.670,.022,.008)
            z+=.004*g(x,y,side*.052,1.617,.018,.018)
            z-=.002*g(x,y,side*.048,1.588,.020,.018)
        if stage>=3:z+=.022*g(x,y,0,1.617,.0085,.008)+.017*g(x,y,0,1.644,.008,.021)
        # Low-poly target has readable brow, cheek and nasal planes. Keep these
        # as broad faceted volume changes so the face reads at game distance.
        if stage>=9:
            z += .012*g(x,y,0,1.650,.050,.018)
            z += .016*g(x,y,0,1.625,.009,.024)
            z += .010*g(x,y,0,1.607,.014,.010)
            z -= .006*g(x,y,0,1.596,.030,.006)
        if stage>=30:
            # 侧颜去鹰嘴：鼻背峰压低（目标侧颜鼻直而不尖）
            z -= .007*g(x,y,0,1.628,.011,.026)
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
    if stage>=15:
        # The reference is a patchwork of irregular triangular planes, not a
        # single smooth skin surface. Add restrained skin-tone facet materials
        # and a deterministic broad-plane variation (no noisy checkerboard).
        facet_cols=[(.47,.300,.188),(.49,.315,.195),(.515,.335,.208),(.455,.285,.176),(.502,.323,.200)]
        facet_names=[material('Anatomy_facet_'+str(i),c) for i,c in enumerate(facet_cols)]
        for n in facet_names: face.data.materials.append(M[n])
        for poly_i,poly in enumerate(face.data.polygons):
            c=sum((Vector(verts[k]) for k in poly.vertices),Vector())/len(poly.vertices)
            # broad cheek/forehead bands with a stable per-triangle offset
            band=(int((c.y-1.52)*92)+int((c.x+.09)*34))%len(facet_names)
            if abs(c.x)<.012: band=2
            poly.material_index=1+band
        for i,v in enumerate(face.data.vertices):
            if 0<i<len(face.data.vertices)-1:
                v.co.z += .00045*sin(i*.71)+.00025*sin(i*.19)
                v.co.x += .00012*sin(i*.37)
        face.data.update()
    bm=bmesh.new();bm.from_mesh(face.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(face.data);bm.free()
    for p in face.data.polygons:p.use_smooth = stage < 11
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
        beard=min(1,max(w*.65,moustache*.65))*fade
        if stage>=12:
            # Target has a readable angular beard mass, with dark jaw sides and
            # a softer center plane instead of isolated pepper-like dots.
            jaw=max(0,min(1,(1.595-p.y)/.055))*max(0,min(1,(abs(p.x)-.018)/.040))
            chin=max(0,min(1,(1.585-p.y)/.030))*max(0,min(1,1-abs(p.x)/.040))
            beard=max(beard,jaw*.92,chin*.72)
        poly.material_index=(6+int(min(1,beard)*15)) if stage>=15 else int(min(1,beard)*16)
    if stage==19:
        # A shallow dark socket plane gives the eyes the recessed, hard-edged
        # surround visible in the reference without floating eyeballs.
        socketmat=material('Anatomy_eye_socket',(.205,.130,.085),.97)
        for side in [-1,1]:
            cx=side*.030
            coords=[(cx-.021,1.657),(cx+.021,1.657),(cx+.016,1.639),(cx-.016,1.639)]
            vv=[(x,y,surface(x,y)+.0003) for x,y in coords]
            mesh('Anatomy_eye_socket_'+str(side),vv,[(0,1,2),(0,2,3)],socketmat,head)
    for side in [-1,1]:
        cx=side*.030;cy=1.648
        if stage>=3:
            # Only the exposed almond is meshed. Full eyeballs previously broke through the skin.
            vv=[];ff=[]
            for j in range(9):
                s=j/8
                for i in range(33):
                    t=i/32;x=cx-.0165+.033*t
                    y=cy+(-.0042+.0088*s)*sin(pi*t)+side*(x-cx)*(.04 if stage>=19 else .025)
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
                t=i/32;x=cx-.0165+.033*t;y=cy+( .0046 if upper else -.0042)*sin(pi*t)+side*(x-cx)*(.04 if stage>=19 else .025)
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
    nose=rings('Nose',[(1.675,0,.056,.011,.006),(1.650,0,.061,.010,.012),(1.627,0,.070,.010,.013),(1.617,0,.075,.010,.010),(1.611,0,.067,.011,.006)],skinmat,head,n=28)
    for p in nose.data.polygons:p.use_smooth=True
    if stage>=11:
        # Retain an explicit faceted nasal bridge. Earlier passes removed this
        # mesh and the surface bump read as a flat, almost nose-less face.
        for p in nose.data.polygons:p.use_smooth=False
        nose.scale.x=1.18
        nose.scale.z=2.05 if stage>=19 else 1.55
    for side in [-1,1]:
        o=orb('Anatomy_nasal_wing_'+str(side),(side*.010,1.613,.066),(.006,.0045,.005),skinmat,head,segments=24)
        for p in o.data.polygons:p.use_smooth=True
        orb('Anatomy_nostril_'+str(side),(side*.009,1.610,.070),(.0025,.0012,.001),creasemat,head)
    for upper in [True,False]:
        vv=[]
        for i in range(41):
            x=-.023+.046*i/40;u=x/.023;line=1.586-.001*u*u;f=max(0,1-u*u)
            edge=line+((.005-.002*math.exp(-(u/.24)**2)) if upper else -.0055)*f
            vv.extend([(x,line,surface(x,line)+.002),(x,edge,surface(x,edge)+.003*f)])
        o=mesh('Anatomy_lip_'+str(upper),vv,[(i*2,i*2+1,i*2+3,i*2+2) for i in range(40)],lipmat,head)
        for p in o.data.polygons:p.use_smooth=True
    if stage>=16:
        # Target beard is a continuous dark angular mass along the jaw and
        # chin. Overlay three thin faceted patches on the face surface so it
        # remains readable at the game's low-poly scale.
        beardmat=material('Anatomy_beard_mass',(.105,.064,.042),.96)
        patches=[(-1,[(-.056,1.593),(-.022,1.588),(-.028,1.558),(-.048,1.562)]),
                 (1,[(.022,1.588),(.056,1.593),(.048,1.562),(.028,1.558)]),
                 (0,[(-.022,1.566),(.022,1.566),(.016,1.540),(-.016,1.540)])]
        for k,coords in patches:
            vv=[(x,y,surface(x,y)+.0045) for x,y in coords]
            mesh('Anatomy_beard_mass_'+str(k),vv,[(0,1,2),(0,2,3)],beardmat,head)
        # Small crown plane follows the target's swept hairline and sits flush
        # with the existing hair, leaving the brow ridge visible.
        vv=[(-.060,1.718,surface(-.060,1.718)+.004),(-.018,1.727,surface(-.018,1.727)+.004),(.020,1.726,surface(.020,1.726)+.004),(.061,1.715,surface(.061,1.715)+.004),(.028,1.696,surface(.028,1.696)+.004),(0,1.688,surface(0,1.688)+.004),(-.030,1.696,surface(-.030,1.696)+.004)]
        mesh('Hair_target_crown',vv,[(0,1,6),(1,2,5),(1,5,6),(2,3,4),(2,4,5),(4,6,5)],hairmat,head)
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
    for obj in head.children_recursive:
        if obj.type=='MESH' and obj.name.startswith(('Hair','Half_tied')):
            def shape(p):
                top=max(0,min(1,(p.y-1.690)/.07));return Vector((p.x*(1-.025*stage*top),p.y,p.z-(.002*stage*top)))
            deform(obj,shape)
            if stage>=11:
                for poly in obj.data.polygons: poly.use_smooth=False
            if stage>=19 and obj.name=='Hair_crown':
                # The source crown is a flat experimental cap.  Keep the authored
                # side/back locks, but replace this piece with the compact faceted
                # crown below so the silhouette follows the reference sheet.
                obj.hide_render=True
                obj.hide_viewport=True
    if stage>=19:
        neck=next((o for o in body.children_recursive if o.name=='Neck'),None)
        if neck:
            neck.scale.x*=1.16; neck.scale.z*=1.10
    if stage>=20:
        # Final target pass: use a shallow three-ring faceted cap instead of a
        # spherical blob.  The target has a broad swept crown that follows the
        # skull, with the tied bun receding behind the profile.
        cap=rings('Hair_target_cap',[(1.695,0,.006,.060,.032),(1.721,0,.004,.073,.041),(1.746,0,-.004,.052,.028)],'Anatomy_hair',head,n=8,palette=['Anatomy_hair','Anatomy_hair.001','Anatomy_hair.002'])
        bun=rings('Hair_target_bun',[(1.723,0,-.074,.018,.016),(1.741,0,-.078,.027,.022),(1.754,0,-.082,.016,.014)],'Anatomy_hair',head,n=8,palette=['Anatomy_hair','Anatomy_hair.001'])
        for obj in (cap,bun):
            for poly in obj.data.polygons: poly.use_smooth=False
        # Five broad, seated fringe wedges establish the target's angular
        # forehead hairline without floating card strips.
        for k,x in enumerate([-.052,-.027,0,.027,.052]):
            w=.017 if k in (0,4) else .020
            y0=1.713-(k%2)*.004; y1=1.674-(k%3)*.004
            vv=[(x-w,y0,surface(x-w,y0)+.003),(x+w,y0,surface(x+w,y0)+.003),(x+w*.32,y1,surface(x+w*.32,y1)+.004),(x-w*.32,y1,surface(x-w*.32,y1)+.004)]
            mesh('Hair_target_fringe_final_'+str(k),vv,[(0,1,2),(0,2,3)],hairmat,head)
        for obj in head.children_recursive:
            if obj.type!='MESH': continue
            if obj.name.startswith(('Face','Hair','Wavy','Swept','Temple','Anatomy_beard')):
                for poly in obj.data.polygons: poly.use_smooth=False
            for mat_slot in obj.data.materials:
                if mat_slot and mat_slot.use_nodes:
                    bs=mat_slot.node_tree.nodes.get('Principled BSDF')
                    if bs:
                        bs.inputs['Roughness'].default_value=.96
                        bs.inputs['Metallic'].default_value=0
    if stage>=21:
        # 2026-09-17 信使·Low Poly 面部目标：束发丸子头 + 连续络腮胡。
        # v4：头发盖一次成型（多截面实心管），丸子头嵌入后颅，胡带按椭圆角参
        # 环绕脸部（正面到耳后连续，侧面有厚度），底缘沿下巴悬垂。
        for obj in [o for o in head.children_recursive
                    if o.type=='MESH' and o.name.startswith(('Hair_target_cap','Hair_target_bun','Hair_target_crown','Hair_target_fringe_final','Hair_target_top','Anatomy_beard_mass','Anatomy_beard_band','Anatomy_sideburn','Anatomy_moustache','Hair_crown','Half_tied_knot'))]:
            bpy.data.objects.remove(obj,do_unlink=True)
        # stage-21 运行时 stage>=19/16 的旧条件会复利叠加（Neck ×1.16³、Nose z 2.05），
        # 显式归一到"一次应用"的量纲，避免和 head-18 基线对比时脖子变粗、鼻子突变。
        neck21=next((o for o in body.children_recursive if o.name=='Neck'),None)
        if neck21:
            neck21.scale.x=1.16; neck21.scale.z=1.10
        # 头发盖：单个多截面环管，罩住头顶并封顶；下缘延伸到眉上方，
        # 盖住发盖环与头皮相切的锯齿缺口（目标图：头发垂到眉上）。
        cap_secs=[]
        for yc,off in [(1.658,.008),(1.672,.013),(1.700,.015),(1.722,.015),(1.738,.013),(1.750,.008)]:
            rx,rz,cz=dimensions(yc)
            cap_secs.append((yc,0,cz-.006,rx+off,rz+off))
        capr=rings('Hair_target_top',cap_secs,'Anatomy_hair',head,n=18)
        for poly in capr.data.polygons: poly.use_smooth=False
        # 丸子头：底环嵌进后颅（y 1.712 处颅骨后壁 z≈-.055，环心 -.052 相交）。
        bun=rings('Hair_target_bun',[
            (1.712,0,-.052,.017,.015),
            (1.736,0,-.068,.024,.021),
            (1.752,0,-.082,.018,.016),
            (1.744,0,-.095,.012,.011),
        ],'Anatomy_hair',head,n=8,palette=['Anatomy_hair','Anatomy_hair.001','Anatomy_hair.002'])
        for poly in bun.data.polygons: poly.use_smooth=False
        # 连续络腮胡：按椭圆角参环绕（a=0 正前，±2.0rad 到耳后），
        # 径向外扩三层：贴皮 → 前凸 1cm → 底缘沿下巴悬垂。
        beardmat=material('Anatomy_beard_band',(.098,.058,.038),.96)
        cols=41;vv=[];ff=[]
        for c in range(cols):
            a=-2.0+4.0*c/(cols-1)
            s=math.sin(min(abs(a),1.45))
            y=1.549+.050*s*s
            tend=1-.55*max(0,min(1,(abs(a)-1.6)/.4))
            for d,yr in [(.004,y),(.011,y-.004),(.007,min(y-.014,1.536))]:
                rxr,rzr,czr=dimensions(yr)
                d*=tend
                vv.append(((rxr+d)*math.sin(a),yr,czr+(rzr+d)*math.cos(a)))
        for r in range(2):
            for c in range(cols-1):
                a2=3*c+r;ff.append((a2,a2+1,a2+4,a2+3))
        band=mesh('Anatomy_beard_band',vv,ff,beardmat,head)
        for p in band.data.polygons: p.use_smooth=False
        # 八字胡：人中留空，两撇从唇角斜向外上，与口角胡带相连。
        for side in [-1,1]:
            vv=[]
            for i in range(9):
                t=i/8;x=side*(.004+.020*t)
                y=1.592+.009*t
                vv.append((x,y,surface(x,y)+.0025))
                vv.append((x,y+.007,surface(x,y+.007)+.008))
            mustache=mesh('Anatomy_moustache_'+str(side),vv,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(8)],beardmat,head)
            for p in mustache.data.polygons: p.use_smooth=False
    if stage>=22:
        # 2026-09-18 追赶目标图 v2：v21 的宽板络腮带读成"围兜"、八字胡像浮条。
        # 本版：删除宽板与八字胡，改为 下颌窄带 + 下巴垫 + 败角下垂八字胡，
        # 脸颊留出皮肤（目标图正面：脸颊裸、胡只在颌线与颏部）。
        for obj in [o for o in head.children_recursive
                    if o.type=='MESH' and o.name.startswith(('Anatomy_beard_band','Anatomy_moustache'))]:
            bpy.data.objects.remove(obj,do_unlink=True)
        beardmat=material('Anatomy_beard_v2',(.082,.05,.034),.96)
        # 下颌窄带：上缘贴颌线（脸颊留皮肤），下缘中间悬垂更多
        cols=33;vv=[];ff=[]
        for c in range(cols):
            u=-1+2*c/(cols-1)
            xa=.058*u
            top=1.575-.024*u*u
            bot=top-.026-.006*(1-abs(u))
            vv.append((xa,top,surface(xa,top)+.0028))
            vv.append((xa,bot,surface(xa,bot)+.0085))
        for c in range(cols-1):
            a2=2*c;ff.append((a2,a2+1,a2+3,a2+2))
        jaw=mesh('Anatomy_beard_jaw',vv,ff,beardmat,head)
        for p in jaw.data.polygons: p.use_smooth=False
        # 下巴垫：充实颏部体块（目标图下巴的三角胡垫）
        vv=[(-.021,1.572,surface(-.021,1.572)+.0025),(.021,1.572,surface(.021,1.572)+.0025),
            (.016,1.544,surface(.016,1.544)+.0085),(-.016,1.544,surface(-.016,1.544)+.0085)]
        pad=mesh('Anatomy_beard_chinpad',vv,[(0,1,2),(0,2,3)],beardmat,head)
        for p in pad.data.polygons: p.use_smooth=False
        # 八字胡：更薄、外侧角下垂，与颌带在外眼角下方衔接
        for side in [-1,1]:
            vv=[]
            for i in range(9):
                t=i/8;x=side*(.004+.021*t)
                y=1.593+.0075*t-.002*t*t
                vv.append((x,y,surface(x,y)+.002))
                vv.append((x,y+.006-.002*t,surface(x,y+.006-.002*t)+.0065))
            m2=mesh('Anatomy_moustache2_'+str(side),vv,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(8)],beardmat,head)
            for p in m2.data.polygons: p.use_smooth=False
    if stage>=23:
        # 2026-09-18 v3：v22 颌带两端超出脸轮廓悬空（x 未随脸宽收窄）。
        # 本版：x 按各高度的脸轮廓 rx*0.88 收窄，包住下巴不再外飘。
        for obj in [o for o in head.children_recursive
                    if o.type=='MESH' and o.name.startswith(('Anatomy_beard_jaw','Anatomy_beard_chinpad','Anatomy_moustache2'))]:
            bpy.data.objects.remove(obj,do_unlink=True)
        beardmat=material('Anatomy_beard_v3',(.082,.05,.034),.96)
        cols=33;vv=[];ff=[]
        for c in range(cols):
            u=-1+2*c/(cols-1)
            ytop=1.575-.024*u*u
            rx=dimensions(ytop)[0]*.88
            x=rx*u
            ybot=ytop-.024-.008*(1-abs(u))
            rx2=dimensions(ybot)[0]*.82
            vv.append((x,ytop,surface(x,ytop)+.0025))
            vv.append((rx2*u,ybot,surface(rx2*u,ybot)+.008))
        for c in range(cols-1):
            a2=2*c;ff.append((a2,a2+1,a2+3,a2+2))
        jaw=mesh('Anatomy_beard_jaw3',vv,ff,beardmat,head)
        for p in jaw.data.polygons: p.use_smooth=False
        vv=[(-.02,1.571,surface(-.02,1.571)+.0025),(.02,1.571,surface(.02,1.571)+.0025),
            (.015,1.543,surface(.015,1.543)+.007),(-.015,1.543,surface(-.015,1.543)+.007)]
        pad=mesh('Anatomy_beard_chinpad3',vv,[(0,1,2),(0,2,3)],beardmat,head)
        for p in pad.data.polygons: p.use_smooth=False
        for side in [-1,1]:
            vv=[]
            for i in range(9):
                t=i/8;x=side*(.004+.02*t)
                y=1.5925+.007*t-.002*t*t
                vv.append((x,y,surface(x,y)+.002))
                vv.append((x,y+.0055-.0015*t,surface(x,y+.0055-.0015*t)+.006))
            m2=mesh('Anatomy_moustache3_'+str(side),vv,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(8)],beardmat,head)
            for p in m2.data.polygons: p.use_smooth=False
    if stage>=33:
        # 2026-09-18 目标眼 v2：虹膜琥珀、眼白暖白提亮、瞳/虹膜放大可读
        for mn, col in [('Anatomy_iris.002', (.32,.18,.05)), ('Anatomy_sclera.002', (.72,.69,.62))]:
            mm = bpy.data.materials.get(mn)
            if mm and mm.use_nodes:
                for n in mm.node_tree.nodes:
                    if n.type == 'BSDF_PRINCIPLED':
                        n.inputs['Base Color'].default_value = (*col, 1)
        cy = 1.648
        for o in head.children_recursive:
            if o.type != 'MESH': continue
            if not o.name.startswith(('Anatomy_iris', 'Anatomy_pupil')): continue
            cx = .030 if o.name.endswith('1') else -.030
            for v in o.data.vertices:
                v.co.x = cx + (v.co.x - cx)*1.15
                v.co.y = cy + (v.co.y - cy)*1.12
            o.data.update()
    if stage>=28:
        # 2026-09-18 目标侧颜：鼻直而短（v19 的 z=2.05 拉成了鹰嘴），鼻翼加宽
        nose.scale.z = 1.72
        nose.scale.x = 1.34
    if stage>=29:
        # 2026-09-18 鼻尖钝化：尖环放大、长度微收，去鹰嘴感
        for o in head.children_recursive:
            if o.name == 'Nose':
                bpy.data.objects.remove(o, do_unlink=True)
                break
        n29=rings('Nose',[(1.672,0,.056,.016,.010),(1.650,0,.061,.013,.014),(1.627,0,.070,.012,.014),(1.617,0,.075,.011,.011),(1.611,0,.067,.012,.007)],skinmat,head,n=28)
        for p in n29.data.polygons: p.use_smooth=False
        n29.scale.z = 1.72
        n29.scale.x = 1.34
    if stage>=30:
        # 2026-09-18 侧颜收敛：鼻锥 z 再收（1.72→1.45），去鹰嘴
        nose29b = None
        for o in head.children_recursive:
            if o.name == 'Nose': nose29b = o; break
        if nose29b: nose29b.scale.z = 1.45
    if stage>=24:
        # 2026-09-18 目标眉（approved-target）：浓眉低覆、内低外高、内粗外细，
        # 压在眼窝上沿；旧直条眉与旧眉纤维删除重建。
        for obj in [o for o in head.children_recursive
                    if o.type=='MESH' and (o.name in ('Anatomy_brow_-1','Anatomy_brow_1') or o.name.startswith('Anatomy_brow_fiber'))]:
            bpy.data.objects.remove(obj, do_unlink=True)
        for side in [-1, 1]:
            vv=[]
            for i in range(17):
                t=i/16
                x=side*(.016+.038*t)
                y=1.652+.013*t-.005*t*t
                z=surface(x,y)+.0012
                tk=.0085*(1-.68*t)
                vv.append((x,y-tk*.5,z)); vv.append((x,y+tk,z+.0006))
            mesh('Anatomy_brow_'+str(side),vv,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(16)],hairmat,head)
            for i in range(30):
                t=i/30; x=side*(.014+.037*t)
                y=1.652+.011*t-.004*t*t
                z=surface(x,y)+.0012
                bar('Anatomy_brow_fiber24_'+str(side)+str(i),(x,y,z),(x+side*.002,y+.0038,z+.0005),.00022,hairmat,head,r2=.00008,n=4)
    if stage>=32:
        # 2026-09-18 耳甲/耳屏的粉色球改为耳内深色（目标图耳内无高光粉块）
        ear_dark = material('Anatomy_ear_inner',(.16,.09,.06),.96)
        for o in head.children_recursive:
            if o.type=='MESH' and o.name.startswith(('Anatomy_concha','Anatomy_tragus')):
                for slot_i in range(len(o.data.materials)):
                    o.data.materials[slot_i] = M['Anatomy_ear_inner']
    if stage>=25:
        # 2026-09-18 目标眼：窄而深邃。幂等写法：把每类眼部件的竖向半高
        # 归一到目标值（重复执行不再叠加），额发垂缕在 26 阶段另行处理。
        cy=1.648
        targets = {'Anatomy_eyeball': .0038, 'Anatomy_iris': .0007, 'Anatomy_pupil': .0005,
                   'Anatomy_lid': .0048, 'Anatomy_eye_glint': .0005}
        for o in head.children_recursive:
            if o.type!='MESH': continue
            fam = None
            for key in targets:
                if o.name.startswith(key): fam = key; break
            if not fam: continue
            me = o.data
            h = 0.0
            for v in me.vertices:
                d = abs(v.co.y - cy)
                if d > h: h = d
            if h < 1e-6: continue
            sc = targets[fam] / h
            for v in me.vertices:
                v.co.y = cy + (v.co.y - cy)*sc
            me.update()
        # 三缕额前垂发：从发盖前缘垂到眉上方（左中右）
        for k,x in enumerate([-.036,0,.036]):
            w=.010 if k!=1 else .013
            y0=1.700-(k%2)*.004
            y1=1.668-(k%3)*.003
            vv=[(x-w,y0,surface(x-w,y0)+.006),(x+w,y0,surface(x+w,y0)+.006),
                (x+w*.5,y1,surface(x+w*.5,y1)+.005),(x-w*.5,y1,surface(x-w*.5,y1)+.005)]
            fr=mesh('Anatomy_forelock_'+str(k),vv,[(0,1,2),(0,2,3)],hairmat,head)
            for p in fr.data.polygons: p.use_smooth=False
    if stage>=13 and stage<16:
        # Narrow overlapping fringe locks follow the forehead plane. They are
        # deliberately small and seated on the skin, matching the target's
        # swept angular hair rather than floating triangular plates.
        for k,x in enumerate([-.052,-.027,0,.026,.051]):
            w=.012 if k in (0,4) else .014
            y0=1.704-(k%2)*.003; y1=1.690-(k%3)*.002
            vv=[(x-w,y0,surface(x-w,y0)+.002),(x+w,y0,surface(x+w,y0)+.002),(x+w*.42,y1,surface(x+w*.42,y1)+.003), (x-w*.42,y1,surface(x-w*.42,y1)+.003)]
            mesh('Hair_target_fringe_'+str(k),vv,[(0,1,2),(0,2,3)],hairmat,head)
    if stage>=36:
        # 2026-09-18 收尾打磨：发束再收拢 20%；山羊胡收尖；胡角下垂过口角
        for o in head.children_recursive:
            if o.type=='MESH' and o.name.startswith(('HairDetail_back','HairDetail_swept')):
                for v in o.data.vertices:
                    v.co.x *= .8
        for o in head.children_recursive:
            if o.type=='MESH' and o.name == 'Anatomy_beard_chinpad3':
                for v in o.data.vertices:
                    v.co.y -= .004*(1-abs(v.co.x)/.02)
                    v.co.x *= .85
        for o in head.children_recursive:
            if o.type=='MESH' and o.name.startswith('Anatomy_moustache3'):
                for v in o.data.vertices:
                    if v.co.x*1 > .018: v.co.y -= .0035
    if stage>=38:
        # 2026-09-18 主人报告：①头顶悬浮小柱体 = v22 束发环 Hair_target_bun_tie
        # ②脑后细辫子散条 = HairDetail_back/swept 发束（目标图发型是整片厚发
        #   而非散条）。删除两者；发盖下缘延伸为整片厚发罩（环截面在脸前藏进
        #   头内、只露出后/侧发量），丸子头保留在顶后。
        for obj in [o for o in head.children_recursive
                    if o.type=='MESH' and (o.name == 'Hair_target_bun_tie' or
                       o.name.startswith(('HairDetail_back','HairDetail_swept')))]:
            bpy.data.objects.remove(obj, do_unlink=True)
        helmet_secs = [(1.662,.008),(1.62,.013),(1.56,.018),(1.49,.020),(1.42,.018)]
        helmet=[]
        for yc,off in helmet_secs:
            rx,rz,cz=dimensions(yc)
            helmet.append((yc,0,cz-.004,rx+off,rz+off))
        helm=rings('Hair_target_helmet',helmet,'Anatomy_hair',head,n=18)
        for poly in helm.data.polygons: poly.use_smooth=False
    if stage>=34:
        # 2026-09-18 目标图肤色分域：额亮/鼻梁亮条/颧中/颌暗的大色块
        # （替代 v15 的斜条纹公式；只重排 1..5 的 facet 槽，胡须渐变槽不动）
        face34 = None
        for o in head.children_recursive:
            if o.name == 'Face': face34 = o; break
        if face34:
            for poly in face34.data.polygons:
                if poly.material_index < 1 or poly.material_index > 5: continue
                c = poly.center
                if c.y > 1.658 or abs(c.x) < .012: slot = 3
                elif c.y < 1.585: slot = 4
                elif abs(c.x) > .040: slot = 1
                else: slot = 2 + (poly.index % 2)
                poly.material_index = slot
    if stage>=35:
        # 2026-09-18 丸子头圆润（n=12）+ 后脑发束侧向收拢 12%
        for o in [o for o in head.children_recursive if o.type=='MESH' and o.name=='Hair_target_bun']:
            bpy.data.objects.remove(o, do_unlink=True)
        bun=rings('Hair_target_bun',[
            (1.712,0,-.052,.017,.015),
            (1.736,0,-.068,.024,.021),
            (1.752,0,-.082,.018,.016),
            (1.744,0,-.095,.012,.011),
        ],'Anatomy_hair',head,n=12,palette=['Anatomy_hair','Anatomy_hair.001','Anatomy_hair.002'])
        for poly in bun.data.polygons: poly.use_smooth=False
        for o in head.children_recursive:
            if o.type=='MESH' and o.name.startswith(('HairDetail_back','HairDetail_swept')):
                for v in o.data.vertices:
                    v.co.x *= .88
    return {'stage':stage,'checks':['face','features','top','profile'],'headVertices':len(face.data.vertices),'headTriangles':len(face.data.polygons)}
