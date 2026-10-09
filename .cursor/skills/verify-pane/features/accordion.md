# Horizontal accordion

Arrange open tabs so one page expands while neighboring live edges remain.

## Sub-features

- `accordion`: Horizontal accordion from picker and layout menu; solo and existing split; 2 and 4 panes.

## How to get to it (user POV)

Picker #pane-open-modes [data-mode="accordion"]; existing split toolbar three-dot menu #pane-layout-menu [data-mode="accordion"].

## Driving it with native Zen UI

Preconditions: SKILL.md doctor passes for the owned throwaway profile; seed A/B/C/D. Run the fixture helper first.

From solo A, open picker, choose the mode and B using real input; require one page expands while neighboring live edges remain. Repeat on an existing A/B split adding C, then D. Through the layout menu, arrange the selected split with the same choice. Click each live edge and use focused-edge Left/Right/Home/End; require wrap and selected page. Use Restore tiled layout and require original divider ratios. Current-tab drag resize is a separate roadmap item, not assumed implemented. Keep a typed draft, page scroll and history while changing layouts; require page identity/state retained.

Capture the action transcript and before/after screenshots under the helper's evidence directory. Record each entry point separately.

## Gotchas

test-multiwindow.mjs covers mapping/geometry; test-multiple-floats.mjs covers add/join, presentation state, navigation and cleanup. These mock Zen; native rendering, pointer input, page retention and entry paths remain required.
