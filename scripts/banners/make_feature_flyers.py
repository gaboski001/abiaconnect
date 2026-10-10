# Feature flyers for promoting AbiaConnect: the brand logo, a headline and a
# grid of what the platform offers (forum, Connect, business, chat, calls,
# real-time updates, groups, polls/contests/rewards), each with its own icon.
# Three shapes, saved as JPEG in marketing/ads/:
#   abiaconnect-features-square.jpg     1080 x 1080  Facebook and Instagram feed
#   abiaconnect-features-landscape.jpg  1200 x 628   Facebook link adverts, X, websites
#   abiaconnect-features-story.jpg      1080 x 1920  Stories, Reels, WhatsApp status
# Every feature named here exists in the app (see src/pages). Icons are drawn
# by this script. Photo and helpers are shared with make_ad_banners.py.
# Run: python scripts/banners/make_feature_flyers.py
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(__file__))
from make_ad_banners import (  # noqa: E402
    EMERALD_DARK, GOLD, GOLD_LIGHT, MINT, OUT, ROOT, SHOW_CREDIT, WHITE, background, credit_text, font, photo_layer, shade, wrap,
)

BADGE = 'FOR EVERY ABIAN, HOME AND ABROAD'
HEADLINE = 'Everything Abia. One Platform.'
SUB = 'Talk, connect, trade and stay informed with Abians everywhere.'
# (icon, title, one short line)
FEATURES = [
    ('forum', 'Community Forum', '17 forums on Abia life and news'),
    ('connect', 'Connect', 'Meet friends, partners, professionals'),
    ('business', 'Business', 'Promote your business to Abians'),
    ('chat', 'Private Chat', 'Messages and voice notes'),
    ('calls', 'Voice & Video Calls', 'Call members inside the app'),
    ('bolt', 'Real-Time Updates', 'Daily news and instant alerts'),
    ('groups', 'Groups', 'For your town, school or interest'),
    ('star', 'Polls, Contests & Rewards', 'Vote, compete and earn badges'),
]
BUTTON = 'Join free today'
SITE = 'abiaconnect.com'
TAGLINE = 'Connecting Abians Worldwide'
APP_LINE = 'On the web and as a mobile app'

INK = EMERALD_DARK


def person(d, cx, cy, s, fill=INK):
    """Head and shoulders, about 2s wide and 2s tall, centred on (cx, cy)."""
    d.ellipse((cx - s * 0.42, cy - s * 0.95, cx + s * 0.42, cy - s * 0.11), fill=fill)
    d.pieslice((cx - s * 0.85, cy + s * 0.05, cx + s * 0.85, cy + s * 1.75), 180, 360, fill=fill)


