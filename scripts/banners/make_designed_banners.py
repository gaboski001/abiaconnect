# Designed hero banners (public/banners/<name>-desktop.webp and -mobile.webp):
# the slide's words on the emerald panel with its picture beside them, in a
# wide version for computers and a tall one for phones. Same sizes as the
# launch banner; shown in full by the hero slider ("full banner" slides).
#
#   tower     "One People. One Voice. One Platform." with the Abia State Tower.
#             The present Governor's portrait is added when the file
#             scripts/banners/governor.jpg exists (a photo you may use).
#   diaspora  "Distance Doesn't Divide Us" with the Abia State coat of arms.
#
# Photos: free-licence images from Wikimedia Commons (credits.json).
# Coat of arms: the State's emblem as published by the Government of Abia
# State (scripts/banners/abia-coat-of-arms.png).
# Run: python scripts/banners/make_designed_banners.py
import json
import os

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageOps

HERE = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
PHOTOS = os.path.join(ROOT, 'scripts', 'newsdesk', 'photos')
OUT = os.path.join(ROOT, 'public', 'banners')
CREDITS = json.load(open(os.path.join(PHOTOS, 'credits.json'), encoding='utf-8'))
FONTS = 'C:/Windows/Fonts/'

EMERALD_DARK = (2, 44, 34)
EMERALD = (6, 95, 70)
GOLD = (212, 175, 55)
GOLD_LIGHT = (240, 210, 120)
MINT = (167, 243, 208)
WHITE = (255, 255, 255)

GOVERNOR_PHOTO = os.path.join(HERE, 'governor.jpg')
GOVERNOR_NAME = 'Dr. Alex C. Otti, OFR'
GOVERNOR_TITLE = 'Governor of Abia State'

BANNERS = {
    'tower': {
        'badge': 'TOWER! GREAT',
        'headline': 'One People. One Voice. One Platform.',
        'sub': 'Where Abians Come Together',
        'body': 'AbiaConnect is the heartbeat of the Abia community, at home and across the globe.',
        'button': 'Join the Community',
        'photo': 'Abia_state_tower_jpg.jpg',
        'caption': 'Abia State Tower, Umuahia',
        'centre_wide': (0.5, 0.0),
        'centre_tall': (0.5, 0.0),
        'governor': True,
    },
    'diaspora': {
        'badge': 'ABIANS WORLDWIDE',
        'headline': "Distance Doesn't Divide Us",
        'sub': 'Built for Abians Everywhere in the World',
        'body': 'AbiaConnect bridges the gap between home and abroad. This is the platform that brings Abia to you, wherever life has taken you.',
        'button': 'Explore AbiaConnect',
        'photo': 'Airplane_wing_sky_and_clouds_jpg.jpg',
        'caption': 'In flight above the clouds',
        'centre_wide': (0.5, 0.75),
        'centre_tall': (0.5, 0.75),
        'arms': True,
    },
}


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


def panel(w, h):
    """Emerald panel with the brand's faint diagonal lines."""
    # Lighter emerald at the top left, easing to dark at the bottom right.
    down = Image.linear_gradient('L').resize((w, h))
    across = Image.linear_gradient('L').rotate(90).resize((w, h))
    grad = ImageChops.add(down, across, scale=2)
    img = Image.composite(Image.new('RGB', (w, h), EMERALD_DARK), Image.new('RGB', (w, h), EMERALD), grad).convert('RGBA')
    over = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    for k in range(-h, w, 56):
        d.line((k, h, k + h, 0), fill=(255, 255, 255, 9), width=2)
    return Image.alpha_composite(img, over)


def credit_line(photo, caption):
    c = CREDITS[photo]
    lic = c['license'] or ''
    who = f"Photo: {c['artist']} (CC0)" if lic.upper() in ('CC0', 'PUBLIC DOMAIN') else f"Photo: {c['artist']}, {lic}"
    return f'{caption}  ·  {who} / Wikimedia Commons'


def photo_layer(size, box, photo, centre, fade):
    """The photo in `box`, graded to sit with the brand colours, fading out along one edge.
    fade: ('left', pixels) for the wide banner, ('bottom', pixels) for the tall one."""
    w, h = size
    x0, y0, x1, y1 = box
    src = Image.open(os.path.join(PHOTOS, photo)).convert('RGB')
    pic = ImageOps.fit(src, (x1 - x0, y1 - y0), Image.LANCZOS, centering=centre)
    pic = Image.blend(pic, Image.new('RGB', pic.size, EMERALD_DARK), 0.14)
    layer = Image.new('RGBA', size, (0, 0, 0, 0))
    layer.paste(pic, (x0, y0))
    mask = Image.new('L', size, 0)
    md = ImageDraw.Draw(mask)
    md.rectangle((x0, y0, x1 - 1, y1 - 1), fill=255)
    edge, span = fade
    for i in range(span):
        a = int(255 * (i / span) ** 1.6)
        if edge == 'left':
            md.line((x0 + i, y0, x0 + i, y1), fill=a)
        else:
            md.line((x0, y1 - 1 - i, x1, y1 - 1 - i), fill=a)
    layer.putalpha(mask)
    return layer


