// Shared primitives used across screens.

export function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'pen' | 'highlight' }) {
  const style =
    tone === 'pen'
      ? 'bg-pen/10 text-pen'
      : tone === 'highlight'
        ? 'bg-highlight/15 text-foreground'
        : 'bg-secondary text-muted-foreground'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${style}`}>
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

// Stat chip — tabular numerals in a soft capsule.
export function TallyBox({ value, label }: { value: React.ReactNode; label?: string }) {
  return (
    <span className="tally">
      <span className="text-base font-semibold">{value}</span>
      {label && <span className="text-[11px] text-muted-foreground">{label}</span>}
    </span>
  )
}

// Inline tinted emphasis for a phrase.
export function HighlightMark({ children }: { children: React.ReactNode }) {
  return <mark className="highlight-mark text-foreground">{children}</mark>
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
      className={`ink-stamp inline-flex min-h-11 items-center justify-center gap-2 px-6 text-sm disabled:opacity-40 ${className}`}
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
      <span className={`flex h-7 w-12 items-center rounded-full p-0.5 transition-colors duration-300 ${checked ? 'bg-success' : 'bg-secondary'}`}>
        <span className={`size-6 rounded-full bg-white shadow-md transition-transform duration-300 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
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
    <header className="flex flex-col gap-5 pb-2 md:flex-row md:items-end md:justify-between">
      <div className="flex max-w-2xl flex-col gap-2">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="font-display text-balance text-4xl font-semibold tracking-[-0.03em] md:text-6xl">{title}</h1>
        <p className="text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">{description}</p>
      </div>
      {action}
    </header>
  )
}
