# Draws a 1200x630 share thumbnail (Facebook's link-preview size) for each post
# into public/og/<slug>.jpg. Run: python scripts/newsdesk/make_thumbs.py
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(__file__))
from posts import POSTS  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'og')
FONTS = 'C:/Windows/Fonts/'
W, H = 1200, 630

EMERALD_DARK = (2, 44, 34)
EMERALD = (6, 95, 70)
GOLD = (212, 175, 55)
GOLD_LIGHT = (240, 210, 120)
MINT = (167, 243, 208)


def font(name, size):
    return ImageFont.truetype(FONTS + name, size)


def wrap(draw, text, fnt, width):
    words, lines, cur = text.split(), [], ''
    for w in words:
        test = f'{cur} {w}'.strip()
        if draw.textlength(test, font=fnt) <= width:
            cur = test
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def background():
    img = Image.new('RGB', (W, H), EMERALD_DARK)
    px = img.load()
    for y in range(H):
        for x in range(W):
            t = min(1, max(0, (x * 0.7 + y * 0.5) / (W * 0.7 + H * 0.5)))
            t = 1 - t
            px[x, y] = tuple(int(EMERALD_DARK[i] + (EMERALD[i] - EMERALD_DARK[i]) * t) for i in range(3))
    # Soft gold glow on the right
    glow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(glow).ellipse((760, -160, 1380, 460), fill=70)
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    img = Image.composite(Image.new('RGB', (W, H), GOLD), img, glow)
    # Fine diagonal lines pattern
    over = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    for k in range(-H, W, 28):
        d.line((k, H, k + H, 0), fill=(255, 255, 255, 9), width=1)
    img = Image.alpha_composite(img.convert('RGBA'), over)
    return img


def make(post, logo):
    img = background()
    d = ImageDraw.Draw(img)

    # Gold frame accents
    d.rectangle((0, 0, W, 8), fill=GOLD)
    d.rectangle((0, H - 92, W, H), fill=(1, 30, 23, 255))
    d.rectangle((0, H - 92, W, H - 89), fill=GOLD)

    # Forum label pill
    lf = font('seguisb.ttf', 24)
    label = post['label'].upper()
    lw = d.textlength(label, font=lf)
    d.rounded_rectangle((60, 52, 60 + lw + 44, 98), radius=23, fill=GOLD)
    d.text((82, 75), label, font=lf, fill=EMERALD_DARK, anchor='lm')

    # Headline (shrinks to fit 4 lines in the left column)
    col_w = 720
    for size in (58, 54, 50, 46, 42):
        hf = font('segoeuib.ttf', size)
        lines = wrap(d, post['thumb_title'], hf, col_w)
        if len(lines) <= 4:
            break
    y = 130
    for line in lines:
        d.text((60, y), line, font=hf, fill=(255, 255, 255))
        y += int(size * 1.22)
    d.rectangle((60, y + 18, 160, y + 23), fill=GOLD)
    d.text((60, y + 40), 'Join the discussion on AbiaConnect', font=font('segoeui.ttf', 26), fill=MINT)

    # Key figure card on the right
    cx0, cy0, cx1, cy1 = 840, 150, 1140, 430
    card = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    cd = ImageDraw.Draw(card)
    cd.rounded_rectangle((cx0, cy0, cx1, cy1), radius=28, fill=(255, 255, 255, 22), outline=GOLD + (255,), width=3)
    img = Image.alpha_composite(img, card)
    d = ImageDraw.Draw(img)
    for size in (96, 84, 72, 60, 50, 42):
        sf = font('segoeuib.ttf', size)
        if d.textlength(post['stat'], font=sf) <= (cx1 - cx0 - 40):
            break
    d.text(((cx0 + cx1) / 2, cy0 + 120), post['stat'], font=sf, fill=GOLD_LIGHT, anchor='mm')
    slf = font('segoeui.ttf', 24)
    sl = wrap(d, post['stat_label'], slf, cx1 - cx0 - 40)
    for i, line in enumerate(sl[:2]):
        d.text(((cx0 + cx1) / 2, cy0 + 205 + i * 32), line, font=slf, fill=(236, 253, 245), anchor='mm')

    # Footer: logo + site
    lg = logo.copy()
    lg.thumbnail((140, 62))
    img.alpha_composite(lg, (60, H - 46 - lg.height // 2))
    ff = font('seguisb.ttf', 26)
    d.text((60 + lg.width + 18, H - 46), 'abiaconnect.com', font=ff, fill=(255, 255, 255), anchor='lm')
    d.text((W - 60, H - 46), 'Connecting Abians Worldwide', font=font('segoeui.ttf', 24), fill=GOLD_LIGHT, anchor='rm')

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"{post['slug']}.jpg")
    img.convert('RGB').save(path, 'JPEG', quality=88, optimize=True, progressive=True)
    return path


if __name__ == '__main__':
    logo = Image.open(os.path.join(ROOT, 'public', 'brand-logo.png')).convert('RGBA')
    only = sys.argv[1:]
    for p in POSTS:
        if only and p['slug'] not in only:
            continue
        print(make(p, logo), os.path.getsize(os.path.join(OUT, p['slug'] + '.jpg')) // 1024, 'KB')
