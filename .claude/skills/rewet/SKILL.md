---
name: rewet
description: Use first, before any other skill, for every task in the Rewet peatland restoration game repo - gameplay, simulation, balance, UI, usability, sound, sprites, design polish, impeccable, performance, ponytail, documentation, mermaid diagrams, research of real-world values, methane or emission numbers, status reports, Slack updates, skill files, commit messages, branches, deploys to Netlify, or new features.
---

# Rewet router

## Overview

This skill sends each Rewet task to the area file that holds its rules. CLAUDE.md gives the project facts. The area files give the procedure and the traps that CLAUDE.md does not show.

## Procedure

1. Find every area that the task touches in the table. One task often touches 2 or 3 areas.
2. Read each of those area files before you write a plan or code.
3. Read `workflow.md` for each task that ends in a commit.
4. Read `ste100-lint.md` before you send any text that a person or an agent will read again: docs, specs, skills, commits, status reports.

## Area table

| Task signal | Area file |
|---|---|
| Any text output that stays: doc, spec, report, skill, commit, Slack update | `ste100-lint.md` |
| A real-world number: emission, water depth, subsidence, rate, cost in the real world | `methodology.md` |
| Contributor docs, explanation of a system, a diagram | `docs-diagrams.md` |
| New action, threat, level, goal, balance, cost, tuning, sim rule | `gameplay-loop.md` |
| HUD, menu, buttons, touch, keyboard, layout, phone, accessibility | `ui-ux.md` |
| A sound, music, mute, audio event | `sound.md` |
| A tile sprite, marker, map art, colour | `sprites.md` |
| "Polish", "make it look better", demo or funder showcase, visual critique | `design-polish.md` |
| Slow, laggy, frame drops, "optimize", "simplify", code size | `optimize.md` |
| New feature, branch, plan, review, merge, "take it to done" | `workflow.md` |
| Deploy, release, Netlify, publish the site, version number | `deploy.md` |

## Common mistakes

- You read one area file when the task touches two. Example: "rain sound and rain effect" needs `sound.md`, `sprites.md` and `workflow.md`.
- You skip `ste100-lint.md` because the text is "internal" or "quick". The global rule has no exception for internal text.
