import json,struct,numpy as np
from pathlib import Path
p=Path("TigerMessenger/godot/assets/world-source/original-world-v1.glb");b=p.read_bytes();n=struct.unpack_from("<I",b,12)[0];j=json.loads(b[20:20+n]);b=b[28+n:]
def mat(n):
 if "matrix" in n:return np.array(n["matrix"]).reshape(4,4,order="F")
 x,y,z,w=n.get("rotation",[0,0,0,1]);m=np.eye(4);m[:3,:3]=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])@np.diag(n.get("scale",[1,1,1]));m[:3,3]=n.get("translation",[0,0,0]);return m
ts={}
def walk(i,p):
 ts[i]=p@mat(j["nodes"][i])
 for c in j["nodes"][i].get("children",[]):walk(c,ts[i])
for i in j["scenes"][j.get("scene",0)]["nodes"]:walk(i,np.eye(4))
paths={n.get("extras",{}).get("sourcePath",""):i for i,n in enumerate(j["nodes"])};ip="leviathanGroup[156]/leviathan-island[39]";inv=np.linalg.inv(ts[paths[ip]])
def acc(i):
 a=j["accessors"][i];v=j["bufferViews"][a["bufferView"]];dt={5126:"<f4",5125:"<u4",5123:"<u2",5121:"u1"}[a["componentType"]];s={"SCALAR":1,"VEC3":3,"VEC4":4,"VEC2":2}[a["type"]];return np.ndarray((a["count"],s),dtype=dt,buffer=b,offset=v.get("byteOffset",0)+a.get("byteOffset",0),strides=(v.get("byteStride",np.dtype(dt).itemsize*s),np.dtype(dt).itemsize)).copy()
g=[]
for path,i in paths.items():
 if path.startswith(ip+"/") and ("leviathan-crust-plate[" in path or "leviathan-moss-bed-" in path) and "mesh" in j["nodes"][i]:
  m=inv@ts[i]
  for prim in j["meshes"][j["nodes"][i]["mesh"]]["primitives"]:
   v=acc(prim["attributes"]["POSITION"]);v=(m@np.c_[v,np.ones(len(v))].T).T[:,:3];idx=acc(prim["indices"]).reshape(-1);g.extend(v[idx.reshape(-1,3)])
t=np.array(g);a=t[:,0];ab=t[:,1]-a;ac=t[:,2]-a;d=ab[:,0]*ac[:,2]-ab[:,2]*ac[:,0];safe=np.where(abs(d)>1e-10,d,1)

world_ts=ts;world_paths=paths; mapping=json.loads(Path("TigerMessenger/godot/assets/saihoji-pines-v1/runtime-mapping.json").read_text())["rows"]
points={};roots=[]
for v in t.reshape(-1,3):
 k=(round(float(v[0]),5),round(float(v[2]),5))
 if k not in points or v[1]>points[k][1]:points[k]=[float(v[0]),max(float(v[1]),-0.28)+0.008,float(v[2])]
for row in mapping:
 m=inv@world_ts[world_paths[row["sourcePath"]]]
 cb=Path("TigerMessenger/godot/assets/saihoji-pines-v1/"+Path(row["glb"]).name).read_bytes();nn=struct.unpack_from("<I",cb,12)[0];j=json.loads(cb[20:20+nn]);b=cb[28+nn:]
 ct={}
 def cw(i,p):
  node=j["nodes"][i];tm=np.eye(4) if node.get("extras",{}).get("three_node_id")=="n0" else mat(node);ct[i]=p@tm
  for c in node.get("children",[]):cw(c,ct[i])
 for i in j["scenes"][0]["nodes"]:cw(i,np.eye(4))
 low=[]
 for i,node in enumerate(j["nodes"]):
  if node.get("extras",{}).get("three_node_id")=="n9" and "mesh" in node:
   for prim in j["meshes"][node["mesh"]]["primitives"]:
    v=acc(prim["attributes"]["POSITION"]);v=(ct[i]@np.c_[v,np.ones(len(v))].T).T[:,:3];low.extend(v[v[:,1]<0.2])
 low=np.array(low);radius=float(np.max(np.linalg.norm(low[:,[0,2]],axis=1)))+0.06
 probes=[]
 for angle in np.linspace(0,2*np.pi,16,endpoint=False):
  v=m@np.array([np.cos(angle)*radius,-0.025,np.sin(angle)*radius,1]);probes.append(v[:3].tolist());points[(round(float(v[0]),5),round(float(v[2]),5))]=v[:3].tolist()
 v=m@np.array([0,-0.025,0,1]);points[(round(float(v[0]),5),round(float(v[2]),5))]=v[:3].tolist()
 roots.append({"seed":row["seed"],"sourcePath":row["sourcePath"],"radius_local":radius,"center":v[:3].tolist(),"probes":probes})
def hull(vals):
 pts=sorted(set((float(v[0]),float(v[2])) for v in vals))
 def cross(o,a,b):return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
 lo=[];hi=[]
 for p in pts:
  while len(lo)>=2 and cross(lo[-2],lo[-1],p)<=0:lo.pop()
  lo.append(p)
 for p in reversed(pts):
  while len(hi)>=2 and cross(hi[-2],hi[-1],p)<=0:hi.pop()
  hi.append(p)
 return lo[:-1]+hi[:-1]
def area(h):return abs(sum(h[i][0]*h[(i+1)%len(h)][1]-h[(i+1)%len(h)][0]*h[i][1] for i in range(len(h)))/2)
oldh=hull(t.reshape(-1,3));newh=hull(points.values());
diag=json.loads(Path("TigerMessenger/artifacts/pipeline/saihoji-pines-v1/root-ground-diagnostic.json").read_text()); dr={r["seed"]:r for r in diag["rows"]}
for r in roots:
 r["support_radius"]=max(np.linalg.norm(np.array(v)[[0,2]]-np.array(r["center"])[[0,2]]) for v in r["probes"])+0.02
 r["shore"]=dr[r["seed"]]["nearest_edge_xz"]
out={"points":list(points.values()),"roots":roots,"outline":newh,"original_outline":oldh,"original_area_local":area(oldh),"new_area_local":area(newh),"area_added_world":(area(newh)-area(oldh))*.25,"root_transforms_unchanged":True,"method":"continuous island-local support terrain, not 25 pots; original mesh retained, optional overlay"}
Path("TigerMessenger/godot/assets/saihoji-pines-v1/root-support.json").write_text(json.dumps(out,indent=2));print({k:v for k,v in out.items() if k not in ["points","roots","outline"]});print("points",len(points))

