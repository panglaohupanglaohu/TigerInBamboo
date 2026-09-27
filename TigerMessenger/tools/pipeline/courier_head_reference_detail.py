"""Small head-detail pass built against the courier's packed multi-view references."""
def refine_head_reference_details():
    # Replace rigid segmented hair rods with connected, tapered curved locks.
    for obj in list(head.children_recursive):
        if obj.type=='MESH' and obj.name.startswith(('Wavy_lock','Swept_fringe','Temple_curl','HairDetail_')):
            bpy.data.objects.remove(obj,do_unlink=True)
    def lock(name,points,radius,material):
        points=[Vector(p) for p in points];path=[]
        for j in range(len(points)-1):
            a=points[max(0,j-1)];b=points[j];c=points[j+1];d=points[min(len(points)-1,j+2)]
            for k in range(7):
                t=k/7
                path.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
        path.append(points[-1]);verts=[];faces=[];n=8
        for i,p in enumerate(path):
            tangent=(path[min(i+1,len(path)-1)]-path[max(0,i-1)]).normalized()
            axis=Vector((0,0,1))
            if abs(tangent.dot(axis))>.9:axis=Vector((1,0,0))
            right=tangent.cross(axis).normalized();up=tangent.cross(right).normalized()
            t=i/(len(path)-1);r=radius*(.9-.76*t)*(.94+.06*sin(t*8*pi))
            for k in range(n):verts.append(p+right*(r*cos(2*pi*k/n))+up*(r*.7*sin(2*pi*k/n)))
        for j in range(len(path)-1):
            for k in range(n):faces.append((j*n+k,j*n+(k+1)%n,(j+1)*n+(k+1)%n,(j+1)*n+k))
        faces.extend([tuple(range(n-1,-1,-1)),tuple((len(path)-1)*n+k for k in range(n))])
        obj=mesh(name,verts,faces,material,head)
        import bmesh
        bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
        for p in obj.data.polygons:p.use_smooth=True
    for i in range(24):
        a=pi*.04+i/23*pi*.92;x=.088*cos(a);z=-.014-.065*sin(a)
        lock('HairDetail_back_'+str(i),[(x*.40,1.754,z*.40),(x*.90,1.718,z),(x+ .008*sin(i*1.7),1.659,z-.007),(x*.95-.006*cos(i),1.592,z+.009),(x*1.10,1.527,z-.012),(x*.96,1.478+.025*sin(i),z+.007)],.015 if i%3 else .012,'hair_light' if i%5==0 else 'hair')
    for side in [-1,1]:
        for i in range(5):
            x=side*(.012+.011*i)
            lock('HairDetail_swept_'+str(side)+'_'+str(i),[(x,1.752,.013),(x+side*.026,1.744,.049),(side*(.057+.006*i),1.711,.060),(side*(.070+.004*i),1.672,.047),(side*(.071+.004*i)+.006*sin(i),1.630-i*.010,.050)],.012,'hair_light' if i==2 else 'hair')
        # Small inner-ear concha and raised helix, fitted to the existing ear volume.
        orb('FaceDetail_concha_'+str(side),(side*.087,1.616,.013),(.0045,.015,.010),'skin_shadow',head,segments=16,ringsn=12)
        points=[(side*.088,1.591,.009),(side*.094,1.607,.013),(side*.093,1.630,.010),(side*.086,1.639,.006)]
        lock('FaceDetail_helix_'+str(side),points,.0045,'skin')
