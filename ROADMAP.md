# Pane roadmap

Reviewed October 2, 2026 against the current working tree on `custom-keybindings`.

Pane should let people rearrange their tabs without losing their pages, sidebar placement, layout, or focus. The next release should make that promise consistent before adding more layouts.

This is a prioritized plan, not a release schedule. See [the review](docs/pane-product-review.md) for the evidence and remaining verification gaps.

## Current position

Pane supports replacing panes, right/below/grid splits, existing-split destinations, multiple floating tabs, horizontal accordion, scrolling, appearance previews, recorded shortcuts, diagnostics, and update guides.

The automated suite passes. The reliability/settings update was committed and pushed as `f59cd52` on `custom-keybindings`. Fixture tests establish controller behavior; they do not establish native rendering, trackpad behavior, or Windows compatibility for the latest changes. PR #6 landed accordion drag-resize; PR #7 combined the scrolling modes into one Scrolling layout. Picker, layout menu, and settings no longer mark these as experimental. Floating geometry and pins now have a local session-recovery implementation with fixture coverage; native verification is pending.

## Implementation checkpoint — October 2

Phases 1–3 now have local implementation work: detach/replacement presentation preservation, failure-injection tests and accurate rollback messages, shutdown/disable metadata handling, unload cleanup, named navigation actions, shared section labels, section resets, recorded-shortcut warnings, complete tab-spacing controls, and updated privacy/release documentation.

`npm test` and diff checks pass. Native macOS settings loading, plain-key warning, Escape cancellation, shortcut recording, and default restoration were verified. The latest fixes are uncommitted and installed locally. The full native gesture/restart matrix, Windows verification, clean-install/archive review, and screenshot refresh remain release gates. These phases are not yet certified for a stable release.

## 1. Finish the reliability release

**Outcome:** everyday operations preserve the user's state and have an honest recovery path.

- Preserve accordion/scrolling presentation when one pane leaves a group that still has at least two tabs. Today `detach()` clears that presentation for the whole group.
- Audit replacement, add, dock, detach, and unsplit as transactions. Capture tab placement, selection, native tree/divider sizes, and presentation before mutation. Report incomplete rollback honestly rather than claiming nothing changed.
- Finish disable/reload cleanup: remove the global toolbar attribute, custom inline toolbar properties, and settings helper nodes. Distinguish disabling Pane from browser shutdown when retaining session metadata.
- Verify the recent menu/overview arbitration, Escape cancellation, width preservation, and slow-page recovery fixes in native Zen.
- Exercise tab closure and workspace changes during a gesture or paint wait; no stranded cover, captured scrolling, or unexpected focus change.

**Release gate:** exact steps and results recorded for macOS and Windows, with Zen/Sine versions. Cover mouse and trackpad, two/four panes, heavy pages, restart, and two disable/enable cycles. Keep scrolling experimental until its rendering and input cases pass.

## 2. Make settings and navigation predictable

**Outcome:** every setting is understandable and reachable from either entry point.

- Use one settings schema for types, defaults, conditions, sections, resets, and shortcut actions. The complete page and Sine panel should expose the same controls.
- Replace navigation-by-array-index with named actions; give layout actions their own names instead of treating the layout menu as an accordion shortcut.
- Add section resets with clear scope. Appearance reset must not change navigation or column widths.
- Warn when recording an unmodified letter/number. Explain that OS/browser conflicts cannot be detected reliably; keep Disabled and Use default available.
- Make keyboard behavior explicit: accordion wraps, scrolling currently stops at the ends. Keep intentional differences documented.
- Audit keyboard-only use, focus restoration, accessible names, live error messages, reduced motion, and narrow settings windows. Include the slow-page recovery control and snapshot preview.

**Done when:** every shortcut can be recorded, cancelled, disabled, and reset; changing a preference updates both settings entry points; no hidden raw control reappears after a preference change.

## 3. Bring the release story up to date

**Outcome:** installation instructions, screenshots, privacy statements, and release checks describe the shipped behavior.

