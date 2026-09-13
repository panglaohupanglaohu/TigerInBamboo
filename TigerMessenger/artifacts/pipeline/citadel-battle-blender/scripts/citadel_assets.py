"""Reusable assets for the citadel battle replica: soldiers, ships, harbour props,
building modules, vegetation. Every builder returns one object whose mesh data can be
shared by linked copies (see lib.clone)."""
import math, random
from mathutils import Vector
from citadel_lib import (Parts, mat, obj, mesh, clone, box_data, cyl_data, cone_data,
                         dome_data, prism_data, arch_data, tube_pts, TAU)

# ================================================================= figures ====
def soldier(name, plume="plume_blue", armor="armor_blue", weapon="spear",
            cape=None, c=None):
    """~1.78 m toy-scale infantryman. +Y is facing direction."""
    p = Parts(name)
    # legs
    for sx in (-0.135, 0.135):
        p.add(armor, box_data(0.20, 0.24, 0.80, taper=0.92), (sx, 0, 0.40))
        p.add("wood_dark", box_data(0.22, 0.34, 0.11), (sx, 0.03, 0.055))
    # tunic / skirt
    p.add(armor, box_data(0.60, 0.40, 0.26, taper=1.10), (0, 0, 0.86))
    # cuirass
    p.add(armor, box_data(0.56, 0.36, 0.56, taper=0.95), (0, 0, 1.24))
    p.add("bronze", box_data(0.58, 0.38, 0.07), (0, 0, 1.50))
    # arms
    p.add(armor, box_data(0.15, 0.15, 0.58, taper=0.9), (-0.345, 0.02, 1.20))
    p.add(armor, box_data(0.15, 0.15, 0.58, taper=0.9), (0.345, 0.02, 1.20))
    p.add("skin", box_data(0.14, 0.14, 0.12), (-0.345, 0.02, 0.86))
    p.add("skin", box_data(0.14, 0.14, 0.12), (0.345, 0.02, 0.86))
    # neck + head
    p.add("skin", box_data(0.16, 0.16, 0.10), (0, 0, 1.57))
    p.add("skin", box_data(0.30, 0.30, 0.30), (0, 0, 1.76))
    # helmet: bowl + neck guard + cheek pieces + crest
    p.add(armor, dome_data(0.185, 0.20, 10, 3), (0, 0, 1.80))
    p.add(armor, box_data(0.34, 0.10, 0.16), (0, -0.14, 1.80))
    for sx in (-0.16, 0.16):
        p.add(armor, box_data(0.05, 0.22, 0.20), (sx, 0.02, 1.76))
    for i in range(7):
        t = i / 6.0
        p.add(plume, box_data(0.075, 0.075, 0.15 + 0.10 * math.sin(t * math.pi)),
              (0, 0.16 - 0.30 * t, 2.01 + 0.05 * math.sin(t * math.pi)))
    if cape:
        p.add(cape, box_data(0.56, 0.06, 0.95, taper=1.25), (0, -0.21, 1.10))
    # shield (round, left arm)
    if weapon in ("spear", "sword"):
        sv, sf = cyl_data(0.40, 0.40, 0.09, 14)
        sv = [(x, z, y) for (x, y, z) in sv]           # lay it upright, facing +Y
        p.add(armor, (sv, sf), (-0.46, 0.16, 1.18))
        bv, bf = cyl_data(0.10, 0.10, 0.05, 8)
        bv = [(x, z, y) for (x, y, z) in bv]
        p.add("bronze", (bv, bf), (-0.46, 0.235, 1.18))
    if weapon == "spear":
        p.add("wood", ([(x, y, z) for (x, y, z) in cyl_data(0.035, 0.035, 2.65, 6)[0]],
                       cyl_data(0.035, 0.035, 2.65, 6)[1]), (0.40, 0.10, 0.05))
        p.add("bronze", cone_data(0.075, 0.34, 6), (0.40, 0.10, 2.70))
    elif weapon == "bow":
        arc = [(0.42, 0.10, 0.55 + 0.16 * i + 0.0) for i in range(0)]
        pts = []
        for i in range(7):
            t = i / 6.0
            ang = math.pi * (t - 0.5) * 0.86
            pts.append((0.42 + 0.20 * math.cos(ang) - 0.20, 0.16 + 0.16 * math.sin(ang) * 0,
                        0.78 + 1.05 * (t - 0.5) + 0.0))
        pts = [(0.42 + 0.22 * math.cos(math.pi * (t / 6.0 - 0.5) * 0.9) - 0.22, 0.14,
                1.28 + 1.15 * (t / 6.0 - 0.5)) for t in range(7)]
        p.tube("wood", pts, 0.035, 4)
        p.tube("rope", [pts[0], pts[-1]], 0.012, 3)
        p.add("wood", ([(x, y, z) for (x, y, z) in cyl_data(0.018, 0.018, 0.80, 5)[0]],
                       cyl_data(0.018, 0.018, 0.80, 5)[1]), (0.10, 0.14, 1.05))
        p.add("wood_dark", box_data(0.16, 0.16, 0.42), (-0.34, -0.16, 1.35))
    elif weapon == "sword":
        p.add("bronze", box_data(0.07, 0.05, 0.80), (0.40, 0.06, 1.35))
        p.add("wood_dark", box_data(0.10, 0.08, 0.16), (0.40, 0.06, 0.92))
    return p.bake_single(c=c)


