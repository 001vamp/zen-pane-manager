# Plan to remove Pane's experimental labels

Planning only, October 9, 2026. No product files changed, no commit or push, and no native Zen process, window, or profile accessed.

## Baseline and dependencies

- Working checkout: `codex/experimental-labels`, `3ad11151b2c3792d3125ebec2a08c82af381b837`, tracking `origin/main`. Main was not checked out or modified.
- Inspected local remote refs: PR #6 `origin/codex/accordion-resize` at `581b651efbb51711fe4ef5d28d64f7f765802a4a`; PR #7 `origin/codex/scrolling-merge` at `e0d8098092f709554b24c9af7a60a8ccd348d271`. These are clone snapshots, not a live GitHub status check. PR #6 is newer than the `bdec715` quoted in the supplied roadmap copy.
- Plan assumes both land. Follow the supplied `/tmp/pane-roadmap-snapshot.md`: PR #6 first, then rebase PR #7 and rerun checks. Both edit `multiwindow.mjs` and `scripts/test-multiple-floats.mjs`. I did not compose or merge the two branches; separate passing suites do not prove the combined result.
- Dex session `ae53f442-def6-41f0-b1e8-0db25dc28fa4` began before code exploration, then `dex brief` ran. Initial begin found no `.dex`. Init created local state but global registry registration was sandbox-blocked; supported `DEX_SKIP_REGISTRY=1` allowed begin/brief and local recording. The fresh brief had no prior directives, tasks, decisions, or handoff. The supplied roadmap is the substantive project context here.
- Historical memory was used only to identify likely lifecycle risks, then checked against this checkout. It is not current native evidence.

## Conclusion and safety boundary

There is no experimental feature flag, experimental preference key, hidden experimental-only settings section, or default-off recovery switch in the inspected product. The status words are labels and release promises. Removing those words alone does not make a layout default-on, expose hidden settings, reset user prefs, or change saved state. It does change visible text, accessible names, exact-text test expectations, and the implied readiness claim.

PR #7 is different: it intentionally changes old live-column Scrolling to snapshot-backed Scrolling, removes Snapshot as a menu choice, and canonicalizes old saved records. Those behavior changes belong to PR #7 and require their own checks before graduation. Do not fold another migration or default change into a label PR.

Native checks in this run: **NOT RUN**. Fixtures establish controller logic, not Zen's compositor, OS keyboard routing, real pointer capture, trackpad momentum, Sine reload, or process restart. Labels should come off only after the affected native recipes pass on the actual rebased build with recorded Zen/Sine versions.

## Per-feature blast radius

| Feature | What the status currently gates | User effects of label removal | State and behavior to preserve |
| --- | --- | --- | --- |
| Scrolling | `Scrolling (experimental)` in picker/menu, Sine separator, complete-settings summary; help/release docs warn about native readiness. No code enablement gate. | Shorter menu/settings names and accessible labels. No newly visible section and no automatic switch from tiles. A stronger stability claim. | `scrolling` ID, modifier choices including Disabled/custom, width default and overrides, session keys, input cancellation, privacy disclosure. After PR #7, preserve the `snapshot` compatibility alias. |
| Snapshot scrolling | `Snapshot scrolling (prototype)` in both mode lists on main. `snapshot` selects a genuinely different rendering path, not an experimental flag. | After PR #7 there is no separate label to graduate. Old users see one Scrolling choice; old live-column users get preview rendering because of PR #7. | Legacy calls and both old record variants must restore the combined layout with group/active tab/fractional widths retained. Keep internal snapshot capture code and compatibility aliases. |
| Floating session recovery | Experimental warning in README, changelog, update card and readiness docs. Floating itself already has a plain runtime label. | No new switch, no default change. Valid saved floats already recover automatically after native restore. Stability promise expands to position/size/pin recovery. | Version 1 `pane-floating-v1`, original browser identity, validation, bounds fitting, one background pane, delayed recovery, dock/disable cleanup, shutdown retention. |
| Horizontal accordion | README heading says prototype; runtime menus already say `Horizontal accordion`. | Documentation graduation only. No new menu option, setting, or persistence field. PR #6 separately adds drag resize. | `accordion` ID, native divider ratios and page identity, active-pane recovery. PR #6 drag width is session-only and resets after restart; do not promise persistent accordion width. |
| Demo and historical prototype references | Demo title, historical reviews/changelog, fixture names/comments. | Demo title can lose prototype if it depicts current behavior. Historical records should describe the version they actually reviewed. | JavaScript `Object.prototype`, `getPrototypeOf`, `prototypes`, snapshot transaction variables and preview machinery are unrelated and must remain. |

