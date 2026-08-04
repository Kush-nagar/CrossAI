// ponytail: minimal assert-based smoke check, no test runner configured in web/
import assert from 'node:assert/strict'
import { paradigmToParagraphs, initials, extractEmails } from './paradigm.ts'

assert.deepEqual(paradigmToParagraphs(''), [])
assert.deepEqual(paradigmToParagraphs('Line one.\n\nLine two.'), ['Line one.', 'Line two.'])
assert.deepEqual(paradigmToParagraphs('Multi\nline\nblock'), ['Multi', 'line', 'block'])
const long = 'One. Two! Three? Four. Five. Six.'
assert.deepEqual(paradigmToParagraphs(long), ['One.  Two!  Three?', 'Four.  Five.  Six.'])

assert.equal(initials('Elena Vasquez'), 'EV')
assert.equal(initials(''), '?')
assert.equal(initials('Cher'), 'C')

assert.deepEqual(extractEmails('Reach me at a@b.com or a@b.com again, or c@d.org'), ['a@b.com', 'c@d.org'])
assert.deepEqual(extractEmails('no emails here'), [])

console.log('paradigm.smoke.ts: all checks passed')
