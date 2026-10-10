# Changelog

All notable changes to Pane are documented here.

## Unreleased

- Let Control+Shift+[ and Control+Shift+] (the physical bracket keys) cycle the picker layout chips while search stays focused. The highlight and a Tab-focused row move together; cycling or clicking a chip paints chips and row verbs in place so the highlighted row, focus, and thumbnails stay put. Hover follows a focused row but leaves Add / Floating / Unsplit and search alone, and ignores mouseovers caused by keyboard or wheel scrolling (the highlight stays until a real pointer move). Recording that chord as Open Pane or a layout shortcut is rejected. An already-saved copy still opens the picker, but does not toggle it closed while the overlay is open. A pre-existing non-US Ctrl+Shift+* layout-menu shortcut still fires when the picker is closed.
- Remove experimental and prototype labels from Scrolling, Horizontal accordion, and settings. Saved layout IDs and preference keys are unchanged.

## 0.11.0 — 2026-10-05

- Open the selected split's layout menu with Ctrl+Shift+L on Mac or Alt+Shift+L on Windows/Linux. The Mac default changed because Option modifies letter keys before Pane can read them on real macOS. Record a different shortcut in settings.
- Keep layout presentation and focus when replacing or removing panes. Failed swaps now report whether recovery succeeded.
- Cancel scrolling overview with Escape or by opening the layout menu. Preserve custom column widths through layout changes.
- Add section resets, shortcut recording warnings, and the same controls in both settings entry points.
- Make toolbar visibility consistent, with Auto-hide or Always visible and a per-panel floating pin.
- Clear split-recovery metadata by whole split group on disable so hidden-workspace unsplits do not come back later, while still preserving fully hidden pending groups for restore.
- **Experimental:** restore floating positions, sizes, and header pins after restart, fitting panels inside smaller windows. Docking or disabling Pane clears the saved state.
- **Experimental features included:** scrolling and snapshot scrolling are available from the layout menu. They are optional; existing tiled splits remain available. Native Windows and floating restart verification for this release is still pending. Report bugs with your Zen/Sine versions and reproduction steps.

## 0.10.0-dev — previous development updates

- Experimental scrolling layout: pages stay full width until you hold the modifier to reveal columns. Scroll with the wheel or two fingers, then release to expand the centered tab. Resize each column by its edge and reset its width with a double-click. Modified gestures are shielded from webpages. Scrolling layouts and widths reset after restarting.

- Inset accordion separators away from rounded corners and add separate active-tab border thickness, color, opacity, and preview.

- Restore accordion layouts after reopening Zen, while preserving the underlying split and divider sizes.

- Group settings into collapsible sections, shorten descriptions, and show custom controls only when they apply.

- Quick start for everyone updating, missed-feature cards, and a guide that can be reopened from Pane appearance settings.
- A dismissible feature notice shows once when a new announcement ships, with a small layout reference.

- Horizontal accordion for existing splits, with live page edges and restoration of the original tiled layout.
- Customizable previous/next accordion shortcuts, navigation that wraps, and shortcut hints in the layout menu.
- Soft shadows separate accordion tabs by default. Optional edge lines have thickness, color, and opacity controls.
- Wider accordion edges are easier to click, with small favicon and title hints on hover.
- Smoother accordion switching and toolbar controls, delayed hover hints that stay in place, and reduced-motion support.
- Returning a pane to a normal tab keeps focus on the remaining split. Accordion controls recover when Zen rebuilds them.

- Show combined previews of existing splits when opening Pane from a solo tab. Add that tab to the selected split as a grid pane or a floating pane.
- Unsplit a group directly from its card while keeping every page open. Give split previews, labels, and actions their own space, with a quieter Unsplit button.

- Use Alt+Shift+P as the Windows and Linux default instead of Ctrl+Alt or Ctrl+Shift shortcuts that collide with Zen and AltGr keyboard layouts. Mac keeps Control+Option+R.

- Move Windows and Linux diagnostics to Alt+Shift+D while keeping Control+Option+D on Mac.

- Float multiple tabs in the same split, each with its own position, size, and header pin. Docking or closing one keeps the others floating.

- Replace platform-dependent text glyphs with a consistent vendored Lucide icon set across picker, split, layout, and floating controls.

- Use filled destination shapes in the layout menu, restore the native move and remove toolbar icons, and keep thumbnail titles and URLs inside their cards with comfortable bottom spacing.

- Split standard tabs, pinned tabs, folder tabs, and Essentials with their original browser instances, preserving page history, playback, forms, and scroll position.

- Return tabs to their original workspace, section, folder, and sidebar position after they leave a split, including after a browser restart. Essentials keep a shortcut in their section while split.

- Briefly reveal controls when switching panes, widen the top-edge target, and delay hiding to make toolbars easier to reach.

- Add per-pane Back and Forward controls to split and floating toolbars, with live history availability.

- Auto-hide split toolbars until the pointer reaches their top edge or their controls receive keyboard focus.

- Support folder tabs in the picker, replacement, splits, and floating views while returning them to their original folders afterward.

- Slim floating headers to one row and auto-hide them over the page, with a keep-visible toggle and keyboard access.

Inspired by u/doskey’s suggestion and the Samsung Galaxy Fold Multi Window team’s work. Thank you to both for inspiring Pane’s split and floating tab controls.

