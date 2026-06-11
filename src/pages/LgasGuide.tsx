import { SEO } from '@/components/SEO'

interface LGA {
  name: string
  headquarters: string
  history: string
  culture: string
}

const LGAS: LGA[] = [
  {
    name: 'Aba North',
    headquarters: 'Eziama',
    history: 'Carved out of the old Aba LGA in 1991, Aba North covers the northern half of the commercial city of Aba.',
    culture: 'Home to bustling markets and a vibrant Igbo trading community famous for leatherwork and garment manufacturing.',
  },
  {
    name: 'Aba South',
    headquarters: 'Aba',
    history: 'The administrative heart of Aba city, created in 1991 alongside Aba North.',
    culture: 'Hosts the famous Ariaria International Market — one of the largest markets in West Africa.',
  },
  {
    name: 'Arochukwu',
    headquarters: 'Arochukwu',
    history: 'Ancient seat of the Aro Confederacy and the legendary Ibini Ukpabi (Long Juju) oracle that influenced pre-colonial Igboland.',
    culture: 'Renowned for the Ikeji festival, Aro masquerades, and rich Aro-Igbo heritage.',
  },
  {
    name: 'Bende',
    headquarters: 'Bende',
    history: 'A historic trade hub on the old Aro slave route; became an LGA in 1976.',
    culture: 'Known for the Iri-ji (New Yam) festival and traditional Bende wrestling.',
  },
  {
    name: 'Ikwuano',
    headquarters: 'Isiala Oboro',
    history: 'Created in 1996, made up of four clans: Ibere, Oboro, Ariam, and Usaka.',
    culture: 'Agricultural community famous for palm produce; hosts Michael Okpara University of Agriculture, Umudike.',
  },
  {
    name: 'Isiala Ngwa North',
    headquarters: 'Mbawsi',
    history: 'Created in 1996 from the old Isiala Ngwa LGA; part of the Ngwa heartland.',
    culture: 'Strong Ngwa cultural identity expressed in the Ngwa New Yam festival.',
  },
  {
    name: 'Isiala Ngwa South',
    headquarters: 'Omoba',
    history: 'Carved out in 1996; birthplace of Nigeria’s first executive president, Dr. Nnamdi Azikiwe (maternal roots).',
    culture: 'Ngwa-speaking, with thriving palm oil and cassava production.',
  },
  {
    name: 'Isuikwuato',
    headquarters: 'Ovim',
    history: 'Among the original LGAs created in 1976; rich in pre-colonial Igbo settlements.',
    culture: 'Home of the Ovim and Isuikwuato hills, with the annual Iri-ji and Ekpe masquerade festivals.',
  },
  {
    name: 'Obi Ngwa',
    headquarters: 'Mgboko',
    history: 'Created in 1996; part of the larger Ngwa nation.',
    culture: 'Predominantly Ngwa, with deep oral traditions and palm wine tapping heritage.',
  },
  {
    name: 'Ohafia',
    headquarters: 'Ebem Ohafia',
    history: 'Famous warrior community whose ancestors migrated from Ibeku; established as an LGA in 1991.',
    culture: 'Celebrated for the Ohafia war dance (Iri Agha) and matrilineal inheritance practices.',
  },
  {
    name: 'Osisioma Ngwa',
    headquarters: 'Osisioma',
    history: 'Created in 1996; sits at the gateway to Aba along the Enugu–Port Harcourt expressway.',
    culture: 'Industrial belt of Aba with strong Ngwa traditional governance.',
  },
  {
    name: 'Ugwunagbo',
    headquarters: 'Obuzor',
    history: 'Carved out of Obingwa in 1996.',
    culture: 'Agrarian community with Ngwa cultural roots and palm-based economy.',
  },
  {
    name: 'Ukwa East',
    headquarters: 'Akwete',
    history: 'Part of the old Ukwa LGA split in 1996; lies in the southernmost reach of Abia.',
    culture: 'Famous worldwide for the handwoven Akwete cloth, a UNESCO-recognised textile tradition.',
  },
  {
    name: 'Ukwa West',
    headquarters: 'Okeikpe',
    history: 'Created in 1996; oil-producing area bordering Rivers State.',
    culture: 'Ukwa-speaking, known for traditional canoe transport along the Imo River.',
  },
  {
    name: 'Umuahia North',
    headquarters: 'Umuahia',
    history: 'Hosts the Abia State capital; established as an LGA in 1991.',
    culture: 'Home of the National War Museum and Government House; centre of Ibeku traditions.',
  },
  {
    name: 'Umuahia South',
    headquarters: 'Apumiri Ubakala',
    history: 'Sister LGA to Umuahia North, created in 1996.',
    culture: 'Ubakala people are famous for the Nkwa Umuagbogho maiden dance.',
  },
  {
    name: 'Umu Nneochi',
    headquarters: 'Nneochi',
    history: 'Created in 1991; northernmost LGA of Abia, sharing borders with Enugu and Benue states.',
    culture: 'Hilly terrain, mixed Igbo and migrant communities, known for limestone deposits.',
  },
]

export default function LgasGuide() {
  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '17 Local Government Areas of Abia State',
    itemListElement: LGAS.map((l, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: l.name,
    })),
  }

  return (
    <>
      <SEO
        title="The 17 LGAs of Abia State — Complete Guide"
        description="Explore all 17 Local Government Areas of Abia State — headquarters, history and culture from Aba North to Umu Nneochi."
        path="/about/lgas"
        ogType="article"
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />

      <article className="max-w-4xl mx-auto space-y-10 py-6">
        <header className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">
            The 17 Local Government Areas of Abia State
          </h1>
          <p className="text-lg text-muted-foreground">
            Abia State, in south-eastern Nigeria, is divided into seventeen Local Government
            Areas (LGAs). This guide lists every LGA in Abia State together with its
            administrative headquarters, a short history, and the cultural highlights that
            make it unique.
          </p>
        </header>

        <section className="rounded-2xl border border-border bg-card p-6 space-y-3">
          <h2 className="text-xl font-semibold">What are the 17 local governments in Abia State?</h2>
          <p className="text-muted-foreground">
            The seventeen LGAs of Abia State are: Aba North, Aba South, Arochukwu, Bende,
            Ikwuano, Isiala Ngwa North, Isiala Ngwa South, Isuikwuato, Obi Ngwa, Ohafia,
            Osisioma Ngwa, Ugwunagbo, Ukwa East, Ukwa West, Umuahia North, Umuahia South,
            and Umu Nneochi.
          </p>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold">Guide to each LGA</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {LGAS.map((lga, i) => (
              <article
                key={lga.name}
                className="rounded-2xl border border-border bg-card p-5 space-y-2"
              >
                <h3 className="text-lg font-semibold">
                  {i + 1}. {lga.name}
                </h3>
                <p className="text-sm">
                  <span className="font-medium">Headquarters:</span>{' '}
                  <span className="text-muted-foreground">{lga.headquarters}</span>
                </p>
                <p className="text-sm">
                  <span className="font-medium">History:</span>{' '}
                  <span className="text-muted-foreground">{lga.history}</span>
                </p>
                <p className="text-sm">
                  <span className="font-medium">Culture:</span>{' '}
                  <span className="text-muted-foreground">{lga.culture}</span>
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-muted/40 p-6 space-y-2">
          <h2 className="text-xl font-semibold">Join the conversation</h2>
          <p className="text-muted-foreground">
            AbiaConnect brings together Abians from every LGA — at home and across the
            diaspora. Sign in to share stories from your community, discuss local
            development, and connect with people from your hometown.
          </p>
        </section>
      </article>
    </>
  )
}
