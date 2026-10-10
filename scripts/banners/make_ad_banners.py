# Advert banners for promoting AbiaConnect (Facebook, Instagram, WhatsApp):
# the brand logo, a headline, the reasons an Abian should join, and a button.
# Three shapes, saved as JPEG in marketing/ads/:
#   abiaconnect-ad-square.jpg     1080 x 1080  Facebook and Instagram feed
#   abiaconnect-ad-landscape.jpg  1200 x 628   Facebook link adverts, X, websites
#   abiaconnect-ad-story.jpg      1080 x 1920  Stories, Reels, WhatsApp status
# Photo: the Abia State Tower, a free-licence image from Wikimedia Commons
# (scripts/newsdesk/photos/credits.json), credited on the website's Photo
# credits page (/photo-credits) rather than on the banner.
# Run: python scripts/banners/make_ad_banners.py
import json
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

HERE = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
PHOTOS = os.path.join(ROOT, 'scripts', 'newsdesk', 'photos')
OUT = os.path.join(ROOT, 'marketing', 'ads')
CREDITS = json.load(open(os.path.join(PHOTOS, 'credits.json'), encoding='utf-8'))
FONTS = 'C:/Windows/Fonts/'

EMERALD_DARK = (2, 44, 34)
EMERALD = (6, 95, 70)
GOLD = (212, 175, 55)
GOLD_LIGHT = (240, 210, 120)
MINT = (167, 243, 208)
WHITE = (255, 255, 255)

PHOTO = 'Abia_state_tower_jpg.jpg'
SHOW_CREDIT = False
BADGE = 'FOR EVERY ABIAN, HOME AND ABROAD'
HEADLINE = 'Abia Has a Home Online. Come Join Us.'
SUB = 'One free community for Abians at home, across Nigeria and worldwide.'
# (bold lead, the rest of the line)
REASONS = [
    ('Abia news every day', 'from trusted newspapers, in one place'),
    ('Home and abroad together', 'stay close to Abia wherever you live'),
    ('Grow your business', 'reach Abian customers and partners'),
    ('School updates', 'ABSU, MOUAU, Abia Poly and more'),
    ('Have your say', 'on politics, culture and your community'),
]
BUTTON = 'Join free today'
SITE = 'abiaconnect.com'
TAGLINE = 'Connecting Abians Worldwide'


def font(name, size):
    return ImageFont.truetype(FONTS + name, size)


def wrap(draw, text, fnt, width):
    lines, cur = [], ''
    for word in text.split():
        test = f'{cur} {word}'.strip()
        if draw.textlength(test, font=fnt) <= width:
            cur = test
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def background(w, h):
    """Emerald panel, lighter towards the top left, with faint diagonal lines."""
    small = Image.new('RGB', (64, 64))
    px = small.load()
    for y in range(64):
        for x in range(64):
            t = 1 - (x * 0.6 + y * 0.4) / 64
            px[x, y] = tuple(int(EMERALD_DARK[i] + (EMERALD[i] - EMERALD_DARK[i]) * t) for i in range(3))
    img = small.resize((w, h), Image.BICUBIC).convert('RGBA')
    over = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    for k in range(-h, w, 34):
        d.line((k, h, k + h, 0), fill=(255, 255, 255, 9), width=1)
    return Image.alpha_composite(img, over)


def photo_layer(w, h, box, fade, centre):
    """The photo in `box`, fading into the panel on the side named by `fade` ('left' or 'bottom')."""
    x0, y0, x1, y1 = box
    area = (x1 - x0, y1 - y0)
    src = Image.open(os.path.join(PHOTOS, PHOTO)).convert('RGB')
    photo = ImageOps.fit(src, area, Image.LANCZOS, centering=centre)
    photo = Image.blend(photo, Image.new('RGB', area, EMERALD_DARK), 0.10)
    if fade == 'left':
        ramp = Image.linear_gradient('L').rotate(90, expand=True).resize(area)  # black at the left
        ramp = ramp.point(lambda v: 255 if v > 150 else int(255 * (v / 150) ** 1.5))
    else:
        ramp = Image.linear_gradient('L').rotate(180).resize(area)  # black at the bottom
        ramp = ramp.point(lambda v: 255 if v > 140 else int(255 * (v / 140) ** 1.4))
    layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    layer.paste(photo, (x0, y0))
    mask = Image.new('L', (w, h), 0)
    mask.paste(ramp, (x0, y0))
    layer.putalpha(mask)
    return layer


