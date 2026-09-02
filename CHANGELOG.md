# Changelog

All notable changes to Pane are documented here.

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
