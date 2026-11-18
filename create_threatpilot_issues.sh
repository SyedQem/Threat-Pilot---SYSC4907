#!/usr/bin/env bash
# Creates labels, a milestone and the 17 ThreatPilot prototype issues.
# Usage:  ./create_threatpilot_issues.sh OWNER/REPO
# Prereq: gh CLI installed and authenticated (gh auth login)
set -euo pipefail

REPO="${1:?Usage: $0 OWNER/REPO}"
MILESTONE="Prototype Week 1"

# Map devs A-E to GitHub usernames (leave empty to skip assignment)
DEV_A=""; DEV_B=""; DEV_C=""; DEV_D=""; DEV_E=""

echo "Creating labels..."
mk_label() { gh label create "$1" --color "$2" --description "$3" --repo "$REPO" --force >/dev/null; }
mk_label kernel      1d76db "Kernel component"
mk_label plugin      5319e7 "Plug-in"
mk_label diagram     0e8a16 "DFD canvas / diagram"
mk_label rules       d93f0b "Rule engine and methodology packs"
mk_label ui          fbca04 "UI shell and panels"
mk_label storage     0052cc "Storage and export"
mk_label accessibility c5def5 "WCAG / a11y"
mk_label setup       bfdadc "Scaffolding and integration"
mk_label size:S      ededed "Up to half a day"
mk_label size:M      d4c5f9 "1 to 1.5 days"
mk_label size:L      f9d0c4 "About 2 days"

echo "Creating milestone..."
gh api "repos/$REPO/milestones" -f title="$MILESTONE" -f description="One-week localhost prototype" >/dev/null 2>&1 || echo "(milestone may already exist)"

# mk "title" "labels" "assignee" "body"
mk() {
  local args=(--repo "$REPO" --title "$1" --label "$2" --milestone "$MILESTONE" --body "$4")
  [[ -n "$3" ]] && args+=(--assignee "$3")
  gh issue create "${args[@]}"
}

mk "T0: Scaffold and contract freeze" "setup,size:S" "$DEV_A" "$(cat <<'EOF'
**Owner:** A (whole team, Day 1 morning) | **Depends on:** none

**Goal:** Everyone can work in parallel against agreed interfaces.

- [ ] Create repo with Vite, TypeScript, lint, test runner (Vitest)
- [ ] Folder layout: `src/kernel/*` and `src/plugins/{methodology,storage,exporter,diagram}/*`
- [ ] Commit `contracts.ts`: domain types (`Project`, `Element`, `DataFlow`, `TrustBoundary`, `Threat` with `origin: 'generated' | 'user'` and `modified: boolean`) and the Methodology, Storage, Exporter, Diagram interfaces
- [ ] Commit `docs/conventions.md`: branch naming, one-reviewer PRs, plug-ins import only from `kernel/contracts`

**Acceptance:** `npm run dev` renders a blank page, `npm test` passes, contracts merged and agreed by all five. No contract changes after this without telling the team.
EOF
)"

mk "K1: Event bus and plug-in registry" "kernel,size:M" "$DEV_A" "$(cat <<'EOF'
**Owner:** A | **Depends on:** T0

- [ ] Typed pub/sub (`ModelChanged`, `ThreatsRefreshed`, `SaveRequested`)
- [ ] Registry: `register(plugin)`, validation against extension-point contract, enable/disable, lookup by extension point
- [ ] Static registration in a single `plugins/index.ts`

**Acceptance:** unit tests for valid plug-in, invalid plug-in rejected, event delivery. A dummy plug-in can be registered from the app entry.
EOF
)"

mk "K2: Domain model, schema and state store" "kernel,size:L" "$DEV_A" "$(cat <<'EOF'
**Owner:** A | **Depends on:** T0 | **Must merge by end of Day 1**

- [ ] Zod schema with `schemaVersion: 1` and `validateModel()` returning readable errors
- [ ] Single state store (e.g. Zustand) with actions to add/update/remove element, flow, boundary, threat
- [ ] Dirty-state tracking; emits `ModelChanged`
- [ ] Stretch: undo/redo

**Acceptance:** valid sample JSON passes, malformed JSON gives specific errors, store actions unit tested.
EOF
)"

mk "K3: Project manager (CRUD and metadata) - FR 1" "kernel,size:M" "$DEV_A" "$(cat <<'EOF'
**Owner:** A | **Depends on:** K2

- [ ] Project list screen: create, edit (title, owner, description, reviewers), delete with confirmation, open
- [ ] Persist project list in memory plus localStorage

**Acceptance:** user can create, edit and delete projects; metadata appears in the saved JSON.
EOF
)"

mk "D1: DFD canvas plug-in - FR 4" "plugin,diagram,size:L" "$DEV_B" "$(cat <<'EOF'
**Owner:** B | **Depends on:** T0, K1 (stub OK)

- [ ] Implement Diagram contract (`mount`, `onChange`) using React Flow
- [ ] Node types: process, data store, external entity
- [ ] Draw flows between nodes; drag, zoom, delete
- [ ] Read/write through the state store only

**Acceptance:** diagram built on canvas appears in the store and survives a save/load round trip (once S1 lands).
EOF
)"

mk "D2: Properties panel and trust boundaries" "diagram,size:M" "$DEV_B" "$(cat <<'EOF'
**Owner:** B | **Depends on:** D1

- [ ] Select an element to edit its name and type-specific attributes (e.g. "stores sensitive data")
- [ ] Trust boundaries as grouping boxes; assign elements to them

**Acceptance:** edits update the store; boundary membership is in the JSON.

**Fallback if D1 slips:** replace boundaries with an "inside boundary" checkbox on elements.
EOF
)"

