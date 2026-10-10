# Draws a 1200x630 share thumbnail (Facebook's link-preview size) for each post
# into public/og/<slug>.jpg: headline on the emerald panel, a photo of the
# topic on the right, a gold key-figure badge and the photographer's credit.
# Photos are free-licence images from Wikimedia Commons (photos/credits.json);
# the credit printed on the image is required by their licences.
# Run: python scripts/newsdesk/make_thumbs.py [slug ...]
import json
import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageOps

sys.path.insert(0, os.path.dirname(__file__))
from posts import POSTS  # noqa: E402

HERE = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'public', 'og')
PHOTOS = os.path.join(HERE, 'photos')
CREDITS = json.load(open(os.path.join(PHOTOS, 'credits.json'), encoding='utf-8'))
FONTS = 'C:/Windows/Fonts/'
W, H = 1200, 630
FOOT = 92  # footer bar height
PHOTO_X = 470  # photo starts here and fades in under the text panel
FADE_END = 800

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


def panel_background():
    img = Image.new('RGB', (W, H), EMERALD_DARK)
    px = img.load()
    for y in range(H):
        for x in range(W):
            t = 1 - min(1, max(0, (x * 0.7 + y * 0.5) / (W * 0.7 + H * 0.5)))
            px[x, y] = tuple(int(EMERALD_DARK[i] + (EMERALD[i] - EMERALD_DARK[i]) * t) for i in range(3))
    over = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    for k in range(-H, W, 28):
        d.line((k, H, k + H, 0), fill=(255, 255, 255, 9), width=1)
    return Image.alpha_composite(img.convert('RGBA'), over)


def photo_layer(post):
    """The topic photo, cover-cropped to the right-hand area and faded in from the left."""
    src = Image.open(os.path.join(PHOTOS, post['photo'])).convert('RGB')
    box = post.get('photo_box')
    if box:
        w, h = src.size
        src = src.crop((int(box[0] * w), int(box[1] * h), int(box[2] * w), int(box[3] * h)))
    area = (W - PHOTO_X, H - FOOT)
    photo = ImageOps.fit(src, area, Image.LANCZOS, centering=(0.5, 0.45))
    # Gentle grade so photos sit with the brand colours, plus a dark base for the credit.
    photo = Image.blend(photo, Image.new('RGB', area, EMERALD_DARK), 0.12)
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    layer.paste(photo, (PHOTO_X, 0))
    mask = Image.new('L', (W, H), 0)
    m = mask.load()
    for x in range(PHOTO_X, W):
        a = 255 if x >= FADE_END else int(255 * ((x - PHOTO_X) / (FADE_END - PHOTO_X)) ** 1.6)
        for y in range(H - FOOT):
            m[x, y] = a
    layer.putalpha(mask)
    # Shade under the credit line at the bottom of the photo
    shade = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)
    for i in range(70):
        sd.line((PHOTO_X, H - FOOT - i, W, H - FOOT - i), fill=(0, 0, 0, int(150 * (1 - i / 70))))
    shade.putalpha(ImageChops.multiply(shade.getchannel('A'), mask))  # fade it like the photo
    return Image.alpha_composite(layer, shade)


def credit_text(post):
    c = CREDITS[post['photo']]
    artist = c['artist'] or 'Unknown'
    lic = c['license'] or ''
    if lic.upper() in ('CC0', 'PUBLIC DOMAIN'):
        who = f'Photo: {artist} (CC0) / Wikimedia Commons'
    else:
        who = f'Photo: {artist}, {lic} / Wikimedia Commons'
    return f"{post['photo_caption']}  ·  {who}"


