# Contact sheet of the scouting frames: python tools/film/sheet.py out.jpg
import sys, glob, os
from PIL import Image, ImageDraw
files = sorted(glob.glob('film-out/scout/*.jpg'))
tiles = []
for f in files:
    n = int(os.path.basename(f)[:-4]); r, k = n // 10, n % 10
    im = Image.open(f).convert('RGB').resize((480, 270))
    ImageDraw.Draw(im).text((6, 4), f"route {r} f={k/10:.1f}", fill=(255, 255, 0))
    tiles.append((r, k, im))
rows = sorted(set(t[0] for t in tiles))
sheet = Image.new('RGB', (5 * 480, len(rows) * 270))
for r, k, im in tiles: sheet.paste(im, (([1, 3, 5, 7, 9].index(k)) * 480, rows.index(r) * 270))
sheet.save(sys.argv[1], quality=82)
