// Seed scenarios for the distillation pipeline (scripts/distill.mjs).
//
// Each seed describes a debater and what they come to Cross with; the
// simulator model turns it into natural opening/follow-up messages, and the
// production Cross stack (CROSS.md + RAG-retrieved corpus) writes the coach
// side. Seeds are cycled — dialogue i uses SEEDS[i % SEEDS.length] with a
// variation counter, so runs larger than the seed bank still diverge.
//
// PF-dominant on purpose: the student system prompt (matching the existing
// train.jsonl) says "specializing in Public Forum", and the corpus is
// PF-heavy. A few LD seeds keep the model from face-planting off-event.

export const SEEDS = [
  // --- Case construction & evidence ---------------------------------------
  { event: "PF", level: "second-year, local circuit", scenario: "Drafting their first case on the current topic and unsure how to pick between three possible contentions — wants help narrowing and structuring." },
  { event: "PF", level: "varsity, nat circuit", scenario: "Their coach says their case is 'all cards, no warrants.' They don't really understand the difference and want their contention tightened." },
  { event: "PF", level: "novice", scenario: "Confused about what makes evidence 'good' — they keep losing to teams whose cards sound more confident. Wants to learn to evaluate and cut better cards." },
  { event: "PF", level: "varsity", scenario: "Wants a link chain stress-tested: they suspect their second contention's internal link is weak but can't articulate why." },
  { event: "PF", level: "junior varsity", scenario: "Asks how to write a strong framing/weighing mechanism into the case itself instead of bolting it on in later speeches." },

  // --- Rebuttal & blocks ----------------------------------------------------
  { event: "PF", level: "varsity, nat circuit", scenario: "Keeps running out of time in rebuttal when covering four-contention cases. Wants help triaging and grouping on the flow." },
  { event: "PF", level: "second-year", scenario: "Wants to build a block file for the topic but doesn't know how to organize it or what the most common off-case-style answers will be." },
  { event: "PF", level: "varsity", scenario: "Lost a round because they answered a turn with defense only. Wants to understand offense vs. defense and when each wins rounds." },
  { event: "PF", level: "novice", scenario: "Doesn't know what to do when the opponent reads an argument they've never heard of mid-round. Wants a protocol for handling surprises." },

  // --- Collapse, summary, final focus ----------------------------------------
  { event: "PF", level: "varsity, nat circuit", scenario: "Their summaries try to go for everything and lose cohesion. Wants to learn collapse discipline — how to pick the winning path by the second half." },
  { event: "PF", level: "junior varsity", scenario: "Asks what belongs in final focus vs. summary, and why judges keep saying their final focus is 'new.'" },
  { event: "PF", level: "varsity", scenario: "Practicing extensions: judges say arguments 'disappear' from their speeches even though they mentioned them. Wants to fix extension quality." },
  { event: "PF", level: "varsity, deep elims at majors", scenario: "Wants to talk through when to collapse to the weaker-but-cleaner argument vs. the stronger-but-messier one, with a concrete round they just lost." },

  // --- Weighing --------------------------------------------------------------
  { event: "PF", level: "second-year", scenario: "Judges keep saying 'both teams won their argument but they weighed better.' Doesn't really know what weighing means beyond saying 'magnitude.'" },
  { event: "PF", level: "varsity", scenario: "Wants to practice comparative weighing — their opponents also weigh, and rounds are turning into 'weighing wars' they lose." },
  { event: "PF", level: "varsity, nat circuit", scenario: "Asks about prerequisites and link-ins: their coach mentioned 'strength of link weighing' and they want to know when it actually persuades judges." },

  // --- Crossfire & delivery ---------------------------------------------------
  { event: "PF", level: "novice", scenario: "Terrified of crossfire — freezes when asked aggressive questions. Wants concrete techniques and practice questions." },
  { event: "PF", level: "varsity", scenario: "Uses crossfire to score points but never converts concessions into ink on the flow. Wants to learn to set traps that matter in later speeches." },
  { event: "PF", level: "junior varsity", scenario: "Got feedback that they speak too fast and sound like they're reading. Wants delivery drills that fit a 20-minute daily practice window." },
  { event: "PF", level: "varsity", scenario: "Second speaker whose partner (first speaker) is much newer — wants advice on speech division, prepping the partner, and covering for gaps mid-round." },

  // --- Judge adaptation --------------------------------------------------------
  { event: "PF", level: "varsity, nat circuit", scenario: "Has a lay parent judge in out-rounds tomorrow after a tech-heavy prelim day. Wants to know exactly what to change in each speech." },
  { event: "PF", level: "varsity", scenario: "Reads a judge paradigm that says 'tech over truth, but hate blippy debate' and finds it contradictory. Wants help decoding paradigm language generally." },
  { event: "PF", level: "second-year", scenario: "Asks how to adapt when the panel is split — one flow judge, one lay judge, one unknown." },

  // --- Theory / progressive ------------------------------------------------------
  { event: "PF", level: "varsity, nat circuit", scenario: "Hit disclosure theory for the first time last weekend and dropped it. Wants to understand the shell and how to answer it without going for it themselves." },
  { event: "PF", level: "varsity", scenario: "Wondering whether to read paraphrasing theory against a team that badly mis-cut evidence, and what the strategic and ethical tradeoffs are." },

  // --- Strategy & mindset -----------------------------------------------------------
  { event: "PF", level: "varsity", scenario: "Down rounds at a tournament and tilting — wants to reset mentally between rounds and stop compounding losses." },
  { event: "PF", level: "second-year", scenario: "Asks how to run a productive practice round and what to actually do during redos — their team just 'debates and moves on.'" },
  { event: "PF", level: "varsity, nat circuit", scenario: "Preparing for a bid round against a faster, more technical team. Wants an underdog strategy that doesn't require out-teching them." },
  { event: "PF", level: "novice", scenario: "First tournament in two weeks. Wants a prioritized prep plan — what matters most with limited time." },
  { event: "PF", level: "varsity", scenario: "Wants a post-round breakdown: they bring a specific loss (describing the flow from memory) and want to find the actual decision point." },

  // --- Flowing & fundamentals ----------------------------------------------------------
  { event: "PF", level: "novice", scenario: "Their flow falls apart by rebuttal — misses arguments, can't read their own shorthand. Wants a flowing system and drills." },
  { event: "PF", level: "junior varsity", scenario: "Asks what 'the line-by-line' means and how strict to be about it in PF versus telling a story." },

  // --- LD (minority of seeds; Cross's PF-first expertise should still help) -------------
  { event: "LD", level: "second-year, traditional circuit", scenario: "Struggles with framework debate — value/criterion clash confuses them and rounds feel like ships passing. Wants a clean way to win framework or make it irrelevant." },
  { event: "LD", level: "varsity, nat circuit", scenario: "Hit a kritik they didn't understand and wants a general-purpose approach for engaging Ks as a mostly-policy-style debater." },
  { event: "LD", level: "junior varsity", scenario: "Wants help converting their PF-style weighing habits into LD's framework-filtered impact calculus." },

  // --- Evidence ethics & round conduct -----------------------------------------------------
  { event: "PF", level: "varsity", scenario: "Caught an opponent badly miscutting a card mid-round; unsure whether to call for evidence, stake the round, or just flag it to the judge. Wants both the tactics and the ethics." },
];
