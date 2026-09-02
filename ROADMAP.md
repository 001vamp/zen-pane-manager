# Pane roadmap

Pane exists to make Zen split views feel flexible without making their layout fragile. This roadmap is a direction, not a promise or a closed specification. Better ideas are welcome.

## Now

- Gather compatibility results across current Zen and Sine releases.
- Polish keyboard navigation, focus behavior, contrast, and screen-reader semantics.
- Test horizontal, vertical, grid, and nested split layouts more broadly.
- Find and document tab-state edge cases such as discarded, container, audio, and unloaded tabs.

## Next

- Explore a history action for quickly undoing the most recent pane replacement.
- Improve target-pane context and previews without reading unnecessary page data.
- Make pane replacement useful with larger tab collections and multiple workspaces.
- Add automated tests where Zen's privileged browser APIs can be represented safely.

## Later and experimental

- Named split layouts or lightweight pane workflows.
- More replacement actions built around the same preserve-the-layout principle.
- Compatibility adapters if Zen's internal split API changes substantially.

## Ways to help

- Report one reproducible problem with exact versions and layout details.
- Test a case that is not yet represented in `COMPATIBILITY.md`.
- Improve accessibility, documentation, or contributor tooling.
- Open a feature request describing the workflow problem before proposing a large UI.

The non-negotiables are local-only behavior, no telemetry, preserved divider geometry, keyboard accessibility, and a rollback path for mutations.
