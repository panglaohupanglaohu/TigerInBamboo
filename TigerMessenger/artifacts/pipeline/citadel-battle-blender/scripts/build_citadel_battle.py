"""1:1 Blender replica of the 高山圣城之战 target image.

Builds: mountain/cliff terrain + harbour basin, the white citadel keep (arched gate,
banners, crenellated curtain wall, domed/conical towers), the grand stair, the circular
plaza with statue, the old city on the left hillside, the right terrace with the Trojan
horse, the harbour (quays, piers, stalls, crates, lamps), a war galley plus small boats,
~140 instanced soldiers (blue attackers / red defenders), and the blue-hour lighting.

Run headless:
  Blender --background --factory-startup --python build_citadel_battle.py -- [--quick]
"""
import bpy, sys, os, math, json, random, time
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
BASE = os.path.dirname(HERE)

from citadel_lib import (Parts, mat, water_mat, obj, mesh, clone, coll, box_data, cyl_data,
                         cone_data, dome_data, prism_data, arch_data, arch_band_data,
                         arch_profile, ring_data, tube_pts, TAU)
import citadel_assets as A

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
QUICK = "--quick" in ARGS
SEED = 20260912
rnd = random.Random(SEED)
T0 = time.time()
STATS = {"seed": SEED}

WATER_Z = -3.2
CAM_POS = (-14.0, -99.0, 50.0)
QUAY_Z = 0.0
PLAZA_Z = 4.0
PLAZA_C = (11.0, -4.0)
PLAZA_R = 17.0
GATE_PLAT_Z = 22.0
KEEP_C = (16.0, 58.0)

# ---------------------------------------------------------------- scene ------
def fresh():
    for c in (bpy.data.objects, bpy.data.meshes, bpy.data.materials, bpy.data.lights,
              bpy.data.cameras, bpy.data.collections, bpy.data.worlds):
        for d in list(c):
            try:
                c.remove(d, do_unlink=True)
            except Exception:
                pass
    bpy.context.scene.world = bpy.data.worlds.new("CitadelNight")


fresh()
C_TERRAIN = coll("Terrain")
C_CITADEL = coll("Citadel")
C_CITY = coll("OldCity")
C_EAST = coll("EastTerrace")
C_HARBOR = coll("Harbor")
C_SHIPS = coll("Ships")
C_TROOPS = coll("Troops")
C_PROPS = coll("Props")
C_LIGHT = coll("Lighting")
C_HIDDEN = coll("_Sources")


def ridge_band(p, key, y, thick, x0, x1, base_z, hmax, seedv, steps=26, sharp=0.55):
    """A soft mountain ridge: a peaked skyline polygon extruded along Y."""
    r = random.Random(seedv)
    pts = []
    for i in range(steps + 1):
        t = i / float(steps)
        x = x0 + (x1 - x0) * t
        h = (0.42 + 0.58 * abs(math.sin(t * 7.3 + seedv * 0.7)) ** sharp) * hmax
        h *= 0.75 + 0.5 * r.random()
        h *= 0.55 + 0.45 * math.sin(math.pi * min(1.0, max(0.0, t * 1.12 - 0.06)))
        pts.append((x, base_z + h))
    poly = pts + [(x1, base_z - 40.0), (x0, base_z - 40.0)]
    n = len(poly)
    v = [(x, y - thick / 2.0, z) for (x, z) in poly] + [(x, y + thick / 2.0, z) for (x, z) in poly]
    f = [tuple(range(n)), tuple(range(n, 2 * n))[::-1]]
    for i in range(n):
        j = (i + 1) % n
        f.append((i, n + i, n + j, j))
    p.add(key, (v, f))


# ============================================================ terrain =========
def terrain():
    p = Parts("Terrain")
    # harbour water
    p.add("rock_dark", box_data(420, 460, 6), (-40, 60, WATER_Z - 3.2))
    # near quay landmass (right of the waterline) -------------------------------
    quay = [(-14, -70), (-19, 10), (-26, 46), (-8, 64), (30, 70), (92, 60),
            (96, -60), (10, -76)]
    p.add("ground", prism_data(quay, 9.0, WATER_Z - 5.6))
    # quay-front rock courses so the landmass is not one clean extrusion
    for i in range(22):
        yy = -70 + i * 6.2
        xx = -14.4 - 0.075 * (yy + 70)
        p.add("ground_dark", box_data(2.2, 6.3, 3.2), (xx - 0.8, yy, -1.7))
    # plaza terrace block
    p.add("pave", prism_data([(-12, -66), (-16, 12), (34, 18), (40, -70)],
                             PLAZA_Z + 0.2, -3.0))
    # faced retaining courses along the plaza terrace, plus buttresses
    for i in range(18):
        xx = -11 + i * 2.9
        p.add("wall_shade", box_data(2.7, 1.6, PLAZA_Z + 2.6), (xx, -20.8, PLAZA_Z / 2 - 1.3))
        if i % 3 == 0:
            p.add("stone", box_data(1.5, 2.6, PLAZA_Z + 3.4), (xx, -21.4, PLAZA_Z / 2 - 1.0))
    # cliff mass under the citadel
    cliff = [(-16, 24), (-22, 52), (-6, 86), (44, 92), (60, 62), (52, 24)]
    p.add("rock_mid", prism_data(cliff, GATE_PLAT_Z - 1.0, -2.0))
    # vertical striations + ledges on the cliff face under the citadel
    for i in range(34):
        xx = -14 + rnd.random() * 62
        yy = 24 + rnd.random() * 16
        hh = 6 + rnd.random() * 18
        p.add("rock_dark" if i % 3 else "rock_mid",
              box_data(2.4 + rnd.random() * 3.4, 3.0 + rnd.random() * 4.0, hh, taper=0.7),
              (xx, yy, 2 + rnd.random() * 12))
    p.add("rock_dark", prism_data([(-10, 34), (-14, 60), (2, 80), (40, 82), (50, 56), (44, 32)],
                                  GATE_PLAT_Z + 5.0, -2.0))
    # broken rock shelves so the cliff is not one clean extrusion
    for i in range(16):
        x = -16 + rnd.random() * 66
        y = 26 + rnd.random() * 58
        w = 4 + rnd.random() * 9
        h = 3 + rnd.random() * 13
        p.add("rock_mid" if i % 2 else "rock_dark",
              box_data(w, w * 0.8, h, taper=0.62), (x, y, 4 + rnd.random() * 14))
    # east terrace shelf
    p.add("ground", prism_data([(38, -60), (36, 30), (92, 36), (96, -62)], 8.0, -3.0))
    for i in range(14):
        p.add("ground_dark", box_data(3.0, 5.0, 4.0, taper=0.7),
              (37.5, -56 + i * 6.4, 1.0))
    p.add("rock_mid", prism_data([(56, 8), (54, 54), (96, 60), (100, 6)], 26.0, -2.0))
    # west hillside carrying the old city
    p.add("rock_mid", prism_data([(-104, 40), (-112, 150), (-30, 176), (-16, 96), (-30, 50)],
                                 10.0, -3.0))
    for i in range(26):
        p.add("rock_dark" if i % 2 else "rock_mid",
              box_data(5 + rnd.random() * 7, 5 + rnd.random() * 7, 4 + rnd.random() * 10,
                       taper=0.65),
              (-108 + rnd.random() * 86, 44 + rnd.random() * 126, -2 + rnd.random() * 16))
    for i in range(9):
        t = i / 8.0
        p.add("rock_dark" if i % 2 else "rock_mid",
              prism_data([(-100 + 8 * i, 46 + 9 * i), (-104 + 8 * i, 150),
                          (-34 - 2 * i, 168 - 6 * i), (-24 - 3 * i, 92 + 7 * i)],
                         5.0 + 3.4 * i, -2.0 + 3.2 * i))
    # stepped terraces + retaining courses on the face below the citadel
    for k in range(3):
        zz = 1.2 + k * 4.0
        for i in range(17):
            xx = -14 + i * 4.1
            if 1.0 < xx < 31.0:      # leave the grand-stair corridor clear
                continue
            p.add("wall_shade" if (i + k) % 2 else "stone",
                  box_data(4.0, 2.6, 3.8), (xx, 20.0 - k * 2.4, zz))
        for i in range(4):
            xr = -12 + i * 4.0 if i < 2 else 34 + (i - 2) * 6.0
            p.add("rock_dark", box_data(2.0, 3.4, 4.4, taper=0.7),
                  (xr, 19.0 - k * 2.4, zz + 0.8))
    # white faced wall across the cliff front, with arched niches
    for i in range(19):
        xx = -16 + i * 2.85
        if 3.0 < xx < 29.0:
            continue
        p.add("wall" if i % 2 else "wall_warm", box_data(2.8, 2.2, 16.0), (xx, 23.4, 8.0))
        p.add("trim", box_data(3.0, 2.4, 0.6), (xx, 23.4, 16.2))
        if i % 2 == 0:
            av, af = arch_data(1.9, 3.2, 1.6, seg=6)
            p.add("wall_shade", (av, af), (xx, 22.5, 4.0))
            p.add("win_warm", box_data(0.9, 0.3, 1.6), (xx, 22.2, 11.4))
    # west side of the plaza terrace: faced wall + arched undercroft
    for i in range(11):
        yy = -14.0 + i * 2.9
        p.add("wall", box_data(1.8, 2.8, 7.4), (-15.0, yy, PLAZA_Z - 3.5))
        if i % 2 == 0:
            av, af = arch_data(2.2, 3.0, 2.0, seg=6)
            p.add("wall_shade", (av, af), (-15.4, yy, PLAZA_Z - 7.0))
    p.bake(c=C_TERRAIN)

    # distant mountain ridges ---------------------------------------------------
    m = Parts("Mountains")
    ridge_band(m, "ridge_1", 168.0, 60.0, -300, 300, -6.0, 78.0, 3, 30, 0.5)
    ridge_band(m, "ridge_2", 246.0, 70.0, -380, 380, -6.0, 104.0, 11, 26, 0.6)
    ridge_band(m, "ridge_3", 340.0, 80.0, -460, 460, -6.0, 132.0, 23, 22, 0.7)
    ridge_band(m, "ridge_4", 470.0, 90.0, -600, 600, -6.0, 168.0, 41, 18, 0.8)
    # a nearer, darker headland on each side to frame the bay
    ridge_band(m, "rock_mid", 118.0, 44.0, -300, -110, -6.0, 62.0, 7, 14, 0.5)
    ridge_band(m, "rock_mid", 112.0, 44.0, 96, 290, -6.0, 70.0, 9, 14, 0.5)
    m.bake(c=C_TERRAIN)

    # far watch-towers picked out on the ridges (as in the target)
    t = Parts("FarTowers")
    for (x, y, z, h) in ((-150, 160, 34, 26), (-120, 164, 40, 20), (86, 150, 30, 30),
                         (128, 172, 44, 22), (196, 236, 52, 34), (-224, 240, 48, 28)):
        t.add("wall_shade", box_data(9, 9, h), (x, y, z + h / 2.0))
        t.add("roof_deep", box_data(10, 10, 2.2, taper=0.4), (x, y, z + h + 1.1))
        for k in range(3):
            t.add("far_city", box_data(2.2, 0.6, 3.0), (x, y - 4.6, z + 5 + k * (h / 3.6)))
    t.bake(c=C_TERRAIN)

    # water surface
    wv, wf = box_data(440, 480, 0.4)
    o = obj("Water", mesh("Water", wv, wf), loc=(-46, 66, WATER_Z))
    o.data.materials.append(water_mat())
    C_TERRAIN.objects.link(o)
    bpy.context.scene.collection.objects.unlink(o)


