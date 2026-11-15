const TEAM = [
  { name: 'Felipe Gabriel', role: 'Data Scientist', linkedin: 'https://www.linkedin.com/in/felipe-gabriel0/', github: 'FG-SC' },
  { name: 'Alisson Ricardo', role: 'Full-Stack Developer', linkedin: 'https://www.linkedin.com/in/allyuau', github: 'engenheiro-ally' },
  { name: 'Joaquim Barreto', role: 'Product Development', linkedin: 'https://www.linkedin.com/in/joaquim-luis-chambo-barreto', github: 'engjoaquimbarreto-source' },
  { name: 'Milena Greff Lima', role: 'Project Architecture & Product Development', linkedin: 'https://www.linkedin.com/in/milena-greff/', github: 'milenagreff-tech' },
  { name: 'Amanda Paul Dull', role: 'Designer · UX/UI · IoT', linkedin: 'https://www.linkedin.com/in/amanda-paul-dull/', github: 'pdamanda' },
  { name: 'Vinícius Soares', role: 'Business Development', linkedin: 'https://www.linkedin.com/in/beyondpolymathy', github: null },
]

// Rendered inside the sidebar (and the mobile drawer) as an expandable section.
export default function AboutUs() {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold text-slate-200">Tech &amp; Health Astronaut Intelligent System</p>
      <p className="text-[11px] leading-relaxed text-slate-500">
        Thais Russomano Team is a tribute to the Brazilian physician and researcher who pioneered Space Medicine and
        Physiology in Brazil.
      </p>
      <ul className="space-y-1.5 pt-1">
        {TEAM.map((member) => (
          <li key={member.name} className="text-[11px] leading-snug">
            <a
              className="font-medium text-slate-200 underline decoration-dotted hover:text-white"
              href={member.linkedin}
              target="_blank"
              rel="noreferrer"
            >
              {member.name}
            </a>
            <span className="text-slate-500"> — {member.role}</span>
            {member.github && (
              <a
                className="ml-1 text-cyan-300 underline decoration-dotted hover:text-cyan-200"
                href={`https://github.com/${member.github}`}
                target="_blank"
                rel="noreferrer"
              >
                @{member.github}
              </a>
            )}
          </li>
        ))}
      </ul>
      <a
        className="inline-flex items-center gap-1 pt-1 text-[11px] font-semibold text-accent hover:text-cyan-200"
        href="https://github.com/NASA-Space-App-Challenge-Health/app"
        target="_blank"
        rel="noreferrer"
      >
        GitHub repository →
      </a>
    </div>
  )
}
