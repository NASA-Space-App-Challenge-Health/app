import Card from '../components/Card'

const TEAM = [
  { name: 'Felipe Gabriel', role: 'Data Scientist', linkedin: 'https://www.linkedin.com/in/felipe-gabriel0/', github: 'FG-SC' },
  { name: 'Alisson Ricardo', role: 'Full-Stack Developer', linkedin: 'https://www.linkedin.com/in/allyuau', github: 'engenheiro-ally' },
  { name: 'Joaquim Barreto', role: 'Product Development', linkedin: 'https://www.linkedin.com/in/joaquim-luis-chambo-barreto', github: 'engjoaquimbarreto-source' },
  { name: 'Milena Greff Lima', role: 'Project Architecture & Product Development', linkedin: 'https://www.linkedin.com/in/milena-greff/', github: 'milenagreff-tech' },
  { name: 'Amanda Paul Dull', role: 'Designer · UX/UI · IoT', linkedin: 'https://www.linkedin.com/in/amanda-paul-dull/', github: 'pdamanda' },
  { name: 'Vinícius Soares', role: 'Business Development', linkedin: 'https://www.linkedin.com/in/beyondpolymathy', github: null },
]

export default function About() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400">NASA Space Apps Challenge 2026</p>
        <h1 className="mt-1 text-2xl font-bold text-white">About us</h1>
        <p className="mt-2 text-sm font-semibold text-slate-200">Tech &amp; Health Astronaut Intelligent System</p>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
          Thais Russomano Team is a tribute to the Brazilian physician and researcher who pioneered Space Medicine and
          Physiology in Brazil.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {TEAM.map((member) => (
          <Card key={member.name} className="flex flex-col">
            <p className="text-sm font-semibold text-white">{member.name}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{member.role}</p>
            <div className="mt-auto flex flex-wrap items-center gap-3 pt-4 text-xs">
              <a
                className="inline-flex items-center gap-1.5 text-slate-300 underline decoration-dotted hover:text-white"
                href={member.linkedin}
                target="_blank"
                rel="noreferrer"
              >
                LinkedIn ↗
              </a>
              {member.github && (
                <a
                  className="inline-flex items-center gap-1.5 text-cyan-300 underline decoration-dotted hover:text-cyan-200"
                  href={`https://github.com/${member.github}`}
                  target="_blank"
                  rel="noreferrer"
                >
                    @{member.github}
                </a>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Card title="Repository">
        <a
          className="text-sm font-semibold text-accent underline decoration-dotted hover:text-cyan-200"
          href="https://github.com/NASA-Space-App-Challenge-Health/app"
          target="_blank"
          rel="noreferrer"
        >
          github.com/NASA-Space-App-Challenge-Health/app →
        </a>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Educational demonstration for the NASA Space Apps Challenge 2026. Real NASA open data is labelled Real NASA;
          simulated POC values are labelled Simulated. Not a medical device and not a diagnosis.
        </p>
      </Card>
    </div>
  )
}
