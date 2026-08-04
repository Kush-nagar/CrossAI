// ponytail: minimal assert-based smoke check, no test runner configured in web/
import assert from 'node:assert/strict'
import { drillTopicMatches, formatPct, formatAdjustment, DRILL_FORMATS } from './drill-topics.ts'

assert.ok(DRILL_FORMATS['Public Forum'].sides.includes('Pro'))

const matches = drillTopicMatches('china', 'Public Forum')
assert.ok(matches.every((t) => t.text.toLowerCase().includes('china')))
assert.ok(matches.length > 0)

assert.equal(drillTopicMatches('zzz-no-such-topic', 'Public Forum').length, 0)
assert.equal(drillTopicMatches('', 'Public Forum').length, drillTopicMatches('', 'Public Forum').length)

assert.equal(formatPct(0.5), '50%')
assert.equal(formatAdjustment(1.5), '+1.5')
assert.equal(formatAdjustment(-2), '−2.0')

console.log('drill-topics.smoke.ts: all checks passed')