### Scrolling and Snapshot, code dependencies

Main references: `multiwindow.mjs:42-43` exports IDs/labels; `1135-1136` repeats menu text. `pane.uc.mjs:575` builds picker choices from `modeLabels`; `244-246`, `316`, `341`, `458` use those labels for help, actions and accessible names. The IDs in `data-mode` drive dispatch, not the strings. `arrange()` at `941-942` selects the two current implementations; `add()` at `1058-1061` applies/preserves them.

`preferences.json:226-279` defines the unconditional scrolling section, modifier default `0` and width default `65`. `appearance.mjs:5` uses the same width default; `appearance.mjs:45` supplies the complete-page section title. `keybindings.mjs:122-127` uses `0` for Alt/Option+Shift, `1` for Alt/Option, `2` for Disabled, `3` for custom. None means experimental enablement. Preserve `mod.pane.scrolling-modifier`, `mod.pane.scrolling-custom-modifier`, `mod.pane.scrolling-width`, and `mod.pane.section-scrolling` exactly.

`settings-page.mjs:18-37` constructs rows from property/id and applies schema conditions. `pane-settings.uc.mjs:377-406` finds sections by marker ID, places their existing nodes in details sections and resets prefs by node IDs. Only the first section initially opens; graduation should not expand Scrolling by default. `settings-page.mjs:35` and `pane-settings.uc.mjs:419-421` hide raw custom-shortcut/modifier rows because recorder controls replace them. This hiding is intentional and unrelated to graduation. Removing it would expose duplicate controls. `pane-settings.uc.mjs:269-273` keeps widths out of appearance reset; preserve that scope.

`multiwindow.mjs:69-71`, `125-145` save/restore `pane-scrolling-v1`. Main's saved `snapshot` boolean is a behavior discriminator. PR #7 replaces saved `snapshot` with `mode:"scrolling"`, keeps the same SessionStore key, accepts legacy group records and finite positive widths, and normalizes caller ID `snapshot` to `scrolling` before side effects. Its `presentationModes` excludes Snapshot and its `modeLabels` has one Scrolling label. Its restore loop retains active markers for presentation application. This is migration, not simply deleting a word. Do not rename keys, discard old booleans before recovery, remove `normalizeMode`, or remove snapshot canvases/CSS based on their names.

Real gates remain: a split with at least two tabs, docking floats before Scrolling, Zen's split limit, supported tab/API eligibility, modifier input, native-session readiness and valid matching saved groups. `multiwindow.mjs:561-569`, `136-145`, `692-758` implement the relevant main paths. Graduation must preserve all these gates.

### Floating recovery, code dependencies

`multiwindow.mjs:74-99` saves `{version:1,rect,headerPinned}` and restores without consulting an enablement preference. Recovery waits while `view._sessionRestoring`, requires a viable split, ignores missing/closing tabs, rejects invalid/future records, and keeps a background tab. `fitRectangle()` at `45-50` bounds geometry. Cleanup at `777`, `1252-1275` distinguishes dock/disable from shutdown. The label does not govern any of this.

Likely costly failures are invisible or unreachable panels after resize/restart, lost pin state, cloned pages losing history/drafts, wrong sidebar placement, and stale recovery after disable. Fixture coverage clears the logic cases listed below; native lifecycle and protected-tab placement remain unproven.

### Accordion, code dependencies

Main's menu label is already plain at `multiwindow.mjs:43`; only README's feature heading needs graduation. `pane-accordion-v1` saves group/active pane at `101-123`. PR #6 adds pointer boundaries and session-only width state, with geometry/lifecycle fixture coverage and an expanded native recipe. Do not change its session format or count resize-width reset after full restart as a failure: that reset is intentional. Do require old tiled divider ratios to return when exiting accordion.

## Complete status-reference inventory

Line numbers below refer to main `3ad1115`; PR-specific references are explicitly named. Inventory file: `/tmp/pane-labels-evidence/label-inventory-main.txt`.

