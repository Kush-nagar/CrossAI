// Public feature pages (/features/*). Every claim here must match what the
// signed-in screen actually does — update both together.

export type Feature = {
  slug: string
  name: string
  title: string // page H1
  metaTitle: string
  description: string
  intro: string
  points: { title: string; body: string }[]
  steps: string[]
  cta: { label: string; href: string }
}

export const FEATURES: Feature[] = [
  {
    slug: 'card-search',
    name: 'Card search',
    title: 'Search 17,000 disclosed Public Forum cards',
    metaTitle: 'Debate card search for Public Forum evidence',
    description:
      'Search 17,000 cards from disclosed Public Forum cases by claim, author or impact, filter by topic and side, and copy cards into your file with the highlighting intact.',
    intro:
      'Every card from the Public Forum cases teams disclosed on openCaselist, split into individual cards you can search, read and copy. Search by the claim you need, not just exact words in a tag.',
    points: [
      { title: 'Search by claim, author or impact', body: 'Type the argument you want to card. Results rank tag matches first, then authors, then the highlighted text, then the rest of the card.' },
      { title: 'Filter to your topic', body: 'Narrow by season, topic, side and whether the card came from a case or a rebuttal doc, or show only cards with highlighting.' },
      { title: 'Read it the way it was cut', body: 'The tag, the full cite and the text with its original highlighting. Shrink the unread text to see just what gets read.' },
      { title: 'Copy straight into Word or Docs', body: 'Copy card pastes Verbatim-style formatting: bold tag, bold cite, highlighted and underlined read text. Copy read text grabs only the highlighted words.' },
      { title: 'Save cards for later', body: 'Save the cards you want and copy them all at once when you build your file.' },
      { title: 'Ask the coach for evidence', body: 'In chat, CrossCoach can pull a real disclosed card for a claim and link you to it, instead of describing one or making one up.' },
    ],
    steps: ['Sign in and open Cards.', 'Search a claim, like "war powers gridlock".', 'Open a card, check the source, and copy it into your file.'],
    cta: { label: 'Search cards', href: '/cards' },
  },
  {
    slug: 'judge-paradigms',
    name: 'Judge paradigms',
    title: 'Know your judge before the round starts',
    metaTitle: 'Judge paradigm lookup and summaries for debate',
    description:
      'Look up any judge’s Tabroom paradigm and get a clear summary: how they decide, speed, evidence, weighing, theory, cross-ex, speaker points and dealbreakers.',
    intro:
      'Long paradigms are hard to read in the five minutes before a round. Search the judge you drew and Cross turns their paradigm into what actually changes your strategy.',
    points: [
      { title: 'A summary you can use', body: 'How they decide, speaking and delivery, evidence and warranting, weighing and impacts, theory, cross-ex style, speaker points, and pet peeves.' },
      { title: 'How to win in front of them', body: 'The adjustments that matter most for this judge, so you know what to change before you speak.' },
      { title: 'The original paradigm, always there', body: 'Read the judge’s own words next to the summary whenever you want to check it.' },
      { title: 'Saved and struck judges', body: 'Keep the judges you see often, mark the ones you’d strike, and add your own notes after a round.' },
      { title: 'Works without linking anything', body: 'Public paradigms work as soon as you sign in. Linking your Tabroom account adds lookups that need a login.' },
    ],
    steps: ['Sign in and open Judges.', 'Search the judge’s name.', 'Read the summary and the “how to win” notes before the round.'],
    cta: { label: 'Look up a judge', href: '/judges' },
  },
  {
    slug: 'speech-drills',
    name: 'Graded speech drills',
    title: 'Practice a speech and get it graded',
    metaTitle: 'Debate speech practice with AI grading',
    description:
      'Pick a speech and a topic, give it out loud or type it, and get a grade that shows its work, factor by factor, plus delivery feedback over time.',
    intro:
      'Drills put you in a live Public Forum situation: a topic, a side, the speeches before yours. Give your speech, and Cross grades it with a score you can actually argue with.',
    points: [
      { title: 'Every PF speech', body: 'Constructive, rebuttal, summary, final focus and crossfire, on a topic you choose or a surprise one.' },
      { title: 'A score that shows its work', body: 'Grading starts from an even round and adjusts one factor at a time, so you can see exactly what helped and what hurt.' },
      { title: 'Speak it, don’t just type it', body: 'Record your speech and Cross grades the transcript, including your pace. Typing works too.' },
      { title: 'Hear a model version', body: 'Listen to a model delivery of the speech, then redo yours.' },
      { title: 'Track delivery over time', body: 'Your practice history shows trends across drills, as charts or a table.' },
    ],
    steps: ['Sign in and open Drill.', 'Pick a speech and a topic, or leave it random.', 'Give the speech, read the ledger, and redo it.'],
    cta: { label: 'Start a drill', href: '/drill' },
  },
  {
    slug: 'round-feedback',
    name: 'Round feedback',
    title: 'Feedback on the round you just debated',
    metaTitle: 'Debate round feedback from a recording',
    description:
      'Upload a recording of one speech or a whole round and get a debrief: what worked, what cost you, and what to change next time.',
    intro:
      'Most feedback disappears with the ballot. Record your round, upload it, and Cross gives you a debrief you can keep.',
    points: [
      { title: 'One speech or the whole round', body: 'Feed in a single speech, or the full round and confirm how Cross splits it into speeches.' },
      { title: 'Context makes it sharper', body: 'Optionally add your side, the speech, the topic, the judge and what you want feedback on.' },
      { title: 'A real debrief', body: 'Specific, speech-by-speech feedback on strategy, weighing and delivery, not a generic checklist.' },
      { title: 'Private to you', body: 'Recordings are stored only for your account, and you can delete your account and data at any time.' },
    ],
    steps: ['Sign in and open Insight.', 'Upload or record a speech or the whole round.', 'Read the debrief and drill what it flags.'],
    cta: { label: 'Get round feedback', href: '/insight' },
  },
]

export function getFeature(slug: string) {
  return FEATURES.find((f) => f.slug === slug)
}
