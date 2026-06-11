import { SEO } from '@/components/SEO'

const FAQS = [
  {
    q: 'Where is Abia State University located?',
    a: 'The main campus of Abia State University (ABSU) is in Uturu, Isuikwuato Local Government Area of Abia State, Nigeria. The College of Medicine and Health Sciences sits on a separate campus in Aba.',
  },
  {
    q: 'Is ABSU a federal or state university?',
    a: 'ABSU is a state university. It is owned and funded by the Abia State Government and was established by Edict No. 5 of 1981, making it one of the oldest state universities in southeastern Nigeria.',
  },
  {
    q: 'When was Abia State University founded?',
    a: 'ABSU was founded in 1981 as Imo State University and was renamed Abia State University in 1991 after the creation of Abia State from the old Imo State.',
  },
  {
    q: 'What faculties does ABSU offer?',
    a: 'ABSU runs faculties of Agriculture, Biological & Physical Sciences, Business Administration, Education, Engineering, Environmental Sciences, Humanities, Law, Medicine & Health Sciences, Pharmacy, and Social Sciences.',
  },
  {
    q: 'How is ABSU ranked among Nigerian universities?',
    a: 'ABSU consistently ranks among the top 40–60 universities in Nigeria in major league tables and is particularly well regarded for its Law, Medicine, and Pharmacy programmes.',
  },
  {
    q: 'What is ABSU known for?',
    a: 'ABSU is best known for producing Nigeria’s first generation of state-trained medical doctors and lawyers from the southeast, its vibrant campus life in Uturu, and its annual matriculation and convocation ceremonies that draw alumni from across the world.',
  },
]

const SECTIONS = [
  {
    title: 'Location and campuses',
    body:
      'ABSU operates two campuses. The main campus in Uturu (Isuikwuato LGA) houses most undergraduate programmes, the Senate building, library, and student hostels. The Aba campus on Faulks Road hosts the College of Medicine and Health Sciences. A satellite study centre in Umuahia supports continuing education programmes.',
  },
  {
    title: 'History',
    body:
      'Established in 1981 as Imo State University by the old Imo State government, the institution was renamed Abia State University in 1991 when Abia was carved out of Imo. ABSU has graduated more than 100,000 students since its first matriculation and remains a flagship of higher education in the southeast.',
  },
  {
    title: 'Faculties and programmes',
    body:
      'ABSU offers undergraduate, postgraduate, and professional programmes across 11 faculties. Popular courses include Law (LL.B), Medicine and Surgery (MBBS), Pharmacy (B.Pharm), Nursing, Accounting, Mass Communication, Computer Science, Agricultural Economics, and Electrical Engineering. The School of Postgraduate Studies awards PGDs, masters, and doctoral degrees.',
  },
  {
    title: 'Admission and JAMB',
    body:
      'Candidates apply through JAMB UTME and must meet ABSU’s post-UTME screening cut-off (typically 180 and above, higher for Medicine and Law). Direct entry is available for OND, HND, NCE, and A-Level holders. The university also runs a Pre-Degree programme for prospective students who need to upgrade their entry credentials.',
  },
  {
    title: 'Notable alumni',
    body:
      'ABSU alumni include senators, federal ministers, Supreme Court justices, broadcast journalists, and Nollywood producers. The alumni association maintains active chapters in Lagos, Abuja, London, and Houston, and funds scholarships for indigent students each session.',
  },
  {
    title: 'Student life',
    body:
      'Uturu is a quintessential university town. Beyond lectures, students enjoy the annual Carnival Uturu, inter-faculty football and basketball leagues, a thriving press club, debating society, and dozens of religious and cultural fellowships. Off-campus, the rolling hills of Isuikwuato and nearby Okigwe offer weekend getaways.',
  },
]

export default function AbsuGuide() {
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Abia State University (ABSU) — Complete Guide',
      author: { '@type': 'Organization', name: 'AbiaConnect' },
      publisher: { '@type': 'Organization', name: 'AbiaConnect' },
      about: {
        '@type': 'CollegeOrUniversity',
        name: 'Abia State University',
        alternateName: 'ABSU',
        url: 'https://abiaconnect.com/about/absu',
        location: {
          '@type': 'Place',
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'Uturu',
            addressRegion: 'Abia State',
            addressCountry: 'NG',
          },
        },
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQS.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ]

  return (
    <>
      <SEO
        title="Abia State University (ABSU) — Complete Guide"
        description="A complete guide to Abia State University (ABSU) in Uturu — location, history, faculties, admissions, ranking, and notable alumni."
        path="/about/absu"
        ogType="article"
        jsonLd={jsonLd}
      />

      <article className="max-w-4xl mx-auto space-y-10 py-6">
        <header className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Abia State University (ABSU)</h1>
          <p className="text-lg text-muted-foreground">
            The complete guide to Abia State University — location in Uturu, history since 1981,
            faculties, admissions, ranking, and what makes ABSU one of southeast Nigeria’s flagship
            state universities.
          </p>
        </header>

        {SECTIONS.map((s) => (
          <section key={s.title} className="space-y-3">
            <h2 className="text-2xl font-semibold">{s.title}</h2>
            <p className="text-base leading-relaxed">{s.body}</p>
          </section>
        ))}

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Frequently asked questions</h2>
          <div className="space-y-4">
            {FAQS.map((f) => (
              <div key={f.q} className="rounded-xl border border-border bg-card p-4">
                <h3 className="font-semibold mb-1">{f.q}</h3>
                <p className="text-sm text-muted-foreground">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      </article>
    </>
  )
}
