# Groq STT + Smarter Voice Calibration

**Date:** 2026-07-15  
**Status:** Approved  
**Approach:** Managed cloud STT via Groq Whisper large-v3 + upgraded correction-learning calibration

## Goals

1. More accurate speech-to-text for fast debate speech without storing models on the user's computer.
2. Make the existing 12-take voice calibration more accurate and useful.
3. Stay free/ongoing where possible (Groq free tier).
4. Keep Hume optional for vocal tone/prosody only.

## Non-goals

- Acoustic model fine-tuning from 12 samples (insufficient data).
- Self-hosting Whisper/Parakeet on Render.
- Replacing Hume's prosody analysis with a free OSS stack in this pass.

## Current behavior (baseline)

- `scripts/lib/stt.mjs`: Hume EVI if `HUME_API_KEY` set → else local Xenova Whisper `medium.en` (`transcribe.mjs`).
- Calibration (`voiceProfile.mjs`): 12 fixed scripts; each take is auto-diffed against ground truth; builds `knownCorrections` applied on future transcripts. Not acoustic training.
- Calibration uploads use `rawTranscript=1` to skip Claude cleanup (`server.mjs` `/api/upload`).
- UI: `web/components/onboarding/onboarding-overlay.tsx`.
- `voice-profile.json` is ephemeral on Render unless a Disk is mounted (`DEPLOY.md`).

## Target STT order

1. **Groq `whisper-large-v3`** when `GROQ_API_KEY` is set (transcript only; `tone: null`).
2. Else **Hume** when `HUME_API_KEY` is set (transcript + tone).
3. Else **local Whisper** (`transcribe.mjs`) last resort.

On Groq failure → fall through to Hume (if keyed) → local Whisper. Never fail the upload path solely because Groq is down.

Optional later: if Groq provides text and Hume is keyed, call Hume only for tone — out of scope unless easy; default is Groq-only when Groq succeeds.

## Groq integration

- New module: `scripts/lib/groqVoice.mjs` mirroring the shape of `humeVoice.mjs`:
  - `hasGroqCredentials()`
  - `transcribeWithGroq(buffer)` → `{ text }`
- Convert audio to a Groq-accepted format (reuse `convertToWav` from `transcribe.mjs`; send as WAV/file upload).
- Use Groq Audio Transcriptions API (`https://api.groq.com/openai/v1/audio/transcriptions`), model `whisper-large-v3` (env override `GROQ_WHISPER_MODEL` allowed).
- Prefer official OpenAI-compatible multipart form: `file` + `model`. No new npm dependency required (`fetch` + `FormData` / `Blob`); adding `groq-sdk` is acceptable if cleaner.
- Log `[stt] groq ok (...)` / failures like existing Hume logs.
- Document `GROQ_API_KEY` in `DEPLOY.md` / `CLAUDE.md` STT section.

## Calibration upgrades

### Take quality gate

- After transcription, compute word-error rate (WER) vs the expected script for that take index.
- If WER > threshold (recommend **0.35** initially, env or constant `CALIBRATION_MAX_WER`), **do not** increment `sampleCount` / do not learn corrections; return status + `rejected: true`, `wer`, and mismatch list so the UI can ask the user to retry.
- Exact/near-exact takes still learn as today.

### Pace split

- Takes 1–6: prompt "normal debate pace" (clear, technical round speed).
- Takes 7–12: prompt "spread / competition speed" (realistic failure mode).
- Scripts stay 12; only UI copy + optional `pace` field on samples change.

### Script content

- Keep 12 scripts; retune several toward high-confusion debate terms Whisper mangles: `kritik`, `disad`, `counterplan`, `tabula rasa`, `topicality`, cite years (`Hathaway 25`), `permutation`, `framework`, `net benefits`, etc.
- Keep scripts ~30–50 words; still cover PF/LD/policy/theory mix.

### Correction learning hardening

- Keep unsafe-key blocklist and plausible-mishearing / double-confirm logic.
- Prefer not promoting multi-word spurious diffs when WER is high (quality gate handles most of this).
- Return `corrections` and a human-readable mismatch summary to the client.

### API / UI

- `POST /api/voice-profile/sample`: accept transcript; return existing fields plus `wer`, `rejected`, and mismatch details when rejected.
- Onboarding overlay: show mismatches; on reject, keep same take index / script; on accept, advance.
- Settings recalibrate path unchanged.

### Persistence note

- Document that Render Disk (or S3) is required for `voice-profile.json` to survive redeploys. Implementation of Disk/S3 is optional in this change; at minimum update `DEPLOY.md`.

## Files likely touched

- `scripts/lib/groqVoice.mjs` (new)
- `scripts/lib/stt.mjs`
- `scripts/lib/voiceProfile.mjs`
- `scripts/server.mjs` (sample endpoint response shape; upload comment)
- `web/components/onboarding/onboarding-overlay.tsx`
- `web/lib/api.ts` (types)
- `CLAUDE.md`, `DEPLOY.md`

## Verification

1. With only `GROQ_API_KEY`: upload audio → transcript from Groq; no local model download required for happy path.
2. With Groq key invalid: falls back to Hume or local Whisper.
3. Calibration take that mumbles/skips script → rejected, same take number, no new corrections.
4. Clean take → advances; corrections appear for jargon mismatches.
5. Takes 7–12 UI says spread speed.
6. After full 12 accepted takes, `calibrated: true`; later chat audio applies `knownCorrections`.

## Env

```
GROQ_API_KEY=...
# optional
GROQ_WHISPER_MODEL=whisper-large-v3
```
