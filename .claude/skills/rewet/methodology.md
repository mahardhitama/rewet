# Methodology: research and implementation

Rewet teaches real restoration practice. A real-world number in the game must come from a source that you opened in this session.

## Research

1. Search `docs/references/` first. A sourced value can already be there.
2. If it is not there, ask the user for a local copy of the source. The user keeps the IPCC 2013 Wetlands Supplement and other reports as local PDFs. Use web search only if the user has no copy.
3. Open the source. Read the value, its unit, its range and its conditions of use. Example: IPCC 2013 Table 3.3 CH4 factors apply to a near-surface water table only.
4. Check for a newer edition. Example: the IPCC 2019 Refinement can change a 2013 factor. Record the result of this check, also when nothing changed.
5. Record in `docs/references/<topic>.md`: value, unit, source, table or page, conditions, and the date of the check.
6. If you cannot open a source, write `NOT SOURCED` next to the value. Do not use the value in player-facing text.

"Just put in a reasonable number" and "fix it later" do not change these steps. Tell the user which source you need.

## Implementation

1. Write a failing test first (`superpowers:test-driven-development`).
2. Put the value in one named constant. Add a one-line comment with the source and table.
3. Keep units the same as the source. Convert only with a sourced factor. Example: t CO2 uses the 44/12 factor from IPCC 2006 Vol 4 Section 2.2.3 (key `IPCC06`).
4. Run `npm test`. Calibration tests C1, C2 and C3 must pass. If a change breaks them, tune the constants. Do not loosen the tolerances.
5. Update the spec: the section that uses the value, and section 8 (open items) for each tuned value or open question.

## Push back

A sourced value can be too small to matter. Example: CH4 from rewetted peat is about 0.3% of the avoided drainage emission by mass. Tell the user that before you build a feature on it.