def hero(name, c=None):
    o = soldier(name, plume="plume_blue", armor="armor_dark", weapon="sword",
                cape="cloak_red", c=c)
    return o


def fox(name, c=None):
    p = Parts(name)
    p.add("fox", box_data(0.26, 0.62, 0.28, taper=0.9), (0, 0, 0.40))
    p.add("fox", box_data(0.22, 0.24, 0.22), (0, 0.38, 0.50))
    p.add("fox", cone_data(0.09, 0.16, 5), (0, 0.44, 0.60))
    for sx in (-0.09, 0.09):
        p.add("fox", cone_data(0.05, 0.13, 4), (sx, 0.36, 0.60))
    for sx in (-0.09, 0.09):
        for sy in (-0.20, 0.22):
            p.add("wood_dark", box_data(0.07, 0.07, 0.28), (sx, sy, 0.14))
    p.tube("fox", [(0, -0.30, 0.42), (0, -0.52, 0.50), (0, -0.68, 0.64)], 0.09, 5)
    return p.bake_single(c=c)


# =================================================================== ships ====
def galley(name, length=21.0, sail=True, c=None):
    """Mediterranean war galley: curved hull, oar banks, shield rail, square sail."""
    p = Parts(name)
    L = length
    half = L / 2.0
    secs = []                                   # (y, halfwidth, keel_z, rail_z)
    for i in range(13):
        t = i / 12.0
        y = -half + L * t
        taper = math.sin(math.pi * min(1.0, max(0.0, (t * 1.06 - 0.03)))) ** 0.55
        hw = 0.35 + 1.55 * taper
        keel = -1.35 + 1.25 * (1 - taper) ** 1.6
        rail = 0.55 + 0.55 * (1 - taper) ** 2.2
        secs.append((y, hw, keel, rail))
    v, f = [], []
    for (y, hw, keel, rail) in secs:
        v += [(-hw, y, rail), (-hw * 0.82, y, keel + 0.30), (0.0, y, keel),
              (hw * 0.82, y, keel + 0.30), (hw, y, rail)]
    n = 5
    for i in range(len(secs) - 1):
        for k in range(n - 1):
            a = i * n + k
            f.append((a, a + 1, a + n + 1, a + n))
    f.append((0, 1, 2, 3, 4))
    a = (len(secs) - 1) * n
    f.append((a + 4, a + 3, a + 2, a + 1, a))
    p.add("wood", (v, f))
    # deck
    p.add("wood_light", box_data(2.5, L * 0.84, 0.16), (0, 0, 0.62))
    for i in range(9):
        p.add("wood_dark", box_data(2.6, 0.10, 0.19), (0, -L * 0.38 + i * L * 0.095, 0.63))
    # stem post curling up at the bow, and a straight stern post
    bow = [(0, half - 0.2, 1.0), (0, half + 0.35, 1.9), (0, half + 0.30, 2.9),
           (0, half - 0.25, 3.4), (0, half - 0.85, 3.2)]
    p.tube("wood", bow, 0.16, 6)
    p.tube("wood", [(0, -half + 0.2, 0.9), (0, -half - 0.25, 1.9), (0, -half - 0.1, 2.6)], 0.15, 6)
    # gunwale rail + shields
    for sx in (-1.0, 1.0):
        p.add("wood_dark", box_data(0.18, L * 0.80, 0.30), (sx * 1.62, 0, 1.16))
    nsh = 8
    for i in range(nsh):
        y = -L * 0.33 + i * (L * 0.66 / (nsh - 1))
        for sx in (-1, 1):
            sv, sf = cyl_data(0.44, 0.44, 0.10, 12)
            sv = [(z, y0, x) for (x, y0, z) in sv]
            p.add("armor_blue", (sv, sf), (sx * 1.76, y, 1.22))
            bv, bf = cyl_data(0.11, 0.11, 0.05, 6)
            bv = [(z, y0, x) for (x, y0, z) in bv]
            p.add("bronze", (bv, bf), (sx * 1.84, y, 1.22))
    # oars
    for i in range(8):
        y = -L * 0.30 + i * (L * 0.60 / 7.0)
        for sx in (-1, 1):
            p.tube("wood_light", [(sx * 1.5, y, 1.05), (sx * 3.5, y - 0.35, 0.15),
                                  (sx * 4.6, y - 0.55, -0.35)], 0.075, 4)
            p.add("wood_light", box_data(0.10, 0.75, 0.30), (sx * 4.85, y - 0.62, -0.45))
    if sail:
        p.add("wood", ([(x, y, z) for (x, y, z) in cyl_data(0.16, 0.12, 7.4, 8)[0]],
                       cyl_data(0.16, 0.12, 7.4, 8)[1]), (0, 0.6, 0.70))
        p.add("wood", ([(y, x, z) for (x, y, z) in cyl_data(0.10, 0.10, 6.2, 6)[0]],
                       cyl_data(0.10, 0.10, 6.2, 6)[1]), (-3.1, 0.6, 7.0))
        for i in range(5):                       # gently bellied square sail
            x0 = -3.0 + i * 1.5
            bulge = 0.35 * math.sin(math.pi * (i / 4.0))
            p.add("sail", box_data(1.52, 0.10, 4.6), (x0, 0.6 + bulge, 4.55))
        p.tube("rope", [(-3.1, 0.6, 7.0), (0, -9.0, 1.4)], 0.035, 3)
        p.tube("rope", [(3.1, 0.6, 7.0), (0, -9.0, 1.4)], 0.035, 3)
        p.tube("rope", [(0, 0.6, 8.1), (0, half - 0.5, 3.2)], 0.035, 3)
    return p.bake_single(c=c)