# ============================================ building modules (Townscaper-ish)
def crenel(p, key, x0, x1, y, z, depth=1.2, step=2.2, mh=1.1):
    n = max(1, int((x1 - x0) / step))
    for i in range(n):
        x = x0 + step * (i + 0.5)
        p.add(key, box_data(step * 0.56, depth, mh), (x, y, z + mh / 2.0))


def crenel_y(p, key, y0, y1, x, z, depth=1.2, step=2.2, mh=1.1):
    n = max(1, int((y1 - y0) / step))
    for i in range(n):
        y = y0 + step * (i + 0.5)
        p.add(key, box_data(depth, step * 0.56, mh), (x, y, z + mh / 2.0))


def win_grid(p, x0, x1, z0, z1, y, nx, nz, w=0.9, h=1.7, key="win_warm", d=0.26):
    for i in range(nx):
        for k in range(nz):
            x = x0 + (x1 - x0) * (i + 0.5) / nx
            z = z0 + (z1 - z0) * (k + 0.5) / nz
            p.add("wall_shade", box_data(w + 0.35, d * 1.6, h + 0.42), (x, y, z))
            p.add(key, box_data(w, d, h), (x, y - d * 0.5, z))


def tower(p, cx, cy, z0, r, body_h, cap="dome", seg=12, band=True, lit=6):
    p.cyl("wall", r, r * 0.97, body_h, (cx, cy, z0), seg)
    if band:
        p.cyl("trim", r * 1.06, r * 1.06, 0.5, (cx, cy, z0 + body_h - 0.6), seg)
        p.cyl("trim", r * 1.05, r * 1.05, 0.45, (cx, cy, z0 + body_h * 0.44), seg)
    for i in range(lit):
        a = TAU * i / lit + 0.3
        p.add("win_warm", box_data(0.75, 0.4, 1.6),
              (cx + math.cos(a) * (r - 0.12), cy + math.sin(a) * (r - 0.12),
               z0 + body_h * 0.62))
        p.add("win_warm", box_data(0.7, 0.4, 1.4),
              (cx + math.cos(a) * (r - 0.12), cy + math.sin(a) * (r - 0.12),
               z0 + body_h * 0.30))
    if cap == "dome":
        p.cyl("trim", r * 1.12, r * 1.12, 0.6, (cx, cy, z0 + body_h), seg)
        p.dome("roof_blue", r * 1.10, r * 1.15, (cx, cy, z0 + body_h + 0.6), seg, 4)
        p.cone("roof_deep", 0.16, 0.9, (cx, cy, z0 + body_h + 0.6 + r * 1.15), 5)
    elif cap == "cone":
        p.cyl("trim", r * 1.14, r * 1.14, 0.55, (cx, cy, z0 + body_h), seg)
        p.cone("roof_blue", r * 1.18, r * 2.1, (cx, cy, z0 + body_h + 0.55), seg)
    else:
        crenel_ring(p, cx, cy, r * 1.04, z0 + body_h, seg)


def crenel_ring(p, cx, cy, r, z, seg=12, mh=1.1):
    for i in range(seg):
        a = TAU * i / seg
        p.add("wall", box_data(1.35, 1.35, mh),
              (cx + math.cos(a) * r, cy + math.sin(a) * r, z + mh / 2.0))


def banner(p, cx, y, z_top, w=3.0, h=13.0, trident=True):
    p.add("banner", box_data(w, 0.22, h), (cx, y, z_top - h / 2.0))
    p.add("roof_deep", box_data(w * 1.06, 0.3, 0.5), (cx, y - 0.04, z_top - 0.25))
    for sx in (-1, 1):                              # swallow-tail bottom
        p.add("banner", box_data(w * 0.42, 0.22, 1.1),
              (cx + sx * w * 0.27, y, z_top - h - 0.5))
    if trident:
        ty = y - 0.16
        zc = z_top - h * 0.44
        p.add("banner_mark", box_data(0.34, 0.12, 5.0), (cx, ty, zc))
        p.add("banner_mark", box_data(2.5, 0.12, 0.34), (cx, ty, zc + 1.6))
        for sx in (-1, 1):
            p.add("banner_mark", box_data(0.30, 0.12, 2.4), (cx + sx * 1.1, ty, zc + 2.8))
            p.add("banner_mark", cone_data(0.28, 0.8, 4), (cx + sx * 1.1, ty, zc + 4.0))
        p.add("banner_mark", cone_data(0.30, 0.9, 4), (cx, ty, zc + 4.0))


