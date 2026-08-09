// ponytail: minimal assert-based smoke check, no test runner configured in web/
//
// Covers the NUL-delimited framed-stream protocol shared by /api/chat and
// /api/drill/scenario: FLOW frames must be stripped from the payload and
// surfaced as steps, an ERROR frame must throw, and a frame split across two
// chunks must still parse. Drives streamDrillScenario through a stubbed fetch,
// since that's the exported surface readFramedStream sits behind.
import assert from 'node:assert/strict'

const NUL = String.fromCharCode(0)
const flow = (label: string) => `${NUL}FLOW:${label}${NUL}`

function stubFetch(chunks: string[]) {
  globalThis.fetch = (async () =>
    new Response(
      new ReadableStream({
        start(c) {
          const enc = new TextEncoder()
          for (const ch of chunks) c.enqueue(enc.encode(ch))
          c.close()
        },
      }),
      { status: 200, headers: { 'Content-Type': 'text/plain' } },
    )) as typeof fetch
}

const { streamDrillScenario, ApiError } = await import('./api.ts')
const INPUT = { format: 'Public Forum', side: 'Pro', speech: 'Summary', difficulty: 'standard', topic: 'x' }
const PAYLOAD = { scenario: { resolution: 'R' }, answerKey: { moves: [1] }, caseFile: null, caseSources: null }

// --- happy path: frames stripped, steps reported in order, payload parsed ---
{
  stubFetch([flow('One'), flow('Two'), JSON.stringify(PAYLOAD)])
  const seen: string[][] = []
  const out = await streamDrillScenario(INPUT, (s) => seen.push(s))
  assert.deepEqual(out, PAYLOAD, 'payload survives frame stripping')
  assert.deepEqual(seen.at(-1), ['One', 'Two'], 'steps accumulate in order')
  assert.equal(seen.length, 2, 'onFlow fires once per frame')
}

// --- a frame split across chunk boundaries still parses ---
{
  const f = flow('Split step')
  stubFetch([f.slice(0, 5), f.slice(5), JSON.stringify(PAYLOAD)])
  const seen: string[][] = []
  const out = await streamDrillScenario(INPUT, (s) => seen.push(s))
  assert.deepEqual(seen.at(-1), ['Split step'], 'frame state persists across reads')
  assert.deepEqual(out, PAYLOAD)
}

// --- payload split across chunks (JSON must not be parsed per-chunk) ---
{
  const body = JSON.stringify(PAYLOAD)
  stubFetch([flow('One'), body.slice(0, 12), body.slice(12)])
  assert.deepEqual(await streamDrillScenario(INPUT), PAYLOAD, 'payload reassembles across chunks')
}

// --- ERROR frame (a failure raised after headers went out) throws ---
{
  stubFetch([flow('One'), `${NUL}ERROR:model exploded${NUL}`])
  await assert.rejects(
    () => streamDrillScenario(INPUT),
    (e: unknown) => e instanceof ApiError && e.message === 'model exploded',
    'ERROR frame surfaces as a real error, not a parse failure',
  )
}

// --- truncated payload reports a readable error, not a raw SyntaxError ---
{
  stubFetch([flow('One'), '{"scenario":'])
  await assert.rejects(
    () => streamDrillScenario(INPUT),
    (e: unknown) => e instanceof ApiError && /incomplete/i.test(e.message),
  )
}

console.log('api.smoke.ts: all checks passed')
