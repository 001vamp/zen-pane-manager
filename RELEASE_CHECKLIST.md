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
- [ ] Verify Ctrl+Alt+D copies a report before and after the main runtime loads.
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