def citadel():
    p = Parts("Keep")
    cx, cy = KEEP_C
    z0 = GATE_PLAT_Z
    # gate platform / forecourt
    p.add("pave", box_data(40, 16, 1.2), (cx, cy - 22, z0 - 0.6))
    p.add("wall_shade", box_data(41, 1.4, 2.0), (cx, cy - 29.6, z0 + 1.0))
    crenel(p, "wall", cx - 20, cx + 20, cy - 29.6, z0 + 2.0, 1.4, 2.6, 0.9)

    # ---- main keep block ----
    W, Dp, H = 34.0, 22.0, 21.0
    gy_f = cy - Dp / 2.0          # front face plane
    FT = 4.0                      # front-wall thickness (the gate passage runs in it)
    # main mass sits BEHIND the front wall, so the gate can be a genuine opening
    p.add("wall", box_data(W, Dp - FT, H), (cx, cy + FT / 2.0, z0 + H / 2.0))
    p.add("wall_warm", box_data(W * 1.01, Dp * 1.01, 1.0), (cx, cy, z0 + 0.5))
    p.add("trim", box_data(W * 1.04, Dp * 1.04, 0.9), (cx, cy, z0 + H - 0.45))
    crenel(p, "wall", cx - W / 2, cx + W / 2, cy - Dp / 2 - 0.1, z0 + H, 1.6, 2.8, 1.5)
    crenel(p, "wall", cx - W / 2, cx + W / 2, cy + Dp / 2 + 0.1, z0 + H, 1.6, 2.8, 1.5)
    crenel_y(p, "wall", cy - Dp / 2, cy + Dp / 2, cx - W / 2 - 0.1, z0 + H, 1.6, 2.8, 1.5)
    crenel_y(p, "wall", cy - Dp / 2, cy + Dp / 2, cx + W / 2 + 0.1, z0 + H, 1.6, 2.8, 1.5)
    # roof walk
    p.add("pave", box_data(W - 2.6, Dp - 2.6, 0.5), (cx, cy, z0 + H + 0.25))

    # ---- great arched gate ----
    gy = gy_f
    gw, gh = 9.0, 15.0
    OW, OH = gw + 2.2, gh + 1.6        # the hole the arch frame sits in
    side = (W - OW) / 2.0
    for sx in (-1, 1):                  # jambs
        p.add("wall", box_data(side, FT, H), (cx + sx * (OW + side) / 2.0, gy + FT / 2.0,
                                              z0 + H / 2.0))
    p.add("wall", box_data(OW, FT, H - OH), (cx, gy + FT / 2.0, z0 + OH + (H - OH) / 2.0))
    for sx in (-1, 1):                  # pilaster surround flanking the arch
        p.add("wall_warm", box_data(1.9, 0.5, gh + 5.2),
              (cx + sx * (OW / 2.0 + 0.95), gy - 0.25, z0 + (gh + 5.2) / 2.0))
    p.add("wall_warm", box_data(gw + 5.0, 0.5, 1.6), (cx, gy - 0.25, z0 + gh + 4.4))
    avb, afb = arch_band_data(gw + 2.2, gh + 1.6, gw, gh, 1.0, seg=12)
    p.add("trim", (avb, afb), (cx, gy + 0.5, z0))
    # graded light tunnel: concentric bands stepping back and getting hotter, so the
    # opening reads as depth with an orange-to-gold ramp rather than a white plate.
    rings = (("gate_r1", 1.000, 0.945, 2.4), ("gate_r2", 0.945, 0.900, 3.4),
             ("gate_r3", 0.900, 0.862, 4.6), ("gate_r4", 0.862, 0.828, 5.8),
             ("gate_r5", 0.828, 0.800, 7.0))
    for (key, sc_out, sc_in, dy) in rings:
        av, af = arch_band_data(gw * sc_out, gh * sc_out, gw * sc_in, gh * sc_in,
                                0.45, seg=12)
        p.add(key, (av, af), (cx, gy + dy, z0 + 0.05))
    # large hot plate at the far end so the opening is filled with the gold end of
    # the ramp and the rims read as the orange edge
    avc, afc = arch_data(gw * 0.805, gh * 0.805, 0.6, seg=12)
    p.add("gate_core", (avc, afc), (cx, gy + 8.0, z0 + 0.05))
    # lit floor running into the passage, plus a dark reveal at the mouth
    for i in range(6):
        t = i / 5.0
        p.add("gate_floor", box_data(gw * (0.95 - 0.45 * t), 1.15, 0.10),
              (cx, gy + 2.4 + i * 1.15, z0 + 0.06 + t * 0.02))
    avr, afr = arch_band_data(gw + 2.2, gh + 1.6, gw, gh, 1.0, seg=12)
    p.add("wall_shade", (avr, afr), (cx, gy + 1.6, z0 + 0.05))
    # jamb piers so the mouth has a shadow line
    for sx in (-1, 1):
        p.add("wall_shade", box_data(1.1, 7.4, gh - 1.0),
              (cx + sx * (gw / 2.0 + 0.3), gy + 4.6, z0 + (gh - 1.0) / 2.0))
    # gate arch voussoir ring
    for i in range(11):
        a = math.pi * i / 10.0
        r = (gw + 2.6) / 2.0
        p.add("trim", box_data(1.3, 1.9, 1.0),
              (cx + math.cos(a) * r, gy - 1.1, z0 + gh - (gw / 2.0) + math.sin(a) * r))
    # banners either side of the gate
    banner(p, cx - 8.4, gy - 1.4, z0 + H - 1.5)
    banner(p, cx + 8.4, gy - 1.4, z0 + H - 1.5)
    # windows on the front face
    win_grid(p, cx - 15.6, cx - 12.6, z0 + 4.0, z0 + 17.0, gy - 0.35, 1, 3)
    win_grid(p, cx + 12.6, cx + 15.6, z0 + 4.0, z0 + 17.0, gy - 0.35, 1, 3)
    win_grid(p, cx - 16, cx + 16, z0 + 4, z0 + 18, cy + Dp / 2 + 0.35, 5, 3)

    # ---- central tower above the gate ----
    p.add("wall", box_data(15.0, 13.0, 16.0), (cx, cy + 1.0, z0 + H + 8.0))
    p.add("trim", box_data(15.6, 13.6, 0.8), (cx, cy + 1.0, z0 + H + 16.0))
    crenel(p, "wall", cx - 7.5, cx + 7.5, cy - 5.6, z0 + H + 16.4, 1.3, 2.5, 1.3)
    crenel(p, "wall", cx - 7.5, cx + 7.5, cy + 7.6, z0 + H + 16.4, 1.3, 2.5, 1.3)
    win_grid(p, cx - 6, cx + 6, z0 + H + 3, z0 + H + 14, cy - 5.6, 3, 2)
    tower(p, cx - 0.5, cy + 7.0, z0 + H + 16.0, 5.2, 15.0, "dome", 14, True, 6)
    tower(p, cx + 11.5, cy + 3.0, z0 + H + 6.0, 4.0, 13.0, "dome", 12, True, 5)
    tower(p, cx - 12.5, cy + 4.0, z0 + H + 2.0, 3.6, 10.0, "cone", 10, True, 4)

    # ---- corner / flanking towers ----
    tower(p, cx - W / 2 - 2.0, cy - Dp / 2 + 1.0, z0, 5.0, H + 4.0, "flat", 12, True, 5)
    tower(p, cx + W / 2 + 2.0, cy - Dp / 2 + 1.0, z0, 5.4, H + 7.0, "dome", 12, True, 5)
    tower(p, cx + W / 2 + 6.0, cy + 10.0, z0 - 4.0, 4.6, H + 2.0, "cone", 11, True, 4)
    tower(p, cx - W / 2 - 5.0, cy + 12.0, z0 - 6.0, 4.2, H + 3.0, "dome", 11, True, 4)

    # ---- curtain walls running out from the keep ----
    p.add("wall", box_data(22, 4.0, 13.0), (cx + 30, cy - 12, z0 - 4.0 + 6.5))
    crenel(p, "wall", cx + 19, cx + 41, cy - 14.1, z0 + 2.5, 1.5, 2.7, 1.3)
    win_grid(p, cx + 21, cx + 39, z0 - 1.0, z0 + 1.0, cy - 14.1, 4, 1)
    p.add("wall", box_data(4.0, 20, 12.0), (cx - 21, cy + 4, z0 - 6.0 + 6.0))
    crenel_y(p, "wall", cy - 6, cy + 14, cx - 23.1, z0, 1.5, 2.7, 1.3)
    p.bake(c=C_CITADEL)


def grand_stair():
    """Broad flight from the plaza terrace up to the gate platform."""
    p = Parts("GrandStair")
    x0, y0, z0 = 15.0, 12.0, PLAZA_Z
    x1, y1, z1 = KEEP_C[0], KEEP_C[1] - 30.0, GATE_PLAT_Z
    n = 34
    for i in range(n):
        t = i / float(n)
        t2 = (i + 1) / float(n)
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t
        z = z0 + (z1 - z0) * t
        w = 18.0 - 4.2 * t
        p.add("pave" if i % 2 else "trim", box_data(w, (y1 - y0) / n + 0.25,
              (z1 - z0) / n + 0.35), (x, y, z))
        if i % 6 == 0:
            for sx in (-1, 1):
                p.add("stone", box_data(1.5, 1.5, 2.6), (x + sx * (w / 2 + 0.7), y, z + 1.3))
    # cheek walls
    for sx in (-1, 1):
        for i in range(n):
            t = i / float(n)
            x = x0 + (x1 - x0) * t
            y = y0 + (y1 - y0) * t
            z = z0 + (z1 - z0) * t
            w = 18.0 - 4.2 * t
            p.add("wall_shade", box_data(1.1, (y1 - y0) / n + 0.3, 1.6),
                  (x + sx * (w / 2 + 0.45), y, z + 0.5))
    # landing
    p.add("pave", box_data(16, 6, 1.0), (x0 + (x1 - x0) * 0.5, y0 + (y1 - y0) * 0.5,
                                         z0 + (z1 - z0) * 0.5 + 0.2))
    p.bake(c=C_CITADEL)


