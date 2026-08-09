import Image from 'next/image'
import Link from 'next/link'

const DIRECTIONS = [
  {
    href: '/',
    img: '/landing/arch.jpg',
    label: 'A',
    name: 'The Vanishing Point — live',
    blurb:
      'The fresco’s own one-point perspective becomes the page grid — the orthogonals are the layout lines.',
    swatches: ['#F2F1EC', '#E2DED4', '#16181C', '#6F7A88', '#2E5C8A'],
    meta: ['Light · centred', 'Zodiak / Switzer'],
    alt: 'The central bay of The School of Athens in daylight',
  },
  {
    href: '/preview/b',
    img: '/preview/card-b.jpg',
    label: 'B',
    name: 'Postings',
    blurb:
      'Drawn in the two graphic systems debaters read under pressure: the postings board and the flow sheet.',
    swatches: ['#FFFFFF', '#F4F2ED', '#101114', '#FFE24B', '#3A4A5C'],
    meta: ['Paper · split', 'Clash Display / Supreme'],
    alt: 'Geometers at work on the steps of The School of Athens',
  },
  {
    href: '/preview/c',
    img: '/preview/card-c.jpg',
    label: 'C',
    name: 'Night Session',
    blurb:
      'One continuous ink field, the fresco emerging like a lit stage and the ledger glowing inside it.',
    swatches: ['#080A0E', '#141922', '#E8E4DC', '#9FB2CC', '#C9A227'],
    meta: ['Dark · cinematic', 'Boska / Satoshi'],
    alt: 'The School of Athens graded to a nocturne',
  },
]

export default function PreviewChooser() {
  return (
    <main className="pv pv-x">
      <div className="pv-wrap">
        <h1>Three landing directions for Cross.</h1>
        <p className="pv-x-lede">
          Direction A shipped as the live landing page. B and C are kept here for reference — open
          either one, scroll the whole page, and switch between all three from the control at the
          bottom of the screen.
        </p>

        <div className="pv-x-grid">
          {DIRECTIONS.map((d) => (
            <Link className="pv-x-card" href={d.href} key={d.href}>
              <figure>
                <Image src={d.img} alt={d.alt} width={880} height={550} />
              </figure>
              <div className="pv-x-card-body">
                <h2>
                  {d.label} — {d.name}
                </h2>
                <p>{d.blurb}</p>
                <div className="pv-x-swatches" aria-hidden="true">
                  {d.swatches.map((s) => (
                    <i key={s} style={{ background: s }} />
                  ))}
                </div>
                <div className="pv-x-meta">
                  {d.meta.map((m) => (
                    <span key={m}>{m}</span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>

        <p className="pv-x-note">
          Reference only, and not indexed. Team bios and portraits are placeholders, and every
          ledger, flow and evidence card is labelled synthetic. The hero plates are crops and colour
          grades of the real Raphael; nothing in them is generated.
        </p>
      </div>
    </main>
  )
}
