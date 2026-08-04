// ponytail: minimal assert-based smoke check, no test runner configured in scripts/
// Run: node scripts/lib/voiceProfile.smoke.mjs
import assert from "node:assert/strict";
import { wordErrorRate, CALIBRATION_MAX_WER, CALIBRATION_SCRIPTS } from "./voiceProfile.mjs";

assert.equal(wordErrorRate(CALIBRATION_SCRIPTS[0], CALIBRATION_SCRIPTS[0]), 0);
assert.ok(wordErrorRate("dog cat bird fish", CALIBRATION_SCRIPTS[0]) > CALIBRATION_MAX_WER);

const script = "the quick brown fox jumps over the lazy dog";
const oneTypo = "the quick brown fox jumped over the lazy dog";
const wer = wordErrorRate(oneTypo, script);
assert.ok(wer > 0 && wer <= CALIBRATION_MAX_WER, `expected small WER, got ${wer}`);

console.log("voiceProfile.smoke.mjs: all checks passed");
