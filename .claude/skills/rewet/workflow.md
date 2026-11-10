# Workflow

This file sends each stage to an existing skill. Read the skill. Do not work from this table alone.

## Feature: start to merge

| # | Stage | Skill |
|---|---|---|
| 1 | Make the branch, before you write any file | `superpowers:using-git-worktrees` |
| 2 | Agree on the design; write the spec | `superpowers:brainstorming` |
| 3 | Write the plan | `superpowers:writing-plans` |
| 4 | Build each task test-first | `superpowers:subagent-driven-development` or `superpowers:executing-plans`, with `superpowers:test-driven-development` |
| 5 | A bug or a failing test | `superpowers:systematic-debugging` |
| 6 | Check in the real game | `run`, or reticle |
| 7 | Review | `superpowers:requesting-code-review` or `code-review`; answer it with `superpowers:receiving-code-review` |
| 8 | Prove it is done | `superpowers:verification-before-completion` |
| 9 | Merge and clean up | `superpowers:finishing-a-development-branch` |

## Branch rules

- Make the branch at stage 1. Stage 2 writes a spec file. A spec written on `main` stays out of the branch.
- Branch names: `feat/<topic>`, `fix/<topic>`, `docs/<topic>`.
- Worktree place: `.worktrees/` in the repo needs a `.gitignore` entry, which the repo does not have. Ask the user which place to use.
- Push to `main`, deleting a remote branch and force pushes need the user's approval each time.

## Commits

- Conventional Commits with a scope from the code area: `feat(sim):`, `fix(ui):`, `fix(reveg):`, `test(sim):`, `refactor:`, `docs:`. Use `fix(<area>):` for a balance retune, not `tune`. Use `caveman:caveman-commit` to draft the message.
- Do the STE100 lint pass on the message (`ste100-lint.md`). The body is full sentences, not caveman style.
- One commit for each plan task.

## Small changes

A one-file fix with no design choice can skip stages 2 and 3. It still needs a branch, a test, stage 8 and a review.
