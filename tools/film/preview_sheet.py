# python tools/film/preview_sheet.py  -> film-out/preview-A.jpg, preview-B.jpg
import glob, os, json
from PIL import Image, ImageDraw
tl = json.load(open('film-out/timeline.json'))['shots']
def sheet(shots, out):
    W, H = 400, 225
    img = Image.new('RGB', (3 * W, len(shots) * H), (10, 10, 10))
    for r, s in enumerate(shots):
        files = sorted(glob.glob(f"film-out/preview/{s['index']:02d}-*.jpg"), key=lambda f: int(f.split('-')[-1][:-4]))
        for c, f in enumerate(files[:3]):
            im = Image.open(f).convert('RGB').resize((W, H))
            ImageDraw.Draw(im).text((6, 4), f"{s['index']} {s['id']} [{s['weather']}]", fill=(255, 255, 0))
            img.paste(im, (c * W, r * H))
    img.save(out, quality=82)
sheet(tl[:9], 'film-out/preview-A.jpg'); sheet(tl[9:], 'film-out/preview-B.jpg')