def plaza():
    p = Parts("Plaza")
    cx, cy = PLAZA_C
    p.cyl("pave", PLAZA_R, PLAZA_R, 0.8, (cx, cy, PLAZA_Z - 0.8), 56)
    for r, key in ((PLAZA_R * 0.92, "pave_line"), (PLAZA_R * 0.62, "pave_line"),
                   (PLAZA_R * 0.40, "pave_line"), (PLAZA_R * 0.24, "pave_line")):
        p.add(key, ring_data(r - 0.42, r, 0.14, 56), (cx, cy, PLAZA_Z - 0.02))
    p.add("stone", ring_data(PLAZA_R, PLAZA_R + 1.1, 1.6, 56), (cx, cy, PLAZA_Z - 1.4))
    # retaining wall down to the quay, with stairs
    p.add("wall_shade", box_data(52, 2.2, PLAZA_Z + 3.0), (cx - 2, cy - 20.5, PLAZA_Z / 2 - 1.4))
    for i in range(7):
        p.add("stone", box_data(9.0, 0.9, 0.62), (cx - 12, cy - 20.0 - i * 0.9,
                                                  PLAZA_Z - 0.31 - i * 0.62))
    # statue: wide low drum, slim robed figure, lantern at its foot
    s = Parts("Statue")
    s.cyl("marble", 4.6, 4.4, 0.50, (0, 0, 0), 24)
    s.cyl("pave", 3.7, 3.5, 0.45, (0, 0, 0.50), 24)
    s.add("marble", box_data(2.7, 2.7, 0.55), (0, 0, 1.22))
    s.add("marble", box_data(2.05, 2.05, 3.10, taper=0.90), (0, 0, 3.05))
    s.add("trim", box_data(2.45, 2.45, 0.40), (0, 0, 4.80))
    s.add("marble", box_data(1.05, 0.80, 1.75, taper=0.74), (0, 0, 5.90))
    s.add("marble", box_data(0.88, 0.66, 1.05, taper=0.94), (0, 0, 7.25))
    s.add("marble", box_data(0.36, 0.32, 0.62), (0, -0.04, 8.00))
    s.add("marble", box_data(0.28, 0.28, 0.30), (0, 0, 8.42))
    s.add("marble", box_data(0.22, 0.22, 1.45), (0.46, -0.14, 7.10))
    s.add("marble", box_data(0.22, 0.22, 1.30), (-0.46, -0.12, 7.05))
    s.add("marble", box_data(0.14, 0.14, 3.20), (0.66, -0.26, 7.20))
    s.add("marble", box_data(1.25, 0.22, 0.28), (0, -0.26, 6.55))
    s.bake(c=C_CITADEL, loc=(cx, cy + 1.0, PLAZA_Z))
    p.bake(c=C_CITADEL)


def old_city():
    """Terraced white town with blue domes on the west hillside."""
    p = Parts("OldCity")
    lots = []
    for i in range(104):
        t = rnd.random()
        x = -104 + rnd.random() * 78
        y = 52 + rnd.random() * 112
        base = -1.0 + (y - 52) * 0.17 + (x + 104) * 0.06 + rnd.random() * 3.0
        w = 5.0 + rnd.random() * 7.0
        d = 5.0 + rnd.random() * 7.0
        h = 5.0 + rnd.random() * 9.0
        lots.append((x, y, base, w, d, h, t))
    for (x, y, base, w, d, h, t) in lots:
        key = "wall" if t > 0.25 else "wall_warm"
        p.add(key, box_data(w, d, h), (x, y, base + h / 2.0))
        p.add("trim", box_data(w * 1.05, d * 1.05, 0.45), (x, y, base + h))
        nx = max(1, int(w / 2.6))
        for i in range(nx):
            for k in range(max(1, int(h / 3.4))):
                wk = "win_warm" if rnd.random() > 0.45 else ("win_pink" if rnd.random() > 0.35
                                                             else "win_gold")
                p.add(wk, box_data(0.85, 0.24, 1.5),
                      (x - w / 2 + w * (i + 0.5) / nx, y - d / 2 - 0.12,
                       base + 1.9 + k * 3.4))
                p.add(wk, box_data(0.24, 0.85, 1.5),
                      (x + w / 2 + 0.12, y - d / 2 + d * (i + 0.5) / nx, base + 1.9 + k * 3.4))
        r = rnd.random()
        if r > 0.55:
            p.dome("roof_blue", min(w, d) * 0.52, min(w, d) * 0.44, (x, y, base + h + 0.45), 10, 3)
        elif r > 0.32:
            p.add("roof_blue", box_data(w * 1.06, d * 1.06, 0.9, taper=0.55),
                  (x, y, base + h + 0.9))
        else:
            p.add("pave", box_data(w * 0.9, d * 0.9, 0.3), (x, y, base + h + 0.6))
    # hillside temple silhouette (top-left landmark)
    tx, ty, tb = -74.0, 142.0, 30.0
    p.add("wall", box_data(20, 16, 16), (tx, ty, tb + 8))
    p.add("trim", box_data(21, 17, 0.8), (tx, ty, tb + 16))
    win_grid(p, tx - 8, tx + 8, tb + 3, tb + 14, ty - 8.1, 4, 2, key="win_gold")
    p.dome("wall", 8.4, 9.0, (tx, ty, tb + 16.4), 14, 5)
    p.cyl("wall", 2.0, 1.8, 3.0, (tx, ty, tb + 25.4), 10)
    p.dome("roof_blue", 2.4, 2.4, (tx, ty, tb + 28.4), 10, 3)
    for sx in (-1, 1):
        p.cyl("wall", 2.6, 2.4, 22.0, (tx + sx * 12.5, ty - 5.0, tb), 10)
        p.dome("roof_blue", 2.9, 3.0, (tx + sx * 12.5, ty - 5.0, tb + 22.0), 10, 3)
    # arched aqueduct bridge over the inlet
    bx0, bx1, by, bz = -58.0, -14.0, 40.0, 6.0
    p.add("stone", box_data(bx1 - bx0, 4.4, 2.2), ((bx0 + bx1) / 2, by, bz + 7.0))
    p.add("trim", box_data(bx1 - bx0, 5.0, 0.5), ((bx0 + bx1) / 2, by, bz + 8.3))
    for i in range(5):
        x = bx0 + (bx1 - bx0) * (i + 0.5) / 5.0
        av, af = arch_data(6.4, 6.4, 4.0, seg=9)
        p.add("stone", (av, af), (x, by, bz - 2.0))
        p.add("rock_dark", box_data(5.2, 4.2, 9.0), (x, by, bz - 2.0 + 1.0))
    p.bake(c=C_CITY)


def east_terrace():
    p = Parts("EastTerrace")
    # white houses with blue roofs stepping up to the right
    for i in range(13):
        x = 42 + rnd.random() * 46
        y = -34 + rnd.random() * 64
        base = 2.0 + max(0.0, (x - 42)) * 0.22 + rnd.random() * 3.0
        w = 7 + rnd.random() * 8
        d = 6 + rnd.random() * 8
        h = 5 + rnd.random() * 8
        p.add("wall", box_data(w, d, h), (x, y, base + h / 2))
        p.add("trim", box_data(w * 1.05, d * 1.05, 0.4), (x, y, base + h))
        p.add("roof_blue", box_data(w * 1.1, d * 1.1, 1.0, taper=0.5), (x, y, base + h + 0.9))
        win_grid(p, x - w / 2 + 1, x + w / 2 - 1, base + 2, base + h - 1,
                 y - d / 2 - 0.12, max(1, int(w / 3.4)), max(1, int(h / 3.6)))
    # long stair climbing the right cliff
    for i in range(26):
        p.add("stone" if i % 2 else "pave", box_data(6.0, 1.3, 0.9),
              (66 + i * 0.9, -6 + i * 1.35, 4.0 + i * 0.92))
    # low wall + gateposts on the terrace edge
    p.add("wall_shade", box_data(2.0, 64, 4.0), (39, 0, 2.0))
    crenel_y(p, "wall", -32, 32, 39, 4.0, 1.4, 3.0, 1.0)
    p.bake(c=C_EAST)


def trojan_horse():
    p = Parts("TrojanHorse")
    # wheeled platform
    p.add("wood_dark", box_data(9.2, 5.0, 0.7), (0, 0, 0.75))
    for i in range(7):
        p.add("wood", box_data(9.3, 0.42, 0.75), (0, -2.2 + i * 0.73, 0.76))
    for sx in (-1, 1):
        for sy in (-1, 1):
            wv, wf = cyl_data(1.15, 1.15, 0.45, 12)
            wv = [(x, z, y) for (x, y, z) in wv]
            p.add("wood", (wv, wf), (sx * 3.4, sy * 2.35, 1.15))
            p.add("wood_dark", box_data(0.34, 0.5, 0.34), (sx * 3.4, sy * 2.35, 1.15))
    # body
    p.add("wood", box_data(6.6, 3.0, 3.4, taper=0.92), (0, 0, 3.9))
    for i in range(9):
        p.add("wood_dark", box_data(6.7, 0.14, 3.45), (0, -1.5 + i * 0.375, 3.9))
    for i in range(6):
        p.add("wood_light", box_data(0.22, 3.1, 3.5), (-3.0 + i * 1.2, 0, 3.9))
    # legs
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.add("wood", box_data(0.85, 0.85, 2.2), (sx * 2.5, sy * 1.0, 2.5))
    # neck + head
    p.add("wood", box_data(1.7, 1.6, 3.4, taper=0.8), (2.6, 0, 6.8))
    p.add("wood", box_data(2.6, 1.4, 1.5), (3.5, 0, 8.6))
    p.add("wood_dark", box_data(1.0, 1.0, 0.6), (4.6, 0, 8.3))
    for sy in (-1, 1):
        p.add("wood_light", cone_data(0.28, 0.8, 4), (3.0, sy * 0.5, 9.3))
    # mane + tail
    for i in range(7):
        p.add("wood_dark", box_data(0.5, 0.9, 0.6), (1.6 + i * 0.24, 0, 8.0 + i * 0.16))
    p.tube("wood_dark", [(-3.3, 0, 4.8), (-4.2, 0, 4.0), (-4.6, 0, 2.9)], 0.28, 5)
    p.bake(c=C_EAST, loc=(49.0, -6.0, 2.6), rot=(0, 0, math.radians(-152)),
           scale=(2.15, 2.15, 2.15))


