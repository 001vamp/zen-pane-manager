# Grid

Arrange open tabs so A/B/C occupy distinct grid cells.

## Sub-features

- `grid`: Grid from picker and layout menu; solo and existing split; 2 and 4 panes.

## How to get to it (user POV)

Picker #pane-open-modes [data-mode="grid"]; existing split toolbar three-dot menu #pane-layout-menu [data-mode="grid"].

## Driving it with native Zen UI

Preconditions: SKILL.md doctor passes for the owned throwaway profile; seed A/B/C/D. Run the fixture helper first.

From solo A, open picker, choose the mode and B using real input; require A and B occupy distinct grid cells. Repeat on an existing A/B split adding C, then D, and require the four pages occupy separate cells. Through the layout menu, arrange the selected split with the same choice. Replace one grid cell via picker, then return one cell to a normal tab and Unsplit; require the remaining pages and sidebar origins retained. Keep a typed draft, page scroll and history while changing layouts; require page identity/state retained.

Capture the action transcript and before/after screenshots under the helper's evidence directory. Record each entry point separately.

## Gotchas

test-multiwindow.mjs covers mapping/geometry; test-multiple-floats.mjs covers add/join, presentation state, navigation and cleanup. These mock Zen; native rendering, pointer input, page retention and entry paths remain required.