mk "D3: Accessible list view of the diagram (NFR 2 spike)" "diagram,accessibility,size:M" "$DEV_B" "$(cat <<'EOF'
**Owner:** B | **Depends on:** K2

- [ ] Implement `getAccessibleView()`: keyboard-navigable tree of elements, flows, boundaries
- [ ] Add/select/delete via keyboard, with ARIA labels
- [ ] Toggle between canvas and list view
- [ ] Test once with a screen reader

**Acceptance:** a user can create two elements and a flow using only the keyboard. PR description records what was hard (highest-risk item in the architecture doc).
EOF
)"

mk "R1: Rule engine host" "rules,kernel,size:M" "$DEV_C" "$(cat <<'EOF'
**Owner:** C | **Depends on:** T0, K1

- [ ] Methodology-agnostic matcher: for the model and selected Methodology plug-ins, call `evaluate(element, context)` and return `Threat[]` with `origin: 'generated'`
- [ ] Async interface `runRules(model): Promise<Threat[]>` so a Web Worker can be added later

**Acceptance:** unit tests with a fake methodology plug-in verify the output.
EOF
)"

mk "R2: STRIDE pack" "rules,plugin,size:L" "$DEV_C" "$(cat <<'EOF'
**Owner:** C | **Depends on:** R1

- [ ] STRIDE-per-element mapping (external entity: S, R; process: all six; data store: T, R, I, D; data flow: T, I, D)
- [ ] Each rule yields title, description, category, suggested mitigation
- [ ] Stable `ruleId` per rule so refresh can match threats
- [ ] Wording reviewed by a security-minded teammate

**Acceptance:** the sample model generates a sensible, deterministic threat list.
EOF
)"

mk "R3: CIA pack and methodology selector" "rules,plugin,size:S" "$DEV_C" "$(cat <<'EOF'
**Owner:** C | **Depends on:** R1

- [ ] Small CIA pack proving a methodology can be added without kernel changes
- [ ] Dropdown/multi-select in the UI to enable methodologies

**Acceptance:** switching packs changes generated threats, with no edits outside `plugins/methodology/`.
EOF
)"

mk "T1: Threat manager and refresh-merge - FR 2.2, 2.3" "kernel,rules,size:M" "$DEV_C" "$(cat <<'EOF'
**Owner:** C | **Depends on:** K2

- [ ] Add, edit, prioritize, mitigate custom threats linked to an element ID
- [ ] `refreshGenerated()`: keep threats with `modified: true` or `origin: 'user'`; update untouched generated ones; add new ones; flag threats whose element was deleted as **orphaned** instead of removing them

**Acceptance (tests):** edit then refresh keeps the edit; untouched threat then refresh is updated; element removed leaves threat orphaned.
EOF
)"

mk "U1: UI shell with plug-in slots" "ui,accessibility,size:M" "$DEV_D" "$(cat <<'EOF'
**Owner:** D | **Depends on:** T0

- [ ] Layout: toolbar (New, Open, Save, Export, Refresh threats), main canvas slot, right panel slot, threats slot
- [ ] Plug-ins contribute components via the registry
- [ ] Semantic landmarks, visible focus styles, skip links

**Acceptance:** Diagram plug-in and Threats panel mount in their slots without the shell importing them directly.
EOF
)"

mk "T2: Threats panel UI" "ui,size:L" "$DEV_D" "$(cat <<'EOF'
**Owner:** D | **Depends on:** T1 (mock OK), U1

- [ ] Table/list grouped by element and category
- [ ] Origin badge (generated/user) and modified state
- [ ] Add, edit, set priority, add mitigation
- [ ] Click a threat to highlight its element on the canvas
- [ ] "Refresh suggestions" button: rule engine, then T1 merge

**Acceptance:** full manual flow from FR 2.2 works and a refresh never discards edits. Build against a mocked T1 first.
EOF
)"

mk "O1: Sample model and Load sample - NFR 1" "ui,size:S" "$DEV_D" "$(cat <<'EOF'
**Owner:** D | **Depends on:** K2

- [ ] Small sample model (browser, API, database, one trust boundary)
- [ ] "Load sample" button on the start screen
- [ ] Short plain-language hints

**Acceptance:** someone outside the team can load the sample and find a threat for a given component in under two minutes.
EOF
)"

mk "S1: Local file provider - FR 3.1" "plugin,storage,size:M" "$DEV_E" "$(cat <<'EOF'
**Owner:** E | **Depends on:** K2

- [ ] Implement Storage contract
- [ ] Save via File System Access API where available, download fallback
- [ ] Open via file picker/upload
- [ ] Validate through K2 on load; show readable errors instead of crashing

**Acceptance:** save, reload page, open: diagram and threats identical. Invalid files rejected with a message.
EOF
)"

mk "E1: HTML exporter - FR 5 (partial)" "plugin,storage,size:M" "$DEV_E" "$(cat <<'EOF'
**Owner:** E | **Depends on:** K2

- [ ] Implement `render(model, options) -> Blob`
- [ ] Self-contained single HTML file: project metadata, element inventory, threats grouped by element with priority and mitigation status
- [ ] All user input escaped (no raw HTML injection)

**Acceptance:** file opens offline and matches in-app data. A threat title containing `<script>` renders as text.
EOF
)"

mk "I1: Integration, smoke test and README" "setup,size:M" "$DEV_E" "$(cat <<'EOF'
**Owner:** E (+ all) | **Depends on:** all

- [ ] One end-to-end test (Playwright or manual script): load sample, refresh threats, edit one, refresh again, save, reopen, export
- [ ] README: setup, architecture diagram, how to add a plug-in
- [ ] Day 5 bug bash with all five; nothing new after midday
EOF
)"

echo "Done. View: https://github.com/$REPO/issues"