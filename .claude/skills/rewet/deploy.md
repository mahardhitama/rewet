# Deploy to Netlify

`netlify.toml` sets the deploy. Netlify serves the repo root as a static site, with no build command. The game needs no build step.

Site: https://vermillion-pastelito-08f6e2.netlify.app (admin: https://app.netlify.com/projects/vermillion-pastelito-08f6e2). The CLI link is in `.netlify/state.json`.

## Ways to deploy

| Way | When | What it does |
|---|---|---|
| Git deploy (preferred) | The site is linked to `github.com:mahardhitama/rewet` in the Netlify UI | A push to `main` makes a production deploy. A pull request gets a deploy preview. |
| CLI deploy | No Git link, or a quick preview of a branch | `npx netlify-cli deploy --dir .` makes a draft URL. `--prod` makes a production deploy. |

A CLI deploy uploads the working tree, not a commit. Deploy only from a clean tree (`git status` shows nothing), or uncommitted work goes live.

## First-time setup (the user does this)

1. Make a Netlify account, then make a site from the GitHub repo. Netlify reads `netlify.toml`, so leave the build settings empty.
2. For the CLI way, the user runs `! npx netlify-cli login` and then `! npx netlify-cli link`. The login opens a browser, so the agent cannot do it.
3. The link writes `.netlify/state.json`. `.gitignore` keeps it out of git.

## Before each deploy

1. Run `npm test`. All tests must pass, with C1 to C3.
2. Run `node scripts/sim-run.js --level 1 --plan test/fixtures/l1-cascade.json`. The run must have no loss.
3. Serve the game (`python3 -m http.server 8765`) and open it. Check the intro, the menu and one level.
4. Change the version number in `index.html` (`<div id="ver">`) when the release changes. Use `0.0.x` for a fix and `0.x.0` for a feature set.

## Rules

- A production deploy is public. Ask the user before each production deploy: `git push` to `main`, or `--prod`.
- A draft deploy (`netlify-cli deploy` without `--prod`) is also on a public URL. Tell the user the URL.
- Do not add a build command or a dependency for the deploy.
- Do not put a Netlify token in a file. The CLI keeps it in the user's home folder.
- The site also serves `docs/`, `test/` and `scripts/`. They hold no secret. Before you add a file with a secret to the repo, stop and ask.

## Check after a deploy

Open the deploy URL. Confirm:
- the menu shows the new version number;
- the browser console shows no 404 for a module;
- the intro and one level run.