def banner_pole(name, h=9.0, w=2.2, bl=5.6, c=None):
    p = Parts(name)
    p.add("stone", box_data(1.5, 1.5, 0.7), (0, 0, 0.35))
    p.add("wood_dark", ([(x, y, z) for (x, y, z) in cyl_data(0.16, 0.13, h, 8)[0]],
                        cyl_data(0.16, 0.13, h, 8)[1]), (0, 0, 0.6))
    p.add("bronze", cone_data(0.22, 0.6, 6), (0, 0, h + 0.6))
    p.add("wood_dark", box_data(w * 1.2, 0.12, 0.14), (w * 0.45, 0, h + 0.35))
    top = h + 0.2
    p.add("banner", box_data(w, 0.1, bl), (w * 0.45 + 0.1, 0, top - bl / 2.0))
    for sx in (-1, 1):
        p.add("banner", box_data(w * 0.42, 0.1, 0.8),
              (w * 0.45 + 0.1 + sx * w * 0.27, 0, top - bl - 0.4))
    zc = top - bl * 0.45
    cxb = w * 0.45 + 0.1
    p.add("banner_mark", box_data(0.16, 0.06, 2.2), (cxb, -0.06, zc))
    p.add("banner_mark", box_data(1.15, 0.06, 0.16), (cxb, -0.06, zc + 0.72))
    for sx in (-1, 1):
        p.add("banner_mark", box_data(0.14, 0.06, 1.05), (cxb + sx * 0.5, -0.06, zc + 1.25))
        p.add("banner_mark", cone_data(0.13, 0.36, 4), (cxb + sx * 0.5, -0.06, zc + 1.78))
    p.add("banner_mark", cone_data(0.14, 0.4, 4), (cxb, -0.06, zc + 1.78))
    return p.bake_single(c=c)


def foreground_terrace():
    """Fills the near terrace the way the target does: faced block walls, steps,
    quarter-guard buildings, banner poles, stacked stores."""
    p = Parts("Foreground")
    # stepped block wall running across the very front, in courses
    for i in range(26):
        x = -14 + i * 2.45
        for k in range(3):
            p.add("wall" if (i + k) % 2 else "wall_warm",
                  box_data(2.4, 3.6, 1.5), (x, -56.0 + k * 0.9, PLAZA_Z - 1.6 + k * 1.5))
    # broad flight from the quay up onto the plaza terrace
    for i in range(9):
        p.add("pave" if i % 2 else "stone", box_data(13.0, 1.25, 0.62),
              (-4.0, -44.0 + i * 1.25, PLAZA_Z - 0.3 - i * 0.62))
    for sx in (-1, 1):
        p.add("wall_shade", box_data(1.4, 11.5, 3.4), (-4.0 + sx * 7.2, -38.6, PLAZA_Z - 2.4))
    # two low guard blocks with blue roofs closing the right foreground
    for (x, y, w, d, h) in ((26.0, -34.0, 13.0, 10.0, 6.5), (34.0, -14.0, 11.0, 12.0, 5.5),
                            (16.0, -46.0, 12.0, 9.0, 5.0)):
        p.add("wall", box_data(w, d, h), (x, y, PLAZA_Z + h / 2.0))
        p.add("trim", box_data(w * 1.05, d * 1.05, 0.45), (x, y, PLAZA_Z + h))
        p.add("roof_blue", box_data(w * 1.12, d * 1.12, 1.1, taper=0.45),
              (x, y, PLAZA_Z + h + 1.0))
        win_grid(p, x - w / 2 + 1.4, x + w / 2 - 1.4, PLAZA_Z + 1.6, PLAZA_Z + h - 1.0,
                 y - d / 2 - 0.12, max(2, int(w / 3.6)), max(1, int(h / 3.6)))
        p.add("roof_deep", box_data(w * 0.55, 2.2, 0.16), (x, y - d / 2 - 1.1, PLAZA_Z + 3.4))
        for sx in (-1, 1):
            p.add("wood", box_data(0.16, 0.16, 3.3),
                  (x + sx * w * 0.26, y - d / 2 - 2.0, PLAZA_Z + 1.65))
    # colonnade wall along the plaza's east edge
    for i in range(9):
        y = -26.0 + i * 5.2
        p.add("wall", box_data(2.2, 5.1, 7.0), (33.0, y, PLAZA_Z + 3.5))
        av, af = arch_data(3.0, 4.2, 2.4, seg=7)
        p.add("wall_shade", (av, af), (33.0, y, PLAZA_Z + 0.2))
    p.bake(c=C_EAST)

    bp = banner_pole("BannerPole_src", 9.0, 2.2, 5.6, c=C_HIDDEN)
    spots = [(-2.0, -22.0, PLAZA_Z, 0.10), (24.0, -20.0, PLAZA_Z, -0.25),
             (2.0, 8.0, PLAZA_Z, 0.15), (22.0, 10.0, PLAZA_Z, -0.15),
             (20.0, 22.0, PLAZA_Z + 2.0, -0.2), (8.0, 24.0, PLAZA_Z + 3.5, 0.2),
             (-9.0, -40.0, QUAY_Z, 0.3), (30.0, -40.0, PLAZA_Z, -0.3)]
    for (x, y, z, rz) in spots:
        clone(bp, "BannerPole", (x, y, z), (0, 0, rz), c=C_PROPS)


def harbor():
    p = Parts("Harbor")
    # main quay face along the waterline, with block courses
    for i in range(28):
        y = -70 + i * 4.8
        x = -14 - 0.075 * (y + 70)
        p.add("stone" if i % 2 else "wall_shade", box_data(3.0, 4.9, 3.4), (x + 1.4, y, -1.6))
        p.add("pave", box_data(3.4, 4.9, 0.4), (x + 1.4, y, 0.1))
    # stairs down to the water at two points
    for (sy, sx0) in ((-30.0, -13.0), (18.0, -16.6)):
        for i in range(7):
            p.add("stone", box_data(3.6, 1.0, 0.55),
                  (sx0 - 0.55 * i, sy + i * 0.0, -0.28 - i * 0.55))
    # loading platform + low walls
    p.add("pave", box_data(26, 30, 0.5), (-2, -30, -0.25))
    p.add("wall_shade", box_data(1.6, 30, 3.0), (11.5, -30, 1.0))
    p.add("wall_shade", box_data(26, 1.6, 3.0), (-2, -45.5, 1.0))
    p.bake(c=C_HARBOR)

    # piers -------------------------------------------------------------------
    pr = A.pier("Pier_src", 17.0, 3.6, QUAY_Z, WATER_Z, c=C_HIDDEN)
    for (x, y, rz) in ((-22.0, -46.0, math.radians(-14)), (-27.0, -10.0, math.radians(-10)),
                       (-34.0, 26.0, math.radians(-8))):
        clone(pr, "Pier", (x, y, 0), (0, 0, rz), c=C_HARBOR)
    # far-shore jetties
    jt = A.pier("Jetty_src", 11.0, 2.8, WATER_Z + 2.4, WATER_Z, c=C_HIDDEN)
    for (x, y, rz) in ((-86.0, 36.0, math.radians(78)), (-96.0, 8.0, math.radians(72)),
                       (-104.0, 58.0, math.radians(84))):
        clone(jt, "Jetty", (x, y, 0), (0, 0, rz), c=C_HARBOR)

    # props -------------------------------------------------------------------
    cr = A.crate("Crate_src", 1.0, c=C_HIDDEN)
    br = A.barrel("Barrel_src", c=C_HIDDEN)
    bo = A.bollard("Bollard_src", c=C_HIDDEN)
    st = A.awning_stall("Stall_src", c=C_HIDDEN)
    for i in range(26):
        x = -13 + rnd.random() * 22
        y = -52 + rnd.random() * 44
        clone(cr, "Crate", (x, y, 0.0), (0, 0, rnd.random() * 3),
              (0.7 + rnd.random() * 0.7,) * 3, c=C_PROPS)
    for i in range(10):
        clone(br, "Barrel", (-11 + rnd.random() * 18, -50 + rnd.random() * 40, 0),
              (0, 0, rnd.random() * 3), c=C_PROPS)
    for i in range(9):
        y = -56 + i * 9.0
        clone(bo, "Bollard", (-12.6 - 0.075 * (y + 70), y, 0.1), c=C_PROPS)
    for (x, y, rz) in ((-6.0, -18.0, 0.1), (1.5, -24.0, -0.2), (-7.5, -30.0, 0.05),
                       (5.0, -36.0, 0.25)):
        clone(st, "Stall", (x, y, 0.0), (0, 0, rz), c=C_PROPS)
    # crates on the east terrace too
    for i in range(8):
        clone(cr, "CrateE", (41 + rnd.random() * 26, -26 + rnd.random() * 46,
                             2.0 + rnd.random() * 3.0), (0, 0, rnd.random() * 3),
              (0.8,) * 3, c=C_PROPS)


