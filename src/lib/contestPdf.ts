import { format } from 'date-fns'
import { isNativeApp } from '@/components/mobile/NativeAuthLayout'
import { openExternal } from '@/lib/openExternal'
import { supabase } from '@/lib/supabase'
import { positionWinners, type ContestDetail } from '@/lib/engagement'

/**
 * Contest results certificates and voter-code ballot slips as PDF files, so
 * they work in the phone app too (it can't print a web page). Pages are drawn
 * with the phone's own fonts, so names with Igbo letters (ọ, ụ, ṅ) come out right.
 */

const SITE = 'https://abiaconnect.com'
const BUCKET = 'contest-prints'
// A4 at 150 dots per inch.
const W = 1240
const H = 1754
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'
const SERIF = 'Georgia, "Times New Roman", serif'

type Group = ContestDetail['positions'][number] & { candidates: ContestDetail['candidates'] }

function page(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no_canvas')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#000'
  ctx.textBaseline = 'top'
  return { canvas, ctx }
}

/** Writes text inside a width, wrapping at spaces; returns the y below it. */
function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, lineHeight: number, align: CanvasTextAlign = 'left') {
  ctx.textAlign = align
  const words = text.split(/\s+/)
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (ctx.measureText(next).width > width && line) {
      ctx.fillText(line, x, y)
      y += lineHeight
      line = w
    } else line = next
  }
  if (line) {
    ctx.fillText(line, x, y)
    y += lineHeight
  }
  return y
}

async function toPdf(pages: HTMLCanvasElement[]): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  pages.forEach((p, i) => {
    if (i) pdf.addPage()
    // Black text on white compresses well; this keeps each page small.
    pdf.addImage(p.toDataURL('image/jpeg', 0.72), 'JPEG', 0, 0, 210, 297, undefined, 'FAST')
  })
  return pdf.output('blob')
}

export function certificatePages(c: ContestDetail, groups: Group[], votesFor: (id: string) => number): HTMLCanvasElement[] {
  const pages: HTMLCanvasElement[] = []
  let { canvas, ctx } = page()
  const frame = () => {
    ctx.strokeStyle = '#b8860b'
    ctx.lineWidth = 6
    ctx.strokeRect(50, 50, W - 100, H - 100)
    ctx.lineWidth = 2
    ctx.strokeRect(64, 64, W - 128, H - 128)
  }
  frame()
  let y = 120
  ctx.font = `600 22px ${SANS}`
  y = wrap(ctx, 'ABIACONNECT  ·  CERTIFICATE OF RESULT', W / 2, y, W - 240, 30, 'center') + 24
  ctx.font = `700 52px ${SERIF}`
  y = wrap(ctx, c.title, W / 2, y, W - 240, 64, 'center') + 4
  if (c.subgroup_name) {
    ctx.font = `28px ${SERIF}`
    y = wrap(ctx, c.subgroup_name, W / 2, y, W - 240, 38, 'center')
  }
  ctx.font = `24px ${SANS}`
  y = wrap(
    ctx,
    `Voting held ${format(new Date(c.starts_at), 'd MMMM yyyy')} to ${format(new Date(c.ends_at), 'd MMMM yyyy, h:mm a')}`,
    W / 2,
    y + 8,
    W - 240,
    32,
    'center',
  )
  y += 30

  const left = 130
  const right = W - 130
  for (const p of groups) {
    const total = p.candidates.reduce((s, k) => s + votesFor(k.id), 0)
    const { winners, tie } = positionWinners(p.candidates.map((k) => k.id), votesFor, p.max_choices)
    const rows = [...p.candidates].sort((a, b) => votesFor(b.id) - votesFor(a.id))
    if (y + 70 + rows.length * 40 > H - 260) {
      pages.push(canvas)
      ;({ canvas, ctx } = page())
      frame()
      y = 120
    }
    ctx.font = `700 30px ${SANS}`
    ctx.textAlign = 'left'
    const heading = `${p.title}${p.max_choices > 1 ? ` (top ${p.max_choices} elected)` : ''}${tie ? ' · tie to be settled by the organiser' : ''}`
    y = wrap(ctx, heading, left, y, right - left, 38)
    ctx.fillRect(left, y + 2, right - left, 2)
    y += 14
    for (const k of rows) {
      const won = winners.includes(k.id)
      const v = votesFor(k.id)
      ctx.font = `${won ? '700' : '400'} 26px ${SANS}`
      ctx.textAlign = 'left'
      ctx.fillText(`${won ? '★ ' : ''}${k.name}`, left, y, right - left - 330)
      ctx.textAlign = 'right'
      ctx.fillText(`${v.toLocaleString()} ${v === 1 ? 'vote' : 'votes'}`, right - 110, y)
      ctx.fillText(`${total ? Math.round((v / total) * 100) : 0}%`, right, y)
      y += 40
    }
    y += 26
  }

  ctx.font = `22px ${SANS}`
  let foot = H - 250
  foot = wrap(
    ctx,
    `${c.turnout.toLocaleString()} ${c.turnout === 1 ? 'person' : 'people'} voted${
      c.eligible_members ? ` out of ${c.eligible_members.toLocaleString()} members allowed to vote` : ''
    }. Secret ballot: no one, including the organisers, can see how anyone voted. Each person could vote only once.`,
    W / 2,
    foot,
    W - 260,
    30,
    'center',
  )
  ctx.font = `20px ${SANS}`
  wrap(ctx, `Reference ${c.id.slice(0, 8).toUpperCase()} · Check this result at ${SITE}/contests/${c.id}`, W / 2, foot + 10, W - 260, 28, 'center')
  pages.push(canvas)
  return pages
}

