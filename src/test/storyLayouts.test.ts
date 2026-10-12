import { describe, expect, it } from 'vitest'
import { STORY_LAYOUTS, emptySections, hintForHeading, layoutHtml, readingStats } from '@/lib/storyLayouts'

describe('story layouts', () => {
  it('puts in an opening line and one heading per section, each with a line to write on', () => {
    const news = STORY_LAYOUTS.find((l) => l.id === 'news')!
    expect(layoutHtml(news)).toBe(
      '<p></p><h3>The details</h3><p></p><h3>Why it matters</h3><p></p><h3>Over to you</h3><p></p><h3>Source</h3><p></p>',
    )
  })

  it('has guide text for every heading of every layout', () => {
    for (const layout of STORY_LAYOUTS) {
      for (const s of layout.sections) expect(hintForHeading(` ${s.heading.toUpperCase()} `)).toBe(s.hint)
    }
    expect(hintForHeading('My own heading')).toBe('')
  })

  it('names the headings with nothing written under them', () => {
    const untouched = layoutHtml(STORY_LAYOUTS[0])
    expect(emptySections(untouched)).toEqual(['The details', 'Why it matters', 'Over to you', 'Source'])

    const partly = '<p>Opening.</p><h3>The details</h3><p>Facts.</p><h3>Why it matters</h3><p></p><h3>Source</h3><p>   </p>'
    expect(emptySections(partly)).toEqual(['Why it matters', 'Source'])
  })

  it('accepts a finished post, with lists, pictures and smaller headings under a heading', () => {
    const done =
      '<p>Opening.</p><h2>Part one</h2><h3>Detail</h3><ul><li><p>Point</p></li></ul>' +
      '<h3>Picture</h3><figure><img src="https://example.com/a.jpg"></figure><h3>Over to you</h3><ol><li><p>What do you think?</p></li></ol>'
    expect(emptySections(done)).toEqual([])
    expect(emptySections('<p>No headings at all.</p>')).toEqual([])
  })

  it('counts words and reading time', () => {
    expect(readingStats('   ')).toEqual({ words: 0, minutes: 1 })
    expect(readingStats('Aba traders reopen the market')).toEqual({ words: 5, minutes: 1 })
    expect(readingStats(Array(500).fill('word').join(' '))).toEqual({ words: 500, minutes: 3 })
  })
})