| Location | Dependency and recommended treatment |
| --- | --- |
| `multiwindow.mjs:43,1135-1136` | Actual picker/menu status text. After PR #7 edit only the remaining Scrolling strings, preserve IDs. Snapshot option deletion belongs to PR #7. |
| `appearance.mjs:45` | Complete settings summary. Change text to Scrolling, preserve section key and order. |
| `preferences.json:228,279` | Sine section label and informational help. Remove status wording, retain description of persistence and unchanged schema/defaults. |
| `chrome.css:917` | Comment only. Clarify the combined implementation after PR #7; do not remove rules. |
| `pane.uc.mjs:149` | Versioned 0.11.0 card labels scrolling/snapshot/floating recovery experimental. Preserve old card ID and delivery/read prefs. Add a new uniquely identified graduation card rather than silently rewriting the old release promise. |
| `README.md:15,71,79,81,121` | Release introduction, accordion heading, Scrolling heading/name, floating recovery claim. PR #7 changes introduction but leaves current Scrolling headings/status and accordion prototype. Replace current descriptions after evidence, identify historical 0.11.0 context clearly. |
| `COMPATIBILITY.md:66` | Explicit experimental status and required native restart/current-platform evidence. PR #7 reduces this to Scrolling. Record exact tested revision/versions/scenarios before changing current status; do not mark unrelated matrix boxes passed. |
| `ROADMAP.md:11,13,31,102` | Current summary, open native verification, hard scrolling release gate, dated 0.11.0 checkpoint. Add dated graduation/evidence checkpoint; update current status and close only demonstrated gates. Keep historical checkpoints truthful. Also resolve the now-completed two-mode choice at `86` after PR #7. |
| `RELEASE_CHECKLIST.md:66` | Native gate explicitly requires experimental wording until checks pass. PR #7 changes it to one Scrolling mode. Replace with evidence-linked completion requirement; retain the regression recipe rather than deleting its checks. |
| `PRIVACY.md:7` | Preview capture disclosure. PR #7 says Experimental scrolling rather than Experimental snapshot scrolling. Remove adjective only; retain visible-page capture, local-memory, no-upload/no-deliberate-disk statements. |
| `CHANGELOG.md:13-14,18` | 0.11.0 experimental release notes and older live-column/reset-after-restart description. Add new graduation/migration notes, do not rewrite old releases to imply new behavior existed then. `102,172` are rebrand/initial-prototype history, not current feature labels. |
| `docs/accordion-readiness.md:11,13` | Historical prototype/readiness analysis. It still says no scrolling-session persistence/overview, contradicted by current code. Add a clearly dated superseding note with evidence and PR #6/#7 behavior; do not treat the old absence claim as a current release gate. |
| `docs/pane-product-review.md:13,52` | Historical recommendation to keep scrolling experimental. Preserve review context and link to the new evidence/checkpoint so it is not mistaken for current status. |
| `docs/pane-scrolling-showcase.html:3` | Static demo browser title says prototype. Rename or explicitly mark as historical depending on whether its illustrated behavior still matches combined Scrolling; it provides no native proof. |
| `scripts/test-multiwindow.mjs:4-5` | Exact label assertions break on rename. PR #7 removes Snapshot expectation and checks legacy normalization/geometry. Graduation changes Scrolling expectation to plain name; retain alias/geometry coverage. |
| `scripts/test-update-notice.mjs:57` | Asserts old 0.11.0 message includes experimental and optional. It can remain when old card is historical. A new card needs expected-backlog/delivery assertions updated because existing test assumes 0.11.0 is newest. Do not delete notice lifecycle coverage. |
| `scripts/test-multiple-floats.mjs:387,528-548` | Comment/local `snapshotPrototype` name, not status gates. Keep behavior assertions and PR #7 legacy Snapshot alias coverage. Rename locals only if useful, not necessary for graduation. |
| `.cursor/skills/verify-pane/features/scrolling.md:17` on PR #7 | Native migration recipe names Scrolling (experimental). Rename displayed expectation after graduation, retain both entry points, old-session migration, fractional widths, slow paint and restart checks. |
| `.cursor/skills/verify-pane/features/snapshot.md:3` on PR #7 | Now a migration note linking to the single Scrolling (experimental) layout. Rename link text; keep alias/migration record. Main's file is the separate Snapshot recipe and is superseded by PR #7. |
| `.cursor/skills/verify-pane/features/README.md:15` on main | Separate Snapshot row, removed by PR #7. Keep one Scrolling recipe and migration note. |
| `.cursor/skills/verify-pane/features/accordion.md`, `floating.md`, `restart-memory.md`, `settings.md` | No status-string gate on main. Preserve native recipes; use PR #6's expanded accordion drag recipe. Restart recipe limits proof to Pane-managed state and requires exact Zen version. Settings recipe covers both entry points and saved controls. |

