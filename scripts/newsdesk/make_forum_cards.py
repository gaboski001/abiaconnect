# One share picture and share page per forum, for the daily Newsdesk bot.
# The bot writes new threads every day, so they can't each have a hand-made
# thumbnail; instead every bot thread shares its forum's page:
#   /share/forum-<forum>.html?t=<thread id>
# Facebook and WhatsApp show the forum's picture (public/og/forum-<forum>.jpg)
# and the page sends readers on to the thread named in ?t=.
# Photos are the ones already credited in photos/credits.json.
# Run: python scripts/newsdesk/make_forum_cards.py
import html
import json
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from make_thumbs import ROOT, make  # noqa: E402
from posts import POSTS  # noqa: E402

SITE = 'https://abiaconnect.com'
# Bump when the pictures are redrawn: Facebook caches pictures by address.
IMG_VERSION = 1
# The October flood photo suits that story, not the forum as a whole.
PHOTO_OVERRIDES = {
    'real-estate-housing': ('Abia_state_tower_jpg.jpg', None, 'Abia State Tower'),
}
# Forums added after the October 2026 posts (posts.py has one post per older forum).
EXTRA_FORUMS = [
    # No people in this photo: a face on the card would sit beside every gossip headline.
    {'forum': 'gossip', 'label': 'Gossip', 'photo': 'A_dynamic_XLR_microphone_WEISRE_DM_701_jpg.jpg',
     'photo_box': None, 'photo_caption': 'Microphone'},
    {'forum': 'institutions', 'label': 'Institutions', 'photo': 'Pupils_doing_online_tests_jpg.jpg',
     'photo_box': None, 'photo_caption': 'Students at computers'},
]

PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta property="og:site_name" content="AbiaConnect">
<meta property="og:type" content="article">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="{image}">
<meta property="og:image:secure_url" content="{image}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{title}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{image}">
<meta name="robots" content="noindex, follow">
<style>body{{margin:0;font-family:system-ui,sans-serif;background:#022c22;color:#ecfdf5;display:grid;place-items:center;min-height:100vh;text-align:center;padding:16px}}a{{color:#f0d278}}img{{max-width:100%;height:auto;border-radius:12px}}</style>
<script>
var t = new URLSearchParams(location.search).get('t') || '';
var ok = /^[0-9a-f]{{8}}-[0-9a-f]{{4}}-[0-9a-f]{{4}}-[0-9a-f]{{4}}-[0-9a-f]{{12}}$/i.test(t);
location.replace(ok ? {site_js} + '/thread/' + t : {site_js} + '/');
</script>
</head>
<body>
<main>
<img src="{image}" width="600" height="315" alt="{title}">
<p><a href="{site}/">Open the discussion on AbiaConnect</a></p>
</main>
</body>
</html>
"""


def forum_cards():
    for p in [*POSTS, *EXTRA_FORUMS]:
        photo, box, caption = PHOTO_OVERRIDES.get(p['forum'], (p['photo'], p['photo_box'], p['photo_caption']))
        yield {
            'slug': f"forum-{p['forum']}",
            'label': p['label'],
            'thumb_title': f"{p['label']}: today's talking point",
            'photo': photo,
            'photo_box': box,
            'photo_caption': caption,
        }


if __name__ == '__main__':
    logo = Image.open(os.path.join(ROOT, 'public', 'brand-logo.png')).convert('RGBA')
    out = os.path.join(ROOT, 'public', 'share')
    os.makedirs(out, exist_ok=True)
    for card in forum_cards():
        # The blank the bot writes each post's own headline onto.
        blank = make({**card, 'slug': card['slug'].replace('forum-', 'base-', 1), 'thumb_title': ''}, logo)
        print(os.path.basename(blank), os.path.getsize(blank) // 1024, 'KB')
        path = make(card, logo)
        page = PAGE.format(
            title=html.escape(f"{card['label']}: today's talking point on AbiaConnect"),
            desc=html.escape(f"Join the {card['label']} discussion on AbiaConnect, the community forum for Abians at home and abroad."),
            image=f"{SITE}/og/{card['slug']}.jpg?v={IMG_VERSION}",
            site=SITE,
            site_js=json.dumps(SITE),
        )
        with open(os.path.join(out, f"{card['slug']}.html"), 'w', encoding='utf-8', newline='\n') as f:
            f.write(page)
        print(os.path.basename(path), os.path.getsize(path) // 1024, 'KB')
