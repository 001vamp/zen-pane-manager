# Scrolling

Arrange open tabs so snapshot columns with the scrolling appearance appear while the modifier is held, keeping live pages full width.

## Sub-features

- `scrolling`: Scrolling from picker and layout menu; solo and existing split; 2 and 4 panes.

## How to get to it (user POV)

Picker #pane-open-modes [data-mode="scrolling"]; existing split toolbar three-dot menu #pane-layout-menu [data-mode="scrolling"].

## Driving it with native Zen UI

Preconditions: SKILL.md doctor passes for the owned throwaway profile; seed A/B/C/D. Run the fixture helper first.

From solo A, open picker, choose the mode and B using real input; require snapshot columns with the scrolling appearance appear while the modifier is held, keeping live pages full width. Repeat on an existing A/B split adding C, then D. Through the layout menu, arrange the selected split with the same choice. Hold Option+Shift on Mac or Alt+Shift elsewhere; wheel/trackpad, release and require centered tab. Escape must restore the starting tab, and opening the menu must cancel. Confirm only one scrolling choice appears in both entry points. Drag a column right edge, double-click/reset header, then Reset all column widths; require widths reset without losing pages or jumping the strip back to the selected tab. Restore old snapshot and scrolling sessions with fractional column widths; require the same split and widths under Scrolling (experimental). Relaunch after resizing and require widths to survive. Test slow-page paint recovery and window resize. Keep a typed draft, page scroll and history while changing layouts; require page identity/state retained.

Capture the action transcript and before/after screenshots under the helper's evidence directory. Record each entry point separately.

## Gotchas

test-multiwindow.mjs covers mapping/geometry; test-multiple-floats.mjs covers add/join, presentation state, navigation and cleanup. These mock Zen; native rendering, pointer input, page retention and entry paths remain required.
