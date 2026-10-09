# Pane product review

October 2, 2026. Scope: the current source, uncommitted diff, recent Git history, settings, tests, and release documentation. This was a code/documentation review, not a new native browser test run.

October 9, 2026 note: after PR #6 and PR #7 landed, current picker/menu/settings labels no longer say experimental. Native input/restart/Windows gates described below remain open; see ROADMAP’s October 9 checkpoint.

## Follow-up implementation

The original findings below are retained as the review record. A subsequent local pass addressed detach/replacement presentation, early replacement failures, rollback messaging, shutdown/disable distinction, toolbar/settings cleanup, named shortcut actions, section resets, warning confirmation, and stale documentation. Automated regression tests pass. Native macOS settings warning/record/cancel/default flows were checked; the broader cross-platform release gates remain open.

## Assessment

Pane has a useful, coherent core: use the original tabs, preserve their state and placement, and offer several presentations of Zen's native splits. Existing-split previews, multiple floats, configurable appearance, diagnostics, and update guides make it more than a pane swapper.

The next step is consistency and release discipline. The latest automated suite and `git diff --check` pass. Scrolling should stay experimental until native input/rendering and restart checks cover the current build. Passing fixtures alone is not evidence that a private Zen API still behaves the same in every supported browser release.

## Findings that drive the roadmap

| Priority | Finding | Evidence and consequence |
| --- | --- | --- |
| High | Removing a pane drops the remaining group's presentation | `multiwindow.mjs: detach()` calls `clearAccordion(data)`, which also clears scrolling. A three-pane accordion or scrolling group becomes tiled when one pane leaves. Preserve the remaining presentation when two or more tabs remain. |
| High | Incomplete rollback can be reported as a successful rollback | `pane.uc.mjs: replacePane()` catches rollback errors but still shows “The pane was not changed.” An error can also occur after moving the incoming tab into the group but before `changed` is set. Capture every mutated state and distinguish failed operation from failed recovery. |
| High | Unload cleanup leaves presentation state on native UI | `pane.uc.mjs: destroy()` removes `pane-ready` but not `pane-toolbar-always` or the custom properties copied onto native headers. The settings enhancer also inserts `pane-complete-settings` without removing it in `destroy()`. Verify clean disable/re-enable and remove owned state. |
| High | Public docs describe older behavior | README says accordion returns to tiles after restart, describes typing shortcuts, and divides settings into appearance versus behavior entry points. Current code has session recovery and recorded controls in a complete page. RELEASE_CHECKLIST still refers to Ctrl+Alt+D. |
| High | Privacy wording is incomplete | PRIVACY says Pane does not read page contents or create identifiers. The picker/snapshot path captures visible pages locally; layout persistence creates local group identifiers. These are not telemetry, but the distinction should be explicit. README's “only tab placement details” also omits widths, presentation, and notice state. |
| Medium | Settings metadata and action routing are spread across files | `preferences.json`, `appearance.mjs`, and `keybindings.mjs` each define part of the controls. `accordionShortcuts` now includes the layout menu; previous/next dispatch relies on array indices. Consolidate metadata and use named actions. |
| Medium | Automated coverage does not close native release risks | The suite covers geometry, origins, controller events, diagnostics, shortcut parsing, and notice lifecycle. It does not establish real compositor handoff, trackpad momentum, current Windows behavior, or complete settings interaction. Replacement and settings deserve targeted failure/UI coverage. |
| Medium | Release workspace contains unrelated local artifacts | Untracked paths include backups, QA output, agent metadata, and promo work. Current ignore rules are minimal. Select the product package deliberately rather than staging the entire directory. Preserve useful local work. |

## Strengths to preserve

- Original browser/tab identity and SessionStore-backed tab origins, including pinned tabs, Essentials, and folders.
- Native tree preservation for replacement and presentation-only layouts.
- Clear split limits, same-workspace eligibility, and protected-tab checks.
- Local diagnostics that omit sensitive browsing details, plus standalone startup diagnostics.
- Recent Escape, width preservation, shortcut recording, menu arbitration, and paint-readiness recovery work, with focused controller regression tests.
- Live appearance previews, Lucide icons, and existing screenshot sheets that use the actual stylesheet.

## Verification plan

Record browser/loader versions and results; do not turn unchecked scenarios into compatibility claims.

1. Start with a clean install and confirm both settings entry points, picker shortcut, and layout-menu shortcut.
2. Exercise right/below/grid replacement with unequal dividers and mixed standard/pinned/Essential/folder tabs. Include discarded pages, forms, history, and audio.
3. In accordion and scrolling, remove one of three tabs, replace one, close one, and restart. Verify remaining presentation, selected tab, widths, and origins.
4. Exercise wheel and trackpad input: boundaries, momentum, Escape, menu opening, focus changes, and modifier release. Slow a destination and confirm recovery stays usable.
5. Disable/enable twice, then restart. Confirm no covers, toolbars, helper nodes, stale shortcuts, or unrecovered tab placement remain.
6. Check keyboard-only controls, light/dark personalization, reduced motion, and narrow windows.

These checks belong before a stable claim. Existing everyday-use reports remain useful context, but they do not cover all recent changes.

## Suggested next release

Ship a reliability release around lifecycle/transaction fixes, coherent settings, and accurate documentation. Keep scrolling explicitly experimental. Floating session recovery is the next feature after that release, followed by measured controller consolidation. New layouts come later.
