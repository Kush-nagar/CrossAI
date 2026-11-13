// Server-only: the public guides in web/content/guides/*.md. Each file has a
// small frontmatter block (title, description, order) and a Markdown body
// written for Cross (no named teams or coaches). Rendered to static HTML at
// build time; the content is ours, so raw HTML isn't expected but is still
// escaped by the renderer below.
import fs from 'node:fs'
import path from 'node:path'
import { Marked } from 'marked'

export type Guide = { slug: string; title: string; description: string; order: number; html: string; words: number }

const DIR = path.join(process.cwd(), 'content', 'guides')
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const md = new Marked({ async: false })
md.use({ renderer: { html: (t) => esc(t.text ?? '') } })

function parse(file: string): Guide {
  const raw = fs.readFileSync(path.join(DIR, file), 'utf8')
  const end = raw.indexOf('\n---', 3)
  const meta: Record<string, string> = {}
  for (const line of raw.slice(4, end).split('\n')) {
    const m = /^(\w+):\s*(.*)$/.exec(line)
    if (m) meta[m[1]] = m[2].replace(/^"|"$/g, '')
  }
  const body = raw.slice(end + 4).trim()
  return {
    slug: file.replace(/\.md$/, ''),
    title: meta.title,
    description: meta.description,
    order: Number(meta.order) || 99,
    html: md.parse(body) as string,
    words: body.split(/\s+/).length,
  }
}

let cache: Guide[] | null = null
export function getGuides(): Guide[] {
  if (!cache) {
    let files: string[] = []
    try {
      files = fs.readdirSync(DIR).filter((f) => f.endsWith('.md'))
    } catch {
      files = []
    }
    cache = files.map(parse).sort((a, b) => a.order - b.order)
  }
  return cache
}

export function getGuide(slug: string): Guide | undefined {
  return getGuides().find((g) => g.slug === slug)
}
