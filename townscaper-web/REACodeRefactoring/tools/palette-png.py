#!/usr/bin/env python3
# 第 56 批 C05：写 16x2 RGB8 Palette.png（=片中 "Doc: 96 bytes"）。用法: palette-png.py base|pale|half out.png  上行参考色，下行墙色槽。
import sys, zlib, struct
def write_png(path, w, h, rgb):  # rgb: list of (r,g,b) row-major
    raw = b''.join(b'\x00' + bytes([c for px in rgb[y*w:(y+1)*w] for c in px]) for y in range(h))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b''))
H = lambda s: tuple(int(s[i:i+2], 16) for i in (1, 3, 5))
town = ['#dd6a5f','#eec463','#85b780','#6f9dc6','#ac91c9','#e8a377','#c2ab8b','#ecdfc4','#8b9fa6','#cf5348','#dd9057','#d3b96b','#63a291','#9dbdd7','#cf9ab5','#c9a98c']
def pale(c, t=0.72): r,g,b = H(c); return tuple(round(v + (255 - v) * t) for v in (r, g, b))
mode, out = sys.argv[1], sys.argv[2]
top = [H(c) for c in town]
if mode == 'base': bot = [H(c) for c in town]
elif mode == 'pale': bot = [pale(c) for c in town]          # 片中 frame 340：下行全部涂浅
elif mode == 'half': bot = [pale(c) if i % 2 else H(c) for i, c in enumerate(town)]
write_png(out, 16, 2, top + bot)
