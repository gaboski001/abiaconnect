import StaticPage from '@/components/layout/StaticPage'
import { PHOTO_CREDITS } from '@/data/photoCredits'

// The photographers of the pictures on our banners and share pictures. Their
// free licences ask for a credit; it is given here rather than on each picture.
export default function PhotoCredits() {
  return (
    <StaticPage
      badge="Legal"
      title="Photo Credits"
      subtitle="The photographers whose pictures appear on AbiaConnect's banners and share pictures."
    >
      <p>
        Many of the pictures on our banners and link previews are free-licence photographs from Wikimedia Commons. We
        thank the photographers below. Each picture is used under the licence named beside it; some have been cropped
        and coloured to fit our banners.
      </p>
      <ul>
        {PHOTO_CREDITS.map((c) => (
          <li key={c.page}>
            <a href={c.page} target="_blank" rel="noopener noreferrer">
              {c.title}
            </a>{' '}
            by {c.artist},{' '}
            {c.licenseUrl ? (
              <a href={c.licenseUrl} target="_blank" rel="noopener noreferrer">
                {c.license}
              </a>
            ) : (
              c.license
            )}
          </li>
        ))}
      </ul>
      <h2>News Pictures</h2>
      <p>
        Some Newsdesk posts show a picture from the news report they discuss. Those pictures belong to the newspaper
        that published the report, which is named and linked under “Sources” in the post.
      </p>
      <h2>Is One of These Yours?</h2>
      <p>
        If you own a picture shown on AbiaConnect and would like it credited differently or removed, please tell us
        through the Report an Issue page and we will act on it promptly.
      </p>
    </StaticPage>
  )
}
