"""Cut the film together: python tools/film/assemble.py [out.mp4]

48 fps frames are blended in pairs (a 180-degree shutter) and kept at 24; captions fade in and out in the
lower letterbox bar; a warm title card holds for three seconds; the score is laid under it all.
Requires: film-out/frames/*.jpg (render.mjs), film-out/timeline.json, film-out/score.wav (score.py).
"""
import json
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import imageio_ffmpeg

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else 'film-out/mufu-light-walk.mp4')
tl = json.load(open('film-out/timeline.json'))
shots = tl['shots']
FILM = sum(s['seconds'] for s in shots)
W, H = 1920, 1080
BAR_H = round(.115 * H)
work = Path('film-out/assemble'); work.mkdir(exist_ok=True)

F = lambda name, size: ImageFont.truetype(f'C:/Windows/Fonts/{name}', size)
ZH = {'first light': '晨光', 'sun in the leaves': '叶间日光', 'rain on the rainbow road': '彩虹路上的雨', 'the whole slope': '山坡全景', 'snow': '雪', 'evening glow': '燕矶夕照'}

# --- captions: one transparent PNG per labelled shot, faded by ffmpeg -----------------------------------
captions = []
for s in shots:
    if not s.get('label'): continue
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    en, zh = s['label'], ZH.get(s['label'], '')
    fe, fz = F('georgiai.ttf', 30), F('simkai.ttf', 30)
    ew = d.textlength(en, font=fe); zw = d.textlength(zh, font=fz) if zh else 0
    gap = 26 if zh else 0
    x0 = (W - (ew + gap + zw)) / 2; y = H - BAR_H / 2 - 20
    for glow, alpha in ((6, 40), (3, 70)):          # a soft warm glow behind the type
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ld = ImageDraw.Draw(layer)
        ld.text((x0, y), en, font=fe, fill=(255, 214, 150, alpha)); ld.text((x0 + ew + gap, y), zh, font=fz, fill=(255, 214, 150, alpha))
        im = Image.alpha_composite(im, layer.filter(ImageFilter.GaussianBlur(glow)))
    d = ImageDraw.Draw(im)
    d.text((x0, y), en, font=fe, fill=(255, 238, 205, 235)); d.text((x0 + ew + gap, y), zh, font=fz, fill=(255, 238, 205, 235))
    path = work / f"cap-{s['index']:02d}.png"; im.save(path)
    captions.append((path, s['start'] + .5, s['start'] + s['seconds'] - .45))

# --- title card ---------------------------------------------------------------------------------------------
title_dir = work / 'title'; title_dir.mkdir(exist_ok=True)
for f in title_dir.glob('*.png'): f.unlink()
frames = int(3.0 * 24)
base = Image.new('RGB', (W, H), (255, 246, 228))
px = base.load()
for yy in range(0, H, 2):                          # a warm gradient: gold at the foot, cream above
    t = yy / H
    c = (int(255 - 22 * t), int(246 - 38 * t), int(228 - 66 * t))
    ImageDraw.Draw(base).rectangle([0, yy, W, yy + 2], fill=c)
for i in range(frames):
    a = min(1, max(0, (i / 24 - .35) / 1.0)); a = a * a * (3 - 2 * a)
    im = base.copy(); d = ImageDraw.Draw(im)
    big, small, tiny = F('simkai.ttf', 150), F('georgia.ttf', 38), F('georgiai.ttf', 26)
    txt = '穆府山'; w = d.textlength(txt, font=big)
    col = lambda v: tuple(int(255 + (c - 255) * a) for c in v)       # ink fades up from the page colour
    d.text(((W - w) / 2, H / 2 - 170), txt, font=big, fill=(74, 56, 38))
    cover = Image.blend(im, base, 1 - a) if a < 1 else im                # fade the whole text layer, not just one colour
    im = cover; d = ImageDraw.Draw(im)
    sub = 'M U F U   M O U N T'; sw = d.textlength(sub, font=small)
    ImageDraw.Draw(im).text(((W - sw) / 2, H / 2 + 30), sub, font=small, fill=tuple(int(255 + (v - 255) * a) for v in (110, 86, 58)))
    tl_txt = 'a light walk'; tw = d.textlength(tl_txt, font=tiny)
    ImageDraw.Draw(im).text(((W - tw) / 2, H / 2 + 100), tl_txt, font=tiny, fill=tuple(int(255 + (v - 255) * a * .9) for v in (140, 112, 80)))
    ImageDraw.Draw(im).rectangle([0, 0, W, BAR_H], fill=(0, 0, 0)); ImageDraw.Draw(im).rectangle([0, H - BAR_H, W, H], fill=(0, 0, 0))
    im.save(title_dir / f'{i + 1:05d}.png')

# --- ffmpeg -------------------------------------------------------------------------------------------------------
cmd = [FFMPEG, '-y', '-hide_banner', '-loglevel', 'error', '-framerate', str(tl['fps']), '-i', 'film-out/frames/%05d.jpg',
       '-framerate', '24', '-i', str(title_dir / '%05d.png'), '-i', 'film-out/score.wav']
for path, a, b in captions: cmd += ['-loop', '1', '-t', f'{FILM + 1:.2f}', '-i', str(path)]
chain = [f"[0:v]tmix=frames=2:weights='1 1',select='eq(mod(n\\,2)\\,1)',setpts=N/(24*TB),fps=24,"
         "eq=contrast=1.04:saturation=1.1:gamma=0.98,unsharp=5:5:0.45:5:5:0.0,noise=alls=5:allf=t,format=yuv420p[v0]"]
last = 'v0'
for k, (path, a, b) in enumerate(captions):
    chain.append(f"[{3 + k}:v]format=rgba,fade=t=in:st={a:.2f}:d=0.45:alpha=1,fade=t=out:st={b - 0.45:.2f}:d=0.45:alpha=1[c{k}]")
    chain.append(f"[{last}][c{k}]overlay=shortest=0:eof_action=pass:enable='between(t,{a:.2f},{b:.2f})'[v{k + 1}]"); last = f'v{k + 1}'
chain.append(f"[{last}]format=yuv420p[main];[1:v]fps=24,format=yuv420p[title];[main][title]concat=n=2:v=1:a=0[v]")
cmd += ['-filter_complex', ';'.join(chain), '-map', '[v]', '-map', '2:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', '-shortest', str(OUT)]
print('ffmpeg ...')
r = subprocess.run(cmd, capture_output=True, text=True)
print(r.stderr[-2000:] or 'ok')
print(OUT, OUT.stat().st_size // 1024, 'KB' if OUT.exists() else 'MISSING')