def ships():
    g = A.galley("Galley_A", 21.0, True, c=C_SHIPS)
    g.location = (-24.5, -40.0, WATER_Z + 1.35)
    g.rotation_euler = (0, 0, math.radians(-12))
    g2 = clone(g, "Galley_B", (-33.0, -6.0, WATER_Z + 1.35), (0, 0, math.radians(-6)),
               c=C_SHIPS)
    g3 = clone(g, "Galley_C", (-44.0, 30.0, WATER_Z + 1.35), (0, 0, math.radians(8)),
               (0.92, 0.92, 0.92), c=C_SHIPS)
    fb = A.fisher_boat("Boat_src", 7.0, c=C_HIDDEN)
    for i in range(9):
        x = -110 + rnd.random() * 70
        y = -10 + rnd.random() * 80
        clone(fb, "Boat", (x, y, WATER_Z + 0.55), (0, 0, rnd.random() * TAU),
              (0.8 + rnd.random() * 0.5,) * 3, c=C_SHIPS)
    # gangplank from the near galley up to the quay
    p = Parts("Gangplank")
    p.add("wood_light", box_data(1.8, 9.5, 0.22), (0, 0, 0))
    for i in range(8):
        p.add("wood_dark", box_data(1.9, 0.16, 0.28), (0, -4.0 + i * 1.15, 0.06))
    p.bake(c=C_HARBOR, loc=(-19.0, -42.0, -0.55), rot=(math.radians(9), 0, math.radians(74)))


def water_reflections():
    """The target's long gold streaks on the water.

    EEVEE screen-space reflections cannot see the lamps that light the quay (they are
    point lights, and much of what they lit is off-screen), so the reflections are
    built as geometry: flat emissive cards lying on the water, each stretched from the
    source towards the camera and broken into segments that widen and dim with
    distance — which is how a real glitter path behaves.
    """
    p = Parts("WaterReflections")
    zr = WATER_Z + 0.22
    cxp, cyp = CAM_POS[0], CAM_POS[1]

    def waterline(y):
        return -14.0 - 0.075 * (y + 70.0)

    def streak(sx, sy, length, width, keys, segs=16, jitter=0.55, seed=0):
        r = random.Random(seed)
        dx, dy = cxp - sx, cyp - sy
        d = math.hypot(dx, dy) or 1.0
        dx, dy = dx / d, dy / d
        # the camera sits almost on the shoreline, so a pure view-ward streak would
        # run along the quay; bias it out over the open water where it is visible
        dx, dy = dx - 0.62, dy
        d = math.hypot(dx, dy) or 1.0
        dx, dy = dx / d, dy / d
        px, py = -dy, dx                       # lateral axis
        ang = math.atan2(dy, dx) - math.pi / 2.0
        for i in range(segs):
            t = (i + 0.5) / segs
            # a glitter path is narrow at the source and flares towards the viewer
            wj = width * (0.10 + 0.62 * t ** 1.1) * (0.30 + 0.65 * r.random())
            ln = (length / segs) * (0.70 + 1.60 * r.random())
            off = (r.random() - 0.5) * jitter * width * (0.4 + t)
            x = sx + dx * (length * t) + px * off
            y = sy + dy * (length * t) + py * off
            k = keys[min(len(keys) - 1, int(t * len(keys) * 0.999))]
            if r.random() < 0.22:              # broken water, not a solid ribbon
                continue
            if x > waterline(y) - 1.2:         # never lay a card on the quay
                continue
            v, f = box_data(wj, ln, 0.03)
            ca, sa = math.cos(ang), math.sin(ang)
            v = [(vx * ca - vy * sa, vx * sa + vy * ca, vz) for (vx, vy, vz) in v]
            p.add(k, (v, f), (x, y, zr))

    hot = ("refl_hot", "refl_hot", "refl_mid", "refl_mid", "refl_dim")
    mid = ("refl_mid", "refl_mid", "refl_dim", "refl_dim")
    far = ("refl_far", "refl_far", "refl_far")

    # quay lamps and the warm pools along the waterfront
    for i, (sx, sy, ln, wd) in enumerate(
            ((-15.0, -50.0, 30.0, 2.6), (-15.8, -38.0, 26.0, 2.2),
             (-16.6, -28.0, 30.0, 2.8), (-17.8, -16.0, 24.0, 2.2),
             (-19.2, -4.0, 27.0, 2.4), (-21.0, 10.0, 22.0, 2.0),
             (-23.5, 24.0, 20.0, 1.8), (-14.2, -60.0, 26.0, 2.4))):
        streak(sx, sy, ln, wd, hot, 18, 0.6, 11 + i)
    # the galleys' own lanterns and hull glow
    for i, (sx, sy, ln, wd) in enumerate(
            ((-24.5, -40.0, 34.0, 1.05), (-33.0, -6.0, 32.0, 0.95),
             (-44.0, 30.0, 28.0, 0.85), (-28.0, -52.0, 30.0, 0.90))):
        streak(sx, sy, ln, wd, mid, 34, 1.1, 41 + i)
    # far shore: the old city and the bridge, as broad soft patches
    for i, (sx, sy, ln, wd) in enumerate(
            ((-56.0, 44.0, 34.0, 3.0), (-72.0, 60.0, 32.0, 3.4),
             (-90.0, 40.0, 30.0, 2.8), (-40.0, 40.0, 30.0, 2.6),
             (-104.0, 62.0, 28.0, 3.0), (-64.0, 30.0, 30.0, 2.6))):
        streak(sx, sy, ln, wd, far, 20, 1.1, 61 + i)
    # a cool skylight sheen so the water is not only gold
    for i, (sx, sy, ln, wd) in enumerate(
            ((-62.0, -20.0, 44.0, 3.6), (-86.0, 6.0, 40.0, 3.4),
             (-46.0, -56.0, 38.0, 3.0), (-70.0, -38.0, 40.0, 3.2))):
        streak(sx, sy, ln, wd, ("refl_cool",) * 3, 22, 1.2, 81 + i)
    p.bake(c=C_HARBOR)
    STATS["reflection_cards"] = sum(len(v[1]) for v in p.buf.values())


