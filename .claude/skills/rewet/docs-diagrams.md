# Documentation and diagrams

## Where files go

| Content | Path |
|---|---|
| Contributor docs (how the code works) | `docs/<topic>.md` |
| Mermaid diagrams | `docs/diagrams/<topic>.md`: one fenced `mermaid` block, a one-line title, and a link back to the doc |
| Diagram render | `docs/diagrams/<topic>.png`, next to its `.md` file |
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
- Write the labels in plain words that a player understands, not code names. Name the source functions in the line under the title.
- Put quotes around labels that have parentheses, colons or slashes.

## Each diagram request gives 2 files

When the user asks for a diagram, deliver both files in the same commit:

1. `docs/diagrams/<topic>.md`: the mermaid source.
2. `docs/diagrams/<topic>.png`: the render, with the `redux` theme at scale 3.

Render command (the user approved the mermaid-cli download):

```bash
echo '{"theme":"redux"}' > "$TMP/mm.json"
npx -y -p @mermaid-js/mermaid-cli@12.2.0 mmdc -i docs/diagrams/<topic>.md -o "$TMP/<topic>.png" -c "$TMP/mm.json" -s 3
mv "$TMP/<topic>-1.png" docs/diagrams/<topic>.png
```

- `$TMP` is the scratch folder of the session, not the repo.
- A markdown input gives one file per mermaid block, with `-1` added to the name.
- The first run downloads a headless browser and can take 3 minutes. Run it in the background.
- If labels wrap into tall narrow boxes, put `%%{init: {"flowchart": {"wrappingWidth": 320}}}%%` above the `flowchart` line.
- `redux` is the light default of the redux themes. Do not use `redux-dark`, `redux-color` or the old `default` theme.

## Checking the diagram

1. Do not paste repo content into mermaid.live or another outside site without the user's permission.
2. If the render fails, fix the syntax. Do not remove nodes to make it pass.
3. Open the PNG and look at it. Check that no label is cut and no arrow crosses a label.
4. Check each arrow against the code order.
5. In the reply, give the paths of both files.
