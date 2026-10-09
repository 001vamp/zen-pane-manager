# Snapshot scrolling

Arrange open tabs so snapshot cards appear without resizing the live page.

## Sub-features

- `snapshot`: Snapshot scrolling from picker and layout menu; solo and existing split; 2 and 4 panes.

## How to get to it (user POV)

Picker #pane-open-modes [data-mode="snapshot"]; existing split toolbar three-dot menu #pane-layout-menu [data-mode="snapshot"].

## Driving it with native Zen UI

Preconditions: SKILL.md doctor passes for the owned throwaway profile; seed A/B/C/D. Run the fixture helper first.

From solo A, open picker, choose the mode and B using real input; require snapshot cards appear without resizing the live page. Repeat on an existing A/B split adding C, then D. Through the layout menu, arrange the selected split with the same choice. Hold Option+Shift on Mac or Alt+Shift elsewhere; wheel/trackpad across cards, release and require centered tab. Escape must restore starting tab. Require live page viewport and draft/scroll unchanged; test page paint after selection and resize window. Keep a typed draft, page scroll and history while changing layouts; require page identity/state retained.

Capture the action transcript and before/after screenshots under the helper's evidence directory. Record each entry point separately.

## Gotchas

test-multiwindow.mjs covers mapping/geometry; test-multiple-floats.mjs covers add/join, presentation state, navigation and cleanup. These mock Zen; native rendering, pointer input, page retention and entry paths remain required.