- Update README instructions for recorded shortcuts, the complete settings page, the layout-menu shortcut, toolbar visibility, Escape, and accordion session recovery.
- Explain exactly what is stored locally: tab placement, layout/group identifiers, active tabs, widths, and notice acknowledgement. Explain in-memory page captures separately from diagnostics and external transmission.
- Refresh compatibility claims with exact tested versions; distinguish owner everyday-use reports from completed release scenarios.
- Correct the release checklist's obsolete Ctrl+Alt+D instruction and add accordion/scrolling restart and input checks.
- Separate product assets from local backups, QA outputs, promo experiments, and machine-specific agent files. Review the release archive before publishing; do not discard local work.
- Prepare current sample-based screenshots and concise release notes after behavior is verified.

**Release gate:** a clean Sine installation works from the intended repository/ref; the archive contains the required files and no private or machine-specific artifacts. Commit, push, tagging, and publication require owner approval.

## 4. Add dependable floating persistence

**Outcome:** floating tabs reopen where users expect them.

- Persist per-tab geometry and header pins with a versioned session format.
- Fit restored panels inside a smaller window, validate saved values, and skip closed/missing tabs.
- Preserve the original browser instance and tab origin; never restore by cloning the URL.
- Define shutdown, disable, and re-enable behavior before implementation. Keep one native background pane and respect Zen's tab limit.

**Done when:** multiple floats restore across restart, smaller windows, missing tabs, and mixed pinned/Essential/folder groups without losing forms, history, or placement.

## 5. Consolidate the implementation

**Outcome:** future fixes affect one place and are easier to test.

- After lifecycle behavior is covered, separate native Zen API access, layout/session state, input gestures, and toolbar rendering from the large controllers.
- Share toolbar appearance/visibility and shortcut conflict rules across layouts.
- Keep tests at behavior boundaries: transactions, session migrations, gesture cancellation, focus, and cleanup. Add coverage for the settings DOM and replacement rollback where current fixtures leave gaps.
- Keep a small documented native smoke test. Extend existing tools only to cover a concrete release risk.

Avoid a broad rewrite. Move one responsibility at a time while preserving behavior.

## Later, after these gates

- Undo the last layout/replacement action, subject to tab availability and explicit handling of closed outgoing tabs.
- Named layouts and versioned settings export/import.
- Vertical accordion, only if it solves a workflow the existing layouts cannot.
- Snapshot scrolling is now the combined Scrolling layout (PR #7). Keep the `snapshot` compatibility alias; do not add a second scrolling menu choice.
- Compatibility adapters when supported Zen versions actually diverge.

## Boundaries

Keep page state and divider geometry, local-only operation, keyboard access, explicit recovery, and truthful verification. Pane works inside Zen; OS-level windows, cross-workspace tab moves, and bypassing Zen's split limit are outside this roadmap.

## October 5 checkpoint

- Committed and pushed the reliability/settings/documentation pass as `f59cd52` to `custom-keybindings`.
- Verified the layout-menu shortcut opens the existing split layout menu in native macOS Zen 1.22.3b, and Escape closes it. The Mac default is now Ctrl+Shift+L because Option modifies letter keys before Pane can read them on real macOS. Controller coverage also checks overview cancellation and recording suppression.
- Phase 4 has local floating-session implementation: versioned per-tab geometry and pin records, delayed recovery until native session restoration, bounded panels, original page instances, and docking/disable cleanup. The automated suite covers these cases. Native floating restart, protected-tab placement, and Windows verification are still release gates.
- Phase 5 remains: consolidate one responsibility at a time, beginning with session presentation state. No broad controller rewrite is planned.

## Main release — October 5

Version 0.11.0 is prepared for the normal `main` update channel. Its README, changelog, and in-app update card identify scrolling, snapshot scrolling, and floating session recovery as optional experimental features. Existing tiled layouts are not automatically switched. Automated checks pass; native Windows and floating restart gates remain open. Phase 5 consolidation remains next.

## Label graduation — October 9

PR #6 (accordion drag-resize) and PR #7 (combined Scrolling) are on `main`. Picker, layout menu, and settings now say Scrolling and Horizontal accordion without experimental or prototype labels. Preference keys, `scrolling`/`accordion` IDs, `pane-scrolling-v1`, and the `snapshot` alias are unchanged. Saved IDs that contain `experimental` still restore and rewrite to the canonical ID. Native input, restart, and Windows gates remain open; this change is labels and docs only.
