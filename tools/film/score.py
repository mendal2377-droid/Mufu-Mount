"""Score and sound design for "Light Walk", synthesised from nothing.

    python tools/film/score.py            ->  film-out/score.wav

Bright, kind music: G major, 96 bpm, the I-V-vi-IV turn (G D Em C) four bars at a time, kalimba and
glockenspiel tones over a soft pad, a light pulse that builds through the montage, drops out for the snow
and comes back for the evening. Sound effects (a whoosh on every flash, rain and thunder, wind, birds,
water) are laid on the same clock as the cuts, read from film-out/timeline.json.
"""
import json
import wave
import numpy as np

SR = 44100
BPM = 96
BEAT = 60 / BPM
BAR = BEAT * 4
TAIL = 3.0                                   # the title card holds after the last shot
rng = np.random.default_rng(20261010)

timeline = json.load(open('film-out/timeline.json'))
assert timeline['bpm'] == BPM, 'the score and the storyboard must share a tempo'
shots = timeline['shots']
FILM = sum(s['seconds'] for s in shots)
N = int((FILM + TAIL) * SR)
t_all = np.arange(N) / SR

def hz(name):
    names = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
    n = names[name[0]]; octave = int(name[-1]); acc = name[1:-1]
    n += 1 if acc == '#' else -1 if acc == 'b' else 0
    return 440.0 * 2 ** ((n + 12 * (octave + 1) - 69) / 12)

# ---------------------------------------------------------------------------------------------------
class Bus:
    def __init__(self): self.l = np.zeros(N); self.r = np.zeros(N)
    def add(self, t0, sig, gain=1.0, pan=0.0):
        i = int(t0 * SR)
        if i >= N or i + len(sig) <= 0: return
        a = max(0, -i); b = min(len(sig), N - i)
        pl = np.cos((pan + 1) * np.pi / 4); pr = np.sin((pan + 1) * np.pi / 4)
        self.l[i + a:i + b] += sig[a:b] * gain * pl
        self.r[i + a:i + b] += sig[a:b] * gain * pr

def env_ar(n, attack, release, sr=SR):
    e = np.ones(n); a = max(1, int(attack * sr)); r = max(1, int(release * sr))
    e[:a] = np.linspace(0, 1, a) ** 1.5
    e[-r:] *= np.linspace(1, 0, r) ** 1.5 if r < n else 1
    return e

def lowpass(x, cutoff, order=1):
    """One-pole low-pass (repeated `order` times), via a recursive filter written in numpy-friendly chunks."""
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = x.copy()
    for _ in range(order):
        out = np.empty_like(y); s = 0.0
        for i in range(len(y)):          # python loop, but only used on short buffers
            s = (1 - a) * y[i] + a * s; out[i] = s
        y = out
    return y

def fft_filter(x, lo=None, hi=None):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(f)
    if lo: m *= 1 / (1 + (lo / np.maximum(f, 1e-3)) ** 4)
    if hi: m *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * m, len(x))

# ---------------------------------------------------------------------------------------------------
# Instruments
def kalimba(freq, dur=1.0, bright=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    index = 2.4 * bright * np.exp(-t * 11)
    y = np.sin(2 * np.pi * freq * t + index * np.sin(2 * np.pi * freq * 3.0 * t)) * np.exp(-t * 4.2)
    y += .25 * np.sin(2 * np.pi * freq * 5.4 * t) * np.exp(-t * 14)
    y *= np.minimum(1, t / .003)
    return y * .5

def glock(freq, dur=1.6):
    n = int(dur * SR); t = np.arange(n) / SR
    y = np.sin(2 * np.pi * freq * t) * np.exp(-t * 3.0) + .35 * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-t * 6) \
        + .2 * np.sin(2 * np.pi * freq * 5.4 * t) * np.exp(-t * 10) + .12 * np.sin(2 * np.pi * freq * 8.9 * t) * np.exp(-t * 16)
    return y * np.minimum(1, t / .002) * .45

