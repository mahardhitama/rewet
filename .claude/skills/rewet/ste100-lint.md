# STE100 lint

**REQUIRED SKILL:** `ste100` (`~/.claude/skills/ste100/SKILL.md`) holds the rules. This file adds the lint pass and the Rewet terms.

## When

Do the lint pass on each text that stays after the session: docs, specs, plans, skills, code comments, commit messages, PR text, status reports, Slack updates. "Internal", "quick" and "don't overthink it" do not remove the lint pass. Chat replies to the user follow the active output style, not this file.

## Lint pass

1. Write the draft.
2. Check each sentence against this list. Fix each hit.
   - Instruction sentence: 20 words or fewer. Description sentence: 25 words or fewer.
   - One instruction per sentence.
   - Active voice. Simple past, present or future. No present perfect ("has changed" becomes "changed").
   - Noun cluster: 3 words or fewer. "L1 revegetation star" becomes "the revegetation star on level 1".
   - One term for one thing in the whole text. Use the glossary below.
   - Numbers have units. A game cost has no unit, so write "costs 120 funds".
3. Skill text only: the `description` starts with "Use when" and gives only trigger conditions. It never tells what the skill does.
4. Text in a commit, PR or doc: no caveman style, no arrows, no invented abbreviations.
5. If you cannot fix a sentence without losing a fact, keep the fact and keep the longer sentence.

## Rewet glossary (use these terms only)

| Term | Meaning | Do not use |
|---|---|---|
| water-table depth (`wt`) | metres below the surface, positive is down | water level, GWL |
| block | a canal dam (temporary or permanent) | dam, weir, plug (in UI text) |
| backfill | fill a canal tile with peat | close, seal |
| tick | one sim step, 1/4 week | frame, turn |
| goal | one of the three 3R goals | objective, target |
| t C | tonnes of carbon. Use t CO2 only for the debrief value and the convert journal page (44/12, `IPCC06`) | t CO2 for a sim value |

## Common mistakes

- You apply the rules in your head and do not check each sentence. Do the pass on the text itself.
- You rotate synonyms ("check", "verify", "confirm") for one action.
