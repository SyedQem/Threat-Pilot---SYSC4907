# ThreatPilot Conventions

Short on purpose. If something here slows you down, raise it in standup and we'll change it.

## Layout

```
src/
  kernel/                  # core system (registry, event bus, state, services, UI shell)
    contracts.ts           # the ONLY kernel file plug-ins may import (types only)
  plugins/
    methodology/<name>/    # STRIDE, LINDDUN, PLOT4AI, CIA, DIE
    storage/<name>/        # local-file, github, auth
    exporter/<name>/       # pdf, html
    diagram/<name>/        # dfd-canvas
docs/
```

Aliases: `@kernel/*` → `src/kernel/*`, `@plugins/*` → `src/plugins/*`.

## Plug-in rules (from the architecture doc, enforced by ESLint)

1. Plug-ins import **only** from `@kernel/contracts`. Nothing else in `kernel/`.
2. Plug-ins never import other plug-ins. Need to share code? Raise it, it probably belongs in the kernel behind a contract.
3. The kernel never imports from `plugins/`. It discovers them via the registry.
4. Plug-ins talk to the rest of the system through `PluginContext` (event bus, scoped credentials), never via globals.
5. Domain data (projects, diagram, threats) belongs to the kernel. Plug-ins read/write it only through kernel APIs.

`npm run lint` fails on a violation. Do not disable the rule to get a PR through.

## `contracts.ts` is frozen

It is types-only and agreed by all five of us. **No changes without telling the team first.**
If you need one: post in the team channel with the reason and the diff, get a thumbs-up from every member, then open a PR that touches only `contracts.ts` (plus fixes to code it breaks). Never fold a contract change into a feature PR.

## Branches

`<type>/<ticket-id>-<short-kebab-description>`

| type    | use for                      | example                          |
| ------- | ---------------------------- | -------------------------------- |
| `feat`  | new functionality            | `feat/TP-12-stride-pack`         |
| `fix`   | bug fix                      | `fix/TP-31-refresh-erases-edits` |
| `docs`  | documentation only           | `docs/TP-40-readme`              |
| `chore` | tooling, deps, config        | `chore/TP-02-ci`                 |
| `test`  | tests only                   | `test/TP-27-schema-validator`    |

Branch from `main`. Keep branches short-lived (days, not weeks). Rebase on `main` before opening the PR.

## Pull requests

- **One reviewer** approval required. Pick someone who isn't the author; the reviewer owns a fast turnaround (aim: same working day).
- CI must be green: `lint`, `typecheck`, `test`, `build`.
- Keep PRs small and focused. If the diff is hard to review, split it.
- Link the ticket. Describe *what* and *why* in two or three lines. Screenshots for UI changes.
- Squash-merge into `main`. Author deletes the branch after merge.
- No direct pushes to `main`.

## Commits

Imperative, present tense, one line: `Add STRIDE rule for data-store tampering`.

## Testing

- Vitest, co-located: `foo.ts` → `foo.test.ts`.
- Every plug-in is testable against `contracts.ts` alone, with no kernel running. Keep it that way.
- Bug fix = a test that failed first.

## Scripts

| command             | does                          |
| ------------------- | ----------------------------- |
| `npm run dev`       | Vite dev server               |
| `npm test`          | Vitest, single run            |
| `npm run test:watch`| Vitest, watch mode            |
| `npm run lint`      | ESLint (incl. import rules)   |
| `npm run typecheck` | `tsc --noEmit`                |
| `npm run build`     | typecheck + production bundle |
