import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import StaticPage from '@/components/layout/StaticPage'

export default function SuccessStories() {
  return (
    <StaticPage
      badge="Inspiration"
      title="Success Stories"
      subtitle="Celebrating the Abians whose work, vision, and dedication make us proud."
    >
      <p>
        Every week, AbiaConnect members share stories of remarkable achievement — entrepreneurs
        launching new ventures, students winning international scholarships, communities completing
        development projects, and professionals reaching new heights in their careers.
      </p>
      <p>
        These stories are shared and celebrated directly within our community forum, where readers
        can leave congratulations, ask questions, and connect with the people behind the success.
      </p>

      <h2>Share Your Story</h2>
      <p>
        Have you — or someone you know — achieved something worth celebrating? Post your story in
        the community forum and tag it with <strong>#SuccessStory</strong>. We feature the most
        inspiring submissions on the homepage every month.
      </p>

      <div className="not-prose flex flex-wrap gap-3 pt-4">
        <Button asChild>
          <Link to="/">Read Community Stories</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/create-thread">Share Your Story</Link>
        </Button>
      </div>
    </StaticPage>
  )
}