def fisher_boat(name, length=7.0, c=None):
    p = Parts(name)
    L, half = length, length / 2.0
    secs = []
    for i in range(7):
        t = i / 6.0
        y = -half + L * t
        taper = math.sin(math.pi * min(1.0, max(0.0, t))) ** 0.6
        secs.append((y, 0.22 + 0.78 * taper, -0.62 + 0.50 * (1 - taper) ** 1.6,
                     0.34 + 0.26 * (1 - taper) ** 2))
    v, f = [], []
    for (y, hw, keel, rail) in secs:
        v += [(-hw, y, rail), (0, y, keel), (hw, y, rail)]
    for i in range(len(secs) - 1):
        for k in range(2):
            a = i * 3 + k
            f.append((a, a + 1, a + 4, a + 3))
    p.add("wood", (v, f))
    p.add("wood_light", box_data(1.2, L * 0.6, 0.10), (0, 0, 0.30))
    p.tube("wood", [(0, half - 0.1, 0.4), (0, half + 0.2, 1.1)], 0.09, 5)
    return p.bake_single(c=c)


# ================================================================= harbour ====
def lamp_post(name, h=4.2, c=None):
    p = Parts(name)
    p.add("stone", box_data(0.46, 0.46, 0.26), (0, 0, 0.13))
    p.add("armor_dark", ([(x, y, z) for (x, y, z) in cyl_data(0.10, 0.075, h, 8)[0]],
                         cyl_data(0.10, 0.075, h, 8)[1]), (0, 0, 0.22))
    p.add("armor_dark", box_data(0.44, 0.44, 0.10), (0, 0, h + 0.30))
    p.add("lamp_glow", box_data(0.34, 0.34, 0.46, taper=0.8), (0, 0, h + 0.58))
    p.add("armor_dark", cone_data(0.30, 0.28, 6), (0, 0, h + 0.82))
    return p.bake_single(c=c)


