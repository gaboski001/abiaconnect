# Background pictures for the home page's hero slides (public/banners/hero-*.webp).
# Each slide's words stay as live text on the page; the picture behind them
# shows what the slide is about. Pictures are graded dark emerald so white text
# stays readable, and carry the photographer's credit where the licence asks.
# Photos are free-licence images from Wikimedia Commons (credits in
# scripts/newsdesk/photos/credits.json).
# Run: python scripts/banners/make_hero_backgrounds.py
import json
import os

from PIL import Image, ImageDraw, ImageFont, ImageOps

HERE = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
PHOTOS = os.path.join(ROOT, 'scripts', 'newsdesk', 'photos')
OUT = os.path.join(ROOT, 'public', 'banners')
CREDITS = json.load(open(os.path.join(PHOTOS, 'credits.json'), encoding='utf-8'))
W, H = 1600, 640  # the hero is wide on computers; phones show the middle of the picture
EMERALD_DARK = (2, 44, 34)

# slide -> (photo, where to centre the crop, caption)
SLIDES = {
    # "AbiaConnect: Indigenous Unity" (trade, culture, community)
    'hero-welcome': ('ABA_MAIN_PARK_jpg.jpg', (0.5, 0.7), 'Aba Main Park'),
    # "One People. One Voice. One Platform." (badge: Tower! Great)
    'hero-tower': ('Abia_state_tower_jpg.jpg', (0.5, 0.1), 'Abia State Tower, Umuahia'),
    # "Distance Doesn't Divide Us" (Abians abroad)
    'hero-diaspora': ('Airplane_wing_sky_and_clouds_jpg.jpg', (0.5, 0.6), 'In flight above the clouds'),
}


def credit(photo, caption):
    c = CREDITS[photo]
    lic = c['license'] or ''
    who = f"Photo: {c['artist']} (CC0)" if lic.upper() in ('CC0', 'PUBLIC DOMAIN') else f"Photo: {c['artist']}, {lic}"
    return f'{caption}  ·  {who} / Wikimedia Commons'


def make(name, photo, centre, caption):
    src = Image.open(os.path.join(PHOTOS, photo)).convert('RGB')
    img = ImageOps.fit(src, (W, H), Image.LANCZOS, centering=centre)
    # Light emerald grade, a little darker in the middle band where the words sit.
    # (The page adds its own shade over the picture: SlideCard.tsx.)
    img = Image.blend(img, Image.new('RGB', (W, H), EMERALD_DARK), 0.22).convert('RGBA')
    shade = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(shade)
    for y in range(H):
        t = 1 - abs((y / H) - 0.5) * 2  # 1 in the middle, 0 at top and bottom
        d.line((0, y, W, y), fill=(0, 20, 14, int(15 + 45 * t)))
    img = Image.alpha_composite(img, shade)
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 20)
    d.text((W - 28, H - 22), credit(photo, caption), font=font, fill=(235, 245, 240, 230), anchor='rm')
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f'{name}.webp')
    img.convert('RGB').save(path, 'WEBP', quality=80, method=6)
    return path


if __name__ == '__main__':
    for name, (photo, centre, caption) in SLIDES.items():
        path = make(name, photo, centre, caption)
        print(os.path.basename(path), os.path.getsize(path) // 1024, 'KB')
