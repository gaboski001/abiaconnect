// Draws a Newsdesk post's own banner: the post's headline written onto a
// blank card of its forum. 1200x630, the size Facebook and WhatsApp use for
// link previews. Same layout as the hand-made October 2026 thumbnails.
//
// Two blank cards per forum, made by scripts/newsdesk/make_forum_cards.py with
// the forum label and footer already on them:
//   public/og/base-<forum>.jpg   with the forum's stock photo and its credit
//   public/og/plain-<forum>.jpg  with no photo, for the report's own picture
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

// Where the photo sits on a plain card (the same place as on the stock cards).
const PHOTO_X = 470
const PHOTO_Y = 8 // under the gold line along the top
const PHOTO_W = 730
const PHOTO_H = 530 // down to the footer
const FADE = 330 // the photo fades in from the left over this width

export interface BannerFonts {
  bold: Uint8Array
  regular: Uint8Array
}

/** A report's own picture, and who published it. */
export interface BannerPhoto {
  bytes: Uint8Array
  credit: string
}

/**
 * Returns the finished banner as JPEG bytes. With a photo, `base` must be the
 * forum's plain card; a picture that is too small to look good is refused
 * (the caller then draws the stock card instead).
 */
export async function renderBanner(base: Uint8Array, fonts: BannerFonts, headline: string, photo?: BannerPhoto): Promise<Uint8Array> {
  const img = await Image.decode(base)
  if (photo) await drawPhoto(img, photo)

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

/**
 * The report's picture on the right of the card, faded in from the left. No
 * credit is printed on it: the post names and links the newspaper under "Sources".
 */
async function drawPhoto(img: Image, photo: BannerPhoto): Promise<void> {
  const decoded = await Image.decode(photo.bytes)
  // A small picture stretched to this size looks blurred.
  if (decoded.width < 600 || decoded.height < 330) throw new Error('picture too small')
  const pic = decoded.cover(PHOTO_W, PHOTO_H)

  const px = pic.bitmap
  for (let y = 0; y < PHOTO_H; y++) {
    const row = y * PHOTO_W * 4
    // Fades in from the left, like the stock cards.
    for (let x = 0; x < FADE; x++) {
      const i = row + x * 4
      px[i + 3] = Math.round(px[i + 3] * Math.pow(x / FADE, 1.6))
    }
  }
  img.composite(pic, PHOTO_X, PHOTO_Y)
}
