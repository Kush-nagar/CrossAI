import { Trophy } from 'lucide-react'
import { PageTitle } from '@/components/ui/primitives'

export function TournamentScreen() {
  return (
    <div className="page-enter flex flex-col gap-7">
      <PageTitle eyebrow="Tournament room" title="Tournament readiness" description="Track prep coverage and countdowns for an upcoming tournament." />
      <section className="surface flex flex-col items-center gap-4 rounded-3xl p-10 text-center md:p-16">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary">
          <Trophy className="size-5 text-muted-foreground" />
        </span>
        <p className="max-w-md text-sm text-muted-foreground">
          Tournament tracking isn't wired up yet: Cross doesn't currently record drill history or a prep checklist
          against a tournament date. Coming soon.
        </p>
      </section>
    </div>
  )
}
