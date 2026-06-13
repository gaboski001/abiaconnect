interface LegalRegistrationProps {
  leadIn?: string
  footnote?: string
}

const DETAILS: Array<{ label: string; value: string }> = [
  { label: 'Business Name', value: 'ABIACONNECT' },
  { label: 'Registration No', value: 'RC - 3386638' },
  { label: 'Date of Registration', value: '3rd June, 2021' },
  { label: 'Tax Identification', value: '2521482224295' },
]

function VerifiedShield() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-6 text-primary shrink-0"
      aria-hidden="true"
    >
      <path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export default function LegalRegistration({ leadIn, footnote }: LegalRegistrationProps) {
  return (
    <section aria-label="Legal Registration Details" className="not-prose my-10">
      {leadIn && (
        <p className="text-muted-foreground text-sm md:text-base mb-4 leading-relaxed">
          {leadIn}
        </p>
      )}

      <div className="rounded-xl border border-border bg-primary/5 border-l-4 border-l-primary p-6 md:p-7 shadow-sm">
        <div className="flex items-center gap-2.5 mb-5">
          <VerifiedShield />
          <h3 className="text-xl md:text-2xl font-bold text-foreground m-0">
            Officially Registered &amp; Recognised
          </h3>
        </div>

        <dl className="divide-y divide-border/60">
          {DETAILS.map(({ label, value }) => (
            <div
              key={label}
              className="flex flex-col md:flex-row md:items-center py-2.5 gap-1 md:gap-4"
            >
              <dt className="text-sm text-muted-foreground md:w-56 shrink-0">{label}</dt>
              <dd className="text-base font-semibold text-foreground m-0">{value}</dd>
            </div>
          ))}
        </dl>

        <p className="text-sm md:text-[15px] text-muted-foreground leading-relaxed mt-5 mb-0">
          AbiaConnect is an officially registered platform operating under Nigerian law. Our
          registration reflects our commitment to transparency, accountability, and the long-term
          sustainability of this community for every Abian we serve.
        </p>
      </div>

      {footnote && (
        <p className="text-sm text-muted-foreground/80 mt-3 leading-relaxed">{footnote}</p>
      )}
    </section>
  )
}
