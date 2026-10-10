// Draws a Newsdesk post's own banner: the post's headline written onto its
// forum's blank card (public/og/base-<forum>.jpg, made by
// scripts/newsdesk/make_forum_cards.py with the photo, forum label, photo
// credit and footer already on it). 1200x630, the size Facebook and WhatsApp
// use for link previews. Same layout as the hand-made October 2026 thumbnails.
import { Image, TextLayout } from 'https://deno.land/x/imagescript@1.3.0/mod.ts'
import { bannerHeadline } from './newsdesk-core.ts'

const LEFT = 56
const TOP = 118
const COLUMN = 570 // headline column width
const MAX_HEIGHT = 310 // room above the footer, leaving space for the line under the headline
const SIZES = [54, 50, 46, 42, 38, 34]
const WHITE = 0xffffffff
const SHADOW = 0x000000ff
const GOLD = 0xd4af37ff
const MINT = 0xa7f3d0ff

export interface BannerFonts {
  bold: Uint8Array
  regular: Uint8Array
}

/** Returns the finished banner as JPEG bytes. */
export async function renderBanner(base: Uint8Array, fonts: BannerFonts, headline: string): Promise<Uint8Array> {
  const img = await Image.decode(base)
  const layout = new TextLayout({ maxWidth: COLUMN, wrapStyle: 'word' })
  const text = bannerHeadline(headline)

  // The largest size at which the headline fits its space.
  let title = await Image.renderText(fonts.bold, SIZES[0], text, WHITE, layout)
  let size = SIZES[0]
  for (const s of SIZES) {
    title = await Image.renderText(fonts.bold, s, text, WHITE, layout)
    size = s
    if (title.height <= MAX_HEIGHT) break
  }
  if (title.height > MAX_HEIGHT) title = title.crop(0, 0, title.width, MAX_HEIGHT)

  // A soft dark copy underneath keeps the words readable where the photo begins.
  const shadow = (await Image.renderText(fonts.bold, size, text, SHADOW, layout)).opacity(0.55)
  if (shadow.height > MAX_HEIGHT) shadow.crop(0, 0, shadow.width, MAX_HEIGHT)
  img.composite(shadow, LEFT + 2, TOP + 3)
  img.composite(title, LEFT, TOP)

  const below = TOP + title.height + 14
  img.drawBox(LEFT, below, 94, 5, GOLD)
  const invite = await Image.renderText(fonts.regular, 25, 'Join the discussion on AbiaConnect', MINT)
  img.composite(invite, LEFT, below + 18)

  return await img.encodeJPEG(86)
}