# ============================================================== troops ========
def troops():
    spear = A.soldier("Sol_BlueSpear", "plume_blue", "armor_blue", "spear", c=C_HIDDEN)
    arch = A.soldier("Sol_BlueBow", "plume_blue", "armor_blue", "bow", c=C_HIDDEN)
    red = A.soldier("Sol_RedSpear", "plume_red", "armor_dark", "spear", c=C_HIDDEN)
    redb = A.soldier("Sol_RedBow", "plume_red", "armor_dark", "bow", c=C_HIDDEN)
    n = 0

    def put(src, x, y, z, face=0.0, s=1.0):
        nonlocal_n = clone(src, "Troop", (x, y, z), (0, 0, face),
                           (s * 1.18, s * 1.18, s * 1.18), c=C_TROOPS)
        return nonlocal_n

    # --- assault column climbing the grand stair ---
    x0, y0, z0 = 15.0, 12.0, PLAZA_Z
    x1, y1, z1 = KEEP_C[0], KEEP_C[1] - 30.0, GATE_PLAT_Z
    for i in range(15):
        t = 0.03 + i * 0.062
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t
        z = z0 + (z1 - z0) * t + 0.4
        w = 18.0 - 4.2 * t
        for k in range(3):
            put(spear, x - w / 2 + w * (0.22 + 0.28 * k) + rnd.random() * 0.3,
                y + rnd.random() * 0.5, z, math.radians(2 + rnd.random() * 8))
            n += 1
    # --- massed block on the plaza, facing the stair ---
    for r in range(7):
        for cc in range(9):
            put(spear, -3.5 + cc * 1.75 + (r % 2) * 0.5, -15.5 + r * 1.85, PLAZA_Z,
                math.radians(-4 + rnd.random() * 8))
            n += 1
    # --- archer ring around the statue ---
    for i in range(10):
        a = TAU * i / 10.0 - 0.4
        put(arch, PLAZA_C[0] + math.cos(a) * 7.4, PLAZA_C[1] + 1.0 + math.sin(a) * 7.4,
            PLAZA_Z, a + math.pi / 2.0)
        n += 1
    # --- quayside / boarding party ---
    for i in range(11):
        put(spear, -12 + rnd.random() * 12, -52 + rnd.random() * 26, QUAY_Z,
            rnd.random() * TAU)
        n += 1
    for i in range(7):                              # aboard the near galley
        put(spear, -26.0 + rnd.random() * 3.0, -46 + i * 1.7, WATER_Z + 2.1,
            math.radians(80))
        n += 1
    # --- red defenders on the battlements ---
    cx, cy = KEEP_C
    W, Dp, H = 34.0, 22.0, 21.0
    for i in range(9):
        put(red if i % 2 else redb, cx - W / 2 + 2 + i * (W - 4) / 8.0, cy - Dp / 2 + 0.6,
            GATE_PLAT_Z + H + 0.6, math.radians(180), 1.22)
        n += 1
    for i in range(5):
        put(redb, cx - 7 + i * 3.4, cy - 5.0, GATE_PLAT_Z + H + 17.0, math.radians(180), 1.22)
        n += 1
    for i in range(7):                              # on the forecourt, holding the gate
        put(red, cx - 9 + i * 3.0, cy - 20.0, GATE_PLAT_Z, math.radians(180), 1.22)
        n += 1
    for i in range(4):                              # on the east curtain wall
        put(redb, cx + 22 + i * 4.5, cy - 14.5, GATE_PLAT_Z + 2.6, math.radians(190), 1.22)
        n += 1
    # --- hero + fox in the foreground ---
    h = A.hero("Hero", c=C_TROOPS)
    h.location = (4.0, -17.5, PLAZA_Z)
    h.rotation_euler = (0, 0, math.radians(20))
    h.scale = (1.06, 1.06, 1.06)
    f = A.fox("Fox", c=C_TROOPS)
    f.location = (6.2, -18.6, PLAZA_Z)
    f.rotation_euler = (0, 0, math.radians(45))
    STATS["troops"] = n + 1


def vegetation():
    cy = A.cypress("Cypress_src", 7.5, c=C_HIDDEN)
    pn = A.pine("Pine_src", 10.0, c=C_HIDDEN)
    bs = A.bush("Bush_src", 1.2, c=C_HIDDEN)
    spots = []
    for i in range(30):                             # around the plaza + terraces
        a = TAU * rnd.random()
        r = PLAZA_R + 2.5 + rnd.random() * 9
        spots.append((PLAZA_C[0] + math.cos(a) * r, PLAZA_C[1] + math.sin(a) * r, PLAZA_Z))
    for i in range(22):
        spots.append((40 + rnd.random() * 50, -34 + rnd.random() * 70,
                      2.5 + rnd.random() * 8))
    for i in range(20):
        spots.append((-6 + rnd.random() * 56, 26 + rnd.random() * 56,
                      6 + rnd.random() * 16))
    for (x, y, z) in spots:
        s = 0.75 + rnd.random() * 0.7
        clone(cy, "Cypress", (x, y, z), (0, 0, rnd.random() * TAU), (s, s, s), c=C_PROPS)
    for i in range(26):
        x = -104 + rnd.random() * 92
        y = 40 + rnd.random() * 130
        z = -1 + max(0.0, (y - 52)) * 0.16 + rnd.random() * 3
        s = 0.8 + rnd.random() * 0.8
        clone(pn, "Pine", (x, y, z), (0, 0, rnd.random() * TAU), (s, s, s), c=C_PROPS)
    for i in range(34):
        x = -10 + rnd.random() * 80
        y = -40 + rnd.random() * 90
        z = PLAZA_Z if (x < 36 and y < 14) else 2.5
        clone(bs, "Bush", (x, y, z), (0, 0, rnd.random() * TAU),
              (0.7 + rnd.random() * 0.8,) * 3, c=C_PROPS)


# ============================================================== lighting ======
def add_light(name, kind, loc, energy, color, size=1.0, spot=None, shadow=True):
    d = bpy.data.lights.new(name, kind)
    d.energy = energy
    d.color = color
    try:
        d.shadow_soft_size = size
    except Exception:
        pass
    d.use_shadow = shadow
    if kind == 'SPOT' and spot:
        d.spot_size = spot[0]
        d.spot_blend = spot[1]
    o = bpy.data.objects.new(name, d)
    o.location = loc
    C_LIGHT.objects.link(o)
    return o


