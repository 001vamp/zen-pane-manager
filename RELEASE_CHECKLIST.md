# Release checklist

## Code and metadata

- [ ] `theme.json`, `package.json`, and `CHANGELOG.md` use the same version.
- [ ] `npm test` passes.
- [ ] The compatibility matrix is complete for the target Zen release.
- [ ] The root GitHub ZIP contains `theme.json`, `keybindings.mjs`, `multiwindow.mjs`, `appearance.mjs`, `pane-settings.uc.mjs`, `settings.html`, `settings-page.mjs`, `pane-diagnostics.uc.mjs`, `pane.uc.mjs`, `chrome.css`, and `preferences.json` at the paths declared by the manifest.
- [ ] Sine 2.3+ live disable/enable unloads and reloads Pane without restarting Zen.
- [ ] No private URLs, tab titles, profile paths, or local machine data are present.
- [ ] License and attribution notices remain intact.

## Visual review

- [ ] Light and dark glass defaults are readable.
- [ ] Narrow, standard, wide, and extra-wide picker settings remain usable.
- [ ] One-, two-, and three-column compact layouts were checked.
- [ ] Keyboard focus, reduced motion, and high-DPI text were checked.
- [ ] Capture a current 600×400 PNG without private browsing information for marketplace submission.

## GitHub release

- [ ] Push the release commit to `main`.
- [ ] Create a `vX.Y.Z` tag matching the manifest version.
- [ ] Create release notes from `CHANGELOG.md`.
- [ ] Verify the validation workflow passes.
- [ ] Test a clean Sine installation from `001vamp/zen-pane-manager`.
- [ ] Test with unofficial JavaScript disabled, then enabled, and verify the documented recovery flow.
- [ ] Test alongside Advanced Tab Groups with both possible enable orders.
- [ ] Verify `[Pane diagnostics] diagnostics bootstrap loaded` and `[Pane] vX.Y.Z ready` appear in the Browser Console.
- [ ] Verify Control+Option+D on Mac or Alt+Shift+D on Windows/Linux copies a report before and after the main runtime loads.
- [ ] Confirm the report contains no tab titles, URLs, searches, history, file paths, or stacks.

## Marketplace

- [ ] Confirm the repository is public.
- [ ] Confirm README, screenshot, source license, and preferences meet current Sine requirements.
- [ ] Submit through Sine's official marketplace issue template.

- [ ] Verify custom picker and diagnostic shortcuts on macOS and Windows, including changing them without restarting.

- [ ] Verify sliders, numeric edits, RGBA/opacity, reset, and native color selection in the appearance page and Sine panel.

## Multi-window development checks

- [ ] Run `scripts/test-zen-browser.py` against a disposable `pane-zen-qa` profile with Sine and this checkout installed (requires `marionette_driver`, port 2829).
- [ ] Verify normal-tab entry, thumbnails, search, and all opening modes.
- [ ] Verify side-by-side, stacked, grid, and the four-tab limit.
- [ ] Verify floating drag/resize, form state, scroll, docking, sidebar return, tab closure, and unload cleanup.
- [ ] Verify a replacement preserves user-adjusted divider sizes.
- [ ] Test the same flows on Windows before publishing a release.

For feature updates, append a card with a unique ID to `UPDATE_NOTICES` in `pane.uc.mjs`. Keep old cards and their IDs in chronological order so users can see missed features. Routine fixes do not need a card. Change `QUICK_START_ID` only when everyone should see an updated guide. Delivery and acknowledgement are stored separately: “Got it” marks cards read; closing leaves them available in Pane settings. Set `mod.pane.update-notices` to false in about:config to disable automatic notices.

## Reliability and settings gates

- [ ] Record exact Zen/Sine versions and results for the latest build on macOS and Windows.
- [ ] Remove one of three accordion/scrolling panes; verify the remaining presentation and selected tab.
- [ ] Replace a pane with forms/history/audio state; verify divider geometry and floating geometry/pin transfer.
- [ ] Inject failures before/after membership changes; verify recovery and honest incomplete-rollback messaging.
- [ ] Wheel and trackpad: boundaries, momentum, Escape, layout-menu shortcut, focus loss, and modifier release.
- [ ] Slow-page cover stays up until the target is ready; tiled recovery remains usable.
- [ ] Restart restores accordion/scrolling, widths, and tab origins. Disable/enable twice leaves no stale UI or metadata.
- [ ] Both settings entry points expose the same controls; recorded shortcuts, conflict messages, warning confirmation, and section resets work.
- [ ] Keyboard-only, reduced motion, light/dark personalization, and narrow windows remain usable.
- [ ] Confirm picker, layout menu, and settings show Scrolling and Horizontal accordion without experimental or prototype labels. Keep the scrolling input/restart recipes.
- [ ] Review release ZIP contents: exclude local-work, output, agent metadata, and unrelated promo experiments; preserve those locally.

Unchecked items are work remaining, not evidence of compatibility. Publication requires owner approval.
