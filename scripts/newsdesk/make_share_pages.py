# Writes public/share/<slug>.html for each post: a tiny page with Open Graph
# tags (so Facebook/WhatsApp show the thumbnail, title and summary) that sends
# people straight on to the thread. Facebook's crawler does not run the
# website's JavaScript, so the normal /thread/<id> page can't give it a picture.
# Thread ids are fixed in ids.json so the pages can be built before posting.
import html
import json
import os
import re
import sys
import uuid

sys.path.insert(0, os.path.dirname(__file__))
from posts import POSTS  # noqa: E402

HERE = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SITE = 'https://abiaconnect.com'
IDS = os.path.join(HERE, 'ids.json')

ids = json.load(open(IDS)) if os.path.exists(IDS) else {}
for p in POSTS:
    ids.setdefault(p['slug'], str(uuid.uuid4()))
json.dump(ids, open(IDS, 'w'), indent=2)


def summary(body, limit=200):
    text = re.sub(r'<[^>]+>', ' ', body)
    text = html.unescape(re.sub(r'\s+', ' ', text)).strip()
    return text if len(text) <= limit else text[: limit - 1].rsplit(' ', 1)[0] + '…'


PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{thread}">
<meta property="og:site_name" content="AbiaConnect">
<meta property="og:type" content="article">
<meta property="og:url" content="{share}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="{image}">
<meta property="og:image:secure_url" content="{image}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{alt}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{image}">
<meta name="robots" content="noindex, follow">
<style>body{{margin:0;font-family:system-ui,sans-serif;background:#022c22;color:#ecfdf5;display:grid;place-items:center;min-height:100vh;text-align:center;padding:16px}}a{{color:#f0d278}}img{{max-width:100%;height:auto;border-radius:12px}}</style>
<script>location.replace({thread_js});</script>
</head>
<body>
<main>
<img src="{image}" width="600" height="315" alt="{alt}">
<p><a href="{thread}">Open the discussion on AbiaConnect</a></p>
</main>
</body>
</html>
"""

out = os.path.join(ROOT, 'public', 'share')
os.makedirs(out, exist_ok=True)

# Thread id -> share page, read by post-thread-to-facebook so the admin
# "Share to Facebook" button posts the share page (with its thumbnail).
# Pages added by hand later can be listed here too; existing entries are kept.
index_path = os.path.join(out, 'index.json')
index = json.load(open(index_path)) if os.path.exists(index_path) else {}
index.update({ids[p['slug']]: f"/share/{p['slug']}.html" for p in POSTS})
with open(index_path, 'w', encoding='utf-8', newline='\n') as f:
    json.dump(index, f, indent=2)
    f.write('\n')

for p in POSTS:
    thread = f"{SITE}/thread/{ids[p['slug']]}"
    page = PAGE.format(
        title=html.escape(p['title']),
        desc=html.escape(summary(p['body'])),
        share=f"{SITE}/share/{p['slug']}.html",
        image=f"{SITE}/og/{p['slug']}.jpg",
        alt=html.escape(p['thumb_title']),
        thread=thread,
        thread_js=json.dumps(thread),
    )
    with open(os.path.join(out, f"{p['slug']}.html"), 'w', encoding='utf-8', newline='\n') as f:
        f.write(page)
    print(f"{SITE}/share/{p['slug']}.html")
