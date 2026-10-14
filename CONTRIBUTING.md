# Contributing

Thanks for helping improve `dsh-claude-style`!

## Report an issue

Open an issue with:

- Which theme (light / dark) and viewport you saw it in
- A screenshot (this project is visual — a screenshot beats 100 words)
- The DSH version (`dsh --version`) and install source (npm / GitHub)
- The skin's build id: run `document.body.getAttribute('data-dsh-claude-style')` in the page's developer console

## Suggest a change

A fix is welcome as a pull request on its own: describe the symptom, the cause and, when the look of the page changes, attach a before-and-after screenshot.

Any other change — a new feature, a new setting, a reworked layout — starts as an issue with the rationale and waits for an answer before the code is written.

This theme aims to faithfully replicate the Claude Code Desktop experience; changes should align with the [design tokens](docs/STYLE.md).

## Code changes

- Continuous integration answers every branch push with the fast tier — lint, the document, feature and changelog checks, the build, the unit tests and the smoke on Linux and Windows — so pushing your own commit to a branch is how the cloud judges it before a pull request exists. A pull request, a push to master or a manual run adds the end-to-end lane and the host-alpha contract warning. Locally, start only the narrowest run that answers the question in hand — `npm run verify -- --quick --feature <dir>`, `--case`, `--scenario` or `--no-e2e` — in the background, and compare the tree hash it prints with the tree you have.
- `lib/` is generated — never edit it by hand. Change `packages/client/src/` (or the host half in `packages/host/src/`), run `npm install` once for the dev dependencies, then `npm run build`: it type-checks the TypeScript sources, bundles them with esbuild and checks the result.
- A feature's code and stylesheets live together under `packages/client/src/features/<feature>/`; parts several features share are in `packages/client/src/shared/`. The layout and the decisions behind it are in [docs/decisions/](docs/decisions/README.md); the rules the build enforces and the working rules are in [AGENTS.md](AGENTS.md).
- Scope every CSS rule under `body[data-dsh-claude-style]`, with dark tokens as the base and light overrides under `:not([data-ds-dark-theme])`.
- `npm run smoke` checks the built bundle without a running DSH: the host half's private-route fence, and — in headless Chrome/Edge against a stand-in host page — boot, an idle scheduler, no markup injection, Enter left to the host, feature isolation, no uncaught errors and a clean teardown.
- `node packages/testing/probe.cjs --token <launch-token>` re-checks the composer invariants against a running `dsh web` GUI.