def torch(name, h=2.1, c=None):
    p = Parts(name)
    p.add("wood_dark", ([(x, y, z) for (x, y, z) in cyl_data(0.07, 0.06, h, 6)[0]],
                        cyl_data(0.07, 0.06, h, 6)[1]), (0, 0, 0))
    p.add("armor_dark", ([(x, y, z) for (x, y, z) in cyl_data(0.22, 0.26, 0.34, 8)[0]],
                         cyl_data(0.22, 0.26, 0.34, 8)[1]), (0, 0, h - 0.05))
    p.add("torch", cone_data(0.21, 0.62, 7), (0, 0, h + 0.22))
    return p.bake_single(c=c)


def crate(name, s=0.9, c=None):
    p = Parts(name)
    p.add("wood", box_data(s, s, s * 0.92), (0, 0, s * 0.46))
    for sx in (-1, 1):
        p.add("wood_dark", box_data(0.07, s * 1.02, s * 0.96), (sx * s * 0.47, 0, s * 0.46))
    p.add("wood_dark", box_data(s * 1.02, 0.07, s * 0.96), (0, -s * 0.47, s * 0.46))
    p.add("wood_light", box_data(s * 1.04, s * 1.04, 0.07), (0, 0, s * 0.92))
    return p.bake_single(c=c)


def barrel(name, r=0.42, h=1.05, c=None):
    p = Parts(name)
    p.add("wood", ([(x, y, z) for (x, y, z) in cyl_data(r * 0.86, r, h * 0.5, 10)[0]],
                   cyl_data(r * 0.86, r, h * 0.5, 10)[1]), (0, 0, 0))
    p.add("wood", ([(x, y, z) for (x, y, z) in cyl_data(r, r * 0.86, h * 0.5, 10)[0]],
                   cyl_data(r, r * 0.86, h * 0.5, 10)[1]), (0, 0, h * 0.5))
    for z in (h * 0.28, h * 0.72):
        p.add("wood_dark", ([(x, y, zz) for (x, y, zz) in cyl_data(r * 1.02, r * 1.02, 0.08, 10)[0]],
                            cyl_data(r * 1.02, r * 1.02, 0.08, 10)[1]), (0, 0, z))
    return p.bake_single(c=c)