No experimental/prototype property was found in `theme.json` or the preference schema. Other appearance/shortcut conditions are unrelated. `split-persistence.mjs`'s `prototypes` and `multiwindow.mjs`'s `Object.getPrototypeOf` are JavaScript object reconstruction, not feature maturity. Do not use a repository-wide word deletion.

## Executed safety proof

Evidence and executable probe are retained in `/tmp/pane-labels-evidence/`. `results.json` records exit 0 for all seven checks:

| Revision | npm test | Label-only controller probe |
| --- | --- | --- |
| Main `3ad1115` | PASS | PASS |
| PR #6 `581b651` | PASS | PASS |
| PR #7 `e0d8098` | PASS | PASS |

`git diff --check` on the working clone also passed. PR suites ran in unchanged `git archive` copies under `pr6/` and `pr7/`, not by checking out branches here. No dependency installation or browser connection was needed. I ran the underlying fixture command and whitespace check directly rather than the verify helper, whose extra step fetches origin/main. No fetch was needed for this clone-snapshot investigation. A separate read-only reviewer independently confirmed the absence of status preferences and identified the raw-row/privacy/history risks.

Reproduce the decisive probe:

```sh
node /tmp/pane-labels-evidence/prove-labels.mjs /private/tmp/pane-experimental-labels-20261009
node /tmp/pane-labels-evidence/prove-labels.mjs /tmp/pane-labels-evidence/pr6
node /tmp/pane-labels-evidence/prove-labels.mjs /tmp/pane-labels-evidence/pr7
```

The probe imports the real module, then imports an in-memory copy changing only parenthesized experimental/prototype label text. It executes the existing real controller fixtures against that copy, adjusting only the expected display strings. Product files stay untouched. It also parses the real preferences schema, confirms IDs/types/defaults/conditions are identical after relabeling, checks the section has no visibility condition, and calls the real `scrollingModifiers()` to prove Disabled still returns null. A fresh controller assertion proves no floating/scrolling/accordion presentation is created without user action or saved state. This is confidence level 4, executed code with mocked Zen APIs, not level 5, running-app reproduction.

Selected actual output:

```text
PASS label-only exports/schema: same IDs, modes, defaults, conditions; scrolling section unconditional; Disabled remains disabled.
PASS real controller fixture with labels removed in memory: test-multiwindow.mjs
PASS fresh controller does not auto-enable a presentation layout
Floating sessions: multiple panels, pins, smaller bounds, original pages, docking and disable passed.
PASS real controller fixture with labels removed in memory: test-multiple-floats.mjs
```

Main fixtures exercised saved scrolling widths at `scripts/test-multiple-floats.mjs:512-526` and floating lifecycle/invalid records at `562-584`. PR #7's real fixtures at `413-434` recovered both legacy boolean variants with `800.125` widths, kept the page at `1200px`, displayed the preview at `800.125px`, and rewrote the record to canonical mode. Its subsequent preview/paint recovery assertions also passed. PR #6's full fixture suite includes fractional drag geometry, pointer release/cancel, toolbar rebuild during drag and restart behavior. None establishes native hit targets or rendering.

Cleared by execution: label renaming alone changes neither dispatch IDs nor schema/defaults; Disabled remains disabled; a fresh layout is not switched automatically; floating validation/cleanup/page identity logic and scrolling migration/width logic still pass with plain labels. Remaining proof limits: real settings DOM/Sine row regrouping was read and schema-tested, not driven natively; composed PR #6/#7 code was not tested; full native input/restart remains unproven.

## Native checks required before graduation

Use `.cursor/skills/verify-pane/SKILL.md` isolation/identity/evidence rules in a future run, or Jasiel's manual checks. This run authorizes no launch/restart/disable of his running Zen. Record installed commit, exact Zen and Sine versions, entry point, action, expected result, observed result, and screenshots. A historical everyday-use report is not a completed current-build matrix. The supplied snapshot reports Windows passed and PR #3/#5 passes, whereas repo docs still say pending. Reconcile those with scenario/build evidence rather than either discarding owner results or treating them as proof of the new combined Scrolling/resize build.

