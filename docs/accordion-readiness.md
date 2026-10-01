# Accordion readiness review

October 1, 2026. Local, uncommitted build.

Verdict: ready for owner beta testing, not yet verified for a production release.

Automated coverage passes for navigation and wrapping, rapid switching/cancelled animations, reduced motion, hint delay/cleanup, pane removal and focus preservation, toolbar rebuilding, restore-to-tiles, session metadata recovery, and original native layout-tree preservation.

The restart test reconstructs the controller around saved native-tab metadata. It is not an actual Zen process restart test. Native macOS and Windows session restoration, multiple workspaces/windows, page input, and rounded-border rendering still need owner validation. No browsing content is written by accordion persistence; it stores a group ID and active-tab flag in SessionStore.

Review improvement: starting accordion now includes metadata saving inside its rollback guard. The scrolling prototype is isolated from accordion metadata and clears its geometry when switching modes.

Scrolling is experimental: native split limits still apply; floating panes must be docked; no scrolling-session persistence, drag reorder, overview, or column stacking yet. Default input is Option/Alt+Shift with wheel or two-finger scroll, with a settings choice for Option/Alt or Disabled. Header arrows are the fallback. Browser-chrome forwarding of real trackpad events needs native validation.
