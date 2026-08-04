// "Cases prepared" tracking. Prep's case list itself is session-only (see
// prep-screen.tsx) and only PDF uploads ever touch server disk (case-upload
// route) — docx/text/md/html cases never persist server-side at all. So a
// server-side file count would silently undercount most cases. This tracks
// lightweight metadata (no case content) client-side instead, which is
// honest for every upload kind and survives refresh.

export type CaseRecord = { filename: string; kind: string; uploadedAt: number }

const KEY = 'cross.caseRecords'

export function loadCaseRecords(): CaseRecord[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

function saveCaseRecords(records: CaseRecord[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(records))
  } catch {
    // localStorage unavailable/full — the count just won't persist
  }
}

export function addCaseRecord(filename: string, kind: string) {
  const records = loadCaseRecords().filter((r) => r.filename !== filename)
  records.push({ filename, kind, uploadedAt: Date.now() })
  saveCaseRecords(records)
}

export function removeCaseRecord(filename: string) {
  saveCaseRecords(loadCaseRecords().filter((r) => r.filename !== filename))
}
