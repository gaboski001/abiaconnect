import { SEO } from '@/components/SEO'

const sections = [
  {
    h: 'Aba — the commercial capital of the South-East',
    p: 'Aba is the largest city in Abia State and one of Nigeria\'s most important industrial and trading hubs. The city is home to the Ariaria International Market, one of the biggest open-air markets in West Africa, and to thousands of small-scale manufacturers producing shoes, leather goods, garments and cosmetics. The phrase "Made in Aba" has become shorthand for Nigerian-made consumer goods exported across Africa.',
  },
  {
    h: 'Akwete cloth and a deep textile heritage',
    p: 'Abia State is internationally known for the Akwete cloth — a hand-woven fabric produced in Akwete town in Ukwa East LGA. Akwete weaving is a centuries-old tradition passed down through generations of Igbo women, and the cloth is prized for its intricate motifs and cultural symbolism.',
  },
  {
    h: 'Arochukwu and the Long Juju oracle',
    p: 'Arochukwu, in the north-east of Abia State, was the seat of the powerful Aro Confederacy and home to the famous Ibini Ukpabi (Long Juju) oracle that shaped pre-colonial politics, trade and religion across Igboland. The Long Juju cave remains an important tourist and heritage site.',
  },
  {
    h: 'Umuahia — capital city, history and education',
    p: 'Umuahia is the capital of Abia State and hosts the National War Museum, which preserves artefacts from the Nigerian Civil War, including the Ojukwu Bunker. Nearby Umudike is home to Michael Okpara University of Agriculture — one of Nigeria\'s leading agricultural universities — and the National Root Crops Research Institute.',
  },
  {
    h: 'Palm produce, agriculture and natural resources',
    p: 'Abia\'s economy is anchored by agriculture: palm oil, cassava, yam, maize, cocoyam and rice are widely cultivated. The state also has reserves of crude oil, natural gas, limestone, kaolin and salt, making it both an agricultural and a resource-rich state.',
  },
  {
    h: 'Igbo culture, festivals and language',
    p: 'Abia is part of the Igbo cultural heartland. Communities across the state celebrate the New Yam (Iri-ji) festival, Ikeji in Arochukwu, and a rich tradition of masquerades, highlife music and Igbo poetry. Igbo is the dominant language, alongside Nigerian English and Pidgin.',
  },
  {
    h: 'Notable people from Abia State',
    p: 'Abia has produced influential Nigerians across politics, sport, business and the arts — including former Vice-President Alex Ekwueme, football legend Kanu Nwankwo (born in Owerri but with Abia roots through the Igbo diaspora networks), Senator Orji Uzor Kalu, and many entrepreneurs driving the "Made in Aba" movement.',
  },
]

export default function KnownFor() {
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'What is Abia State Known For? Economy, Tourism, and Culture',
    description:
      'A guide to what Abia State is known for — Aba commerce, Akwete cloth, the Long Juju of Arochukwu, Umuahia\'s history, agriculture, Igbo culture and notable Abians.',
    author: { '@type': 'Organization', name: 'AbiaConnect' },
    publisher: { '@type': 'Organization', name: 'AbiaConnect' },
    mainEntityOfPage: 'https://abiaconnect.com/about/known-for',
  }
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is Abia State most known for?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Abia State is best known for the commercial city of Aba and its "Made in Aba" manufacturing, the Akwete hand-woven cloth, the historic Long Juju oracle at Arochukwu, and Umuahia\'s role as a centre of education and Nigerian Civil War history.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is the capital of Abia State?',
        acceptedAnswer: { '@type': 'Answer', text: 'Umuahia is the capital of Abia State.' },
      },
      {
        '@type': 'Question',
        name: 'What products is Aba famous for?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Aba is famous for leather goods, shoes, garments, cosmetics and small-scale manufacturing sold across Nigeria and West Africa under the "Made in Aba" label.',
        },
      },
    ],
  }
  return (
    <>
      <SEO
        title="What is Abia State Known For? Economy, Tourism, Culture"
        description="Discover what Abia State is known for — the commercial city of Aba, Akwete cloth, the Long Juju of Arochukwu, Umuahia's history, palm produce, Igbo culture and notable Abians."
        path="/about/known-for"
        ogType="article"
        jsonLd={[articleLd, faqLd]}
      />
      <article className="max-w-4xl mx-auto space-y-8 py-6">
        <header className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">
            What is Abia State Known For? Economy, Tourism, and Culture
          </h1>
          <p className="text-lg text-muted-foreground">
            Abia State, in south-eastern Nigeria, is one of the country\'s most influential
            states — known for trade and manufacturing in Aba, the Akwete cloth, the
            historic Long Juju of Arochukwu, and a deep Igbo cultural heritage. This guide
            covers what Abia is most famous for, from economy and tourism to culture and
            notable people.
          </p>
        </header>

        {sections.map((s) => (
          <section key={s.h} className="rounded-2xl border border-border bg-card p-6 space-y-2">
            <h2 className="text-xl font-semibold">{s.h}</h2>
            <p className="text-muted-foreground">{s.p}</p>
          </section>
        ))}

        <section className="rounded-2xl border border-border bg-muted/40 p-6 space-y-2">
          <h2 className="text-xl font-semibold">Discuss Abia on AbiaConnect</h2>
          <p className="text-muted-foreground">
            Join the conversation with Abians at home and in the diaspora — share what your
            town is known for, swap travel tips, and discover stories from every LGA in
            Abia State.
          </p>
        </section>
      </article>
    </>
  )
}
