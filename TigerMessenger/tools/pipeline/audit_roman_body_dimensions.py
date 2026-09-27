"""Read source GLB vertex positions and transforms; no Blender/Godot process."""
import json, struct, math, hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def identity():
    return [[float(i == j) for j in range(4)] for i in range(4)]

def multiply(a, b):
    return [[sum(a[i][k]*b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]

def transform(n):
    if "matrix" in n:
        return [[n["matrix"][j*4+i] for j in range(4)] for i in range(4)]
    x,y,z,w = n.get("rotation",[0,0,0,1])
    r = [[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w),0],
         [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w),0],
         [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y),0],[0,0,0,1]]
    for i in range(3):
        for j in range(3): r[i][j] *= n.get("scale",[1,1,1])[j]
        r[i][3] = n.get("translation",[0,0,0])[i]
    return r

def metrics(points):
    low = [min(p[i] for p in points) for i in range(3)]
    high = [max(p[i] for p in points) for i in range(3)]
    return {"min_xyz":low,"max_xyz":high,"width_x":high[0]-low[0],
            "height_y":high[1]-low[1],"depth_z":high[2]-low[2],
            "maximum_xz_radius_from_root":max(math.hypot(p[0],p[2]) for p in points),
            "vertices":len(points)}

def read(role):
    path=ROOT/f"godot/assets/roman-family-v1/romanSoldier_{role}_blue.glb"
    raw=path.read_bytes();pos=12;chunks={}
    while pos<len(raw):
        size,kind=struct.unpack_from("<II",raw,pos);chunks[kind]=raw[pos+8:pos+8+size];pos+=8+size
    data=json.loads(chunks[0x4e4f534a]);binary=chunks[0x004e4942]
    all_points=[];body=[];feet=[];excluded=[]
    def walk(i,parent,visible=True,carried=False,foot=False):
        n=data["nodes"][i];ex=n.get("extras",{});nid=ex.get("three_node_id","")
        visible=visible and ex.get("three_visible",True) and not ex.get("candidateHidden",False)
        carried=carried or nid in ["n31","n29"]
        foot=foot or nid in ["n23","n26"]
        matrix=multiply(parent,transform(n))
        if visible and "mesh" in n:
            if carried: excluded.append(n.get("name",str(i)))
            for primitive in data["meshes"][n["mesh"]]["primitives"]:
                a=data["accessors"][primitive["attributes"]["POSITION"]]
                assert a["componentType"]==5126 and a["type"]=="VEC3"
                view=data["bufferViews"][a["bufferView"]]
                offset=view.get("byteOffset",0)+a.get("byteOffset",0)
                for j in range(a["count"]):
                    p=struct.unpack_from("<fff",binary,offset+j*view.get("byteStride",12))+(1,)
                    p=tuple(sum(matrix[k][q]*p[q] for q in range(4)) for k in range(3))
                    all_points.append(p)
                    if not carried: body.append(p)
                    if foot: feet.append(p)
        for child in n.get("children",[]): walk(child,matrix,visible,carried,foot)
    for i in data["scenes"][data.get("scene",0)]["nodes"]: walk(i,identity())
    return {"role":role,"source":str(path.relative_to(ROOT)),"sha256":hashlib.sha256(raw).hexdigest(),
            "body_armor_helmet_without_carried_equipment":metrics(body),"all_visible":metrics(all_points),
            "legs_and_feet":metrics(feet),"excluded_carried_meshes":excluded}

result={"units":"GLB local metres including every imported node transform; production actor root uses unit world scale",
        "pose":"imported neutral only, no concealment/attack animation sweep",
        "body_definition":"all visible meshes except n31 equipment and n29 crate descendants; armor/helmet/crest/hands included",
        "roles":[read(r) for r in ["gladius","spear","longbow"]]}
out=ROOT/"artifacts/pipeline/saihoji-target-integration/roman-body-dimensions.json"
out.write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(result,ensure_ascii=False,indent=2))