def pad(freqs, dur, soft=1.0):
    n = int(dur * SR); t = np.arange(n) / SR; y = np.zeros(n)
    for f in freqs:
        for det in (-5, 0, 6):                                     # three voices, a few cents apart
            ff = f * 2 ** (det / 1200)
            for h in range(1, 8):
                y += np.sin(2 * np.pi * ff * h * t + h) / h ** (1.6 + .4 * (1 - soft))
    y *= env_ar(n, .9, 1.4) / (len(freqs) * 3)
    return y * .8

def bass(freq, dur=.6):
    n = int(dur * SR); t = np.arange(n) / SR
    y = np.sin(2 * np.pi * freq * t) + .3 * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t * 6)
    return y * np.exp(-t * 3.2) * np.minimum(1, t / .004) * .75

def pluck(freq, dur=.7):
    """A nylon-string pluck: harmonics that die at their own speeds, and a small pick click."""
    n = int(dur * SR); t = np.arange(n) / SR; y = np.zeros(n)
    for h in range(1, 9):
        y += np.sin(2 * np.pi * freq * h * t * (1 + .0004 * h * h)) / h ** 1.1 * np.exp(-t * (3.2 + 1.5 * h))
    click = fft_filter(rng.standard_normal(n), lo=1800, hi=7000) * np.exp(-t * 160) * .25
    return (y * .5 + click) * np.minimum(1, t / .002)

def strum(freqs, down=True, dur=.7):
    """Four strings struck a few milliseconds apart."""
    out = np.zeros(int(dur * SR) + int(.05 * SR)); order = freqs if down else freqs[::-1]
    for k, f in enumerate(order):
        p = pluck(f, dur); i = int(k * .011 * SR); out[i:i + len(p)] += p * (1 - .07 * k)
    return out * .45

def tambourine(accent=1.0):
    n = int(.16 * SR); t = np.arange(n) / SR
    y = fft_filter(rng.standard_normal(n), lo=5500, hi=13000) * np.exp(-t * 28)
    for f in (6900, 8300, 10100): y += .35 * np.sin(2 * np.pi * f * t) * np.exp(-t * 45)
    return y * .45 * accent

