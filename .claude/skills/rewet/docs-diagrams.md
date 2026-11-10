# Documentation and diagrams

## Where files go

| Content | Path |
|---|---|
| Contributor docs (how the code works) | `docs/<topic>.md` |
| Mermaid diagrams | `docs/diagrams/<topic>.md`: one fenced `mermaid` block, a one-line title, and a link back to the doc |
| Design specs and plans | `docs/superpowers/specs/`, `docs/superpowers/plans/` (dated file names) |
| Sourced real-world values | `docs/references/` (see `methodology.md`) |

A doc links to its diagram file. Do not put the diagram source in the doc. One diagram file can then serve many docs.

## Writing the doc

1. Read the code first. The code is the truth. Cite `file:line` for each step.
2. Name constants. Do not copy their values. Example: write "`HYDRO.cutoffM`", not "400 m". Values change when the team tunes them.
3. Link real-world values to `docs/references/`. Do not repeat them.
4. Do the STE100 lint pass (`ste100-lint.md`).

## Writing the diagram

- Use `flowchart TD` or `sequenceDiagram`. Keep it to 15 nodes or fewer.
- Use the function names from the code as node labels.
- Put quotes around labels that have parentheses, colons or slashes.

## Checking the diagram

1. Do not paste repo content into mermaid.live or another outside site without the user's permission.
2. Render it locally with `npx -y -p @mermaid-js/mermaid-cli mmdc -i docs/diagrams/<topic>.md -o <scratchpad>/<topic>.svg`. This is a one-time download, not a project dependency. Ask the user before the first download.
3. If the render fails, fix the syntax. Do not remove nodes to make it pass.
4. Check each arrow against the code order.