def awning_stall(name, w=3.6, d=2.6, c=None):
    p = Parts(name)
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.add("wood", box_data(0.14, 0.14, 2.5), (sx * w / 2.2, sy * d / 2.2, 1.25))
    for i in range(4):                             # scalloped blue canopy
        p.add("roof_blue", box_data(w / 4.0 + 0.04, d * 1.05, 0.10),
              (-w / 2.0 + w / 8.0 + i * w / 4.0, 0, 2.62 + 0.10 * math.sin(i * 1.4)))
    p.add("roof_deep", box_data(w * 1.02, 0.16, 0.26), (0, -d / 2.0 * 1.02, 2.50))
    p.add("wood_light", box_data(w * 0.86, d * 0.5, 0.12), (0, 0.2, 1.05))
    return p.bake_single(c=c)


def bollard(name, c=None):
    p = Parts(name)
    p.add("stone", ([(x, y, z) for (x, y, z) in cyl_data(0.22, 0.18, 0.62, 8)[0]],
                    cyl_data(0.22, 0.18, 0.62, 8)[1]), (0, 0, 0))
    p.add("stone", dome_data(0.24, 0.16, 8, 3), (0, 0, 0.62))
    return p.bake_single(c=c)


def pier(name, length=16.0, width=3.4, deck_z=0.0, water_z=-3.2, c=None):
    p = Parts(name)
    p.add("wood_light", box_data(width, length, 0.26), (0, 0, deck_z - 0.13))
    for i in range(12):
        p.add("wood", box_data(width * 1.02, 0.16, 0.30),
              (0, -length / 2.0 + 0.6 + i * (length - 1.2) / 11.0, deck_z - 0.02))
    npile = max(2, int(length / 3.2))
    for i in range(npile):
        y = -length / 2.0 + 1.0 + i * (length - 2.0) / max(1, npile - 1)
        for sx in (-1, 1):
            hp = deck_z - water_z + 1.4
            p.add("wood_dark", ([(x, yy, z) for (x, yy, z) in cyl_data(0.20, 0.17, hp, 7)[0]],
                                cyl_data(0.20, 0.17, hp, 7)[1]),
                  (sx * (width / 2.0 - 0.3), y, water_z - 1.1))
        p.add("wood", box_data(width * 1.05, 0.16, 0.16), (0, y, deck_z - 0.34))
    return p.bake_single(c=c)


# ============================================================== vegetation ====
def cypress(name, h=7.0, c=None):
    p = Parts(name)
    p.add("wood_dark", ([(x, y, z) for (x, y, z) in cyl_data(0.14, 0.10, h * 0.22, 6)[0]],
                        cyl_data(0.14, 0.10, h * 0.22, 6)[1]), (0, 0, 0))
    layers = 5
    for i in range(layers):
        t = i / float(layers - 1)
        r = 0.92 * (1.0 - 0.62 * t)
        p.add("tree_dark" if i % 2 == 0 else "tree_mid",
              cone_data(r, h * 0.30, 7), (0, 0, h * (0.16 + 0.17 * i)))
    return p.bake_single(c=c)


def pine(name, h=9.0, c=None):
    p = Parts(name)
    p.add("wood_dark", ([(x, y, z) for (x, y, z) in cyl_data(0.26, 0.18, h * 0.55, 6)[0]],
                        cyl_data(0.26, 0.18, h * 0.55, 6)[1]), (0, 0, 0))
    rnd = random.Random(7)
    for i in range(7):
        a = TAU * i / 7.0
        rr = 1.5 + rnd.random() * 0.9
        p.add("tree_mid" if i % 2 else "foliage", dome_data(rr, rr * 0.62, 8, 3),
              (math.cos(a) * 1.7, math.sin(a) * 1.7, h * (0.52 + 0.10 * rnd.random())))
    p.add("foliage", dome_data(2.1, 1.3, 9, 3), (0, 0, h * 0.66))
    return p.bake_single(c=c)


def bush(name, r=1.0, c=None):
    p = Parts(name)
    p.add("tree_mid", dome_data(r, r * 0.8, 7, 3), (0, 0, 0))
    p.add("foliage", dome_data(r * 0.7, r * 0.6, 6, 3), (r * 0.4, r * 0.2, r * 0.2))
    return p.bake_single(c=c)