def shade(img, box, alpha):
    """A soft dark patch, so the logo and small print read on any part of the photo."""
    over = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(over).rounded_rectangle(box, radius=40, fill=(0, 20, 14, alpha))
    return Image.alpha_composite(img, over.filter(ImageFilter.GaussianBlur(28)))


def tick(d, x, y, r):
    """Gold disc with a dark tick, centred on (x, y)."""
    d.ellipse((x - r, y - r, x + r, y + r), fill=GOLD)
    d.line((x - r * 0.45, y + r * 0.02, x - r * 0.1, y + r * 0.38, x + r * 0.48, y - r * 0.34), fill=EMERALD_DARK, width=max(3, int(r * 0.26)), joint='curve')


def credit_text():
    c = CREDITS[PHOTO]
    return f"Abia State Tower, Umuahia  ·  Photo: {c['artist'] or 'Unknown'}, {c['license']} / Wikimedia Commons"


def make(name, w, h, layout):
    """layout: photo box and fade, the text column, and type sizes for this shape."""
    L = layout
    img = background(w, h)
    img = Image.alpha_composite(img, photo_layer(w, h, L['photo'], L['fade'], L['centre']))
    logo = Image.open(os.path.join(ROOT, 'public', 'brand-logo.png')).convert('RGBA')
    logo.thumbnail(L['logo'])
    lx, ly = L['logo_at']
    if L['fade'] == 'bottom':
        # The logo sits on the photo's sky: darken the top of the picture evenly.
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

    # Gold frame lines
    d.rectangle((0, 0, w, 10), fill=GOLD)
    d.rectangle((0, h - 10, w, h), fill=GOLD)

    x, col = L['x'], L['col']
    y = L['y']

    # Badge
    bf = font('seguisb.ttf', L['badge'])
    bw = d.textlength(BADGE, font=bf)
    bh = int(L['badge'] * 2.0)
    d.rounded_rectangle((x, y, x + bw + bh, y + bh), radius=bh // 2, fill=GOLD)
    d.text((x + bh // 2, y + bh // 2), BADGE, font=bf, fill=EMERALD_DARK, anchor='lm')
    y += bh + L['gap']

    # Headline, with a soft shadow where it crosses the photo's fade
    hf = font('segoeuib.ttf', L['head'])
    lines = wrap(d, HEADLINE, hf, col)
    # Two lines read better broken between the two sentences.
    sentences = [part.strip() for part in HEADLINE.replace('. ', '.|').split('|')]
    if len(lines) == 2 and len(sentences) == 2 and all(d.textlength(t, font=hf) <= col for t in sentences):
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
    y += L['gap'] // 2
    d.rectangle((x, y, x + 110, y + 6), fill=GOLD)
    y += 6 + L['gap']

    # Sub-headline
    sf = font('segoeui.ttf', L['sub'])
    for line in wrap(d, SUB, sf, col):
        d.text((x, y), line, font=sf, fill=MINT)
        y += int(L['sub'] * 1.32)
    y += L['gap']

    # Reasons
    rb, rf = font('segoeuib.ttf', L['reason']), font('segoeui.ttf', L['reason'])
    r = int(L['reason'] * 0.62)
    indent = r * 2 + int(L['reason'] * 0.6)
    for lead, rest in REASONS[: L['reasons']]:
        lead_w = d.textlength(lead + ': ', font=rb)
        rest_lines = wrap(d, rest, rf, col - indent - lead_w)
        one_line = len(rest_lines) == 1
        tick(d, x + r, y + int(L['reason'] * 0.68), r)
        d.text((x + indent, y), lead + (': ' if one_line else ''), font=rb, fill=WHITE)
        if one_line:
            d.text((x + indent + lead_w, y), rest, font=rf, fill=(225, 240, 233))
            y += int(L['reason'] * 1.75)
        else:
            y += int(L['reason'] * 1.3)
            for line in wrap(d, rest, rf, col - indent):
                d.text((x + indent, y), line, font=rf, fill=(225, 240, 233))
                y += int(L['reason'] * 1.3)
            y += int(L['reason'] * 0.45)
    y += L['gap']

    # Button and website
    bf2 = font('segoeuib.ttf', L['button'])
    bw2 = int(d.textlength(BUTTON, font=bf2)) + L['button'] * 2
    bh2 = int(L['button'] * 2.3)
    by = L.get('button_y', y)
    glow = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).rounded_rectangle((x + 4, by + 8, x + bw2 + 4, by + bh2 + 8), radius=bh2 // 2, fill=(0, 0, 0, 120))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(8)))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((x, by, x + bw2, by + bh2), radius=bh2 // 2, fill=GOLD)
    d.text((x + bw2 // 2, by + bh2 // 2), BUTTON, font=bf2, fill=EMERALD_DARK, anchor='mm')
    site_f = font('segoeuib.ttf', int(L['button'] * 1.05))
    if L.get('site_below'):
        d.text((x, by + bh2 + int(L['button'] * 0.9)), SITE, font=site_f, fill=WHITE)
    else:
        d.text((x + bw2 + int(L['button'] * 0.9), by + bh2 // 2), SITE, font=site_f, fill=WHITE, anchor='lm')

    # Tagline and photo credit
    d.text(L['tagline_at'], TAGLINE, font=font('seguisb.ttf', L['tagline']), fill=GOLD_LIGHT, anchor=L.get('tagline_anchor', 'rm'))
    if SHOW_CREDIT:
        cx, cy = L['credit_at']
        cf = font('segoeui.ttf', L['credit'])
        cw = d.textlength(credit_text(), font=cf)
        img = shade(img, (cx - cw - 20, cy - 16, cx + 12, cy + 16), 130)
        ImageDraw.Draw(img).text((cx, cy), credit_text(), font=cf, fill=(235, 245, 240), anchor='rm')

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f'abiaconnect-ad-{name}.jpg')
    img.convert('RGB').save(path, 'JPEG', quality=92, optimize=True)
    return path


LAYOUTS = {
    # Photo across the top, words below.
    'square': (1080, 1080, {
        'photo': (0, 10, 1080, 400), 'fade': 'bottom', 'centre': (0.5, 0.12),
        'logo': (250, 110), 'logo_at': (60, 46),
        'x': 64, 'col': 952, 'y': 300, 'gap': 22,
        'badge': 21, 'head': 66, 'sub': 30, 'reason': 30, 'reasons': 5, 'button': 32,
        'tagline': 24, 'tagline_at': (1016, 110), 'credit': 15, 'credit_at': (1040, 268),
    }),
    # Words on the left, photo on the right.
    'landscape': (1200, 628, {
        'photo': (640, 10, 1200, 618), 'fade': 'left', 'centre': (0.5, 0.05),
        'logo': (190, 84), 'logo_at': (52, 36),
        'x': 56, 'col': 680, 'y': 136, 'gap': 12,
        'badge': 16, 'head': 44, 'sub': 21, 'reason': 20, 'reasons': 4, 'button': 22,
        'tagline': 19, 'tagline_at': (268, 80), 'tagline_anchor': 'lm', 'credit': 13, 'credit_at': (1176, 592),
    }),
    # Tall: photo at the top, words below, room left at the top and bottom for the app's own buttons.
    'story': (1080, 1920, {
        'photo': (0, 10, 1080, 800), 'fade': 'bottom', 'centre': (0.5, 0.1),
        'logo': (330, 150), 'logo_at': (70, 150),
        'x': 76, 'col': 928, 'y': 610, 'gap': 30,
        'badge': 25, 'head': 78, 'sub': 38, 'reason': 38, 'reasons': 5, 'button': 42,
        'tagline': 30, 'tagline_at': (76, 1790), 'tagline_anchor': 'lm', 'credit': 17, 'credit_at': (1040, 570),
    }),
}

if __name__ == '__main__':
    for name, (w, h, layout) in LAYOUTS.items():
        path = make(name, w, h, layout)
        print(os.path.relpath(path, ROOT), f'{w}x{h}', os.path.getsize(path) // 1024, 'KB')
