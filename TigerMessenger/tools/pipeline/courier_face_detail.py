"""Anatomical surface refinements for the approved courier face, in metres."""
def refine_face(detail_round):
    import bmesh
    fine=detail_round>=5
    angular=detail_round>=6
    reference_corrected=detail_round>=7
    remove=('Face','Nose','Nostril','Eye','Iris','Pupil','Brow','Sculpted_brow','Fine_upper_lid','Upper_eyelid','Lower_lip','Mouth_seam','Moustache','Chin_stubble','Jaw_stubble','FaceDetail_')
    for obj in list(head.children_recursive):
        if obj.type=='MESH' and obj.name.startswith(remove):bpy.data.objects.remove(obj,do_unlink=True)
    def gaussian(x,y,cx,cy,sx,sy):return math.exp(-.5*((x-cx)/sx)**2-.5*((y-cy)/sy)**2)
    profile=[(1.502,.038,.039,.022),(1.518,.054,.049,.016),(1.541,.067,.057,.007),(1.570,.073,.063,.002),(1.605,.078,.069,0),(1.637,.075,.071,-.003),(1.671,.076,.072,-.005),(1.711,.068,.066,-.009),(1.739,.038,.043,-.013)]
    if fine:
        profile[:4]=[(1.502,.031,.036,.018),(1.518,.047,.046,.013),(1.541,.062,.055,.005),(1.570,.069,.061,.001)]
    if angular:
        profile[:6]=[(1.502,.012,.026,.025),(1.518,.032,.041,.018),(1.541,.051,.053,.008),(1.570,.063,.059,.001),(1.605,.082,.071,0),(1.637,.076,.071,-.003)]
    if reference_corrected:
        profile[:6]=[(1.502,.031,.033,.020),(1.518,.046,.043,.013),(1.541,.059,.051,.006),(1.570,.065,.059,.001),(1.605,.077,.067,0),(1.637,.075,.071,-.003)]
    def dimensions(y):
        for a,b in zip(profile,profile[1:]):
            if a[0]<=y<=b[0]:
                t=(y-a[0])/(b[0]-a[0]);return tuple(a[k]*(1-t)+b[k]*t for k in (1,2,3))
        return profile[-1][1:]
    def front(x,y):
        rx,rz,cz=dimensions(y);z=cz+rz*max(0,1-(x/rx)**2)**.25
        for side in [-1,1]:
            z-=.0125*gaussian(x,y,side*.033,1.643,.016,.010)
            z+=.0065*gaussian(x,y,side*.034,1.666,.024,.008)
            z+=(.0045 if reference_corrected else .014 if angular else .008 if fine else .005)*gaussian(x,y,side*.054,1.619 if reference_corrected else 1.615,.022 if reference_corrected else .015,.014 if reference_corrected else .010)
            z-=(.002 if reference_corrected else .009 if angular else .005 if fine else .003)*gaussian(x,y,side*.047,1.583,.020 if reference_corrected else .016,.019 if reference_corrected else .015)
        z+=.006*gaussian(x,y,0,1.580,.031,.013)
        z+=.006*gaussian(x,y,0,1.524,.028,.013)
        return z
    vertices=[];faces=[];rows=39 if fine else 29;cols=64 if fine else 48
    for j in range(rows):
        y=1.502+(.237*j/(rows-1));rx,rz,cz=dimensions(y)
        for i in range(cols):
            angle=2*pi*i/cols;x=rx*cos(angle)
            z=front(x,y) if sin(angle)>=0 else cz+rz*sin(angle)
            vertices.append((x,y,z))
    for j in range(rows-1):
        for i in range(cols):
            a=j*cols+i;b=j*cols+(i+1)%cols;c=(j+1)*cols+(i+1)%cols;d=(j+1)*cols+i
            faces.extend([(a,b,c),(a,c,d)])
    faces.extend([tuple(range(cols-1,-1,-1)),tuple((rows-1)*cols+i for i in range(cols))])
    skin=mesh('Face',vertices,faces,'skin',head)
    bm=bmesh.new();bm.from_mesh(skin.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(skin.data);bm.free()
    # Skin-conforming beard shading, with a soft irregular boundary rather than a band.
    base=M['skin'].diffuse_color
    for i in range(1,13):
        name='FaceDetail_stubble_'+str(i);m=M['skin'].copy();m.name=name
        t=i/12*(.62 if fine else .30);shade=tuple(base[k]*(1-t)+(.075,.052,.036)[k]*t for k in range(3))+(1,)
        m.diffuse_color=shade;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=shade
        M[name]=m;skin.data.materials.append(m)
    for poly in skin.data.polygons:
        p=sum((Vector(vertices[i]) for i in poly.vertices),Vector())/len(poly.vertices)
        border=1.581+.026*min(1,abs(p.x)/.067)
        weight=max(0,min(1,(border-p.y)/.029))*max(0,min(1,(p.z-.012)/.025))
        poly.material_index=min(12,int(weight*12*(.88+.12*sin(poly.index*13.1))))
        poly.use_smooth=True
    # Almond eye openings sit inside the sculpted orbital depressions.
    def tinted(name,source,color):
        m=M[source].copy();m.name=name;m.diffuse_color=(*color,1)
        m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1);M[name]=m
    if angular:
        tinted('FaceDetail_sclera','eyes',(.62,.54,.43))
        tinted('FaceDetail_lips','skin',tuple(base[k]*[.77,.66,.63][k] for k in range(3)))
        tinted('FaceDetail_mouth','skin',(.15,.075,.047))
    for side in [-1,1]:
        cx=side*.032;cy=1.644;outline=[]
        for i in range(32):
            a=2*pi*i/32;x=cx+.0175*cos(a);y=cy+(.0044 if fine else .0054)*sin(a)+side*(x-cx)*.045
            outline.append((x,y,.0685-.003*abs(cos(a))))
        eye=mesh('FaceDetail_eye_'+str(side),[(cx,cy,.070),*outline],[(0,i+1,(i+1)%32+1) for i in range(32)],'FaceDetail_sclera' if angular else 'eyes',head)
        orb('FaceDetail_iris_'+str(side),(cx,cy,.071),(.0055 if angular else .0047,.0038 if fine else .0047,.0017),'iris',head,segments=16,ringsn=8)
        orb('FaceDetail_pupil_'+str(side),(cx,cy,.0726),(.0022,.0027,.0008),'hair',head,segments=12)
        orb('FaceDetail_catchlight_'+str(side),(cx-.0014,cy+.0017,.0733),(.0008,.0008,.0004),'eyes',head,segments=8)
        for upper in [True,False]:
            vv=[]
            for i in range(17):
                u=i/16;x=cx-.0175+.035*u;dy=((.0045 if upper else -.004) if fine else (.0055 if upper else -.005))*sin(pi*u)
                y=cy+dy+side*(x-cx)*.045;z=.0685-.003*abs(2*u-1)
                vv.extend([(x,y,z+.0008),(x,y+(.0025 if upper else -.0018),z-.0002)])
            mesh('FaceDetail_lid_'+str(side)+str(upper),vv,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(16)],'skin_shadow' if upper else 'skin',head)
        brow=[]
        for i in range(9):
            u=i/8;x=side*(.013+.042*u);y=(1.660 if fine else 1.664)+(.002 if fine else .005)*sin(pi*u)-.001*u;z=front(x,y)+.001
            brow.extend([(x,y,z),(x,y+((.006 if angular else .0045)*(1-u)+.001),z)])
        mesh('FaceDetail_brow_'+str(side),brow,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(8)],'hair',head)
    # Curved bridge and rounded tip, joined to the face instead of a wedge block.
    nose_rows=[(1.671,.008,.075),(1.653,.0085,.082),(1.633,.009,.095),(1.619,.011,.104),(1.611,.014,.102),(1.605,.011,.088)]
    if fine:
        nose_rows=[(y,w,z-(.004 if y<1.640 else 0)) for y,w,z in nose_rows]
    vv=[]
    for y,w,z in nose_rows:
        for i in range(9):
            u=-1+2*i/8;x=w*u;edge=front(x,y)-.001
            vv.append((x,y,edge+(z-edge)*max(0,1-u*u)**.6))
    obj=mesh('Nose',vv,[(j*9+i,j*9+i+1,(j+1)*9+i+1,(j+1)*9+i) for j in range(5) for i in range(8)],'skin',head)
    for p in obj.data.polygons:p.use_smooth=True
    for side in [-1,1]:
        orb('FaceDetail_nostril_'+str(side),(side*.0095,1.607,.091),(.0038,.0017,.001),'skin_shadow',head,segments=12)
    # Separate vermilion surfaces and a fine, curved closed mouth.
    for upper in [True,False]:
        vv=[]
        for i in range(25):
            x=-.023+.046*i/24;u=x/.023;seam=1.580+(-.001 if angular else .0015)*u*u
            fullness=max(0,1-u*u);border=seam+((.005-.0018*math.exp(-(u/.22)**2)) if upper else -.006)*fullness
            z=front(x,seam)+.0015
            vv.extend([(x,seam,z),(x,border,z+(.0007 if fine else .002)*fullness)])
        mesh('FaceDetail_lip_'+str(upper),vv,[(i*2,i*2+1,i*2+3,i*2+2) for i in range(24)],'FaceDetail_lips' if angular else 'skin_shadow' if upper else 'skin',head)
    if angular:
        vv=[]
        for i in range(25):
            x=-.022+.044*i/24;u=x/.023;y=1.580-.001*u*u;z=front(x,y)+.0017
            vv.extend([(x,y,z),(x,y-.0007*(1-u*u),z)])
        mesh('FaceDetail_mouth_seam',vv,[(i*2,i*2+1,i*2+3,i*2+2) for i in range(24)],'FaceDetail_mouth',head)
    if fine and not angular:
        # Fine moustache follows the philtrum and upper lip, preserving mouth corners.
        for side in [-1,1]:
            vv=[]
            for i in range(13):
                x=side*(.003+.018*i/12);y=1.591-.006*i/12;z=front(x,y)+.001
                vv.extend([(x,y,z),(x,y-.003,z+.0007)])
            mesh('FaceDetail_moustache_'+str(side),vv,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(12)],'beard',head)
    if reference_corrected:
        # Shorten the overlong lower face while retaining all existing head/neck joints.
        def compact_lower_face(p):
            t=max(0,min(1,(1.608-p.y)/.106))
            return Vector((p.x,p.y+.024*t*t,p.z))
        for obj in head.children_recursive:
            if obj.type=='MESH' and obj.name.startswith(('Face','Nose','Nostril')):
                deform(obj,compact_lower_face)
        for obj in root.children_recursive:
            if obj.type=='MESH' and obj.name.startswith(('Ear','Neck','Hair_crown')):
                for poly in obj.data.polygons:poly.use_smooth=True