def icon(d, kind, cx, cy, r):
    """A gold disc with a simple dark picture on it."""
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=GOLD)
    s = r * 0.5
    w = max(3, int(r * 0.13))
    if kind == 'forum':  # two speech bubbles
        d.rounded_rectangle((cx - s * 1.25, cy - s * 1.0, cx + s * 0.45, cy + s * 0.15), radius=s * 0.3, fill=INK)
        d.polygon([(cx - s * 0.9, cy + s * 0.1), (cx - s * 0.9, cy + s * 0.6), (cx - s * 0.4, cy + s * 0.1)], fill=INK)
        d.rounded_rectangle((cx - s * 0.35, cy - s * 0.25, cx + s * 1.25, cy + s * 0.8), radius=s * 0.3, fill=INK, outline=GOLD, width=w)
        d.polygon([(cx + s * 0.95, cy + s * 0.7), (cx + s * 0.95, cy + s * 1.2), (cx + s * 0.45, cy + s * 0.7)], fill=INK)
    elif kind == 'connect':  # two people
        person(d, cx - s * 0.55, cy + s * 0.05, s * 0.8)
        person(d, cx + s * 0.55, cy + s * 0.05, s * 0.8)
    elif kind == 'business':  # briefcase
        d.rounded_rectangle((cx - s * 0.5, cy - s * 1.05, cx + s * 0.5, cy - s * 0.35), radius=s * 0.2, outline=INK, width=w)
        d.rounded_rectangle((cx - s * 1.2, cy - s * 0.6, cx + s * 1.2, cy + s * 0.95), radius=s * 0.22, fill=INK)
        d.line((cx - s * 1.2, cy + s * 0.1, cx + s * 1.2, cy + s * 0.1), fill=GOLD, width=max(2, w // 2))
        d.rectangle((cx - s * 0.2, cy - s * 0.08, cx + s * 0.2, cy + s * 0.3), fill=GOLD)
    elif kind == 'chat':  # one bubble with three dots
        d.rounded_rectangle((cx - s * 1.2, cy - s * 0.95, cx + s * 1.2, cy + s * 0.55), radius=s * 0.4, fill=INK)
        d.polygon([(cx - s * 0.6, cy + s * 0.5), (cx - s * 0.6, cy + s * 1.15), (cx + s * 0.1, cy + s * 0.5)], fill=INK)
        for k in (-1, 0, 1):
            d.ellipse((cx + k * s * 0.6 - s * 0.17, cy - s * 0.37, cx + k * s * 0.6 + s * 0.17, cy - s * 0.03), fill=GOLD)
    elif kind == 'calls':  # video camera
        d.rounded_rectangle((cx - s * 1.25, cy - s * 0.7, cx + s * 0.35, cy + s * 0.7), radius=s * 0.25, fill=INK)
        d.polygon([(cx + s * 0.45, cy - s * 0.15), (cx + s * 1.25, cy - s * 0.7), (cx + s * 1.25, cy + s * 0.7), (cx + s * 0.45, cy + s * 0.15)], fill=INK)
    elif kind == 'bolt':  # lightning
        d.polygon([
            (cx + s * 0.25, cy - s * 1.25), (cx - s * 0.75, cy + s * 0.2), (cx - s * 0.05, cy + s * 0.2),
            (cx - s * 0.3, cy + s * 1.25), (cx + s * 0.75, cy - s * 0.25), (cx + s * 0.05, cy - s * 0.25),
        ], fill=INK)
    elif kind == 'groups':  # three people
        person(d, cx - s * 0.85, cy + s * 0.25, s * 0.58)
        person(d, cx + s * 0.85, cy + s * 0.25, s * 0.58)
        d.ellipse((cx - s * 0.62, cy - s * 1.02, cx + s * 0.62, cy + s * 0.22), fill=GOLD)
        person(d, cx, cy + s * 0.05, s * 0.85)
    elif kind == 'star':  # five-point star
        import math
        pts = []
        for i in range(10):
            a = -math.pi / 2 + i * math.pi / 5
            rad = s * (1.3 if i % 2 == 0 else 0.55)
            pts.append((cx + rad * math.cos(a), cy + rad * math.sin(a) + s * 0.05))
        d.polygon(pts, fill=INK)


def tiles(img, x, y, col, cols, row_h, gap, sizes):
    """The feature grid. Returns the y just below it."""
    title_size, desc_size = sizes
    tf, df = font('segoeuib.ttf', title_size), font('segoeui.ttf', desc_size)
    tile_w = (col - gap * (cols - 1)) // cols
    r = int(row_h * 0.32)
    panel = Image.new('RGBA', img.size, (0, 0, 0, 0))
    pd = ImageDraw.Draw(panel)
    for i in range(len(FEATURES)):
        tx = x + (i % cols) * (tile_w + gap)
        ty = y + (i // cols) * (row_h + gap)
        pd.rounded_rectangle((tx, ty, tx + tile_w, ty + row_h), radius=int(row_h * 0.22), fill=(255, 255, 255, 20), outline=(212, 175, 55, 110), width=2)
    img = Image.alpha_composite(img, panel)
    d = ImageDraw.Draw(img)
    for i, (kind, title, desc) in enumerate(FEATURES):
        tx = x + (i % cols) * (tile_w + gap)
        ty = y + (i // cols) * (row_h + gap)
        pad = int(row_h * 0.18)
        icon(d, kind, tx + pad + r, ty + row_h // 2, r)
        text_x = tx + pad + r * 2 + int(row_h * 0.2)
        room = tx + tile_w - pad // 2 - text_x
        # A long title drops a size so it never runs out of its tile.
        f = tf
        size = title_size
        while d.textlength(title, font=f) > room and size > 12:
            size -= 1
            f = font('segoeuib.ttf', size)
        block = size + int(desc_size * 1.45)
        top = ty + (row_h - block) // 2 - int(size * 0.12)
        d.text((text_x, top), title, font=f, fill=WHITE)
        line = desc
        while d.textlength(line, font=df) > room and ' ' in line:
            line = line.rsplit(' ', 1)[0]
        d.text((text_x, top + int(size * 1.28)), line, font=df, fill=(214, 236, 226))
    rows = (len(FEATURES) + cols - 1) // cols
    return img, y + rows * row_h + (rows - 1) * gap


def make(name, w, h, L):
    img = background(w, h)
    img = Image.alpha_composite(img, photo_layer(w, h, L['photo'], L['fade'], L['centre']))
    logo = Image.open(os.path.join(ROOT, 'public', 'brand-logo.png')).convert('RGBA')
    logo.thumbnail(L['logo'])
    lx, ly = L['logo_at']
    if L['fade'] == 'bottom':
        depth = ly + logo.height + 90
        top = Image.new('RGBA', img.size, (0, 0, 0, 0))
        td = ImageDraw.Draw(top)
        for i in range(depth):
            td.line((0, i, w, i), fill=(0, 24, 17, int(185 * (1 - i / depth) ** 1.3)))
        img = Image.alpha_composite(img, top)
    else:
        img = shade(img, (lx - 30, ly - 24, lx + logo.width + 30, ly + logo.height + 24), 150)
    img.alpha_composite(logo, (lx, ly))
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, w, 10), fill=GOLD)
    d.rectangle((0, h - 10, w, h), fill=GOLD)
    d.text(L['tagline_at'], TAGLINE, font=font('seguisb.ttf', L['tagline']), fill=GOLD_LIGHT, anchor=L.get('tagline_anchor', 'rm'))

    x, col, y, gap = L['x'], L['col'], L['y'], L['gap']
    text_col = L.get('text_col', col)

    # Badge
    bf = font('seguisb.ttf', L['badge'])
    bw = d.textlength(BADGE, font=bf)
    bh = int(L['badge'] * 2.0)
    d.rounded_rectangle((x, y, x + bw + bh, y + bh), radius=bh // 2, fill=GOLD)
    d.text((x + bh // 2, y + bh // 2), BADGE, font=bf, fill=EMERALD_DARK, anchor='lm')
    y += bh + gap

    # Headline
    hf = font('segoeuib.ttf', L['head'])
    lines = wrap(d, HEADLINE, hf, text_col)
    sentences = [part.strip() for part in HEADLINE.replace('. ', '.|').split('|')]
    if len(lines) == 2 and len(sentences) == 2 and all(d.textlength(t, font=hf) <= text_col for t in sentences):
        lines = sentences
    sh = Image.new('RGBA', img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    yy = y
    for line in lines:
        sd.text((x + 2, yy + 4), line, font=hf, fill=(0, 0, 0, 170))
        yy += int(L['head'] * 1.14)
    img = Image.alpha_composite(img, sh.filter(ImageFilter.GaussianBlur(5)))
    d = ImageDraw.Draw(img)
    for line in lines:
        d.text((x, y), line, font=hf, fill=WHITE)
        y += int(L['head'] * 1.14)
    y += gap // 2
    d.rectangle((x, y, x + 110, y + 6), fill=GOLD)
    y += 6 + gap

    # Sub-headline
    sf = font('segoeui.ttf', L['sub'])
    for line in wrap(d, SUB, sf, text_col):
        d.text((x, y), line, font=sf, fill=MINT)
        y += int(L['sub'] * 1.32)
    y += gap

    # Feature grid
    img, y = tiles(img, x, y, col, L['cols'], L['row'], L['tile_gap'], L['tile_text'])
    d = ImageDraw.Draw(img)
    y += int(gap * 1.5)

    # Button, website and the app line
    bf2 = font('segoeuib.ttf', L['button'])
    bw2 = int(d.textlength(BUTTON, font=bf2)) + L['button'] * 2
    bh2 = int(L['button'] * 2.3)
    glow = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).rounded_rectangle((x + 4, y + 8, x + bw2 + 4, y + bh2 + 8), radius=bh2 // 2, fill=(0, 0, 0, 120))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(8)))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((x, y, x + bw2, y + bh2), radius=bh2 // 2, fill=GOLD)
    d.text((x + bw2 // 2, y + bh2 // 2), BUTTON, font=bf2, fill=EMERALD_DARK, anchor='mm')
    sx = x + bw2 + int(L['button'] * 0.9)
    d.text((sx, y + bh2 // 2 - int(L['button'] * 0.55)), SITE, font=font('segoeuib.ttf', int(L['button'] * 1.05)), fill=WHITE, anchor='lm')
    d.text((sx, y + bh2 // 2 + int(L['button'] * 0.62)), APP_LINE, font=font('segoeui.ttf', int(L['button'] * 0.68)), fill=MINT, anchor='lm')

    # Photo credit
    if SHOW_CREDIT:
        cx, cy = L['credit_at']
        cf = font('segoeui.ttf', L['credit'])
        cw = d.textlength(credit_text(), font=cf)
        img = shade(img, (cx - cw - 20, cy - 16, cx + 12, cy + 16), 130)
        ImageDraw.Draw(img).text((cx, cy), credit_text(), font=cf, fill=(235, 245, 240), anchor='rm')

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f'abiaconnect-features-{name}.jpg')
    img.convert('RGB').save(path, 'JPEG', quality=92, optimize=True)
    return path


LAYOUTS = {
    'square': (1080, 1080, {
        'photo': (0, 10, 1080, 330), 'fade': 'bottom', 'centre': (0.5, 0.1),
        'logo': (230, 100), 'logo_at': (56, 40),
        'tagline': 23, 'tagline_at': (1024, 92),
        'x': 56, 'col': 968, 'y': 196, 'gap': 16,
        'badge': 19, 'head': 60, 'sub': 27,
        'cols': 2, 'row': 104, 'tile_gap': 14, 'tile_text': (27, 20),
        'button': 29, 'credit': 14, 'credit_at': (1044, 162),
    }),
    'landscape': (1200, 628, {
        'photo': (800, 10, 1200, 618), 'fade': 'left', 'centre': (0.5, 0.05),
        'logo': (170, 74), 'logo_at': (44, 26),
        'tagline': 18, 'tagline_at': (236, 62), 'tagline_anchor': 'lm',
        'x': 44, 'col': 800, 'y': 112, 'gap': 9,
        'badge': 14, 'head': 40, 'sub': 20,
        'cols': 2, 'row': 62, 'tile_gap': 8, 'tile_text': (19, 14),
        'button': 20, 'credit': 12, 'credit_at': (1180, 596),
    }),
    'story': (1080, 1920, {
        'photo': (0, 10, 1080, 560), 'fade': 'bottom', 'centre': (0.5, 0.1),
        'logo': (300, 136), 'logo_at': (70, 130),
        'tagline': 28, 'tagline_at': (72, 306), 'tagline_anchor': 'lm',
        'x': 70, 'col': 940, 'y': 400, 'gap': 24,
        'badge': 24, 'head': 68, 'sub': 34,
        'cols': 1, 'row': 112, 'tile_gap': 14, 'tile_text': (36, 26),
        'button': 38, 'credit': 16, 'credit_at': (1040, 360),
    }),
}

if __name__ == '__main__':
    for name, (w, h, layout) in LAYOUTS.items():
        path = make(name, w, h, layout)
        print(os.path.relpath(path, ROOT), f'{w}x{h}', os.path.getsize(path) // 1024, 'KB')