- Make the selected layout a high-contrast rounded pill with a checkmark; strengthen tab-card and layout-menu selection states.
- Resize floating tabs from all four edges and corners, with a visible bottom-right grip and anchored minimum sizes.

- Fix real macOS Control+Option key events being rejected as AltGraph text entry.
- Open Pane from a normal tab to create a split or floating view.
- Add in-memory tab thumbnails, opening modes, and a keyboard-accessible layout menu.
- Switch between side-by-side, stacked, and grid layouts using Zen’s native split engine.
- Float a live tab inside the browser, drag or resize it, then dock it or return it to the sidebar.
- Preserve the existing browser instance, form content, and scroll position through layout changes.
- Keep the original pane replacement path and its divider-size preservation.


- Add sliders with precise number entry, native color pickers with RGBA and opacity controls, and a live appearance preview in Sine settings.
- Add per-control resets and support intermediate appearance values instead of only preset sizes.

- Add custom picker and diagnostic shortcuts, including Command on Mac.
- Keep Control+Option+R as the Mac default and fix Option-modified character matching.
- Ignore held-key repeats and text composition; give the picker priority when shortcuts overlap.

## 0.9.0 — 2026-09-02

- Added an independent privacy-safe diagnostics bootstrap that still works when the main Pane picker fails to initialize.
- Added Ctrl+Alt+D and an in-picker ⓘ action for copying support reports.
- Reports browser, Windows, Sine permission, split compatibility, anonymous component counts, and recent Pane lifecycle events without collecting browsing content.
- Added actionable initialization and replacement events plus clearer GitHub bug-report fields.
- Expanded package validation to require and verify the diagnostics entry point.

## 0.8.0 — 2026-09-02

- Added Sine 2.3 live-unload integration so disabling, enabling, and reloading Pane no longer leaves a stale script instance behind.
- Added resilient split-header discovery for session restoration and browser-chrome mods that rebuild tab-group UI.
- Assigned Pane a later Sine load order and added a visible Browser Console readiness marker.
- Documented the unofficial-JavaScript permission, clean restart procedure, current Windows requirements, and first-install recovery steps.
- Expanded package validation and compatibility testing for clean GitHub installs.

## 0.7.0 — 2026-09-01

- Completed the public rebrand from the prototype name to Pane.
- Changed the Sine package identity to `zen-pane-manager`.
- Renamed the runtime script, preference namespace, and internal UI identifiers for a cohesive contributor-facing codebase.
- Added a public roadmap, newcomer guidance, and ready-to-adapt launch copy.

## 0.6.0 — 2026-09-01

- Added System, Clear, Frosted, Tinted, and Custom glass presets.
- Reorganized settings into opening, appearance, tab behavior, and advanced sections.
- Anchored the picker to the active pane when opened from its ⇄ button; keyboard openings remain centered according to the chosen position.
- Added automatic compact-view columns that adapt to picker width.
- Rejected invisible accent colors so keyboard focus remains visible.
- Raised secondary-text contrast and removed overly small text sizes.
- Added friendlier semantic labels while retaining exact CSS color controls for advanced customization.
- Documented System glass as the appearance reset path.

## 0.5.0 — 2026-09-01

- Added separate customizable light and dark glass tints.
- Added a customizable focus and highlight color.
- Added live controls for glass blur, corner radius, width, and screen position.
- Added configurable recent-tab count and grid columns.
- Added optional background dimming and keyboard-footer visibility.
- Validates custom CSS colors and falls back safely when a value is invalid.

## 0.4.0 — 2026-09-01

- Replaced the large modal list with a compact floating glass popover.
- Shows four recently used tabs by default in a two-column card layout.
- Added an explicit Show all / Show less control.
- Searching automatically expands across all eligible open tabs.
- Escape now clears search, collapses the expanded list, and then closes the picker.
- Removed native Windows search-field appearance and the full-screen gray veil.

## 0.3.1 — 2026-09-01

- Added the public maintainer identity `jasi` / `@001vamp`.
- Confirmed MPL-2.0 as the project license to align with Zen Browser and Sine.
- Documented commercial-use implications, free official distribution, privacy, and privileged-script security boundaries.
- Added an independence disclaimer for Zen Browser and Sine.

## 0.3.0 — 2026-09-01

### Safety

- Added complete best-effort rollback for failed replacements.
- Added an idempotent lifecycle and teardown for safe Sine hot reloads.
- Added a compatibility preflight for Zen's internal split-view methods.
- Excluded pinned tabs from the public beta until cross-version behavior is verified.

### Accessibility and behavior

- Trapped keyboard focus inside the modal picker.
- Restored focus to the originating pane when cancelling.
- Made picker appearance, ordering, and pane-button settings update live.
- Added reduced-motion styling and polite status announcements.

### Project

- Changed the public author identity to `jasi`.
- Added compatibility and contribution documentation.

## 0.2.0 — 2026-09-01

- Added a searchable, human-readable tab picker.
- Added recent-tab ordering, search highlighting, status messages, and pane buttons.
- Added Sine preferences for shortcut, picker density, ordering, and old-tab behavior.

## 0.1.0 — 2026-09-01

- Initial working prototype preserving Zen split-tree geometry during replacement.