def lighting():
    w = bpy.context.scene.world
    w.use_nodes = True
    nt = w.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    mr = nt.nodes.new("ShaderNodeMapRange")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    mr.inputs['From Min'].default_value = -0.16
    mr.inputs['From Max'].default_value = 0.62
    nt.links.new(geo.outputs['Incoming'], sep.inputs['Vector'])
    nt.links.new(sep.outputs['Z'], mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'], ramp.inputs['Fac'])
    cr = ramp.color_ramp
    cr.elements[0].position = 0.0
    cr.elements[0].color = (0.310, 0.520, 0.660, 1)      # bright horizon haze
    cr.elements[1].position = 1.0
    cr.elements[1].color = (0.020, 0.062, 0.245, 1)      # deep zenith blue
    e1 = cr.elements.new(0.22)
    e1.color = (0.215, 0.430, 0.650, 1)
    e2 = cr.elements.new(0.52)
    e2.color = (0.070, 0.190, 0.450, 1)
    nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 0.62
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    # NOTE: a world Volume Scatter absorbs the EEVEE background to black here,
    # so aerial perspective is done with ridge colour/value instead.

    # cool key from the upper left-back (dusk), plus a cold fill
    sun = add_light("KeyMoon", 'SUN', (-70, 120, 90), 0.62, (0.66, 0.79, 1.0), 0.08)
    sun.rotation_euler = (math.radians(58), 0, math.radians(214))
    fill = add_light("FillSky", 'SUN', (60, -80, 70), 0.20, (0.48, 0.66, 1.0), 0.2)
    fill.rotation_euler = (math.radians(52), 0, math.radians(28))

    cx, cy = KEEP_C
    # gate furnace
    add_light("GateDeep", 'POINT', (cx, cy - 6.0, GATE_PLAT_Z + 5.0), 7000, (1.0, 0.62, 0.28), 2.2)
    add_light("GateMouth", 'POINT', (cx, cy - 12.2, GATE_PLAT_Z + 5.0), 5200, (1.0, 0.46, 0.16), 2.2)
    add_light("GateFace", 'POINT', (cx, cy - 15.5, GATE_PLAT_Z + 9.0), 3000, (1.0, 0.52, 0.22), 3.4)
    add_light("GateSpill", 'POINT', (cx, cy - 22.0, GATE_PLAT_Z + 3.0), 2100, (1.0, 0.52, 0.20), 4.0)
    # keep facade wash
    add_light("KeepWash", 'POINT', (cx, cy - 34.0, GATE_PLAT_Z + 16.0), 7600, (1.0, 0.76, 0.48), 6.0)
    add_light("TowerTop", 'POINT', (cx, cy + 6.0, GATE_PLAT_Z + 46.0), 2600, (1.0, 0.78, 0.52), 4.0)
    # plaza
    add_light("StatueUp", 'SPOT', (PLAZA_C[0], PLAZA_C[1] - 3.0, PLAZA_Z + 0.6), 2600,
              (1.0, 0.80, 0.52), 0.6, (math.radians(58), 0.5)).rotation_euler = (math.radians(180), 0, 0)
    add_light("PlazaGlow", 'POINT', (PLAZA_C[0], PLAZA_C[1] + 2.0, PLAZA_Z + 3.0), 4400,
              (1.0, 0.78, 0.48), 6.0)
    # harbour warm pools
    for (x, y) in ((-10, -46), (-4, -26), (2, -8), (-20, -40), (-26, -6), (-33, 26)):
        add_light("Harbor", 'POINT', (x, y, 4.2), 2000, (1.0, 0.68, 0.32), 0.8)
    # old-city ambient warmth (cheap stand-in for thousands of windows)
    for (x, y, z) in ((-80, 90, 18), (-52, 66, 10), (-96, 130, 30), (-40, 120, 24),
                      (-68, 150, 34)):
        add_light("CityGlow", 'POINT', (x, y, z), 11000, (1.0, 0.66, 0.40), 16.0, shadow=False)
    add_light("HorseKey", 'POINT', (42.0, -13.0, 11.0), 3800, (1.0, 0.66, 0.30), 2.4)
    add_light("HorseRim", 'POINT', (54.0, -2.0, 12.0), 1700, (0.70, 0.82, 1.0), 3.0,
              shadow=False)
    add_light("EastGlow", 'POINT', (62, 6, 10), 4200, (1.0, 0.70, 0.38), 8.0, shadow=False)
    add_light("WaterBounce", 'POINT', (-38, -18, 3.0), 900, (0.35, 0.62, 0.95), 1.0,
              shadow=False)
    # low warm sources right above the waterline throw the gold streaks the target has
    q = Parts("QuayGlow")
    for i in range(16):
        yy = -62.0 + i * 6.4
        xx = -14.2 - 0.075 * (yy + 70)
        q.add("quay_lamp", box_data(0.18, 0.70, 0.42), (xx - 1.06, yy, 1.35))
        q.add("armor_dark", box_data(0.26, 0.86, 0.14), (xx - 1.06, yy, 1.63))
    q.bake(c=C_HARBOR)
    for (x, y, e) in ((-16.5, -50.0, 2600), (-17.5, -30.0, 2600), (-19.5, -8.0, 2400),
                      (-23.0, 16.0, 2200), (-28.0, 40.0, 1800), (-14.0, -62.0, 2200)):
        add_light("WaterWarm", 'POINT', (x, y, 1.6), int(e * 0.45), (1.0, 0.60, 0.24),
                  0.25, shadow=False)

    # practical lamp posts (mesh + light) --------------------------------------
    lp = A.lamp_post("Lamp_src", 4.2, c=C_HIDDEN)
    tr = A.torch("Torch_src", 2.1, c=C_HIDDEN)
    lamp_spots = [(-11.5, -48.0, 0.0), (-9.0, -33.0, 0.0), (-5.0, -18.0, 0.0),
                  (2.0, -40.0, 0.0), (8.0, -28.0, 0.0),
                  (PLAZA_C[0] - 13.0, PLAZA_C[1] - 6.0, PLAZA_Z),
                  (PLAZA_C[0] + 12.0, PLAZA_C[1] - 8.0, PLAZA_Z),
                  (PLAZA_C[0] - 8.0, PLAZA_C[1] + 12.0, PLAZA_Z),
                  (41.0, -18.0, 2.6), (43.0, 14.0, 3.2)]
    for i, (x, y, z) in enumerate(lamp_spots):
        clone(lp, "Lamp", (x, y, z), c=C_PROPS)
        add_light("LampL%d" % i, 'POINT', (x, y, z + 4.9), 950, (1.0, 0.70, 0.34), 0.22)
    torch_spots = [(KEEP_C[0] - 14.0, KEEP_C[1] - 29.0, GATE_PLAT_Z),
                   (KEEP_C[0] + 14.0, KEEP_C[1] - 29.0, GATE_PLAT_Z),
                   (18.0, 16.0, PLAZA_Z + 1.0), (10.0, 18.0, PLAZA_Z + 1.4),
                   (24.0, 26.0, PLAZA_Z + 6.0), (28.0, 34.0, PLAZA_Z + 10.0),
                   (PLAZA_C[0] - 5.0, PLAZA_C[1] - 12.0, PLAZA_Z),
                   (PLAZA_C[0] + 6.0, PLAZA_C[1] - 12.0, PLAZA_Z)]
    for i, (x, y, z) in enumerate(torch_spots):
        clone(tr, "Torch", (x, y, z), c=C_PROPS)
        add_light("TorchL%d" % i, 'POINT', (x, y, z + 2.4), 520, (1.0, 0.50, 0.18), 0.18)
    STATS["lights"] = len([o for o in C_LIGHT.objects])


def aircraft():
    """Two Moebius-style scouts in the sky, as in the target."""
    p = Parts("Scout")
    p.add("hull_metal", box_data(1.6, 7.0, 1.5, taper=0.45), (0, 0, 0))
    p.add("hull_metal", box_data(9.0, 1.9, 0.36, taper=0.7), (0, -0.4, -0.15))
    p.add("roof_blue", box_data(1.2, 1.6, 0.9), (0, 1.9, 0.55))
    p.add("hull_metal", box_data(0.30, 1.8, 1.7, taper=0.5), (0, -3.1, 0.8))
    for sx in (-1, 1):
        p.add("roof_blue", box_data(1.0, 2.0, 0.8), (sx * 2.6, -0.6, 0.1))
    src = p.bake_single(c=C_HIDDEN)
    clone(src, "Scout_A", (64, 108, 104), (math.radians(4), math.radians(-9), math.radians(196)),
          (1.5, 1.5, 1.5), c=C_PROPS)
    clone(src, "Scout_B", (104, 142, 88), (math.radians(3), math.radians(-6), math.radians(203)),
          (1.25, 1.25, 1.25), c=C_PROPS)


# ============================================================== camera ========
def camera():
    cd = bpy.data.cameras.new("Cam")
    cd.lens = 27.0
    cd.sensor_width = 36.0
    cd.clip_start = 0.5
    cd.clip_end = 4000.0
    cam = bpy.data.objects.new("Cam", cd)
    cam.location = (-14.0, -99.0, 50.0)
    bpy.context.scene.collection.objects.link(cam)
    tgt = bpy.data.objects.new("CamTarget", None)
    tgt.location = (11.0, 26.0, 21.0)
    bpy.context.scene.collection.objects.link(tgt)
    con = cam.constraints.new('TRACK_TO')
    con.target = tgt
    con.track_axis = 'TRACK_NEGATIVE_Z'
    con.up_axis = 'UP_Y'
    bpy.context.scene.camera = cam
    return cam


def set_harbor_camera(cam, tgt):
    cam.location = (-58.0, -66.0, 22.0)
    cam.data.lens = 35.0
    tgt.location = (-14.0, -18.0, 5.0)


def render_settings(quick=False):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x = 1280 if quick else 1920
    sc.render.resolution_y = 720 if quick else 1080
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'
    ev = sc.eevee
    for k, v in (("taa_render_samples", 16 if quick else 96),
                 ("use_raytracing", True), ("use_shadows", True),
                 ("use_volumetric_lights", True), ("volumetric_end", 600.0),
                 ("volumetric_samples", 32 if quick else 64),
                 ("shadow_ray_count", 2), ("shadow_step_count", 6),
                 ("clamp_surface_indirect", 8.0)):
        try:
            setattr(ev, k, v)
        except Exception:
            pass
    try:
        sc.view_settings.view_transform = 'AgX'
        sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception:
        try:
            sc.view_settings.view_transform = 'Filmic'
        except Exception:
            pass
    sc.view_settings.exposure = 0.10
    # Blender 5.2's compositor node-group path returned a blank frame here, so the
    # render stays straight out of EEVEE; glow comes from emission + AgX instead.
    sc.render.use_compositing = False
    STATS["composite"] = "off"


# ================================================================== main ======
def main():
    terrain()
    citadel()
    grand_stair()
    plaza()
    old_city()
    east_terrace()
    trojan_horse()
    harbor()
    foreground_terrace()
    ships()
    water_reflections()
    troops()
    vegetation()
    aircraft()
    lighting()
    cam = camera()
    render_settings(QUICK)

    # keep the instancing source objects out of the render
    try:
        bpy.context.scene.collection.children.unlink(C_HIDDEN)
    except Exception:
        pass
    for o in C_HIDDEN.objects:
        o.hide_render = True

    tris = 0
    for o in bpy.data.objects:
        if o.type == 'MESH' and not o.hide_render:
            tris += sum(len(pp.vertices) - 2 for pp in o.data.polygons)
    STATS["objects"] = len([o for o in bpy.data.objects if o.type == 'MESH'])
    STATS["tris"] = tris
    STATS["meshes"] = len(bpy.data.meshes)
    STATS["build_sec"] = round(time.time() - T0, 1)

    blend = os.path.join(BASE, "citadel-battle-v1.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    STATS["blend"] = blend

    tag = "quick" if QUICK else "full"
    out = os.path.join(BASE, "render-%s.png" % tag)
    bpy.context.scene.render.filepath = out
    t1 = time.time()
    bpy.ops.render.render(write_still=True)
    STATS["render_sec"] = round(time.time() - t1, 1)
    STATS["render"] = out
    if "--export" in ARGS:
        glb = os.path.join(BASE, "citadel-battle-v1.glb")
        try:
            for o in C_HIDDEN.objects:
                o.hide_viewport = True
            bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB',
                                      use_visible=True, export_apply=True,
                                      export_cameras=False, export_lights=False)
            STATS["glb"] = glb
            STATS["glb_bytes"] = os.path.getsize(glb)
        except Exception as ex:
            STATS["glb"] = "failed: %s" % ex
    if "--extra-views" in ARGS:
        tgt = bpy.data.objects["CamTarget"]
        set_harbor_camera(bpy.context.scene.camera, tgt)
        bpy.context.scene.render.filepath = os.path.join(BASE, "render-harbor.png")
        bpy.ops.render.render(write_still=True)
        STATS["render_harbor"] = os.path.join(BASE, "render-harbor.png")
    json.dump(STATS, open(os.path.join(BASE, "build-report-%s.json" % tag), "w"), indent=1)
    print("CITADEL_BUILD_OK", json.dumps(STATS))


main()