def shadowed(img, draw_fn, blur=10, offset=(0, 8), alpha=150):
    """Draws something with a soft shadow under it: draw_fn(draw, colour_override_or_None)."""
    shadow = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(shadow), (0, 0, 0, alpha), offset)
    img = Image.alpha_composite(img, shadow.filter(ImageFilter.GaussianBlur(blur)))
    draw_fn(ImageDraw.Draw(img), None, (0, 0))
    return img


def paste_arms(img, centre, width):
    """The coat of arms, with a soft dark glow so it stands clear of the photo."""
    arms = Image.open(os.path.join(HERE, 'abia-coat-of-arms.png')).convert('RGBA')
    arms = arms.resize((width, int(arms.height * width / arms.width)), Image.LANCZOS)
    x, y = int(centre[0] - arms.width / 2), int(centre[1] - arms.height / 2)
    glow = Image.new('RGBA', img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    pad = int(width * 0.12)
    gd.ellipse((x - pad, y - pad, x + arms.width + pad, y + arms.height + pad), fill=(1, 30, 23, 190))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(width // 7)))
    img.alpha_composite(arms, (x, y))
    return img


def paste_governor(img, centre, diameter, name_size):
    """The Governor's portrait in a gold ring, with name and office beneath."""
    if not os.path.exists(GOVERNOR_PHOTO):
        return img
    face = ImageOps.fit(Image.open(GOVERNOR_PHOTO).convert('RGB'), (diameter, diameter), Image.LANCZOS, centering=(0.5, 0.25))
    cx, cy = centre
    r = diameter // 2
    ring = max(6, diameter // 28)
    shadow = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse((cx - r - ring, cy - r - ring + 10, cx + r + ring, cy + r + ring + 10), fill=(0, 0, 0, 150))
    img = Image.alpha_composite(img, shadow.filter(ImageFilter.GaussianBlur(16)))
    d = ImageDraw.Draw(img)
    d.ellipse((cx - r - ring, cy - r - ring, cx + r + ring, cy + r + ring), fill=GOLD)
    mask = Image.new('L', (diameter, diameter), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, diameter, diameter), fill=255)
    img.paste(face, (cx - r, cy - r), mask)
    # Name plate
    nf, tf = font('segoeuib.ttf', name_size), font('segoeui.ttf', int(name_size * 0.78))
    d = ImageDraw.Draw(img)
    pw = int(max(d.textlength(GOVERNOR_NAME, font=nf), d.textlength(GOVERNOR_TITLE, font=tf))) + name_size * 2
    ph = int(name_size * 2.9)
    px, py = cx - pw // 2, cy + r + ring + int(name_size * 0.5)
    d.rounded_rectangle((px, py, px + pw, py + ph), radius=ph // 4, fill=(1, 30, 23, 235), outline=GOLD, width=2)
    d.text((cx, py + ph * 0.34), GOVERNOR_NAME, font=nf, fill=WHITE, anchor='mm')
    d.text((cx, py + ph * 0.72), GOVERNOR_TITLE, font=tf, fill=GOLD_LIGHT, anchor='mm')
    return img


def text_block(img, b, x, y, width, sizes, centred=False):
    """Badge, headline, gold rule, sub-line, body and button. Returns the picture and the y below the block."""
    head, sub, body, pill, btn = sizes
    d = ImageDraw.Draw(img)
    ax = x + width // 2 if centred else x
    anchor = 'm' if centred else 'l'

    # Badge
    pf = font('seguisb.ttf', pill)
    pw = int(d.textlength(b['badge'], font=pf)) + pill * 2
    ph = int(pill * 2.1)
    px = ax - pw // 2 if centred else x
    d.rounded_rectangle((px, y, px + pw, y + ph), radius=ph // 2, fill=GOLD)
    d.text((px + pw / 2, y + ph / 2), b['badge'], font=pf, fill=EMERALD_DARK, anchor='mm')
    y += ph + int(head * 0.5)

    # Headline, with a soft shadow
    hf = font('segoeuib.ttf', head)
    lines = wrap(d, b['headline'], hf, width)
    step = int(head * 1.16)

    def draw_head(dr, colour, off):
        yy = y
        for line in lines:
            dr.text((ax + off[0], yy + off[1]), line, font=hf, fill=colour or WHITE, anchor=f'{anchor}a')
            yy += step

    img = shadowed(img, draw_head, blur=8, offset=(0, 6), alpha=170)
    d = ImageDraw.Draw(img)
    y += step * len(lines) + int(head * 0.36)

    # Gold rule and sub-line
    rule = int(head * 1.7)
    d.rectangle((ax - rule // 2 if centred else x, y, (ax + rule // 2) if centred else x + rule, y + max(6, head // 14)), fill=GOLD)
    y += int(head * 0.42)
    d.text((ax, y), b['sub'], font=font('seguisb.ttf', sub), fill=GOLD_LIGHT, anchor=f'{anchor}a')
    y += int(sub * 1.7)

    # Body
    bf = font('segoeui.ttf', body)
    for line in wrap(d, b['body'], bf, width):
        d.text((ax, y), line, font=bf, fill=(226, 240, 234), anchor=f'{anchor}a')
        y += int(body * 1.42)
    y += int(body * 0.9)

    # Button (the whole banner is the link; this shows where it goes)
    bfnt = font('seguisb.ttf', btn)
    bw = int(d.textlength(b['button'], font=bfnt)) + btn * 3
    bh = int(btn * 2.5)
    bx = ax - bw // 2 if centred else x

    def draw_button(dr, colour, off):
        dr.rounded_rectangle((bx + off[0], y + off[1], bx + bw + off[0], y + bh + off[1]), radius=bh // 3, fill=colour or (245, 200, 80))

    img = shadowed(img, draw_button, blur=14, offset=(0, 10), alpha=120)
    ImageDraw.Draw(img).text((bx + bw / 2, y + bh / 2), b['button'], font=bfnt, fill=(20, 20, 20), anchor='mm')
    return img, y + bh


def footer(img, logo, x, y, size, right=None):
    d = ImageDraw.Draw(img)
    lg = logo.copy()
    lg.thumbnail((size * 4, int(size * 1.9)))
    img.alpha_composite(lg, (x, y - lg.height // 2))
    d.text((x + lg.width + size // 2, y), 'abiaconnect.com', font=font('seguisb.ttf', size), fill=WHITE, anchor='lm')
    if right:
        d.text((right, y), 'Connecting Abians Worldwide', font=font('segoeui.ttf', int(size * 0.92)), fill=GOLD_LIGHT, anchor='rm')


def wide(name, b, logo):
    W, H = 2400, 1000
    FOOT = 132
    img = panel(W, H)
    img = Image.alpha_composite(img, photo_layer((W, H), (1040, 0, W, H - FOOT), b['photo'], b['centre_wide'], ('left', 620)))
    if b.get('arms'):
        img = paste_arms(img, (1830, (H - FOOT) // 2 - 6), 700)
    if b.get('governor'):
        img = paste_governor(img, (2130, 560), 300, 30)
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W, 14), fill=GOLD)
    d.rectangle((0, H - FOOT, W, H), fill=(1, 30, 23))
    d.rectangle((0, H - FOOT, W, H - FOOT + 5), fill=GOLD)
    d.text((W - 60, H - FOOT - 30), credit_line(b['photo'], b['caption']), font=font('segoeui.ttf', 22), fill=(235, 245, 240), anchor='rm')
    img, _ = text_block(img, b, 130, 96, 1010, (92, 42, 34, 28, 34))
    footer(img, logo, 130, H - FOOT // 2 + 3, 40, right=W - 60)
    return save(img, f'{name}-desktop')


def tall(name, b, logo):
    W, H = 1080, 1350
    FOOT = 118
    PHOTO_H = 600
    img = panel(W, H)
    img = Image.alpha_composite(img, photo_layer((W, H), (0, 0, W, PHOTO_H), b['photo'], b['centre_tall'], ('bottom', 240)))
    if b.get('arms'):
        img = paste_arms(img, (W // 2, 262), 520)
    if b.get('governor'):
        img = paste_governor(img, (860, 300), 230, 24)
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W, 12), fill=GOLD)
    d.rectangle((0, H - FOOT, W, H), fill=(1, 30, 23))
    d.rectangle((0, H - FOOT, W, H - FOOT + 4), fill=GOLD)
    img, _ = text_block(img, b, 70, 560, W - 140, (74, 36, 31, 26, 34), centred=True)
    footer(img, logo, 70, H - FOOT // 2 - 12, 34)
    # Photo credit in the footer: it would not be readable over a bright sky.
    ImageDraw.Draw(img).text((70, H - 24), credit_line(b['photo'], b['caption']), font=font('segoeui.ttf', 17), fill=(200, 215, 208), anchor='lm')
    return save(img, f'{name}-mobile')


def save(img, name):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f'{name}.webp')
    img.convert('RGB').save(path, 'WEBP', quality=84, method=6)
    return path


if __name__ == '__main__':
    logo = Image.open(os.path.join(ROOT, 'public', 'brand-logo.png')).convert('RGBA')
    if not os.path.exists(GOVERNOR_PHOTO):
        print('No scripts/banners/governor.jpg yet: the tower banner is made without the portrait.')
    for name, b in BANNERS.items():
        for make in (wide, tall):
            path = make(name, b, logo)
            print(os.path.basename(path), os.path.getsize(path) // 1024, 'KB')