def flute(freq, dur=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    vib = 1 + .004 * np.sin(2 * np.pi * 5.4 * t) * np.minimum(1, t / .3)
    ph = 2 * np.pi * np.cumsum(freq * vib) / SR
    y = np.sin(ph) + .28 * np.sin(2 * ph) + .08 * np.sin(3 * ph)
    y += .06 * fft_filter(rng.standard_normal(n), lo=2000, hi=6000)       # breath
    return y * env_ar(n, .05, .18) * .35

def kick(dur=.35):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 46 + 90 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * .9

def noise_burst(dur, lo=None, hi=None, curve=8):
    n = int(dur * SR); x = rng.standard_normal(n)
    x = fft_filter(x, lo, hi) if (lo or hi) else x
    return x * np.exp(-np.arange(n) / SR * curve)

def clap():
    y = np.zeros(int(.25 * SR))
    for off in (0, .011, .022):
        b = noise_burst(.18, lo=900, hi=5200, curve=22); i = int(off * SR); y[i:i + len(b)] += b
    return y * .5

def hat(open_=False):
    return noise_burst(.12 if open_ else .045, lo=6500, curve=26 if not open_ else 12) * .32

def shaker():
    n = int(.1 * SR); t = np.arange(n) / SR
    return fft_filter(rng.standard_normal(n), lo=5000, hi=11000) * np.sin(np.pi * np.minimum(1, t / .1)) ** 2 * .6

def whoosh(dur=.5, up=True):
    n = int(dur * SR); x = rng.standard_normal(n); t = np.arange(n) / SR
    sweep = np.linspace(0, 1, n) if up else np.linspace(1, 0, n)
    # a band that sweeps: sum of a few narrow bands crossfaded
    out = np.zeros(n)
    for c, w in [(500, 1), (1400, 1), (3500, 1), (7000, 1)]:
        band = fft_filter(x, lo=c * .7, hi=c * 1.4)
        centre = (np.log(c) - np.log(400)) / (np.log(8000) - np.log(400))
        out += band * np.exp(-((sweep - centre) ** 2) / .06)
    return out * np.sin(np.pi * np.minimum(1, t / dur)) ** 1.2 * .55

def riser(dur):
    n = int(dur * SR); x = rng.standard_normal(n)
    y = fft_filter(x, lo=1200, hi=9000) * np.linspace(0, 1, n) ** 2.2
    return y * .3

def bird(kind, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    if kind == 0:   # a quick rising two-note chirp
        f = 3200 + 1600 * np.minimum(1, t / dur) + 280 * np.sin(2 * np.pi * 30 * t)
    elif kind == 1:  # a falling whistle
        f = 4200 - 1800 * np.minimum(1, t / dur) + 120 * np.sin(2 * np.pi * 18 * t)
    else:           # a trill
        f = 3600 + 700 * np.sin(2 * np.pi * 26 * t)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) + .2 * np.sin(2 * np.pi * np.cumsum(f * 2) / SR)
    return y * np.sin(np.pi * np.minimum(1, t / dur)) ** 2 * .18

def thunder(dur=3.2):
    n = int(dur * SR); t = np.arange(n) / SR
    x = fft_filter(rng.standard_normal(n), hi=260) * 5
    rumble = x * (np.exp(-t * 1.1) * (1 + .6 * np.sin(2 * np.pi * 3.1 * t)))
    crack = fft_filter(rng.standard_normal(n), lo=300, hi=3500) * np.exp(-t * 18) * 1.4
    return (rumble + crack) * .5

def rain_bed(dur, intensity=1.0):
    n = int(dur * SR); x = rng.standard_normal(n)
    hiss = fft_filter(x, lo=1500, hi=9000)
    drops = np.zeros(n)
    for _ in range(int(dur * 180 * intensity)):
        i = rng.integers(0, n - 800); drops[i:i + 800] += rng.standard_normal(800) * np.exp(-np.arange(800) / 90) * rng.uniform(.1, .5)
    return (hiss * .18 + fft_filter(drops, lo=2000) * .35) * intensity

def wind_bed(dur, level=1.0):
    n = int(dur * SR); x = rng.standard_normal(n)
    y = fft_filter(x, lo=120, hi=900)
    t = np.arange(n) / SR
    return y * (.5 + .5 * np.sin(2 * np.pi * .16 * t + 1.0)) ** 1.5 * level * .5

def water_bed(dur, level=1.0):
    n = int(dur * SR); x = rng.standard_normal(n); t = np.arange(n) / SR
    y = fft_filter(x, lo=200, hi=2200)
    return y * (.45 + .55 * np.sin(2 * np.pi * .21 * t) ** 2) * level * .35

# ---------------------------------------------------------------------------------------------------
# Structure. 20 bars; section gains for each layer, indexed by bar (0-based).
CHORDS = [('G', ['G3', 'B3', 'D4'], 'G2'), ('D', ['F#3', 'A3', 'D4'], 'D2'), ('Em', ['E3', 'G3', 'B3'], 'E2'), ('C', ['E3', 'G3', 'C4'], 'C2')]
GUITAR = {0: ['G3', 'D4', 'G4', 'B4'], 1: ['D3', 'A3', 'D4', 'F#4'], 2: ['E3', 'B3', 'E4', 'G4'], 3: ['C3', 'G3', 'C4', 'E4']}
FIFTH = {0: 'D3', 1: 'A2', 2: 'B2', 3: 'G2'}
ARP = {0: ['G4', 'B4', 'D5', 'B4', 'G5', 'D5', 'B4', 'D5'], 1: ['F#4', 'A4', 'D5', 'A4', 'F#5', 'D5', 'A4', 'D5'],
       2: ['E4', 'G4', 'B4', 'G4', 'E5', 'B4', 'G4', 'B4'], 3: ['E4', 'G4', 'C5', 'G4', 'E5', 'C5', 'G4', 'C5']}
MEL = {  # (beat, note, beats long): the tune of the morning, over each chord
    0: [(0, 'D5', 1.5), (1.5, 'E5', .5), (2, 'G5', 1), (3, 'E5', 1)],
    1: [(0, 'F#5', 1), (1, 'E5', .5), (1.5, 'D5', .5), (2, 'A5', 1.5), (3.5, 'F#5', .5)],
    2: [(0, 'G5', 1), (1, 'E5', 1), (2, 'B5', 1.5), (3.5, 'A5', .5)],
    3: [(0, 'G5', 1), (1, 'E5', .5), (1.5, 'G5', .5), (2, 'C6', 2)],
}
#            1   2   3   4   5   6   7   8   9   10  11  12  13  14  15  16  17  18  19  20
G_PAD =     [.5, .6, .6, .6, .5, .5, .5, .45, .5, .5, .6, .6, .75, .45, .35, .35, .8, .85, .8, .7]
G_ARP =     [.3, .0, .6, .7, .9, .9, .9, .0, .0, .0, .5, .6, .8, .0, .0, .0, .5, .6, .6, .5]
G_ARP8 =    [.0, .0, .0, .0, .0, .0, .0, .6, .7, .7, .0, .0, .0, .8, .8, .8, .0, .0, .0, .0]   # a second, gentler arpeggio for rain and snow
G_MEL =     [.0, .0, .0, .0, .0, .0, .0, .0, .0, .0, .85, .9, .95, .0, .55, .6, .95, 1.0, .9, .8]
G_BASS =    [.0, .0, .7, .8, .9, .9, .9, .5, .6, .6, .8, .8, .9, .0, .0, .0, .8, .9, .8, .5]
G_DRUMS =   [.0, .0, .5, .7, .9, .95, 1.0, .35, .4, .5, .8, .9, 1.0, .0, .0, .0, .75, .85, .8, .0]
#   the happy rhythm: an upbeat strum, a tambourine, and a walking pizzicato bass, kept (softly) through the rain and the snow
G_STRUM =   [.0, .3, .7, .8, .9, .9, .9, .5, .55, .5, .85, .9, .95, .3, .3, .3, .85, .9, .9, .6]
G_TAMB =    [.0, .0, .4, .6, .8, .85, .9, .35, .4, .45, .7, .8, .9, .0, .0, .0, .75, .85, .8, .0]
G_FLUTE =   [.0, .0, .0, .0, .0, .0, .0, .0, .0, .0, .6, .7, .8, .0, .0, .0, .75, .85, .8, .6]

def bar_of(t): return min(19, int(t / BAR))

music = Bus(); sfx = Bus()
for bar in range(20):
    t0 = bar * BAR; name, tones, root = CHORDS[bar % 4]; ci = bar % 4
    music.add(t0, pad([hz(n) for n in tones], BAR * 1.15), G_PAD[bar] * .55, pan=0)
    if G_BASS[bar] and not G_STRUM[bar]:
        for b in (0, 2):
            music.add(t0 + b * BEAT, bass(hz(root)), G_BASS[bar] * .38)
        if bar % 2: music.add(t0 + 3.5 * BEAT, bass(hz(root) * 1.5, .3), G_BASS[bar] * .35)
    for step in range(8):
        note = ARP[ci][step]
        vel = (1.0 if step % 2 == 0 else .7) * (1.1 if step == 0 else 1)
        if G_ARP[bar]:
            music.add(t0 + step * BEAT / 2, kalimba(hz(note)), G_ARP[bar] * vel * .5, pan=-.35 + .7 * (step % 4) / 3)
        if G_ARP8[bar] and step % 2 == 0:
            music.add(t0 + step * BEAT / 2, kalimba(hz(note), 1.4, .7), G_ARP8[bar] * vel * .42, pan=.3 * (-1) ** (step // 2))
    if G_MEL[bar]:
        for beat, note, length in MEL[ci]:
            music.add(t0 + beat * BEAT, glock(hz(note), 1.4 + length * .3), G_MEL[bar] * .55, pan=.15)
    if G_STRUM[bar]:
        g = G_STRUM[bar]
        # boom - chick - chick: down on 1, down on 2, up on the & of 2, up on the & of 3, down on 4, up on the & of 4
        for step, down, vel in ((0, True, 1.0), (2, True, .7), (3, False, .6), (5, False, .55), (6, True, .8), (7, False, .6)):
            music.add(t0 + step * BEAT / 2, strum([hz(n) for n in GUITAR[ci]], down), g * vel * .55, pan=-.25 + .1 * (step % 2))
    if G_TAMB[bar]:
        for step in range(8):
            if step % 2: music.add(t0 + step * BEAT / 2, tambourine(1.0 if step in (3, 7) else .7), G_TAMB[bar] * .6, pan=.4)
    if G_BASS[bar] or G_STRUM[bar] > .5:
        gb = max(G_BASS[bar], .5 * G_STRUM[bar])
        for step, note in ((0, root), (3, FIFTH[ci]), (4, root), (7, root[:-1] + str(int(root[-1]) + 1))):
            music.add(t0 + step * BEAT / 2, bass(hz(note), .45), gb * .3)
    if G_FLUTE[bar]:
        for beat, note, length in MEL[ci]:
            music.add(t0 + beat * BEAT, flute(hz(note) / 2, length * BEAT + .3), G_FLUTE[bar] * .5, pan=-.1)
    d = G_DRUMS[bar]
    if d:
        for beat in range(4):
            tb = t0 + beat * BEAT
            if beat in (0, 2) and d > .45: music.add(tb, kick(), d * .5)
            if beat in (0, 2) and d <= .45: music.add(tb, kick(), d * .35)
            if beat in (1, 3): music.add(tb, clap(), d * .55, pan=.1)
            music.add(tb, shaker(), d * .32, pan=-.3); music.add(tb + BEAT / 2, hat(), d * .5, pan=.35)
        if bar in (6, 12):       # a fill into the next section
            for k in range(8): music.add(t0 + 3 * BEAT + k * BEAT / 8, clap(), d * .2 * (k + 1) / 8)

# A final chord and a long ring for the last bar and the title card.
music.add(19 * BAR, pad([hz(n) for n in ['G3', 'B3', 'D4', 'G4']], BAR + TAIL + 1.5), .55)
music.add(19 * BAR, glock(hz('G5'), 4.0), .6, pan=-.2); music.add(19 * BAR + .06, glock(hz('D6'), 4.0), .45, pan=.2)
music.add(19 * BAR + .14, glock(hz('B5'), 4.5), .42)

# ---------------------------------------------------------------------------------------------------
# Sound design on the film's own clock.
for s in shots:
    t0 = s['start']
    if s['montage'] or s['index'] == 1 or s['id'] in ('rain-road', 'kite', 'snow-ridge', 'sunset-promenade'):
        sfx.add(max(0, t0 - .12), whoosh(.42, True), .9, pan=rng.uniform(-.4, .4))
    if s['montage']:
        sfx.add(t0, kick(), .7)
    if s['weather'] == 'storm' and not s['montage']:
        sfx.add(t0 - .1, rain_bed(s['seconds'] + .4, 1.0), .85)
        for lt in s.get('lightning') or []:
            sfx.add(t0 + lt + .05, thunder(), 1.0, pan=rng.uniform(-.3, .3))
    if s['weather'] == 'storm' and s['montage']:
        sfx.add(t0, rain_bed(s['seconds'], 1.0), .6)
    if s['weather'] == 'snow' and not s['montage']:
        sfx.add(t0, wind_bed(s['seconds'], .5), .6)
    if s['id'] == 'kite':
        sfx.add(t0, wind_bed(s['seconds'], 1.1), .9)
        sfx.add(t0 + 3.6 - .15, riser(.4), .6); sfx.add(t0 + 3.6, whoosh(.5, False), .8)
    if s['id'] == 'dawn-stairs':
        for k, tb in enumerate([.3, .9, 1.7, 2.2, 3.1, 3.7, 4.3]):
            sfx.add(t0 + tb, bird(k % 3, .22 + .1 * (k % 2)), .9, pan=rng.uniform(-.9, .9))
    if s['id'] == 'morning-stairs':
        for k, tb in enumerate([.4, 1.6, 2.9]):
            sfx.add(t0 + tb, bird((k + 1) % 3, .3), .7, pan=rng.uniform(-.9, .9))
    if s['id'] == 'sunset-promenade':
        sfx.add(t0, water_bed(s['seconds'] + TAIL, 1.0), .8)
        for k, tb in enumerate([1.2, 3.8, 6.0]):
            sfx.add(t0 + tb, bird(k, .35), .55, pan=rng.uniform(-.9, .9))
# a short riser into the first and the last big sections
sfx.add(shots[2]['start'] - 1.2, riser(1.2), .7)
sfx.add(next(x for x in shots if x['id'] == 'kite')['start'] - 1.2, riser(1.2), .8)

# ---------------------------------------------------------------------------------------------------
def reverb_ir(seconds, damp):
    n = int(seconds * SR); t = np.arange(n) / SR
    out = []
    for _ in range(2):
        x = rng.standard_normal(n) * np.exp(-t * (6.5 / seconds))
        out.append(fft_filter(x, hi=damp))
    return out

def convolve(x, ir):
    n = len(x) + len(ir) - 1; size = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[:len(x)]

irs = reverb_ir(2.4, 5200)
wet_l = convolve(music.l, irs[0]); wet_r = convolve(music.r, irs[1])
mix_l = music.l * .8 + wet_l * .09
mix_r = music.r * .8 + wet_r * .09
irs2 = reverb_ir(1.1, 6500)
mix_l += sfx.l * .9 + convolve(sfx.l, irs2[0]) * .05
mix_r += sfx.r * .9 + convolve(sfx.r, irs2[1]) * .05

# Master tilt: take the weight off below 90 Hz and lift the air, so the kalimba and glockenspiel sparkle.
def tilt(x):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    db = -9 / (1 + (f / 85) ** 2.2) * 1.0 - 3.0 / (1 + (f / 220) ** 2) + 4.5 * np.exp(-((np.log2(np.maximum(f, 1) / 3500)) ** 2) / 1.6) + 2.0 * np.clip(np.log2(np.maximum(f, 1) / 6000), 0, 1.5)
    return np.fft.irfft(X * 10 ** (db / 20), len(x))
mix_l = tilt(mix_l); mix_r = tilt(mix_r)

# Shape the whole: fade in over a second, fade out through the title card, ride loudness, soft-limit.
fade = np.minimum(1, t_all / 1.0) * np.minimum(1, (N / SR - t_all) / 1.8)
mix = np.stack([mix_l * fade, mix_r * fade])
peak = np.percentile(np.abs(mix), 99.8)
mix = np.tanh(mix / (peak * 1.05) * 1.35) / np.tanh(1.35) * .88
pcm = (np.clip(mix, -1, 1) * 32767).astype('<i2').T.copy()
with wave.open('film-out/score.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print(f"score.wav: {N / SR:.1f} s, peak {np.abs(mix).max():.2f}")