def make(post, logo):
    img = panel_background()
    img = Image.alpha_composite(img, photo_layer(post))
    d = ImageDraw.Draw(img)

    # Gold frame accents and footer
    d.rectangle((0, 0, W, 8), fill=GOLD)
    d.rectangle((0, H - FOOT, W, H), fill=(1, 30, 23, 255))
    d.rectangle((0, H - FOOT, W, H - FOOT + 3), fill=GOLD)

    # Forum label pill
    lf = font('seguisb.ttf', 22)
    label = post['label'].upper()
    lw = d.textlength(label, font=lf)
    d.rounded_rectangle((56, 50, 56 + lw + 40, 92), radius=21, fill=GOLD)
    d.text((76, 71), label, font=lf, fill=EMERALD_DARK, anchor='lm')

    # Headline in the left column; soft shadow keeps it readable over the fade.
    # A card without a headline is a blank the Newsdesk bot writes each post's
    # own headline onto (supabase/functions/newsdesk-banner).
    if post.get('thumb_title'):
        col_w = 560
        for size in (54, 50, 46, 42, 38):
            hf = font('segoeuib.ttf', size)
            lines = wrap(d, post['thumb_title'], hf, col_w)
            if len(lines) <= 4:
                break
        shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        sdraw = ImageDraw.Draw(shadow)
        y = 122
        for line in lines:
            sdraw.text((58, y + 3), line, font=hf, fill=(0, 0, 0, 170))
            y += int(size * 1.2)
        img = Image.alpha_composite(img, shadow.filter(ImageFilter.GaussianBlur(4)))
        d = ImageDraw.Draw(img)
        y = 122
        for line in lines:
            d.text((56, y), line, font=hf, fill=(255, 255, 255))
            y += int(size * 1.2)
        d.rectangle((56, y + 16, 150, y + 21), fill=GOLD)
        d.text((56, y + 36), 'Join the discussion on AbiaConnect', font=font('segoeui.ttf', 25), fill=MINT)

    # Gold key-figure badge on the photo (forum cards have no figure)
    if post.get('stat'):
        sf_size = 64
        for sf_size in (64, 56, 48, 42, 36):
            sf = font('segoeuib.ttf', sf_size)
            if d.textlength(post['stat'], font=sf) <= 250:
                break
        slf = font('seguisb.ttf', 19)
        sl = wrap(d, post['stat_label'], slf, 250)[:2]
        bw = int(max(d.textlength(post['stat'], font=sf), *(d.textlength(t, font=slf) for t in sl))) + 48
        bh = sf_size + 28 + 26 * len(sl)
        bx1, by1 = W - 40, H - FOOT - 62
        bx0, by0 = bx1 - bw, by1 - bh
        badge = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        bd = ImageDraw.Draw(badge)
        bd.rounded_rectangle((bx0 + 4, by0 + 6, bx1 + 4, by1 + 6), radius=22, fill=(0, 0, 0, 110))
        badge = badge.filter(ImageFilter.GaussianBlur(6))
        img = Image.alpha_composite(img, badge)
        d = ImageDraw.Draw(img)
        d.rounded_rectangle((bx0, by0, bx1, by1), radius=22, fill=GOLD)
        cx = (bx0 + bx1) / 2
        d.text((cx, by0 + 12 + sf_size / 2), post['stat'], font=sf, fill=EMERALD_DARK, anchor='mm')
        for i, line in enumerate(sl):
            d.text((cx, by0 + sf_size + 26 + i * 26), line, font=slf, fill=(20, 60, 45), anchor='mm')

    # Photo credit (required by the photo licences)
    cf = font('segoeui.ttf', 15)
    d.text((W - 40, H - FOOT - 22), credit_text(post), font=cf, fill=(235, 245, 240), anchor='rm')

    # Footer: logo + site
    lg = logo.copy()
    lg.thumbnail((140, 62))
    img.alpha_composite(lg, (56, H - 46 - lg.height // 2))
    d.text((56 + lg.width + 18, H - 46), 'abiaconnect.com', font=font('seguisb.ttf', 26), fill=(255, 255, 255), anchor='lm')
    d.text((W - 40, H - 46), 'Connecting Abians Worldwide', font=font('segoeui.ttf', 24), fill=GOLD_LIGHT, anchor='rm')

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"{post['slug']}.jpg")
    img.convert('RGB').save(path, 'JPEG', quality=86, optimize=True, progressive=True)
    return path


if __name__ == '__main__':
    logo = Image.open(os.path.join(ROOT, 'public', 'brand-logo.png')).convert('RGBA')
    only = sys.argv[1:]
    for p in POSTS:
        if only and p['slug'] not in only:
            continue
        path = make(p, logo)
        print(os.path.basename(path), os.path.getsize(path) // 1024, 'KB')
