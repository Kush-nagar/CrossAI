// Shared Ballot/ink primitives used across screens.

export function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'pen' | 'highlight' }) {
  const style =
    tone === 'pen'
      ? 'border-pen/40 text-pen'
      : tone === 'highlight'
        ? 'border-highlight/50 text-foreground bg-highlight/15'
        : 'border-border text-muted-foreground'
  return (
    <span className={`font-data inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${style}`}>
      {children}
    </span>
  )
}

export function Progress({ value, pen = false }: { value: number; pen?: boolean }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-all duration-700 ${pen ? 'bg-pen' : 'bg-foreground'}`} style={{ width: `${value}%` }} />
    </div>
  )
}

// Ballot tally cell — mono numerals boxed like a judge's score field.
export function TallyBox({ value, label }: { value: React.ReactNode; label?: string }) {
  return (
    <span className="tally rounded-sm">
      <span className="text-base font-semibold">{value}</span>
      {label && <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>}
    </span>
  )
}

// Inline "ballot highlighter" emphasis for a phrase.
export function HighlightMark({ children }: { children: React.ReactNode }) {
  return <mark className="highlight-mark bg-transparent text-foreground">{children}</mark>
}

export function InkButton({
  children,
  onClick,
  type = 'button',
  disabled,
  className = '',
}: {
  children: React.ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`ink-stamp inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 text-sm disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  )
}

export function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface flex flex-col gap-5 rounded-xl p-6 md:p-8">
      <h2 className="ballot-rule font-display text-xl font-semibold">{title}</h2>
      {children}
    </section>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-semibold">
      {label}
      {children}
    </label>
  )
}

export function Toggle({
  label,
  detail,
  checked,
  onClick,
}: {
  label: string
  detail: string
  checked: boolean
  onClick: () => void
}) {
  return (
    <button onClick={onClick} type="button" role="switch" aria-checked={checked} className="flex min-h-14 items-center justify-between gap-5 text-left">
      <span>
        <b className="block text-sm">{label}</b>
        <span className="text-xs text-muted-foreground">{detail}</span>
      </span>
      <span className={`flex h-6 w-11 items-center rounded-full border p-0.5 transition ${checked ? 'border-pen bg-pen' : 'border-border bg-secondary'}`}>
        <span className={`size-4.5 rounded-full bg-card shadow transition ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </span>
    </button>
  )
}

export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <header className="ballot-rule flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="flex max-w-2xl flex-col gap-2">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="font-display text-balance text-3xl font-semibold tracking-tight md:text-5xl">{title}</h1>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">{description}</p>
      </div>
      {action}
    </header>
  )
}