export function slipPages(c: ContestDetail, codes: string[]): HTMLCanvasElement[] {
  const cols = 2
  const rows = 6
  const margin = 60
  const sw = (W - margin * 2) / cols
  const sh = (H - margin * 2) / rows
  const pages: HTMLCanvasElement[] = []
  for (let start = 0; start < codes.length; start += cols * rows) {
    const { canvas, ctx } = page()
    codes.slice(start, start + cols * rows).forEach((code, i) => {
      const x = margin + (i % cols) * sw
      const y = margin + Math.floor(i / cols) * sh
      ctx.setLineDash([10, 8])
      ctx.strokeStyle = '#888'
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, sw, sh)
      ctx.setLineDash([])
      const pad = 22
      let ty = y + pad
      ctx.font = `600 16px ${SANS}`
      ty = wrap(ctx, 'ABIACONNECT BALLOT SLIP', x + pad, ty, sw - pad * 2, 22)
      ctx.font = `700 22px ${SANS}`
      ty = wrap(ctx, c.title, x + pad, ty + 4, sw - pad * 2, 28)
      ctx.font = `700 40px ui-monospace, "Courier New", monospace`
      ctx.textAlign = 'left'
      ctx.fillText(code, x + pad, ty + 8)
      ty += 62
      ctx.font = `16px ${SANS}`
      wrap(
        ctx,
        `Open ${SITE}/contests/${c.id} or this contest in the AbiaConnect app, sign in, make your choice, enter this code and submit. The code works once. Closes ${format(new Date(c.ends_at), 'd MMM yyyy, h:mm a')}.`,
        x + pad,
        ty,
        sw - pad * 2,
        21,
      )
    })
    pages.push(canvas)
  }
  return pages
}

/**
 * On the website: downloads the PDF. In the app: keeps it privately for a few
 * minutes and opens it in the phone's PDF viewer, to save, print or share.
 */
export async function savePdf(pages: HTMLCanvasElement[], filename: string): Promise<void> {
  const blob = await toPdf(pages)
  if (!isNativeApp()) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
    return
  }
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth.user?.id
  if (!uid) throw new Error('not_authenticated')
  await clearContestPrints(uid)
  const path = `${uid}/${crypto.randomUUID()}-${filename}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'application/pdf', upsert: false })
  if (error) throw error
  const { data, error: signErr } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600)
  if (signErr || !data?.signedUrl) throw signErr ?? new Error('no_link')
  await openExternal(data.signedUrl)
  // The phone's viewer has the file once the member comes back to the app, so
  // remove it then: nothing stays in storage.
  const cleanUp = () => {
    if (document.visibilityState !== 'visible') return
    document.removeEventListener('visibilitychange', cleanUp)
    window.setTimeout(() => void clearContestPrints(uid).catch(() => undefined), 3000)
  }
  document.addEventListener('visibilitychange', cleanUp)
}

/** Removes a member's earlier PDFs, so ballot codes don't sit in storage. */
export async function clearContestPrints(uid: string): Promise<void> {
  const { data } = await supabase.storage.from(BUCKET).list(uid, { limit: 100 })
  if (data?.length) await supabase.storage.from(BUCKET).remove(data.map((f) => `${uid}/${f.name}`))
}

export function pdfName(title: string, kind: 'results' | 'ballot-slips') {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    // ọ becomes o: drop the accent marks that NFKD splits off.
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
  return `${slug || 'contest'}-${kind}.pdf`
}