1. **Accordion, after PR #6.** Run `features/accordion.md` including `accordion-drag-resize` from picker and layout menu, solo and existing split, 2/4 panes, interior/end panes and narrow windows. Drag both available edges, exceed bounds, release outside, cancel/lose capture, switch pages by click and keyboard, resize the window, and test reduced motion. Preserve drafts/scroll/history and native divider ratios when returning to tiles. Remove a member or leave the layout during drag; no lingering controls. Restart the isolated instance: expanded pane restores, resize width resets to its documented session-only default, other presentation recovery remains intact.
2. **Floating recovery.** Run `features/floating.md` and `restart-memory.md`: multiple floats with different geometry/pins, full process exit/relaunch of the test instance, smaller window, closed/missing/lazy tabs, hidden/other workspace groups, original browser/history/forms during transitions, pinned/Essential/folder placement, replacement and docking. Keep one native background pane. Docking and two Sine disable/enable cycles must clear the relevant records and stale UI; full shutdown must retain them. Repeat PR #5 hidden-workspace disabled-unsplit case and confirm it stays unsplit. Compare unsaved-form restart restoration against Zen's own baseline rather than promising Pane saves form data.
3. **Combined Scrolling, after rebased PR #7.** Run `features/scrolling.md` and migration note `snapshot.md`, both entry points, solo/add/join and existing split, 2/4 panes, narrow window and heavy/slow pages. Check exactly one Scrolling choice, preview cards with full-width live pages, draft/scroll/history retention, mouse wheel and physical trackpad including momentum/boundaries. Release selects the highlighted centered page; Escape restores start; menu shortcut/focus loss cancels without stale overlays or intercepted page input. Close a tab/change workspace during a gesture or paint wait. Drag and keyboard-resize columns; per-column reset and Reset all column widths work. Recreate both old Scrolling and Snapshot saved sessions with fractional widths and verify migration, selected pane, group membership and full restart widths. Slow paint must offer working tiled recovery. Update installation must leave existing tiled layouts tiled.
4. **Settings and release integration.** Run `features/settings.md` via Sine panel and complete page; confirm plain names, reachable scrolling section, raw custom rows remain hidden, modifier/default/custom/Disabled values persist, widths and unrelated sections survive resets, appearance reset leaves scrolling widths alone, keyboard focus and narrow windows work. Test native Ctrl+Shift+L on Mac and Alt+Shift+L on Windows/Linux with real input. Verify new notice delivery/read/opt-out behavior and old card IDs. Verify clean Sine install/archive and compatibility matrix before a stable release. Maintain the existing platform gate, record which target platforms/scenarios passed; do not claim Linux native certification from Windows fixtures.

## Recommended small PRs, in order

First land PR #6, rebase/land PR #7, run fixtures/verify-pane on the actual composed revision, and obtain the affected native evidence. Fix any failure in the feature's own focused PR before graduating it.

1. **Graduate Horizontal accordion.** After PR #6 native checks pass, remove prototype from README's heading and update current resize documentation with the session-only width limitation. Add dated evidence/compatibility/roadmap notes. Runtime menu is already plain; no controller/pref changes needed.
2. **Graduate floating session recovery.** After its native restart/bounds/origin/disable checks pass, update current README/readiness claims and add a new changelog entry and dated roadmap/compatibility evidence. Keep versioned records and automatic valid-state recovery unchanged. Do not introduce a new toggle or broaden persistence. This can ship independently of Scrolling's input gate once both predecessor PRs are integrated and regression checks pass.
3. **Graduate the single Scrolling layout.** After combined-input/rendering/migration/settings native checks pass, change remaining `modeLabels`/menu text, preferences separator/help and `settingsSections` title together. Update exact-text expectations, current README, privacy adjective, relevant verification recipes/migration link and demo description. Add the final graduation notice with a unique ID and update backlog tests; preserve historical cards and acknowledgement prefs. Close the scrolling experimental gate with evidence in ROADMAP/COMPATIBILITY/RELEASE_CHECKLIST, keep regression recipes, and append superseding notes to historical reviews/changelog. Never change mode IDs, default values, saved keys or alias handling in this PR.

If the checks finish in another order, wait on the failing feature rather than holding unrelated documentation graduation hostage. Do not remove the Snapshot alias as cleanup. Do not erase open gates merely to remove every search hit. After all three PRs, a targeted search should find status words only in clearly historical records/old update cards and ordinary JavaScript prototype terminology, with no current experimental menu/settings labels.
