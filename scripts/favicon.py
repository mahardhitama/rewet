# Draws favicon.ico: a 16 px pixel-art peat tile with a canal and a sprout, stored at 16, 32 and 48 px.
# Run from the repo root: python3 scripts/favicon.py [out.ico] [preview.png]. Standard library only.
import struct, zlib, sys
N = 16
img = [[None]*N for _ in range(N)]
hexc = lambda h: tuple(int(h[i:i+2], 16) for i in (1, 3, 5))
TOP, TOP2, SIDE_L, SIDE_R, W1, W2, G1, G2, OUT = map(hexc, ['#7a5532', '#8d6540', '#4e3520', '#3b2817', '#3f97cf', '#8fd3f0', '#7cc95a', '#3f8a3a', '#1c140c'])
cx, cy, hw, hh = 7.5, 9.5, 8, 4
for y in range(N):
    for x in range(N):
        d = abs(x - cx) / hw + abs(y - cy) / hh
        if d <= 1:
            img[y][x] = TOP if (x + y) % 3 else TOP2
            if abs((x - cx) * .5 + (y - cy)) < .75: img[y][x] = W2 if x < cx else W1  # canal, down-left diagonal
        elif y > cy and y <= cy + hh + 2:  # sides, 2 px deep
            dd = abs(x - cx) / hw + abs(y - 2 - cy) / hh
            if dd <= 1 and y - 2 <= cy + hh: img[y][x] = SIDE_L if x < cx else SIDE_R
# sprout on the right half of the tile
for y in range(2, 8): img[y][10] = G2
for (x, y) in [(8,3),(9,3),(9,2),(8,4),(9,4),(11,2),(12,2),(12,1),(11,3),(12,3),(13,2)]: img[y][x] = G1
def scaled(s):
    return [[img[y // s][x // s] for x in range(N * s)] for y in range(N * s)]
def png(px):
    h, w = len(px), len(px[0])
    raw = b''.join(b'\0' + b''.join(bytes(c + (255,)) if c else b'\0\0\0\0' for c in row) for row in px)
    ch = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d))
    return b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw, 9)) + ch(b'IEND', b'')
imgs = [png(scaled(s)) for s in (1, 2, 3)]  # 16, 32, 48
hdr = struct.pack('<HHH', 0, 1, len(imgs)); off = 6 + 16 * len(imgs); ent = b''
for s, d in zip((16, 32, 48), imgs):
    ent += struct.pack('<BBBBHHII', s, s, 0, 0, 1, 32, len(d), off); off += len(d)
open(sys.argv[1] if len(sys.argv) > 1 else 'favicon.ico', 'wb').write(hdr + ent + b''.join(imgs))
if len(sys.argv) > 2: open(sys.argv[2], 'wb').write(png(scaled(16)))  # a 256 px preview
